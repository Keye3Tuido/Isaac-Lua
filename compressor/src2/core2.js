/* ===================================================================
 * LuaMin v2 part: core2 — 工厂与对外 API（M2）
 * LuaMin2.create({luaparse, fengari}) -> { compress, compressOnce, compressAsync }
 * 流水线：preprocess(shared/purecopy) → buildIR → 别名透镜族贪心调度（不动点）
 *        → encode（shared/encode removeComments+minimizeSpacing）→ canonical2 三重终审。
 * 终审不过 => 抛错（视为脚本 bug，拒绝输出）；
 * 压缩结果比单行化输入更长 => 回退单行化原文。
 * compressAsync = compress 的异步镜像（setTimeout 宏任务切片 + recordStages/onProgress
 * UI 钩子），供浏览器页面保持响应；同步路径行为不变。
 * =================================================================== */
(function(root){
  'use strict';

  var irMod, lensMod, schedMod, canonMod, aliasMod, normMod, encMod, hoistMod, chainMod, factorMod, blockMod, searchMod, baseMod;
  if(typeof module !== 'undefined' && module.exports){
    irMod = require('./ir.js');
    lensMod = require('./lens.js');
    schedMod = require('./schedule.js');
    canonMod = require('./canonical2.js');
    aliasMod = require('./lenses/alias.js');
    normMod = require('./lenses/normalize.js');
    encMod = require('./lenses/encode.js');
    hoistMod = require('./lenses/hoist.js');
    chainMod = require('./lenses/chain.js');
    factorMod = require('./lenses/factor.js');
    blockMod = require('./lenses/block.js');
    searchMod = require('./search2.js');
    baseMod = require('./base.js');
  }else if(root.__LuaMin2Modules){
    irMod = root.__LuaMin2Modules['ir'];
    lensMod = root.__LuaMin2Modules['lens'];
    schedMod = root.__LuaMin2Modules['schedule'];
    canonMod = root.__LuaMin2Modules['canonical2'];
    aliasMod = root.__LuaMin2Modules['lenses/alias'];
    normMod = root.__LuaMin2Modules['lenses/normalize'];
    encMod = root.__LuaMin2Modules['lenses/encode'];
    hoistMod = root.__LuaMin2Modules['lenses/hoist'];
    chainMod = root.__LuaMin2Modules['lenses/chain'];
    factorMod = root.__LuaMin2Modules['lenses/factor'];
    blockMod = root.__LuaMin2Modules['lenses/block'];
    searchMod = root.__LuaMin2Modules['search2'];
    baseMod = root.__LuaMin2Modules['base'];
  }

  // create({luaparse, fengari, threshold?}) -> { compress, compressOnce, compressAsync }
  function create(deps){
    deps = deps || {};
    if(!deps.luaparse) throw new Error('LuaMin2.create 需要 luaparse 实例');
    if(!baseMod) throw new Error('core2.js: 需要 src2/base.js 已加载');
    var base = baseMod.create(deps);
    var fullDeps = { luaparse: deps.luaparse, fengari: deps.fengari, base: base,
                     threshold: deps.threshold, noMetatable: !!deps.noMetatable };
    // 透镜注册表：alias → chain/factor → hoist → normalize → encode。
    // 最终顺序由调度器 DAG（provides/requires）推导；注册序仅作同自由度 tiebreak。
    var lenses = aliasMod.createAliasLenses(fullDeps)
      .concat(chainMod.createChainLenses(fullDeps))
      .concat(factorMod.createFactorLenses(fullDeps))
      .concat(hoistMod.createHoistLenses(fullDeps))
      .concat(normMod.createNormalizeLenses(fullDeps))
      .concat(encMod.createEncodeLenses(fullDeps));
    var scheduler = schedMod.createScheduler({ lenses: lenses, deps: fullDeps });
    // 编码管线：base 门面自带 removeComments/minimizeSpacing/applyEncoding
    var encC = base;

    // compress(input, opts) -> { code, bodyLength, trace, report }
    // 多阈值取短（v1 DEFAULT_THRESHOLDS [2,8] 同口径）：全局折叠预筛阈值各跑一遍
    // 完整贪心不动点，取最短结果；opts.thresholds 可覆盖。
    var schedCache = {};
    function schedulerFor(opts){
      var nm = (opts.noMetatable !== undefined) ? !!opts.noMetatable : fullDeps.noMetatable;
      var th = (opts.threshold !== undefined) ? opts.threshold : fullDeps.threshold;
      var mf = opts.memberFold !== false;   // v1 同口径：memberFold=false 关闭成员字段折叠
      var key = (nm ? 'nm' : '') + '|' + th + '|' + (mf ? 'mf' : '');
      if(!schedCache[key]){
        var d = { luaparse: fullDeps.luaparse, fengari: fullDeps.fengari, base: base,
                  threshold: th, noMetatable: nm };
        var ls = aliasMod.createAliasLenses(d)
          .concat(chainMod.createChainLenses(d))
          .concat(factorMod.createFactorLenses(d))
          .concat(blockMod.createBlockLenses(d))
          .concat(hoistMod.createHoistLenses(d))
          .concat(normMod.createNormalizeLenses(d))
          .concat(encMod.createEncodeLenses(d));
        if(!mf) ls = ls.filter(function(l){ return l.name !== 'alias.member'; });
        schedCache[key] = { scheduler: schedMod.createScheduler({ lenses: ls, deps: d }), deps: d, lenses: ls };
      }
      return schedCache[key];
    }
    // compressOnce(input, opts)：单轮 贪心不动点 + beam 搜索 + 终审 + 兜底
    // 尺寸分级（M6 实证）：全量重建 IR + 逐提交全文 canonical 校验在 >12KB 输入上
    // 呈超线性（moses 94KB 分钟级起）。大输入：关 beam 搜索、fixpoint 限 1 轮；
    // 贪心【全局门禁对所有尺寸开启】——实证 urnh/guidepost 类远程文件上逐透镜自证
    // 不足以拦住 canonical 归一缺口方向的 inlinePure 候选，门禁是收敛的必要条件
    // （否决单候选保全管线；代价是大文件更慢，正确性不接受尺寸豁免）。
    var BIG_INPUT = 12000;
    function compressOnce(input, opts){
      opts = opts || {};
      var pre = base._preprocess(input);
      if(!/\S/.test(pre)) throw new Error('输入为空（剥离 l/lua 前缀后无内容）');
      var big = pre.length > BIG_INPUT;

      // 多阈值取短：每个阈值配置独立跑完整不动点（终审在各配置内完成）
      var thresholds = opts.thresholds || [2, 8];
      var best = null, lastErr = null;
      for(var ti=0; ti<thresholds.length; ti++){
        try{
          var cfg = schedulerFor({ noMetatable: opts.noMetatable, memberFold: opts.memberFold,
                                   threshold: thresholds[ti] });
          var ir0 = irMod.buildIR(pre, cfg.deps);
          // 全局门禁随调用注入（原文逐次不同）：每个提交态与原文 canonical 比对（§6.5）
          var res = cfg.scheduler.runGreedy(ir0, { src: pre, canon2: canonMod });
          // 终编码：去注释 + 间隔符最小化。分号消除已由 encode.semicolon 透镜在
          // AST 语句边界上完成，此处用 applyEncoding（不再括号栈猜分号，§6.1）。
          var body = encC.applyEncoding(encC.removeComments(res.ir.src));
          // 三重终审（luaparse + fengari + canonical 双侧还原）；
          // 提交过 inlinePure 时终审带其私有归一夹层（规则随透镜下沉，§3/§6.5）
          var pureInline = res.trace.some(function(t){ return t.lens === 'norm.inlinePure'; });
          canonMod.finalReview(pre, body, res.ir, cfg.deps, { pureInline: pureInline });
          if(!best || body.length < best.body.length) best = { body: body, res: res, cfg: cfg, ir0: ir0 };
        }catch(e){ if(!lastErr) lastErr = e; }
      }
      if(!best) throw lastErr || new Error('所有阈值配置均压缩失败');
      var body = best.body, res = best.res, bestCfg = best.cfg, firstIr0 = best.ir0;

      // 双向 beam 搜索（M6，默认开；opts.search===false 关闭）：
      // 在贪心不动点之上做 fwd+inv 重写图探索；仅新 best 时三重终审一次。
      // 搜索产物终审失败【回退贪心结果】（搜索中间态只凭透镜自证，终审是最后防线；
      // 回退保证搜索严格无损——绝不让搜索把已过审的贪心产出变成拒输出）。
      var searchOn = opts.search !== false && !big;
      if(searchOn){
        var searcher = searchMod.createSearch({ deps: bestCfg.deps,
          lenses: bestCfg.lenses, scheduler: bestCfg.scheduler });
        var sres = searcher.beamSearch({ ir: res.ir, trace: res.trace }, pre,
          { beamWidth: opts.beamWidth || 4, topN: opts.topN || 3 });
        if(sres.length < lensMod.encodeDelta('', res.ir.src, bestCfg.deps)){
          var sbody = encC.applyEncoding(encC.removeComments(sres.ir.src));
          var sPure = sres.trace.some(function(t){ return t.lens === 'norm.inlinePure'; });
          // 新 best 的三重终审（一次；失败回退贪心，不抛）
          var sOk = true;
          try{ canonMod.finalReview(pre, sbody, sres.ir, bestCfg.deps, { pureInline: sPure }); }
          catch(e){ sOk = false; }
          if(sOk){
            body = sbody;
            res = { ir: sres.ir, trace: sres.trace };
          }
        }
      }

      // 负收益兜底：比单行化原文更长则回退（同 v1 口径）
      var minPre;
      try{ minPre = encC.minimizeSpacing(pre); }catch(e){ minPre = pre; }
      var outBody = body, fellBack = false;
      if(body.length > minPre.length){ outBody = minPre; fellBack = true; }

      return {
        code: 'l ' + outBody,
        output: 'l ' + outBody,
        body: outBody,
        bodyLength: outBody.length,
        originalLength: input.length,
        trace: res.trace,
        _ir: res.ir,
        _ir0: firstIr0,
        report: {
          ok: true,
          verified: true,   // 三重终审已通过（证据完备口径，强于 harness 重推导）
          fallback: fellBack,
          steps: res.trace.length,
          aliases: res.ir.aliases.entries.size,
          transparent: Object.keys(res.ir.aliases.transparent).length,
          version: res.ir.version,
          aliasMap: canonMod.buildAliasMap(res.ir),   // 全量映射（harness 经 equivalent 差量）
          trace: res.trace
        }
      };
    }

    // compress(input, opts)：定点迭代包装——M6 起压缩是 fixpoint 过程：贪心+搜索的产物
    // 若仍能被同管线再缩短（二遍差异），继续迭代到文本不动点（上限 3 轮，v1 注释的
    // 「整压重跑开销不可接受」在 IR 直改 + 缓存 parse 的 v2 上成立不了，实测语料
    // 绝大多数首轮即收敛）。
    // opts.iterate（迭代收敛）：放开轮数上限（opts.maxIterations 或 20），真正跑到
    // 文本不动点为止——实测存在第 4 轮才收敛的个案（跨透镜产物形态的二次机会）。
    // 迭代口径不受 l/lua 前缀影响：第 2 轮起 cur 恒为上轮 output（'l ' 前缀），
    // preprocess 对输入剥前缀，不动点比较是同口径文本比较。
    function compress(input, opts){
      var iterate = !!(opts && opts.iterate);
      var maxRounds = iterate
        ? ((opts && opts.maxIterations) || 20)
        : ((opts && opts.fixpointRounds)
        || (base._preprocess(input).length > BIG_INPUT ? 1 : 3));
      var cur = input, prev = null, acc = null, origIr0 = null, rounds = 0;
      for(var round=0; round<maxRounds; round++){
        rounds++;
        var r = compressOnce(cur, opts);
        if(!origIr0) origIr0 = r._ir0;   // 首轮输入 IR（原始输入的别名证据）
        if(!acc) acc = r;               // 首轮保底
        if(r.output === cur){ break; }            // 文本不动点：acc 保持为产出该文本的那轮
        if(prev !== null && r.bodyLength >= prev){ break; }   // 无改善：同上
        acc = r;   // 仅在实际改善时替换（aliasMap/trace 始终与 acc.body 同源）
        prev = r.bodyLength;
        cur = r.output;
      }
      // 报告 aliasMap = 最终 IR 的全量还原映射（证据随 IR 跨轮传递，introducedBy
      // 出处保留；等价判定层 equivalent() 负责差量，此处全量携带供 harness 使用）
      if(acc && origIr0){
        acc.report.aliasMap = canonMod.buildAliasMap(acc._ir);
      }
      if(acc) acc.report.iterations = rounds;
      return acc;
    }

    /* ================= 异步路径（UI 支撑；同步 compress/compressOnce 不动） =================
     * compressAsync(input, opts) -> Promise(同 compress 的结果对象)：与同步路径同语义同口径，
     * 额外支持两个可选 opts（均默认关、零开销）：
     *  - opts.recordStages：report.stages = 分组阶段数组 [{name, len, code, phase}]
     *      首项 {name:'输入（剥前缀）', len:pre.length, code:pre}；中间按【连续同 lens 名】
     *      分组合并贪心/搜索提交（组内 >1 条时 name 后缀 ×N；len=组末编码长度，code=组末
     *      IR 文本——未去注释，供 UI 做相邻 diff）；组数超 80 时中间组合并为一条 {name:'…'}；
     *      末项 {name:'编码输出', len:body.length, code:body}。
     *  - opts.onProgress({phase:'greedy'|'search', commits, expanded?, round?, elapsedMs})：
     *      贪心每 20 次提交一次、搜索每轮一次。
     * 调度器与 beamSearch 主体仍是同步循环（签名不动）；切片在 core2 这一层做：阈值循环的
     * 每个 threshold、贪心↔搜索之间、fixpoint 每轮之间各让出一次事件循环（setTimeout
     * 宏任务），页面保持可响应；无 setTimeout 环境退化为直接执行（仍 resolve Promise）。
     */
    var yieldSlice = (typeof setTimeout === 'function')
      ? function(){ return new Promise(function(r){ setTimeout(r, 0); }); }
      : function(){ return Promise.resolve(); };

    // groupStageCommits(commits) -> [{name, len, code, phase}]：连续同 lens 名（且同阶段）合并；
    // >80 组时保留头 40 组与尾 39 组，中间并入一条 {name:'…'}（len/code 取中间末组）。
    function groupStageCommits(commits){
      var raw = [];
      commits.forEach(function(c){
        var last = raw[raw.length - 1];
        if(last && last._lens === c.lens && last.phase === c.phase){
          last._count++; last.len = c.encLen; last.code = c.src;
        }else{
          raw.push({ _lens: c.lens, _count: 1, phase: c.phase, len: c.encLen, code: c.src });
        }
      });
      if(raw.length > 80){
        var lastMid = raw[raw.length - 40];   // 中间区（去掉头 40 尾 39）的末组
        raw = raw.slice(0, 40)
          .concat([{ _lens: '…', _count: 1, phase: lastMid.phase, len: lastMid.len, code: lastMid.code }])
          .concat(raw.slice(raw.length - 39));
      }
      return raw.map(function(g){
        return { name: g._lens + (g._count > 1 ? ' ×' + g._count : ''), len: g.len, code: g.code, phase: g.phase };
      });
    }

    // compressOnceAsync(input, opts)：compressOnce 的异步镜像——逐语句同口径（多阈值取短、
    // 贪心不动点、beam 搜索、三重终审、负收益兜底），差异仅在 UI 钩子与宏任务切片。
    function compressOnceAsync(input, opts){
      opts = opts || {};
      var t0 = Date.now();
      return yieldSlice().then(function(){
        var pre = base._preprocess(input);
        if(!/\S/.test(pre)) throw new Error('输入为空（剥离 l/lua 前缀后无内容）');
        var big = pre.length > BIG_INPUT;
        var thresholds = opts.thresholds || [2, 8];
        var hooksOn = !!(opts.recordStages || opts.onProgress);
        var best = null, lastErr = null;
        var greedyCommits = 0;
        var lastGreedyLens = '';
        var ti = 0;

        function notifyGreedy(){
          if(opts.onProgress) opts.onProgress({ phase: 'greedy', commits: greedyCommits, lens: lastGreedyLens, elapsedMs: Date.now() - t0 });
        }
        function notifySearch(round, expanded, lens){
          if(opts.onProgress) opts.onProgress({ phase: 'search', commits: greedyCommits, round: round,
                                                expanded: expanded, lens: lens || '', elapsedMs: Date.now() - t0 });
        }

        // 多阈值取短：每个阈值配置独立跑完整不动点；每个 threshold 之间让出一次事件循环
        function runThresholds(){
          if(ti >= thresholds.length) return afterThresholds();
          var th = thresholds[ti++];
          try{
            var cfg = schedulerFor({ noMetatable: opts.noMetatable, memberFold: opts.memberFold,
                                     threshold: th });
            var ir0 = irMod.buildIR(pre, cfg.deps);
            var log = [];
            var gate = { src: pre, canon2: canonMod };
            if(hooksOn){
              gate.onCommit = function(c){
                greedyCommits++;
                lastGreedyLens = c.lens;
                if(opts.recordStages) log.push({ lens: c.lens, src: c.src, encLen: c.encLen, phase: 'greedy' });
                if(opts.onProgress && greedyCommits % 20 === 0) notifyGreedy();
              };
            }
            var res = cfg.scheduler.runGreedy(ir0, gate);
            var body = encC.applyEncoding(encC.removeComments(res.ir.src));
            var pureInline = res.trace.some(function(t){ return t.lens === 'norm.inlinePure'; });
            canonMod.finalReview(pre, body, res.ir, cfg.deps, { pureInline: pureInline });
            if(!best || body.length < best.body.length) best = { body: body, res: res, cfg: cfg, ir0: ir0, log: log };
          }catch(e){ if(!lastErr) lastErr = e; }
          notifyGreedy();
          return yieldSlice().then(runThresholds);
        }

        function afterThresholds(){
          if(!best) throw lastErr || new Error('所有阈值配置均压缩失败');
          var body = best.body, res = best.res, bestCfg = best.cfg, firstIr0 = best.ir0;
          var greedyLog = best.log;
          var searchOn = opts.search !== false && !big;
          // 贪心与搜索之间让出一次事件循环
          return yieldSlice().then(function(){
            var searchLog = [];
            if(searchOn){
              notifySearch(0, 0);
              var searcher = searchMod.createSearch({ deps: bestCfg.deps,
                lenses: bestCfg.lenses, scheduler: bestCfg.scheduler });
              var sopts = { beamWidth: opts.beamWidth || 4, topN: opts.topN || 3 };
              if(hooksOn){
                var lastSearchLens = '';
                sopts.onCommit = function(c){
                  lastSearchLens = c.lens;
                  if(opts.recordStages) searchLog.push({ lens: c.lens, src: c.src, encLen: c.encLen, phase: 'search' });
                };
                sopts.onRound = function(r){ notifySearch(r.round, r.expanded, lastSearchLens); };
              }
              var sres = searcher.beamSearch({ ir: res.ir, trace: res.trace }, pre, sopts);
              if(sres.length < lensMod.encodeDelta('', res.ir.src, bestCfg.deps)){
                var sbody = encC.applyEncoding(encC.removeComments(sres.ir.src));
                var sPure = sres.trace.some(function(t){ return t.lens === 'norm.inlinePure'; });
                var sOk = true;
                try{ canonMod.finalReview(pre, sbody, sres.ir, bestCfg.deps, { pureInline: sPure }); }
                catch(e){ sOk = false; }
                if(sOk){
                  body = sbody;
                  res = { ir: sres.ir, trace: sres.trace };
                }else{
                  searchLog = [];   // 搜索产物终审失败回退贪心：搜索阶段不入册
                }
              }else{
                searchLog = [];     // 搜索无改善：不展示搜索阶段
              }
            }

            // 负收益兜底：比单行化原文更长则回退（同 v1 口径）
            var minPre;
            try{ minPre = encC.minimizeSpacing(pre); }catch(e){ minPre = pre; }
            var outBody = body, fellBack = false;
            if(body.length > minPre.length){ outBody = minPre; fellBack = true; }

            var report = {
              ok: true,
              verified: true,   // 三重终审已通过（与同步路径同口径）
              fallback: fellBack,
              steps: res.trace.length,
              aliases: res.ir.aliases.entries.size,
              transparent: Object.keys(res.ir.aliases.transparent).length,
              version: res.ir.version,
              aliasMap: canonMod.buildAliasMap(res.ir),
              trace: res.trace
            };
            if(opts.recordStages){
              var stages = [{ name: '输入（剥前缀）', len: pre.length, code: pre, phase: 'input' }];
              groupStageCommits(greedyLog.concat(searchLog)).forEach(function(g){ stages.push(g); });
              stages.push({ name: '编码输出', len: outBody.length, code: outBody, phase: 'encode' });
              report.stages = stages;
            }
            return {
              code: 'l ' + outBody,
              output: 'l ' + outBody,
              body: outBody,
              bodyLength: outBody.length,
              originalLength: input.length,
              codeLength: minPre.length,   // v1 同口径：剥前缀 + 单行化的输入长（压缩比分母）
              trace: res.trace,
              _ir: res.ir,
              _ir0: firstIr0,
              report: report
            };
          });
        }

        return runThresholds();
      });
    }

    // compressAsync(input, opts) -> Promise：compress 的异步镜像（fixpoint 每轮之间让出事件循环）
    function compressAsync(input, opts){
      opts = opts || {};
      var iterate = !!opts.iterate;
      var maxRounds = iterate
        ? (opts.maxIterations || 20)
        : ((opts && opts.fixpointRounds)
        || (base._preprocess(input).length > BIG_INPUT ? 1 : 3));
      var cur = input, prev = null, acc = null, origIr0 = null;
      var round = 0;
      function loop(){
        if(round >= maxRounds) return done();
        round++;
        return compressOnceAsync(cur, opts).then(function(r){
          if(!origIr0) origIr0 = r._ir0;   // 首轮输入 IR（原始输入的别名证据）
          if(!acc) acc = r;               // 首轮保底
          if(r.output === cur) return done();           // 文本不动点
          if(prev !== null && r.bodyLength >= prev) return done();   // 无改善
          acc = r;
          prev = r.bodyLength;
          cur = r.output;
          // 迭代收敛 UI：每轮实际改善后回调当前最优输出（输入栏不动，输出栏逐轮覆盖；
          // 仅在 acc 被替换时回调——无改善/不动点轮不产生更长中间态，避免输出栏来回闪烁）
          if(opts.onIteration) opts.onIteration({ output: r.output, bodyLength: r.bodyLength, round: round });
          return yieldSlice().then(loop);   // fixpoint 每轮之间让出一次
        });
      }
      function done(){
        if(!acc) return acc;
        if(origIr0){
          acc.report.aliasMap = canonMod.buildAliasMap(acc._ir);
        }
        acc.report.iterations = round;
        // UI 口径修正：originalLength/codeLength 始终相对【原始输入】（多轮 fixpoint 时
        // 各轮 compressOnce 产出的同名字段是相对该轮输入的）
        acc.originalLength = input.length;
        try{
          acc.codeLength = encC.minimizeSpacing(base._preprocess(input)).length;
        }catch(e){
          try{ acc.codeLength = base._preprocess(input).length; }catch(e2){ acc.codeLength = input.length; }
        }
        return acc;
      }
      return loop();
    }

    return { compress: compress, compressOnce: compressOnce, compressAsync: compressAsync, _scheduler: scheduler, _buildIR: function(s){ return irMod.buildIR(s, fullDeps); } };
  }

  var api = { create: create };
  root.LuaMin2 = api;
  (root.__LuaMin2Parts = root.__LuaMin2Parts || []).push({
    name: 'core2',
    install: function(C){ for(var k in api) C[k] = api[k]; }
  });
  root.__LuaMin2Modules = root.__LuaMin2Modules || {};
  root.__LuaMin2Modules['core2'] = api;
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
