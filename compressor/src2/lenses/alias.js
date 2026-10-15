/* ===================================================================
 * LuaMin v2 lens family: alias — 双向别名透镜族（M2）
 * 移植自 v1 src/plan.js 的统一规划（planAll），按 v2 透镜契约拆为四枚透镜：
 *   alias.global       高频全局折叠（local A=Isaac）        kind=extract
 *   alias.member       成员字段折叠（.Field → [F]）         kind=extract
 *   alias.transparent  透明别名消解（输入自带 local I=Isaac）kind=rewrite
 *   alias.rename       局部变量最短重命名                    kind=rewrite
 *
 * 成本公式逐字沿用 plan.js 注释口径：
 *   全局预筛 (m-1)*k > m+threshold；终闸 (m-L)*k > m+L+1（+1 容忍，见 v1 注释）
 *   成员预筛 (m-2)*k > m+3；      终闸 (m+1)*k > (L+2)*k + (L+m+3)
 * cost() 用候选自身的编辑做文本预演 + encodeDelta，故预测恒等于实测（exact）。
 *
 * inject 方向（injectAlias）对 extract 产物与输入自带别名一视同仁：
 *   识别 `local X=<全局|成员链|字符串>` 声明，把使用代回原形、删除声明项——
 *   过度提取的撤销通道（M6 的 inv 步也复用它）。
 *
 * 安全前置全部为声明式 requires（证据谓词经 IR.getEvidence 惰性求值）：
 *   ssa（只读判定=版本数）、localBudget（Lua 5.3 单函数 200 局部上限）。
 * =================================================================== */
