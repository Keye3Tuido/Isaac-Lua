/* ===================================================================
 * LuaMin v2 part: search2 — 双向 beam 搜索（M6）
 * 对应 docs/v2-architecture-plan.md §4：
 *   状态 S = { ir, trace, length }；起点 = 贪心管线结果（runGreedy）。
 *   每轮对 frontier 枚举：fwd（cost<0 前 N 候选）+ inv（仅当撤销后存在更便宜
 *   重提取——§9.3 剪枝）；applyStep 内含透镜 verify 自证，失败即丢弃并黑名单；
 *   canonicalKey 去重（seen 保留最短）；仅新 best 时跑三重终审一次。
 *   收敛：连续两轮无改善即停；trace 一等公民（Step.direction ∈ fwd|inv，可回放）。
 * 性能纪律：match/cost 不 parse（cost 是词法级 encodeDelta）；只有提交步重建 IR。
 * =================================================================== */
(function(root){
  'use strict';

  var irMod = null, lensMod = null, canonMod = null, aliasMod = null;
  if(typeof module !== 'undefined' && module.exports){
    irMod = require('./ir.js');
    lensMod = require('./lens.js');
    canonMod = require('./canonical2.js');
    aliasMod = require('./lenses/alias.js');
  }else if(root.__LuaMin2Modules){
    irMod = root.__LuaMin2Modules['ir'];
    lensMod = root.__LuaMin2Modules['lens'];
    canonMod = root.__LuaMin2Modules['canonical2'];
    aliasMod = root.__LuaMin2Modules['lenses/alias'];
  }

  /* ---------- 薄包装检测（block.wrap 的 inv 候选源；canonical blockWrapperInfo 同口径） ---------- */
  // findThinWrappers(ir)：顶层 local function/local f=function 且体为纯调用语句的包装名
  function findThinWrappers(ir){
    var out = [];
    for(var si=0; si<ir.ast.body.length; si++){
      var st = ir.ast.body[si];
      var fn = null;
      if(st.type === 'FunctionDeclaration' && st.isLocal && st.identifier
         && st.identifier.type === 'Identifier') fn = st;
      else if(st.type === 'LocalStatement' && st.variables && st.variables.length === 1
              && st.init && st.init.length === 1 && st.init[0].type === 'FunctionDeclaration') fn = st.init[0];
      if(!fn) continue;
      var body = fn.body || [];
      if(!body.length) continue;
      var ok = true;
      for(var bi=0; bi<body.length; bi++) if(body[bi].type !== 'CallStatement'){ ok = false; break; }
      if(ok) out.push(st.type === 'FunctionDeclaration' ? st.identifier.name : st.variables[0].name);
    }
    return out;
  }

  /* ---------- 源内别名声明检测（输入自带、未被消解的 local X=<纯值>） ---------- */
  // findSourceAliases(ir)：顶层单声明只读、init 为全局名/成员链/字面量的局部（injectAlias 的食材）
  function findSourceAliases(ir){
    var out = [];
    var info = ir.info;
    for(var si=0; si<ir.ast.body.length; si++){
      var st = ir.ast.body[si];
      if(st.type !== 'LocalStatement' || !st.variables || !st.init) continue;
      for(var vi=0; vi<st.variables.length; vi++){
        var v = st.variables[vi], ie = st.init[vi];
        if(!v || v.type !== 'Identifier' || !ie) continue;
        if(ir.aliases.entries.has(v.name)) continue;         // 已管条目由条目通道出 inv
        var b = info.varOf.get(v);
        if(!b || b.decls.length !== 1) continue;
        var e = ir.ssa.byBinding.get(b);
        if(!e || e.versions.length !== 1) continue;          // 只读（SSA 证据）
        var t = ie.type;
        if(t === 'Identifier' || t === 'MemberExpression' || t === 'IndexExpression'
           || t === 'StringLiteral' || t === 'NumericLiteral' || t === 'BooleanLiteral'
           // 调用链别名（init 含调用，readonlyInline 领土外）：单用邻接时内联更短；
           // 语义安全性由 inv 门的单用邻接代入归一机器校验（非邻接/多求值区等价失败即弃）。
           || t === 'CallExpression' || t === 'StringCallExpression' || t === 'TableCallExpression')
          out.push(v.name);
      }
    }
    return out;
  }

  /* ---------- 搜索器工厂 ---------- */

  // createSearch({ deps, lenses, scheduler }) -> { beamSearch }
  function createSearch(opts){
    var deps = (opts && opts.deps) || {};
    var lenses = (opts && opts.lenses) || [];
    var scheduler = opts && opts.scheduler;

    // encodeLen(src)：编码后长度（词法级，不 parse）
    function encodeLen(src){ return lensMod.encodeDelta('', src, deps); }

    // keyOf(ir)：seen 键 = canonicalKey + 别名结构签名。
    // 语义原因：canonical 的透明别名归一会把「折叠形态」与「未折叠形态」归一成同键，
    // 仅用 canonicalKey 会把"暂长 1 字但解锁后续组合"的中间态（如折叠+待合并）
    // 误并丢弃；别名签名把结构不同的形态区分开，同形态内仍保留最短（防环不变）。
    function sigOf(ir){
      var parts = [];
      ir.aliases.entries.forEach(function(e, n){ parts.push(e.kind + ':' + e.target + '=' + n); });
      Object.keys(ir.aliases.transparent || {}).sort().forEach(function(n){
        parts.push('T:' + ir.aliases.transparent[n] + '=' + n);
      });
      return parts.sort().join(',');
    }
    var keyCache = new Map();
    function keyOf(ir){
      var k = keyCache.get(ir.src);
      if(k === undefined){ k = irMod.canonicalKey(ir, deps.canonical); keyCache.set(ir.src, k); }
      return k + ' ' + sigOf(ir);
    }

    // eqToOriginal(ir, trace)：全局门禁——与原文双侧 canonical 等价（canonical2.equivalent，
    // 与终审同一实现；原文侧 IR 缓存一次）。
    var origIrCache = null, origIrDone = false;
    function gateOk(ir, trace, origSrc){
      if(!origIrDone){
        origIrDone = true;
        try{ origIrCache = irMod.buildIR(origSrc, deps); }catch(e){ origIrCache = null; }
      }
      if(origIrCache === null) return true;
      var pureInline = trace.some(function(t){ return t.lens === 'norm.inlinePure'; });
      return canonMod.equivalent(origSrc, ir.src, deps, origIrCache, ir, { pureInline: pureInline });
    }

    // applyStep(state, lens, cand, direction, label) -> newState|null：执行 + 透镜自证。
    // 全局三重门禁【不】在此跑（设计 §4：仅新 best 时全量校验，candidate 级只靠透镜
    // 自证；终审在 core2 对搜索产物强制兜底，门禁时序后移不改变安全口径）。
    function applyStep(state, lens, cand, direction, label, origSrc){
      var result;
      try{ result = lensMod.applyCandidate(state.ir, lens, cand, deps); }
      catch(e){ return null; }
      var verify = lens.verify || lensMod.mkVerifyDefault(lens, deps);
      var ok = false;
      try{ ok = !!verify(state.ir, cand, result); }catch(e){ ok = false; }
      if(!ok) return null;
      var step = { lens: label || lens.name, candId: cand && cand.id, direction: direction,
                   delta: result.step.delta };
      var trace = state.trace.concat([step]);
      return { ir: result.ir, trace: trace, length: encodeLen(result.ir.src) };
    }

    // invStep(state, aliasName, injectFn, origSrc) -> newState|null：
    // inject 撤销别名 → §9.3 剪枝：仅当撤销后某透镜存在 cost<0 的重提取候选才保留。
    // inject 路由：AliasEnv 条目与源内别名 → alias.injectAlias；
    // 薄包装（local function 形态）→ block.wrap 的 inject（inlineWrapper）。
    var blockLens = null;
    lenses.forEach(function(l){ if(l.name === 'block.wrap') blockLens = l; });
    function injectNamed(ir, name){
      var r = aliasMod.injectAlias(ir, name);
      if(r) return r;
      if(blockLens){ try{ return blockLens.inject(ir, name); }catch(e){ return null; } }
      return null;
    }
    function invStep(state, aliasName, origSrc){
      var inj = injectNamed(state.ir, aliasName);
      if(!inj || !inj.edits) return null;
      var nir;
      try{ nir = irMod.applyEditsToIR(state.ir, inj.edits); }catch(e){ return null; }
      // 剪枝（§9.3）先于等价自证：撤销后须存在更便宜的重提取候选才值得保留——
      // match/cost 全部词法级零 parse，被剪掉的候选连一次 canonical 都不花；
      // 豁免——撤销本身就净缩短（过度提取，纯撤销即收益，无需重提取）。
      var shorterByInject = encodeLen(nir.src) < state.length;
      var hasReextract = shorterByInject;
      for(var li=0; li<lenses.length && !hasReextract; li++){
        var lens = lenses[li];
        if(lens.kind !== 'extract') continue;
        var cands;
        try{ cands = lens.match(nir) || []; }catch(e){ continue; }
        for(var ci=0; ci<cands.length; ci++){
          var d;
          try{ d = lens.cost(nir, cands[ci]).delta; }catch(e){ continue; }
          if(d < 0){ hasReextract = true; break; }
        }
      }
      if(!hasReextract) return null;
      // 撤销后等价自证：双侧各用自身 AliasEnv 还原（canonical2.equivalent，终审同实现）。
      // 源内链别名自 M6 起登记在 AliasEnv（buildIR 时），证据在数据里、无需临时叠图。
      if(!canonMod.equivalent(state.ir.src, nir.src, deps, state.ir, nir, {})) return null;
      var trace = state.trace.concat([{ lens: 'inject:' + aliasName, candId: aliasName,
                                        direction: 'inv', delta: encodeLen(nir.src) - state.length }]);
      return { ir: nir, trace: trace, length: encodeLen(nir.src) };
    }

    // expand(state, origSrc, skip, topN, speculate) -> [newState]：fwd topN + inv 剪枝候选。
    // skip = 该状态【自有】的黑名单（按 keyOf 持久化，跨轮累积）：lens|cand 的失败由
    // (state,cand) 决定论，一次失败永久不再重试；既纠「跨状态误伤」（候选 id 多为
    // 位置键，按轮共享黑名单会错杀其他状态的同名候选），又是 expand 记忆化的前提。
    function expand(state, origSrc, skip, topN, speculate){
      var out = [];
      for(var li=0; li<lenses.length; li++){
        var lens = lenses[li];
        var cands;
        try{ cands = lens.match(state.ir) || []; }catch(e){ continue; }
        var scored = [];
        for(var ci=0; ci<cands.length; ci++){
          var c = cands[ci];
          if(skip.has(lens.name + '|' + c.id)) continue;
          var d;
          try{ d = lens.cost(state.ir, c).delta; }catch(e){ continue; }
          // fwd 闸门：负收益候选全收；另放行有界投机步（d ≤ speculate——组合序列的
          // 中间步可能微亏，如「折叠+合并」），由 beam 按总长度截断收敛。
          if(d < 0 || (lens.commitAtZero && d === 0) || d <= speculate) scored.push({ c: c, d: d });
        }
        scored.sort(function(a,b){ return a.d - b.d; });
        scored.slice(0, topN).forEach(function(sc){
          var ns = applyStep(state, lens, sc.c, 'fwd', null, origSrc);
          if(ns) out.push(ns);
          else skip.add(lens.name + '|' + sc.c.id);   // 自证失败：本分支黑名单（防振荡）
        });
      }
      // inv：AliasEnv 条目 + 源内别名声明 + 薄包装（block.wrap 的逆）。
      // 排序（§9.3 的工程化）：margin<0（过度提取，纯撤销即收益）先行；
      // 其余按 margin 升序——微利折叠的撤销代价最小、最易解锁替代提取。
      // 不设数量上限（实证：编解码#0 的关键 inv 是撤销一个【高 margin 好折叠】
      // 回到 v1 的不折叠形态，上限会把它裁掉造成 +4 回退；parse 成本由
      // 展开记忆化与去重控制，质量优先）。
      var invNames = [];
      state.ir.aliases.entries.forEach(function(_, n){ invNames.push(n); });
      findSourceAliases(state.ir).forEach(function(n){ invNames.push(n); });
      findThinWrappers(state.ir).forEach(function(n){ invNames.push(n); });
      var prio = [], rest = [];
      invNames.forEach(function(n){
        var e = state.ir.aliases.entries.get(n);
        if(!e){ rest.push({ n: n, margin: 0 }); return; }
        var b = null;
        for(var bi=0; bi<state.ir.info.bindings.length; bi++)
          if(state.ir.info.bindings[bi].name === n){ b = state.ir.info.bindings[bi]; break; }
        var k = b ? Math.max(1, b.uses.length) : 1;
        var m = e.target.length + (e.kind === 'string' ? 2 : 0);
        var declCost = e.declRange ? (7 + n.length + m) : (2 + n.length + m);
        var margin = k * (m - n.length) - declCost;
        if(margin < 0) prio.push(n);
        else rest.push({ n: n, margin: margin });
      });
      rest.sort(function(x, y){ return x.margin - y.margin; });
      var invQueue = prio.concat(rest.map(function(x){ return x.n; }));
      invQueue.forEach(function(n){
        if(skip.has('inject|' + n)) return;
        var ns = invStep(state, n, origSrc);
        if(ns) out.push(ns);
        else skip.add('inject|' + n);
      });
      return out;
    }

    // beamSearch(greedyRes, origSrc, opts) -> { ir, trace, length, rounds, expanded }
    // greedyRes = runGreedy 的产物 { ir, trace }；搜索在其上做 fwd+inv 重写图探索。
    // 全局三重门禁按设计 §4 仅对【新 best 候选】执行：beam[0] 刷新 best 前过 gateOk，
    // 失败则黑名单该状态并顺延到下一候选；贪心基线已全量门禁，搜索产物最终还过
    // core2 终审（失败回退贪心）——候选步只凭透镜自证，安全口径不变。
    // opts.onCommit({lens, delta, src, encLen})：可选，每次刷新 best 时回调（UI 阶段用）；
    // opts.onRound({round, expanded})：可选，每轮结束回调（UI 进度用）。默认零开销。
    function beamSearch(greedyRes, origSrc, opts){
      opts = opts || {};
      var K = opts.beamWidth || 4;
      var topN = opts.topN || 3;
      var speculate = (opts.speculate !== undefined) ? opts.speculate : 2;   // 有界投机步上限（字节）
      var maxRounds = opts.maxRounds || 8;
      var onCommit = opts.onCommit || null, onRound = opts.onRound || null;
      var base = { ir: greedyRes.ir, trace: greedyRes.trace, length: encodeLen(greedyRes.ir.src) };
      var seen = new Map();
      seen.set(keyOf(base.ir), base.length);
      var beam = [base], best = base;
      var roundsNoImprove = 0, expanded = 0, rounds = 0;
      // expand 记忆化 + 按状态持久黑名单：状态不可变、expand 决定论——同一状态在束中
      // 存活多轮时只展开一次（实证：御灵术#8 搜索侧 parse 的大头在重复展开）。
      // 键 = 状态【文本】而非 canonicalKey：canonical 归一会把文本不同但归一等价的
      // 状态（如 `3+c` 与 `3+3`）并入同键——seen 去重靠长度正确地保留最短，但
      // expand 记忆若共用该键会把后进状态的展开【替换】为先进状态的展开产物
      // （实证：constFold 链 `1+2+c→3+c→3+3→6` 的搜索在 `3+3` 处被 memo 命中
      // 自己的展开而提前断裂，`6` 永远到不了）。
      var skipByState = new Map(), expandMemo = new Map();
      function expandOf(st){
        var skey = st.ir.src;
        var memo = expandMemo.get(skey);
        if(memo) return memo;
        var skip = skipByState.get(skey);
        if(!skip){ skip = new Set(); skipByState.set(skey, skip); }
        var out = expand(st, origSrc, skip, topN, speculate);
        expandMemo.set(skey, out);
        return out;
      }
      while(roundsNoImprove < 2 && rounds < maxRounds){
        rounds++;
        var pool = [];
        beam.forEach(function(st){
          expandOf(st).forEach(function(ns){
            expanded++;
            var key = keyOf(ns.ir);
            var prevLen = seen.get(key);
            if(prevLen !== undefined && prevLen <= ns.length) return;   // 去重：保留最短
            seen.set(key, ns.length);
            pool.push(ns);
          });
        });
        if(!pool.length) break;
        pool.sort(function(a,b){ return a.length - b.length; });
        beam = pool.slice(0, K);
        // 新 best 遴选：从 beam 头起逐个过全局门禁，首个通过者成为 best；
        // 全不过则本轮无改善（best 保持），门禁失败者进 seen 防重复。
        var newBest = null;
        for(var bi2=0; bi2<beam.length; bi2++){
          if(beam[bi2].length >= best.length) break;
          if(gateOk(beam[bi2].ir, beam[bi2].trace, origSrc)){ newBest = beam[bi2]; break; }
        }
        if(newBest){
          best = newBest;
          roundsNoImprove = 0;
          if(onCommit){
            var lastStep = newBest.trace[newBest.trace.length - 1];
            onCommit({ lens: lastStep ? lastStep.lens : 'search',
                       delta: lastStep ? lastStep.delta : 0,
                       src: newBest.ir.src, encLen: newBest.length });
          }
        }else{
          roundsNoImprove++;
        }
        if(onRound) onRound({ round: rounds, expanded: expanded });
      }
      return { ir: best.ir, trace: best.trace, length: best.length,
               rounds: rounds, expanded: expanded, seenStates: seen.size };
    }

    return { beamSearch: beamSearch };
  }

  var api = { createSearch: createSearch };
  (root.__LuaMin2Parts = root.__LuaMin2Parts || []).push({
    name: 'search2',
    install: function(C){ for(var k in api) C[k] = api[k]; }
  });
  root.__LuaMin2Modules = root.__LuaMin2Modules || {};
  root.__LuaMin2Modules['search2'] = api;
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
