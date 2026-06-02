/* LuaMin part: compress — 由 _refactor_split.js 从 core.js 抽取，函数体逐字保留 */
(function(root){
  'use strict';
  (root.__LuaMinParts = root.__LuaMinParts || []).push({name:'compress', install:function(C){
    var luaValidate=C.luaValidate, parse=C.parse, analyze=C.analyze, collectGlobalNames=C.collectGlobalNames, planAll=C.planAll, applyEdits=C.applyEdits, removeComments=C.removeComments, minimizeSpacing=C.minimizeSpacing, assertEquivalent=C.assertEquivalent, assertEquivalentAlias=C.assertEquivalentAlias, assertParses=C.assertParses, preprocess=C.preprocess, foldMethods=C.foldMethods, foldFieldPrefix=C.foldFieldPrefix, foldStringLiterals=C.foldStringLiterals, splitMultiAssign=C.splitMultiAssign, foldLocals=C.foldLocals, foldReuse=C.foldReuse, foldDeclHoist=C.foldDeclHoist, foldIfNot=C.foldIfNot;
    function compress(input, opts){
      opts = opts || {};
      var doRename = opts.rename !== false;
      var doEncode = opts.encode !== false;
      var doMethod = opts.method !== false;   // :method 折叠（带严格缩短闸门）

      var pre=preprocess(input);
      if(!/\S/.test(pre)) throw new Error('输入为空（剥离 l/lua 前缀后无内容）');

      // 透明别名消解（elision）与既有的"重复声明删除"等手段在某些形态下互斥：
      // 消解后反而更长（如三条完全相同的声明，保留共享别名 + 去重更优）。遵循全局
      // "只缩短才提交"原则，跑两条流水线（启用/不启用 elision）取更短者。
      // 仅当启用版真的触发了 elision 时才跑第二条，避免无谓的双倍开销。
      // threshold: 全局折叠预筛选阈值，默认 8。多阈值策略会尝试不同值取最短结果。
      function runPipeline(allowElision, threshold){
        var report={ok:false, stages:[], steps:[], build:[], input:input};
        var steps=report.steps;
        var build=report.build;
        function rec(name, beforeLen, afterLen, detail){
          build.push({name:name, before:beforeLen, after:afterLen, delta:afterLen-beforeLen, detail:detail});
        }
        var code=pre;
        rec('预处理(剥 l/lua 前缀, 合并单段)', input.length, code.length, '去掉每行控制台前缀');

        // 阶段 0：输入语法校验
        assertParses(code, '输入校验', steps);
        var ast0=parse(code);
        report.original=code;

        var current=code;
        var renamedCount=0;
        var aliasedCount=0;
        var elisionUsed=false;
        var activeAliasMap=null;   // 结构阶段产生的别名映射，供后续阶段等价校验沿用

        // 阶段 1.2：结构性（统一规划：局部重命名 + 全局折叠 + 成员折叠 + 仿射因子）
        if(doRename){
          var info=analyze(ast0);
          var allGlobals=collectGlobalNames(ast0, info);
          var plan=planAll(info, allGlobals, ast0, allowElision, threshold);
          renamedCount=plan.edits.length;
          aliasedCount=Object.keys(plan.aliasByName).length;
          elisionUsed=Object.keys(plan.transparentAliases||{}).length>0;

          var body=applyEdits(code, plan.edits);
          var declStr='', dropN=0;
          if(plan.declParts.length){
            var dp=plan.declParts[0];
            if(dp.indexOf('@RAW@')===0){ declStr=dp.slice(5); dropN=plan.declDropLeading; }  // 因子分解：因子数+1 条 local
            else { declStr='local '+plan.declParts.join(','); dropN=1; }    // 普通：一条 local
          }
          var afterRename = declStr ? (declStr+' '+body) : body;

          assertParses(afterRename, '阶段1.1/语法', steps);
          var aliasMap = declStr
            ? { byName: plan.aliasByName, memberByLocal: plan.memberByLocal, factorLocals: plan.factorLocals||[], transparentAliases: plan.transparentAliases||{}, prefixFoldByLocal: {}, stringAliasByLocal: {}, dropLeading: dropN }
            : null;
          assertEquivalentAlias(code, afterRename, aliasMap, '阶段1.1/等价', steps);
          activeAliasMap = aliasMap;
          rec('结构性折叠(局部重命名+全局/成员/仿射)', code.length, afterRename.length,
              '重命名/折叠 '+plan.edits.length+' 处引用；全局别名 '+Object.keys(plan.aliasByName).length+' 个，成员别名 '+Object.keys(plan.memberByLocal).length+' 个'+(elisionUsed?('；透明别名消解 '+Object.keys(plan.transparentAliases).length+' 个'):''));

          current=afterRename;
          report.stages.push({name:'1.1-结构性(重命名+全局折叠)', code:afterRename, len:afterRename.length});
          report.aliasMapInfo = aliasMap; // 供外部独立校验复用真实别名映射
        }

        // 阶段 1.2：:method 折叠（仅 base 为简单变量；严格"只缩短"闸门）
        if(doMethod){
          var methodRes = foldMethods(current, activeAliasMap, steps, rec, code);
          if(methodRes){
            current = methodRes.code;
            activeAliasMap = methodRes.aliasMap;
            report.aliasMapInfo = activeAliasMap;
          }
          report.stages.push({name:'1.2-method折叠', code:current, len:current.length});
        }

        // 阶段 1.3：字段前缀折叠（obj.PREFIX_X 系列共享前缀提取因子；严格"只缩短"闸门）
        if(doRename){
          var prefixRes = foldFieldPrefix(current, activeAliasMap, steps, rec, code);
          if(prefixRes){
            current = prefixRes.code;
            activeAliasMap = prefixRes.aliasMap;
            report.aliasMapInfo = activeAliasMap;
          }
          report.stages.push({name:'1.3-字段前缀折叠', code:current, len:current.length});
        }

        // 阶段 1.4：字符串字面量内联（同字面量重复 ≥2 次 → 提取 local 别名；严格"只缩短"闸门）
        if(doRename){
          var litRes = foldStringLiterals(current, activeAliasMap, steps, rec, code);
          if(litRes){
            current = litRes.code;
            activeAliasMap = litRes.aliasMap;
            report.aliasMapInfo = activeAliasMap;
          }
          report.stages.push({name:'1.4-字面量内联', code:current, len:current.length});
        }

        // 阶段 1.5：local 合并（消除多余 local 关键字；严格"只缩短"闸门）
        if(doRename){
          var localRes = foldLocals(current, activeAliasMap, steps, rec, code);
          if(localRes){
            current = localRes.code;
          }
          report.stages.push({name:'1.5-local合并', code:current, len:current.length});
        }

        // 阶段 1.6：多重赋值拆分（非 local 场景：a,b=B(),C[x] → a=B()b=C[x] 当符号结尾时省间隔符）
        if(doRename){
          var splitRes = splitMultiAssign(current, activeAliasMap, steps, rec, code);
          if(splitRes){
            current = splitRes.code;
          }
          report.stages.push({name:'1.6-多赋值拆分', code:current, len:current.length});
        }

        // 阶段 1.6b：if-not 二择（去 not + 对调分支体）。canonical 的 if-not 归一可严格验证。
        // 重复到不动点：每轮只折当前最外层（applyEdits 跳过嵌套重叠），故对嵌套 if-not 反复跑，
        // 直到不再缩短（foldIfNot 返回 null）；上限保护防意外死循环。
        if(doRename){
          var ifnotGuard=0;
          while(ifnotGuard++<50){
            var ifnotRes = foldIfNot(current, activeAliasMap, steps, rec, code);
            if(!ifnotRes) break;
            current = ifnotRes.code;
          }
          report.stages.push({name:'1.6b-if-not二择', code:current, len:current.length});
        }

        // 阶段 1.7：变量复用（活跃区间不重叠则共享名并省 local；SSA 等价校验 + 缩短闸门）
        // 该变换跨控制流时 SSA 校验可能保守地判负——此时【优雅回退】（放弃复用，不影响其它阶段），
        // 绝不输出未通过校验的代码。
        if(doRename && opts.reuse!==false){
          var reuseRes = foldReuse(current, activeAliasMap, steps, rec, code);
          if(reuseRes){
            current = reuseRes.code;
            var localRes2 = foldLocals(current, activeAliasMap, steps, rec, code);
            if(localRes2){ current = localRes2.code; report.stages.push({name:'1.4-local合并(二次)', code:current, len:current.length}); }
          }
          report.stages.push({name:'1.7-变量复用', code:current, len:current.length});

          // 阶段 1.7b：声明上提（前向 nil 合并）。借助 canonical 的死前向声明归一可严格验证。
          var hoistRes = foldDeclHoist(current, activeAliasMap, steps, rec, code);
          if(hoistRes){
            current = hoistRes.code;
            report.stages.push({name:'1.7b-声明上提', code:current, len:current.length});
            // 上提会把多变量 local 降级为多重赋值（如 A,T=a[c],{}）——再跑一次多赋值拆分，
            // 把符号结尾的尾值贴紧省间隔符（A,T=a[c],{} → A=a[c]T={}）。
            var splitRes2 = splitMultiAssign(current, activeAliasMap, steps, rec, code);
            if(splitRes2){ current = splitRes2.code; report.stages.push({name:'1.6-多赋值拆分(二次)', code:current, len:current.length}); }
          }
        }

        // 阶段 1.1：去除注释（在所有重命名完成后执行，避免位置偏移）
        if(doEncode){
          var beforeRemove=current.length;
          current=removeComments(current);
          assertParses(current, '阶段1.8/语法', steps);
          // 去除注释不改变标识符：沿用 activeAliasMap 与原始比较
          if(activeAliasMap) assertEquivalentAlias(code, current, activeAliasMap, '阶段1.8/等价', steps);
          else assertEquivalent(code, current, '阶段1.8/等价', steps);
          rec('去除注释', beforeRemove, current.length, '移除所有注释，保留代码结构');
          report.stages.push({name:'1.8-去除注释', code:current, len:current.length});
        }

        // 阶段 1.9：间隔符最小化 + 单行
        if(doEncode){
          var beforeMin=current.length;
          var afterMinimize=minimizeSpacing(current);
          assertParses(afterMinimize, '阶段1.9/语法', steps);
          // 间隔符最小化不改变标识符：沿用 activeAliasMap 与原始比较
          if(activeAliasMap) assertEquivalentAlias(code, afterMinimize, activeAliasMap, '阶段1.9/等价', steps);
          else assertEquivalent(code, afterMinimize, '阶段1.9/等价', steps);
          rec('间隔符最小化+单行', beforeMin, afterMinimize.length, '词法重排，仅在真·Lua 需要处保留空格');
          current=afterMinimize;
          report.stages.push({name:'1.9-间隔符最小化', code:afterMinimize, len:afterMinimize.length});
        }

        // 阶段 1.10：重复声明删除（后处理：删除值相同的重复 local 声明）
        // 注意：本阶段是正则后处理，在最后一次等价校验【之后】执行，canonical 无法建模
        // "删除重复 local 声明"（会改变 SSA 版本结构）。因此必须自带安全闸门：删除后
        // 用真·Lua 语法校验复核，任何不可解析的结果一律回退到删除前，绝不输出 broken 代码。
        if(doRename){
          var beforeDedup=current.length;
          var localPattern=/local\s+[A-Za-z_][A-Za-z0-9_,]*=(?:(?!local).)+? (?=[A-Z])/g;
          var matches=[];
          var match;
          while((match=localPattern.exec(current))!==null){
            matches.push({text:match[0],start:match.index,end:match.index+match[0].length});
          }
          var seen=new Set();
          var toRemove=[];
          matches.forEach(function(m){
            if(seen.has(m.text)){
              toRemove.push(m);
            }else{
              seen.add(m.text);
            }
          });
          if(toRemove.length>0){
            var preDedup=current;     // 删除前快照，校验/收益不满足时回退
            toRemove.reverse();
            toRemove.forEach(function(m){
              current=current.slice(0,m.start)+current.slice(m.end);
            });
            // 安全闸门：① 真·Lua 可解析（防正则跨语句误删产生 broken 代码）；② 比删除前更短。
            // 任一不满足都回退到删除前快照，保证永不输出未通过校验的代码。
            var dedupValid=true;
            if(luaValidate && luaValidate(current)) dedupValid=false;
            if(dedupValid){ try{ parse(current); }catch(e){ dedupValid=false; } }
            if(dedupValid && current.length<beforeDedup){
              rec('重复声明删除', beforeDedup, current.length, '删除 '+toRemove.length+' 个重复的 local 声明');
              report.stages.push({name:'1.10-重复声明删除', code:current, len:current.length});
            }else{
              current=preDedup;       // 回退（修复：旧版 slice(0,beforeDedup) 会产出残缺代码）
            }
          }
        }

        // 输出：编码层负责单行；若仅重命名则保留换行但仍统一加单一 l 前缀
        var result='l '+current;

        report.ok=true;
        report.output=result;
        report.aliasMapInfo=activeAliasMap;
        report.bodyLength=current.length;       // 不含 'l '
        report.originalLength=input.length;
        report.renamedCount=renamedCount;
        report.aliasedCount=aliasedCount;
        report.elisionUsed=elisionUsed;
        return report;
      }

      // 多阈值取短策略：尝试多个全局折叠预筛选阈值，选择最短结果。
      // 对每个阈值，先跑启用 elision 的流水线；若触发了消解，再跑禁用版对比。
      // 阈值 [2, 8]：激进折叠 vs 保守折叠，覆盖两个极端，数学分析和测试验证最优配置。
      var thresholds = opts.thresholds || [2, 8];
      var bestResult = null;

      for(var ti=0; ti<thresholds.length; ti++){
        var T = thresholds[ti];
        var repElide = runPipeline(true, T);
        var candidate = repElide;

        if(doRename && repElide.elisionUsed){
          var repPlain = runPipeline(false, T);
          if(repPlain.bodyLength < repElide.bodyLength) candidate = repPlain;
        }

        if(!bestResult || candidate.bodyLength < bestResult.bodyLength){
          bestResult = candidate;
        }
      }

      return bestResult;
    }

    C.compress=compress;
  }});
})(typeof window !== 'undefined' ? window : globalThis);
