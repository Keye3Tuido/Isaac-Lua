/* ===================================================================
 * LuaMin v2 part: ir — IR 构建器与维护（M1）
 * IR = { src, ast, info, ssa, evidence:Map(惰性), aliases:AliasEnv, version }
 *
 * 设计要点（对应 docs/v2-architecture-plan.md §2）：
 *  - 作用域解析完全复用 shared/analyze.js（info.bindings / varOf / assignedGlobals），
 *    本文件只在之上叠加 SSA 版本表层，不重走作用域。
 *  - SSA 表是唯一赋值/使用事实来源（INV-3），透镜前置条件只查询它。
 *  - 证据槽 evidence 与 src 同生共死：版本递增即失效，按 key 惰性重建（INV-2）。
 *  - AliasEnv 的每条 declRange 必须指向真实 local 声明项（INV-1，机器检查）。
 *  - 区间重映射器统一平移 declRange；默认每步全量重建（先正确后优化），
 *    增量重建仅留钩子（stub，回退全量）。
 *
 * 加载方式（与 src2 其他 part 相同的双目标模式）：
 *  - 浏览器：index.html 先引入 src2/base.js 再引入本文件，part 自注册到 __LuaMin2Parts。
 *  - Node：require 本文件即得 API；base 门面经 src2/base.js 构造。
 * =================================================================== */
