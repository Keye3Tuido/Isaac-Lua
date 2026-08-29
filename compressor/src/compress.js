/* LuaMin part: compress — 由 _refactor_split.js 从 core.js 抽取，函数体逐字保留 */
(function(root){
  'use strict';
  (root.__LuaMinParts = root.__LuaMinParts || []).push({name:'compress', install:function(C){
    var luaValidate=C.luaValidate, parse=C.parse, analyze=C.analyze, collectGlobalNames=C.collectGlobalNames, planAll=C.planAll, applyEdits=C.applyEdits, removeComments=C.removeComments, minimizeSpacing=C.minimizeSpacing, assertEquivalent=C.assertEquivalent, assertEquivalentAlias=C.assertEquivalentAlias, assertParses=C.assertParses, preprocess=C.preprocess, foldMethods=C.foldMethods, foldFieldPrefix=C.foldFieldPrefix, foldStringLiterals=C.foldStringLiterals, foldStringFactors=C.foldStringFactors, foldBlockWrapper=C.foldBlockWrapper, foldCallSugar=C.foldCallSugar, splitMultiAssign=C.splitMultiAssign, foldLocals=C.foldLocals, foldReuse=C.foldReuse, foldDeclHoist=C.foldDeclHoist, foldIfNot=C.foldIfNot, foldBracketDot=C.foldBracketDot, foldReadonlyInline=C.foldReadonlyInline, foldConstant=C.foldConstant, foldConstCondition=C.foldConstCondition, foldTableFields=C.foldTableFields, foldBoolNil=C.foldBoolNil, foldNumbers=C.foldNumbers, foldParens=C.foldParens, foldCompareReorder=C.foldCompareReorder, foldLocalFunc=C.foldLocalFunc;
    function compress(input, opts){
      opts = opts || {};
      var doRename = opts.rename !== false;
      var doEncode = opts.encode !== false;
      var doMethod = opts.method !== false;   // :method 折叠（带严格缩短闸门）
      var blockMaxLen = (opts.blockMaxLen !== undefined) ? opts.blockMaxLen : 8;   // 块包装最大块长（0=禁用）

      var pre=preprocess(input);
      if(!/\S/.test(pre)) throw new Error('输入为空（剥离 l/lua 前缀后无内容）');

      // 透明别名消解（elision）与既有的"重复声明删除"等手段在某些形态下互斥：
      // 消解后反而更长（如三条完全相同的声明，保留共享别名 + 去重更优）。遵循全局
      // "只缩短才提交"原则，跑两条流水线（启用/不启用 elision）取更短者。
      // 仅当启用版真的触发了 elision 时才跑第二条，避免无谓的双倍开销。
      // threshold: 全局折叠预筛选阈值，默认 8。多阈值策略会尝试不同值取最短结果。
      // 构建一次压缩流水线。同步/异步执行器共享同一组阶段，避免两套实现漂移。
      function createPipeline(allowElision, threshold, notifyOnRecord){
        var report={ok:false, stages:[], steps:[], build:[], input:input};
        var steps=report.steps;
        var build=report.build;
        var state={
          code:pre,
          ast0:null,
          current:pre,
          renamedCount:0,
          aliasedCount:0,
          elisionUsed:false,
          activeAliasMap:null
        };
        var stages=[];

        function rec(name, beforeLen, afterLen, detail){
          build.push({name:name, before:beforeLen, after:afterLen, delta:afterLen-beforeLen, detail:detail});
          // 保持旧同步 API：直接传 stageCallback 时，回调实际发生的构建记录。
          if(notifyOnRecord && opts.stageCallback) opts.stageCallback(name);
        }
        function addStage(name, enabled, run){
          if(enabled!==false) stages.push({name:name, run:run});
        }

        addStage('准备', true, function(){
          rec('预处理(剥 l/lua 前缀, 合并单段)', input.length, state.code.length, '去掉每行控制台前缀');
          state.ast0=assertParses(state.code, '输入校验', steps);
          report.original=state.code;
          report.rawInput=input;
          state.current=state.code;
          report.stages.push({name:'0-准备(剥 l/lua 前缀)', code:state.code, len:state.code.length});
        });

        addStage('缩短命名', doRename, function(){
          var info=analyze(state.ast0);
          var allGlobals=collectGlobalNames(state.ast0, info);
          var plan=planAll(info, allGlobals, state.ast0, allowElision, threshold);
          state.renamedCount=plan.edits.length;
          state.aliasedCount=Object.keys(plan.aliasByName).length;
          state.elisionUsed=Object.keys(plan.transparentAliases||{}).length>0;

          var body=applyEdits(state.code, plan.edits);
          var declStr='', dropN=0;
          if(plan.declParts.length){
            var dp=plan.declParts[0];
            if(dp.indexOf('@RAW@')===0){ declStr=dp.slice(5); dropN=plan.declDropLeading; }
            else { declStr='local '+plan.declParts.join(','); dropN=1; }
          }
          var afterRename = declStr ? (declStr+' '+body) : body;

          assertParses(afterRename, '阶段1.1/语法', steps);
          var aliasMap = declStr
            ? { byName: plan.aliasByName, memberByLocal: plan.memberByLocal, factorLocals: plan.factorLocals||[], transparentAliases: plan.transparentAliases||{}, prefixFoldByLocal: {}, stringAliasByLocal: {}, dropLeading: dropN }
            : null;
          assertEquivalentAlias(state.code, afterRename, aliasMap, '阶段1.1/等价', steps);
          state.activeAliasMap = aliasMap;
          rec('结构性折叠(局部重命名+全局/成员/仿射)', state.code.length, afterRename.length,
              '重命名/折叠 '+plan.edits.length+' 处引用；全局别名 '+Object.keys(plan.aliasByName).length+' 个，成员别名 '+Object.keys(plan.memberByLocal).length+' 个'+(state.elisionUsed?('；透明别名消解 '+Object.keys(plan.transparentAliases).length+' 个'):''));

          state.current=afterRename;
          report.stages.push({name:'1.1-结构性(重命名+全局折叠)', code:afterRename, len:afterRename.length});
          report.aliasMapInfo = aliasMap;
        });

        addStage('括号转点', doRename, function(){
          var bdRes = foldBracketDot(state.current, state.activeAliasMap, steps, rec, state.code);
          if(bdRes) state.current = bdRes.code;
          report.stages.push({name:'1.1b-括号转点', code:state.current, len:state.current.length});
        });

        addStage('只读内联', doRename, function(){
          var riRes = foldReadonlyInline(state.current, state.activeAliasMap, steps, rec, state.code);
          if(riRes) state.current = riRes.code;
          report.stages.push({name:'1.1c-只读内联', code:state.current, len:state.current.length});
        });

        addStage('常量折叠', doRename, function(){
          var cfRes = foldConstant(state.current, state.activeAliasMap, steps, rec, state.code);
          if(cfRes) state.current = cfRes.code;
          report.stages.push({name:'1.1d-常量折叠', code:state.current, len:state.current.length});
        });

        addStage('常量条件折叠', doRename, function(){
          var ccRes = foldConstCondition(state.current, state.activeAliasMap, steps, rec, state.code);
          if(ccRes) state.current = ccRes.code;
          report.stages.push({name:'1.1d2-常量条件折叠', code:state.current, len:state.current.length});
        });

        addStage('表字段合并', doRename, function(){
          var tfRes = foldTableFields(state.current, state.activeAliasMap, steps, rec, state.code);
          if(tfRes) state.current = tfRes.code;
          report.stages.push({name:'1.1d3-表字段合并', code:state.current, len:state.current.length});
        });

        addStage('布尔别名', doRename, function(){
          var bnRes = foldBoolNil(state.current, state.activeAliasMap, steps, rec, state.code);
          if(bnRes) state.current = bnRes.code;
          report.stages.push({name:'1.1e-布尔别名', code:state.current, len:state.current.length});
        });

        addStage('数字归一', doRename, function(){
          var nmRes = foldNumbers(state.current, state.activeAliasMap, steps, rec, state.code);
          if(nmRes) state.current = nmRes.code;
          report.stages.push({name:'1.1f-数字归一', code:state.current, len:state.current.length});
        });

        addStage('括号消除', doRename, function(){
          var prRes = foldParens(state.current, state.activeAliasMap, steps, rec, state.code);
          if(prRes) state.current = prRes.code;
          report.stages.push({name:'1.1h-括号消除', code:state.current, len:state.current.length});
        });

        addStage('精简方法调用', doMethod, function(){
          var methodRes = foldMethods(state.current, state.activeAliasMap, steps, rec, state.code);
          if(methodRes){
            state.current = methodRes.code;
            state.activeAliasMap = methodRes.aliasMap;
            report.aliasMapInfo = state.activeAliasMap;
          }
          report.stages.push({name:'1.2-method折叠', code:state.current, len:state.current.length});
        });

        addStage('合并字段前缀', doRename, function(){
          var prefixRes = foldFieldPrefix(state.current, state.activeAliasMap, steps, rec, state.code);
          if(prefixRes){
            state.current = prefixRes.code;
            state.activeAliasMap = prefixRes.aliasMap;
            report.aliasMapInfo = state.activeAliasMap;
          }
          report.stages.push({name:'1.3-字段前缀折叠', code:state.current, len:state.current.length});
        });

        addStage('call-sugar', doEncode, function(){
          var sugarRes = foldCallSugar(state.current, state.activeAliasMap, steps, rec, state.code);
          if(sugarRes) state.current = sugarRes.code;
          report.stages.push({name:'1.4-call-sugar', code:state.current, len:state.current.length});
        });

        addStage('复用重复文字', doRename, function(){
          var litRes = foldStringLiterals(state.current, state.activeAliasMap, steps, rec, state.code);
          if(litRes){
            state.current = litRes.code;
            state.activeAliasMap = litRes.aliasMap;
            report.aliasMapInfo = state.activeAliasMap;
          }
          report.stages.push({name:'1.4-字面量内联', code:state.current, len:state.current.length});
        });

        addStage('字符串公共前缀因子', doRename, function(){
          var facRes = foldStringFactors(state.current, state.activeAliasMap, steps, rec, state.code);
          if(facRes){
            state.current = facRes.code;
            state.activeAliasMap = facRes.aliasMap;
            report.aliasMapInfo = state.activeAliasMap;
          }
          report.stages.push({name:'1.4c-字符串前缀因子', code:state.current, len:state.current.length});
        });

        addStage('块包装', doRename, function(){
          var cwRes = foldBlockWrapper(state.current, state.activeAliasMap, steps, rec, state.code, blockMaxLen);
          if(cwRes){
            state.current = cwRes.code;
            state.activeAliasMap = cwRes.aliasMap;
            report.aliasMapInfo = state.activeAliasMap;
          }
          report.stages.push({name:'1.4d-块包装', code:state.current, len:state.current.length});
        });

        addStage('合并声明', doRename, function(){
          var localRes = foldLocals(state.current, state.activeAliasMap, steps, rec, state.code);
          if(localRes) state.current = localRes.code;
          report.stages.push({name:'1.5-local合并', code:state.current, len:state.current.length});
        });

        addStage('local function 合并', doRename, function(){
          var lfRes = foldLocalFunc(state.current, state.activeAliasMap, steps, rec, state.code);
          if(lfRes) state.current = lfRes.code;
          report.stages.push({name:'1.5b-local function 合并', code:state.current, len:state.current.length});
        });

        addStage('拆分赋值', doRename, function(){
          var splitRes = splitMultiAssign(state.current, state.activeAliasMap, steps, rec, state.code);
          if(splitRes) state.current = splitRes.code;
          report.stages.push({name:'1.6-多赋值拆分', code:state.current, len:state.current.length});
        });

        addStage('翻转条件', doRename, function(){
          var ifnotGuard=0;
          while(ifnotGuard++<50){
            var ifnotRes = foldIfNot(state.current, state.activeAliasMap, steps, rec, state.code);
            if(!ifnotRes) break;
            state.current = ifnotRes.code;
          }
          report.stages.push({name:'1.6b-if-not二择', code:state.current, len:state.current.length});
        });

        addStage('共用变量', doRename && opts.reuse!==false, function(){
          var reuseRes = foldReuse(state.current, state.activeAliasMap, steps, rec, state.code);
          if(reuseRes){
            state.current = reuseRes.code;
            var localRes2 = foldLocals(state.current, state.activeAliasMap, steps, rec, state.code);
            if(localRes2){
              state.current = localRes2.code;
              report.stages.push({name:'1.4-local合并(二次)', code:state.current, len:state.current.length});
            }
          }
          report.stages.push({name:'1.7-变量复用', code:state.current, len:state.current.length});
        });

        addStage('前移声明', doRename && opts.reuse!==false, function(){
          var hoistRes = foldDeclHoist(state.current, state.activeAliasMap, steps, rec, state.code);
          if(hoistRes){
            state.current = hoistRes.code;
            report.stages.push({name:'1.7b-声明上提', code:state.current, len:state.current.length});
            var splitRes2 = splitMultiAssign(state.current, state.activeAliasMap, steps, rec, state.code);
            if(splitRes2){
              state.current = splitRes2.code;
              report.stages.push({name:'1.6-多赋值拆分(二次)', code:state.current, len:state.current.length});
            }
          }
          var localRes3 = foldLocals(state.current, state.activeAliasMap, steps, rec, state.code, true);
          if(localRes3){
            state.current = localRes3.code;
            report.stages.push({name:'1.7c-prefix合并', code:state.current, len:state.current.length});
          }
          // 前缀合并后重跑块包装：捕获 prefix 合并后新暴露的重复块
          var bwRes2 = foldBlockWrapper(state.current, state.activeAliasMap, steps, rec, state.code, blockMaxLen);
          if(bwRes2){
            state.current = bwRes2.code;
            report.stages.push({name:'1.7c2-块包装(二次)', code:state.current, len:state.current.length});
          }
        });

        addStage('删除注释', doEncode, function(){
          var beforeRemove=state.current.length;
          state.current=removeComments(state.current);
          assertParses(state.current, '阶段1.8/语法', steps);
          if(state.activeAliasMap) assertEquivalentAlias(state.code, state.current, state.activeAliasMap, '阶段1.8/等价', steps);
          else assertEquivalent(state.code, state.current, '阶段1.8/等价', steps);
          rec('去除注释', beforeRemove, state.current.length, '移除所有注释，保留代码结构');
          report.stages.push({name:'1.8-去除注释', code:state.current, len:state.current.length});
        });

        addStage('删除多余空格', doEncode, function(){
          var beforeMin=state.current.length;
          var afterMinimize=minimizeSpacing(state.current);
          assertParses(afterMinimize, '阶段1.9/语法', steps);
          if(state.activeAliasMap) assertEquivalentAlias(state.code, afterMinimize, state.activeAliasMap, '阶段1.9/等价', steps);
          else assertEquivalent(state.code, afterMinimize, '阶段1.9/等价', steps);
          rec('间隔符最小化+单行', beforeMin, afterMinimize.length, '词法重排，仅在真·Lua 需要处保留空格');
          state.current=afterMinimize;
          report.stages.push({name:'1.9-间隔符最小化', code:afterMinimize, len:afterMinimize.length});
        });

        // 比较重排（后置）：代数恒等式 a OP b ≡ b FLIP(OP) a，无需求值验证；
        // 重排本身等长，靠紧接着的空格消除兑现"贴关键字省 1 字"。
        addStage('比较重排', doRename, function(){
          var crRes = foldCompareReorder(state.current, state.activeAliasMap, steps, rec, state.code);
          if(crRes) state.current = crRes.code;
          report.stages.push({name:'1.10-比较重排', code:state.current, len:state.current.length});
        });

        addStage('删除多余空格(二次)', doEncode, function(){
          var afterMin2=minimizeSpacing(state.current);
          assertParses(afterMin2, '阶段1.10/语法', steps);
          if(state.activeAliasMap) assertEquivalentAlias(state.code, afterMin2, state.activeAliasMap, '阶段1.10/等价', steps);
          else assertEquivalent(state.code, afterMin2, '阶段1.10/等价', steps);
          state.current=afterMin2;
          report.stages.push({name:'1.10-间隔符最小化(二次)', code:afterMin2, len:afterMin2.length});
        });

        function finish(){
          report.ok=true;
          report.output='l '+state.current;
          report.aliasMapInfo=state.activeAliasMap;
          report.bodyLength=state.current.length;
          report.originalLength=input.length;
          report.renamedCount=state.renamedCount;
          report.aliasedCount=state.aliasedCount;
          report.elisionUsed=state.elisionUsed;
          return report;
        }

        return {state:state, report:report, stages:stages, finish:finish};
      }

      function runPipeline(allowElision, threshold){
        var pipeline=createPipeline(allowElision, threshold, true);
        for(var i=0;i<pipeline.stages.length;i++) pipeline.stages[i].run();
        return pipeline.finish();
      }

      // 异步执行器只负责调度；阶段定义与同步执行器完全相同。
      function runPipelineAsync(allowElision, threshold, onDone){
        var pipeline=createPipeline(allowElision, threshold, false);
        var idx=0;
        var hasRAF = typeof requestAnimationFrame !== 'undefined';

        function schedule(fn){
          if(hasRAF){
            requestAnimationFrame(function(){ requestAnimationFrame(fn); });
          } else {
            setTimeout(fn, 0);
          }
        }
        function fail(error){
          onDone(null, error);
        }
        function nextStep(){
          if(idx>=pipeline.stages.length){
            onDone(pipeline.finish(), null);
            return;
          }
          var stage=pipeline.stages[idx++];
          try {
            stage.run();
            if(opts.stageCallback) opts.stageCallback(stage.name);
          } catch(e) {
            fail(e);
            return;
          }
          schedule(nextStep);
        }

        schedule(nextStep);
      }
      // 多阈值取短策略：尝试多个全局折叠预筛选阈值，选择最短结果。
      // 对每个阈值，先跑启用 elision 的流水线；若触发了消解，再跑禁用版对比。
      var thresholds = opts.thresholds || [2,8];
      var bestResult = null;

      // 若提供了 onProgress 回调，使用异步分段执行（setTimeout 让浏览器刷新进度条）
      if(opts.onProgress){
        return compressWithProgress(input, opts, thresholds, runPipelineAsync, doRename);
      }

      for(var ti=0; ti<thresholds.length; ti++){
        var T = thresholds[ti];
        try {
          var repElide = runPipeline(true, T);
          var candidate = repElide;

          if(doRename && repElide.elisionUsed){
            var repPlain = runPipeline(false, T);
            if(repPlain.bodyLength < repElide.bodyLength) candidate = repPlain;
          }

          if(!bestResult || candidate.bodyLength < bestResult.bodyLength){
            bestResult = candidate;
          }
        } catch(e) {
          continue;
        }
      }

      if(!bestResult) throw new Error('所有阈值配置均压缩失败');

      return bestResult;
    }

    // 带进度回调的异步压缩（setTimeout 分段执行，让浏览器刷新进度条）
    function compressWithProgress(input, opts, thresholds, runPipelineAsync, doRename){
      var onProgress = opts.onProgress;
      var bestResult = null;
      var lastError = null;
      var ti = 0;
      var total = thresholds.length;
      var hasRAF = typeof requestAnimationFrame !== 'undefined';

      function schedule(fn){
        if(hasRAF){
          requestAnimationFrame(function(){ requestAnimationFrame(fn); });
        } else {
          setTimeout(fn, 16);
        }
      }
      function runOne(allowElision, T, cb){
        runPipelineAsync(allowElision, T, function(report, error){
          if(error) lastError=error;
          cb(report, error);
        });
      }
      function finishAll(){
        if(!bestResult){
          if(opts._error) opts._error(lastError || new Error('所有阈值配置均压缩失败'));
          return;
        }
        if(opts._done) opts._done(bestResult);
      }
      function tryNext(){
        if(ti >= total){
          finishAll();
          return;
        }

        var T = thresholds[ti];
        runOne(true, T, function(repElide){
          var candidate = repElide;
          if(!repElide){ finishThreshold(T, null); return; }
          if(doRename && repElide.elisionUsed){
            runOne(false, T, function(repPlain){
              if(repPlain && repPlain.bodyLength < repElide.bodyLength) candidate = repPlain;
              finishThreshold(T, candidate);
            });
          } else {
            finishThreshold(T, candidate);
          }
        });
      }
      function finishThreshold(T, candidate){
        if(candidate && (!bestResult || candidate.bodyLength < bestResult.bodyLength)){
          bestResult = candidate;
        }
        onProgress({current: ti+1, total: total, threshold: T, len: bestResult ? bestResult.bodyLength : 0});
        ti++;
        schedule(tryNext);
      }

      schedule(tryNext);
      // 不返回结果；通过 opts._done 回调传递
    }
    C.compress=compress;
  }});
})(typeof window !== 'undefined' ? window : globalThis);
