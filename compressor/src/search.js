/* LuaMin part: search — 搜索优化器 v2
 *
 * 规则系统做的是"可静态证明安全"的贪心优化。
 * 搜索层在规则系统输出之上尝试候选变换，用 canonical 严格验证等价。
 *
 * 变换 1：表达式提取
 *   规则系统不提取带函数调用/索引链的重复子表达式（害怕 __index 副作用、
 *   函数调用重复求值）。搜索层尝试提取并用 canonical 验证。
 *
 * 变换 2：激进变量复用
 *   规则系统的 foldReuse 对 SSA 保守判负时回退。搜索层放宽门槛，
 *   用 canonical 做最终裁定。
 *
 * 变换 3：迭代重压缩
 *   每次变换后重新跑规则系统管道，让后续优化（local 合并、多赋值拆分等）
 *   在新结构上生效。
 *
 * 安全兜底：所有候选必须通过 canonical(原始) == canonical(候选) 等价验证。
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
    //  变换 1：表达式提取
    // ================================================================

    function tryExprExtract(bestBody, origPre, best, deadline, maxIters, count, verbose) {
      if (bestBody.length < 40) return null;

      var ast;
      try { ast = parse(bestBody); } catch (e) { return null; }

      // 收集所有表达式节点，跳过太简单的
      var exprs = [];

      var trivialTypes = {
        Identifier: 1, NumericLiteral: 1, StringLiteral: 1,
        BooleanLiteral: 1, NilLiteral: 1, VarargLiteral: 1,
        MemberExpression: 1
      };

      (function walk(node) {
        if (!node || typeof node !== 'object') return;
        if (Array.isArray(node)) {
          for (var i = 0; i < node.length; i++) walk(node[i]);
          return;
        }

        if (node.range && node.range.length === 2 && node.type) {
          var isExpr = node.type.indexOf('Expression') >= 0;
          if (isExpr && !trivialTypes[node.type]) {
            var txt = bestBody.slice(node.range[0], node.range[1]);
            if (txt.length >= 5 && /[a-zA-Z_\)]/.test(txt)) {
              exprs.push({ range: node.range, text: txt });
            }
          }
          if (node.type === 'CallExpression') {
            var ct = bestBody.slice(node.range[0], node.range[1]);
            if (ct.length >= 5) exprs.push({ range: node.range, text: ct });
          }
          // 收集 IndexExpression（obj[key]）- 规则系统不折叠
          if (node.type === 'IndexExpression') {
            var it = bestBody.slice(node.range[0], node.range[1]);
            if (it.length >= 6) exprs.push({ range: node.range, text: it });
          }
        }

        for (var k in node) {
          if (k === 'range' || k === 'loc' || k === 'parent' || k === 'scope') continue;
          if (Object.prototype.hasOwnProperty.call(node, k)) walk(node[k]);
        }
      })(ast.body);

      if (exprs.length < 2) return null;

      // 按文本分组
      var byText = {};
      exprs.forEach(function(e) {
        (byText[e.text] = byText[e.text] || []).push(e);
      });

      // 去重：每个文本保留唯一的 range（避免 AST walk 重复收集）
      var groups = [];
      Object.keys(byText).forEach(function(k) {
        var sites = byText[k];
        var seen = {};
        var unique = [];
        sites.forEach(function(s) {
          var key = s.range[0] + ':' + s.range[1];
          if (!seen[key]) { seen[key] = true; unique.push(s); }
        });
        if (unique.length >= 2) groups.push({ text: k, sites: unique });
      });

      // 按潜在节省排序
      groups.sort(function(a, b) {
        return (a.text.length * a.sites.length) - (b.text.length * b.sites.length);
      });
      groups.reverse();

      var takenNames = collectNames(bestBody);
      var bestResult = null;

      var maxGroups = Math.min(groups.length, 8); // 只试最优的 8 组
      for (var gi = 0; gi < maxGroups; gi++) {
        if (count.v >= maxIters || Date.now() >= deadline) break;

        var g = groups[gi];
        var sites = g.sites;

        if (sites.length < 2) continue;

        // 盈亏计算
        var aliasLen = 1; // 假设单字母别名
        var defCost = 8 + aliasLen + g.text.length; // 'local A=expr '
        var perUse = g.text.length - aliasLen;
        var saving = perUse * sites.length - defCost;
        if (saving <= 0) continue;

        // 分配名字
        var alias = pickUnusedName(bestBody, takenNames);
        if (!alias || alias.length > 1) {
          // 双字母别名重新核算
          if (alias) {
            var cost2 = 8 + 2 + g.text.length;
            var save2 = (g.text.length - 2) * sites.length - cost2;
            if (save2 <= 0) { delete takenNames[alias]; continue; }
          } else {
            continue;
          }
        }

        // 在第一个出现位置前插入声明
        var firstSite = sites[0];
        var decl = 'local ' + alias + '=' + g.text + ' ';

        // 找到合适的插入位置
        var insertInfo = insertDeclBeforeExpr(bestBody, firstSite.range[0], decl);
        var modified = insertInfo.modified;
        var shift = decl.length; // 后续位置需要偏移
        var insertPos = insertInfo.insertPos;

        // 替换所有出现（从后往前，避免位置偏移）
        var edits = [];
        for (var si = 0; si < sites.length; si++) {
          var pos = sites[si].range[0];
          var end = sites[si].range[1];
          if (pos >= insertPos) pos += shift;
          if (end >= insertPos) end += shift;

          // 跳过第一个出现点里与声明重叠的部分
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

        count.v++;

        // 重压缩
        try {
          var cand = compress(modified, SEARCH_COMPRESS_OPTS);
          if (cand && cand.ok && cand.bodyLength < best.bodyLength) {
            var candBody = bodyOf(cand);
            if (canonicalEq(origPre, candBody, cand.aliasMapInfo)) {
              if (verbose) log('expr: "' + g.text.slice(0, 30) + '" x' + sites.length +
                ' saved=' + (best.bodyLength - cand.bodyLength) + ' (was ' + best.bodyLength + ' → ' + cand.bodyLength + ')');
              bestResult = cand;
              break; // 接受第一个成功的改进
            }
          }
        } catch (e) {}

        delete takenNames[alias];
      }

      return bestResult;
    }

    // ================================================================
    //  变换 1b：在原始（未压缩）输入端提取重复表达式
    //  相比变换 1（在已压缩输出端搜索），本变换在压缩前搜索，能发现更长的重复模式。
    //  提取后再跑完整规则系统，让后续优化在新结构上生效。
    // ================================================================

    function tryRawExprExtract(origPre, best, deadline, maxIters, count, verbose) {
      if (origPre.length < 80) return null; // 太短不值得

      // 在原始输入端解析
      var origAst;
      try { origAst = parse(origPre); } catch (e) { return null; }

      // 收集重复出现的表达式（规则系统不处理的大块重复）
      var exprs = [];
      (function walk(node, inCall) {
        if (!node || typeof node !== 'object') return;
        if (Array.isArray(node)) {
          for (var i = 0; i < node.length; i++) walk(node[i], inCall);
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
          if (Object.prototype.hasOwnProperty.call(node, k)) walk(node[k], inCall);
        }
      })(origAst.body, false);

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
        if (count.v >= maxIters || Date.now() >= deadline) break;
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

        count.v++;

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
    //  变换 2：激进变量复用
    // ================================================================

    function tryAggressiveReuse(bestBody, origPre, best, deadline, maxIters, count, verbose) {
      if (bestBody.length < 40) return null;

      var ast;
      try { ast = parse(bestBody); } catch (e) { return null; }
      var info;
      try { info = analyze(ast); } catch (e) { return null; }

      // 收集局部变量（单声明、未被捕获 — 放宽了 foldReuse 的 singleVar 限制）
      var locals = [];
      info.bindings.forEach(function(b) {
        if (b.decls.length !== 1) return; // 多声明跳过
        if (b.pinned) return; // 隐式 self 跳过
        if (!b.decls[0].range) return;
        locals.push({ binding: b, name: b.name, declPos: b.decls[0].range[0], scopeId: b.scope.id, captured: b.captured });
      });

      if (locals.length < 2) return null;

      // 计算每个变量的最后使用位置
      function lastUsePos(b) {
        var last = b.decls[0].range[0];
        b.uses.forEach(function(u) { if (u.range[1] > last) last = u.range[1]; });
        b.decls.forEach(function(d) { if (d.range[1] > last) last = d.range[1]; });
        return last;
      }

      // 在相同作用域内，按声明位置排序
      var byScope = {};
      locals.forEach(function(loc) {
        (byScope[loc.scopeId] = byScope[loc.scopeId] || []).push(loc);
      });

      var bestResult = null;

      Object.keys(byScope).forEach(function(sid) {
        if (bestResult || count.v >= maxIters || Date.now() >= deadline) return;
        var arr = byScope[sid].slice().sort(function(a, b) { return a.declPos - b.declPos; });

        for (var ai = 0; ai < arr.length; ai++) {
          if (bestResult || count.v >= maxIters || Date.now() >= deadline) break;
          var a = arr[ai];

          for (var bi = ai + 1; bi < arr.length; bi++) {
            if (bestResult || count.v >= maxIters || Date.now() >= deadline) break;
            var b = arr[bi];

            if (a.name === b.name) continue;

            // 检查 a 的最后使用是否在 b 的声明之前（非重叠的活跃区间）
            var aLastUse = lastUsePos(a.binding);
            if (aLastUse > b.declPos) continue; // 区间重叠，不可合并

            // 检查 b 的 init 是否引用了 a（如果是，a 活跃区间应延长）
            // analyze 中已通过 varOf 关联，这里简化跳过

            // 计算节省
            // 原名长 → 单字母名：每处引用省 (原名长 - 1)
            var useSaving = 0;
            b.binding.decls.concat(b.binding.uses).forEach(function(u) {
              useSaving += b.name.length - a.name.length;
            });
            // 省一个 local 声明
            useSaving += 6; // 'local '

            if (useSaving <= 0) continue;

            // 构建修改：重命名 b 为 a，删除 b 的 'local '
            var edits = [];

            // 删除 b 声明开头的 'local '
            var bStmt = null;
            // 找到 b 的声明语句
            (function findStmt(stmts) {
              if (bStmt) return;
              for (var i = 0; i < stmts.length; i++) {
                var s = stmts[i];
                if (!s.range) continue;
                if (s.type === 'LocalStatement' && s.variables) {
                  for (var v = 0; v < s.variables.length; v++) {
                    if (s.variables[v] === b.binding.decls[0]) {
                      bStmt = s.multiVar ? s : { type: 'LocalStatement', variables: s.variables, init: s.init, range: s.range, singleVar: s.variables.length === 1 };
                      return;
                    }
                  }
                }
                findStmt(s.body || []);
                if (s.clauses) {
                  for (var c = 0; c < s.clauses.length; c++) findStmt(s.clauses[c].body || []);
                }
              }
            })(ast.body);

            if (!bStmt || !bStmt.range) continue;

            var declStart = bStmt.range[0];
            // 检查 'local ' 前缀
            if (bestBody.slice(declStart, declStart + 6) === 'local ') {
              edits.push({ start: declStart, end: declStart + 6, name: '' }); // 删除 'local '
            } else {
              continue; // 不是标准 local 声明格式
            }

            // 重命名所有 b 的出现
            b.binding.decls.forEach(function(d) {
              edits.push({ start: d.range[0], end: d.range[1], name: a.name });
            });
            b.binding.uses.forEach(function(u) {
              edits.push({ start: u.range[0], end: u.range[1], name: a.name });
            });

            // 应用编辑
            var candidate = bestBody;
            edits.sort(function(x, y) { return y.start - x.start; });
            for (var ei = 0; ei < edits.length; ei++) {
              var ed = edits[ei];
              candidate = candidate.slice(0, ed.start) + ed.name + candidate.slice(ed.end);
            }

            if (!isValid(candidate)) continue;
            if (!canonicalEq(origPre, candidate, null)) continue;

            count.v++;

            // 重压缩
            try {
              var cand = compress(candidate, SEARCH_COMPRESS_OPTS);
              if (cand && cand.ok && cand.bodyLength < best.bodyLength) {
                var candBody = bodyOf(cand);
                if (canonicalEq(origPre, candBody, cand.aliasMapInfo)) {
                  if (verbose) log('reuse: ' + b.name + ' → ' + a.name +
                    ' saved=' + (best.bodyLength - cand.bodyLength) + ' (was ' + best.bodyLength + ' → ' + cand.bodyLength + ')');
                  bestResult = cand;
                  break;
                }
              }
            } catch (e) {}
          }
        }
      });

      return bestResult;
    }

    // ================================================================
    //  变换 3：跨作用域变量复用（更深层的搜索）
    // ================================================================

    function tryCrossScopeReuse(bestBody, origPre, best, deadline, maxIters, count, verbose) {
      if (bestBody.length < 50) return null;

      var ast;
      try { ast = parse(bestBody); } catch (e) { return null; }
      var info;
      try { info = analyze(ast); } catch (e) { return null; }

      // 收集所有顶层局部（scope === topScope）
      var topLocals = [];
      var nestedLocals = [];
      var topScopeId = info.topScope.id;

      info.bindings.forEach(function(b) {
        if (b.decls.length !== 1 || b.pinned) return;
        if (!b.decls[0].range) return;
        var entry = { binding: b, name: b.name, declPos: b.decls[0].range[0], scopeId: b.scope.id };
        if (b.scope.id === topScopeId) {
          topLocals.push(entry);
        } else {
          nestedLocals.push(entry);
        }
      });

      if (!topLocals.length || !nestedLocals.length) return null;

      var bestResult = null;

      // 尝试把嵌套作用域的单次使用局部合并到顶层
      for (var ni = 0; ni < Math.min(nestedLocals.length, 5); ni++) {
        if (bestResult || count.v >= maxIters || Date.now() >= deadline) break;
        var nl = nestedLocals[ni];
        // 只考虑使用次数少（1-2次）的嵌套局部 — 合并收益大
        if (nl.binding.uses.length > 2) continue;

        for (var ti = 0; ti < Math.min(topLocals.length, 5); ti++) {
          if (bestResult || count.v >= maxIters || Date.now() >= deadline) break;
          var tl = topLocals[ti];

          if (nl.name === tl.name) continue;

          // 简单估算：省一次 local 声明 + 若原名更长则省更多
          var saving = 6 + (nl.name.length - tl.name.length) * (nl.binding.uses.length + 1);
          if (saving <= 0) continue;

          // 重命名嵌套局部
          var edits = [];
          nl.binding.decls.forEach(function(d) {
            edits.push({ start: d.range[0], end: d.range[1], name: tl.name });
          });
          nl.binding.uses.forEach(function(u) {
            edits.push({ start: u.range[0], end: u.range[1], name: tl.name });
          });

          var candidate = bestBody;
          edits.sort(function(a, b) { return b.start - a.start; });
          for (var ei = 0; ei < edits.length; ei++) {
            candidate = candidate.slice(0, edits[ei].start) + edits[ei].name + candidate.slice(edits[ei].end);
          }

          if (!isValid(candidate)) continue;
          if (!canonicalEq(origPre, candidate, null)) continue;

          count.v++;

          try {
            var cand = compress(candidate, SEARCH_COMPRESS_OPTS);
            if (cand && cand.ok && cand.bodyLength < best.bodyLength) {
              var candBody = bodyOf(cand);
              if (canonicalEq(origPre, candBody, cand.aliasMapInfo)) {
                if (verbose) log('xreuse: ' + nl.name + ' → ' + tl.name + ' (cross-scope)');
                bestResult = cand;
              }
            }
          } catch (e) {}
        }
      }

      return bestResult;
    }

    // ================================================================
    //  入口
    // ================================================================

    function searchOptimize(input, opts) {
      opts = opts || {};
      var budget = opts.budget >= 0 ? opts.budget : 4000;
      var maxIters = opts.maxIters || 200;
      var verbose = !!opts.verbose;

      if (verbose) log = function(s) { console.log('[search]', s); };
      else log = function(){};

      // 若提供了 onProgress 回调，使用异步分段执行
      if (opts.onProgress){
        return searchOptimizeAsync(input, opts);
      }

      var startTime = Date.now();
      var deadline = startTime + budget;

      // 原始预处理代码 — canonical 等价基准
      var origPre;
      try { origPre = preprocess(input); } catch (e) { return compress(input, opts); }
      if (!/\S/.test(origPre)) return compress(input, opts);

      // 搜索模式使用更宽的阈值列表，探索更多优化空间
      var searchThresholds = [2,3,4,5,6,7,8,9];
      var cOpts = Object.assign({}, opts, {thresholds: searchThresholds});

      // Baseline: 规则系统输出（搜索阈值）
      log('baseline...');
      var best = compress(input, cOpts);
      if (!best || !best.ok) return best;
      log('baseline: ' + best.bodyLength + ' chars');

      var bestBody = bodyOf(best);
      var count = { v: 0 };

      // 阶段 0：原始输入端表达式提取（压缩前，发现更大的重复模式）
      var rawResult = tryRawExprExtract(origPre, best, deadline, maxIters, count, verbose);
      if (rawResult) {
        best = rawResult;
        bestBody = bodyOf(best);
        if (verbose) log('rawExpr: improved to ' + best.bodyLength);
      }

      // 迭代轮次：每次成功改进后重新开始一轮
      var rounds = 0;
      var maxRounds = 4;
      var improved = true;

      while (improved && rounds < maxRounds && Date.now() < deadline) {
        improved = false;
        rounds++;

        // 变换 1：表达式提取（在优化后输出端搜索）
        var newBest = tryExprExtract(bestBody, origPre, best, deadline, maxIters, count, verbose);
        if (newBest) {
          best = newBest;
          bestBody = bodyOf(best);
          improved = true;
          continue; // 重新开始一轮
        }

        // 变换 2：激进变量复用
        newBest = tryAggressiveReuse(bestBody, origPre, best, deadline, maxIters, count, verbose);
        if (newBest) {
          best = newBest;
          bestBody = bodyOf(best);
          improved = true;
          continue;
        }

        // 变换 3：跨作用域复用
        newBest = tryCrossScopeReuse(bestBody, origPre, best, deadline, maxIters, count, verbose);
        if (newBest) {
          best = newBest;
          bestBody = bodyOf(best);
          improved = true;
          continue;
        }
      }

      var elapsed = Date.now() - startTime;
      var origBest = compress(input, opts);
      var saved = origBest.bodyLength - best.bodyLength;
      log('done: ' + elapsed + 'ms, ' + count.v + ' trials, ' + rounds +
        ' rounds, saved ' + saved + ' chars (' + origBest.bodyLength + ' → ' + best.bodyLength + ')');

      return best;
    }

    // 异步版搜索优化器：步骤间双 rAF 让浏览器刷帧
    function searchOptimizeAsync(input, opts){
      var budget = opts.budget >= 0 ? opts.budget : 4000;
      var maxIters = opts.maxIters || 200;
      var onProgress = opts.onProgress;
      var hasRAF = typeof requestAnimationFrame !== 'undefined';
      var startTime = Date.now();
      var deadline = startTime + budget;

      var origPre;
      try { origPre = preprocess(input); } catch (e) { opts._done(compress(input, opts)); return; }
      if (!/\S/.test(origPre)) { opts._done(compress(input, opts)); return; }

      var searchThresholds = [2,3,4,5,6,7,8,9];
      var cOpts = Object.assign({}, opts, {thresholds: searchThresholds});
      var best, bestBody, count = {v:0};
      var maxRounds = 4;
      var stepIdx = 0;

      // 搜索步骤队列
      var steps = [];

      // Step 0: Baseline（异步，显示阶段进度）
      steps.push({name:'基线压缩', fn:function(next){
        var stageName = '';
        cOpts.stageCallback = function(n){ stageName = n; };
        cOpts.onProgress = function(p){
          onProgress({phase:'baseline', current:p.current, total:p.total, threshold:p.threshold, len:p.len, stage:stageName});
        };
        cOpts._done = function(b){
          best = b; bestBody = bodyOf(best);
          cOpts.stageCallback = null;
          cOpts.onProgress = null;
          cOpts._done = null;
          next();
        };
        compress(input, cOpts);
      }});

      // Step 1: 原始端表达式提取
      steps.push({name:'搜索阶段0', fn:function(next){
        onProgress({phase:'search', round:0, step:'扫描重复表达式', len:best.bodyLength});
        yieldStep(function(){
          var rawResult = tryRawExprExtract(origPre, best, deadline, maxIters, count, false);
          if(rawResult){ best = rawResult; bestBody = bodyOf(best); }
          next();
        });
      }});

      // Steps 2+: 迭代轮次，每个变换单独一步，步间双rAF刷帧
      var currentRound = 0;
      var improvedThisRound = false;

      function addRoundSteps(){
        currentRound++;
        if(currentRound > maxRounds || Date.now() >= deadline) return;

        var r = currentRound;
        improvedThisRound = false;

        // 变换 1: 表达式提取
        steps.push({name:'搜索第'+r+'轮·表达式提取', fn:function(next){
          onProgress({phase:'search', round:r, step:'表达式提取', len:best.bodyLength});
          yieldStep(function(){
            var newBest = tryExprExtract(bestBody, origPre, best, deadline, maxIters, count, false);
            if(newBest && newBest.bodyLength < best.bodyLength){
              best = newBest; bestBody = bodyOf(best); improvedThisRound = true;
            }
            next();
          });
        }});

        // 变换 2: 变量复用
        steps.push({name:'搜索第'+r+'轮·变量复用', fn:function(next){
          if(improvedThisRound){ next(); return; }
          onProgress({phase:'search', round:r, step:'变量复用', len:best.bodyLength});
          yieldStep(function(){
            var newBest = tryAggressiveReuse(bestBody, origPre, best, deadline, maxIters, count, false);
            if(newBest && newBest.bodyLength < best.bodyLength){
              best = newBest; bestBody = bodyOf(best); improvedThisRound = true;
            }
            next();
          });
        }});

        // 变换 3: 跨域复用
        steps.push({name:'搜索第'+r+'轮·跨域复用', fn:function(next){
          if(improvedThisRound){ next(); return; }
          onProgress({phase:'search', round:r, step:'跨域复用', len:best.bodyLength});
          yieldStep(function(){
            var newBest = tryCrossScopeReuse(bestBody, origPre, best, deadline, maxIters, count, false);
            if(newBest && newBest.bodyLength < best.bodyLength){
              best = newBest; bestBody = bodyOf(best); improvedThisRound = true;
            }
            next();
          });
        }});

        // 轮次检查点：有改善则追加新一轮（currentRound 不重置，自然递增）
        steps.push({name:'_check', fn:function(next){
          if(improvedThisRound){
            addRoundSteps();
          }
          next();
        }});
      }

      // 初始添加第一轮
      addRoundSteps();

      function yieldStep(fn){
        if(hasRAF){
          requestAnimationFrame(function(){
            requestAnimationFrame(fn);
          });
        } else {
          setTimeout(fn, 0);
        }
      }

      function runStep(){
        if(stepIdx >= steps.length){
          opts._done(best);
          return;
        }
        var step = steps[stepIdx];
        stepIdx++;
        try {
          step.fn(function(){
            yieldStep(runStep);
          });
        } catch(e) {
          if(opts._error) opts._error(e);
          else if(opts._done) opts._done(null);
        }
      }

      yieldStep(runStep);
    }

    C.searchOptimize = searchOptimize;

  }});
})(typeof window !== 'undefined' ? window : globalThis);
