/* ===================================================================
 * LuaMin v2 part: schedule — 前置条件 DAG 拓扑 + 不动点 + 互斥分叉（M2）
 * 对应 docs/v2-architecture-plan.md §5：
 *  - provides/requires 建依赖 DAG，Kahn 拓扑排序得默认执行序（FOLD_ORDER_RULES
 *    被推导而非手写）；requires 用精确串匹配 provides（'alias:global' 等）。
 *  - 不动点迭代：任何透镜提交一步后，从"受影响透镜"（requires 命中其 provides，
 *    或 conflicts 相交）的最早位置重新扫描 match。
 *  - 互斥透镜组（lens.mutex 同名）：同组候选分叉各跑一步，取编码后最短的分支。
 * M2 注册表只有别名族，但调度器本身与透镜内容无关（泛型）。
 * =================================================================== */
(function(root){
  'use strict';

  var irMod = null, lensMod = null;
  if(typeof module !== 'undefined' && module.exports){
    irMod = require('./ir.js');
    lensMod = require('./lens.js');
  }else if(root.__LuaMin2Modules){
    irMod = root.__LuaMin2Modules['ir'];
    lensMod = root.__LuaMin2Modules['lens'];
  }
  function needLens(deps){ var m=(deps&&deps.lens)||lensMod; if(!m) throw new Error('schedule.js: 需要 src2/lens.js'); return m; }

  // topoOrder(lenses) -> [Lens]：Kahn 拓扑排序；provides→requires 连边，环则抛错。
  // 同自由度的透镜按注册序稳定 tiebreak（保证输出跨机器确定性）。
  function topoOrder(lenses){
    var n = lenses.length;
    var idxOf = new Map();
    lenses.forEach(function(l, i){ idxOf.set(l.name, i); });
    var indeg = new Array(n).fill(0), adj = lenses.map(function(){ return []; });
    function hits(prov, req){ return prov === req; }   // 精确匹配（M2 无通配需求）
    for(var b=0; b<n; b++){
      (lenses[b].requires || []).forEach(function(req){
        for(var a=0; a<n; a++){
          if(a === b) continue;
          if((lenses[a].provides || []).some(function(p){ return hits(p, req); })){
            adj[a].push(b); indeg[b]++;
          }
        }
      });
    }
    var queue = [];
    for(var i=0; i<n; i++) if(indeg[i] === 0) queue.push(i);
    var out = [];
    while(queue.length){
      queue.sort(function(x,y){ return x-y; });        // 注册序 tiebreak
      var cur = queue.shift();
      out.push(lenses[cur]);
      adj[cur].forEach(function(m){ if(--indeg[m] === 0) queue.push(m); });
    }
    if(out.length !== n) throw new Error('schedule: 透镜依赖成环（provides/requires 存在循环）');
    return out;
  }

  // affectedFrom(lenses, ordered, lens)：提交 lens 一步后需重查的最早下标。
  // （当前 runGreedy 采用保守全量重启 pos=0；此函数供未来增量重查优化使用，
  //  受影响 = requires 命中其 provides，或 conflicts 相交，或它自己。）
  function affectedFrom(ordered, lens){
    var earliest = ordered.indexOf(lens);
    ordered.forEach(function(other, i){
      if(other === lens) return;
      var depHit = (other.requires || []).some(function(r){ return (lens.provides || []).indexOf(r) >= 0; });
      var conflictHit = (other.conflicts || []).some(function(c){ return c === lens.name; })
                     || (lens.conflicts || []).some(function(c){ return c === other.name; });
      if((depHit || conflictHit) && i < earliest) earliest = i;
    });
    return earliest;
  }

  // createScheduler({lenses, deps, maxIters}) -> { runGreedy }
  function createScheduler(opts){
    var L = needLens(opts && opts.deps);
    var lenses = (opts && opts.lenses) || [];
    var deps = (opts && opts.deps) || {};
    // 全局门禁（可选）：opts.globalGate = { src, canon2 }——canon2 为 canonical2 模块
    var globalGate = (opts && opts.globalGate) || null;
    var gateOrigIr = null, gateOrigDone = false;
    function gateOk(nir, trace, lens){
      if(!globalGate) return true;
      var canon2 = globalGate.canon2;
      // 双侧等价（原文侧的源内链别名证据也参与还原；M6 起与终审同一实现）
      if(!gateOrigDone){
        gateOrigDone = true;
        try{ gateOrigIr = nir ? irMod.buildIR(globalGate.src, nir._deps) : null; }catch(e){ gateOrigIr = null; }
      }
      if(gateOrigIr === null) return true;   // 原文本身无法建 IR（不拦）
      var pureInline = (lens && lens.name === 'norm.inlinePure')
        || trace.some(function(t){ return t.lens === 'norm.inlinePure'; });
      return canon2.equivalent(globalGate.src, nir.src, deps, gateOrigIr, nir, { pureInline: pureInline });
    }
    var maxIters = (opts && opts.maxIters) || 0;   // 0 = 按输入规模自适应（见 runGreedy）
    // maxIters 口径：计数含提交与 verify 失败重试。逐候选粒度下大文件（195 局部重命名）
    // 合法地需要数百步；终止性由「提交严格缩短 + skip 黑名单 + 归一透镜形态决定论」保证，
    // 上限只是失控保险丝。
    lenses.forEach(function(l){ L.validateLens(l); });
    var ordered = topoOrder(lenses);

    // pickBest(ir, lens, skip) -> {cand, delta}|null：match → 逐候选 cost → 取 delta 最小者（<0 才有戏）
    function pickBest(ir, lens, skip){
      var cands = lens.match(ir) || [];
      var best = null;
      for(var i=0; i<cands.length; i++){
        var c = cands[i];
        if(skip.has(lens.name + '|' + c.id)) continue;   // verify 失败黑名单（见 runGreedy）
        var delta = lens.cost(ir, c).delta;
        // 只缩短才提交（v1 铁律）；编码归一透镜（commitAtZero，如分号消除）允许等长提交——
        // 其收益是【形态归一】（';'→空格等长），语义等价由 verify 保证，不动点必然收敛
        // （候选由文本形态决定，提交后同位置不再产生候选）。
        if(delta > 0) continue;
        if(delta === 0 && !lens.commitAtZero) continue;
        if(!best || delta < best.delta) best = { cand: c, delta: delta };
      }
      return best;
    }

    // tryCommit(ir, lens, cand, trace) -> newIR|null：执行 + 透镜级自证 + 全局门禁
    // （§6.5：失配仅否决单候选）。globalGate = { src, canon2 } 时，每个提交态还与
    // 【原始输入】做 canonical 双侧还原比对（严格 ↔ 纯代入夹层两口径，任一通过即放行），
    // 失败则否决该候选——防止逐透镜合法的序列落入 canonical 传递性缺口。
    function tryCommit(ir, lens, cand, trace){
      var result;
      try{ result = L.applyCandidate(ir, lens, cand, deps); }
      catch(e){ return null; }   // extract/重建抛错 = 候选非法（如文本形态边界），丢弃不弃权
      var verify = lens.verify || L.mkVerifyDefault(lens, deps);
      var ok = false;
      try{ ok = !!verify(ir, cand, result); }catch(e){ ok = false; }
      if(!ok) return null;
      if(globalGate && !gateOk(result.ir, trace, lens)) return null;
      trace.push(result.step);
      return result.ir;
    }

    // runGreedy(ir, gate) -> { ir, trace }：按拓扑序贪心扫描，提交后整轮重扫，
    // 整轮无提交即不动点。gate = { src } 启用全局门禁（canonical2 经 deps 注入）；
    // gate === null 显式关闭（大输入尺寸分级：逐透镜自证 + 终审承担正确性）。
    // gate.onCommit({lens, delta, src, encLen})：可选，每次提交后回调（UI 阶段/进度用，
    // 默认 undefined 零开销）。
    function runGreedy(ir, gate){
      globalGate = gate ? { src: gate.src, canon2: gate.canon2 || (deps.canon2) } : null;
      gateOrigIr = null; gateOrigDone = false;
      var onCommit = (gate && gate.onCommit) || null;
      var trace = [];
      var skip = new Set();      // 'lens|candId'：verify 失败候选不再重试（候选 id 由文本决定，幂等）
      var iters = 0;
      // 失控保险丝：随输入规模自适应（大文件的合法提交数与透镜位置数成正比，
      // 实证 30log 6KB 需 ~2200、2000 固定上限误判）；振荡守卫按【同候选无进展
      // 重复提交】判定——位置键候选（localsMerge@0:0 等）在不同内容上反复做功
      // 属合法收敛（每次提交源文本严格变短），仅当同 id 连续两次提交源文本不短
      // 于上次才判环（A→B→A 长度震荡）。
      var iterCap = maxIters > 0 ? maxIters : (4000 + Math.floor(ir.src.length / 2));
      var commitSeen = new Map();   // cid -> { len, strikes }
      var encLen = 0;
      try{ encLen = L.encodeDelta('', ir.src, deps); }catch(e){ encLen = ir.src.length; }
      var pos = 0;
      while(pos < ordered.length){
        if(++iters > iterCap) throw new Error('schedule: 不动点迭代超上限（' + iterCap + '），疑似振荡');
        var lens = ordered[pos];
        // 互斥组：收集同组透镜的候选，分叉取最短
        var group = lens.mutex ? ordered.filter(function(o){ return o.mutex === lens.mutex; }) : [lens];
        var branch = null;
        group.forEach(function(g){
          var b = pickBest(ir, g, skip);
          if(b && (!branch || b.delta < branch.delta)) branch = { lens: g, cand: b.cand, delta: b.delta };
        });
        if(!branch){ pos++; continue; }
        var nir = tryCommit(ir, branch.lens, branch.cand, trace);
        if(nir === null){
          skip.add(branch.lens.name + '|' + branch.cand.id);
          continue;                                    // 同位置重选次优候选
        }
        var cid = branch.lens.name + '|' + branch.cand.id;
        // 进展度量用编码长度（提交 delta 精确累计，免重复全文词法）：同 id 连续两次
        // 提交、且本次提交后编码长度不短于该 id 上次提交后 → 判环（A→B→A 等长震荡）；
        // 连续同 id 但步步缩短（funcMerge 连并三个函数这类）属合法收敛。
        var stepDelta = trace[trace.length - 1].delta;
        var newLen = encLen + stepDelta;
        var rec = commitSeen.get(cid);
        if(rec && newLen >= rec.len){
          rec.strikes++;
          if(rec.strikes >= 2) throw new Error('schedule: 候选无进展重复提交，判定振荡（' + cid + '）');
        }else{
          rec = { len: 0, strikes: 0 };
          commitSeen.set(cid, rec);
        }
        encLen = newLen;
        rec.len = newLen;
        ir = nir;
        if(onCommit) onCommit({ lens: branch.lens.name, delta: stepDelta, src: nir.src, encLen: newLen });
        // 不动点：任何提交都使【全部】透镜的 match 失效（IR 已重建）——回到 0 整轮重扫。
        // 终止性：负 delta 提交严格缩短（下界 0）；commitAtZero 归一透镜的候选由文本形态
        // 决定、提交后同位置不再产生候选（见各透镜注释）；iterCap 兜底防振荡。
        pos = 0;
      }
      return { ir: ir, trace: trace };
    }

    return { runGreedy: runGreedy, topoOrder: ordered };
  }

  var api = { createScheduler: createScheduler, topoOrder: topoOrder };
  (root.__LuaMin2Parts = root.__LuaMin2Parts || []).push({
    name: 'schedule',
    install: function(C){ for(var k in api) C[k] = api[k]; }
  });
  root.__LuaMin2Modules = root.__LuaMin2Modules || {};
  root.__LuaMin2Modules['schedule'] = api;
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
