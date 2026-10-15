/* ===================================================================
 * LuaMin v2 part: lens — 透镜基座（M1）
 * 对应 docs/v2-architecture-plan.md §3 的透镜契约：
 *   Lens = { name, kind, requires, provides, consumes, conflicts,
 *            match, cost, extract, inject, verify? }
 * 本文件提供：
 *  - validateLens：契约机器检查，违例即抛错；
 *  - encodeDelta：统一精确字节成本口径（复用 shared/encode 管线，注入优先）；
 *  - mkVerifyDefault：默认 verify = roundtrip 自证（extract 后 inject 回到 canonical 等价）；
 *  - applyCandidate：候选执行器（extract → 区间重映射 → 登记别名 → Step 记录）。
 *
 * 加载方式与 src2/ir.js 相同：自注册到 __LuaMin2Parts，Node 下直接 module.exports。
 * =================================================================== */
(function(root){
  'use strict';

  var irMod = null, baseMod = null;
  // Node 下直接 require 同目录 ir.js / base.js；浏览器侧由 __LuaMin2Parts 安装顺序保证
  // 先就绪，此时工厂函数须由调用方注入（见 createLensTools 的 deps.ir / deps.base）。
  if(typeof module !== 'undefined' && module.exports){
    irMod = require('./ir.js');
    baseMod = require('./base.js');
  }else if(root.__LuaMin2Modules){
    irMod = root.__LuaMin2Modules['ir'];
    baseMod = root.__LuaMin2Modules['base'];
  }

  function needIR(deps){
    var m = (deps && deps.ir) || irMod;
    if(!m) throw new Error('src2/lens.js: 需要 src2/ir.js（deps.ir 注入或先行加载）');
    return m;
  }
  function needBase(deps){
    if(deps && deps.base) return deps.base;
    if(!baseMod) throw new Error('src2/lens.js: 需要 src2/base.js（deps.base 注入或先行加载）');
    return baseMod.create(deps);
  }

  /* ---------- 契约校验 ---------- */

  var KINDS = { extract:1, rewrite:1, encode:1 };

  // validateLens(lens)：透镜契约检查——缺字段/类型错/未知 kind 一律抛错（宁可拒载不留隐患）
  function validateLens(lens){
    if(!lens || typeof lens !== 'object') throw new Error('透镜契约：lens 必须是对象');
    if(typeof lens.name !== 'string' || !lens.name) throw new Error('透镜契约：name 必须是非空字符串');
    if(!KINDS[lens.kind]) throw new Error('透镜契约[' + lens.name + ']：kind 必须是 extract|rewrite|encode');
    ['requires','provides'].forEach(function(field){
      var v = lens[field];
      if(!Array.isArray(v)) throw new Error('透镜契约[' + lens.name + ']：' + field + ' 必须是字符串数组');
      v.forEach(function(x){
        if(typeof x !== 'string') throw new Error('透镜契约[' + lens.name + ']：' + field + ' 元素必须是字符串');
      });
    });
    ['consumes','conflicts'].forEach(function(field){
      if(lens[field] !== undefined && !Array.isArray(lens[field]))
        throw new Error('透镜契约[' + lens.name + ']：' + field + ' 若给出必须是数组');
    });
    ['match','cost','extract','inject'].forEach(function(fn){
      if(typeof lens[fn] !== 'function') throw new Error('透镜契约[' + lens.name + ']：缺少函数 ' + fn);
    });
    if(lens.verify !== undefined && typeof lens.verify !== 'function')
      throw new Error('透镜契约[' + lens.name + ']：verify 若给出必须是函数');
    if(lens.normalizePair !== undefined && typeof lens.normalizePair !== 'function')
      throw new Error('透镜契约[' + lens.name + ']：normalizePair 若给出必须是函数');
    return true;
  }

  /* ---------- 精确字节成本 ---------- */

  // getEncodePipe(deps) -> {removeComments, spacing}：
  // 编码管线复用 shared/encode.js（经 base 门面取得，deps.base 注入优先）。
  // M3 起口径改为 removeComments + applyEncoding（间隔符最小化但【不】消分号）：
  // 分号消除已由 encode.semicolon 透镜在 AST 语句边界上接管（§6.1），
  // 成本口径若再含括号栈分号消除会把透镜收益重复计入。
  var pipeCache = null;
  function getEncodePipe(deps){
    deps = deps || {};
    if(deps.removeComments && deps.spacing)
      return { removeComments: deps.removeComments, spacing: deps.spacing };
    if(pipeCache && pipeCache.base === (deps.base || null)) return pipeCache.pipe;
    var base = needBase(deps);
    var pipe = { removeComments: base.removeComments, spacing: base.applyEncoding };
    pipeCache = { base: deps.base || null, pipe: pipe };
    return pipe;
  }

  // encodeOne(src, deps)：编码口径 = removeComments + 间隔符最小化（不含分号消除）
  function encodeOne(src, deps){
    var pipe = getEncodePipe(deps);
    return pipe.spacing(pipe.removeComments(src));
  }

  // encodeDelta(beforeSrc, afterSrc, deps) -> int：
  // 精确字节成本 = encode(after).length - encode(before).length（负数为收益）。
  // deps 注入 { removeComments, spacing }（取自 base 门面）或 { base }。
  function encodeDelta(beforeSrc, afterSrc, deps){
    return encodeOne(afterSrc, deps).length - encodeOne(beforeSrc, deps).length;
  }

  /* ---------- 默认 verify（roundtrip 自证） ---------- */

  // mkVerifyDefault(lens, deps) -> verify(ir, cand, result)：
  // 默认验证 = 逆变换回放：对 extract 产物 IR 按依赖逆序 inject 全部别名条目，
  // 回放结果与原 IR 须 canonical 等价（canonicalKey 一致）。
  // 透镜私有差异由 normalizePair(keyA, keyB) 归一后再比（可选覆盖）。
  function mkVerifyDefault(lens, deps){
    var IR = needIR(deps);
    return function verify(ir, cand, result){
      var form = (result && result.form) || {};
      var names = form.aliasEntries ? form.aliasEntries.map(function(a){ return a.name; }) : [];
      var cur = result.ir;
      // 依赖逆序撤销（嵌套 extract 的后登记条目先撤销）
      for(var i=names.length-1;i>=0;i--){
        var inj = lens.inject(cur, names[i]);
        if(!inj || !Array.isArray(inj.edits)) return false;
        cur = IR.applyEditsToIR(cur, inj.edits);
      }
      var ka = IR.canonicalKey(ir, deps && deps.canonical);
      var kb = IR.canonicalKey(cur, deps && deps.canonical);
      if(lens.normalizePair){
        var pair = lens.normalizePair(ka, kb);
        ka = pair[0]; kb = pair[1];
      }
      return ka === kb;
    };
  }

  /* ---------- 候选执行器 ---------- */

  // recomputeDropLeading(ir)：数头部连续的"声明了 AliasEnv 条目的 LocalStatement"条数
  function recomputeDropLeading(ir){
    var n = 0;
    var body = ir.ast.body || [];
    for(var i=0;i<body.length;i++){
      var st = body[i];
      if(!st || st.type !== 'LocalStatement' || !st.variables) break;
      var declares = false;
      for(var vi=0; vi<st.variables.length; vi++){
        var v = st.variables[vi];
        if(v.type === 'Identifier' && ir.aliases.entries.has(v.name)){ declares = true; break; }
      }
      if(!declares) break;
      n++;
    }
    return n;
  }

  // applyCandidate(ir, lens, cand, deps) -> { ir:newIR, step:Step, form, residue }：
  // 跑 extract → applyEditsToIR（区间重映射）→ 登记新别名条目 → 记 Step{fwd, delta}。
  // Step 是一等公民（可回放）；delta 走统一 encodeDelta 口径。
  function applyCandidate(ir, lens, cand, deps){
    validateLens(lens);
    var IR = needIR(deps);
    var ext = lens.extract(ir, cand);
    if(!ext || !Array.isArray(ext.edits))
      throw new Error('透镜[' + lens.name + '] extract 必须返回 { edits:[...] }');
    var nir = IR.applyEditsToIR(ir, ext.edits);
    if(ext.form && Array.isArray(ext.form.aliasEntries)){
      ext.form.aliasEntries.forEach(function(a){
        nir.aliases.addEntry(a.name, a.entry);
      });
    }
    // 头部声明计数：全量重算【头部连续声明了别名条目的 LocalStatement 数】。
    // 机器推导而非各透镜手工 +1/-1——删除/合并/插入声明后恒正确（v1 bumpDrop/clampDrop
    // 的手工维护正是病灶 A 的一部分）；form.dropLeading 仅作提示，最终以重算为准。
    nir.aliases.dropLeading = recomputeDropLeading(nir);
    // 透明别名消解产物：并入 AliasEnv.transparent（无 declRange，不进 entries）
    if(ext.form && ext.form.transparentAliases){
      for(var tn in ext.form.transparentAliases)
        if(Object.prototype.hasOwnProperty.call(ext.form.transparentAliases, tn))
          nir.aliases.transparent[tn] = ext.form.transparentAliases[tn];
    }
    // 逆方向撤销的别名：从 AliasEnv 移除（INV-1 随声明删除自然失效）
    var removedSet = new Set();
    if(ext.residue && Array.isArray(ext.residue.removedAliases)){
      ext.residue.removedAliases.forEach(function(n){ nir.aliases.removeEntry(n); removedSet.add(n); });
    }
    // 别名条目换键（名称交换候选）：声明名已被编辑改写，文本 declRange 随之失效——
    // 从旧环境取条目本体（编辑可能已摧毁 declRange），转为 injected 形态按新名重挂，
    // INV-1 走 AST 校验通道（顶层单声明真实存在）。
    if(ext.form && Array.isArray(ext.form.renamedAliases)){
      ext.form.renamedAliases.forEach(function(rn){
        var e = ir.aliases.entries.get(rn.from);
        if(!e) return;
        nir.aliases.entries.delete(rn.from);
        var c = {};
        for(var k in e) if(Object.prototype.hasOwnProperty.call(e, k)) c[k] = e[k];
        c.declRange = null; c.injected = true;
        nir.aliases.entries.set(rn.to, c);
      });
    }
    // 别名存活自动维护：声明移动类透镜（localsMerge/placeholderHoist/…）会把别名声明
    // 并入头部或合批，文本 declRange 被摧毁——但名字的顶层单声明仍在、值未变。
    // 此类条目自动转为 injected 形态保留（证据不丢，canonical2 终审仍可再生还原）；
    // residue.removedAliases 显式消亡的除外（透镜声明了"值关系已断"）。
    ir.aliases.entries.forEach(function(oldEntry, name){
      if(nir.aliases.entries.has(name) || removedSet.has(name)) return;
      var alive = false;
      for(var bi=0; bi<nir.info.bindings.length; bi++){
        var b = nir.info.bindings[bi];
        if(b.name === name && b.decls.length >= 1 && b.scope === nir.info.topScope){ alive = true; break; }
      }
      if(!alive) return;
      var c = {};
      for(var k in oldEntry) if(Object.prototype.hasOwnProperty.call(oldEntry, k)) c[k] = oldEntry[k];
      c.declRange = null; c.injected = true;
      nir.aliases.entries.set(name, c);
    });
    var delta = encodeDelta(ir.src, nir.src, deps);
    return {
      ir: nir,
      step: { lens: lens.name, candId: cand && cand.id, direction: 'fwd', delta: delta },
      form: ext.form || null,
      residue: ext.residue || null
    };
  }

  var api = {
    validateLens: validateLens,
    encodeDelta: encodeDelta,
    mkVerifyDefault: mkVerifyDefault,
    applyCandidate: applyCandidate
  };
  (root.__LuaMin2Parts = root.__LuaMin2Parts || []).push({
    name: 'lens',
    install: function(C){ for(var k in api) C[k] = api[k]; }
  });
  root.__LuaMin2Modules = root.__LuaMin2Modules || {};
  root.__LuaMin2Modules['lens'] = api;
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
