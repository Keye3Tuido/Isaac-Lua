/* ===================================================================
 * LuaMin v2 lens family: factor — 仿射因子/字面量/糖透镜族（M4）
 * 移植自 v1 src/folds.js：foldStringLiterals / foldStringFactors / foldFieldPrefix
 * （多级 DP）/ foldDotAlias / foldCallSugar / foldGlobalViaG / foldMethods。
 *
 * 与 v1 的结构差异（设计 §6.4 组合化）：v1 各 pass 手工把新别名【注入既有 batched
 * local 尾部】省 6 字；v2 一律头部独立 local（dropLeading 由 lens.js 机器重算），
 * 合批收益由 hoist.localsMerge 在不动点里发现——注入特例机制整体消失。
 *
 * inject 方向：别名类一律复用 alias.js injectAlias；callSugar 实现真实逆
 * （f"x"→f("x")）；dotAlias/globalViaG 的逆 = bracketDot 族（不重复实现）。
 * =================================================================== */
(function(root){
  'use strict';

  var irMod = null, lensMod = null, aliasMod = null, canonMod = null;
  if(typeof module !== 'undefined' && module.exports){
    irMod = require('../ir.js');
    lensMod = require('../lens.js');
    aliasMod = require('./alias.js');
    canonMod = require('../canonical2.js');
  }else if(root.__LuaMin2Modules){
    irMod = root.__LuaMin2Modules['ir'];
    lensMod = root.__LuaMin2Modules['lens'];
    aliasMod = root.__LuaMin2Modules['lenses/alias'];
    canonMod = root.__LuaMin2Modules['canonical2'];
  }
  function needIR(){ if(!irMod) throw new Error('factor.js: 需要 src2/ir.js'); return irMod; }

  function preview(ir, edits, deps){
    return lensMod.encodeDelta(ir.src, irMod.applyTextEdits(ir.src, edits), deps);
  }
  function walkAst(node, visit){
    if(!node || typeof node !== 'object') return;
    if(Array.isArray(node)){ for(var i=0;i<node.length;i++) walkAst(node[i], visit); return; }
    if(visit(node) === false) return;
    for(var k in node){
      if(k === 'range' || k === 'loc') continue;
      if(Object.prototype.hasOwnProperty.call(node, k)) walkAst(node[k], visit);
    }
  }
  function isNamePart(c){ return !!c && (/[A-Za-z0-9_]/).test(c); }

  // allocName(ir)：分配不冲突的短名（AST 标识符 + 别名名 + 关键字由分配器排除）
  function allocName(ir){
    var taken = ir._base._collectTakenNames(ir.ast);
    ir.aliases.entries.forEach(function(_, n){ taken.add(n); });
    return ir._base._createNameAllocator(taken)();
  }

  // 声明注入统一走 alias.js 的 mkAliasDecl（头部注入优先，独立 local 兜底）。

  // strContent(node)：短字符串内容（长字符串不归一，返回 null；unquoteShort 同口径）
  function strContent(node){
    if(!node || node.type !== 'StringLiteral') return null;
    if(typeof node.value === 'string') return node.value;
    var raw = node.raw || '';
    if(raw.length >= 2 && (raw[0] === '"' || raw[0] === "'")) return raw.slice(1,-1);
    return null;   // 长字符串不参与（unquoteShort 同口径）
  }

  // headerEnd(ir)：别名头末尾偏移（头部语句内的字面量/访问点不可改写——自引用保护）
  function headerEnd(ir){
    var drop = ir.aliases.dropLeading || 0;
    if(drop > 0 && drop <= ir.ast.body.length && ir.ast.body[drop-1].range)
      return ir.ast.body[drop-1].range[1];
    return 0;
  }

  // 双侧还原 verify（别名产生/消耗透镜通用；与终审同一实现，§6.2）
  function mkBilateralVerify(){
    return function(ir, cand, result){
      try{
        var amA = canonMod.buildAliasMap(ir), amB = canonMod.buildAliasMap(result.ir);
        var ka = amA ? ir._base._canonical(ir.src, amA) : ir._base._canonical(ir.src);
        var kb = amB ? ir._base._canonical(result.ir.src, amB) : ir._base._canonical(result.ir.src);
        return ka === kb;
      }catch(e){ return false; }
    };
  }

  /* ---------- factor.stringLiteral：重复字符串字面量提取别名 ----------
   * 移植 foldStringLiterals：同内容短串 ≥2 处、raw≥4、content≥3、canSingleQuote；
   * StringCall 参数站点改写为 (u)（a'X' → a(u)），其余站点 u + 粘连守卫。 */
  function createStringLiteralLens(deps){
    return {
      name: 'factor.stringLiteral', kind: 'extract',
      requires: ['ssa'], provides: ['alias:string'], consumes: [], conflicts: [],
      match: function(ir){
        var src = ir.src, out = [];
        var hEnd = headerEnd(ir);
        var callArgNodes = new Set();
        walkAst(ir.ast.body, function(n){
          if(n.type === 'StringCallExpression' && n.argument && n.argument.type === 'StringLiteral')
            callArgNodes.add(n.argument);
        });
        var lit2sites = Object.create(null);
        walkAst(ir.ast.body, function(n){
          if(n.type === 'StringLiteral' && n.range && n.range[0] >= hEnd){
            var content = strContent(n);
            if(content !== null && n.raw.length >= 4 && content.length >= 3
               && ir._base._canSingleQuote(content)){
              (lit2sites[content] = lit2sites[content] || []).push({
                start: n.range[0], end: n.range[1], callArg: callArgNodes.has(n) });
            }
            return false;
          }
        });
        // 去重（v1 foldAliasDedup 同义）：目标串已有别名条目（string/member/prefix 任意
        // 形态）时不再重复建别名——dotAliasLit 会把站点改写给既有别名。实证 sqlite/
        // defs.lua：fieldPrefix 的 'constraint_' 因子与 stringLiteral 的同名字符串
        // 别名双份声明（+12，该文件残余回退的主账）。
        var existingTargets = Object.create(null);
        ir.aliases.entries.forEach(function(e, name){
          if(e.kind === 'string' || e.kind === 'member' || e.kind === 'prefix')
            if(!existingTargets[e.target]) existingTargets[e.target] = name;
        });
        Object.keys(lit2sites).forEach(function(content){
          var sites = lit2sites[content];
          if(sites.length < 2) return;
          if(existingTargets[content] !== undefined) return;   // 已有别名可复用（dotAliasLit 改写）
          var alias = allocName(ir);
          if(!alias) return;
          var siteEdits = [];
          sites.forEach(function(s){
            var name = s.callArg ? ('(' + alias + ')') : alias;
            var spacer = (!s.callArg && ir._base._needsSepAfter(alias[alias.length-1], src[s.end])) ? ' ' : '';
            siteEdits.push({ start: s.start, end: s.end, text: name + spacer });
          });
          // v1 收益复核：ΣperSite − 声明成本。声明成本按 mkAliasDecl 实际返回的
          // 注入形态精算（注入宿主=,u='X' ≈ v1 的 4 口径；独立 local ≈ v1 的 10 口径）——
          // 旧实现恒按 10 预筛，可注入宿主时把小增益串（'function'/'string' 等）挡在
          // match 之外：v1 同串正收益折叠、v2 漏折（bulk 回退的主账之一）。
          var perSite = 0;
          sites.forEach(function(s){
            perSite += (s.callArg ? content.length : content.length + 2) - alias.length;
          });
          var decl = aliasMod.mkAliasDecl(ir, alias, "'" + content + "'", siteEdits, false);
          var declCost = 0;
          decl.edits.forEach(function(e){ declCost += e.text.length; });   // 全部纯插入
          if(perSite - declCost <= 0) return;
          out.push({ id:'stringLiteral:' + content, name: alias, target: content,
                     _edits: decl.edits.concat(siteEdits),
                     _declRange: decl.declRange, _injected: decl.injected });
        });
        return out;
      },
      cost: function(ir, cand){ return { delta: preview(ir, cand._edits, deps), confidence: 'exact' }; },
      extract: function(ir, cand){
        return { edits: cand._edits,
          form: { aliasEntries: [{ name: cand.name, entry: {
            kind: 'string', target: cand.target,
            declRange: cand._declRange ? cand._declRange.slice() : null,
            injected: !!cand._injected,
            introducedBy: 'factor.stringLiteral', roundtripKey: cand.id }}] },
          residue: {} };
      },
      inject: aliasMod ? aliasMod.injectAlias : null
    };
  }

  /* ---------- factor.stringPrefix：字符串公共前缀因子（foldStringFactors 移植） ----------
   * 每轮提取收益最大的公共前缀为一枚候选；多级嵌套由不动点迭代涌现（候选在
   * 新形态上重新计算 tail，与 v1 while(rounds<8) 等效）。 */
  function createStringPrefixLens(deps){
    return {
      name: 'factor.stringPrefix', kind: 'extract',
      requires: ['ssa'], provides: ['alias:string'], consumes: [], conflicts: [],
      match: function(ir){
        var src = ir.src;
        var hEnd = headerEnd(ir);
        var callArgNodes = new Set();
        var bracketKeyNodes = new Set();
        var KEYWORDS = root.LuaMin && root.LuaMin.KEYWORDS ? root.LuaMin.KEYWORDS : {};
        walkAst(ir.ast.body, function(n){
          if(n.type === 'StringCallExpression' && n.argument && n.argument.type === 'StringLiteral')
            callArgNodes.add(n.argument);
          // 括号键位（t["X"] 的 X）：norm.bracketDot 可无声明成本转成 .X——凡可被它
          // 转换（标识符样、非关键字）的串参与前缀因子只是平白付因子声明（实证
          // sqlite/defs.lua 的 ioerr_/open_ 族：因子声明 +12 而 bracketDot 免费，
          // 全键位家族恒亏 = 该文件 +24 的主账之一）。v1 靠 pass 序（bracketDot 最先）
          // 天然隔离，v2 透镜拓扑序下须显式排除。
          if(n.type === 'IndexExpression' && n.index && n.index.type === 'StringLiteral')
            bracketKeyNodes.add(n.index);
        });
        function bracketDotConvertible(n, content){
          return bracketKeyNodes.has(n) && /^[A-Za-z_][A-Za-z0-9_]*$/.test(content) && !KEYWORDS[content];
        }
        var strs = [];
        walkAst(ir.ast.body, function(n){
          // 头部别名声明的字符串值【也】参与因子分解（v1 排除头部是其注入形态限制）。
          // 安全性由 mkAliasDecl 的 editsInside 守卫保证（useEdits=真实站点）：
          // 成员落在宿主语句内时退回 0 偏移独立 local，因子名恒先于一切读点绑定。
          if(n.type === 'StringLiteral' && n.range && !callArgNodes.has(n)){
            var content = strContent(n);
            if(content !== null && n.raw.length >= 4 && content.length >= 2
               && ir._base._canSingleQuote(content)
               && !bracketDotConvertible(n, content)){
              strs.push({ content: content, start: n.range[0], end: n.range[1] });
            }
            return false;
          }
        });
        if(strs.length < 2) return [];
        // 最优公共前缀（v1 单轮逻辑；gain 公式逐字）
        var best = null;
        for(var ai=0; ai<strs.length; ai++){
          var s = strs[ai];
          for(var L=2; L<=s.content.length; L++){
            var pre = s.content.slice(0, L);
            var mem = strs.filter(function(x){ return x.content.length > L && x.content.slice(0,L) === pre; });
            if(mem.length < 2) continue;
            var gain = (pre.length-1-2) * mem.length - (1 + pre.length + 9);
            if(gain > 0 && (!best || gain > best.gain)) best = { affix: pre, members: mem, gain: gain };
          }
        }
        if(!best) return [];
        var fname = allocName(ir);
        if(!fname) return [];
        // 真实因子名长度复核
        if((best.affix.length - fname.length - 2) * best.members.length - (fname.length + best.affix.length + 9) <= 0)
          return [];
        // 站点改写先于声明构造，并作为 useEdits 传入 mkAliasDecl：成员含头部别名值
        // （本透镜的 v2 扩展，v1 仅 body 成员）时，注入宿主语句会让同句 init 里的
        // fname 引用在绑定前求值（local 全线 init 先求值——实证 30log/instances 的
        // y..'Of' 断头引用）。更一般地，任一成员落在【任意】头部语句内（含多句头部
        // 的靠前语句，editsInside 只探宿主句覆盖不到）时，声明必须回到 0 偏移独立
        // local（v1 foldStringFactors 的 decl+body 同形态），先于一切读点绑定。
        var hEnd2 = headerEnd(ir), headerMember = false;
        var siteEdits = [];
        best.members.forEach(function(s){
          if(s.start < hEnd2) headerMember = true;
          var rest = s.content.slice(best.affix.length);
          siteEdits.push({ start: s.start, end: s.end, text: fname + "..'" + rest + "'" });
        });
        var declEdits;
        if(headerMember){
          declEdits = { edits: [{ start: 0, end: 0, text: 'local ' + fname + "='" + best.affix + "' " }],
                        declRange: [0, 6 + fname.length], injected: false };
        }else{
          declEdits = aliasMod.mkAliasDecl(ir, fname, "'" + best.affix + "'", siteEdits, false);
        }
        var edits = declEdits.edits.concat(siteEdits);
        return [{ id:'stringPrefix:' + best.affix, name: fname, target: best.affix,
                  _edits: edits, _declRange: declEdits.declRange, _injected: declEdits.injected }];
      },
      cost: function(ir, cand){ return { delta: preview(ir, cand._edits, deps), confidence: 'exact' }; },
      extract: function(ir, cand){
        return { edits: cand._edits,
          form: { aliasEntries: [{ name: cand.name, entry: {
            kind: 'prefix', target: cand.target,
            declRange: cand._declRange ? cand._declRange.slice() : null,
            injected: !!cand._injected,
            introducedBy: 'factor.stringPrefix', roundtripKey: cand.id }}] },
          residue: {} };
      },
      inject: aliasMod ? aliasMod.injectAlias : null
    };
  }

  /* ---------- factor.fieldPrefix：字段前缀折叠（多级 DP，foldFieldPrefix 移植） ----------
   * 候选前缀树 + DP 选最优抽取集合为【一枚复合候选】（§3 复合候选：区间重映射自动支持）。
   * v1 的"注入 batched local"路径由 localsMerge 组合替代，这里恒走独立 local 退路。 */
  function createFieldPrefixLens(deps){
    return {
      name: 'factor.fieldPrefix', kind: 'extract',
      requires: ['ssa'], provides: ['alias:prefix'], consumes: [], conflicts: [],
      match: function(ir){
        var src = ir.src;
        // 收集 obj.Field 站点（FunctionDeclaration identifier 链跳过，v1 同口径）
        var fieldSites = Object.create(null);
        (function walk(n){
          if(!n || typeof n !== 'object') return;
          if(Array.isArray(n)){ for(var i=0;i<n.length;i++) walk(n[i]); return; }
          if(n.type === 'FunctionDeclaration'){ walk(n.body); return; }
          if(n.type === 'MemberExpression' && n.indexer === '.' && n.identifier && n.base && n.base.range && n.identifier.range){
            (fieldSites[n.identifier.name] = fieldSites[n.identifier.name] || []).push({
              baseEnd: n.base.range[1], idEnd: n.identifier.range[1] });
          }
          for(var k in n){
            if(k === 'range' || k === 'loc') continue;
            if(Object.prototype.hasOwnProperty.call(n, k)) walk(n[k]);
          }
        })(ir.ast.body);
        var fields = Object.keys(fieldSites);
        if(fields.length < 2) return [];

        function prefixCandidates(field){
          var out = [], i = 0;
          while(i < field.length){
            var u = field.indexOf('_', i);
            if(u < 0) break;
            out.push(field.slice(0, u+1));
            i = u+1;
          }
          return out;
        }
        function lcp(a, b){
          var i = 0, n = Math.min(a.length, b.length);
          while(i < n && a.charCodeAt(i) === b.charCodeAt(i)) i++;
          return a.slice(0, i);
        }
        var prefixGroups = Object.create(null);
        function add(p, f){
          if(p.length < 2) return;
          var cur = prefixGroups[p] = prefixGroups[p] || [];
          for(var i=0;i<cur.length;i++) if(cur[i].field === f) return;
          cur.push({ field: f, sites: fieldSites[f].length });
        }
        fields.forEach(function(f){ prefixCandidates(f).forEach(function(p){ add(p, f); }); });
        for(var i=0;i<fields.length;i++)
          for(var j=i+1;j<fields.length;j++){
            var pp = lcp(fields[i], fields[j]);
            add(pp, fields[i]); add(pp, fields[j]);
          }

        // ---- 多级前缀 DP（逐字移植 v1；declOverhead 恒 10 = 独立 local 口径）----
        var cands = Object.keys(prefixGroups).sort(function(a,b){ return a.length - b.length; });
        var deepestOf = Object.create(null);
        fields.forEach(function(f){
          var deep = null;
          for(var ci=0; ci<cands.length; ci++){
            var p = cands[ci];
            if(f.length > p.length && f.indexOf(p) === 0)
              if(deep === null || p.length > deep.length) deep = p;
          }
          deepestOf[f] = deep;
        });
        var parentOf = Object.create(null);
        cands.forEach(function(q){
          var par = null;
          for(var ci=0; ci<cands.length; ci++){
            var p = cands[ci];
            if(p === q) continue;
            if(q.length > p.length && q.indexOf(p) === 0)
              if(par === null || p.length > par.length) par = p;
          }
          parentOf[q] = par || '';
        });
        var childrenOf = Object.create(null);
        cands.forEach(function(q){
          var par = parentOf[q];
          (childrenOf[par] = childrenOf[par] || []).push(q);
        });
        var ownedFields = Object.create(null);
        fields.forEach(function(f){
          var d = deepestOf[f] || '';
          (ownedFields[d] = ownedFields[d] || []).push({ field: f, sites: fieldSites[f].length });
        });
        function accessLen(field, factorPrefix){
          if(factorPrefix === '') return field.length + 1;
          return field.length - factorPrefix.length + 7;
        }
        function declCost(prefix, parentPrefix){
          if(parentPrefix === '') return prefix.length + 5;
          return (prefix.length - parentPrefix.length) + 9;
        }
        var memo = Object.create(null);
        function solve(node, parentFactor){
          var key = node + ' ' + parentFactor;
          if(Object.prototype.hasOwnProperty.call(memo, key)) return memo[key];
          var owned = ownedFields[node] || [];
          var children = childrenOf[node] || [];
          var childRes1 = children.map(function(ch){ return solve(ch, parentFactor); });
          var cost1 = 0;
          owned.forEach(function(of){ cost1 += of.sites * accessLen(of.field, parentFactor); });
          childRes1.forEach(function(r){ cost1 += r.cost; });
          var chosen1 = [];
          childRes1.forEach(function(r){ chosen1 = chosen1.concat(r.chosen); });
          if(node !== ''){
            var childRes2 = children.map(function(ch){ return solve(ch, node); });
            var cost2 = declCost(node, parentFactor);
            owned.forEach(function(of){ cost2 += of.sites * accessLen(of.field, node); });
            childRes2.forEach(function(r){ cost2 += r.cost; });
            if(cost2 < cost1){
              var chosen2 = [{ prefix: node, parentPrefix: parentFactor }];
              childRes2.forEach(function(r){ chosen2 = chosen2.concat(r.chosen); });
              var res = { cost: cost2, chosen: chosen2 };
              memo[key] = res;
              return res;
            }
          }
          var res2 = { cost: cost1, chosen: chosen1 };
          memo[key] = res2;
          return res2;
        }
        var chosen = solve('', '').chosen;
        if(!chosen.length) return [];

        // 拓扑排序：父先于子（别名分配与派生赋值都按此顺序）
        var chosenByPrefix = Object.create(null);
        chosen.forEach(function(c){ chosenByPrefix[c.prefix] = c; });
        var visited = Object.create(null), topoOut = [];
        function visitTopo(p){
          if(visited[p]) return;
          visited[p] = true;
          var c = chosenByPrefix[p];
          if(c && c.parentPrefix) visitTopo(c.parentPrefix);
          topoOut.push(c);
        }
        chosen.forEach(function(c){ visitTopo(c.prefix); });
        chosen = topoOut;

        // 真实别名 + 复核；declOverhead 与声明形态联动（注入宿主=4 / 独立 local=10，v1 同口径）。
        // 目标前缀已有别名条目（string/member/prefix 同值）时【复用其名、声明成本归零】——
        // 否则与 stringLiteral/前一轮因子双份声明（v1 foldAliasDedup 同义，实证 sqlite/
        // defs.lua 的 'constraint_' 双别名 +12）。
        var drop0 = ir.aliases.dropLeading || 0;
        var canInject = !!(drop0 > 0 && drop0 <= ir.ast.body.length
                           && aliasMod.probeInjectableLocal(ir.ast.body[drop0-1], true));
        var declOverhead = canInject ? 4 : 10;
        var taken = ir._base._collectTakenNames(ir.ast);
        ir.aliases.entries.forEach(function(_, n){ taken.add(n); });
        var existingByTarget = Object.create(null);
        ir.aliases.entries.forEach(function(e, n){
          if(e.kind === 'string' || e.kind === 'member' || e.kind === 'prefix')
            if(!existingByTarget[e.target]) existingByTarget[e.target] = n;
        });
        var allocator = ir._base._createNameAllocator(taken);
        var aliasOf = Object.create(null), reusedOf = Object.create(null);
        for(var xi=0; xi<chosen.length; xi++){
          if(existingByTarget[chosen[xi].prefix]){
            aliasOf[chosen[xi].prefix] = existingByTarget[chosen[xi].prefix];
            reusedOf[chosen[xi].prefix] = true;
            continue;
          }
          var a = allocator();
          if(!a) return [];
          aliasOf[chosen[xi].prefix] = a;
        }
        var baseline = 0;
        fields.forEach(function(f){ baseline += fieldSites[f].length * (f.length + 1); });
        var realCost = 0;
        chosen.forEach(function(c){
          var a = aliasOf[c.prefix], alen = a.length;
          if(reusedOf[c.prefix]) return;   // 复用既有别名：无新增声明
          if(!c.parentPrefix) realCost += alen + c.prefix.length + declOverhead;
          else realCost += (alen + 1) + (alen + aliasOf[c.parentPrefix].length + (c.prefix.length - c.parentPrefix.length) + 5);
        });
        fields.forEach(function(f){
          var cover = null;
          for(var i2=0;i2<chosen.length;i2++){
            var c = chosen[i2];
            if(f.length > c.prefix.length && f.indexOf(c.prefix) === 0)
              if(cover === null || c.prefix.length > cover.length) cover = c.prefix;
          }
          var a = cover ? aliasOf[cover] : null;
          realCost += fieldSites[f].length * (a ? (a.length + (f.length - cover.length) + 6) : (f.length + 1));
        });
        if(realCost >= baseline) return [];

        // 编辑：站点改写 + 声明（优先注入头部别名区末条 local——v1 inject 路径，
        // 省独立 local 的 6 字；否则头部独立 local 退路，合批由 localsMerge 组合发现）
        var siteEdits = [];
        fields.forEach(function(f){
          var cover = null;
          for(var i3=0;i3<chosen.length;i3++){
            var c = chosen[i3];
            if(f.length > c.prefix.length && f.indexOf(c.prefix) === 0)
              if(cover === null || c.prefix.length > cover.length) cover = c.prefix;
          }
          if(!cover) return;
          var a = aliasOf[cover];
          var rest = f.slice(cover.length);
          fieldSites[f].forEach(function(s){
            siteEdits.push({ start: s.baseEnd, end: s.idEnd, text: '[' + a + "..'" + rest + "']" });
          });
        });
        var indep = chosen.filter(function(c){ return !c.parentPrefix; });
        var derived = chosen.filter(function(c){ return c.parentPrefix; });
        // 复用条目（同名既有别名）不进声明：名/值/派生赋值只计新增前缀
        var fresh = chosen.filter(function(c){ return !reusedOf[c.prefix]; });
        var freshIndep = fresh.filter(function(c){ return !c.parentPrefix; });
        var freshDerived = fresh.filter(function(c){ return c.parentPrefix; });
        var drop = ir.aliases.dropLeading || 0;
        var host = (drop > 0 && drop <= ir.ast.body.length
                    && aliasMod.probeInjectableLocal(ir.ast.body[drop-1], true)) ? ir.ast.body[drop-1] : null;
        var declEdits;
        if(host && fresh.length){
          // 注入：名字追加到宿主名列表尾，独立因子的值追加到值列表尾，派生赋值跟在语句后
          var lastVar = host.variables[host.variables.length-1];
          var injectNames = ',' + fresh.map(function(c){ return aliasOf[c.prefix]; }).join(',');
          var injectVals = freshIndep.length ? ',' + freshIndep.map(function(c){ return "'" + c.prefix + "'"; }).join(',') : '';
          var assigns = freshDerived.map(function(c){
            return aliasOf[c.prefix] + '=' + aliasOf[c.parentPrefix] + "..'" + c.prefix.slice(c.parentPrefix.length) + "'";
          }).join(' ');
          var tailCh = injectVals.length ? injectVals[injectVals.length-1] : src[host.range[1]-1];
          var sep = (assigns && isNamePart(tailCh)) ? ' ' : '';
          declEdits = [
            { start: lastVar.range[1], end: lastVar.range[1], text: injectNames },
            { start: host.range[1], end: host.range[1], text: injectVals + (assigns ? sep + assigns : '') }
          ];
        }else if(fresh.length){
          var declNames = fresh.map(function(c){ return aliasOf[c.prefix]; }).join(',');
          var declVals = freshIndep.map(function(c){ return "'" + c.prefix + "'"; }).join(',');
          var assigns2 = freshDerived.map(function(c){
            return aliasOf[c.prefix] + '=' + aliasOf[c.parentPrefix] + "..'" + c.prefix.slice(c.parentPrefix.length) + "'";
          }).join(' ');
          var headText = 'local ' + declNames + (declVals ? '=' + declVals : '') + ' ' + (assigns2 ? assigns2 + ' ' : '');
          declEdits = [{ start: 0, end: 0, text: headText }];
        }else{
          declEdits = [];
        }
        var edits = declEdits.concat(siteEdits);
        var entries = fresh.map(function(c){
          return { name: aliasOf[c.prefix], entry: {
            kind: 'prefix', target: c.prefix,
            declRange: null,   // 复合声明：INV-1 由 binding 级校验（declRange 为 null 走 injected 通道）
            injected: true, introducedBy: 'factor.fieldPrefix',
            roundtripKey: 'fieldPrefix:' + c.prefix } };
        });
        return [{ id:'fieldPrefix:' + chosen.map(function(c){return c.prefix;}).join('|'),
                  _edits: edits, _entries: entries }];
      },
      cost: function(ir, cand){ return { delta: preview(ir, cand._edits, deps), confidence: 'exact' }; },
      extract: function(ir, cand){
        return { edits: cand._edits, form: { aliasEntries: cand._entries }, residue: {} };
      },
      inject: aliasMod ? aliasMod.injectAlias : null,
      verify: mkBilateralVerify()   // 复合候选含派生赋值，双向还原更稳
    };
  }

  /* ---------- factor.dotAlias：点访问/字面量复用已有别名（foldDotAlias 移植） ---------- */

  function createDotAliasLens(deps){
    return {
      name: 'factor.dotAlias', kind: 'rewrite',
      requires: [], provides: [], consumes: [], conflicts: [],
      match: function(ir){
        var src = ir.src, out = [];
        // 别名图：字段/字符串别名 name -> 字符串值（AliasEnv 单一事实来源）。
        // fieldToAlias 与 v1 foldDotAlias 同口径：stringAliasByLocal【与】memberByLocal
        // 都参与 .Field → [alias]（v1 里前缀因子也登记在 stringAliasByLocal，故 prefix
        // 条目同入）；每处收益闸门 |F|+1 > |u|+2 在建图时并入。旧实现只收 member 条目，
        // 字符串别名不复用于点访问改写——bulk 里 .name/.class 类站点成片漏改。
        var fieldToAlias = {}, litToAlias = {}, prefixAliases = [];
        ir.aliases.entries.forEach(function(e, name){
          if(e.kind !== 'member' && e.kind !== 'string' && e.kind !== 'prefix') return;
          if(!litToAlias[e.target]) litToAlias[e.target] = name;
          if(e.kind === 'prefix' || e.kind === 'string' || e.kind === 'member')
            prefixAliases.push({ name: name, target: e.target });
          if(e.target.length + 1 > name.length + 2
             && !fieldToAlias[e.target]) fieldToAlias[e.target] = name;
        });
        // 前缀因子复用（v2 增量序的补救通道）：bracketDot 逐站转换与 fieldPrefix 家族
        // 折叠的时序交错，会让家族尾部成员落单（单成员不再成族——sqlite/defs.lua 的
        // .cantopen_symlink/.constraint_vtab 类 +10）。已有前缀别名 P（prefix/string/
        // member 条目皆可——按名代值后 canonical 同一归一）时 .Pxxx → [P..'xxx']
        //（更短才改写；v1 由整批 foldFieldPrefix 一次覆盖，无需此通道）。
        prefixAliases.sort(function(x, y){ return y.target.length - x.target.length; });
        function prefixCover(field){
          for(var i=0; i<prefixAliases.length; i++){
            var P = prefixAliases[i];
            if(field.length > P.target.length && field.indexOf(P.target) === 0
               && P.target.length - P.name.length > 5)
              return P;
          }
          return null;
        }
        var hEnd = headerEnd(ir);
        // ① 点访问 .Field → [alias]
        var groups = new Map();
        var ex = aliasMod;   // collectMemberAccess 经 shared/analyze（alias.js baseExtras 同源）
        void ex;
        (function walk(n){
          if(!n || typeof n !== 'object') return;
          if(Array.isArray(n)){ for(var i=0;i<n.length;i++) walk(n[i]); return; }
          if(n.type === 'FunctionDeclaration'){ walk(n.body); return; }
          if(n.type === 'MemberExpression' && n.indexer === '.' && n.identifier && n.base && n.base.range && n.identifier.range){
            if(!groups.has(n.identifier.name)) groups.set(n.identifier.name, []);
            groups.get(n.identifier.name).push({ baseEnd: n.base.range[1], idEnd: n.identifier.range[1] });
          }
          for(var k in n){
            if(k === 'range' || k === 'loc') continue;
            if(Object.prototype.hasOwnProperty.call(n, k)) walk(n[k]);
          }
        })(ir.ast.body);
        groups.forEach(function(sites, field){
          var alias = fieldToAlias[field];
          if(alias){
            sites.forEach(function(s){
              if(s.idEnd <= hEnd) return;
              out.push({ id:'dotAlias:' + field + '@' + s.baseEnd,
                _edits: [{ start: s.baseEnd, end: s.idEnd, text: '[' + alias + ']' }] });
            });
            return;
          }
          // 无整名别名时试前缀因子覆盖：.Pxxx → [P..'xxx']
          var P = prefixCover(field);
          if(!P) return;
          var rest = field.slice(P.target.length);
          sites.forEach(function(s){
            if(s.idEnd <= hEnd) return;
            out.push({ id:'dotAliasPrefix:' + field + '@' + s.baseEnd,
              _edits: [{ start: s.baseEnd, end: s.idEnd, text: '[' + P.name + "..'" + rest + "']" }] });
          });
        });
        // ② 字符串字面量 'X' → u（callArg 糖 f'X' → f(u)）
        // 自引用守卫预收集：variables 含别名名的 LocalStatement 的 init 区间——
        // 这些字面量是别名的【定义处】（local u='X'），替换会把 init 改成引用自身
        // （local u=u，运行时解析为未定义全局 = nil；黑名单拦 chain.cse 后
        // alias.member 注入普通代码区（≥hEnd）的声明实证：local a='AddCallback' → local a=a，
        // 且 canonical 被 aliasMap 还原同骗、终审漏过）。
        var aliasDeclInits = [];
        ir.ast.body.forEach(function(st){
          if(st.type !== 'LocalStatement' || !st.variables || !st.init) return;
          for(var vi=0; vi<st.variables.length; vi++){
            if(ir.aliases.entries.has(st.variables[vi].name)
               && st.init[vi] && st.init[vi].range)
              aliasDeclInits.push(st.init[vi].range);
          }
        });
        function inAliasDeclInit(r){
          for(var gi=0; gi<aliasDeclInits.length; gi++){
            var dr = aliasDeclInits[gi];
            if(r[0] >= dr[0] && r[1] <= dr[1]) return true;
          }
          return false;
        }
        var callArgNodes = new Set();
        walkAst(ir.ast.body, function(n){
          if(n.type === 'StringCallExpression' && n.argument && n.argument.type === 'StringLiteral')
            callArgNodes.add(n.argument);
        });
        walkAst(ir.ast.body, function(n){
          if(n.type === 'StringLiteral' && n.range && n.range[0] >= hEnd){
            var content = strContent(n);
            if(content !== null && litToAlias[content] !== undefined){
              var alias = litToAlias[content];
              if(inAliasDeclInit(n.range)) return false;   // 定义处不替换（自引用守卫）
              var repl;
              if(callArgNodes.has(n)){
                repl = '(' + alias + ')';
              }else{
                var nextCh = (n.range[1] < src.length) ? src[n.range[1]] : undefined;
                var prevCh = (n.range[0] > 0) ? src[n.range[0]-1] : undefined;
                repl = ((prevCh && isNamePart(prevCh)) ? ' ' : '') + alias
                     + (ir._base._needsSepAfter(alias[alias.length-1], nextCh) ? ' ' : '');
              }
              if(n.raw.length > repl.length)
                out.push({ id:'dotAliasLit:' + content + '@' + n.range[0],
                  _edits: [{ start: n.range[0], end: n.range[1], text: repl }] });
            }
            return false;
          }
        });
        return out;
      },
      cost: function(ir, cand){ return { delta: preview(ir, cand._edits, deps), confidence: 'exact' }; },
      extract: function(ir, cand){ return { edits: cand._edits, form: {}, residue: {} }; },
      inject: function(){ return null; }   // 逆 = bracketDot/字面量回填（归一族职责）
    };
  }

  /* ---------- factor.callSugar：f("x")→f"x"、f({})→f{}（foldCallSugar 移植，双向） ---------- */

  function createCallSugarLens(deps){
    return {
      name: 'factor.callSugar', kind: 'rewrite',
      requires: [], provides: [], consumes: [], conflicts: [],
      match: function(ir){
        var src = ir.src, out = [];
        walkAst(ir.ast.body, function(n){
          if(n.type === 'CallExpression' && n.arguments && n.arguments.length === 1
             && n.base && n.base.range && n.range){
            var arg = n.arguments[0];
            if(arg && arg.range && (arg.type === 'StringLiteral' || arg.type === 'TableConstructorExpression')){
              var left = src.slice(n.base.range[1], arg.range[0]);
              var right = src.slice(arg.range[1], n.range[1]);
              if(left.indexOf('(') >= 0 && right.lastIndexOf(')') >= 0){
                out.push({ id:'callSugar@' + n.range[0],
                  _edits: [{ start: n.base.range[1], end: arg.range[0], text: '' },
                           { start: arg.range[1], end: n.range[1], text: '' }] });
              }
            }
          }
        });
        return out;
      },
      cost: function(ir, cand){ return { delta: preview(ir, cand._edits, deps), confidence: 'exact' }; },
      extract: function(ir, cand){ return { edits: cand._edits, form: {}, residue: {} }; },
      // 真实逆方向：f"x"→f("x")、f{}→f({})（搜索层 inv 撤销过度糖化）
      inject: function(ir, sitePos){
        var out = null;
        walkAst(ir.ast.body, function(n){
          if(out) return false;
          if(n.type === 'StringCallExpression' && n.base && n.base.range && n.argument && n.argument.range){
            out = { edits: [{ start: n.base.range[1], end: n.argument.range[0], text: '(' },
                            { start: n.argument.range[1], end: n.argument.range[1], text: ')' }],
                    form: {}, residue: {} };
            return false;
          }
          if(n.type === 'TableCallExpression' && n.base && n.base.range && n.arguments && n.arguments.range){
            out = { edits: [{ start: n.base.range[1], end: n.arguments.range[0], text: '(' },
                            { start: n.arguments.range[1], end: n.arguments.range[1], text: ')' }],
                    form: {}, residue: {} };
            return false;
          }
        });
        return out;
      }
    };
  }

  /* ---------- factor.globalViaG：Global.Field → _G[alias].Field（foldGlobalViaG 移植） ---------- */

  function createGlobalViaGLens(deps){
    return {
      name: 'factor.globalViaG', kind: 'rewrite',
      requires: ['ssa'], provides: [], consumes: [], conflicts: [],
      match: function(ir){
        var src = ir.src, info = ir.info, out = [];
        var strToAlias = {};
        ir.aliases.entries.forEach(function(e, name){
          if((e.kind === 'member' || e.kind === 'string') && !strToAlias[e.target])
            strToAlias[e.target] = name;
        });
        if(!Object.keys(strToAlias).length) return out;
        if(info.assignedGlobals && info.assignedGlobals.has('_G')) return out;   // _G 被赋值 → 不是全局表
        for(var i=0;i<info.bindings.length;i++)
          if(info.bindings[i].name === '_G') return out;                         // _G 被局部遮蔽
        walkAst(ir.ast.body, function(n){
          if(n.type === 'MemberExpression' && n.indexer === '.' && n.base
             && n.base.type === 'Identifier' && n.base.range){
            var G = n.base;
            if(info.varOf.get(G) === null && G.name !== '_G' && strToAlias[G.name] !== undefined){
              var alias = strToAlias[G.name];
              if(G.name.length > 4 + alias.length){   // 仅当 _G[alias] 更短
                out.push({ id:'globalViaG:' + G.name + '@' + G.range[0],
                  _edits: [{ start: G.range[0], end: G.range[1], text: '_G[' + alias + ']' }] });
              }
            }
          }
        });
        return out;
      },
      cost: function(ir, cand){ return { delta: preview(ir, cand._edits, deps), confidence: 'exact' }; },
      extract: function(ir, cand){ return { edits: cand._edits, form: {}, residue: {} }; },
      inject: function(){ return null; }   // 逆 = _G[alias] → Global（搜索层按需）
    };
  }

  /* ---------- factor.method：obj:M(args) → obj[s](obj,args)（foldMethods 移植） ---------- */

  function createMethodLens(deps){
    return {
      name: 'factor.method', kind: 'extract',
      requires: ['ssa'], provides: ['alias:member'], consumes: [], conflicts: [],
      match: function(ir){
        var src = ir.src, out = [];
        var byMethod = {};
        walkAst(ir.ast.body, function(n){
          if(n.type === 'CallExpression' && n.base && n.base.type === 'MemberExpression'
             && n.base.indexer === ':'){
            var me = n.base;
            if(me.base && me.base.type === 'Identifier' && me.base.range && me.identifier.range){
              var lp = src.indexOf('(', me.identifier.range[1]);
              (byMethod[me.identifier.name] = byMethod[me.identifier.name] || []).push({
                method: me.identifier.name,
                baseText: src.slice(me.base.range[0], me.base.range[1]),
                colonPos: me.base.range[1], idEnd: me.identifier.range[1],
                lparenPos: lp, hasArgs: !!(n.arguments && n.arguments.length > 0)
              });
            }
          }
        });
        Object.keys(byMethod).forEach(function(mname){
          var group = byMethod[mname];
          if(group.length < 2) return;   // 单次调用：self 重复必然变长
          var alias = allocName(ir);
          if(!alias) return;
          var siteEdits = [];
          group.forEach(function(s){
            siteEdits.push({ start: s.colonPos, end: s.idEnd, text: '[' + alias + ']' });
            if(s.lparenPos >= 0)
              siteEdits.push({ start: s.lparenPos+1, end: s.lparenPos+1,
                               text: s.hasArgs ? (s.baseText + ',') : s.baseText });
          });
          var decl = aliasMod.mkAliasDecl(ir, alias, "'" + mname + "'", siteEdits, false);
          out.push({ id:'method:' + mname, name: alias, target: mname,
                     _edits: decl.edits.concat(siteEdits),
                     _declRange: decl.declRange, _injected: decl.injected });
        });
        return out;
      },
      cost: function(ir, cand){ return { delta: preview(ir, cand._edits, deps), confidence: 'exact' }; },
      extract: function(ir, cand){
        return { edits: cand._edits,
          form: { aliasEntries: [{ name: cand.name, entry: {
            kind: 'member', target: cand.target,
            declRange: cand._declRange ? cand._declRange.slice() : null,
            injected: !!cand._injected,
            introducedBy: 'factor.method', roundtripKey: cand.id }}] },
          residue: {} };
      },
      inject: aliasMod ? aliasMod.injectAlias : null
    };
  }

  /* ---------- 工厂与 part 注册 ---------- */

  // createFactorLenses(deps) -> [Lens]：因子/糖族透镜
  function createFactorLenses(deps){
    return [
      createMethodLens(deps),
      createFieldPrefixLens(deps),
      createStringLiteralLens(deps),
      createStringPrefixLens(deps),
      createDotAliasLens(deps),
      createGlobalViaGLens(deps),
      createCallSugarLens(deps)
    ];
  }

  var api = { createFactorLenses: createFactorLenses };
  (root.__LuaMin2Parts = root.__LuaMin2Parts || []).push({
    name: 'lenses/factor',
    install: function(C){ for(var k in api) C[k] = api[k]; }
  });
  root.__LuaMin2Modules = root.__LuaMin2Modules || {};
  root.__LuaMin2Modules['lenses/factor'] = api;
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
