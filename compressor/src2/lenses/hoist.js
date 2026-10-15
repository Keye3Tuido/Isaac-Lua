/* ===================================================================
 * LuaMin v2 lens family: hoist — 声明移动透镜族（M4，SSA 互逆对）
 * 对应设计 §6.3/§6.4：上提与下沉是【一对互逆透镜】，共享同一组 SSA 查询
 * （本文件的 ho 助手层），"不与 fwdnil 打架"由 RHS 引用检查（ssa 证据）自然涌现，
 * 而非补丁注释。
 *
 *   hoist.placeholderHoist   占位上提（v1 foldDeclHoist legacy 路径：名字进头部作
 *                            前向 nil 占位，原 local 降级为赋值）
 *   hoist.inlineValueToHeader 值粒度内联入头部（v1 mixed 路径的 inline 一半拆出，
 *                            §6.4；逐语句候选，传递邻接由不动点重建涌现）
 *   hoist.fwdNil             前向 nil 下沉（上提的逆：local x=nil … x=v → local x=v）
 *   hoist.localsMerge        相邻 local 合并（foldLocals）
 *   hoist.funcMerge          local function 并入前置 local（foldLocalFunc）
 *   hoist.varReuse           SSA 验证的变量复用（foldReuse）
 *
 * v1 的 FOLD_ORDER_RULES 在此表达为证据依赖（provides/requires）：
 *   fwdNil provides 'fwdnil'；localsMerge/placeholderHoist requires ['fwdnil']
 *   ——拓扑排序自动推出 v1 手工表顺序（tests2/unit/schedule_topo.js 机器校验）。
 * =================================================================== */
