/* LuaMin part: compress — 由 _refactor_split.js 从 core.js 抽取，函数体逐字保留 */
(function(root){
  'use strict';
  (root.__LuaMinParts = root.__LuaMinParts || []).push({name:'compress', install:function(C){
    var luaValidate=C.luaValidate, parse=C.parse, analyze=C.analyze, collectGlobalNames=C.collectGlobalNames, planAll=C.planAll, applyEdits=C.applyEdits, removeComments=C.removeComments, minimizeSpacing=C.minimizeSpacing, assertEquivalent=C.assertEquivalent, assertEquivalentAlias=C.assertEquivalentAlias, assertParses=C.assertParses, preprocess=C.preprocess, foldMethods=C.foldMethods, foldFieldPrefix=C.foldFieldPrefix, foldStringLiterals=C.foldStringLiterals, foldStringFactors=C.foldStringFactors, foldBlockWrapper=C.foldBlockWrapper, foldCallSugar=C.foldCallSugar, splitMultiAssign=C.splitMultiAssign, foldLocals=C.foldLocals, foldReuse=C.foldReuse, foldDeclHoist=C.foldDeclHoist, foldIfNot=C.foldIfNot, foldBracketDot=C.foldBracketDot, foldReadonlyInline=C.foldReadonlyInline, foldConstant=C.foldConstant, foldConstCondition=C.foldConstCondition, foldConstLoop=C.foldConstLoop, foldEarlyReturn=C.foldEarlyReturn, foldDeMorgan=C.foldDeMorgan, foldTableFields=C.foldTableFields, foldBoolNil=C.foldBoolNil, foldNumbers=C.foldNumbers, foldParens=C.foldParens, foldCompareReorder=C.foldCompareReorder, foldLocalFunc=C.foldLocalFunc, foldMemberChain=C.foldMemberChain, foldTailSymbol=C.foldTailSymbol, foldMethodFactor=C.foldMethodFactor, foldMemberField=C.foldMemberField;
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
      function createPipeline(allowElision, threshold){
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
          var plan=planAll(info, allGlobals, state.ast0, allowElision, threshold, opts.memberFold !== false, !!opts.noMetatable);
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

        // ---- 可重排的 fold 序列 ----
        // 每个 fold 是"只缩短才提交"的独立变换；复合 stage（reuse/declHoist 连带的后置 fold）
        // 暂时作为单个单元参与排序（后续可再原子化）。默认顺序与旧管线逐字一致。
        // opts.foldOrder 传入自定义顺序（搜索层对顺序做 beam 用）。
        var FOLD_DEFS = {};
        FOLD_DEFS.bracketDot = function(){ addStage('括号转点', doRename, function(){
          var bdRes = foldBracketDot(state.current, state.activeAliasMap, steps, rec, state.code);
          if(bdRes) state.current = bdRes.code;
          report.stages.push({name:'1.1b-括号转点', code:state.current, len:state.current.length});
        }); };
        FOLD_DEFS.readonlyInline = function(){ addStage('只读内联', doRename, function(){
          var riRes = foldReadonlyInline(state.current, state.activeAliasMap, steps, rec, state.code);
          if(riRes) state.current = riRes.code;
          report.stages.push({name:'1.1c-只读内联', code:state.current, len:state.current.length});
        }); };
        FOLD_DEFS.memberChain = function(){ addStage('成员链冗余消除', doRename, function(){
          var mcRes = foldMemberChain(state.current, state.activeAliasMap, steps, rec, state.code, opts);
          if(mcRes){
            state.current = mcRes.code;
            state.activeAliasMap = mcRes.aliasMap;
            report.aliasMapInfo = state.activeAliasMap;
          }
          report.stages.push({name:'1.1c2-成员链冗余消除', code:state.current, len:state.current.length});
        }); };
        FOLD_DEFS.memberField = function(){ addStage('成员字段折叠', doRename, function(){
          var mfRes = foldMemberField(state.current, state.activeAliasMap, steps, rec, state.code);
          if(mfRes){
            state.current = mfRes.code;
            state.activeAliasMap = mfRes.aliasMap;
            report.aliasMapInfo = state.activeAliasMap;
          }
          report.stages.push({name:'1.1c4-成员字段折叠', code:state.current, len:state.current.length});
        }); };
        FOLD_DEFS.tailSymbol = function(){ addStage('尾值符号收尾', doRename, function(){
          var tsRes = foldTailSymbol(state.current, state.activeAliasMap, steps, rec, state.code);
          if(tsRes) state.current = tsRes.code;
          report.stages.push({name:'1.7d-尾值符号收尾', code:state.current, len:state.current.length});
        }); };
        FOLD_DEFS.constant = function(){ addStage('常量折叠', doRename, function(){
          var cfRes = foldConstant(state.current, state.activeAliasMap, steps, rec, state.code);
          if(cfRes) state.current = cfRes.code;
          report.stages.push({name:'1.1d-常量折叠', code:state.current, len:state.current.length});
        }); };
        FOLD_DEFS.constCondition = function(){ addStage('常量条件折叠', doRename, function(){
          var ccRes = foldConstCondition(state.current, state.activeAliasMap, steps, rec, state.code);
          if(ccRes) state.current = ccRes.code;
          report.stages.push({name:'1.1d2-常量条件折叠', code:state.current, len:state.current.length});
        }); };
        FOLD_DEFS.constLoop = function(){ addStage('常量循环折叠', doRename, function(){
          var clRes = foldConstLoop(state.current, state.activeAliasMap, steps, rec, state.code);
          if(clRes) state.current = clRes.code;
          report.stages.push({name:'1.1d2b-常量循环折叠', code:state.current, len:state.current.length});
        }); };
        FOLD_DEFS.earlyReturn = function(){ addStage('早返回守卫折叠', doRename, function(){
          var erRes = foldEarlyReturn(state.current, state.activeAliasMap, steps, rec, state.code);
          if(erRes) state.current = erRes.code;
          report.stages.push({name:'1.1d2c-早返回守卫折叠', code:state.current, len:state.current.length});
        }); };
        FOLD_DEFS.deMorgan = function(){ addStage('德摩根折叠', doRename, function(){
          var dmRes = foldDeMorgan(state.current, state.activeAliasMap, steps, rec, state.code);
          if(dmRes) state.current = dmRes.code;
          report.stages.push({name:'1.1d2d-德摩根折叠', code:state.current, len:state.current.length});
        }); };
        FOLD_DEFS.tableFields = function(){ addStage('表字段合并', doRename, function(){
          var tfRes = foldTableFields(state.current, state.activeAliasMap, steps, rec, state.code);
          if(tfRes) state.current = tfRes.code;
          report.stages.push({name:'1.1d3-表字段合并', code:state.current, len:state.current.length});
        }); };
        FOLD_DEFS.boolNil = function(){ addStage('布尔别名', doRename, function(){
          var bnRes = foldBoolNil(state.current, state.activeAliasMap, steps, rec, state.code);
          if(bnRes) state.current = bnRes.code;
          report.stages.push({name:'1.1e-布尔别名', code:state.current, len:state.current.length});
        }); };
        FOLD_DEFS.numbers = function(){ addStage('数字归一', doRename, function(){
          var nmRes = foldNumbers(state.current, state.activeAliasMap, steps, rec, state.code);
          if(nmRes) state.current = nmRes.code;
          report.stages.push({name:'1.1f-数字归一', code:state.current, len:state.current.length});
        }); };
        FOLD_DEFS.parens = function(){ addStage('括号消除', doRename, function(){
          var prRes = foldParens(state.current, state.activeAliasMap, steps, rec, state.code);
          if(prRes) state.current = prRes.code;
          report.stages.push({name:'1.1h-括号消除', code:state.current, len:state.current.length});
        }); };
        FOLD_DEFS.methods = function(){ addStage('精简方法调用', doMethod, function(){
          var methodRes = foldMethods(state.current, state.activeAliasMap, steps, rec, state.code);
          if(methodRes){
            state.current = methodRes.code;
            state.activeAliasMap = methodRes.aliasMap;
            report.aliasMapInfo = state.activeAliasMap;
          }
          report.stages.push({name:'1.2-method折叠', code:state.current, len:state.current.length});
        }); };
        FOLD_DEFS.fieldPrefix = function(){ addStage('合并字段前缀', doRename, function(){
          var prefixRes = foldFieldPrefix(state.current, state.activeAliasMap, steps, rec, state.code);
          if(prefixRes){
            state.current = prefixRes.code;
            state.activeAliasMap = prefixRes.aliasMap;
            report.aliasMapInfo = state.activeAliasMap;
          }
          report.stages.push({name:'1.3-字段前缀折叠', code:state.current, len:state.current.length});
        }); };
        FOLD_DEFS.callSugar = function(){ addStage('call-sugar', doEncode, function(){
          var sugarRes = foldCallSugar(state.current, state.activeAliasMap, steps, rec, state.code);
          if(sugarRes) state.current = sugarRes.code;
          report.stages.push({name:'1.4-call-sugar', code:state.current, len:state.current.length});
        }); };
        FOLD_DEFS.stringLiterals = function(){ addStage('复用重复文字', doRename, function(){
          var litRes = foldStringLiterals(state.current, state.activeAliasMap, steps, rec, state.code);
          if(litRes){
            state.current = litRes.code;
            state.activeAliasMap = litRes.aliasMap;
            report.aliasMapInfo = state.activeAliasMap;
          }
          report.stages.push({name:'1.4-字面量内联', code:state.current, len:state.current.length});
        }); };
        FOLD_DEFS.stringFactors = function(){ addStage('字符串公共前缀因子', doRename, function(){
          var facRes = foldStringFactors(state.current, state.activeAliasMap, steps, rec, state.code);
          if(facRes){
            state.current = facRes.code;
            state.activeAliasMap = facRes.aliasMap;
            report.aliasMapInfo = state.activeAliasMap;
          }
          report.stages.push({name:'1.4c-字符串前缀因子', code:state.current, len:state.current.length});
        }); };
        FOLD_DEFS.methodFactor = function(){ addStage('方法名因子', doRename, function(){
          var mfRes = foldMethodFactor(state.current, state.activeAliasMap, steps, rec, state.code);
          if(mfRes) state.current = mfRes.code;
          report.stages.push({name:'1.4c2-方法名因子', code:state.current, len:state.current.length});
        }); };
        FOLD_DEFS.blockWrapper = function(){ addStage('块包装', doRename, function(){
          var cwRes = foldBlockWrapper(state.current, state.activeAliasMap, steps, rec, state.code, blockMaxLen);
          if(cwRes){
            state.current = cwRes.code;
            state.activeAliasMap = cwRes.aliasMap;
            report.aliasMapInfo = state.activeAliasMap;
          }
          report.stages.push({name:'1.4d-块包装', code:state.current, len:state.current.length});
        }); };
        FOLD_DEFS.locals = function(){ addStage('合并声明', doRename, function(){
          var localRes = foldLocals(state.current, state.activeAliasMap, steps, rec, state.code);
          if(localRes) state.current = localRes.code;
          report.stages.push({name:'1.5-local合并', code:state.current, len:state.current.length});
        }); };
        FOLD_DEFS.localFunc = function(){ addStage('local function 合并', doRename, function(){
          var lfRes = foldLocalFunc(state.current, state.activeAliasMap, steps, rec, state.code);
          if(lfRes) state.current = lfRes.code;
          report.stages.push({name:'1.5b-local function 合并', code:state.current, len:state.current.length});
        }); };
        FOLD_DEFS.splitMultiAssign = function(){ addStage('拆分赋值', doRename, function(){
          var splitRes = splitMultiAssign(state.current, state.activeAliasMap, steps, rec, state.code);
          if(splitRes) state.current = splitRes.code;
          report.stages.push({name:'1.6-多赋值拆分', code:state.current, len:state.current.length});
        }); };
        FOLD_DEFS.ifNot = function(){ addStage('翻转条件', doRename, function(){
          var ifnotGuard=0;
          while(ifnotGuard++<50){
            var ifnotRes = foldIfNot(state.current, state.activeAliasMap, steps, rec, state.code);
            if(!ifnotRes) break;
            state.current = ifnotRes.code;
          }
          report.stages.push({name:'1.6b-if-not二择', code:state.current, len:state.current.length});
        }); };
        FOLD_DEFS.reuse = function(){ addStage('共用变量', doRename && opts.reuse!==false, function(){
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
        }); };
        FOLD_DEFS.declHoist = function(){ addStage('前移声明', doRename && opts.reuse!==false, function(){
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
        }); };

        var DEFAULT_FOLD_ORDER = ['bracketDot','readonlyInline','memberChain','memberField','constant','constCondition','constLoop','earlyReturn','deMorgan','tableFields','boolNil','numbers','parens','methods','fieldPrefix','callSugar','stringLiterals','stringFactors','methodFactor','blockWrapper','locals','localFunc','splitMultiAssign','ifNot','reuse','declHoist','tailSymbol'];
        var foldOrder = (opts.foldOrder && opts.foldOrder.length) ? opts.foldOrder : DEFAULT_FOLD_ORDER;
        for(var _fi=0; _fi<foldOrder.length; _fi++){
          var _fk = foldOrder[_fi];
          if(FOLD_DEFS[_fk]) FOLD_DEFS[_fk]();
        }

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
        var pipeline=createPipeline(allowElision, threshold);
        for(var i=0;i<pipeline.stages.length;i++) pipeline.stages[i].run();
        return pipeline.finish();
      }
      // 多阈值取短：尝试多个全局折叠预筛选阈值，选最短结果；等长平局时取「更少全局别名」的规范形态。
      function pickBest(p){
        var thresholds = opts.thresholds || [2,8];
        var bestResult = null;
        var lastError = null;

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
            } else if(candidate.bodyLength === bestResult.bodyLength){
              // 等长平局：取「更少全局别名」的规范形态，避免 break-even 别名在两种形态间来回翻转。
              var candAlias = candidate.aliasedCount || 0;
              var bestAlias = bestResult.aliasedCount || 0;
              if(candAlias < bestAlias) bestResult = candidate;
            }
          } catch(e) {
            if(!lastError) lastError = e;
            continue;
          }
        }

        if(!bestResult) throw new Error('所有阈值配置均压缩失败' + (lastError ? ('：' + (lastError.message || lastError)) : ''));
        return bestResult;
      }

      // 定点迭代：把输出再压一遍直到稳定。只比较最终输出、不在中间过程做特判——
      // break-even 别名可作为中间跳板存在，最终经「更少别名」规范平局收敛到唯一稳定点。
      var bestResult = pickBest(pre);
      var FP_MAX = 12;
      for(var fp=0; fp<FP_MAX; fp++){
        var nextPre;
        try { nextPre = preprocess(bestResult.output); } catch(e) { break; }
        if(!/\S/.test(nextPre)) break;
        var next;
        try { next = pickBest(nextPre); } catch(e) { break; }
        if(next.bodyLength < bestResult.bodyLength){
          bestResult = next;                        // 还能更短，继续迭代
        } else if(next.bodyLength === bestResult.bodyLength){
          if(next.output !== bestResult.output && (next.aliasedCount || 0) < (bestResult.aliasedCount || 0)){
            bestResult = next;                      // 等长但别名更少：取更规范形态，再确认一次
            continue;
          }
          break;                                    // 等长且形态已最规范 → 收敛
        } else {
          break;                                    // 变长 → 已是最短
        }
      }

      // 最终兜底：压缩结果比「单行化的输入」更长（严格负收益）时，返回单行化的原始裸代码。
      // 基准用 minimizeSpacing(pre)（去换行/去前缀后同口径），否则多行输入会保留换行、输出两行。
      var minPre;
      try { minPre = minimizeSpacing(pre); } catch(e) { minPre = pre; }
      if(bestResult.bodyLength > minPre.length){
        return {
          ok:true,
          output:'l '+minPre,
          bodyLength:minPre.length,
          originalLength:input.length,
          codeLength:minPre.length,
          rawInput:input,
          original:minPre,
          aliasMapInfo:null,
          stages:[{name:'0-准备(剥 l/lua 前缀)', code:minPre, len:minPre.length}],
          steps:[], build:[],
          renamedCount:0, aliasedCount:0, elisionUsed:false
        };
      }
      bestResult.codeLength = minPre.length;

      return bestResult;
    }

    C.compress=compress;
  }});
})(typeof window !== 'undefined' ? window : globalThis);