(function(root){
  'use strict';

  var baseMod = null;
  if(typeof module !== 'undefined' && module.exports){
    baseMod = require('./base.js');
  }else if(root.__LuaMin2Modules){
    baseMod = root.__LuaMin2Modules['base'];
  }

  // 惰性获取共享基础库门面（词法器 / parse / analyze / canonical 均经此注入复用）。
  // deps 可显式传入 base 实例（浏览器/测试注入）；否则经 src2/base.js 构造。
  function getBase(deps){
    deps = deps || {};
    if(deps.base) return deps.base;
    if(!baseMod) throw new Error('src2/ir.js: 需要 src2/base.js 已加载');
    return baseMod.create(deps);
  }

  /* ---------------------------------------------------------------
   * SSA 版本表层：在 analyze.js 的作用域结果上按语句执行序走一遍 AST，
   * 为每个 binding 记录版本序列：v0=声明 def，此后每次赋值 bump 一新版本。
   * 版本条目 = { ver, defSite:[s,e)|null, defKind, useSites:[[s,e),...] }。
   * 遮蔽/闭包/循环变量等作用域事实全部来自 info.varOf，本层只编号。
   * --------------------------------------------------------------- */

  // buildSSA(ast, info) -> { byBinding:Map(binding->entry), assignCount, declCount }
  function buildSSA(ast, info){
    var byBinding = new Map();
    var assignCount = 0;

    function entryOf(b){
      var e = byBinding.get(b);
      if(!e){ e = { binding:b, name:b.name, versions:[] }; byBinding.set(b, e); }
      return e;
    }
    // 声明 def：每个 binding 恰一次 v0（隐式 self 无 decls，defSite=null）
    info.bindings.forEach(function(b){
      var e = entryOf(b);
      var site = (b.decls && b.decls.length && b.decls[0].range) ? b.decls[0].range.slice() : null;
      e.versions.push({ ver:0, defSite:site, defKind: b.pinned ? 'param' : 'decl', useSites:[] });
    });
    function curVer(b){ return entryOf(b).versions.length - 1; }
    function recordUse(node){
      var b = info.varOf.get(node);
      if(!b) return; // 全局引用不进 SSA 表
      var e = entryOf(b);
      e.versions[e.versions.length-1].useSites.push(node.range.slice());
    }
    function recordAssign(node){
      var b = info.varOf.get(node);
      if(!b) return; // 赋值给全局：不属于任何局部版本
      var e = entryOf(b);
      e.versions.push({ ver:e.versions.length, defSite:node.range.slice(), defKind:'assign', useSites:[] });
      assignCount++;
    }

    function walkExprList(list){ for(var i=0;i<list.length;i++) walkExpr(list[i]); }

    function walkExpr(node){
      if(!node) return;
      switch(node.type){
        case 'Identifier': recordUse(node); break;
        case 'NumericLiteral': case 'StringLiteral': case 'BooleanLiteral':
        case 'NilLiteral': case 'VarargLiteral': break;
        case 'BinaryExpression': case 'LogicalExpression':
          walkExpr(node.left); walkExpr(node.right); break;
        case 'UnaryExpression': walkExpr(node.argument); break;
        case 'MemberExpression': walkExpr(node.base); break;   // identifier 是字段名
        case 'IndexExpression': walkExpr(node.base); walkExpr(node.index); break;
        case 'CallExpression': walkExpr(node.base); walkExprList(node.arguments); break;
        case 'TableCallExpression': walkExpr(node.base); walkExpr(node.arguments); break;
        case 'StringCallExpression': walkExpr(node.base); walkExpr(node.argument); break;
        case 'TableConstructorExpression':
          for(var i=0;i<node.fields.length;i++){
            var f=node.fields[i];
            if(f.type==='TableKey'){ walkExpr(f.key); walkExpr(f.value); }
            else if(f.type==='TableKeyString'){ walkExpr(f.value); }
            else if(f.type==='TableValue'){ walkExpr(f.value); }
          }
          break;
        case 'FunctionDeclaration': walkFunction(node); break;
        default: break;
      }
    }

    // 函数形参即内层 binding 的 v0（analyze 已声明）；体内按定义点处的当前版本记使用
    function walkFunction(node){ walkBlock(node.body); }
    function walkBlock(stmts){ for(var i=0;i<stmts.length;i++) walkStmt(stmts[i]); }

    function walkStmt(node){
      switch(node.type){
        case 'LocalStatement':
          // 真 Lua 语义：init 先于新变量生效（varOf 已把 init 里的同名解析到外层），
          // 故先记 init 的使用，声明 def 在绑定创建时已登记 v0，无需再动。
          walkExprList(node.init||[]);
          break;
        case 'AssignmentStatement':
          walkExprList(node.init||[]);
          for(var j=0;j<node.variables.length;j++){
            var tgt=node.variables[j];
            if(tgt.type==='Identifier') recordAssign(tgt);
            else walkExpr(tgt); // 成员/索引目标：base/index 是使用
          }
          break;
        case 'CallStatement': walkExpr(node.expression); break;
        case 'ReturnStatement': walkExprList(node.arguments||[]); break;
        case 'IfStatement':
          for(var c=0;c<node.clauses.length;c++){
            var cl=node.clauses[c];
            if(cl.condition) walkExpr(cl.condition);
            walkBlock(cl.body);
          }
          break;
        case 'WhileStatement': walkExpr(node.condition); walkBlock(node.body); break;
        case 'DoStatement': walkBlock(node.body); break;
        case 'RepeatStatement':
          walkBlock(node.body);
          walkExpr(node.condition); // until 可见 body 局部（varOf 已解析）
          break;
        case 'ForNumericStatement':
          walkExpr(node.start); walkExpr(node.end); walkExpr(node.step);
          walkBlock(node.body);
          break;
        case 'ForGenericStatement':
          walkExprList(node.iterators);
          walkBlock(node.body);
          break;
        case 'FunctionDeclaration':
          if(!(node.isLocal && node.identifier && node.identifier.type==='Identifier')){
            // 全局/成员函数定义：identifier 链按使用处理（与 analyze 一致）
            if(node.identifier && node.identifier.type==='Identifier') recordUse(node.identifier);
            else if(node.identifier) walkExpr(node.identifier);
          }
          walkFunction(node);
          break;
        default: break;
      }
    }

    walkBlock(ast.body);
    return { byBinding:byBinding, assignCount:assignCount, declCount:info.bindings.length };
  }

  /* ---------------------------------------------------------------
   * AliasEnv：别名证据环境（取代 v1 旁车 aliasMap）
   * entries: Map<name, AliasEntry>；dropLeading 保留 v1 语义占位。
   * AliasEntry = { kind, target, declRange:[s,e), introducedBy, roundtripKey }
   * 约定：declRange 覆盖 `local <name>` 前缀区间（local 关键字起、声明名止），
   * 这是 INV-1 机器检查的口径（见 checkInv1）。
   * --------------------------------------------------------------- */

  // AliasEnv 构造函数
  // transparent：已消解透明别名 {name->global}（声明已删、无 declRange，故不进 entries，
  // 不受 INV-1 约束；canonical2 终审据它做双侧还原，对应 v1 aliasMap.transparentAliases）。
  function AliasEnv(){
    this.entries = new Map();
    this.dropLeading = 0;
    this.transparent = {};
  }
  // addEntry(name, entry)：登记别名（仅做形状校验；INV-1 文本校验见 checkInv1）
  // declRange 允许 null（entry.injected=true 的复合声明注入条目，走 AST 级校验通道）
  AliasEnv.prototype.addEntry = function(name, entry){
    if(typeof name !== 'string' || !name) throw new Error('AliasEnv.addEntry: name 必须为非空字符串');
    if(!entry) throw new Error('AliasEnv.addEntry: entry 缺失');
    if(entry.declRange === null){
      if(!entry.injected) throw new Error('AliasEnv.addEntry: declRange=null 须标记 injected');
    }else if(!Array.isArray(entry.declRange) || entry.declRange.length !== 2)
      throw new Error('AliasEnv.addEntry: entry.declRange 必须为 [s,e)');
    this.entries.set(name, entry);
    return this;
  };
  // removeEntry(name)：撤销一条别名（inject 逆方向用）
  AliasEnv.prototype.removeEntry = function(name){ return this.entries.delete(name); };
  // clone()：条目浅拷贝 + declRange 数组拷贝（区间 remap 不污染旧环境）
  AliasEnv.prototype.clone = function(){
    var env = new AliasEnv();
    env.dropLeading = this.dropLeading;
    for(var tk in this.transparent)
      if(Object.prototype.hasOwnProperty.call(this.transparent, tk)) env.transparent[tk] = this.transparent[tk];
    this.entries.forEach(function(e, n){
      var c = {};
      for(var k in e) if(Object.prototype.hasOwnProperty.call(e, k)) c[k] = e[k];
      c.declRange = e.declRange.slice();
      env.entries.set(n, c);
    });
    return env;
  };

  // checkInv1(ir) -> true/string：每条 declRange 指向当前 src 中真实 local 声明项。
  // 机器检查方式：对 declRange 切片重新词法化，须切出 `local <name>` 两 token 前缀。
  // 例外通道：复合声明注入（fieldPrefix 等多名合批）的条目 declRange=null 且 injected=true，
  // 改为 AST 级校验——须存在【顶层作用域、单声明】的同名 binding（声明真实存在即 INV-1 成立）。
  function checkInv1(ir, lexFn){
    var lex = lexFn || ir._base._lex;
    var bad = null;
    ir.aliases.entries.forEach(function(entry, name){
      if(bad) return;
      var r = entry.declRange;
      if(r === null && entry.injected){
        var found = false;
        for(var i=0;i<ir.info.bindings.length;i++){
          var b = ir.info.bindings[i];
          if(b.name === name && b.decls.length >= 1 && b.scope === ir.info.topScope){ found = true; break; }
        }
        if(!found) bad = name + ': 注入条目无对应顶层声明';
        return;
      }
      if(!r || r[0] < 0 || r[1] > ir.src.length || r[0] >= r[1]){ bad = name + ': declRange 越界'; return; }
      var toks;
      try{ toks = lex(ir.src.slice(r[0], r[1])); }catch(e){ bad = name + ': 切片无法词法化'; return; }
      if(toks.length < 3 || toks[0].value !== 'local' || toks[0].type !== 'Keyword'
         || !toks[1] || toks[1].type !== 'Name' || toks[1].value !== name){
        bad = name + ': declRange 不是 local 声明项';
      }
    });
    return bad ? bad : true;
  }

  /* ---------------------------------------------------------------
   * 区间重映射器：一组 token 区间文本编辑 {start,end,text} 同时
   * (a) 产出新源码 (b) 平移所有 declRange (c) 版本 +1 (d) 证据失效。
   * 编辑与某 declRange 相交 => 该声明文本被改写，条目无法保守保留，丢弃（注释说明）。
   * --------------------------------------------------------------- */

  // applyTextEdits(src, edits) -> newSrc：编辑契约与 shared/purecopy.js applyEdits 一致——
  // 半开区间按 start 稳定排序后【从左到右】应用；允许零长插入（start===end）、
  // 允许紧贴上一段末尾（start===cur）；同偏移多插入按 push 序生效；
  // 其余重叠（e.start<cur）抛错（M4 fwdNil 暴露过降序实现的同偏移插入+删除腐败）。
  function applyTextEdits(src, edits){
    var sorted = edits.slice().sort(function(a,b){ return a.start - b.start; });
    var out = '', cur = 0;
    for(var i=0;i<sorted.length;i++){
      var e = sorted[i];
      if(e.start < cur)
        throw new Error('applyTextEdits: 编辑重叠（调用方 bug）——第 ' + i + ' 段 [' + e.start + ',' + e.end + ')');
      out += src.slice(cur, e.start) + (e.text||'');
      cur = e.end;
    }
    out += src.slice(cur);
    return out;
  }

  // remapRange(range, edits) -> [s,e)|null：逐编辑平移；相交则返回 null（声明被破坏）
  function remapRange(range, edits){
    var s = range[0], e = range[1];
    for(var i=0;i<edits.length;i++){
      var ed = edits[i];
      var delta = (ed.text||'').length - (ed.end - ed.start);
      if(ed.end <= s){ s += delta; e += delta; }              // 编辑整体在区间之前
      else if(ed.start >= e){ /* 整体在之后，不动 */ }
      else return null;                                       // 相交：声明文本被改写
    }
    return [s, e];
  }

  // detectSourceAliases(ir)：登记输入自带的别名形态声明（单声明、SSA 只读）：
  //   整链（Member/Index init）→ kind 'chain'；字符串字面量 init → kind 'string'。
  // 证据在数据里：等价判定/终审/inv 步不再依赖 canonical 自动探测或管线旁车。
  // 透明别名（init 为裸 Identifier）不登记：canonical 的 autoTA 归一原生覆盖。
  function detectSourceChainAliases(ir){
    var out = [];
    for(var si=0; si<ir.ast.body.length; si++){
      var st = ir.ast.body[si];
      if(st.type !== 'LocalStatement' || !st.variables || !st.init) continue;
      for(var vi=0; vi<st.variables.length; vi++){
        var v = st.variables[vi], ie = st.init[vi];
        if(!v || v.type !== 'Identifier' || !ie || !ie.range) continue;
        var kind = null;
        if(ie.type === 'MemberExpression' || ie.type === 'IndexExpression') kind = 'chain';
        else if(ie.type === 'StringLiteral') kind = 'string';
        if(!kind) continue;
        var b = ir.info.varOf.get(v);
        if(!b || b.decls.length !== 1) continue;
        var e = ir.ssa.byBinding.get(b);
        if(!e || e.versions.length !== 1) continue;
        var single = st.variables.length === 1;
        var target = kind === 'string'
          ? ir.src.slice(ie.range[0]+1, ie.range[1]-1)   // 去引号（map 值是内容）
          : ir.src.slice(ie.range[0], ie.range[1]);
        out.push({ name: v.name, target: target, kind: kind,
          declRange: single ? [st.range[0], v.range[1]] : null,
          injected: !single });
      }
    }
    return out;
  }

  // buildIR(src, deps) -> IR：parse + analyze(shared) + SSA 版本表 + 证据槽 + 别名环境
  // （别名环境含源内整链别名登记，见 detectSourceChainAliases）
  function buildIR(src, deps){
    var base = getBase(deps);
    var ast = base._parse(src);
    var info = base._analyze(ast);
    // 用户声明的可变全局（UI 黑白名单，deps.mutableGlobals）：并入 assignedGlobals——
    // 凡查 assignedGlobals 的透镜（alias.global 等）自动将其排除出别名候选，
    // 与「代码内赋值」同口径拦截；快照型别名（local a=G）只对恒定全局成立。
    if(deps && deps.mutableGlobals){
      for(var mg=0; mg<deps.mutableGlobals.length; mg++) info.assignedGlobals.add(deps.mutableGlobals[mg]);
    }
    var ir = {
      src: src,
      ast: ast,
      info: info,
      ssa: buildSSA(ast, info),
      evidence: new Map(),   // 惰性证据槽：key -> 证据（INV-2：随 version 失效）
      aliases: new AliasEnv(),
      version: 0,
      _base: base,           // 注入的共享基础库（lex/parse/analyze/canonical）
      _deps: deps || {}
    };
    // 源内整链别名登记（M6：inv 步与全局门禁的证据来源）
    detectSourceChainAliases(ir).forEach(function(a){
      ir.aliases.addEntry(a.name, { kind: a.kind, target: a.target, declRange: a.declRange,
        injected: a.injected, introducedBy: 'source', roundtripKey: 'source:' + a.name });
    });
    return ir;
  }

  // applyEditsToIR(ir, edits) -> newIR：默认全量重建（先正确后优化），
  // declRange 由重映射器平移；相交条目丢弃；version+1；evidence 全新空槽。
  function applyEditsToIR(ir, edits){
    var newSrc = applyTextEdits(ir.src, edits);
    var nir = buildIR(newSrc, ir._deps);
    nir.version = ir.version + 1;
    var env = new AliasEnv();
    env.dropLeading = ir.aliases.dropLeading;
    for(var tk in ir.aliases.transparent)
      if(Object.prototype.hasOwnProperty.call(ir.aliases.transparent, tk)) env.transparent[tk] = ir.aliases.transparent[tk];
    ir.aliases.entries.forEach(function(entry, name){
      if(entry.declRange === null && entry.injected){
        // 注入条目无文本区间（复合声明合批）：随 AST 重建存活，不做区间平移。
        // 但条目与声明同生共死——编辑可能已删除其声明（如 inlinePure 代入源内
        // 字符串别名并删槽位）：顶层单声明不存在时条目必须随声明消亡，
        // 否则悬空证据违反 INV-1（AST 校验通道「注入条目无对应顶层声明」）。
        var alive = false;
        for(var bi=0; bi<nir.info.bindings.length; bi++){
          var bb = nir.info.bindings[bi];
          if(bb.name === name && bb.decls.length >= 1 && bb.scope === nir.info.topScope){ alive = true; break; }
        }
        if(alive) env.entries.set(name, entry);
        return;
      }
      var r = remapRange(entry.declRange, edits);
      if(!r) return; // 声明被编辑破坏：条目随声明消亡，丢弃
      var c = {};
      for(var k in entry) if(Object.prototype.hasOwnProperty.call(entry, k)) c[k] = entry[k];
      c.declRange = r;
      env.entries.set(name, c);
    });
    nir.aliases = env;
    return nir;
  }

  // applyEditsToIRIncremental(ir, edits)：增量重建钩子（M1 stub：回退全量重建）。
  // 后续里程碑可在此做"局部重 parse + 局部 SSA 修复"，对外契约不变。
  function applyEditsToIRIncremental(ir, edits){
    return applyEditsToIR(ir, edits);
  }

  /* ---------- 证据注册表（惰性、随版本失效；INV-2 的实现侧） ---------- */

  var EVIDENCE_BUILDERS = {};

  // registerEvidence(key, builder)：注册证据提供者；builder(ir) 在首次查询时执行并缓存
  function registerEvidence(key, builder){ EVIDENCE_BUILDERS[key] = builder; }

  // getEvidence(ir, key, builder?)：惰性证据存取——未缓存则现算入槽；
  // builder 缺省时查注册表（透镜 match 与 verify 消费同一实现，§6.2 的结构性保证）。
  function getEvidence(ir, key, builder){
    if(!ir.evidence.has(key)){
      var b = builder || EVIDENCE_BUILDERS[key];
      if(!b) throw new Error('IR 证据未注册: ' + key);
      ir.evidence.set(key, b(ir));
    }
    return ir.evidence.get(key);
  }

  // 内建证据 metatableFree：shared/analyze.js 的 analyzeMetatableFree（纯度/稳定性单一实现）。
  registerEvidence('metatableFree', function(ir){
    return ir._base.analyzeMetatableFree(ir.ast, ir.info);
  });

  // canonicalKey(ir, canonicalFn) -> string：IR 等价键，委托 shared/canonical（注入优先）
  function canonicalKey(ir, canonicalFn){
    var fn = canonicalFn || (ir._deps && ir._deps.canonical) || ir._base._canonical;
    return fn(ir.src);
  }

  /* ---------- part 注册（与 v1 相同模式） ---------- */
  var api = {
    buildIR: buildIR,
    buildSSA: buildSSA,
    AliasEnv: AliasEnv,
    checkInv1: checkInv1,
    applyTextEdits: applyTextEdits,
    remapRange: remapRange,
    applyEditsToIR: applyEditsToIR,
    applyEditsToIRIncremental: applyEditsToIRIncremental,
    getEvidence: getEvidence,
    registerEvidence: registerEvidence,
    canonicalKey: canonicalKey
  };
  (root.__LuaMin2Parts = root.__LuaMin2Parts || []).push({
    name: 'ir',
    install: function(C){ for(var k in api) C[k] = api[k]; }
  });
  // 浏览器模块注册表：src2 各文件按 index.html 的 script 顺序载入后互查于此（Node 走 require）
  root.__LuaMin2Modules = root.__LuaMin2Modules || {};
  root.__LuaMin2Modules['ir'] = api;
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
