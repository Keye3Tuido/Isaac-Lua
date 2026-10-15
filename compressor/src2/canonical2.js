/* ===================================================================
 * LuaMin v2 part: canonical2 — 终审等价校验器（M2 初版）
 * 当前全部归一规则委托 shared/canonical.js（triple-gate：luaparse 双解析 +
 * fengari 真·Lua 校验 + canonical 文本相等）。结构上把"终审"独立成层，
 * 后续里程碑把归一规则按透镜下沉（canonical2 只剩残留全局归一，见计划 §7）。
 *
 * aliasMap 由 IR 的 AliasEnv 重建（不再是旁车手工搬运）：
 *   byName            <- entries kind='global'      { target: name }
 *   memberByLocal     <- entries kind='member'      { name: target }
 *   transparentAliases<- aliases.transparent
 *   dropLeading       <- aliases.dropLeading
 * =================================================================== */
(function(root){
  'use strict';

  var baseMod = null;
  if(typeof module !== 'undefined' && module.exports){
    baseMod = require('./base.js');
  }else if(root.__LuaMin2Modules){
    baseMod = root.__LuaMin2Modules['base'];
  }

  function getBase(deps){
    deps = deps || {};
    if(deps.base) return deps.base;
    if(!baseMod) throw new Error('canonical2.js: 需要 src2/base.js 已加载');
    return baseMod.create(deps);
  }

  // buildAliasMap(ir) -> aliasMap|null：从 AliasEnv 重建 v1 canonical 的还原映射；
  // 无任何别名证据时返回 null（canonical 单侧严格比对）。
  // kind 映射：global→byName、member→memberByLocal、string→stringAliasByLocal、
  // chain→chainAliasByLocal、prefix→prefixFoldByLocal(+factorLocals)、
  // literal→不入图（canonical detectLit 自动归一 local A=true）。
  // buildAliasMap(ir, pred) -> aliasMap|null：从 AliasEnv 重建 v1 canonical 的还原映射。
  // pred(entry, name)：可选过滤器——终审/等价判定按【引入者】区分：
  //   透镜引入（introducedBy!=='source'）= 产物侧还原；源内登记（'source'）= 原文侧
  //   差量还原（仅当输出侧已不含该别名）。无任何条目时返回 null（单侧严格比对）。
  function buildAliasMap(ir, pred){
    var env = ir.aliases;
    var byName = {}, memberByLocal = {}, stringAlias = {}, chainAlias = {}, prefixFold = {};
    var factorLocals = [], has = false;
    env.entries.forEach(function(entry, name){
      if(pred && !pred(entry, name)) return;
      has = true;
      if(entry.kind === 'global') byName[entry.target] = name;
      else if(entry.kind === 'member') memberByLocal[name] = entry.target;
      else if(entry.kind === 'string') stringAlias[name] = entry.target;
      else if(entry.kind === 'chain') chainAlias[name] = entry.target;
      else if(entry.kind === 'prefix'){ prefixFold[name] = entry.target; factorLocals.push(name); }
      // literal：detectLit 自归一，无需入图
    });
    var transparent = env.transparent || {};
    for(var t in transparent) if(Object.prototype.hasOwnProperty.call(transparent, t)){ has = true; break; }
    if(!has) return null;
    return {
      byName: byName,
      memberByLocal: memberByLocal,
      factorLocals: factorLocals,
      transparentAliases: transparent,
      prefixFoldByLocal: prefixFold,
      stringAliasByLocal: stringAlias,
      chainAliasByLocal: chainAlias,
      dropLeading: env.dropLeading || 0
    };
  }

  // luaValidateOf(deps) -> fn(src)->null|err：fengari 真·Lua 5.3 语法校验（无 fengari 则退化为放行）
  function luaValidateOf(deps){
    var fengari = deps && deps.fengari;
    if(!fengari) return function(){ return null; };
    var lua=fengari.lua, lauxlib=fengari.lauxlib, lualib=fengari.lualib, to_luastring=fengari.to_luastring;
    return function(code){
      var L=lauxlib.luaL_newstate();
      lualib.luaL_openlibs(L);
      var status=lauxlib.luaL_loadstring(L, to_luastring(code));
      if(status===lua.LUA_OK) return null;
      var err=lua.lua_tojsstring(L,-1);
      lua.lua_pop(L,1);
      return err||'未知语法错误';
    };
  }

  /* ---- 单用邻接代入归一（v2 私有规则层；v1 canonical 无此归一，规则按透镜下沉 §3）----
   * 形态（三式，定义句与读点语句在同一块语句列内【相邻】、定义在前）：
   *   A. local B=<rhs> <紧邻次语句含 B 的唯一读点>     → 读点代入 (rhs)、删声明句
   *   B. B 为某 local 的 nil 填充槽 + 同块单目标赋值 B=<rhs> <紧邻次语句含唯一读点>
   *      → 读点代入 (rhs)、删赋值句、删声明槽位
   *   B2. local B=<rhs0>（v0 有读）+ 同函数单目标赋值 B=<rhs1> <紧邻次语句含 v1 唯一读点>
   *      → v1 读点代入 (rhs1)、仅删赋值句（声明槽与 v0 读点保留；v0 单读由下轮 A 式接续）
   * 健全性（全部满足才动，漏判安全、误判危险）：
   *   1. B 单声明、闭包未捕获、非 AliasEnv 条目（条目有自身还原机制）；
   *   2. A 式 SSA 单版本唯一读；B 式 SSA 两版本、v0 零读、v1 唯一读；
   *      B2 式 SSA 两版本、v1 唯一读（v0 读点不动，版本归属保证其只见 v0 值）；
   *   3. 定义句与读点语句相邻（求值时机不变；之间无任何语句）；
   *   4. 读点不得穿过嵌套函数边界（闭包可零/多次执行）；读点落在循环体/分支体/
   *      循环条件/elseif 条件等多次求值区时仅允许无调用 RHS（求值次数不变）；
   *   5. RHS 含调用时：读点语句内、读点之前不得存在不含读点的调用，含读点的调用
   *      其 base 也不得含调用（求值相对顺序不变）。
   * 不动点迭代（代入可链式暴露新单用），上界 30 轮防病理。
   */
  function normSingleUseAdjacent(src, deps){
    var cur = src;
    // 不动点迭代上界 5（实证：绝大多数单轮即尽；链式代入 >5 属病理，宁可漏判
    // 也不让归一层成为 parse 热点——编解码#0 采样此层曾占全部 parse 的 45%）。
    for(var iter=0; iter<5; iter++){
      var ir;
      try{ ir = irMod().buildIR(cur, deps); }catch(e){ return cur; }
      var edits = findSingleUseInline(ir);
      if(!edits) return cur;
      try{ cur = irMod().applyTextEdits(cur, edits); }catch(e){ return cur; }
    }
    return cur;
  }

  function findSingleUseInline(ir){
    var info = ir.info, src = ir.src;
    // 收集所有块语句列：stmt -> {list, idx}
    var locOf = new Map();
    function registerList(list){
      for(var i=0;i<list.length;i++) locOf.set(list[i], { list: list, idx: i });
    }
    // 全 AST 通用遍历：登记所有语句列（含调用参数/表达式内嵌函数体），并下潜所有子节点
    (function walkAll(n){
      if(!n || typeof n !== 'object') return;
      if(Array.isArray(n)){ for(var i=0;i<n.length;i++) walkAll(n[i]); return; }
      if(Array.isArray(n.body)){ registerList(n.body); walkAll(n.body); }
      if(n.clauses) for(var j=0;j<n.clauses.length;j++){
        if(n.clauses[j].condition) walkAll(n.clauses[j].condition);
        if(Array.isArray(n.clauses[j].body)){ registerList(n.clauses[j].body); walkAll(n.clauses[j].body); }
      }
      for(var k in n){
        if(k==='range'||k==='loc'||k==='body'||k==='clauses') continue;
        var c = n[k];
        if(c && typeof c === 'object') walkAll(c);
      }
    })(ir.ast.body);
    registerList(ir.ast.body);

    function hasCall(node){
      var found = false;
      (function w(n){
        if(found || !n || typeof n !== 'object') return;
        if(n.type==='CallExpression'||n.type==='StringCallExpression'||n.type==='TableCallExpression'){ found = true; return; }
        if(Array.isArray(n)){ for(var i=0;i<n.length;i++) w(n[i]); return; }
        for(var k in n){ if(k==='range'||k==='loc')continue; w(n[k]); }
      })(node);
      return found;
    }
    // 读点路径区域：穿过函数边界 / 多次求值区
    function locateRead(node, range, flags){
      if(!node || typeof node !== 'object') return null;
      if(Array.isArray(node)){
        for(var i=0;i<node.length;i++){ var r0 = locateRead(node[i], range, flags); if(r0) return r0; }
        return null;
      }
      if(node.type === 'Identifier' && node.range && node.range[0] === range[0] && node.range[1] === range[1]) return flags;
      function desc(child, add){
        return locateRead(child, range, { fn: flags.fn || !!(add && add.fn), multi: flags.multi || !!(add && add.multi) });
      }
      switch(node.type){
        case 'FunctionDeclaration': return desc(node.body, { fn:true });
        case 'IfStatement':
          for(var i=0;i<node.clauses.length;i++){
            var cl = node.clauses[i];
            if(cl.condition){ var rc = desc(cl.condition, i>0 ? { multi:true } : null); if(rc) return rc; }
            var rb = desc(cl.body, { multi:true }); if(rb) return rb;
          }
          return null;
        case 'WhileStatement':
          return desc(node.condition, { multi:true }) || desc(node.body, { multi:true });
        case 'RepeatStatement':
          return desc(node.body, { multi:true }) || desc(node.condition, { multi:true });
        case 'ForNumericStatement':
          return desc(node.start) || desc(node.end) || desc(node.step) || desc(node.body, { multi:true });
        case 'ForGenericStatement':
          return desc(node.iterators) || desc(node.body, { multi:true });
        case 'DoStatement':
          return desc(node.body, { multi:true });
        default:
          for(var k in node){
            if(k==='range'||k==='loc') continue;
            var c = node[k];
            if(c && typeof c === 'object'){ var r = desc(c); if(r) return r; }
          }
          return null;
      }
    }
    // 读点之前是否存在不含读点的调用（含读点调用的 base 也不得含调用）
    function callBeforeRead(stmt, range){
      var bad = false;
      (function w(n){
        if(bad || !n || typeof n !== 'object') return;
        if(Array.isArray(n)){ for(var i=0;i<n.length;i++) w(n[i]); return; }
        var isCall = n.type==='CallExpression'||n.type==='StringCallExpression'||n.type==='TableCallExpression';
        if(isCall && n.range){
          var contains = range[0] >= n.range[0] && range[1] <= n.range[1];
          if(!contains){ if(n.range[0] < range[0]) bad = true; }
          else if(n.base && !(range[0] >= n.base.range[0] && range[1] <= n.base.range[1]) && hasCall(n.base)) bad = true;
        }
        for(var k in n){ if(k==='range'||k==='loc')continue; w(n[k]); }
      })(stmt);
      return bad;
    }

    var bindings = info.bindings;
    for(var bi=0; bi<bindings.length; bi++){
      var b = bindings[bi];
      if(!b || b.decls.length !== 1 || b.captured) continue;
      if(ir.aliases.entries.has(b.name) || (ir.aliases.transparent || {})[b.name]) continue;
      var se = ir.ssa.byBinding.get(b);
      if(!se) continue;
      var declNode = b.decls[0];
      var declLoc = null;
      // 声明槽：所在 LocalStatement 与槽位（全 AST 通用遍历，含嵌套函数体）
      (function findDecl(n){
        if(declLoc || !n || typeof n !== 'object') return;
        if(Array.isArray(n)){ for(var i=0;i<n.length;i++) findDecl(n[i]); return; }
        if(n.type === 'LocalStatement' && n.variables){
          for(var vi=0; vi<n.variables.length; vi++)
            if(n.variables[vi] === declNode){ declLoc = { stmt: n, idx: vi }; return; }
        }
        for(var k in n){ if(k==='range'||k==='loc')continue; findDecl(n[k]); }
      })(ir.ast.body);
      if(!declLoc) continue;

      var defStmt = null, rhsNode = null, read = null, formB = false, formB2 = false;
      if(se.versions.length === 1){
        // A 式：声明带 init
        var di = declLoc.stmt.init ? declLoc.stmt.init.length : 0;
        if(declLoc.stmt.variables.length !== 1 || declLoc.idx !== 0 || di < 1) continue;
        rhsNode = declLoc.stmt.init[0];
        if(!rhsNode || !rhsNode.range) continue;
        if(b.uses.length !== 1) continue;
        read = b.uses[0];
        defStmt = declLoc.stmt;
      }else if(se.versions.length === 2){
        // B 式：nil 填充槽 + 同块单目标赋值。
        // B2 式（版本链）：带值声明 + 单赋值 + v1 唯一读——v0 读点保留不动（绑定未
        // 被闭包捕获，SSA 版本归属保证其只见 v0 值），仅代入 v1、删赋值句（声明槽
        // 保留）。v0 的单读由下一轮 A 式接续，链式收敛（与 norm.inlinePure 透镜的
        // 版本粒度放宽同一理论；实证 ldoc/lang.lua auto_assign/res 的跨侧对账：
        // 一侧代入一步、另一侧代入两步，绑定粒度判不出等价）。
        var dinit = declLoc.stmt.init ? declLoc.stmt.init.length : 0;
        if(declLoc.idx < dinit){
          if(se.versions[1].useSites.length !== 1) continue;
          formB2 = true;
        }else{
          if(se.versions[0].useSites.length !== 0) continue;
          if(se.versions[1].useSites.length !== 1) continue;
        }
        var readRange = se.versions[1].useSites[0];
        // 定义赋值句：全 AST 找本绑定的单目标赋值（声明与赋值可不同块；邻接检查
        // 只约束赋值句与读点语句同列相邻）。
        (function findAsg(n){
          if(defStmt || !n || typeof n !== 'object') return;
          if(Array.isArray(n)){ for(var i2=0;i2<n.length;i2++) findAsg(n[i2]); return; }
          if(n.type === 'AssignmentStatement' && n.variables && n.variables.length === 1
             && n.init && n.init.length === 1){
            var tv = n.variables[0];
            if(tv && tv.type === 'Identifier' && info.varOf.get(tv) === b){ defStmt = n; rhsNode = n.init[0]; return; }
          }
          for(var k2 in n){ if(k2==='range'||k2==='loc')continue; findAsg(n[k2]); }
        })(ir.ast.body);
        if(!defStmt || !rhsNode || !rhsNode.range) continue;
        // 读点节点（按 range 找回 AST 节点）
        read = null;
        (function findRead(n){
          if(read || !n || typeof n !== 'object') return;
          if(Array.isArray(n)){ for(var i2=0;i2<n.length;i2++) findRead(n[i2]); return; }
          if(n.type === 'Identifier' && n.range && n.range[0] === readRange[0] && n.range[1] === readRange[1]){ read = n; return; }
          for(var k2 in n){ if(k2==='range'||k2==='loc')continue; findRead(n[k2]); }
        })(ir.ast.body);
        if(!read) continue;
        formB = true;
      }else continue;

      if(!read || !read.range) continue;
      // 邻接：定义句与读点语句同列相邻（定义在前）
      var defLoc2 = locOf.get(defStmt);
      if(!defLoc2) continue;
      var rlist = defLoc2.list, ridx = defLoc2.idx + 1;
      if(ridx >= rlist.length) continue;
      var readStmt = rlist[ridx];
      if(!(read.range[0] >= readStmt.range[0] && read.range[1] <= readStmt.range[1])) continue;
      // 读点区域检查
      var zone = locateRead(readStmt, read.range, { fn:false, multi:false });
      if(!zone || zone.fn) continue;
      var rhsHasCall = hasCall(rhsNode);
      if(zone.multi && rhsHasCall) continue;
      if(rhsHasCall && callBeforeRead(readStmt, read.range)) continue;

      // 生成编辑：读点代入 + 删定义（A 式删声明句；B 式删赋值句 + nil 槽；B2 式仅删赋值句）
      var rhsText = src.slice(rhsNode.range[0], rhsNode.range[1]);
      var edits = [];
      edits.push({ start: read.range[0], end: read.range[1], text: '(' + rhsText + ')' });
      if(!formB){
        edits.push({ start: defStmt.range[0], end: defStmt.range[1], text: '' });
      }else{
        edits.push({ start: defStmt.range[0], end: defStmt.range[1], text: '' });
        if(!formB2){   // B2：声明槽与 v0 读点保留（仅 nil 填充槽才联动删除）
          var vv = declLoc.stmt.variables;
          if(vv.length === 1){
            edits.push({ start: declLoc.stmt.range[0], end: declLoc.stmt.range[1], text: '' });
          }else if(declLoc.idx > 0){
            edits.push({ start: vv[declLoc.idx-1].range[1], end: vv[declLoc.idx].range[1], text: '' });
          }else{
            edits.push({ start: vv[0].range[0], end: vv[1].range[0], text: '' });
          }
        }
      }
      return edits;
    }
    return null;
  }


  // 双侧等价判定。am*Override：调用方持有产物侧还原映射时（如 compress 报告的
  // aliasMap——占位赋值形态重 parse 会丢失别名证据）优先于 *Ir 重建（仍过 sameDecl 差量）。
  function equivalent(origSrc, newSrc, deps, origIr, newIr, flags, amAOverride, amBOverride, _depth){
    var base = getBase(deps);
    // 差量还原映射（v1 口径的透镜化表达）：别名在两侧的【声明 init 文本相同】
    // → 两侧文本俱在、canonical 各自保留，不还原；不同（或一侧缺席）→ 该侧还原。
    // 这同时覆盖：no-op 轮（同文本不还原）、透镜新别名（原文缺席→产物还原）、
    // 形态变化（decl 文本不同→双侧还原）、inject 移除（产物缺席→原文还原）。
    function declInitText(ir, name){
      if(!ir || !ir.info) return null;
      for(var i=0;i<ir.info.bindings.length;i++){
        var b = ir.info.bindings[i];
        if(b.name !== name || !b.decls.length) continue;
        // 找声明语句中的 init 文本
        var found = null;
        (function walk(n){
          if(found || !n || typeof n !== 'object') return;
          if(Array.isArray(n)){ for(var i2=0;i2<n.length;i2++) walk(n[i2]); return; }
          if(n.type === 'LocalStatement' && n.variables && n.init){
            for(var vi=0; vi<n.variables.length; vi++){
              if(n.variables[vi] === b.decls[0]){
                var ie = n.init[vi];
                found = ie && ie.range ? ir.src.slice(ie.range[0], ie.range[1]) : null;
                return;
              }
            }
          }
          for(var k in n){
            if(k === 'range' || k === 'loc') continue;
            if(Object.prototype.hasOwnProperty.call(n, k)) walk(n[k]);
          }
        })(ir.ast.body);
        return found;
      }
      return null;
    }
    function sameDecl(irX, irY, entry, name){
      var other = irY && irY.aliases.entries.get(name);
      if(!other) return false;
      if(other.kind !== entry.kind || other.target !== entry.target) return false;
      var tX = declInitText(irX, name), tY = declInitText(irY, name);
      return tX !== null && tX === tY;
    }
    function diffMap(fromIr, toIr){
      if(!fromIr) return null;
      return buildAliasMap(fromIr, function(e, n){ return !sameDecl(fromIr, toIr, e, n); });
    }
    // 覆盖映射差量化：report.aliasMap 是全量映射（含源内登记条目），直接作还原映射会让
    // 产物侧还原两侧共有的源内别名、而原文侧不还原——不对称必失配（real-diaolei 实证：
    // 原文手写的 F=Isaac.AddCallback 等被产物侧还原删除声明、原文侧保留，形态永远对不上）。
    // 故覆盖映射同样过 sameDecl 差量：两侧同形同文的别名不还原，与 diffMap 口径一致。
    function filterOverrideMap(map, otherIr){
      if(!map) return map;
      if(!otherIr) return map;
      function keep(name, kind, target){
        var oe = otherIr.aliases.entries.get(name);
        if(!oe || oe.kind !== kind || oe.target !== target) return true;
        var tO = declInitText(otherIr, name);
        // 覆盖映射来自 fromIr 全量条目；同名同 kind/target 时还需声明 init 文本一致才不还原。
        // fromIr 侧文本无法从此处取得——但 sameDecl 的语义是"两侧文本俱在且一致"，
        // 产物侧文本即覆盖映射所附 IR 的 decl 文本，由调用方保证；此处以 otherIr 有同
        // 名同形同 target 条目且有声明文本为准（不一致时还原，保守不错放）。
        return tO === null;
      }
      var byName = {}, memberByLocal = {}, stringAlias = {}, chainAlias = {}, prefixFold = {};
      var factorLocals = [], has = false;
      var src1 = map.byName || {};
      for(var g in src1) if(Object.prototype.hasOwnProperty.call(src1, g)){
        var nm1 = src1[g];
        if(keep(nm1, 'global', g)){ byName[g] = nm1; has = true; }
      }
      [['memberByLocal','member',memberByLocal], ['stringAliasByLocal','string',stringAlias],
       ['chainAliasByLocal','chain',chainAlias], ['prefixFoldByLocal','prefix',prefixFold]]
        .forEach(function(spec){
          var t = map[spec[0]] || {};
          for(var n in t) if(Object.prototype.hasOwnProperty.call(t, n)){
            if(keep(n, spec[1], t[n])){
              spec[2][n] = t[n]; has = true;
              if(spec[1] === 'prefix') factorLocals.push(n);
            }
          }
        });
      var transparent = {};
      var tr = map.transparentAliases || {};
      for(var tn in tr) if(Object.prototype.hasOwnProperty.call(tr, tn)){
        if((otherIr.aliases.transparent || {})[tn] === tr[tn]) continue;
        transparent[tn] = tr[tn]; has = true;
      }
      if(!has) return null;
      return {
        byName: byName, memberByLocal: memberByLocal, factorLocals: factorLocals,
        transparentAliases: transparent, prefixFoldByLocal: prefixFold,
        stringAliasByLocal: stringAlias, chainAliasByLocal: chainAlias,
        dropLeading: map.dropLeading || 0
      };
    }
    var amA = amAOverride !== undefined ? filterOverrideMap(amAOverride, newIr) : diffMap(origIr, newIr);
    var amB = amBOverride !== undefined ? filterOverrideMap(amBOverride, origIr) : diffMap(newIr, origIr);
    var ka, kb;
    // 快路径：无映射严格比对——no-op 轮/纯形态变化（文本一致）在此直接通过，
    // 不会被单侧还原映射误伤（差量映射只在文本已经不同后才参与）。
    try{
      if(base._canonical(origSrc) === base._canonical(newSrc)) return true;
    }catch(e){ return false; }
    try{ ka = amA ? base._canonical(origSrc, amA) : ka; }catch(e){ return false; }
    try{ kb = amB ? base._canonical(newSrc, amB) : kb; }catch(e){ return false; }
    // ka/kb 可能已被快路径算过（无映射形态）；按需补算
    try{ if(ka === undefined) ka = base._canonical(origSrc); }catch(e){ return false; }
    try{ if(kb === undefined) kb = base._canonical(newSrc); }catch(e){ return false; }
    if(ka === kb) return true;
    // 单用邻接代入归一层（v2 私有规则，v1 canonical 无此归一；规则按透镜下沉 §3）：
    // 两侧各自把「单用邻接」局部代入为定义值后递归重比（差量映射随新文本重推导）。
    // 覆盖：源内调用链别名的 inv 撤销（local D=Game():GetRoom() print(D）与代入形态）、
    // inlinePure 赋值形态的跨侧对账。健全性条件见 normSingleUseAdjacent 注释。
    if(!_depth){
      var nsA = normSingleUseAdjacent(origSrc, deps);
      var nsB = normSingleUseAdjacent(newSrc, deps);
      if(nsA !== origSrc || nsB !== newSrc){
        var nirA = null, nirB = null;
        try{ nirA = irMod().buildIR(nsA, deps); }catch(e){ nirA = null; }
        try{ nirB = irMod().buildIR(nsB, deps); }catch(e){ nirB = null; }
        if(equivalent(nsA, nsB, deps, nirA, nirB, flags, undefined, undefined, 1)) return true;
      }
    }
    if(!(flags && flags.pureInline)) return false;
    try{
      var na = base._normPureCopyProp(origSrc, amA || undefined);
      var nb = base._normPureCopyProp(newSrc, amB || undefined);
      var sa = amA ? base._canonical(na, amA) : base._canonical(na);
      var sb = amB ? base._canonical(nb, amB) : base._canonical(nb);
      return sa === sb;
    }catch(e){ return false; }
  }

  // finalReview(origSrc, newSrc, ir, deps, flags) -> true：三重终审，任一不过即抛错。
  //  ① luaparse 双解析 ② fengari 真·Lua 校验 ③ 双侧 canonical 等价（equivalent()）。
  // flags.pureInline：流水线提交过 norm.inlinePure 时置真（其私有归一夹层随透镜下沉）。
  function finalReview(origSrc, newSrc, ir, deps, flags){
    var base = getBase(deps);
    try{ base._parse(newSrc); }catch(e){ throw new Error('[终审/luaparse] 产物无法解析: ' + (e.message||e)); }
    var luaErr = luaValidateOf(deps)(newSrc);
    if(luaErr) throw new Error('[终审/fengari] 产物语法非法: ' + luaErr);
    // 原文侧的 IR（源内链别名证据）缓存构建
    var origIr = null;
    try{ origIr = irMod().buildIR(origSrc, deps); }catch(e){ origIr = null; }
    if(!equivalent(origSrc, newSrc, deps, origIr, ir, flags))
      throw new Error('[终审/canonical] 语义不等价（归一文本不一致）');
    return true;
  }

  // irMod()：惰性引入 ir.js（双侧还原需要原文侧的 IR）；
  // Node 走 require，浏览器查 __LuaMin2Modules 注册表（ir.js 须先载入）
  var _irMod = null;
  function irMod(){
    if(!_irMod){
      if(typeof module !== 'undefined' && module.exports) _irMod = require('./ir.js');
      else if(root.__LuaMin2Modules) _irMod = root.__LuaMin2Modules['ir'];
      if(!_irMod) throw new Error('canonical2: 需要 src2/ir.js');
    }
    return _irMod;
  }

  var api = { buildAliasMap: buildAliasMap, finalReview: finalReview, equivalent: equivalent, luaValidateOf: luaValidateOf };
  (root.__LuaMin2Parts = root.__LuaMin2Parts || []).push({
    name: 'canonical2',
    install: function(C){ for(var k in api) C[k] = api[k]; }
  });
  root.__LuaMin2Modules = root.__LuaMin2Modules || {};
  root.__LuaMin2Modules['canonical2'] = api;
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