(function(root){
  'use strict';

  var irMod = null, lensMod = null, baseMod = null;
  if(typeof module !== 'undefined' && module.exports){
    irMod = require('../ir.js');
    lensMod = require('../lens.js');
    baseMod = require('../base.js');
  }else if(root.__LuaMin2Modules){
    irMod = root.__LuaMin2Modules['ir'];
    lensMod = root.__LuaMin2Modules['lens'];
    baseMod = root.__LuaMin2Modules['base'];
  }
  function needIR(deps){ var m=(deps&&deps.ir)||irMod; if(!m) throw new Error('alias.js: 需要 src2/ir.js'); return m; }

  /* ---------- 共享基础库取用 ---------- */

  // base 门面（deps.base 注入优先）：collectMemberAccess / KEYWORDS / 候选名分配等均经此取得。
  var extrasCache = null;
  function baseExtras(deps){
    if(extrasCache) return extrasCache;
    var b = (deps && deps.base) || (baseMod && baseMod.create(deps));
    if(!b) throw new Error('alias.js: 需要 src2/base.js');
    extrasCache = { base: b, collectMemberAccess: b.collectMemberAccess, KEYWORDS: b.KEYWORDS };
    return extrasCache;
  }

  /* ---------- 证据构建器（声明式前置条件的求值体） ---------- */

  // localBudget：Lua 5.3 单函数最多 200 个同时活跃局部；别名全部落在根块作用域，
  // 预算 = 200 − 根函数最深路径上的活跃局部数（口径逐字移植 plan.js (b) 节）。
  function evLocalBudget(ir){
    var info = ir.info;
    var scopeLocalCounts = new Map(), rootScopes = new Set();
    info.bindings.forEach(function(b){
      if(b.scope.funcDepth !== 0) return;
      rootScopes.add(b.scope);
      scopeLocalCounts.set(b.scope, (scopeLocalCounts.get(b.scope)||0)+1);
    });
    rootScopes.add(info.topScope);
    var maxRootActive = 0;
    rootScopes.forEach(function(scope){
      var count = 0, cur = scope;
      while(cur && cur.funcDepth === 0){ count += scopeLocalCounts.get(cur)||0; cur = cur.parent; }
      if(count > maxRootActive) maxRootActive = count;
    });
    // 已被别名环境占用的槽位也要扣除
    return Math.max(0, 200 - maxRootActive - ir.aliases.entries.size);
  }

  var EVIDENCE = { localBudget: evLocalBudget };

  // ev(ir, key)：惰性证据存取（INV-2：随版本失效）；首次调用时把构建器注册进 IR 注册表
  var registered = false;
  function ev(ir, key){
    var IR = needIR();
    if(!registered){ IR.registerEvidence('localBudget', evLocalBudget); registered = true; }
    return IR.getEvidence(ir, key);
  }

  /* ---------- 共享小工具 ---------- */

  // 当前已被占用的名字集合：AST 全部标识符名 + 别名名（新别名不得与任何现存名冲突）
  function takenNames(ir, ex){
    var taken = ex.base._collectTakenNames(ir.ast);
    ir.aliases.entries.forEach(function(_, n){ taken.add(n); });
    return taken;
  }

  // allocName(ir, ex)：从 v1 候选名池分配一个未被占用的短名（关键字由分配器内部排除）
  function allocName(ir, ex){
    return ex.base._createNameAllocator(takenNames(ir, ex))();
  }

  // collectHoistableTop(ir, taken) -> [LocalStatement]：启动式复合候选的可上提顶层
  // local 集合（与 placeholderHoist 同口径的顶层简化版）：顶层块内、init 数==变量数、
  // 全 Identifier、绑定单声明且属于顶层作用域、未被闭包捕获、不在循环体、名不与
  // taken 撞（含折叠候选名；taken 已是全标识符集合，同名后者自然跳过）。
  function collectHoistableTop(ir, taken){
    var info = ir.info, top = info.topScope, out = [];
    var loops = [];
    (function walk(n){
      if(!n || typeof n !== 'object') return;
      if(Array.isArray(n)){ for(var i=0;i<n.length;i++) walk(n[i]); return; }
      if(n.type === 'WhileStatement' || n.type === 'RepeatStatement'
         || n.type === 'ForNumericStatement' || n.type === 'ForGenericStatement')
        loops.push(n.range);
      for(var k in n){ if(k==='range'||k==='loc') continue; walk(n[k]); }
    })(ir.ast.body);
    var added = new Set();
    for(var si=0; si<ir.ast.body.length; si++){
      var st = ir.ast.body[si];
      if(st.type !== 'LocalStatement' || !st.variables || !st.init) continue;
      if(st.init.length !== st.variables.length) continue;
      var inLoop = false;
      for(var li=0; li<loops.length; li++)
        if(st.range[0] >= loops[li][0] && st.range[1] <= loops[li][1]){ inLoop = true; break; }
      if(inLoop) continue;
      var ok = true;
      for(var vi=0; vi<st.variables.length; vi++){
        var v = st.variables[vi];
        if(v.type !== 'Identifier' || added.has(v.name)){ ok = false; break; }
        var b = info.varOf.get(v);
        if(!b || b.decls.length !== 1 || b.scope !== top || b.captured){ ok = false; break; }
      }
      if(!ok || !st.variables.length) continue;
      st.variables.forEach(function(v){ added.add(v.name); });
      out.push(st);
    }
    return out;
  }

  // hoistedStmts(stmts) -> [name]：上提语句集的变量名展开
  function hoistedStmts(stmts){
    var names = [];
    stmts.forEach(function(st){
      st.variables.forEach(function(v){ names.push(v.name); });
    });
    return names;
  }

  // mkDeclInsert(name, valueText)：生成头部声明插入编辑与 INV-1 约定的 declRange
  // 文本形态 `local <name>=<value> `（尾随空格由编码层按需收回），declRange 覆盖 `local <name>`。
  function mkDeclInsert(name, valueText){
    var text = 'local ' + name + '=' + valueText + ' ';
    return { edit: { start:0, end:0, text:text }, declRange: [0, 6 + name.length] };
  }

  // previewDelta(ir, edits, deps)：成本预演 = 应用编辑后的 encodeDelta（不重建 IR，纯文本）
  function previewDelta(ir, edits, deps){
    var IR = needIR(deps);
    var after = IR.applyTextEdits(ir.src, edits);
    return lensMod.encodeDelta(ir.src, after, deps);
  }

  /* ---------- 通用 inject：别名内联（extract 的逆） ----------
   * 对别名声明 `local X=init`：全部使用点代回 init 原文，声明项删除。
   * 成员字符串别名（local F='Field'，使用点为 [F]）代回后得 ['Field']，
   * canonical 的 normAccess 已归一 obj['Field'] ≡ obj.Field（canonical.js:853）。
   * 只读判定走 SSA 证据：版本数===1 才可内联（INV-3：前置只查 ssa 表）。
   */
  function findAliasDecl(ir, name){
    // 在顶层语句里找含名为 name 的局部声明项；返回 { st, vi, binding, initNode } 或 null
    var info = ir.info;
    for(var si=0; si<ir.ast.body.length; si++){
      var st = ir.ast.body[si];
      if(st.type !== 'LocalStatement' || !st.variables) continue;
      for(var vi=0; vi<st.variables.length; vi++){
        var v = st.variables[vi];
        if(v.type !== 'Identifier' || v.name !== name) continue;
        var b = info.varOf.get(v);
        if(!b) continue;
        return { st:st, vi:vi, binding:b, initNode:(st.init && st.init[vi]) || null };
      }
    }
    return null;
  }

  // declItemDeleteEdits(st, vis)：删除声明语句中索引集合 vis 的变量项（含对应 init）。
  // 逐字移植 plan.js elideByStmt 的区间合并逻辑（连续段合并、整条删除、'=' 联动）。
  function declItemDeleteEdits(st, vis){
    var edits = [];
    vis = vis.slice().sort(function(a,b){ return a-b; });
    var vars = st.variables, inits = st.init || [], n = vars.length, m = inits.length;
    var i = 0;
    while(i < vis.length){
      var j = i;
      while(j+1 < vis.length && vis[j+1] === vis[j]+1) j++;
      var p = vis[i], q = vis[j];
      if((q-p+1) === n){
        edits.push({ start:st.range[0], end:st.range[1], text:'' });   // 整条删除
      }else{
        var vs = (p===0) ? vars[0].range[0] : vars[p-1].range[1];
        var ve = (p===0) ? vars[q+1].range[0] : vars[q].range[1];
        edits.push({ start:vs, end:ve, text:'' });
        // init 仅当对应项存在时才删；前向 nil（无 init）只删名列表
        if(q < m){
          var allInitsGone = (p===0 && q===m-1);
          var is_ = (p===0) ? (allInitsGone ? vars[n-1].range[1] : inits[0].range[0]) : inits[p-1].range[1];
          var ie_ = (p===0) ? ((q===m-1) ? inits[m-1].range[1] : inits[q+1].range[0]) : inits[q].range[1];
          edits.push({ start:is_, end:ie_, text:'' });
        }
      }
      i = j+1;
    }
    return edits;
  }

  // injectAlias(ir, aliasName) -> {edits, form, residue}：别名内联（双向透镜的逆方向）。
  // 对 extract 产物（AliasEnv 有条目）与输入自带别名（按名找到声明）同样适用。
  function injectAlias(ir, aliasName){
    var found = findAliasDecl(ir, aliasName);
    if(!found || !found.initNode) return null;   // 前向 nil 声明不可内联（无 init 可代回）
    var entry = ir.ssa.byBinding.get(found.binding);
    if(!entry || entry.versions.length !== 1) return null;  // 被重赋值过：非只读别名，拒绝
    var initText = ir.src.slice(found.initNode.range[0], found.initNode.range[1]);
    var edits = [];
    found.binding.uses.forEach(function(u){
      edits.push({ start:u.range[0], end:u.range[1], text:initText });
    });
    edits = edits.concat(declItemDeleteEdits(found.st, [found.vi]));
    return { edits:edits, form:{}, residue:{ removedDecls:[aliasName], removedAliases:[aliasName] } };
  }

  /* ---------- 智能声明注入（替代 v1 手工 batched-local 注入；§6.4 组合化） ----------
   * mkAliasDecl(ir, name, valueText, useEdits, strictTail)：
   * 生成别名声明编辑。优先级（v1 foldMethods/foldFieldPrefix 同口径）：
   *   ① 头部别名区最后一条 local（probeInjectable：init 对齐、无函数初值）；
   *   ② 无别名头时顶层首条普通 local（改写点不得落在语句内部）；
   *   ③ 头部独立 local（兜底，合批收益留给 hoist.localsMerge 在不动点发现）。
   * 返回 { edits, declRange|null, injected }；注入形态 declRange=null + injected（INV-1 AST 通道）。
   */
  function probeInjectableLocal(st, strictTail){
    if(!st || st.type !== 'LocalStatement' || !st.variables || !st.variables.length
       || !st.init || !st.init.length) return false;
    if(st.init.length < st.variables.length) return false;
    for(var i=0;i<st.init.length;i++)
      if(st.init[i] && st.init[i].type === 'FunctionDeclaration') return false;
    if(strictTail){
      var last = st.init[st.init.length-1];
      if(last && (last.type === 'CallExpression' || last.type === 'StringCallExpression'
                  || last.type === 'TableCallExpression' || last.type === 'VarargLiteral')) return false;
    }
    return true;
  }
  // prepend 可注入判定：前插名字+值对【不改变】既有变量的值对应关系（名/值列表同步
  // 右移，nil 填充尾不变；多返回值截断位置不变）。语义原因：别名值（全局名/字符串
  // 字面量）是纯表达式，求值提前无副作用。宿主要求：LocalStatement、全 Identifier
  // 变量、无函数表达式初值（函数值形态保留 v1 保守）、改写点不在语句内部。
  function probePrependableLocal(st){
    if(!st || st.type !== 'LocalStatement' || !st.variables || !st.variables.length) return false;
    for(var i=0;i<st.variables.length;i++) if(st.variables[i].type !== 'Identifier') return false;
    if(st.init) for(var i=0;i<st.init.length;i++)
      if(st.init[i] && st.init[i].type === 'FunctionDeclaration') return false;
    return true;
  }
  function mkAliasDecl(ir, name, valueText, useEdits, strictTail){
    var body = ir.ast.body;
    var drop = ir.aliases.dropLeading || 0;
    var host = null, mode = null;
    // 使用改写点落在宿主语句内部时，注入（append/prepend 同口径）会让被注入名
    // 与同句 init 引用同批变量（local a,...,D=X,a(),... 的 D=a() 读到的是外层 a）
    // ——语义 bug，必须退回独立声明（实证：勇往直前#10 的 _Data 折叠，verify 崩溃
    // 黑名单连带合法独立形态也被弃，整轮漏折）。
    function editsInside(st){
      for(var i=0; i<(useEdits || []).length; i++){
        var e = useEdits[i];
        if(e.start >= st.range[0] && e.start < st.range[1]) return true;
      }
      return false;
    }
    if(drop > 0 && drop <= body.length && probeInjectableLocal(body[drop-1], strictTail)
       && !editsInside(body[drop-1])){
      host = body[drop-1]; mode = 'append';
    }
    // 前插补位：头部语句【不对齐】（含前向 nil 占位）时 append 会错位，prepend 名/值
    // 到 body[0] 保持对应关系不变（幂等关键路径：占位上提后的头部仍可继续吸收别名）。
    // 仅当 body[0] 本就是别名头成员（drop>0）或无别名头（drop===0）时才前插——
    // 否则会把普通首语句抬进别名区，语义正确但扰乱 dropLeading 的既有布局。
    if(!host && body.length && (drop === 0 || drop >= 1) && probePrependableLocal(body[0])
       && !editsInside(body[0])){
      host = body[0]; mode = 'prepend';
    }
    if(host && mode === 'append'){
      var lastVar = host.variables[host.variables.length-1];
      return {
        edits: [
          { start: lastVar.range[1], end: lastVar.range[1], text: ',' + name },
          { start: host.range[1], end: host.range[1], text: ',' + valueText }
        ],
        declRange: null, injected: true
      };
    }
    if(host && mode === 'prepend'){
      var firstVar = host.variables[0], lastVar2 = host.variables[host.variables.length-1];
      var edits = [{ start: firstVar.range[0], end: firstVar.range[0], text: name + ',' }];
      if(host.init && host.init.length)
        edits.push({ start: host.init[0].range[0], end: host.init[0].range[0], text: valueText + ',' });
      else
        edits.push({ start: lastVar2.range[1], end: lastVar2.range[1], text: '=' + valueText });
      return { edits: edits, declRange: null, injected: true };
    }
    return { edits: [{ start:0, end:0, text:'local ' + name + '=' + valueText + ' ' }],
             declRange: [0, 6 + name.length], injected: false };
  }

  /* ---------- 透镜 1：alias.global（高频全局折叠） ---------- */

  function createGlobalAliasLens(deps){
    var threshold = (deps && deps.threshold !== undefined) ? deps.threshold : 8;
    return {
      name: 'alias.global',
      kind: 'extract',
      requires: ['ssa', 'localBudget'],
      provides: ['alias:global'],
      consumes: [], conflicts: [],
      // 注意：全局别名【不】做 break-even 提交——零收益折叠只改变形态不改长度，
      // 会让输入形态不同的等价代码收敛到不同局部最优（幂等裂缝的实证来源）。
      //（alias.member 保留 commitAtZero：v1 的 +3 容忍语义——边缘成员别名是后续
      //  因子分解/点访问复用的字符串库，且其候选站点改写后不再生成，收敛稳定。）

      // match(ir) -> [Candidate]：纯读取全局按 v1 预筛公式过滤，逐候选分配短名并过终闸
      match: function(ir){
        var ex = baseExtras(deps), IR = needIR(deps);
        var groups = new Map();
        ir.info.varOf.forEach(function(b, node){
          if(b !== null) return;
          var nm = node.name;
          if(ir.info.assignedGlobals.has(nm)) return;
          if(!groups.has(nm)) groups.set(nm, []);
          groups.get(nm).push(node);
        });
        var budget = ev(ir, 'localBudget');
        var out = [], qual = [];
        groups.forEach(function(nodes, nm){
          var k = nodes.length, m = nm.length;
          if((m-1)*k <= (m+threshold)) return;         // v1 预筛：(m-1)*k > m+threshold
          if(out.length >= budget) return;             // 200 局部上限（声明式证据闸门）
          var pick = allocName(ir, ex);
          if(pick === null) return;
          var L = pick.length;
          if((m-L)*k <= (m+L+1)) return;               // v1 终闸（+1 容忍，口径见 plan.js 注释）
          qual.push({ nm: nm, nodes: nodes, k: k, m: m });
          var renameEdits = [];
          nodes.forEach(function(node){
            renameEdits.push({ start:node.range[0], end:node.range[1], text:pick });
          });
          // 声明注入：优先头部别名区/首条普通 local（省 6 字；语义同 v1 的 batched
          // declParts——canonical 的 aliasLocalBindings 覆盖所有顶层 local，等价可证）。
          // 注入点在宿主语句内时 mkAliasDecl 自动退回独立 local（改写点冲突守卫）。
          var decl = mkAliasDecl(ir, pick, nm, renameEdits, false);
          out.push({
            id: 'global:' + nm, name: pick, target: nm, k: k, m: m,
            _edits: decl.edits.concat(renameEdits),
            _declRange: decl.declRange, _injected: decl.injected
          });
        });
        // 批次复合候选（v1 统一规划的摊薄语义）：≥2 个过闸全局时并为一条合批 local。
        // 无宿主可注入时，逐候选独立 local 的 6 字 `local ` 使边际全局（k=2~3 次）
        // delta 变正被调度跳过，而合批后整体为负（实证 redis/simple 的 package+require
        // 双双 +4 漏折）；宿主存在时逐候选注入形态更优，批候选按 delta 自然落选。
        // 名称按收益降序分配（v1 planAll 高频得短名同口径）。
        if(qual.length >= 2){
          qual.sort(function(x, y){ return (y.m - 1) * y.k - (x.m - 1) * x.k; });
          var allocator = ex.base._createNameAllocator(takenNames(ir, ex));
          var siteEdits = [], batch = [], ok = true;
          qual.forEach(function(q){
            if(!ok) return;
            var pick = allocator();
            if(!pick){ ok = false; return; }
            batch.push({ name: pick, target: q.nm });
            q.nodes.forEach(function(node){
              siteEdits.push({ start:node.range[0], end:node.range[1], text:pick });
            });
          });
          if(ok && batch.length >= 2){
            var declText = 'local ' + batch.map(function(b){ return b.name; }).join(',')
                         + '=' + batch.map(function(b){ return b.target; }).join(',') + ' ';
            out.push({
              id: 'globalBatch:' + batch.map(function(b){ return b.target; }).join('|'),
              _edits: [{ start:0, end:0, text: declText }].concat(siteEdits),
              _batch: batch
            });
          }
        }
        // 启动式复合候选（折叠+占位上提一体，v1 planAll 全局规划形态的透镜表达）：
        // 无别名头时，注入口径可赚而独立口径亏损的全局折叠，与顶层合规 local 的占位
        // 上提合并为同一条 0 位批量声明——`local ` 成本摊薄（实证 redis/simple：
        // package+require 与 redis/client/value 合批净 −4；单折叠 +4、globalBatch +2、
        // 先 globalBatch 再 placeholderHoist +2，全部过不了闸，调度/搜索都到不了）。
        // 上提合规集与 placeholderHoist 同口径的顶层简化版。
        if(qual.length >= 1){
          var hoistable = collectHoistableTop(ir, takenNames(ir, ex));
          if(hoistable.length){
            var allocator2 = ex.base._createNameAllocator(takenNames(ir, ex));
            var boot = [], bootSiteEdits = [], ok2 = true;
            qual.forEach(function(q){
              if(!ok2) return;
              var pick = allocator2();
              if(!pick){ ok2 = false; return; }
              boot.push({ name: pick, target: q.nm });
              q.nodes.forEach(function(node){
                bootSiteEdits.push({ start:node.range[0], end:node.range[1], text:pick });
              });
            });
            if(ok2){
              var hoistNames = [];
              hoistedStmts(hoistable).forEach(function(nm){ hoistNames.push(nm); });
              var bootEdits = [{
                start: 0, end: 0,
                text: 'local ' + boot.map(function(b){ return b.name; }).concat(hoistNames).join(',')
                    + '=' + boot.map(function(b){ return b.target; }).join(',') + ' '
              }];
              hoistable.forEach(function(st){
                bootEdits.push({ start: st.range[0], end: st.variables[0].range[0], text: '' });
              });
              out.push({
                id: 'globalBoot:' + boot.map(function(b){ return b.target; }).join('|'),
                _edits: bootEdits.concat(bootSiteEdits),
                _batch: boot
              });
            }
          }
        }
        return out;
      },

      // cost(ir, cand) -> {delta, confidence:'exact'}：文本预演，恒等于实测
      cost: function(ir, cand){ return { delta: previewDelta(ir, cand._edits, deps), confidence: 'exact' }; },

      // extract(ir, cand)：别名声明（注入或头部独立 local）+ 全部引用改写
      extract: function(ir, cand){
        if(cand._batch){
          // 合批声明：条目走 injected 通道（binding 级存活校验，INV-1 同 localsMerge 合批）
          return {
            edits: cand._edits,
            form: { aliasEntries: cand._batch.map(function(b){
              return { name: b.name, entry: {
                kind: 'global', target: b.target,
                declRange: null, injected: true,
                introducedBy: 'alias.global', roundtripKey: cand.id + '/' + b.target
              } };
            }) },
            residue: {}
          };
        }
        return {
          edits: cand._edits,
          form: { aliasEntries: [{ name: cand.name, entry: {
            kind: 'global', target: cand.target,
            declRange: cand._declRange ? cand._declRange.slice() : null,
            injected: !!cand._injected,
            introducedBy: 'alias.global', roundtripKey: cand.id
          }}] },
          residue: {}
        };
      },

      inject: injectAlias
    };
  }

  /* ---------- 透镜 2：alias.member（成员字段折叠 .Field → [F]） ---------- */

  function createMemberAliasLens(deps){
    return {
      name: 'alias.member',
      kind: 'extract',
      requires: ['ssa', 'localBudget'],
      provides: ['alias:member'],
      consumes: [], conflicts: [],
      // 临界 break-even 也提交（v1 终闸 +3 容忍语义：边缘情形留作因子分解库）。
      // 终止性：站点改写后候选不再生成。
      commitAtZero: true,

      // match(ir)：obj.Field（仅 '.'）按字段分组，过 v1 预筛/终闸；每处改写 "[F]"
      match: function(ir){
        var ex = baseExtras(deps);
        var groups = new Map();
        ex.collectMemberAccess(ir.ast, groups);
        var budget = ev(ir, 'localBudget');
        var out = [];
        groups.forEach(function(sites, field){
          var k = sites.length, m = field.length;
          if((m-2)*k <= (m+3)) return;                 // v1 预筛：(m-2)*k > m+3
          if(out.length >= budget) return;
          var pick = allocName(ir, ex);
          if(pick === null) return;
          var L = pick.length;
          if((m+1)*k <= (L+2)*k + (L+m+3)) return;     // v1 终闸（+3 容忍，口径见 plan.js 注释）
          var siteEdits = [];
          sites.forEach(function(s){
            siteEdits.push({ start:s.baseEnd, end:s.idEnd, text:'[' + pick + ']' });
          });
          // 声明注入：优先头部别名区/首条普通 local（foldMemberField 注入路径，省 6 字）
          var decl = mkAliasDecl(ir, pick, "'" + field + "'", siteEdits, false);
          out.push({
            id: 'member:' + field, name: pick, target: field, k: k, m: m,
            _edits: decl.edits.concat(siteEdits), _declRange: decl.declRange, _injected: decl.injected
          });
        });
        return out;
      },

      cost: function(ir, cand){ return { delta: previewDelta(ir, cand._edits, deps), confidence: 'exact' }; },

      extract: function(ir, cand){
        return {
          edits: cand._edits,
          form: { aliasEntries: [{ name: cand.name, entry: {
            kind: 'member', target: cand.target,
            declRange: cand._declRange ? cand._declRange.slice() : null,
            injected: !!cand._injected,
            introducedBy: 'alias.member', roundtripKey: cand.id
          }}] },
          residue: {}
        };
      },

      inject: injectAlias
    };
  }

  /* ---------- 透镜 3：alias.transparent（透明别名消解） ----------
   * 移植 plan.js (a1)+R1+R2：顶层、单声明、只读（SSA 单版本）、init 为只读全局
   * 或另一透明别名的局部，按名归并（R1）且逐变量可删（R2）才可消解。
   * 使用点重定向：目标全局已有别名（AliasEnv kind=global）则用别名名，否则用全局原名
   * （后者通常正收益不达，由调度器 delta<0 闸门自然滤掉）。
   */
  function createTransparentElisionLens(deps){
    return {
      name: 'alias.transparent',
      kind: 'rewrite',
      requires: ['ssa'],
      provides: [],   // 产生 transparentAliases 证据（挂 AliasEnv.transparent，非 entries）
      consumes: [], conflicts: [],

      match: function(ir){
        var info = ir.info, topScopeId = info.topScope.id;
        // 只读全局名集合（透明别名追踪不依赖折叠阈值，口径同 v1）
        var globalReadOnly = new Set();
        info.varOf.forEach(function(b, node){
          if(b === null && !info.assignedGlobals.has(node.name)) globalReadOnly.add(node.name);
        });
        // 追踪：binding -> 最终全局名（链式溯源）
        var taGlobal = new Map(), taStmt = new Map(), taIdx = new Map(), taInit = new Map();
        (function scan(stmts){
          for(var si=0; si<stmts.length; si++){
            var st = stmts[si];
            if(st.type !== 'LocalStatement' || !st.variables || !st.init) continue;
            for(var vi=0; vi<st.variables.length; vi++){
              var v = st.variables[vi], initExpr = st.init[vi];
              if(!initExpr || initExpr.type !== 'Identifier') continue;
              var b = info.varOf.get(v);
              if(!b || b.decls.length !== 1 || b.scope.id !== topScopeId) continue;
              var e = ir.ssa.byBinding.get(b);
              if(!e || e.versions.length !== 1) continue;    // 只读（SSA 证据）
              var initB = info.varOf.get(initExpr);
              if(initB === null){
                if(!globalReadOnly.has(initExpr.name)) continue;
                taGlobal.set(b, initExpr.name);
                taStmt.set(b, st); taIdx.set(b, vi); taInit.set(b, initExpr);
              }else{
                var src = taGlobal.get(initB);
                if(src){
                  taGlobal.set(b, src);
                  taStmt.set(b, st); taIdx.set(b, vi); taInit.set(b, initExpr);
                }
              }
            }
          }
        })(ir.ast.body);
        if(!taGlobal.size) return [];

        // R1：按名归并——名为 N 的全部 binding 都是同一全局的透明别名才可消解
        var byName = new Map();
        info.bindings.forEach(function(b){
          if(!byName.has(b.name)) byName.set(b.name, []);
          byName.get(b.name).push(b);
        });
        // 重定向目标：目标全局已有别名则改用别名名
        var aliasOfGlobal = {};
        ir.aliases.entries.forEach(function(entry, name){
          if(entry.kind === 'global') aliasOfGlobal[entry.target] = name;
        });
        var out = [];
        byName.forEach(function(list, name){
          // 别名条目名不是消解对象：AliasEnv 管理的别名（alias.global 等产物）的消解
          // 是 injectAlias/inv 步的职责；在此消解会留下悬空引用（条目删除与使用
          // 重定向分属两步时，名字会退化成全局读）。v1 统一规划无此瞬态。
          if(ir.aliases.entries.has(name)) return;
          var g = null, okAll = true;
          for(var i=0; i<list.length; i++){
            if(!taGlobal.has(list[i])){ okAll = false; break; }
            var gg = taGlobal.get(list[i]);
            if(g === null) g = gg; else if(g !== gg){ okAll = false; break; }
          }
          if(!okAll || g === null) return;
          // R2：逐变量校验必须有自己的 init（前向 nil 不可删）
          for(var j=0; j<list.length; j++){
            var st = taStmt.get(list[j]), vi = taIdx.get(list[j]);
            if(!st || !st.init || vi === undefined || vi >= st.init.length) return;
          }
          // v1 同口径：仅当目标全局【已被折叠为别名】才消解（否则退回普通局部——
          // 直接重定向到长全局名多半变长，且会把 canonical 的透明还原拖入瞬态）。
          // 组合时序由不动点保证：alias.global 先提交，下一轮 elision 自然命中。
          var target = aliasOfGlobal[g];
          if(!target) return;
          // 编辑：使用重定向 + 声明删除（按语句合并区间）
          var elidedInits = new Set();
          list.forEach(function(b){ var n2 = taInit.get(b); if(n2) elidedInits.add(n2); });
          var edits = [];
          list.forEach(function(b){
            b.uses.forEach(function(u){
              if(elidedInits.has(u)) return;   // 落在被删声明 init 里的使用不改写
              edits.push({ start:u.range[0], end:u.range[1], text:target });
            });
          });
          var byStmt = new Map();
          list.forEach(function(b){
            var st = taStmt.get(b);
            if(!byStmt.has(st)) byStmt.set(st, []);
            byStmt.get(st).push(taIdx.get(b));
          });
          byStmt.forEach(function(vis, st){
            edits = edits.concat(declItemDeleteEdits(st, vis));
          });
          var ta = {}; ta[name] = g;
          out.push({ id:'transparent:' + name, name:name, target:g, _edits:edits, _ta:ta });
        });
        return out;
      },

      cost: function(ir, cand){ return { delta: previewDelta(ir, cand._edits, deps), confidence: 'exact' }; },

      extract: function(ir, cand){
        return { edits: cand._edits, form: { transparentAliases: cand._ta }, residue: { removedDecls: [cand.name] } };
      },

      // inject(ir, name)：消解的逆 = 重新引入 `local <name>=<global> ` 并把该全局的
      // 直接读改回别名名（M2 仅作契约完备；调度器 fwd 方向不用它，M6 inv 步复用）。
      inject: function(ir, name){
        var g = ir.aliases.transparent[name];
        if(!g) return null;
        var decl = mkDeclInsert(name, g);
        var edits = [decl.edit];
        ir.info.varOf.forEach(function(b, node){
          if(b === null && node.name === g) edits.push({ start:node.range[0], end:node.range[1], text:name });
        });
        return { edits:edits, form:{}, residue:{} };
      },

      // verify 覆盖：消解改变了局部结构，须带 transparentAliases 还原的 canonical 比对
      verify: function(ir, cand, result){
        var am = { transparentAliases: cand._ta };
        try{
          return ir._base._canonical(ir.src) === ir._base._canonical(result.ir.src, am);
        }catch(e){ return false; }
      }
    };
  }

  /* ---------- 透镜 4：alias.rename（局部最短重命名） ----------
   * v1 在统一着色里给局部改名；透镜化后按 binding 逐候选：冲突集合 = 作用域链相交的
   * 全部 binding 现名 + 全部全局名 + 别名名（保守：经 v1 conflict 同口径链判定）。
   * pinned（隐式 self）与 AliasEnv 管理的别名名不改（改了会破坏 declRange/roundtripKey）。
   */

  // buildScopeMap(ast, info) -> { map:Map(identNode->scopeId) }|null
  // 重放 analyze.js 的作用域创建序（newScope 的调用点与顺序逐字对应），把每个标识符
  // 节点映射到其作用域 id；再以【全部 binding 的声明点与读点】交叉校验——任一点
  // 漂移（AST 形态与重放不一致）即返回 null（调用方整组回退保守邻居集，宁可少改不改错）。
  function buildScopeMap(ast, info){
    var seq = 0;
    var map = new Map();
    var parentOf = [];   // scopeId -> parentScopeId（含无声明的空作用域——info 侧
                         // scopeSeq 只沿 binding 祖先链补全，空作用域会漏，链步进须自给）
    function newScope(parent){ parentOf[seq] = parent; return seq++; }
    function mark(node, sc){ if(node && node.type === 'Identifier') map.set(node, sc); }
    function walkExprList(list, sc){ for(var i=0;i<list.length;i++) walkExpr(list[i], sc); }
    function walkExpr(node, sc){
      if(!node) return;
      switch(node.type){
        case 'Identifier': map.set(node, sc); break;
        case 'NumericLiteral': case 'StringLiteral': case 'BooleanLiteral':
        case 'NilLiteral': case 'VarargLiteral': break;
        case 'BinaryExpression': case 'LogicalExpression':
          walkExpr(node.left, sc); walkExpr(node.right, sc); break;
        case 'UnaryExpression': walkExpr(node.argument, sc); break;
        case 'MemberExpression': walkExpr(node.base, sc); break;
        case 'IndexExpression': walkExpr(node.base, sc); walkExpr(node.index, sc); break;
        case 'CallExpression': walkExpr(node.base, sc); walkExprList(node.arguments, sc); break;
        case 'TableCallExpression': walkExpr(node.base, sc); walkExpr(node.arguments, sc); break;
        case 'StringCallExpression': walkExpr(node.base, sc); walkExpr(node.argument, sc); break;
        case 'TableConstructorExpression':
          for(var i=0;i<node.fields.length;i++){
            var f=node.fields[i];
            if(f.type==='TableKey'){ walkExpr(f.key, sc); walkExpr(f.value, sc); }
            else if(f.type==='TableKeyString'){ walkExpr(f.value, sc); }
            else if(f.type==='TableValue'){ walkExpr(f.value, sc); }
          }
          break;
        case 'FunctionDeclaration': walkFunction(node, sc); break;
        default: break;
      }
    }
    function walkFunction(node, sc){
      var inner = newScope(sc);
      for(var i=0;i<node.parameters.length;i++) mark(node.parameters[i], inner);
      walkBlock(node.body, inner);
    }
    function walkBlock(stmts, sc){ for(var i=0;i<stmts.length;i++) walkStmt(stmts[i], sc); }
    function walkStmt(node, sc){
      switch(node.type){
        case 'LocalStatement':
          for(var i=0;i<node.variables.length;i++) mark(node.variables[i], sc);
          walkExprList(node.init||[], sc);
          break;
        case 'AssignmentStatement':
          walkExprList(node.init||[], sc);
          for(var j=0;j<node.variables.length;j++){
            var tgt=node.variables[j];
            if(tgt.type==='Identifier') map.set(tgt, sc); else walkExpr(tgt, sc);
          }
          break;
        case 'CallStatement': walkExpr(node.expression, sc); break;
        case 'ReturnStatement': walkExprList(node.arguments||[], sc); break;
        case 'IfStatement':
          for(var c=0;c<node.clauses.length;c++){
            var cl=node.clauses[c];
            if(cl.condition) walkExpr(cl.condition, sc);
            walkBlock(cl.body, newScope(sc));
          }
          break;
        case 'WhileStatement':
          walkExpr(node.condition, sc);
          walkBlock(node.body, newScope(sc));
          break;
        case 'DoStatement': walkBlock(node.body, newScope(sc)); break;
        case 'RepeatStatement':
          var rs=newScope(sc);
          walkBlock(node.body, rs);
          walkExpr(node.condition, rs);
          break;
        case 'ForNumericStatement':
          walkExpr(node.start,sc); walkExpr(node.end,sc); walkExpr(node.step,sc);
          var fs=newScope(sc); mark(node.variable, fs);
          walkBlock(node.body, fs);
          break;
        case 'ForGenericStatement':
          walkExprList(node.iterators,sc);
          var gs=newScope(sc);
          for(var v=0;v<node.variables.length;v++) mark(node.variables[v], gs);
          walkBlock(node.body, gs);
          break;
        case 'FunctionDeclaration':
          if(node.isLocal && node.identifier && node.identifier.type==='Identifier'){
            mark(node.identifier, sc);
            walkFunction(node, sc);
          }else{
            if(node.identifier){
              if(node.identifier.type==='Identifier') map.set(node.identifier, sc);
              else walkExpr(node.identifier, sc);
            }
            walkFunction(node, sc);
          }
          break;
        default: break;
      }
    }
    newScope(undefined);   // 顶层 id=0
    walkBlock(ast.body, 0);
    // 交叉校验：全部声明点必须落回 analyze 的作用域 id；全部读点必须被映射
    for(var bi=0; bi<info.bindings.length; bi++){
      var b = info.bindings[bi];
      for(var di=0; di<b.decls.length; di++)
        if(map.get(b.decls[di]) !== b.scope.id) return null;
      for(var ui=0; ui<b.uses.length; ui++)
        if(!map.has(b.uses[ui])) return null;
    }
    return { map: map, parentOf: parentOf };
  }

  function createRenameLens(deps){
    return {
      name: 'alias.rename',
      kind: 'rewrite',
      requires: ['ssa'],
      provides: [],
      consumes: [], conflicts: [],

      match: function(ir){
        var ex = baseExtras(deps), info = ir.info;
        var allGlobals = ex.base._collectGlobalNames(ir.ast, info);
        var aliasNames = new Set();
        ir.aliases.entries.forEach(function(_, n){ aliasNames.add(n); });
        var out = [];
        // 冲突集合的共享预计算（实证 moses 94KB/816 binding：逐 binding 重建 O(B²)
        // 基础集 + 全表扫使单次 match 达 756ms）。一次性：基础集（全局名+别名名）、
        // 逐作用域声明名表、作用域父子树；per-binding 邻居 = 祖先链名 ∪ 子树名。
        var baseSet = new Set(allGlobals);
        aliasNames.forEach(function(n){ baseSet.add(n); });
        var namesByScope = new Map(), childScopes = new Map(), scopeSeq = new Map();
        var bindingsByScope = new Map();
        info.bindings.forEach(function(b){
          var sid = b.scope.id;
          if(!namesByScope.has(sid)) namesByScope.set(sid, []);
          namesByScope.get(sid).push(b.name);
          if(!bindingsByScope.has(sid)) bindingsByScope.set(sid, []);
          bindingsByScope.get(sid).push(b);
        });
        // 作用域登记沿祖先链补全：无声明的空作用域也必须入树（否则子树名集会
        // 漏掉空作用域下游的 binding——实证：邻居集变小 → 分配器选了碰撞名 →
        // verify 拒步 → 名称分配质量回退，御灵术#8 3437→3453）。
        info.bindings.forEach(function(b){
          var s = b.scope;
          while(s){
            if(!scopeSeq.has(s.id)) scopeSeq.set(s.id, s);
            s = s.parent;
          }
        });
        scopeSeq.forEach(function(sc, sid){
          var p = sc.parent;
          if(p){
            if(!childScopes.has(p.id)) childScopes.set(p.id, []);
            childScopes.get(p.id).push(sc);
          }
        });
        var subtreeNamesCache = new Map();
        function subtreeNames(sid){
          if(subtreeNamesCache.has(sid)) return subtreeNamesCache.get(sid);
          var acc = [];
          (namesByScope.get(sid) || []).forEach(function(n){ acc.push(n); });
          (childScopes.get(sid) || []).forEach(function(ch){
            subtreeNames(ch.id).forEach(function(n){ acc.push(n); });
          });
          subtreeNamesCache.set(sid, acc);
          return acc;
        }
        function neighborNames(b){
          var f = new Set(baseSet);
          var s = b.scope;
          while(s){
            (namesByScope.get(s.id) || []).forEach(function(n){ f.add(n); });
            s = s.parent;
          }
          subtreeNames(b.scope.id).forEach(function(n){ f.add(n); });
          return f;
        }
        // ---- 精确冲突（v1 统一着色的作用域判定，替代「子树名全禁」的保守近似）----
        // 改名 b→N 的安全条件（逐读点判定）：② N 在 b 同层作用域无同名 binding；
        // ③ b 的任一读点 u 到 b.scope 的链上（含 u 所在作用域）无同名 binding；
        // ④ b.scope 祖先链上的同名 binding 在 b.scope 子树内无读点（反向劫持）。
        // 祖先同名而子树内无读、后代同名（遮蔽）天然安全——v1 着色器同口径。
        // 实证 luacheck/config：顶层局部被子树毯禁挤光 1 字符名（高频局部被迫
        // 2 字符，净 +20），精确化后嵌套作用域的短名对顶层/兄弟局部释放。
        // skip：交换伙伴 binding（它被同时改走，其旧名让位，扫描按身份排除）。
        var scMap = buildScopeMap(ir.ast, info);
        var ancUseBind = null;   // scopeId -> [{name, bind}]（规则④预计算）
        if(scMap){
          ancUseBind = new Map();
          info.bindings.forEach(function(o){
            o.uses.forEach(function(u){
              var s = scMap.map.get(u);
              if(s === undefined) return;
              while(s !== undefined && s !== o.scope.id){
                if(!ancUseBind.has(s)) ancUseBind.set(s, []);
                ancUseBind.get(s).push({ name: o.name, bind: o });
                s = scMap.parentOf[s];
              }
            });
          });
        }
        function forbiddenPrecise(b, skip){
          var f = new Set(baseSet);
          (bindingsByScope.get(b.scope.id) || []).forEach(function(o){
            if(o !== skip) f.add(o.name);
          });
          b.uses.forEach(function(u){
            var s = scMap.map.get(u);
            if(s === undefined) return;
            while(s !== undefined && s !== b.scope.id){
              (bindingsByScope.get(s) || []).forEach(function(o){
                if(o !== skip) f.add(o.name);
              });
              s = scMap.parentOf[s];
            }
          });
          (ancUseBind.get(b.scope.id) || []).forEach(function(r){
            if(r.bind !== skip) f.add(r.name);
          });
          return f;
        }
        function neighborOf(b, skip){
          return scMap ? forbiddenPrecise(b, skip) : neighborNames(b);
        }
        info.bindings.forEach(function(b, idx){
          if(b.pinned) return;
          // 别名条目与 binding 的同名关系分两层：
          //  ① 同名异 binding（嵌套 shadow / 别作用域同名局部）——不连坐，按普通局部
          //     放行改名（邻居集含别名名，新名不会撞上别名）。实证 microlight/ml.lua：
          //     顶层源内链别名 append 连坐嵌套 12 用 append（+60）与 split 内 append。
          //  ② 条目所属 binding 本身——允许换名，但须同步换键（form.renamedAliases，
          //     与 swap 路径同机制，证据不丢）；所属判定按声明区间包含（注入条目无
          //     declRange 时保守按名全禁，维持原口径）。别名名已最短时由长度闸拒判。
          var renamed = null;
          var aEntry = ir.aliases.entries.get(b.name);
          if(aEntry){
            var own = false;
            if(aEntry.declRange){
              for(var di=0; di<b.decls.length; di++){
                var dr = b.decls[di].range;
                if(dr && dr[0] >= aEntry.declRange[0] && dr[1] <= aEntry.declRange[1]){ own = true; break; }
              }
            }else{
              own = true;
            }
            if(own) renamed = [{ from: b.name, to: null }];   // to 待分配后回填
          }
          var forbidden = neighborOf(b, null);
          var pick = ex.base._createNameAllocator(forbidden)();
          if(pick === null || pick.length >= b.name.length) return;   // 仅严格更短才改
          var edits = [];
          b.decls.forEach(function(d){ edits.push({ start:d.range[0], end:d.range[1], text:pick }); });
          b.uses.forEach(function(u){ edits.push({ start:u.range[0], end:u.range[1], text:pick }); });
          if(renamed) renamed[0].to = pick;
          out.push({ id:'rename:' + b.id + ':' + b.name + '->' + pick, name:pick, target:b.name,
                     _edits:edits, _renamed: renamed,
                     _arithDelta: edits.length * (pick.length - b.name.length) });
        });

        // 名称交换候选：长名(≥2) binding 与 短名(1 字符)普通局部互换名字——v1 统一
        // 着色按频次分名的增量表达。短名被低频占用时逐名改短永远到不了最优（实证：
        // 御灵术#8 单用 Game() 占 q、3 用字符串别名只能叫 Ve，净 +5），单步交换
        // 覆盖该盲区；别名条目参与交换经 form.renamedAliases 换键（证据不丢）。
        // forbidden 的 partner 豁免按【binding 身份】而非名字：多个重名 binding
        // （`_` 家族）共享的名字仍须禁用，否则废候选 swap:_<->Ve 会挤掉 break 位
        // 上的真候选 swap:q<->Ve（实证：邻居集版按名豁免造成御灵术#8 回退 16 字节）。
        var subtreeBindCache = new Map();
        function subtreeBindings(sid){
          if(subtreeBindCache.has(sid)) return subtreeBindCache.get(sid);
          var acc = [];
          (bindingsByScope.get(sid) || []).forEach(function(o){ acc.push(o); });
          (childScopes.get(sid) || []).forEach(function(ch){
            subtreeBindings(ch.id).forEach(function(o){ acc.push(o); });
          });
          subtreeBindCache.set(sid, acc);
          return acc;
        }
        var globalSet = new Set(allGlobals);
        function forbiddenSwap(b, partner){
          // 精确路径：逐读点链判定（partner 被同时改走，按身份豁免）；
          // partner 名是被引用全局名时恒禁（顶层伙伴改成全局名会截获未遮蔽的全局读）。
          if(scMap){
            var fp = forbiddenPrecise(b, partner);
            fp.delete(partner.name);
            if(globalSet.has(partner.name)) fp.add(partner.name);
            return fp;
          }
          var f = neighborNames(b);
          // 释放 partner 名的条件：无其他同名 binding 与 b 作用域相关；且 partner 名
          // 不是被引用全局名（原逻辑：全局名恒禁用，binding 按身份豁免）。
          f.delete(partner.name);
          if(globalSet.has(partner.name)){ f.add(partner.name); return f; }
          var clash = false;
          var s = b.scope;
          while(s && !clash){
            (bindingsByScope.get(s.id) || []).forEach(function(o){
              if(o !== partner && o.name === partner.name) clash = true;
            });
            s = s.parent;
          }
          if(!clash){
            var subs = subtreeBindings(b.scope.id);
            for(var i=0; i<subs.length; i++)
              if(subs[i] !== partner && subs[i].name === partner.name){ clash = true; break; }
          }
          if(clash) f.add(partner.name);
          return f;
        }
        var shorties = [];
        info.bindings.forEach(function(b){
          if(b.pinned || b.name.length !== 1) return;
          shorties.push({ b: b, occ: b.decls.length + b.uses.length });
        });
        shorties.sort(function(x, y){ return x.occ - y.occ; });
        // binding 是否别名条目的【所属】声明（按名误判会把遮蔽 binding 的交换错误地
        // 换键条目）：declRange 覆盖其声明区间，或注入条目按顶层单声明同名校验
        // （与 applyCandidate 的 alive 口径一致）。
        function ownsAliasEntry(b){
          var e = ir.aliases.entries.get(b.name);
          if(!e) return false;
          if(e.declRange){
            for(var di2=0; di2<b.decls.length; di2++){
              var dr2 = b.decls[di2].range;
              if(dr2 && dr2[0] >= e.declRange[0] && dr2[1] <= e.declRange[1]) return true;
            }
            return false;
          }
          return b.scope === info.topScope && b.decls.length === 1;
        }
        info.bindings.forEach(function(b){
          if(b.pinned || b.name.length < 2) return;
          var occB = b.decls.length + b.uses.length;
          for(var si=0; si<shorties.length; si++){
            var X = shorties[si].b, occX = shorties[si].occ;
            if(X === b) continue;
            // 启发：X 出现更少且名更短 → 交换净赚（精确账由 cost 文本预演兜底）
            if((occB - occX) * (b.name.length - 1) <= 0) continue;
            if(forbiddenSwap(X, b).has(b.name)) continue;
            if(forbiddenSwap(b, X).has(X.name)) continue;
            // 短名伙伴可以是别名条目所属 binding（v1 统一着色里高频局部抢占短名、
            // 低频别名落长名的增量表达——实证 luacheck/config：别名先占满 1 字符名，
            // 函数体内 ~7 个高频局部被迫用 2 字符名，净 +20）。条目经 renamedAliases
            // 换键随名迁移；双侧都是别名时换键序互删，保守跳过。
            var xIsAlias = ownsAliasEntry(X), bIsAlias = aliasNames.has(b.name);
            if(xIsAlias && bIsAlias) continue;
            var edits = [];
            X.decls.forEach(function(d){ edits.push({ start:d.range[0], end:d.range[1], text:b.name }); });
            X.uses.forEach(function(u){ edits.push({ start:u.range[0], end:u.range[1], text:b.name }); });
            b.decls.forEach(function(d){ edits.push({ start:d.range[0], end:d.range[1], text:X.name }); });
            b.uses.forEach(function(u){ edits.push({ start:u.range[0], end:u.range[1], text:X.name }); });
            var renamed = null;
            if(xIsAlias || bIsAlias){
              renamed = [];
              if(xIsAlias) renamed.push({ from: X.name, to: b.name });
              if(bIsAlias) renamed.push({ from: b.name, to: X.name });
            }
            var nX = X.decls.length + X.uses.length, nB = b.decls.length + b.uses.length;
            out.push({ id:'swap:' + X.name + '<->' + b.name, name:X.name, target:b.name,
                       _edits: edits, _renamed: renamed,
                       _arithDelta: nX * (b.name.length - X.name.length)
                                  + nB * (X.name.length - b.name.length) });
            break;   // 每个长名 binding 取首个可行短名伙伴（其余组合留给后续轮次）
          }
        });
        return out;
      },

      // cost：纯标识符替换（Name 类不变，邻接空白需求不变）——算术精确值，
      // 与 previewDelta 的 encodeDelta 实测逐字节相等（P2 性质由 lens_roundtrip 保证；
      // 实证 moses 827 候选 × 全文词法 = 40s/轮，算术化后 match+cost 亚秒）。
      cost: function(ir, cand){
        if(cand._arithDelta !== undefined) return { delta: cand._arithDelta, confidence: 'exact' };
        return { delta: previewDelta(ir, cand._edits, deps), confidence: 'exact' };
      },

      // extract：改名（decls+uses 全量替换）；交换候选带别名条目换键声明
      extract: function(ir, cand){
        var form = {};
        if(cand._renamed) form.renamedAliases = cand._renamed;
        return { edits: cand._edits, form: form, residue: {} };
      },

      // inject：改名的逆 = 再改一次名（canonical 的 SSA 归一对名字不敏感，
      // 默认 verify 的前向等价已覆盖；逆方向用于搜索层撤销，目标名取当前安全最短名）
      inject: function(ir, name){
        var info = ir.info;
        for(var i=0; i<info.bindings.length; i++){
          var b = info.bindings[i];
          if(b.name !== name || b.pinned) continue;
          var forbidden = new Set();
          info.bindings.forEach(function(o){
            if(o === b) return;
            if(info.chainOf(b.scope).has(o.scope.id) || info.chainOf(o.scope).has(b.scope.id))
              forbidden.add(o.name);
          });
          ex_rename_collectGlobals(ir, forbidden);
          var pick = ir._base._createNameAllocator(forbidden)();
          if(pick === null) return null;
          var edits = [];
          b.decls.forEach(function(d){ edits.push({ start:d.range[0], end:d.range[1], text:pick }); });
          b.uses.forEach(function(u){ edits.push({ start:u.range[0], end:u.range[1], text:pick }); });
          return { edits:edits, form:{}, residue:{} };
        }
        return null;
      }
    };
  }

  // inject 内部小助手：把全部全局名并入 forbidden（独立函数便于注释语义：
  // 改名不得撞上任何全局原名，否则会把全局读静默捕获成局部）。
  function ex_rename_collectGlobals(ir, forbidden){
    ir.info.varOf.forEach(function(b, node){ if(b === null) forbidden.add(node.name); });
  }

  /* ---------- 工厂与 part 注册 ---------- */

  // createAliasLenses(deps) -> [Lens]：别名族四枚透镜（注册顺序即默认拓扑序的 tiebreak）
  function createAliasLenses(deps){
    return [
      createGlobalAliasLens(deps),
      createMemberAliasLens(deps),
      createTransparentElisionLens(deps),
      createRenameLens(deps)
    ];
  }

  var api = { createAliasLenses: createAliasLenses, injectAlias: injectAlias,
              declItemDeleteEdits: declItemDeleteEdits, mkAliasDecl: mkAliasDecl,
              probeInjectableLocal: probeInjectableLocal, findAliasDecl: findAliasDecl,
              ALIAS_EVIDENCE: EVIDENCE };
  (root.__LuaMin2Parts = root.__LuaMin2Parts || []).push({
    name: 'lenses/alias',
    install: function(C){ for(var k in api) C[k] = api[k]; }
  });
  root.__LuaMin2Modules = root.__LuaMin2Modules || {};
  root.__LuaMin2Modules['lenses/alias'] = api;
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
