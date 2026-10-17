/* ===================================================================
 * LuaMin v2 lens family: chain — 成员链 CSE 透镜（M4）
 * 移植 v1 foldMemberChain：重复出现的稳定纯成员访问链 t.f1.f2 提取为局部别名。
 *
 * §6.2 核心修复：纯度证据来自 IR 证据槽【单一实现】——ir.js 注册的
 * 'metatableFree'（v1 analyzeMetatableFree 原函数），match 与 verify 消费同一份，
 * 不再有"纯度闸门与 canonical 双侧还原两份实现手工对齐"的漂移面。
 *
 * inject 方向：复用 alias.js 的 injectAlias——extract 产物（AliasEnv kind='chain'）
 * 与输入自带整链别名（local e=t.x 形态）同样可撤销。
 * =================================================================== */
(function(root){
  'use strict';

  var irMod = null, lensMod = null, aliasMod = null, canonMod = null;
  if(typeof module !== 'undefined' && module.exports){
    irMod = require('../ir.js');
    lensMod = require('../lens.js');
    aliasMod = require('./alias.js');
    canonMod = require('../canonical2.js');
  }else if(root.__LuaMin2Modules){
    irMod = root.__LuaMin2Modules['ir'];
    lensMod = root.__LuaMin2Modules['lens'];
    aliasMod = root.__LuaMin2Modules['lenses/alias'];
    canonMod = root.__LuaMin2Modules['canonical2'];
  }
  function needIR(){ if(!irMod) throw new Error('chain.js: 需要 src2/ir.js'); return irMod; }

  function walkAst(node, visit){
    if(!node || typeof node !== 'object') return;
    if(Array.isArray(node)){ for(var i=0;i<node.length;i++) walkAst(node[i], visit); return; }
    if(visit(node) === false) return;
    for(var k in node){
      if(k === 'range' || k === 'loc') continue;
      if(Object.prototype.hasOwnProperty.call(node, k)) walkAst(node[k], visit);
    }
  }

  function createChainLens(deps){
    var noMetatable = !!(deps && deps.noMetatable);

    function strContent(node){
      if(!node || node.type !== 'StringLiteral') return null;
      if(typeof node.value === 'string') return node.value;
      var raw = node.raw || '';
      if(raw.length >= 2 && (raw[0] === '"' || raw[0] === "'")) return raw.slice(1,-1);
      return raw;
    }

    return {
      name: 'chain.cse', kind: 'extract', commitAtZero: true,
      requires: ['ssa', 'metatableFree'], provides: ['alias:chain'], consumes: [], conflicts: [],
      match: function(ir){
        var src = ir.src, info = ir.info, IR = needIR();
        // 纯度证据：单一实现（INV-2 惰性槽；与任何 verify 同源）
        var mf = IR.getEvidence(ir, 'metatableFree');

        // byName 反向映射：别名名 -> 目标文本（全局别名 + 输入透明别名，v1 globalByAlias 口径）
        var globalByAlias = {};
        ir.aliases.entries.forEach(function(e, n){
          if(e.kind === 'global') globalByAlias[n] = e.target;
        });

        // binding -> 声明 init（一次性收集，v1 bindingInitMap 同构）
        var bindingInitMap = new Map();
        walkAst(ir.ast.body, function(n){
          if(n.type === 'LocalStatement' && n.variables && n.init){
            for(var i=0;i<n.variables.length;i++){
              var v = n.variables[i];
              if(v.type === 'Identifier'){
                var b = info.varOf.get(v);
                if(b && !bindingInitMap.has(b)) bindingInitMap.set(b, n.init[i] || null);
              }
            }
          }
        });
        // 输入自带透明别名（local x=Global 只读单声明）也视为全局别名（v1 扩展逻辑）
        info.bindings.forEach(function(b){
          if(b.decls.length !== 1 || globalByAlias[b.name] !== undefined) return;
          var init = bindingInitMap.get(b);
          if(init && init.type === 'Identifier' && info.varOf.get(init) === null)
            globalByAlias[b.name] = init.name;
        });

        function initInfo(b){
          var decl = b.decls[0], found = null;
          walkAst(ir.ast.body, function(n){
            if(found) return false;
            if(n.type === 'LocalStatement' && n.variables && n.init){
              for(var i=0;i<n.variables.length;i++){
                if(n.variables[i] === decl){ found = { init: n.init[i] || null, stmtEnd: n.range[1] }; return false; }
              }
            }
          });
          return found;
        }
        function traceLiteralPath(ctor, fields){
          var cur = ctor;
          for(var i=0;i<fields.length;i++){
            var val = null;
            if(cur && cur.type === 'TableConstructorExpression'){
              for(var j=0;j<cur.fields.length;j++){
                var f = cur.fields[j], keyName = null;
                if(f.type === 'TableKeyString' && f.key) keyName = f.key.name;
                else if(f.type === 'TableKey' && f.key && f.key.type === 'StringLiteral') keyName = strContent(f.key);
                if(keyName === fields[i]){ val = f.value; break; }
              }
            }
            if(val === null) return false;
            if(i < fields.length-1 && val.type !== 'TableConstructorExpression') return false;
            cur = val;
          }
          return true;
        }
        function rootAndFields(node){
          var fields = [], cur = node;
          while(cur && cur.type === 'MemberExpression' && cur.indexer === '.'){
            fields.unshift(cur.identifier.name);
            cur = cur.base;
          }
          if(cur && cur.type === 'Identifier') return { root: cur, fields: fields };
          return null;
        }

        // 写目标集合（成员/索引赋值位置不提取）
        var writeTargets = new Set();
        walkAst(ir.ast.body, function(n){
          if(n.type === 'AssignmentStatement' && n.variables){
            n.variables.forEach(function(tv){
              if(tv && tv.range && (tv.type === 'MemberExpression' || tv.type === 'IndexExpression'))
                writeTargets.add(tv.range[0] + ':' + tv.range[1]);
            });
          }
        });

        // 索引是否为"字符串/成员别名"（b[c] / b['x'] 可还原为 b.Field）
        function indexStringField(idx){
          if(!idx) return null;
          if(idx.type === 'StringLiteral') return strContent(idx);
          if(idx.type === 'Identifier'){
            var ib = info.varOf.get(idx);
            if(ib){
              var e = ir.aliases.entries.get(idx.name);
              if(e && (e.kind === 'member' || e.kind === 'string')) return e.target;
              if(ib.decls.length === 1){
                var ii = bindingInitMap.get(ib);
                if(ii && ii.type === 'StringLiteral') return strContent(ii);
              }
            }
          }
          return null;
        }

        // 收集读链（点链 + 字符串别名索引链），写目标除外
        var chainGroups = new Map();   // text -> [site]
        (function collect(n){
          if(!n || typeof n !== 'object') return;
          if(Array.isArray(n)){ for(var i2=0;i2<n.length;i2++) collect(n[i2]); return; }
          if(n.type === 'FunctionDeclaration'){ collect(n.body); return; }   // identifier 链不收集，只递归体
          if(n.type === 'MemberExpression' && n.indexer === '.' && n.range && n.identifier){
            if(!writeTargets.has(n.range[0] + ':' + n.range[1])){
              var rf = rootAndFields(n);
              if(rf){
                var text = src.slice(n.range[0], n.range[1]);
                if(!chainGroups.has(text)) chainGroups.set(text, []);
                chainGroups.get(text).push({ range: n.range, root: rf.root, fields: rf.fields,
                  rootAlias: globalByAlias[rf.root.name] !== undefined ? rf.root.name : null,
                  indexAlias: null });
              }
            }
          }else if(n.type === 'IndexExpression' && n.range && n.base && n.base.type === 'Identifier'){
            var fieldName = indexStringField(n.index);
            if(fieldName != null && !writeTargets.has(n.range[0] + ':' + n.range[1])){
              var idxAliasName = (n.index.type === 'Identifier') ? n.index.name : null;
              var chainText = n.base.name + '.' + fieldName;
              if(!chainGroups.has(chainText)) chainGroups.set(chainText, []);
              chainGroups.get(chainText).push({ range: n.range, root: n.base, fields: [fieldName],
                rootAlias: globalByAlias[n.base.name] !== undefined ? n.base.name : null,
                indexAlias: idxAliasName });
            }
          }
          for(var k in n){
            if(k === 'range' || k === 'loc') continue;
            if(Object.prototype.hasOwnProperty.call(n, k)) collect(n[k]);
          }
        })(ir.ast.body);

        //  purity 判定（safe / noMetatable 两档，v1 isPureChain 逐字语义）
        function isPureChain(site){
          var b = info.varOf.get(site.root);
          if(noMetatable){
            if(b) return mf.stableBindings.has(b);
            // 全局根：本透镜是【新建快照】（local d=G.F 重复链提取）——恒定才可抽取。
            // assignedGlobals 含代码内被赋值者与 UI 可变黑名单（buildIR 并入），
            // 两者都意味着 G 运行时可变，快照固化不等价，判不纯。
            // 注意区分：代码中【已有】 local d=G.F（b!==null）是用户自选的快照形态，
            // 其复用/合并不受此闸约束（stableBindings 口径，与黑名单无关）。
            if(info.assignedGlobals && info.assignedGlobals.has(site.root.name)) return false;
            return !mf.setmetatableUsed;   // 用户断言无元表，但本代码调过 setmetatable 则不稳
          }
          if(!b || !mf.pureBindings.has(b)) return false;
          if(mf.setmetatableUsed) return false;
          if(site.fields.length >= 2){
            var ii = initInfo(b);
            if(!ii || !ii.init || !traceLiteralPath(ii.init, site.fields)) return false;
          }
          return true;
        }

        // 声明插入位置：晚于头部别名声明与 root 自己的声明（取较大者）
        function insertPosOf(rootNode){
          var headerEnd = 0;
          var drop = ir.aliases.dropLeading || 0;
          if(drop > 0 && drop <= ir.ast.body.length && ir.ast.body[drop-1].range)
            headerEnd = ir.ast.body[drop-1].range[1];
          var b = info.varOf.get(rootNode);
          if(!b) return headerEnd;
          var ii = initInfo(b);
          return Math.max(headerEnd, ii ? ii.stmtEnd : 0);
        }

        var taken = ir._base._collectTakenNames(ir.ast);
        ir.aliases.entries.forEach(function(_, n){ taken.add(n); });

        var out = [], priority = [];
        chainGroups.forEach(function(sites, text){
          if(sites.length < 2) return;
          if(!isPureChain(sites[0])) return;
          var chainLen = text.length;
          var saving = sites.length * (chainLen-1) - (8 + chainLen);   // v1 盈亏公式
          if(saving <= 0) return;
          var alias = ir._base._createNameAllocator(new Set(taken))();
          if(!alias) return;
          taken.add(alias);   // 让后续链分配到不同名（共享根组候选会同时提交多条链，重名会冲突）
          var insertPos = insertPosOf(sites[0].root);
          out.push({
            id: 'chain:' + text + '@' + sites[0].range[0],
            chainText: text, sites: sites, alias: alias, insertPos: insertPos,
            rootAlias: sites[0].rootAlias, indexAlias: sites[0].indexAlias, fields: sites[0].fields
          });
        });
        // 共享根联合提取（组候选）：rootAlias 被 ≥2 条链共享、且根的全部读点都被这些链的
        // site 覆盖时，一次把同根的链全部按全局长名（root.target.fields）提取、删根。
        // 逐链提取时先提的链的声明里仍在读根（a=m.X），导致后提的链永远吃不干净根、留下
        // 冗余根声明（m=Isaac + a=m.AddCallback 的实证）；联合提取直接产出 Isaac.AddCallback
        // 形态，根随删（Isaac.AddCallback 被拆成 Isaac+'AddCallback' 的修复）。
        var byRoot = new Map();
        out.forEach(function(c){
          if(!c.rootAlias) return;
          if(!byRoot.has(c.rootAlias)) byRoot.set(c.rootAlias, []);
          byRoot.get(c.rootAlias).push(c);
        });
        byRoot.forEach(function(cands, rootName){
          if(cands.length < 2) return;
          // 根目标全局名：entries 里的 global 条目 或 源内透明别名（local x=Global）都登记在
          // globalByAlias——源内别名（local m=Isaac）不在 aliases.entries，须从 globalByAlias 取。
          var rootTarget = globalByAlias[rootName];
          if(rootTarget === undefined) return;
          var total = 0;
          info.bindings.forEach(function(b){ if(b.name === rootName) total += b.uses.length; });
          var covered = 0;
          cands.forEach(function(c){ covered += c.sites.length; });
          if(total === 0 || total !== covered) return;   // 根还有链外读点：不可删根
          priority.push({
            id: 'chaingroup:' + rootName + '@' + cands[0].sites[0].range[0],
            _group: true, rootAlias: rootName, rootTarget: rootTarget, chains: cands,
            insertPos: cands[0].insertPos
          });
        });
        // 单链根改写：根别名 R 的全部读点都是同一条链 R.F 的 site（R 仅此一条链）时，
        // 把 R 的声明初值直接改写为全链 R.target.F、site 全部还原为 R——比「根 + 新别名」
        // 更省（省掉新别名声明的开销）。覆盖 local c=CallbackPriority + c.EARLY 场景。
        chainGroups.forEach(function(sites, text){
          var R = sites[0].rootAlias;
          if(!R) return;
          var rootTarget = globalByAlias[R];
          if(rootTarget === undefined) return;
          var chainCount = 0;
          chainGroups.forEach(function(s2){ if(s2[0].rootAlias === R) chainCount++; });
          if(chainCount !== 1) return;   // 多链场景交给上面的组提取
          var total = 0;
          info.bindings.forEach(function(b){ if(b.name === R) total += b.uses.length; });
          if(total === 0 || total !== sites.length) return;   // R 还有链外读点
          priority.push({
            id: 'chainretarget:' + text + '@' + sites[0].range[0],
            _retarget: true, rootAlias: R, rootTarget: rootTarget,
            fields: sites[0].fields, sites: sites
          });
        });
        // 组提取与单链根改写优先于逐链个体候选——盈亏平衡时也产出整链/改写形态（用户
        // 明确期望 Isaac.AddCallback / CallbackPriority.EARLY 整链，且等长不花成本）。
        return priority.concat(out);
      },

      cost: function(ir, cand){
        var built = cand._group ? buildGroupEdits(ir, cand)
                  : (cand._retarget ? buildRetargetEdits(ir, cand) : buildChainEdits(ir, cand));
        return { delta: lensMod.encodeDelta(ir.src, needIR().applyTextEdits(ir.src, built.edits), deps), confidence: 'exact' };
      },

      // extract：插入整链别名声明 + 使用点替换；完全消耗的全局/索引别名连带删声明
      extract: function(ir, cand){
        if(cand._retarget){
          var builtR = buildRetargetEdits(ir, cand);
          // 根别名是【已存在】的声明（仅改初值），非透镜注入——declRange=null + injected，
          // 走绑定级存活校验（INV-1 同 localsMerge 合批注入的口径）。
          return { edits: builtR.edits, form: { aliasEntries: [{ name: cand.rootAlias, entry: {
            kind: 'chain', target: builtR.fullText, declRange: null, injected: true,
            introducedBy: 'chain.cse', roundtripKey: cand.id
          }}] }, residue: {} };
        }
        if(cand._group){
          var builtG = buildGroupEdits(ir, cand);
          var aliasEntries = cand.chains.map(function(ch, i){
            return { name: ch.alias, entry: {
              kind: 'chain', target: builtG.fullTexts[i], declRange: null, injected: true,
              introducedBy: 'chain.cse', roundtripKey: cand.id + '/' + ch.alias
            } };
          });
          return { edits: builtG.edits, form: { aliasEntries: aliasEntries },
                   residue: { removedAliases: builtG.removedAliases } };
        }
        var built = buildChainEdits(ir, cand);
        var form = { aliasEntries: [{ name: cand.alias, entry: {
          kind: 'chain', target: built.chainText, declRange: built.declRange,
          introducedBy: 'chain.cse', roundtripKey: cand.id
        }}] };
        if(built.isLeading) form.dropLeading = 1;
        return { edits: built.edits, form: form, residue: { removedAliases: built.removedAliases } };
      },

      inject: aliasMod ? aliasMod.injectAlias : null,   // 双向：整链别名内联（含输入自带）

      // verify 覆盖：双侧还原（各自 AliasEnv 重建 aliasMap 后 canonical 比对）——
      // extract 可能同时消耗旧别名（全局/索引别名删声明），单向 inject 回放无法覆盖，
      // 双侧还原是唯一不漂移的口径（§6.2：与终审同一实现）。
      verify: function(ir, cand, result){
        try{
          var ka, kb;
          var amA = canonMod.buildAliasMap(ir), amB = canonMod.buildAliasMap(result.ir);
          ka = amA ? ir._base._canonical(ir.src, amA) : ir._base._canonical(ir.src);
          kb = amB ? ir._base._canonical(result.ir.src, amB) : ir._base._canonical(result.ir.src);
          return ka === kb;
        }catch(e){ return false; }
      }
    };

    // buildChainEdits(ir, cand)：构造声明插入 + 使用替换 + 被消耗别名删除的完整编辑组
    function buildChainEdits(ir, cand){
      var src = ir.src, info = ir.info;
      var chainText = cand.chainText;
      var removedAliases = [];
      var edits = [];

      // root 别名完全消耗：该别名所有使用都被本链覆盖 → 链文本用全局名展开 + 删别名声明
      if(cand.rootAlias && ir.aliases.entries.has(cand.rootAlias)){
        var total = 0;
        info.bindings.forEach(function(b){ if(b.name === cand.rootAlias) total += b.uses.length; });
        if(total > 0 && total <= cand.sites.length){
          chainText = ir.aliases.entries.get(cand.rootAlias).target + '.' + cand.fields.join('.');
          removedAliases.push(cand.rootAlias);
        }
      }
      // 索引别名完全消耗（f[h] 反转成 f.Field 后 h 的声明可删）
      if(cand.indexAlias && ir.aliases.entries.has(cand.indexAlias)){
        var total2 = 0;
        info.bindings.forEach(function(b){ if(b.name === cand.indexAlias) total2 += b.uses.length; });
        if(total2 > 0 && total2 <= cand.sites.length) removedAliases.push(cand.indexAlias);
      }

      // 删除被消耗别名的声明项（复用 alias.js 的区间合并删除）。
      // 注意：rootAlias 与 indexAlias 可能来自同一条 local 声明，必须按语句合并下标后
      // 一次性删除，否则独立删除的区间会重叠（frame-operation 等多别名合并声明场景）。
      var deleteByStmt = new Map();
      removedAliases.forEach(function(name){
        var found = findDeclStmt(ir, name);
        if(found){
          if(!deleteByStmt.has(found.st)) deleteByStmt.set(found.st, new Set());
          deleteByStmt.get(found.st).add(found.vi);
        }
      });
      deleteByStmt.forEach(function(viSet, st){
        var vis = Array.from(viSet).sort(function(a,b){ return a-b; });
        edits = edits.concat(aliasMod.declItemDeleteEdits(st, vis));
      });

      // 插入声明（统一前置空格断开标识符粘连，v1 同规则）
      var sep = (cand.insertPos > 0) ? ' ' : '';
      var declText = sep + 'local ' + cand.alias + '=' + chainText + ' ';
      var declRange = [cand.insertPos + sep.length, cand.insertPos + sep.length + 6 + cand.alias.length];
      edits.push({ start: cand.insertPos, end: cand.insertPos, text: declText });
      cand.sites.forEach(function(s){
        edits.push({ start: s.range[0], end: s.range[1], text: cand.alias });
      });
      // 插入位置是否落在头部（紧跟既有别名头）→ dropLeading 计数
      var drop = ir.aliases.dropLeading || 0;
      var headerEnd = 0;
      if(drop > 0 && drop <= ir.ast.body.length && ir.ast.body[drop-1].range)
        headerEnd = ir.ast.body[drop-1].range[1];
      return { edits: edits, chainText: chainText, declRange: declRange,
               removedAliases: removedAliases, isLeading: cand.insertPos <= headerEnd };
    }

    // buildGroupEdits(ir, cand)：共享根联合提取的完整编辑组——同根的链全部按全局长名
    // （rootTarget.fields）提取并插入声明，site 替换为各自别名，根与被消耗索引别名连带
    // 删声明（按语句合并下标后一次性删除，防区间重叠）。
    function buildGroupEdits(ir, cand){
      var src = ir.src, info = ir.info;
      var edits = [];
      var fullTexts = [];
      var removedAliases = [cand.rootAlias];

      cand.chains.forEach(function(ch){
        var fullText = cand.rootTarget + '.' + ch.fields.join('.');
        fullTexts.push(fullText);
        // 插入声明（统一前置空格断开标识符粘连，v1 同规则）
        var sep = (ch.insertPos > 0) ? ' ' : '';
        edits.push({ start: ch.insertPos, end: ch.insertPos, text: sep + 'local ' + ch.alias + '=' + fullText + ' ' });
        ch.sites.forEach(function(s){
          edits.push({ start: s.range[0], end: s.range[1], text: ch.alias });
        });
        // 索引别名完全消耗（f[h] 反转成 f.Field 后 h 的声明可删）
        if(ch.indexAlias && ir.aliases.entries.has(ch.indexAlias)){
          var total2 = 0;
          info.bindings.forEach(function(b){ if(b.name === ch.indexAlias) total2 += b.uses.length; });
          if(total2 > 0 && total2 <= ch.sites.length && removedAliases.indexOf(ch.indexAlias) < 0)
            removedAliases.push(ch.indexAlias);
        }
      });

      // 删除根 + 被消耗索引别名（按语句合并下标后一次性删除，防区间重叠）
      var deleteByStmt = new Map();
      removedAliases.forEach(function(name){
        var found = findDeclStmt(ir, name);
        if(found){
          if(!deleteByStmt.has(found.st)) deleteByStmt.set(found.st, new Set());
          deleteByStmt.get(found.st).add(found.vi);
        }
      });
      deleteByStmt.forEach(function(viSet, st){
        var vis = Array.from(viSet).sort(function(a,b){ return a-b; });
        edits = edits.concat(aliasMod.declItemDeleteEdits(st, vis));
      });

      return { edits: edits, fullTexts: fullTexts, removedAliases: removedAliases };
    }

    // buildRetargetEdits(ir, cand)：单链根改写——把根别名声明的初值改写为全链
    // （rootTarget.fields），site 全部还原为根别名。根别名仍保留（其 AliasEnv 条目经
    // extract 的 form 登记为全链别名，canonical 归一按新初值还原）。
    function buildRetargetEdits(ir, cand){
      var edits = [];
      var fullText = cand.rootTarget + '.' + cand.fields.join('.');
      var initRange = null;
      var found = findDeclStmt(ir, cand.rootAlias);
      if(found && found.st.init && found.st.init[found.vi] && found.st.init[found.vi].range){
        var ie = found.st.init[found.vi];
        initRange = [ie.range[0], ie.range[0] + ('local '.length + cand.rootAlias.length + 1)];
        edits.push({ start: ie.range[0], end: ie.range[1], text: fullText });
      }
      cand.sites.forEach(function(s){
        edits.push({ start: s.range[0], end: s.range[1], text: cand.rootAlias });
      });
      return { edits: edits, fullText: fullText, initRange: initRange };
    }

    // findDeclStmt：按名定位顶层声明语句项（供被消耗别名的删除编辑）
    function findDeclStmt(ir, name){
      for(var si=0; si<ir.ast.body.length; si++){
        var st = ir.ast.body[si];
        if(st.type !== 'LocalStatement' || !st.variables) continue;
        for(var vi=0; vi<st.variables.length; vi++){
          if(st.variables[vi].type === 'Identifier' && st.variables[vi].name === name)
            return { st: st, vi: vi };
        }
      }
      return null;
    }
  }

  /* ---------- 工厂与 part 注册 ---------- */

  // createChainLenses(deps) -> [Lens]：成员链 CSE（deps.noMetatable 切换纯度档位）
  function createChainLenses(deps){
    return [ createChainLens(deps) ];
  }

  var api = { createChainLenses: createChainLenses };
  (root.__LuaMin2Parts = root.__LuaMin2Parts || []).push({
    name: 'lenses/chain',
    install: function(C){ for(var k in api) C[k] = api[k]; }
  });
  root.__LuaMin2Modules = root.__LuaMin2Modules || {};
  root.__LuaMin2Modules['lenses/chain'] = api;
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