(function(root){
  'use strict';

  var irMod = null, lensMod = null;
  if(typeof module !== 'undefined' && module.exports){
    irMod = require('../ir.js');
    lensMod = require('../lens.js');
  }else if(root.__LuaMin2Modules){
    irMod = root.__LuaMin2Modules['ir'];
    lensMod = root.__LuaMin2Modules['lens'];
  }
  function needIR(){ if(!irMod) throw new Error('hoist.js: 需要 src2/ir.js'); return irMod; }

  function preview(ir, edits, deps){
    return lensMod.encodeDelta(ir.src, irMod.applyTextEdits(ir.src, edits), deps);
  }
  function oneWayInject(){ return null; }

  /* ---------- 共享 SSA/作用域查询（互逆透镜共用的唯一事实来源，INV-3） ---------- */

  // walkAst：通用先序遍历
  function walkAst(node, visit){
    if(!node || typeof node !== 'object') return;
    if(Array.isArray(node)){ for(var i=0;i<node.length;i++) walkAst(node[i], visit); return; }
    if(visit(node) === false) return;
    for(var k in node){
      if(k === 'range' || k === 'loc') continue;
      if(Object.prototype.hasOwnProperty.call(node, k)) walkAst(node[k], visit);
    }
  }

  // loopRangesOf(ast)：全部循环体区间（声明/赋值在循环回边上的不做声明移动）
  function loopRangesOf(ast){
    var ranges = [];
    walkAst(ast, function(n){
      if((n.type === 'WhileStatement' || n.type === 'RepeatStatement'
          || n.type === 'ForNumericStatement' || n.type === 'ForGenericStatement') && n.range)
        ranges.push(n.range);
    });
    return ranges;
  }
  function inRanges(pos, ranges){
    for(var i=0;i<ranges.length;i++) if(pos >= ranges[i][0] && pos < ranges[i][1]) return true;
    return false;
  }

  // refsBinding(node, info, bindingSet)：表达式是否引用集合内的 binding（经 varOf 解析，非按名）
  function refsBinding(node, info, bindingSet){
    var found = false;
    walkAst(node, function(n){
      if(found) return false;
      if(n.type === 'Identifier'){
        var b = info.varOf.get(n);
        if(b && bindingSet.has(b)){ found = true; return false; }
      }
    });
    return found;
  }

  // readBetween(b, lo, hi)：b 在 (lo,hi) 内是否有读/写（b.uses 含赋值目标，覆盖写）
  function readBetween(b, lo, hi){
    for(var i=0;i<b.uses.length;i++){
      var u = b.uses[i];
      if(u.range[0] > lo && u.range[0] < hi) return true;
    }
    return false;
  }

  // blockBodies(ast)：顶层 + 全部嵌套块体（if 分支/循环/do/函数体），供块级透镜枚举
  function blockBodies(ast){
    var blocks = [ast.body];
    walkAst(ast, function(n){
      if(n.type === 'IfStatement' && n.clauses){
        n.clauses.forEach(function(cl){ if(cl.body) blocks.push(cl.body); });
      }else if((n.type === 'WhileStatement' || n.type === 'RepeatStatement' || n.type === 'DoStatement'
                || n.type === 'ForNumericStatement' || n.type === 'ForGenericStatement'
                || n.type === 'FunctionDeclaration') && n.body && Array.isArray(n.body)){
        blocks.push(n.body);
      }
    });
    return blocks;
  }

  // headerIndexOf(stmts, ir)：块内别名头下标——顶层块取 dropLeading-1（无别名头则 0），
  // 嵌套块恒 0（v1 foldDeclHoist 同口径）；头部必须是 #init==#vars 的 LocalStatement
  function headerIndexOf(stmts, ir, isTop, allowPadded){
    var idx = (isTop && ir.aliases.dropLeading > 0) ? ir.aliases.dropLeading - 1 : 0;
    if(idx >= stmts.length) return -1;
    var h = stmts[idx];
    if(!h || h.type !== 'LocalStatement' || !h.variables || !h.variables.length) return -1;
    // nil 填充头（init 少于 names）对 placeholderHoist 同样可作宿主：名单尾部追加
    // 占位名不改变既有名值对应（填充槽 nil 语义不变）——实证 sha1/common 首轮上提
    // 造出填充头后，后续轮因对齐闸整块停摆（+4）。值多于名（截断丢弃值会被新名
    // 捕获）两口径都保守拒判；inlineValueToHeader 依赖对齐（下标直取 init），不传旗标。
    if(!h.init || h.init.length > h.variables.length) return -1;
    if(!allowPadded && h.init.length !== h.variables.length) return -1;
    return idx;
  }

  /* ---------- hoist.placeholderHoist：占位上提（foldDeclHoist legacy 路径） ---------- */

  function createPlaceholderHoistLens(deps){
    return {
      name: 'hoist.placeholderHoist', kind: 'rewrite',
      requires: ['ssa', 'fwdnil', 'tableFields'], provides: ['hoisted'], consumes: [], conflicts: [],
      // match(ir)：每块一个候选——头部之后合格的 local 声明整批上提（名字占位 + 降级赋值）
      match: function(ir){
        var src = ir.src, info = ir.info, out = [];
        var loops = loopRangesOf(ir.ast);
        blockBodies(ir.ast).forEach(function(stmts, bi){
          var hi = headerIndexOf(stmts, ir, bi === 0, true);   // 占位上提允许 nil 填充头
          if(hi < 0) return;
          var headerStmt = stmts[hi];
          var scopeId = info.varOf.get(headerStmt.variables[0])
            ? info.varOf.get(headerStmt.variables[0]).scope.id : null;
          if(scopeId === null) return;
          var headerNames = new Set();
          headerStmt.variables.forEach(function(v){ if(v.type === 'Identifier') headerNames.add(v.name); });
          var namesEnd = headerStmt.variables[headerStmt.variables.length-1].range[1];

          // legacy 合格判定：同作用域、单声明、未被闭包捕获（chain 别名例外——其声明
          // legacy 合格判定：同作用域、单声明、未被闭包捕获、不在循环体。
          // 捕获变量走 inlineValueToHeader 的 mixed 原子候选（inline 值 + 占位同生共死，
          // canonical fwdNil 对整体形态把关）——纯占位路径放捕获会落入不可证中间态
          //（M5 语料实证：占位+inlinePure 分步组合触发 canonical 传递性缺口）。
          // 与头部（或本候选先前十条）同名的变量不拒判：名字不重复进头部，声明降级为
          // 赋值复用（v1 foldDeclHoist 的 dup 形态——多条 `local A=…` 名字只进头部一次；
          // 实证 multi_callback：逐轮不动点把 v1 单批上提拆开后，后续同名 local 撞上
          // headerNames 闸整块停摆，+12）。活性安全：头部同名 binding 未捕获且最后使用
          // 不晚于本语句起点（死变量复用）；等价由 canonical SSA 归一（verify）兜底。
          function lastUsePos(b){
            var p = b.decls[0].range[1];
            b.uses.forEach(function(u){ if(u.range[1] > p) p = u.range[1]; });
            return p;
          }
          var headerBindOf = {};
          headerStmt.variables.forEach(function(v){
            if(v.type === 'Identifier' && !headerBindOf[v.name]){
              var hb = info.varOf.get(v);
              if(hb) headerBindOf[v.name] = hb;
            }
          });
          var hoistable = [], added = new Set(), addedBindOf = {};
          for(var si = hi+1; si < stmts.length; si++){
            var st = stmts[si];
            // local function 视作 (名字, 函数值) 声明参与占位上提：函数体求值延后，
            // 引用头部/同批名字天然安全（闭包在调用点才读值）；资格与 local 同套
            // （同作用域、单声明、未捕获、不在循环体；canonical fwdNil 对占位+函数
            // 赋值形态把关——与 funcMerge refsPrev 退化形态同一归一）。实证 luacheck
            // stages/detect_*：表赋值因 RHS 引用头部别名无法下沉后，后续 local
            // function 再无 local 前驱可并（funcMerge 只认 LocalStatement），+2/+1。
            if(st.type === 'FunctionDeclaration' && st.isLocal && st.identifier
               && st.identifier.type === 'Identifier' && st.range && st.identifier.range){
              var fullF = src.slice(st.range[0], st.range[1]);
              var mF = /^local\s+function\s+([A-Za-z_][A-Za-z0-9_]*)/.exec(fullF);
              if(!mF) continue;
              if(inRanges(st.range[0], loops)) continue;
              var fb = info.varOf.get(st.identifier);
              // 捕获不拒判：函数值调用点才读值，占位+赋值形态与 funcMerge refsPrev
              // 退化形态同一归一（canonical fwdNil 把关；不可证时 verify/门禁否决单候选）。
              var okF = !!(fb && fb.scope.id === scopeId && fb.decls.length === 1);
              if(okF && (headerNames.has(st.identifier.name) || added.has(st.identifier.name))){
                var fh = headerBindOf[st.identifier.name] || addedBindOf[st.identifier.name];
                if(!fh || fh.captured || lastUsePos(fh) > st.range[0]) okF = false;
              }
              if(!okF) continue;
              var freshF = [];
              if(!headerNames.has(st.identifier.name) && !added.has(st.identifier.name)) freshF.push(st.identifier.name);
              added.add(st.identifier.name);
              addedBindOf[st.identifier.name] = fb;
              hoistable.push({ st: st, fresh: freshF,
                funcName: mF[1], funcText: 'function' + fullF.slice(mF[0].length) });
              continue;
            }
            if(st.type !== 'LocalStatement' || !st.variables || !st.init) continue;
            // 少值截断（#init<#vars）上提：名字进头部占位，赋值部分按 init 数截断——
            // 截断位变量保持头部 nil，与原声明的 nil 填充一致（实证 sqlite/helpers：
            // localsMerge 降级形态 `local s,m=f(…)` 的 2 名 1 值语句，对齐闸一刀切使
            // 整块不可上提）。末位 init 为调用/变参时截断位可能吃到多余返回值而非
            // nil——仅当其初值无读（SSA v0 零 use，canonical B 式同口径）才可截断；
            // 多值截断（#init>#vars）保守跳过（v1 同口径）。
            if(st.init.length > st.variables.length) continue;
            if(inRanges(st.range[0], loops)) continue;
            var fewer = st.init.length < st.variables.length;
            if(fewer && st.init.length){
              var lastInit = st.init[st.init.length-1];
              var callTail = lastInit && (lastInit.type === 'CallExpression'
                || lastInit.type === 'StringCallExpression' || lastInit.type === 'TableCallExpression'
                || lastInit.type === 'VarargLiteral');
              if(callTail){
                var tailDead = true;
                for(var tvi = st.init.length; tvi < st.variables.length; tvi++){
                  var tv0 = st.variables[tvi];
                  var tb0 = tv0.type === 'Identifier' ? info.varOf.get(tv0) : null;
                  if(!tb0){ tailDead = false; break; }
                  var se0 = ir.ssa.byBinding.get(tb0);
                  if(!se0 || se0.versions[0].useSites.length){ tailDead = false; break; }
                }
                if(!tailDead) continue;
              }
            }
            var allOk = st.variables.every(function(v){
              if(v.type !== 'Identifier') return false;
              var b = info.varOf.get(v);
              if(!b || b.scope.id !== scopeId || b.decls.length !== 1) return false;
              if(b.captured) return false;
              if(headerNames.has(v.name) || added.has(v.name)){
                var hb = headerBindOf[v.name] || addedBindOf[v.name];
                if(!hb || hb.captured || lastUsePos(hb) > st.range[0]) return false;
              }
              return true;
            });
            if(!allOk || !st.variables.length) continue;
            var fresh = [];
            st.variables.forEach(function(v){
              if(!headerNames.has(v.name) && !added.has(v.name)) fresh.push(v.name);
              added.add(v.name);
              var b = info.varOf.get(v);
              if(b) addedBindOf[v.name] = b;
            });
            hoistable.push({ st: st, fresh: fresh,
              fewer: st.init.length < st.variables.length });
          }
          if(!hoistable.length) return;

          // 候选构建：hoistable 子集 → (编辑, 新占位名)
          function buildEdits(sub){
            var edits = [];
            var names = [];
            sub.forEach(function(h){
              names = names.concat(h.fresh);
              var st = h.st;
              if(h.funcText){   // local function：名字上提，声明降级为赋值
                edits.push({ start: st.range[0], end: st.range[1], text: h.funcName + '=' + h.funcText });
                return;
              }
              var vs = st.variables.map(function(v){ return src.slice(v.range[0], v.range[1]); });
              var is = st.init.map(function(n){ return src.slice(n.range[0], n.range[1]); });
              // 少值截断：赋值部分按 init 数截断（截断位由头部 nil 占位接管——末位调用
              // 的多余返回值无读已在前置闸校验）；无 init 则整条删除（不留 `a,b=` 残句）。
              var text = is.length ? vs.slice(0, is.length).join(',') + '=' + is.join(',') : '';
              edits.push({ start: st.range[0], end: st.range[1], text: text });
            });
            // 纯降级候选（全部同名复用、无新占位名）不动头部
            if(names.length) edits.push({ start: namesEnd, end: namesEnd, text: ',' + names.join(',') });
            return edits;
          }
          out.push({ id:'placeholderHoist@' + bi, _edits: buildEdits(hoistable) });
          // 兜底候选：少值截断语句混入后整批可能过不了 canonical（如实证 lua-xml/
          // xmlSimple 的 nil 声明组——循环内被多目标重赋值，占位形态不可证），整批被
          // 黑名单会连坐同块的对齐语句。补一条【仅对齐语句】的子集候选，整批被拒后
          // 调度器下一轮自然捡到（不同候选 id，不进黑名单）。
          var hasFewer = hoistable.some(function(h){ return h.fewer; });
          if(hasFewer){
            var aligned = hoistable.filter(function(h){ return !h.fewer; });
            if(aligned.length)
              out.push({ id:'placeholderHoistAligned@' + bi, _edits: buildEdits(aligned) });
          }
        });
        return out;
      },
      cost: function(ir, cand){ return { delta: preview(ir, cand._edits, deps), confidence: 'exact' }; },
      extract: function(ir, cand){ return { edits: cand._edits, form: {}, residue: {} }; },
      // 互逆对：上提的逆 = fwdNil 下沉（由 hoist.fwdNil 的 match 在新形态上自然发现）；
      // 本透镜 inject 不直接实现，避免两套逆逻辑漂移（§6.3 核心修复）。
      inject: oneWayInject
    };
  }

  /* ---------- hoist.inlineValueToHeader：值粒度内联入头部（mixed 路径的 inline 半透镜） ----------
   * 仅处理【与头部直接相邻】的 local 语句（不动点重建后传递邻接自然涌现）：
   * 不引用「头部/本语句声明 binding」且形态为纯访问链/字面量的 (名字,值) 对并入头部对齐区；
   * 全部并入则删整条语句，否则语句收缩为剩余变量的 local。引用头部的值留在原地——
   * 由 placeholderHoist 接管（调度器发现 A-then-B 序列）。 */
  function createInlineValueToHeaderLens(deps){
    // isInlineableExpr：纯访问链（Identifier/点/索引）与字面量（v1 同口径；
    // 拼接/调用/函数不进头部——干扰头部因子分解且求值提前风险高）
    function isInlineableExpr(n){
      if(!n) return false;
      switch(n.type){
        case 'Identifier': case 'NumericLiteral': case 'StringLiteral':
        case 'BooleanLiteral': case 'NilLiteral': return true;
        case 'MemberExpression': return isInlineableExpr(n.base);
        case 'IndexExpression': return isInlineableExpr(n.base) && isInlineableExpr(n.index);
        default: return false;
      }
    }
    return {
      name: 'hoist.inlineValueToHeader', kind: 'rewrite',
      requires: ['ssa', 'fwdnil'], provides: ['hoisted'], consumes: [], conflicts: [],
      // inline 单步常等长（名字+值整体搬家），收益靠后续 placeholderHoist 兑现——
      // commitAtZero 让调度器能发现 §6.4 的 A-then-B 序列（终止性：inline 后本语句
      // 不再有可 inline 值——引用头部的值天然被 refsBinding 排除，候选不回弹）。
      commitAtZero: true,
      match: function(ir){
        var src = ir.src, info = ir.info, out = [];
        blockBodies(ir.ast).forEach(function(stmts, bi){
          var hi = headerIndexOf(stmts, ir, bi === 0);
          if(hi < 0 || hi+1 >= stmts.length) return;
          var headerStmt = stmts[hi];
          var st = stmts[hi+1];   // 直接邻接（不动点重建实现传递邻接）
          if(st.type !== 'LocalStatement' || !st.variables || !st.init) return;
          if(st.init.length !== st.variables.length) return;
          if(st.variables.length > 4) return;       // mixed 语句规模限制（v1 注释语义）
          var scopeId = info.varOf.get(headerStmt.variables[0])
            ? info.varOf.get(headerStmt.variables[0]).scope.id : null;
          if(scopeId === null) return;

          var forbidden = new Set();
          headerStmt.variables.forEach(function(v){
            if(v.type === 'Identifier'){ var hb = info.varOf.get(v); if(hb) forbidden.add(hb); }
          });
          st.variables.forEach(function(v){
            if(v.type === 'Identifier'){ var b = info.varOf.get(v); if(b) forbidden.add(b); }
          });
          var headerNames = new Set();
          headerStmt.variables.forEach(function(v){ if(v.type === 'Identifier') headerNames.add(v.name); });

          // 分类：inline 对（合格 + 纯形态 + 不引用禁止集合 + 不重名）；
          // 其余合格变量【同候选占位上提】（v1 full 模式的原子单位——inline 与占位必须
          // 同生共死： canonical 的 fwdNil 归一只对整体形态可证，拆成两步会落入不可证
          // 中间态；§6.4 的 A-then-B 发现针对的是【纯占位语句】走 placeholderHoist 的序列）。
          // 不合格变量（嵌套作用域/多声明/重名）保留在原 local。
          var inlinePairs = [], placeholderNames = [], assignPart = [], localRemain = [];
          var alignCount = headerStmt.variables.length;
          for(var vi=0; vi<st.variables.length; vi++){
            var v = st.variables[vi], ie = st.init[vi];
            var name = v.name;
            var b = v.type === 'Identifier' ? info.varOf.get(v) : null;
            var eligible = !!(b && b.scope.id === scopeId && b.decls.length === 1);
            var valText = src.slice(ie.range[0], ie.range[1]);
            if(!eligible || headerNames.has(name)){
              localRemain.push({ name: name, val: valText });
            }else if(isInlineableExpr(ie) && !refsBinding(ie, info, forbidden)){
              inlinePairs.push({ name: name, val: valText });
            }else{
              placeholderNames.push(name);           // 捕获也允许（canonical fwdNil 把关）
              assignPart.push({ name: name, val: valText });
            }
          }
          if(!inlinePairs.length) return;

          // 头部注入：inline 值对插到尾部纯字面量值对之前（或追加对齐区末尾）；
          // 占位名字追加到名单最末（无对应值，自动 nil）
          function isSymbolTailLiteral(n){ return n && (n.type === 'StringLiteral' || n.type === 'TableConstructorExpression'); }
          var tailLit = 0;
          while(tailLit < alignCount && isSymbolTailLiteral(headerStmt.init[alignCount-1-tailLit])) tailLit++;
          var edits = [];
          if(tailLit > 0){
            // 插到尾部纯字面量值对之前（前缀逗号）
            if(inlinePairs.length){
              edits.push({ start: headerStmt.variables[alignCount-tailLit].range[0],
                           end: headerStmt.variables[alignCount-tailLit].range[0],
                           text: inlinePairs.map(function(p){return p.name;}).join(',') + ',' });
              edits.push({ start: headerStmt.init[alignCount-tailLit].range[0],
                           end: headerStmt.init[alignCount-tailLit].range[0],
                           text: inlinePairs.map(function(p){return p.val;}).join(',') + ',' });
            }
            if(placeholderNames.length)
              edits.push({ start: headerStmt.variables[alignCount-1].range[1],
                           end: headerStmt.variables[alignCount-1].range[1],
                           text: ',' + placeholderNames.join(',') });
          }else{
            var allNames = inlinePairs.map(function(p){return p.name;}).concat(placeholderNames);
            edits.push({ start: headerStmt.variables[alignCount-1].range[1],
                         end: headerStmt.variables[alignCount-1].range[1],
                         text: ',' + allNames.join(',') });
            if(inlinePairs.length)
              edits.push({ start: headerStmt.init[alignCount-1].range[1],
                           end: headerStmt.init[alignCount-1].range[1],
                           text: ',' + inlinePairs.map(function(p){return p.val;}).join(',') });
          }
          // 原语句：全部并入则删除；否则收缩为「剩余 local + 占位降级赋值」
          var pieces = [];
          if(localRemain.length)
            pieces.push('local ' + localRemain.map(function(p){return p.name;}).join(',')
                        + '=' + localRemain.map(function(p){return p.val;}).join(','));
          if(assignPart.length)
            pieces.push(assignPart.map(function(p){return p.name;}).join(',')
                        + '=' + assignPart.map(function(p){return p.val;}).join(','));
          var newText = pieces.join(' ');
          var oldText = src.slice(st.range[0], st.range[1]);
          if(newText !== oldText)
            edits.push({ start: st.range[0], end: st.range[1], text: newText });
          out.push({ id:'inlineValue@' + bi, _edits: edits });
        });
        return out;
      },
      cost: function(ir, cand){ return { delta: preview(ir, cand._edits, deps), confidence: 'exact' }; },
      extract: function(ir, cand){ return { edits: cand._edits, form: {}, residue: {} }; },
      inject: oneWayInject   // 逆方向由 fwdNil/placeholder 族在对应形态上发现（单一事实来源）
    };
  }

  /* ---------- hoist.fwdNil：前向 nil 下沉（上提的逆；foldFwdNilInline 移植） ---------- */

  // substHeaderConsts(rhsNode, bindingSet, info, ir, src) -> {text, changed}|null：
  // 下沉守卫的常量代值：RHS 引用同 local 变量时，若这些引用全是别名条目（string/member/
  // prefix 字面量、global/chain 链、literal 字）——编译期常量——按名代值后下沉语义精确
  // （实证 luacheck warnings 表 [h] 键阻断 f={warnings} 下沉；与 norm.tableFields 同口径）。
  function substHeaderConsts(rhsNode, bindingSet, info, ir, src){
    var repls = [], bad = false;
    walkAst(rhsNode, function(x){
      if(bad) return false;
      if(x.type === 'Identifier' && x.range){
        var b = info.varOf.get(x);
        if(b && bindingSet.has(b)){
          var e = ir.aliases.entries.get(x.name);
          var subst = null;
          if(e){
            if(e.kind === 'string' || e.kind === 'member' || e.kind === 'prefix') subst = "'" + e.target + "'";
            else if(e.kind === 'global' || e.kind === 'chain' || e.kind === 'literal') subst = e.target;
          }
          if(subst === null){ bad = true; return false; }
          repls.push({ start: x.range[0], end: x.range[1], text: subst });
        }
      }
    });
    if(bad) return null;
    if(!repls.length) return { text: null, changed: false };
    repls.sort(function(a, b){ return a.start - b.start; });
    var out = '', cur = rhsNode.range[0];
    repls.forEach(function(r){ out += src.slice(cur, r.start) + r.text; cur = r.end; });
    out += src.slice(cur, rhsNode.range[1]);
    return { text: out, changed: true };
  }

  function createFwdNilLens(deps){
    return {
      name: 'hoist.fwdNil', kind: 'rewrite',
      requires: ['ssa'], provides: ['fwdnil'], consumes: [], conflicts: [],
      // match(ir)：每条带 nil 占位的顶层 LocalStatement 一个候选（多目标整体 + 单目标逐变量）
      match: function(ir){
        var src = ir.src, info = ir.info, out = [];
        var stmts = ir.ast.body;
        for(var i=0; i<stmts.length; i++){
          var st = stmts[i];
          if(st.type !== 'LocalStatement' || !st.variables || !st.init || !st.init.length) continue;
          var bindingSet = new Set();
          for(var vi=0; vi<st.variables.length; vi++){
            var v0 = st.variables[vi];
            if(v0.type === 'Identifier'){ var b0 = info.varOf.get(v0); if(b0) bindingSet.add(b0); }
          }
          var localEnd = st.range[1];
          var valueOf = new Map();   // 变量下标 -> {rhsText, asg}
          var consumed = new Set();

          // ① 多目标赋值整体下沉：全部目标都是本 local 的 nil 占位才并入
          for(var j=i+1; j<stmts.length; j++){
            var s2 = stmts[j];
            if(s2.type !== 'AssignmentStatement' || !s2.variables || s2.variables.length < 2 || !s2.init) continue;
            if(s2.init.length !== s2.variables.length) continue;   // 多/少值截断保守跳过
            if(consumed.has(s2)) continue;
            var okMulti = true, touched = [], seenVi = new Set();
            for(var ti=0; ti<s2.variables.length && okMulti; ti++){
              var tv = s2.variables[ti];
              if(tv.type !== 'Identifier'){ okMulti = false; break; }
              var tb = info.varOf.get(tv);
              if(!tb || !bindingSet.has(tb) || tb.decls.length !== 1){ okMulti = false; break; }
              var tvi = -1;
              for(var vi2=0; vi2<st.variables.length; vi2++)
                if(info.varOf.get(st.variables[vi2]) === tb){ tvi = vi2; break; }
              if(tvi < 0 || seenVi.has(tvi)){ okMulti = false; break; }
              var tie = st.init[tvi] || null;
              if(tie && tie.type !== 'NilLiteral'){ okMulti = false; break; }        // 非 nil 占位
              if(readBetween(tb, localEnd, s2.range[0])){ okMulti = false; break; }  // 赋值前被读/写
              // RHS 引用同 local 变量（不打架由这条涌现）：常量别名按名代值后放行
              if(refsBinding(s2.init[ti], info, bindingSet)){
                var subM = substHeaderConsts(s2.init[ti], bindingSet, info, ir, src);
                if(subM === null){ okMulti = false; break; }
                seenVi.add(tvi);
                touched.push({ vi: tvi, rhs: s2.init[ti], substText: subM.changed ? subM.text : null });
              }else{
                seenVi.add(tvi);
                touched.push({ vi: tvi, rhs: s2.init[ti], substText: null });
              }
            }
            if(!okMulti || !touched.length) continue;
            touched.forEach(function(t){
              valueOf.set(t.vi, { rhsText: t.substText || src.slice(t.rhs.range[0], t.rhs.range[1]), asg: s2 });
            });
            consumed.add(s2);
          }

          // ② 单目标赋值下沉（逐变量找首个单目标简单赋值）
          for(var vi3=0; vi3<st.variables.length; vi3++){
            if(valueOf.has(vi3)) continue;
            var vn = st.variables[vi3];
            if(vn.type !== 'Identifier') continue;
            var ie2 = (st.init && st.init[vi3]) || null;
            if(ie2 && ie2.type !== 'NilLiteral') continue;
            var b = info.varOf.get(vn);
            if(!b || b.decls.length !== 1) continue;
            var asgIdx = -1;
            for(var j2=i+1; j2<stmts.length; j2++){
              var s3 = stmts[j2];
              if(s3.type === 'AssignmentStatement' && s3.variables && s3.variables.length === 1
                 && s3.init && s3.init.length === 1){
                var tv2 = s3.variables[0];
                if(tv2.type === 'Identifier' && info.varOf.get(tv2) === b){ asgIdx = j2; break; }
              }
              if(readBetween(b, localEnd, s3.range[1])) break;
            }
            if(asgIdx < 0) continue;
            var asg = stmts[asgIdx];
            if(consumed.has(asg)) continue;
            var rhs = asg.init[0];
            var rhsText = src.slice(rhs.range[0], rhs.range[1]);
            if(refsBinding(rhs, info, bindingSet)){
              var subS = substHeaderConsts(rhs, bindingSet, info, ir, src);
              if(subS === null) continue;
              if(subS.changed) rhsText = subS.text;
            }
            valueOf.set(vi3, { rhsText: rhsText, asg: asg });
            consumed.add(asg);
          }
          if(!valueOf.size) continue;

          // 按位填入 init 末尾的 nil 占位：必须从 st.init.length 起连续（防错位赋值）
          var merged = [];
          for(var vi4=st.init.length; vi4<st.variables.length; vi4++){
            if(!valueOf.has(vi4)) break;
            merged.push(valueOf.get(vi4));
          }
          if(!merged.length) continue;
          var edits = [];
          var lastInit = st.init[st.init.length-1];
          // 粘连守卫：追加值的尾字符与插入点后的下一字符可能并 token
          //（`...end`+`P.Scale` → `endP` 并成名字，丢失关键字），须补空格。
          var appendText = ',' + merged.map(function(m){ return m.rhsText; }).join(',');
          var nextCh = (lastInit.range[1] < src.length) ? src[lastInit.range[1]] : undefined;
          if(ir._base._needsSepAfter(appendText[appendText.length-1], nextCh)) appendText += ' ';
          edits.push({ start: lastInit.range[1], end: lastInit.range[1], text: appendText });
          var deleted = new Set();
          merged.forEach(function(m){
            if(deleted.has(m.asg)) return;
            deleted.add(m.asg);
            edits.push({ start: m.asg.range[0], end: m.asg.range[1], text: '' });
          });
          out.push({ id:'fwdNil@' + st.range[0], _edits: edits });
        }
        return out;
      },
      cost: function(ir, cand){ return { delta: preview(ir, cand._edits, deps), confidence: 'exact' }; },
      extract: function(ir, cand){ return { edits: cand._edits, form: {}, residue: {} }; },
      inject: oneWayInject   // 逆方向 = placeholderHoist（互逆对单侧实现，§6.3）
    };
  }

  /* ---------- hoist.localsMerge：相邻 local 合并（foldLocals 移植） ---------- */

  function createLocalsMergeLens(deps){
    function isMergeableLocal(st){
      if(st.type !== 'LocalStatement' || !st.variables || !st.variables.length) return false;
      for(var i=0;i<st.variables.length;i++) if(st.variables[i].type !== 'Identifier') return false;
      return true;
    }
    // tableFields 模式保护：`local M={}` 紧邻后跟 M.X=v 且 v 引用当前组内 binding 时，把它
    // 并进本组会让 tableFields 的兄弟闸（同句 init 先于绑定求值，函数字段捕获落空）
    // 永久拒掉更大的字段合并收益；留作后续组的独立成员后，被引用名字已在早前组绑定，
    // 字段合并安全发生（实证 sqlite/utils 的 M.if_nil 族 +7、luacheck warnings 表族）。
    // 引用判定按【binding】（varOf 解析）：函数形参/内层遮蔽与组内名字同名不算引用——
    // 名字级误判会把平凡合并逼进降级形态（实证 sqlite/strfun：wrap 形参 b 与外槽 b
    // 同名，平凡合并 −4 被降级形态 −2 顶替，+1）。
    function tableFieldsHazard(stmts, st, declaredBinds, info){
      if(st.variables.length !== 1 || !st.init || st.init.length !== 1) return false;
      var init = st.init[0];
      if(!init || init.type !== 'TableConstructorExpression' || (init.fields && init.fields.length)) return false;
      var idx = stmts.indexOf(st);
      if(idx < 0) return false;
      var mv = st.variables[0];
      if(!mv || mv.type !== 'Identifier') return false;
      for(var k = idx + 1; k < stmts.length; k++){
        var as = stmts[k];
        if(as.type !== 'AssignmentStatement' || !as.variables || as.variables.length !== 1
           || !as.init || as.init.length !== 1) break;
        var tgt = as.variables[0];
        if(!(tgt.type === 'MemberExpression' && tgt.indexer === '.' && tgt.base
             && tgt.base.type === 'Identifier' && tgt.base.name === mv.name)) break;
        if(refsBinding(as.init[0], info, declaredBinds)) return true;
      }
      return false;
    }
    function hasCallExpr(node){
      var found = false;
      walkAst([node], function(n){
        if(found) return false;
        if(n.type === 'CallExpression' || n.type === 'StringCallExpression'
           || n.type === 'TableCallExpression'){ found = true; return false; }
      });
      return found;
    }
    // tryDemoteMerge(group, bi, src, info) -> cand|null：合并+降级候选（见 match 内注释）。
    // 安全条件：组内全对齐（免多值截断风险）；无重名；每个被降级 init 与其原始顺序
    // 之后的保留 init 不得双双含调用（降级把被降级 init 移到全部保留 init 之后求值）。
    function tryDemoteMerge(group, bi, src, info){
      if(group.length < 2) return null;
      for(var gi=0; gi<group.length; gi++){
        var st = group[gi];
        if((st.init || []).length !== st.variables.length) return null;
      }
      var declared = new Set(), declaredBinds = new Set(), nVars = 0;
      group.forEach(function(st){
        st.variables.forEach(function(v){
          declared.add(v.name); nVars++;
          var b0 = info.varOf.get(v);
          if(b0) declaredBinds.add(b0);
        });
      });
      if(declared.size !== nVars) return null;   // 重名（遮蔽）拒判
      var slots = [];   // {name, initText, initNode, bind, demote, hasCall}
      group.forEach(function(st){
        for(var vi=0; vi<st.variables.length; vi++){
          var v = st.variables[vi], ie = st.init[vi];
          slots.push({ name: src.slice(v.range[0], v.range[1]),
                       initText: src.slice(ie.range[0], ie.range[1]), initNode: ie,
                       bind: info.varOf.get(v),
                       demote: refsBinding(ie, info, declaredBinds),
                       hasCall: hasCallExpr(ie) });
        }
      });
      var anyDemote = slots.some(function(s){ return s.demote; });
      if(!anyDemote) return null;
      for(var p=0; p<slots.length; p++){
        if(!slots[p].demote || !slots[p].hasCall) continue;
        for(var q=p+1; q<slots.length; q++)
          if(!slots[q].demote && slots[q].hasCall) return null;
      }
      var keepVars = [], keepInits = [], demoteVars = [], demoteAssigns = [];
      slots.forEach(function(s){
        if(s.demote){ demoteVars.push(s.name); demoteAssigns.push(s); }
        else{ keepVars.push(s.name); keepInits.push(s.initText); }
      });
      // 降级赋值形态：任一降级 init 引用其他降级变量时必须逐条独立赋值（RHS 先求值
      // 语义）；无交叉引用则并为一条多目标赋值（与 v1 mixed 路径同形态、更短）。
      var demoteBinds = new Set();
      demoteAssigns.forEach(function(s){ if(s.bind) demoteBinds.add(s.bind); });
      var crossRef = demoteAssigns.some(function(s){ return refsBinding(s.initNode, info, demoteBinds); });
      var assignText = crossRef
        ? demoteAssigns.map(function(s){ return s.name + '=' + s.initText; }).join(' ')
        : (demoteVars.length ? [demoteVars.join(',') + '=' + demoteAssigns.map(function(s){ return s.initText; }).join(',')] : []).join('');
      var merged = 'local ' + keepVars.concat(demoteVars).join(',')
                 + (keepInits.length ? '=' + keepInits.join(',') : '');
      var text = merged + (assignText ? ' ' + assignText : '');
      return { id:'localsMergeDemote@' + bi + ':' + group[0].range[0],
        _edits: [{ start: group[0].range[0], end: group[group.length-1].range[1], text: text }] };
    }
    return {
      name: 'hoist.localsMerge', kind: 'rewrite',
      requires: ['fwdnil'], provides: [], consumes: [], conflicts: [],
      // match(ir)：每个可合并 run（≥2 条相邻 local）一个候选；v1 安全前提逐字移植
      match: function(ir){
        var src = ir.src, out = [];
        blockBodies(ir.ast).forEach(function(stmts, bi){
          // 顶层块跳过别名头保护位（v1 protectN 口径：dropLeading 条头部语句不动）
          var start = (bi === 0) ? 0 : 0;
          var i = start;
          while(i < stmts.length){
            if(!isMergeableLocal(stmts[i])){ i++; continue; }
            var run = [stmts[i]], j = i+1;
            while(j < stmts.length && isMergeableLocal(stmts[j])){ run.push(stmts[j]); j++; }
            i = j;
            if(run.length < 2) continue;
            // 分组：init 引用组内 binding / 重名 / 前条多值截断 → 断组
            var groups = [], groupStartIdx = [], demoteCands = [], cur = [run[0]];
            var declared = new Set(run[0].variables.map(function(v){ return v.name; }));
            var declaredBinds = new Set();
            run[0].variables.forEach(function(v){
              var b0 = ir.info.varOf.get(v);
              if(b0) declaredBinds.add(b0);
            });
            var curStart = 0;
            for(var r=1; r<run.length; r++){
              var st = run[r];
              var names = st.variables.map(function(v){ return v.name; });
              var unsafe = refsBinding(st.init || [], ir.info, declaredBinds);
              var nameClash = false;
              for(var n2=0; n2<names.length; n2++) if(declared.has(names[n2])){ unsafe = true; nameClash = true; }
              if(!unsafe){
                var prev = cur[cur.length-1];
                if((prev.init || []).length !== prev.variables.length) unsafe = true;
              }
              // tableFields 模式保护断组（非重名、非引用——见 tableFieldsHazard 注释）：
              // 该断组不走降级合并（降级会把 M={} 变占位+赋值，字段合并同样落空）。
              var hazardBreak = false;
              if(!unsafe && tableFieldsHazard(stmts, st, declaredBinds, ir.info)){ unsafe = true; hazardBreak = true; }
              if(unsafe){
                // 仅「init 引用并集内 binding」导致的断组（非重名）：尝试合并+降级候选——
                // v1 声明上提 mixed 路径向相邻合并的一般化：引用并集内名字的槽位移到
                // 变量表尾部作 nil 占位、其 init 逐条降级为合并声明后的赋值句。合并省
                // 下的 `local ` 覆盖占位成本还有余（实证：勇往直前#10 的
                // `local m=_Data` 与别名头合并，v1 产物即占位+赋值形态）。
                if(!nameClash && !hazardBreak){
                  var dc = tryDemoteMerge(cur.concat([st]), bi, src, ir.info);
                  if(dc) demoteCands.push({ cand: dc, breakerIdx: r });
                }
                if(cur.length >= 2){ groups.push(cur); groupStartIdx.push(curStart); }
                cur = [st]; declared = new Set(names); curStart = r;
                declaredBinds = new Set();
                st.variables.forEach(function(v){
                  var b1 = ir.info.varOf.get(v);
                  if(b1) declaredBinds.add(b1);
                });
              }else{
                cur.push(st); names.forEach(function(x){ declared.add(x); });
                st.variables.forEach(function(v){
                  var b2 = ir.info.varOf.get(v);
                  if(b2) declaredBinds.add(b2);
                });
              }
            }
            if(cur.length >= 2){ groups.push(cur); groupStartIdx.push(curStart); }
            // 降级候选与【断组语句自家的平凡合并】互斥：demote 把断组语句消费进前组的
            // 边际收益仅 ~4（`local `−占位符），若该语句能与后续语句合成 ≥2 的平凡组
            // （省 6·(k−1)，严格更优），贪心选中 demote 会永久堵死平凡合并路径
            // （实证 ldoc/lang.lua 头部：quit 被降级进 require 合并句，quit+skipws+Lang
            // 三向平凡合并消失，净亏 6）。此时抑制 demote 候选——平凡组照常合并。
            var plainStarts = {};
            groupStartIdx.forEach(function(ix){ plainStarts[ix] = true; });
            groups.forEach(function(group, gi){
              var allNames = [], allExprs = [];
              group.forEach(function(st2){
                st2.variables.forEach(function(v){ allNames.push(src.slice(v.range[0], v.range[1])); });
                (st2.init || []).forEach(function(e){ allExprs.push(src.slice(e.range[0], e.range[1])); });
              });
              var merged = 'local ' + allNames.join(',') + (allExprs.length ? '=' + allExprs.join(',') : '');
              out.push({ id:'localsMerge@' + bi + ':' + gi,
                _edits: [{ start: group[0].range[0], end: group[group.length-1].range[1], text: merged }] });
            });
            demoteCands.forEach(function(d){ if(!plainStarts[d.breakerIdx]) out.push(d.cand); });
          }
        });
        return out;
      },
      cost: function(ir, cand){ return { delta: preview(ir, cand._edits, deps), confidence: 'exact' }; },
      extract: function(ir, cand){ return { edits: cand._edits, form: {}, residue: {} }; },
      inject: oneWayInject   // 逆 = 拆分（splitMultiAssign/声明拆分族，按需由 match 发现）
    };
  }

  /* ---------- hoist.funcMerge：local function 并入前置 local（foldLocalFunc 移植） ---------- */

  function createFuncMergeLens(deps){
    return {
      name: 'hoist.funcMerge', kind: 'rewrite',
      requires: ['ssa'], provides: [], consumes: [], conflicts: [],
      match: function(ir){
        var src = ir.src, varOf = ir.info.varOf, out = [];
        blockBodies(ir.ast).forEach(function(stmts, bi){
          for(var si=1; si<stmts.length; si++){
            var st = stmts[si], prev = stmts[si-1];
            var fn = null;
            if(st.type === 'FunctionDeclaration' && st.isLocal && st.identifier
               && st.identifier.type === 'Identifier' && st.range && st.identifier.range){
              var full = src.slice(st.range[0], st.range[1]);
              var m = /^local\s+function\s+([A-Za-z_][A-Za-z0-9_]*)/.exec(full);
              if(m){
                fn = { name: m[1], value: 'function' + full.slice(m[0].length), body: st.body,
                       declStart: st.range[0], declEnd: st.range[0]+m[0].length,
                       replaceWith: m[1] + '=function' };
              }
            }else if(st.type === 'LocalStatement' && st.variables && st.variables.length === 1
                     && st.init && st.init.length === 1 && st.init[0].type === 'FunctionDeclaration'
                     && !st.init[0].isLocal && st.range && st.variables[0].range && st.init[0].range){
              fn = { name: st.variables[0].name,
                     value: src.slice(st.init[0].range[0], st.init[0].range[1]),
                     body: st.init[0].body,
                     declStart: st.range[0], declEnd: st.init[0].range[0],
                     replaceWith: st.variables[0].name + '=' };
            }
            if(!fn) continue;
            if(!(prev.type === 'LocalStatement' && prev.variables && prev.init
                 && prev.variables.length === prev.init.length && prev.variables.length > 0)) continue;
            var lastInit = prev.init[prev.init.length-1];
            if(lastInit && (lastInit.type === 'CallExpression' || lastInit.type === 'StringCallExpression'
                            || lastInit.type === 'TableCallExpression' || lastInit.type === 'VarargLiteral')) continue;
            // 健全性：函数体不得引用 prev 声明的变量（否则闭包读到外层同名 nil）
            var prevBindings = new Set(), refsPrev = false;
            prev.variables.forEach(function(pvn){
              if(pvn.type === 'Identifier' && varOf.has(pvn)) prevBindings.add(varOf.get(pvn));
            });
            if(prevBindings.size){
              walkAst(fn.body, function(nd){
                if(refsPrev) return false;
                if(nd.type === 'Identifier'){
                  var b = varOf.get(nd);
                  if(b && prevBindings.has(b)){ refsPrev = true; return false; }
                }
              });
            }
            var lastVar = prev.variables[prev.variables.length-1];
            var edits;
            if(refsPrev){
              // 退化形态：local a=1 local function f()BODY → local a,f=1 f=function()BODY
              edits = [
                { start: lastVar.range[1], end: lastVar.range[1], text: ',' + fn.name },
                { start: fn.declStart, end: fn.declEnd, text: fn.replaceWith }
              ];
            }else{
              edits = [
                { start: lastVar.range[1], end: lastVar.range[1], text: ',' + fn.name },
                { start: lastInit.range[1], end: lastInit.range[1], text: ',' + fn.value },
                { start: st.range[0], end: st.range[1], text: '' }
              ];
            }
            out.push({ id:'funcMerge@' + bi + ':' + si, _edits: edits });
          }
        });
        return out;
      },
      cost: function(ir, cand){ return { delta: preview(ir, cand._edits, deps), confidence: 'exact' }; },
      extract: function(ir, cand){ return { edits: cand._edits, form: {}, residue: {} }; },
      inject: oneWayInject   // 逆 = 函数声明拆出（localsMerge 逆族）
    };
  }

  /* ---------- hoist.varReuse：SSA 验证的变量复用（foldReuse 移植） ----------
   * dead/live 同作用域、均单声明未捕获、均不在循环体、dead 最后使用早于 live 声明 →
   * live 改名为 dead 名并删 `local `。canonical SSA 版本化（赋值=新逻辑变量）兜底等价。 */
  function createVarReuseLens(deps){
    return {
      name: 'hoist.varReuse', kind: 'rewrite',
      requires: ['ssa'], provides: [], consumes: [], conflicts: [],
      match: function(ir){
        var src = ir.src, info = ir.info, out = [];
        var loops = loopRangesOf(ir.ast);
        // 别名头保护界（v1 protectEnd 口径：别名变量的声明名末尾之后才可复用）
        var protectEnd = 0;
        if(ir.aliases.dropLeading > 0){
          for(var pi=0; pi<ir.aliases.dropLeading && pi<ir.ast.body.length; pi++){
            var pst = ir.ast.body[pi];
            if(pst && pst.range) protectEnd = Math.max(protectEnd, pst.range[1]);
          }
        }
        // 单变量 local 声明定位
        var stmtOfDecl = new Map();
        walkAst(ir.ast, function(n){
          if(n.type === 'LocalStatement'){
            n.variables.forEach(function(v){
              stmtOfDecl.set(v, { stmt: n, singleVar: n.variables.length === 1 });
            });
          }
        });
        function lastUse(b){ var p = b.decls[0].range[1]; b.uses.forEach(function(u){ if(u.range[1] > p) p = u.range[1]; }); return p; }

        var byScope = {};
        info.bindings.forEach(function(b){
          if(b.captured || b.decls.length !== 1) return;
          (byScope[b.scope.id] = byScope[b.scope.id] || []).push(b);
        });
        Object.keys(byScope).forEach(function(sid){
          var arr = byScope[sid].slice().sort(function(a,b){ return a.decls[0].range[0] - b.decls[0].range[0]; });
          var pool = [];
          arr.forEach(function(b){
            var d = b.decls[0].range[0];
            if(d < protectEnd) return;
            var meta = stmtOfDecl.get(b.decls[0]);
            // 循环回边/形参目标不再预筛排除（v1 同：foldReuse 无 loop 检查，
            // 整批评判交给 canonical）——SSA 等价 verify 是逐候选的兜底闸门；
            // 语义上"循环内复用循环变量"（for i do … local e=… → i=…）恰是 v1 的
            // 招牌节省形态，预筛会误杀。
            var pick = -1;
            for(var i=0;i<pool.length;i++){ if(pool[i].freeAt < d){ pick = i; break; } }
            if(pick >= 0 && meta && meta.singleVar){
              var reuseName = pool[pick].name;
              // 别名条目名不可作复用目标：改名撞上 AliasEnv 键会腐蚀终审还原证据
              if(ir.aliases.entries.has(reuseName)){ pool.push({ name: b.name, freeAt: lastUse(b) }); return; }
              // 同名复用（三条 local A=… 活跃区间不重叠）：无改名收益，但删 `local `
              // 仍省 6 字——v1 foldReuse 同形态；canonical SSA 把赋值建成同 binding 新版本。
              if(reuseName === b.name){
                out.push({ id:'varReuse:' + b.name + '@' + d,
                  _edits: [{ start: meta.stmt.range[0], end: meta.stmt.range[0]+6, text: '' }] });
                pool[pick].freeAt = lastUse(b);
                return;
              }
              var edits = [];
              b.decls.concat(b.uses).forEach(function(nd){
                edits.push({ start: nd.range[0], end: nd.range[1], text: reuseName });
              });
              // 删除 "local "（降级为赋值）；文本断言在 cost 预演+verify 双重兜底
              edits.push({ start: meta.stmt.range[0], end: meta.stmt.range[0]+6, text: '' });
              out.push({ id:'varReuse:' + b.name + '@' + d, _edits: edits });
              pool[pick].freeAt = lastUse(b);
            }else{
              pool.push({ name: b.name, freeAt: lastUse(b) });
            }
          });
        });
        return out;
      },
      cost: function(ir, cand){ return { delta: preview(ir, cand._edits, deps), confidence: 'exact' }; },
      extract: function(ir, cand){ return { edits: cand._edits, form: {}, residue: {} }; },
      inject: oneWayInject   // 逆 = 名字拆分（rename 族职责）
    };
  }

  /* ---------- 工厂与 part 注册 ---------- */

  // createHoistLenses(deps) -> [Lens]：声明移动族（fwdNil 先于合并/上提，见文件头注释）
  function createHoistLenses(deps){
    return [
      createFwdNilLens(deps),
      createLocalsMergeLens(deps),
      createFuncMergeLens(deps),
      createVarReuseLens(deps),
      createInlineValueToHeaderLens(deps),
      createPlaceholderHoistLens(deps)
    ];
  }

  var api = { createHoistLenses: createHoistLenses };
  (root.__LuaMin2Parts = root.__LuaMin2Parts || []).push({
    name: 'lenses/hoist',
    install: function(C){ for(var k in api) C[k] = api[k]; }
  });
  root.__LuaMin2Modules = root.__LuaMin2Modules || {};
  root.__LuaMin2Modules['lenses/hoist'] = api;
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
