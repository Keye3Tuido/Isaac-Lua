/* LuaMin part: search — 搜索优化器（beam search）
 *
 * 规则系统做的是"可静态证明安全"的贪心优化。
 * 搜索层在其输出之上做 beam search：维护一个候选束（宽 K），每轮从最短的
 * K 个候选出发，套用 MOVES 里所有"变换"，并对一级变换结果再做一层不同变换
 * （两两穿插组合），随后重跑规则系统让后续 pass 在新结构上生效。
 * 所有候选必须通过 canonical(原始) == canonical(候选)，同一等价类只保留最短者。
 *
 * move 集合（unsafe-but-verifiable：规则系统因保守而不敢做的变换）：
 *   - 表达式提取：带调用/索引链的重复子表达式
 *   - 激进变量复用 / 跨作用域复用：放宽规则系统的复用门槛
 * 阶段2/3 从语料挖掘出的新变换追加进 MOVES 即可参与穿插。
 */
(function(root){
  'use strict';
  (root.__LuaMinParts = root.__LuaMinParts || []).push({name:'search', install:function(C){

    var compress = C.compress;
    var parse = C.parse;
    var analyze = C.analyze;
    var canonical = C.canonical;
    var luaValidate = C.luaValidate;
    var preprocess = C.preprocess;
    var lex = C.lex;
    var needSpace = C.needSpace;
    // 抽取类折叠（供 move 使用）：都是"只缩短才提交"的独立变换，返回 {code, aliasMap} 或 null。
    var foldStringLiterals = C.foldStringLiterals;
    var foldStringFactors = C.foldStringFactors;
    var foldBlockWrapper = C.foldBlockWrapper;
    var foldMethods = C.foldMethods;
    var foldFieldPrefix = C.foldFieldPrefix;
    var foldReuse = C.foldReuse;
    var foldDeclHoist = C.foldDeclHoist;

    // 搜索层 compress 选项：使用更宽的阈值列表探索更多优化空间
    var SEARCH_COMPRESS_OPTS = { rename: true, encode: true, method: true, thresholds: [2,3,4,5,6,7,8,9] };

    // ---------- 工具 ----------

    function log(){}

    function bodyOf(report) {
      if (!report || !report.output) return '';
      var o = report.output;
      return o.indexOf('l ') === 0 ? o.slice(2) : o;
    }

    function isValid(code) {
      if (luaValidate) { var e = luaValidate(code); if (e) return false; }
      try { parse(code); return true; } catch (e) { return false; }
    }

    function canonicalEq(orig, cand, aliasMap) {
      try {
        return canonical(orig) === (aliasMap ? canonical(cand, aliasMap) : canonical(cand));
      } catch (e) { return false; }
    }

    // 收集已用名字
    function collectNames(code) {
      var t = {};
      try {
        var toks = lex(code);
        for (var i = 0; i < toks.length; i++) {
          if (toks[i].type === 'Name' || toks[i].type === 'Keyword') t[toks[i].value] = true;
        }
      } catch (e) {}
      return t;
    }

    // 分配一个不与已有名字冲突的短名
    function pickUnusedName(code, takenRef) {
      var taken = takenRef || collectNames(code);
      var pool = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
      for (var i = 0; i < pool.length; i++) {
        if (!taken[pool[i]]) { taken[pool[i]] = true; return pool[i]; }
      }
      for (var i = 0; i < pool.length; i++) {
        for (var j = 0; j < pool.length; j++) {
          var n = pool[i] + pool[j];
          if (!taken[n]) { taken[n] = true; return n; }
        }
      }
      return null;
    }

    // 查找包含某位置的顶层语句
    function findEnclosingStmt(body, pos) {
      var ast;
      try { ast = parse(body); } catch (e) { return null; }
      if (!ast.body) return null;

      function findIn(stmts) {
        if (!stmts) return null;
        for (var i = 0; i < stmts.length; i++) {
          var s = stmts[i];
          if (!s.range) continue;
          if (pos >= s.range[0] && pos < s.range[1]) {
            // 递归进入子语句
            var found = findIn(s.body);
            if (found) return found;
            if (s.clauses) {
              for (var j = 0; j < s.clauses.length; j++) {
                found = findIn(s.clauses[j].body);
                if (found) return found;
              }
            }
            if (s.init) { found = findIn(s.init); if (found) return found; }
            if (s.variables) { found = findIn(s.variables); if (found) return found; }
            return s; // 返回直接包含 pos 的最内层语句
          }
        }
        return null;
      }
      return findIn(ast.body);
    }

    // 在代码中某位置前插入声明，位置调整到语句边界
    function insertDeclBeforeExpr(body, exprStart, decl) {
      // 找直接包含该位置的语句
      var stmt = findEnclosingStmt(body, exprStart);
      if (stmt && stmt.range) {
        var insertPos = stmt.range[0];
        return { modified: body.slice(0, insertPos) + decl + body.slice(insertPos), insertPos: insertPos };
      }
      // 回退：在开头插入
      return { modified: decl + body, insertPos: 0 };
    }

    // ================================================================
    //  原始端表达式提取：在原始（未压缩）输入端提取重复表达式
    //  （压缩前搜索，能发现更长的重复模式；提取后再跑完整规则系统）
    // ================================================================

    function tryRawExprExtract(origPre, best, deadline, verbose) {
      if (origPre.length < 80) return null; // 太短不值得

      // 在原始输入端解析
      var origAst;
      try { origAst = parse(origPre); } catch (e) { return null; }

      // 收集重复出现的表达式（规则系统不处理的大块重复）
      var exprs = [];
      (function walk(node) {
        if (!node || typeof node !== 'object') return;
        if (Array.isArray(node)) {
          for (var i = 0; i < node.length; i++) walk(node[i]);
          return;
        }

        if (node.range && node.range.length === 2 && node.type) {
          // CallExpression：函数调用链，规则系统不折叠整个调用
          if (node.type === 'CallExpression') {
            var ct = origPre.slice(node.range[0], node.range[1]);
            if (ct.length >= 8) exprs.push({ range: node.range, text: ct, type: 'call' });
          }
          // IndexExpression —— obj[key]，规则系统不折叠
          if (node.type === 'IndexExpression') {
            var it = origPre.slice(node.range[0], node.range[1]);
            if (it.length >= 8) exprs.push({ range: node.range, text: it, type: 'index' });
          }
          // 成员链: a.b.c（排除已由规则系统处理的部分）
          if (node.type === 'MemberExpression' &&
              node.base && node.base.type !== 'Identifier') {
            var mt = origPre.slice(node.range[0], node.range[1]);
            if (mt.length >= 10) exprs.push({ range: node.range, text: mt, type: 'chain' });
          }
        }

        for (var k in node) {
          if (k === 'range' || k === 'loc' || k === 'parent' || k === 'scope') continue;
          if (Object.prototype.hasOwnProperty.call(node, k)) walk(node[k]);
        }
      })(origAst.body);

      if (exprs.length < 2) return null;

      // 按文本分组
      var byText = {};
      exprs.forEach(function(e) {
        (byText[e.text] = byText[e.text] || []).push(e);
      });

      var groups = [];
      Object.keys(byText).forEach(function(k) {
        var sites = byText[k];
        var seen = {};
        var unique = [];
        sites.forEach(function(s) {
          var key = s.range[0] + ':' + s.range[1];
          if (!seen[key]) { seen[key] = true; unique.push(s); }
        });
        if (unique.length >= 2) {
          // 盈亏估算
          var textLen = k.length;
          var uses = unique.length;
          var defCost = 8 + 1 + textLen; // 'local A=expr '
          var perUse = textLen - 1; // expr - A
          var saving = perUse * uses - defCost;
          if (saving > 0) groups.push({ text: k, sites: unique, saving: saving });
        }
      });

      if (!groups.length) return null;
      groups.sort(function(a, b) { return b.saving - a.saving; });

      var takenNames = collectNames(origPre);
      var bestResult = null;

      var maxGroups = Math.min(groups.length, 5);
      for (var gi = 0; gi < maxGroups; gi++) {
        if (Date.now() >= deadline) break;   // 仅当显式传了 budget 才受墙钟限制
        var g = groups[gi];

        var alias = pickUnusedName(origPre, takenNames);
        if (!alias) break;
        if (alias.length > 1) { delete takenNames[alias]; continue; }

        var sites = g.sites;
        var firstSite = sites[0];
        var decl = 'local ' + alias + '=' + g.text + ' ';

        // 在第一个出现位置之前插入声明
        var insertInfo = insertDeclBeforeExpr(origPre, firstSite.range[0], decl);
        var modified = insertInfo.modified;
        var shift = decl.length;
        var insertPos = insertInfo.insertPos;

        // 替换所有出现
        var edits = [];
        for (var si = 0; si < sites.length; si++) {
          var pos = sites[si].range[0], end = sites[si].range[1];
          if (pos >= insertPos) pos += shift;
          if (end >= insertPos) end += shift;
          if (si === 0 && pos >= insertPos && pos < insertPos + decl.length) continue;
          edits.push({ pos: pos, ins: alias, delLen: end - pos });
        }

        edits.sort(function(a, b) { return b.pos - a.pos; });
        for (var ei = 0; ei < edits.length; ei++) {
          var ed = edits[ei];
          modified = modified.slice(0, ed.pos) + ed.ins + modified.slice(ed.pos + ed.delLen);
        }

        if (!isValid(modified)) { delete takenNames[alias]; continue; }
        if (!canonicalEq(origPre, modified, null)) { delete takenNames[alias]; continue; }

        // 跑完整规则系统
        try {
          var cand = compress(modified, SEARCH_COMPRESS_OPTS);
          if (cand && cand.ok && cand.bodyLength < best.bodyLength) {
            var candBody = bodyOf(cand);
            if (canonicalEq(origPre, candBody, cand.aliasMapInfo)) {
              if (verbose) log('rawExpr: "' + g.text.slice(0, 30) + '" x' + sites.length +
                ' saved=' + (best.bodyLength - cand.bodyLength));
              bestResult = cand;
              break;
            }
          }
        } catch (e) {}

        delete takenNames[alias];
      }

      return bestResult;
    }


    // ================================================================
    //  生成器（供 beam search 分支）：返回"已应用变换、尚未重压缩"的候选正文列表
    // ================================================================

    function genExprExtract(bestBody, origPre, maxCand) {
      if (bestBody.length < 40) return [];
      var ast; try { ast = parse(bestBody); } catch (e) { return []; }
      var exprs = [];
      var trivialTypes = { Identifier:1, NumericLiteral:1, StringLiteral:1, BooleanLiteral:1, NilLiteral:1, VarargLiteral:1, MemberExpression:1 };
      (function walk(node){
        if(!node||typeof node!=='object') return;
        if(Array.isArray(node)){ for(var i=0;i<node.length;i++) walk(node[i]); return; }
        if(node.range && node.range.length===2 && node.type){
          var isExpr = node.type.indexOf('Expression')>=0;
          if(isExpr && !trivialTypes[node.type]){
            var txt = bestBody.slice(node.range[0], node.range[1]);
            if(txt.length>=5 && /[a-zA-Z_\)]/.test(txt)) exprs.push({range:node.range, text:txt});
          }
          if(node.type==='CallExpression'){ var ct=bestBody.slice(node.range[0],node.range[1]); if(ct.length>=5) exprs.push({range:node.range,text:ct}); }
          if(node.type==='IndexExpression'){ var it=bestBody.slice(node.range[0],node.range[1]); if(it.length>=6) exprs.push({range:node.range,text:it}); }
        }
        for(var k in node){ if(k==='range'||k==='loc'||k==='parent'||k==='scope') continue; if(Object.prototype.hasOwnProperty.call(node,k)) walk(node[k]); }
      })(ast.body);
      if(exprs.length<2) return [];
      var byText={};
      exprs.forEach(function(e){ (byText[e.text]=byText[e.text]||[]).push(e); });
      var groups=[];
      Object.keys(byText).forEach(function(k){
        var sites=byText[k], seen={}, unique=[];
        sites.forEach(function(s){ var key=s.range[0]+':'+s.range[1]; if(!seen[key]){ seen[key]=true; unique.push(s); } });
        if(unique.length>=2){
          var saving=(k.length-1)*unique.length-(8+1+k.length);
          if(saving>0) groups.push({text:k, sites:unique});
        }
      });
      if(!groups.length) return [];
      groups.sort(function(a,b){ return (b.text.length*b.sites.length)-(a.text.length*a.sites.length); });
      var takenNames=collectNames(bestBody), results=[];
      var maxGroups=Math.min(groups.length, 6);
      for(var gi=0; gi<maxGroups && results.length<maxCand; gi++){
        var g=groups[gi];
        var alias=pickUnusedName(bestBody, takenNames);
        if(!alias || alias.length>1){ if(alias) delete takenNames[alias]; continue; }
        var firstSite=g.sites[0];
        var decl='local '+alias+'='+g.text+' ';
        var insertInfo=insertDeclBeforeExpr(bestBody, firstSite.range[0], decl);
        var modified=insertInfo.modified, shift=decl.length, insertPos=insertInfo.insertPos;
        var edits=[];
        for(var si=0; si<g.sites.length; si++){
          var pos=g.sites[si].range[0], end=g.sites[si].range[1];
          if(pos>=insertPos) pos+=shift;
          if(end>=insertPos) end+=shift;
          if(si===0 && pos>=insertPos && pos<insertPos+decl.length) continue;
          edits.push({pos:pos, ins:alias, delLen:end-pos});
        }
        edits.sort(function(a,b){ return b.pos-a.pos; });
        for(var ei=0; ei<edits.length; ei++){ var ed=edits[ei]; modified=modified.slice(0,ed.pos)+ed.ins+modified.slice(ed.pos+ed.delLen); }
        if(!isValid(modified)){ delete takenNames[alias]; continue; }
        if(!canonicalEq(origPre, modified, null)){ delete takenNames[alias]; continue; }
        results.push(modified);
      }
      return results;
    }

    function genAggressiveReuse(bestBody, origPre, maxCand) {
      if(bestBody.length<40) return [];
      var ast; try{ ast=parse(bestBody); }catch(e){ return []; }
      var info; try{ info=analyze(ast); }catch(e){ return []; }
      var locals=[];
      info.bindings.forEach(function(b){
        if(b.decls.length!==1 || b.pinned || !b.decls[0].range) return;
        locals.push({binding:b, name:b.name, declPos:b.decls[0].range[0], scopeId:b.scope.id});
      });
      if(locals.length<2) return [];
      function lastUsePos(b){
        var last=b.decls[0].range[0];
        b.uses.forEach(function(u){ if(u.range && u.range[1]>last) last=u.range[1]; });
        b.decls.forEach(function(d){ if(d.range && d.range[1]>last) last=d.range[1]; });
        return last;
      }
      var byScope={};
      locals.forEach(function(loc){ (byScope[loc.scopeId]=byScope[loc.scopeId]||[]).push(loc); });
      var results=[];
      Object.keys(byScope).forEach(function(sid){
        if(results.length>=maxCand) return;
        var arr=byScope[sid].slice().sort(function(a,b){ return a.declPos-b.declPos; });
        for(var ai=0; ai<arr.length && results.length<maxCand; ai++){
          var a=arr[ai];
          for(var bi=ai+1; bi<arr.length && results.length<maxCand; bi++){
            var b=arr[bi];
            if(a.name===b.name) continue;
            if(lastUsePos(a.binding) > b.declPos) continue;
            // 找 b 的声明语句，删 'local '
            var bStmt=null;
            (function findStmt(stmts){
              if(bStmt) return;
              for(var i=0;i<stmts.length;i++){
                var s=stmts[i]; if(!s.range) continue;
                if(s.type==='LocalStatement' && s.variables){
                  for(var v=0;v<s.variables.length;v++){
                    if(s.variables[v]===b.binding.decls[0]){ bStmt={type:'LocalStatement',variables:s.variables,init:s.init,range:s.range}; return; }
                  }
                }
                findStmt(s.body||[]);
                if(s.clauses){ for(var c=0;c<s.clauses.length;c++) findStmt(s.clauses[c].body||[]); }
              }
            })(ast.body);
            if(!bStmt || !bStmt.range) continue;
            var declStart=bStmt.range[0];
            if(bestBody.slice(declStart, declStart+6)!=='local ') continue;
            var edits=[{start:declStart, end:declStart+6, name:''}];
            b.binding.decls.forEach(function(d){ edits.push({start:d.range[0], end:d.range[1], name:a.name}); });
            b.binding.uses.forEach(function(u){ edits.push({start:u.range[0], end:u.range[1], name:a.name}); });
            edits.sort(function(x,y){ return y.start-x.start; });
            var candidate=bestBody;
            for(var ei=0; ei<edits.length; ei++){ var ed=edits[ei]; candidate=candidate.slice(0,ed.start)+ed.name+candidate.slice(ed.end); }
            if(candidate.length>=bestBody.length || !isValid(candidate)) continue;
            if(!canonicalEq(origPre, candidate, null)) continue;
            results.push(candidate);
          }
        }
      });
      return results;
    }

    function genCrossScopeReuse(bestBody, origPre, maxCand) {
      var ast; try{ ast=parse(bestBody); }catch(e){ return []; }
      var info; try{ info=analyze(ast); }catch(e){ return []; }
      var stmtOfDecl=new Map();
      (function collectStatements(node){
        if(!node||typeof node!=='object') return;
        if(Array.isArray(node)){ for(var i=0;i<node.length;i++) collectStatements(node[i]); return; }
        if(node.type==='LocalStatement'&&node.variables){ for(var v=0;v<node.variables.length;v++) stmtOfDecl.set(node.variables[v], node); }
        for(var k in node){ if(k==='range'||k==='loc') continue; if(Object.prototype.hasOwnProperty.call(node,k)) collectStatements(node[k]); }
      })(ast.body);
      var topLocals=[], nestedLocals=[];
      var topScopeId=info.topScope.id;
      info.bindings.forEach(function(b){
        if(b.decls.length!==1||b.pinned||b.captured||b.scope.funcDepth!==0) return;
        if(!b.decls[0].range) return;
        var stmt=stmtOfDecl.get(b.decls[0]);
        var entry={binding:b, name:b.name, declPos:b.decls[0].range[0], scopeId:b.scope.id, stmt:stmt};
        if(b.scope.id===topScopeId) topLocals.push(entry);
        else if(stmt && stmt.variables && stmt.variables.length===1) nestedLocals.push(entry);
      });
      if(!topLocals.length || !nestedLocals.length) return [];
      function lastUsePos(b){ var last=b.decls[0].range[1]; b.uses.forEach(function(u){ if(u.range&&u.range[1]>last) last=u.range[1]; }); return last; }
      var results=[];
      for(var ni=0; ni<nestedLocals.length && results.length<maxCand; ni++){
        var nl=nestedLocals[ni];
        for(var ti=0; ti<topLocals.length && results.length<maxCand; ti++){
          var tl=topLocals[ti];
          if(nl.name===tl.name || lastUsePos(tl.binding)>=nl.declPos) continue;
          if(!nl.stmt || bestBody.slice(nl.stmt.range[0], nl.stmt.range[0]+6)!=='local ') continue;
          var edits=[{start:nl.stmt.range[0], end:nl.stmt.range[0]+6, name:''}];
          nl.binding.decls.concat(nl.binding.uses).forEach(function(n){ edits.push({start:n.range[0], end:n.range[1], name:tl.name}); });
          edits.sort(function(a,b){ return b.start-a.start; });
          var candidate=bestBody;
          for(var ei=0; ei<edits.length; ei++){ candidate=candidate.slice(0,edits[ei].start)+edits[ei].name+candidate.slice(edits[ei].end); }
          if(candidate.length>=bestBody.length || !isValid(candidate)) continue;
          if(!canonicalEq(origPre, candidate, null)) continue;
          results.push(candidate);
        }
      }
      return results;
    }

    // ================================================================
    //  变换（move）注册表 + 基线配置
    // ================================================================

    // move 统一返回 [{code, aliasMap}]：code 是"已应用该变换、尚未重压缩"的候选正文，
    // aliasMap 是该候选的别名映射（供下一个 move 与 canonical 验证使用）。
    // 前三者是搜索层自有的窄变换；后七者是"抽取类"折叠（把它们当可组合 move，beam 即可探索
    // "先A后B vs 先B后A"的不同操作顺序）。
    function wrapFold(fn){
      return function(body, origPre, aliasMap){
        var r = fn(body, aliasMap, null, null, origPre);
        return (r && r.code) ? [{code:r.code, aliasMap:r.aliasMap}] : [];
      };
    }
    function wrapGen(gen){
      return function(body, origPre, aliasMap, maxCand){
        return gen(body, origPre, maxCand).map(function(b){ return {code:b, aliasMap:aliasMap}; });
      };
    }
    var MOVES = [
      { name: 'exprExtract',     cand: 3, apply: wrapGen(genExprExtract) },
      { name: 'aggressiveReuse', cand: 3, apply: wrapGen(genAggressiveReuse) },
      { name: 'crossScopeReuse', cand: 3, apply: wrapGen(genCrossScopeReuse) },
      { name: 'blockWrapper',    cand: 1, apply: wrapFold(function(b,am,s,r,o){ return foldBlockWrapper(b, am, s, r, o, 8); }) },
      { name: 'stringLiterals',  cand: 1, apply: wrapFold(foldStringLiterals) },
      { name: 'stringFactors',   cand: 1, apply: wrapFold(foldStringFactors) },
      { name: 'methods',         cand: 1, apply: wrapFold(foldMethods) },
      { name: 'fieldPrefix',     cand: 1, apply: wrapFold(foldFieldPrefix) },
      { name: 'reuse',           cand: 1, apply: wrapFold(foldReuse) },
      { name: 'declHoist',       cand: 1, apply: wrapFold(foldDeclHoist) }
    ];

    // 基线配置：多个互异起点（不同压缩参数 + 不同 fold 顺序），beam 从中分叉。
    // fold 顺序预设：把最"顺序敏感"的抽取类 fold 前移，探索"先A后B vs 先B后A"。
    var DEFAULT_FOLD_ORDER = ['bracketDot','readonlyInline','constant','constCondition','tableFields','boolNil','numbers','parens','methods','fieldPrefix','callSugar','stringLiterals','stringFactors','blockWrapper','locals','localFunc','splitMultiAssign','ifNot','reuse','declHoist'];
    function reorderFold(moveKey, beforeKey){
      var o = DEFAULT_FOLD_ORDER.slice();
      var mi = o.indexOf(moveKey);
      if(mi>=0){ o.splice(mi,1); var bi=o.indexOf(beforeKey); if(bi>=0) o.splice(bi,0,moveKey); else o.push(moveKey); }
      return o;
    }
    // 主基线（全阈值，彻底）：块包装开/关。
    var BASELINE_PRIMARY = [
      { blockMaxLen: 8 },
      { blockMaxLen: 0 }
    ];
    // 顺序预设（单阈值，便宜）：只探索 fold 顺序，不抢 beam 轮次的预算。
    var BASELINE_ORDER_PRESETS = [
      reorderFold('blockWrapper','callSugar'),
      reorderFold('stringFactors','stringLiterals'),
      reorderFold('blockWrapper','methods'),
      reorderFold('reuse','locals')
    ];

    // ================================================================
    //  入口
    // ================================================================

    function searchOptimize(input, opts) {
      opts = opts || {};
      // 不默认设时间上限：按 K（束宽）+ 收敛（连续两轮无改善）严格限制；仅显式传 budget 才设墙钟 deadline（供测试用）。
      var budget = opts.budget;
      var verbose = !!opts.verbose;
      // 束宽（搜索优化级数）：0 = 禁用；1+ = beam search 的候选束宽度
      var beamWidth = (opts.beamWidth !== undefined) ? opts.beamWidth : 4;
      if (beamWidth <= 0) return compress(input, opts);   // 0 = 禁用搜索，直接用规则系统

      if (verbose) log = function(s) { console.log('[search]', s); };
      else log = function(){};

      // 若提供了 onProgress 回调，使用异步分段执行
      if (opts.onProgress){
        return searchOptimizeAsync(input, opts);
      }

      var startTime = Date.now();
      var deadline = (opts._deadline != null) ? opts._deadline
                   : ((budget != null && budget >= 0) ? (startTime + budget) : Infinity);

      // 原始预处理代码 — canonical 等价基准
      var origPre;
      try { origPre = preprocess(input); } catch (e) { return compress(input, opts); }
      if (!/\S/.test(origPre)) return compress(input, opts);

      // 搜索模式使用更宽的阈值列表，探索更多优化空间
      var searchThresholds = [2,3,4,5,6,7,8,9];
      var cOpts = Object.assign({}, opts, {thresholds: searchThresholds});
      var fastOpts = Object.assign({}, opts, {thresholds: [8]});   // 子分支用单阈值快速重压缩

      log('beam search...');
      var beam = [];        // [{body, result}]
      var seen = {};        // canonical -> true（去重，避免重复探索同一逻辑状态）
      var best = null;

      function addCandidate(result) {
        if (!result || !result.ok) return;
        var body = bodyOf(result);
        var canon, origCanon;
        try { canon = canonical(body, result.aliasMapInfo); origCanon = canonical(origPre); } catch (e) { return; }
        if (canon !== origCanon) return;
        // 同一 canonical（等价类）只保留最短者：更短则加入并更新，否则跳过。
        if (seen[canon] != null && seen[canon] <= result.bodyLength) return;
        seen[canon] = result.bodyLength;
        beam.push({ body: body, result: result });
      }

      // 基线：主基线（全阈值）+ 顺序预设（单阈值，便宜）+ 原始端表达式提取
      for (var bci = 0; bci < BASELINE_PRIMARY.length; bci++) {
        if (Date.now() >= deadline) break;
        try { addCandidate(compress(input, Object.assign({}, cOpts, BASELINE_PRIMARY[bci]))); } catch (e) {}
      }
      for (var bpi = 0; bpi < BASELINE_ORDER_PRESETS.length; bpi++) {
        if (Date.now() >= deadline) break;
        try { addCandidate(compress(input, Object.assign({}, fastOpts, { blockMaxLen: 8, foldOrder: BASELINE_ORDER_PRESETS[bpi] }))); } catch (e) {}
      }
      if (!beam.length) return compress(input, opts);
      try {
        var rawResult = tryRawExprExtract(origPre, beam[0].result, deadline, verbose);
        if (rawResult) addCandidate(rawResult);
      } catch (e) {}

      beam.sort(function(a,b){ return a.result.bodyLength - b.result.bodyLength; });
      best = beam[0].result;
      log('baseline: ' + best.bodyLength + ' chars');

      // ---- Beam search：从当前最短 K 个候选出发，套用全部 move（含两两穿插）→ 重压缩 → 去重 → 再分支 ----
      var K = beamWidth;
      var maxRounds = 6;   // 轮次上限；正常靠"连续两轮无改善"收敛
      var rounds = 0;
      var noImprove = 0;
      while (rounds < maxRounds && Date.now() < deadline) {
        rounds++;
        var prevBestLen = best.bodyLength;
        var frontier = beam.slice(0, K);   // K 控制每轮扩展多少个候选（束宽）
        for (var bi = 0; bi < frontier.length; bi++) {
          var cand = frontier[bi];
          var candAlias = cand.result.aliasMapInfo || null;
          for (var mi = 0; mi < MOVES.length; mi++) {
            var move = MOVES[mi];
            var mods;
            try { mods = move.apply(cand.body, origPre, candAlias, move.cand); } catch (e) { mods = []; }
            for (var xi = 0; xi < mods.length; xi++) {
              if (Date.now() >= deadline) break;
              var mod = mods[xi];
              try { addCandidate(compress(mod.code, fastOpts)); } catch (e) {}
              // 穿插：对一级变换结果再套一层不同 move（组合变换，深度 2）
              for (var m2 = 0; m2 < MOVES.length; m2++) {
                if (m2 === mi) continue;
                var composed;
                try { composed = MOVES[m2].apply(mod.code, origPre, mod.aliasMap, 1); } catch (e) { composed = []; }
                for (var ci = 0; ci < composed.length; ci++) {
                  if (Date.now() >= deadline) break;
                  try { addCandidate(compress(composed[ci].code, fastOpts)); } catch (e) {}
                }
              }
            }
          }
        }
        beam.sort(function(a,b){ return a.result.bodyLength - b.result.bodyLength; });
        if (beam[0].result.bodyLength < best.bodyLength) best = beam[0].result;
        if (best.bodyLength < prevBestLen) noImprove = 0;
        else noImprove++;
        if (noImprove >= 2) break;   // 连续两轮无改善即收敛
      }

      var elapsed = Date.now() - startTime;
      if (verbose) {
        var origBest = compress(input, opts);
        var saved = origBest.bodyLength - best.bodyLength;
        log('done: ' + elapsed + 'ms, ' + beam.length + ' candidates, ' + rounds +
          ' rounds, saved ' + saved + ' chars (' + origBest.bodyLength + ' → ' + best.bodyLength + ')');
      }

      // 统一 originalLength/original 为顶层输入
      best.originalLength = input.length;
      if (origPre != null) best.original = origPre;

      // 幂等固定点：只要输出正文与输入不同，就在结果上继续搜，直到正文不变（严格收敛到最短）。
      if (Date.now() < deadline && bodyOf(best) !== origPre) {
        var deeperOpts = Object.assign({}, opts, {_deadline: deadline});
        var deeper = searchOptimize(bodyOf(best), deeperOpts);
        if (deeper && deeper.ok && deeper.bodyLength < best.bodyLength) {
          deeper.originalLength = input.length;
          if (origPre != null) deeper.original = origPre;
          return deeper;
        }
      }

      return best;
    }

    // 异步版搜索优化器：委托给同步 beam search（浏览器里用 setTimeout 让 UI 先刷一帧）。
    function searchOptimizeAsync(input, opts){
      var onProgress = opts.onProgress;
      var syncOpts = Object.assign({}, opts);
      delete syncOpts.onProgress;
      delete syncOpts._error;
      delete syncOpts._done;
      if (onProgress) onProgress({phase:'search', round:0, step:'beam search', len:0});
      setTimeout(function(){
        var result;
        try { result = searchOptimize(input, syncOpts); }
        catch (e) {
          if (opts._error) opts._error(e);
          else if (opts._done) opts._done(null);
          return;
        }
        if (opts._done) opts._done(result);
      }, 30);
    }

    C.searchOptimize = searchOptimize;

  }});
})(typeof window !== 'undefined' ? window : globalThis);
