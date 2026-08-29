/* LuaMin part: folds — 由 _refactor_split.js 从 core.js 抽取，函数体逐字保留 */
(function(root){
  'use strict';
  (root.__LuaMinParts = root.__LuaMinParts || []).push({name:'folds', install:function(C){
    var KEYWORDS=C.KEYWORDS, luaValidate=C.luaValidate, parse=C.parse, analyze=C.analyze, candidateGenerator=C.candidateGenerator, applyEdits=C.applyEdits, applyEncoding=C.applyEncoding, canonical=C.canonical, assertEquivalentAlias=C.assertEquivalentAlias, assertParses=C.assertParses, isNamePart=C.isNamePart, fengari=C.fengari;

    function canCommit(originalCode, candidate, aliasMap){
      if(luaValidate && luaValidate(candidate)) return false;
      try{
        parse(candidate);
        return canonical(originalCode)===canonical(candidate, aliasMap);
      }catch(e){ return false; }
    }
    function preprocess(input){
      var lines=input.replace(/\r\n?/g,'\n').split('\n');
      var stripped=lines.map(function(line){
        return line.replace(/^[ \t]*(?:lua|l)[ \t]+/, '');
      });
      return stripped.join('\n');
    }

    // ---------- :method 折叠（安全 + 严格"只缩短"闸门） ----------
    // 仅折叠 base 为【简单标识符】的 obj:M(args)（读变量两次无副作用，避免双求值）。
    // 改写：obj:M(args) → obj[s](obj,args)，并提取 s='M'。
    // 用真实长度对比做最终闸门：只有"折叠后整体更短"才提交，否则放弃。
    // src 已是结构折叠后的代码；priorAlias 是其别名映射（用于等价校验时的还原）。
    function foldMethods(src, priorAlias, steps, rec, originalCode){
      var ast;
      try{ ast=parse(src); }catch(e){ return null; }

      // 收集 :method 调用（base 为 Identifier）
      var sites=[]; // {method, baseText, colonPos, idEnd, lparenPos, hasArgs}
      (function walk(n){
        if(!n||typeof n!=='object') return;
        if(Array.isArray(n)){ for(var i=0;i<n.length;i++) walk(n[i]); return; }
        if(n.type==='CallExpression' && n.base && n.base.type==='MemberExpression' && n.base.indexer===':'){
          var me=n.base;
          if(me.base && me.base.type==='Identifier' && me.base.range && me.identifier.range){
            var baseText=src.slice(me.base.range[0], me.base.range[1]);
            var colonPos=me.base.range[1];      // ':' 位置
            var idEnd=me.identifier.range[1];    // 方法名结束
            // 找 '(' ：identifier 之后第一个 '('
            var lp=src.indexOf('(', idEnd);
            var hasArgs=(n.arguments && n.arguments.length>0);
            sites.push({method:me.identifier.name, baseText:baseText, colonPos:colonPos, idEnd:idEnd, lparenPos:lp, hasArgs:hasArgs});
          }
        }
        for(var k in n){ if(k!=='range'&&k!=='loc'&&Object.prototype.hasOwnProperty.call(n,k)) walk(n[k]); }
      })(ast.body);

      if(!sites.length) return null;

      // 按方法名分组
      var byMethod={};
      sites.forEach(function(s){ (byMethod[s.method]=byMethod[s.method]||[]).push(s); });

      // 已占用名字：解析 src 的所有标识符（保守地全部纳入）+ 关键字
      var taken=new Set(); Object.keys(KEYWORDS).forEach(function(k){taken.add(k);});
      (function collectNames(n){
        if(!n||typeof n!=='object')return;
        if(Array.isArray(n)){n.forEach(collectNames);return;}
        if(n.type==='Identifier'&&n.name) taken.add(n.name);
        for(var k in n){ if(k!=='range'&&k!=='loc'&&Object.prototype.hasOwnProperty.call(n,k)) collectNames(n[k]); }
      })(ast.body);
      var POOL=candidateGenerator();
      function nextName(){ for(var i=0;i<POOL.length;i++){ if(!taken.has(POOL[i])&&!KEYWORDS[POOL[i]]){ taken.add(POOL[i]); return POOL[i]; } } return null; }

      // 选取要折叠的方法（频次≥2 才有意义；单次折叠 self 重复几乎总是变长）
      var chosen=[]; // {method, alias, sites}
      var methodNames=Object.keys(byMethod).sort(function(a,b){return byMethod[b].length-byMethod[a].length;});
      methodNames.forEach(function(mname){
        var group=byMethod[mname];
        if(group.length<2) return;       // 单次调用：self 重复必然变长，跳过
        var alias=nextName();
        if(!alias) return;
        chosen.push({method:mname, alias:alias, sites:group});
      });
      if(!chosen.length) return null;

      // 构造 edits：把每处 obj:M(  →  obj[alias](obj,   或  obj[alias](obj)
      var edits=[];
      var memberByLocal = priorAlias && priorAlias.memberByLocal ? Object.assign({}, priorAlias.memberByLocal) : {};
      chosen.forEach(function(c){
        memberByLocal[c.alias]=c.method;
        c.sites.forEach(function(s){
          // [colonPos, idEnd) 即 ":M" → "[alias]"
          edits.push({start:s.colonPos, end:s.idEnd, name:'['+c.alias+']'});
          // 在 '(' 之后插入 self：obj 或 obj,
          if(s.lparenPos>=0){
            edits.push({start:s.lparenPos+1, end:s.lparenPos+1, name: s.hasArgs ? (s.baseText+',') : s.baseText});
          }
        });
      });

      var newBody = applyEdits(src, edits);

      // 把新别名并进开头的声明里。src 开头可能已是 "local ... " 或 "@-style"；
      // 简单稳妥：再加一条独立 local 在最前面。
      // 正确 Lua 格式：local a,b='x','y'（所有名字在前，一个 =，所有值在后）
      var declNames = chosen.map(function(c){return c.alias;}).join(',');
      var declVals  = chosen.map(function(c){return "'"+c.method+"'";}).join(',');
      var candidate = 'local '+declNames+'='+declVals+' '+newBody;

      // 严格闸门：必须真的更短，否则放弃（不折叠）
      if(candidate.length >= src.length){
        if(rec) rec(':method 折叠(放弃: 不缩短)', src.length, src.length, '候选 '+candidate.length+' ≥ 当前 '+src.length+'，按规则不折叠');
        return null;
      }

      // 语法 + 等价校验（把新 method 别名也并入 memberByLocal 还原）
      var newAlias = {
        byName: (priorAlias&&priorAlias.byName)||{},
        memberByLocal: memberByLocal,
        factorLocals: (priorAlias&&priorAlias.factorLocals)||[],
        prefixFoldByLocal: Object.assign({}, (priorAlias&&priorAlias.prefixFoldByLocal)||{}),
        stringAliasByLocal: Object.assign({}, (priorAlias&&priorAlias.stringAliasByLocal)||{}),
        dropLeading: ((priorAlias&&priorAlias.dropLeading)||0) + 1   // 多了一条 local 声明
      };
      if(!canCommit(originalCode, candidate, newAlias)) return null;
      assertParses(candidate, 'method-fold/syntax', steps);
      assertEquivalentAlias(originalCode, candidate, newAlias, '阶段1.4/等价', steps);
      if(rec) rec(':method 折叠(提交)', src.length, candidate.length,
                  '折叠 '+chosen.map(function(c){return c.method+'×'+c.sites.length;}).join(', '));
      return {code:candidate, aliasMap:newAlias};
    }

    // ---------- 字段前缀折叠（点：obj.PREFIX_X 系列共享前缀提取因子） ----------
    // 对每个共享公共前缀 P 的成员访问族群（如 obj.ACTION_LEFT/RIGHT/UP/DOWN/SHOOTLEFT...），
    // 提取 local U='P'，把每处 obj.P_X 改写成 obj[U..'rest']，前提是【实测严格更短】。
    // 等价校验由 canonical 的 prefixFoldByLocal 还原识别。
    //
    // 收益分析（per-site，字符级精算）：
    //   原 .PREFIX_REST 长度 = 1（'.'）+ |P| + |R|
    //   新 [U..'REST']  长度 = 1（'['）+ |U| + 2（'..'）+ 1（'\''）+ |R| + 1（'\''）+ 1（']'）= 6+|U|+|R|
    //   per-site 省 = |P| − |U| − 5。|U|=1 时 |P|≥7 才有 ≥1 字/处的纯收益。
    //   独立 local 声明开销 = 'local '（6）+ |U| + '='（1）+ '\''（1）+ |P| + '\''（1）+ ' '（1，分隔后续）= |U|+|P|+10
    //   总判定：站点数 N，per-site_gain*N > 声明开销。这里用真实 candidate.length 做最终闸门。
    function foldFieldPrefix(src, priorAlias, steps, rec, originalCode){
      var ast; try{ ast=parse(src); }catch(e){ return null; }

      // 收集所有 obj.Field（indexer '.'），按字段名分组并记录每处 [baseEnd, idEnd) 区间。
      // 注意：FunctionDeclaration 的 identifier 链（function a.b.c:d() 里的整条 a.b.c:d）必须保持
      // `name(.name)*(:name)?` 语法形态，不能改写成 [alias]，否则真·Lua 语法校验会拒绝。
      // 因此整棵 identifier 子树跳过，只递归函数体。
      var fieldSites=Object.create(null); // field -> [{baseEnd, idEnd}]
      (function walk(n){
        if(!n||typeof n!=='object') return;
        if(Array.isArray(n)){ for(var i=0;i<n.length;i++) walk(n[i]); return; }
        if(n.type==='FunctionDeclaration'){ walk(n.body); return; }
        if(n.type==='MemberExpression' && n.indexer==='.' && n.identifier && n.base && n.base.range && n.identifier.range){
          var f=n.identifier.name;
          (fieldSites[f]=fieldSites[f]||[]).push({baseEnd:n.base.range[1], idEnd:n.identifier.range[1]});
        }
        for(var k in n){ if(k!=='range'&&k!=='loc'&&Object.prototype.hasOwnProperty.call(n,k)) walk(n[k]); }
      })(ast.body);

      // 已占名字（不与现有标识符 / 关键字冲突）
      var taken=new Set(); Object.keys(KEYWORDS).forEach(function(k){taken.add(k);});
      (function collectNames(n){
        if(!n||typeof n!=='object')return;
        if(Array.isArray(n)){n.forEach(collectNames);return;}
        if(n.type==='Identifier'&&n.name) taken.add(n.name);
        for(var k in n){ if(k!=='range'&&k!=='loc'&&Object.prototype.hasOwnProperty.call(n,k)) collectNames(n[k]); }
      })(ast.body);
      var POOL=candidateGenerator();
      function nextName(){ for(var i=0;i<POOL.length;i++){ if(!taken.has(POOL[i])&&!KEYWORDS[POOL[i]]){ taken.add(POOL[i]); return POOL[i]; } } return null; }

      // 候选前缀枚举：对每个 field 名拆出所有长度 ≥2 的前缀，找命中最多 + 长度最长的，
      // 进一步用乐观估算 (|P|−|U|−6)*sites − (|U|+|P|+4) > 0 预筛；最终仍由 candidate.length 闸门决定。
      // 候选前缀来源：
      //  (1) 字段名以 '_' 切分得到的所有 '_'-结尾前缀（覆盖 ACTION_、ACTION_SHOOT_… 之类的常量分段）；
      //  (2) 任意两个字段的最长公共前缀（覆盖如 ACTION_SHOOT 这种不以 '_' 结尾、但仍共享的前缀）。
      // 复杂度 O(F^2 + ΣL)，对常见规模可控。
      var fields=Object.keys(fieldSites);
      if(fields.length<2) return null;

      function prefixCandidates(field){
        var out=[], i=0;
        while(i<field.length){
          var u=field.indexOf('_', i);
          if(u<0) break;
          out.push(field.slice(0,u+1));    // 含尾部 '_'
          i=u+1;
        }
        return out;
      }
      function lcp(a, b){
        var i=0, n=Math.min(a.length, b.length);
        while(i<n && a.charCodeAt(i)===b.charCodeAt(i)) i++;
        return a.slice(0, i);
      }
      var prefixGroups=Object.create(null); // prefix -> [{field, sites:N}]
      function add(p, f){
        if(p.length<2) return;
        var cur=prefixGroups[p]=prefixGroups[p]||[];
        for(var i=0;i<cur.length;i++) if(cur[i].field===f) return;     // 去重
        cur.push({field:f, sites:fieldSites[f].length});
      }
      fields.forEach(function(f){ prefixCandidates(f).forEach(function(p){ add(p, f); }); });
      // 两两 LCP：把每对的 LCP 加为候选（覆盖非 '_' 结尾的共享前缀）。
      for(var i=0;i<fields.length;i++){
        for(var j=i+1;j<fields.length;j++){
          var pp=lcp(fields[i], fields[j]);
          add(pp, fields[i]); add(pp, fields[j]);
        }
      }

      // ---- 多级前缀拆分：候选前缀构成一棵树（父 = 最长真前缀候选），在树上做 DP ----
      // 每个候选节点有两种选择：抽取（作因子）或不抽取（递归到更深的候选）。
      // 抽取时可【独立】（alias='P'）或【派生】（alias=父alias..'seg'，仅当父已抽取）。
      // 访问成本（不含 obj，1 字别名估算）：无因子 .F = |F|+1；因子 [a..'rest'] = |F|−|P|+7。
      // 声明成本：独立 |P|+5（注入）；派生 |seg|+9（,a 占位 nil + a=a0..'seg' 独立赋值）。
      // DP 返回全局最优抽取集合，再由真实别名长度与 candidate.length 闸门兜底。
      var priorDrop=(priorAlias && priorAlias.dropLeading) || 0;
      var canInject=false;
      if(priorDrop>0 && priorDrop<=ast.body.length){
        var probeSt=ast.body[priorDrop-1];
        if(probeSt && probeSt.type==='LocalStatement' && probeSt.variables && probeSt.variables.length
           && probeSt.init && probeSt.init.length){
          var lastI=probeSt.init[probeSt.init.length-1];
          if(!(lastI && (lastI.type==='CallExpression'||lastI.type==='StringCallExpression'
                         ||lastI.type==='TableCallExpression'||lastI.type==='VarargLiteral'))){
            canInject=true;
          }
        }
      }
      var declOverhead = canInject ? 4 : 10;       // ',U=\'P\'' 或 'local U=\'P\' '

      var cands = Object.keys(prefixGroups).sort(function(a,b){ return a.length-b.length; });

      // 每个字段的最深候选前缀
      var deepestOf = Object.create(null);
      fields.forEach(function(f){
        var deep=null;
        for(var ci=0; ci<cands.length; ci++){
          var p=cands[ci];
          if(f.length>p.length && f.indexOf(p)===0){
            if(deep===null || p.length>deep.length) deep=p;
          }
        }
        deepestOf[f]=deep;
      });

      // 父/子关系：父 = 最长真前缀候选
      var parentOf = Object.create(null);
      cands.forEach(function(q){
        var par=null;
        for(var ci=0; ci<cands.length; ci++){
          var p=cands[ci];
          if(p===q) continue;
          if(q.length>p.length && q.indexOf(p)===0){
            if(par===null || p.length>par.length) par=p;
          }
        }
        parentOf[q]=par||'';
      });
      var childrenOf = Object.create(null);
      cands.forEach(function(q){
        var par=parentOf[q];
        (childrenOf[par]=childrenOf[par]||[]).push(q);
      });

      // ownedFields：node(''=根 或候选) -> [{field, sites}]
      var ownedFields = Object.create(null);
      fields.forEach(function(f){
        var d=deepestOf[f]||'';
        (ownedFields[d]=ownedFields[d]||[]).push({field:f, sites:fieldSites[f].length});
      });

      function accessLen(field, factorPrefix){
        if(factorPrefix==='') return field.length + 1;               // .F
        return field.length - factorPrefix.length + 7;               // [a..'rest']
      }
      function declCost(prefix, parentPrefix){
        if(parentPrefix==='') return prefix.length + 5;              // 独立 ,a='P'
        return (prefix.length - parentPrefix.length) + 9;            // 派生 ,a(nil) + a=a0..'seg'
      }

      var memo=Object.create(null);
      function solve(node, parentFactor){
        var key = node + '\u0000' + parentFactor;
        if(Object.prototype.hasOwnProperty.call(memo, key)) return memo[key];
        var owned = ownedFields[node] || [];
        var children = childrenOf[node] || [];
        var childRes1 = children.map(function(ch){ return solve(ch, parentFactor); });
        // 选项 1：不抽取 node（字段用祖先因子或原 .F）
        var cost1=0;
        owned.forEach(function(of){ cost1 += of.sites * accessLen(of.field, parentFactor); });
        childRes1.forEach(function(r){ cost1 += r.cost; });
        var chosen1=[];
        childRes1.forEach(function(r){ chosen1 = chosen1.concat(r.chosen); });
        // 选项 2：抽取 node（仅候选节点；根 '' 不可抽取）
        if(node!==''){
          var childRes2 = children.map(function(ch){ return solve(ch, node); });
          var cost2 = declCost(node, parentFactor);
          owned.forEach(function(of){ cost2 += of.sites * accessLen(of.field, node); });
          childRes2.forEach(function(r){ cost2 += r.cost; });
          if(cost2 < cost1){
            var chosen2 = [{prefix:node, parentPrefix:parentFactor}];
            childRes2.forEach(function(r){ chosen2 = chosen2.concat(r.chosen); });
            var res={cost:cost2, chosen:chosen2};
            memo[key]=res;
            return res;
          }
        }
        var res={cost:cost1, chosen:chosen1};
        memo[key]=res;
        return res;
      }

      var dpRes = solve('', '');
      var chosen = dpRes.chosen;   // [{prefix, parentPrefix}]
      if(!chosen.length) return null;

      // 拓扑排序：父先于子（别名分配与派生赋值都按此顺序）
      var chosenByPrefix = Object.create(null);
      chosen.forEach(function(c){ chosenByPrefix[c.prefix]=c; });
      var topo=[], visited=Object.create(null);
      function visitTopo(p){
        if(visited[p]) return;
        visited[p]=true;
        var c=chosenByPrefix[p];
        if(c && c.parentPrefix) visitTopo(c.parentPrefix);
        topo.push(c);
      }
      chosen.forEach(function(c){ visitTopo(c.prefix); });
      chosen = topo;

      // 分配真实别名
      var aliasOf = Object.create(null);
      var aliasOk = true;
      chosen.forEach(function(c){
        var a = nextName();
        if(!a){ aliasOk=false; return; }
        aliasOf[c.prefix]=a;
      });
      if(!aliasOk) return null;

      // 用真实别名长度复核：总成本仍须优于"不抽取"基线
      var baseline = 0;
      fields.forEach(function(f){ baseline += fieldSites[f].length * (f.length + 1); });
      var realCost = 0;
      chosen.forEach(function(c){
        var a=aliasOf[c.prefix], alen=a.length;
        if(!c.parentPrefix){
          realCost += alen + c.prefix.length + declOverhead;                       // 独立声明
        }else{
          var seg = c.prefix.length - c.parentPrefix.length;
          realCost += (alen + 1) + (alen + aliasOf[c.parentPrefix].length + seg + 5); // 派生
        }
      });
      fields.forEach(function(f){
        var cover=null;
        for(var i=0;i<chosen.length;i++){
          var c=chosen[i];
          if(f.length>c.prefix.length && f.indexOf(c.prefix)===0){
            if(cover===null || c.prefix.length>cover.length) cover=c.prefix;
          }
        }
        var a = cover ? aliasOf[cover] : null;
        realCost += fieldSites[f].length * (a ? (a.length + (f.length - cover.length) + 6) : (f.length + 1));
      });
      if(realCost >= baseline) return null;

      // 构造 edits：把每处 .PREFIX_X (区间 [baseEnd, idEnd)) 替换为 [alias..'rest']
      var edits=[];
      var newPrefixMap={};
      chosen.forEach(function(c){
        newPrefixMap[aliasOf[c.prefix]]=c.prefix;
      });
      fields.forEach(function(f){
        var cover=null;
        for(var i=0;i<chosen.length;i++){
          var c=chosen[i];
          if(f.length>c.prefix.length && f.indexOf(c.prefix)===0){
            if(cover===null || c.prefix.length>cover.length) cover=c.prefix;
          }
        }
        if(!cover) return;
        var a=aliasOf[cover];
        var rest=f.slice(cover.length);
        fieldSites[f].forEach(function(s){
          edits.push({start:s.baseEnd, end:s.idEnd, name:"["+a+"..'"+rest+"']"});
        });
      });

      // 只注入到「dropLeading 范围内的最后一条 batched local」——也就是 planAll 阶段
      // 产生的别名声明 `local A,B,C,...=v1,v2,v3,...`。注入形式 `,U='P'` 比独立
      // `local U='P' ` 省 6 字（一个 `local ` 关键字 + 一个分隔空格）。
      // 关键约束：必须只在 priorAlias 已宣告为别名头的前 N 条语句内注入；超出范围的
      // 普通 `local x=foo()` 不能注入，否则会改变其语义（多/少返回值截断）且引入
      // 一个 canonical 看不到 dropLeading 跳过的新变量，破坏等价校验。
      function findInjectableLocal(astNode){
        if(!astNode || !astNode.body) return null;
        var priorDrop=(priorAlias && priorAlias.dropLeading) || 0;
        if(priorDrop<=0) return null;             // 没有别名头时不能注入
        var idx=priorDrop-1;                       // 别名头的最后一条
        if(idx>=astNode.body.length) return null;
        var st=astNode.body[idx];
        if(!st || st.type!=='LocalStatement') return null;
        if(!st.variables||!st.variables.length) return null;
        if(!st.init||!st.init.length) return null;
        // 末值是多返回值表达式（call/vararg）时插入会被截断；保守拒绝注入。
        var lastInit=st.init[st.init.length-1];
        if(lastInit && (lastInit.type==='CallExpression'||lastInit.type==='StringCallExpression'
                        ||lastInit.type==='TableCallExpression'||lastInit.type==='VarargLiteral')) return null;
        return st;
      }
      var injectStmt=findInjectableLocal(ast, src);
      var independentChosen = chosen.filter(function(c){ return !c.parentPrefix; });
      var derivedChosen = chosen.filter(function(c){ return c.parentPrefix; });
      var candidate;
      var dropDelta;
      if(injectStmt){
        // 在最后一个变量名后插入 ',aliases'，在整条语句末尾插入 ',values'（仅独立因子）+ 派生赋值
        var lastVar=injectStmt.variables[injectStmt.variables.length-1];
        var stmtEnd=injectStmt.range[1];
        var injectNames=','+chosen.map(function(c){return aliasOf[c.prefix];}).join(',');
        var injectVals=independentChosen.length ? ','+independentChosen.map(function(c){return "'"+c.prefix+"'";}).join(',') : '';
        var assigns=derivedChosen.map(function(c){
          return aliasOf[c.prefix]+'='+aliasOf[c.parentPrefix]+"..'"+c.prefix.slice(c.parentPrefix.length)+"'";
        });
        var assignText=assigns.join('');
        var lastTailChar = injectVals.length ? injectVals[injectVals.length-1] : src[stmtEnd-1];
        var assignSep = (assignText && isNamePart(lastTailChar)) ? ' ' : '';
        var allEdits=edits.concat([
          {start:lastVar.range[1], end:lastVar.range[1], name:injectNames},
          {start:stmtEnd, end:stmtEnd, name:injectVals+assignSep+assignText}
        ]);
        candidate=applyEdits(src, allEdits);
        dropDelta=0;     // 没新增 local 语句，dropLeading 不增
      }else{
        // 退路：独立 local（独立因子有值、派生因子 nil）+ 派生赋值
        var newBody = applyEdits(src, edits);
        var declNames = chosen.map(function(c){return aliasOf[c.prefix];}).join(',');
        var declVals  = independentChosen.map(function(c){return "'"+c.prefix+"'";}).join(',');
        var assigns2 = derivedChosen.map(function(c){
          return aliasOf[c.prefix]+'='+aliasOf[c.parentPrefix]+"..'"+c.prefix.slice(c.parentPrefix.length)+"'";
        }).join('');
        candidate = 'local '+declNames+'='+declVals+' '+(assigns2?assigns2:'')+newBody;
        dropDelta=1;
      }

      if(candidate.length >= src.length){
        if(rec) rec('字段前缀折叠(放弃: 不缩短)', src.length, src.length, '候选 '+candidate.length+' ≥ 当前 '+src.length);
        return null;
      }

      var newAlias = {
        byName: (priorAlias&&priorAlias.byName)||{},
        memberByLocal: (priorAlias&&priorAlias.memberByLocal)||{},
        factorLocals: ((priorAlias&&priorAlias.factorLocals)||[]).concat(Object.keys(newPrefixMap)),
        prefixFoldByLocal: Object.assign({}, (priorAlias&&priorAlias.prefixFoldByLocal)||{}, newPrefixMap),
        stringAliasByLocal: Object.assign({}, (priorAlias&&priorAlias.stringAliasByLocal)||{}),
        // 注入到现有 batched local 时不产生新的 local 语句，dropLeading 不增；
        // 退路独立 local 时 +1
        dropLeading: ((priorAlias&&priorAlias.dropLeading)||0) + dropDelta
      };
      if(!canCommit(originalCode, candidate, newAlias)) return null;
      assertParses(candidate, 'field-prefix/syntax', steps);
      assertEquivalentAlias(originalCode, candidate, newAlias, '阶段1.4/等价', steps);
      if(rec) rec('字段前缀折叠(提交)', src.length, candidate.length,
                  '提取 '+chosen.map(function(c){return aliasOf[c.prefix]+"='"+c.prefix+"'"+(c.parentPrefix?('←'+aliasOf[c.parentPrefix]):'');}).join('；'));
      return {code:candidate, aliasMap:newAlias};
    }

    // ---------- 字符串字面量内联（同字面量重复出现 → 提取 local 别名） ----------
    // 扫描 src 里所有"作为表达式出现的 StringLiteral"（不包括 TableKeyString 这种语法位置上的字段名）。
    // 当同一字面量内容出现 ≥2 次且收益为正时，注入 ,u='X' 到现有 batched local，并把每处 'X' 替换为 u。
    //
    // 收益分析（per-site，字符级精算，单字母别名 |u|=1）：
    //   原 'X' 长度 = |X|+2（带引号）
    //   新 u   长度 = |u|
    //   per-site 省 = |X|+2−|u|
    //   注入开销（嵌进 batched local） = ',u=\'X\'' = |u|+|X|+4
    //   总判定：站点数 N，per-site*N > 注入开销
    //   即 (|X|+1)*N > |u|+1。|u|=1 时 N≥1 + |X|≥3 即赚（实际 N=2+|X|≥3 起赚）
    //   实测以 candidate.length < src.length 兜底。
    //
    // 安全约束：
    //  1. 仅注入到 priorAlias.dropLeading 范围内的最后一条 batched local（同 foldFieldPrefix）；否则 fallback 独立 local。
    //  2. canonical 通过 stringAliasByLocal 把读 u 还原为 'X'，故等价校验自动覆盖。
    //  3. 字面量内容须 [A-Za-z_][A-Za-z0-9_]* 且长度 ≥3——这是个简单筛选避开短字符串净亏，
    //     真实闸门由 candidate.length 兜底。
    function foldStringLiterals(src, priorAlias, steps, rec, originalCode){
      var ast; try{ ast=parse(src); }catch(e){ return null; }

      // 收集所有 StringLiteral 节点（作为表达式的位置——StringCallExpression 的 argument 也算，
      // TableKeyString 的 key 不是 StringLiteral 节点而是 Identifier，不会被匹配，自然跳过）。
      // 但要排除一个位置：注入目标 batched local 的 init 列表里那些 StringLiteral——
      // 它们将作为别名值，不可被重写为对自己的引用（自引用循环且 dropLeading 跳过它们已经看不到）。
      var priorDrop=(priorAlias && priorAlias.dropLeading) || 0;
      var injectStmt=null;
      if(priorDrop>0 && priorDrop<=ast.body.length){
        var probeSt=ast.body[priorDrop-1];
        if(probeSt && probeSt.type==='LocalStatement' && probeSt.variables && probeSt.variables.length
           && probeSt.init && probeSt.init.length){
          var lastI=probeSt.init[probeSt.init.length-1];
          if(!(lastI && (lastI.type==='CallExpression'||lastI.type==='StringCallExpression'
                         ||lastI.type==='TableCallExpression'||lastI.type==='VarargLiteral'))){
            injectStmt=probeSt;
          }
        }
      }
      // 标记 dropLeading 范围内所有节点的 range，用于排除其内部的 StringLiteral
      var headerRanges=[];
      for(var hi=0; hi<priorDrop && hi<ast.body.length; hi++){
        var hs=ast.body[hi];
        if(hs && hs.range) headerRanges.push(hs.range);
      }
      function inHeader(node){
        if(!node || !node.range) return false;
        for(var i=0;i<headerRanges.length;i++){
          if(node.range[0]>=headerRanges[i][0] && node.range[1]<=headerRanges[i][1]) return true;
        }
        return false;
      }

      var lit2sites=Object.create(null);  // content -> [{start, end, callArg}]
      // 标记 StringCallExpression 的 argument 节点：a'X' 里的 'X' 改写时要连同括号一起换成 (u)，
      // 即 a'X' → a(u)。否则去掉引号会得到 a u 这种合并 token（语义不等）。
      var callArgNodes=new Set();
      (function markCallArg(n){
        if(!n||typeof n!=='object') return;
        if(Array.isArray(n)){ n.forEach(markCallArg); return; }
        if(n.type==='StringCallExpression' && n.argument && n.argument.type==='StringLiteral'){
          callArgNodes.add(n.argument);
        }
        // TableCallExpression 的 arguments 是 TableConstructorExpression，不会是 StringLiteral，无须处理
        for(var k in n){ if(k!=='range'&&k!=='loc'&&Object.prototype.hasOwnProperty.call(n,k)) markCallArg(n[k]); }
      })(ast.body);

      (function walk(n){
        if(!n||typeof n!=='object') return;
        if(Array.isArray(n)){ for(var i=0;i<n.length;i++) walk(n[i]); return; }
        if(n.type==='StringLiteral' && !inHeader(n)){
          var raw=n.raw;
          if(typeof raw==='string' && raw.length>=4 && (raw[0]==="'"||raw[0]==='"')){
            var content=raw.slice(1,-1);
            // 任意内容（不再限制标识符样），但要求能安全回填进单引号声明：不含 ' \ 与换行。
            if(content.length>=3 && content.indexOf("'")<0 && content.indexOf('\\')<0
               && content.indexOf('\n')<0 && content.indexOf('\r')<0){
              (lit2sites[content]=lit2sites[content]||[]).push({start:n.range[0], end:n.range[1], callArg:callArgNodes.has(n)});
            }
          }
          return;
        }
        for(var k in n){ if(k!=='range'&&k!=='loc'&&Object.prototype.hasOwnProperty.call(n,k)) walk(n[k]); }
      })(ast.body);

      var candidates=[];
      for(var c in lit2sites){
        if(!Object.prototype.hasOwnProperty.call(lit2sites,c)) continue;
        if(lit2sites[c].length<2) continue;
        candidates.push({content:c, sites:lit2sites[c]});
      }
      if(!candidates.length) return null;
      // 按 (站点数 × 字面量长度) 降序优先
      candidates.sort(function(a,b){
        return b.sites.length*b.content.length - a.sites.length*a.content.length;
      });

      // 已占名（防冲突）
      var taken=new Set(); Object.keys(KEYWORDS).forEach(function(k){taken.add(k);});
      (function collectNames(n){
        if(!n||typeof n!=='object')return;
        if(Array.isArray(n)){n.forEach(collectNames);return;}
        if(n.type==='Identifier'&&n.name) taken.add(n.name);
        for(var k in n){ if(k!=='range'&&k!=='loc'&&Object.prototype.hasOwnProperty.call(n,k)) collectNames(n[k]); }
      })(ast.body);
      var POOL=candidateGenerator();
      function nextName(){ for(var i=0;i<POOL.length;i++){ if(!taken.has(POOL[i])&&!KEYWORDS[POOL[i]]){ taken.add(POOL[i]); return POOL[i]; } } return null; }

      // 选择候选：每个分配一个名，按真实 |u| 复核收益；不赚则跳过。
      var chosen=[];   // {content, sites, alias}
      var declOverhead = injectStmt ? 4 : 10;     // ',u=\'X\'' 或 'local u=\'X\' '
      for(var ci=0;ci<candidates.length;ci++){
        var cand=candidates[ci];
        var alias=nextName();
        if(!alias) break;
        var perSiteTotal = 0;
        cand.sites.forEach(function(s){
          perSiteTotal += (s.callArg ? cand.content.length : cand.content.length + 2) - alias.length;
        });
        var declCost = alias.length + cand.content.length + declOverhead;
        var realGain = perSiteTotal - declCost;
        if(realGain<=0) continue;
        chosen.push({content:cand.content, sites:cand.sites, alias:alias});
      }
      if(!chosen.length) return null;

      // 构造 edits：每处 [start, end) 的 'X' 替换为 alias 名
      // 注意：替换后可能发生 token 合并（如 'table'and → blandalias→bland）。
      // 若原字符串后紧跟可作标识符后继的字符（字母/数字/下划线），则追加空格。
      var edits=[];
      var newStringMap={};
      chosen.forEach(function(c){
        newStringMap[c.alias]=c.content;
        c.sites.forEach(function(s){
          var name = s.callArg ? ('('+c.alias+')') : c.alias;
          var spacer = (!s.callArg && s.end < src.length && isNamePart(src[s.end])) ? ' ' : '';
          edits.push({start:s.start, end:s.end, name:name + spacer});
        });
      });

      var candidate;
      var dropDelta;
      if(injectStmt){
        var lastVar=injectStmt.variables[injectStmt.variables.length-1];
        var stmtEnd=injectStmt.range[1];
        var injectNames=','+chosen.map(function(c){return c.alias;}).join(',');
        var injectVals=','+chosen.map(function(c){return "'"+c.content+"'";}).join(',');
        var allEdits=edits.concat([
          {start:lastVar.range[1], end:lastVar.range[1], name:injectNames},
          {start:stmtEnd, end:stmtEnd, name:injectVals}
        ]);
        candidate=applyEdits(src, allEdits);
        dropDelta=0;
      }else{
        var newBody=applyEdits(src, edits);
        var declNames = chosen.map(function(c){return c.alias;}).join(',');
        var declVals  = chosen.map(function(c){return "'"+c.content+"'";}).join(',');
        candidate='local '+declNames+'='+declVals+' '+newBody;
        dropDelta=1;
      }

      if(candidate.length >= src.length){
        if(rec) rec('字面量内联(放弃: 不缩短)', src.length, src.length, '候选 '+candidate.length+' ≥ 当前 '+src.length);
        return null;
      }

      var newAlias = {
        byName: (priorAlias&&priorAlias.byName)||{},
        memberByLocal: (priorAlias&&priorAlias.memberByLocal)||{},
        factorLocals: (priorAlias&&priorAlias.factorLocals)||[],
        prefixFoldByLocal: Object.assign({}, (priorAlias&&priorAlias.prefixFoldByLocal)||{}),
        stringAliasByLocal: Object.assign({}, (priorAlias&&priorAlias.stringAliasByLocal)||{}, newStringMap),
        dropLeading: ((priorAlias&&priorAlias.dropLeading)||0) + dropDelta
      };
      if(!canCommit(originalCode, candidate, newAlias)) return null;
      assertParses(candidate, 'string-alias/syntax', steps);
      assertEquivalentAlias(originalCode, candidate, newAlias, '阶段1.4/等价', steps);
      if(rec) rec('字面量内联(提交)', src.length, candidate.length,
                  '提取 '+chosen.map(function(c){return c.alias+"='"+c.content+"'×"+c.sites.length;}).join('；'));
      return {code:candidate, aliasMap:newAlias};
    }

    // ---------- 字符串公共前缀因子（多级拆分） ----------
    // 对 body 里互不相同的字符串字面量，迭代提取公共前缀（'ACTION_SHOOT_UP' 等 → a='ACTION_' b='SHOOT'
    // → a..b..'UP'）。每一级都按「只缩短才提交」的收益公式判别，不赚即停。
    // 与 foldStringLiterals 的区别：它提取【完全相同的整串】，这里提取【不同串的公共前缀】。
    function foldStringFactors(src, priorAlias, steps, rec, originalCode){
      var ast; try{ ast=parse(src); }catch(e){ return null; }
      var priorDrop=(priorAlias && priorAlias.dropLeading)||0;
      var headerRanges=[];
      for(var hi=0; hi<priorDrop && hi<ast.body.length; hi++){
        if(ast.body[hi].range) headerRanges.push(ast.body[hi].range);
      }
      function inHeader(node){
        if(!node||!node.range) return false;
        for(var i=0;i<headerRanges.length;i++){
          if(node.range[0]>=headerRanges[i][0] && node.range[1]<=headerRanges[i][1]) return true;
        }
        return false;
      }

      // 排除 call sugar 参数（a'X' 的 X），避免去掉引号后 token 合并
      var callArgNodes=new Set();
      (function mark(n){
        if(!n||typeof n!=='object') return;
        if(Array.isArray(n)){ n.forEach(mark); return; }
        if(n.type==='StringCallExpression' && n.argument && n.argument.type==='StringLiteral') callArgNodes.add(n.argument);
        for(var k in n){ if(k!=='range'&&k!=='loc'&&Object.prototype.hasOwnProperty.call(n,k)) mark(n[k]); }
      })(ast.body);

      var strs=[];  // {content, start, end, tail, factors:[]}
      (function walk(n){
        if(!n||typeof n!=='object') return;
        if(Array.isArray(n)){ for(var i=0;i<n.length;i++) walk(n[i]); return; }
        if(n.type==='StringLiteral' && !inHeader(n) && !callArgNodes.has(n)){
          var raw=n.raw;
          if(typeof raw==='string' && raw.length>=4 && (raw[0]==="'"||raw[0]==='"')){
            var content=raw.slice(1,-1);
            if(content.length>=2 && content.indexOf("'")<0 && content.indexOf('\\')<0
               && content.indexOf('\n')<0 && content.indexOf('\r')<0){
              strs.push({content:content, start:n.range[0], end:n.range[1], tail:content, factors:[]});
            }
          }
          return;
        }
        for(var k in n){ if(k!=='range'&&k!=='loc'&&Object.prototype.hasOwnProperty.call(n,k)) walk(n[k]); }
      })(ast.body);

      if(strs.length<2) return null;

      var taken=new Set(); Object.keys(KEYWORDS).forEach(function(k){taken.add(k);});
      (function cn(n){
        if(!n||typeof n!=='object') return;
        if(Array.isArray(n)){n.forEach(cn);return;}
        if(n.type==='Identifier'&&n.name) taken.add(n.name);
        for(var k in n){ if(k!=='range'&&k!=='loc'&&Object.prototype.hasOwnProperty.call(n,k)) cn(n[k]); }
      })(ast.body);
      var POOL=candidateGenerator();
      function nextName(){ for(var i=0;i<POOL.length;i++){ if(!taken.has(POOL[i])&&!KEYWORDS[POOL[i]]){ taken.add(POOL[i]); return POOL[i]; } } return null; }

      var factorNames=[], factorAffixes=[];
      var rounds=0;
      while(rounds<8){
        rounds++;
        // 枚举各 site 当前 tail 的所有长度前缀，找增益最大的公共前缀
        var best=null;
        for(var ai=0; ai<strs.length; ai++){
          var s=strs[ai];
          for(var L=2; L<=s.tail.length; L++){
            var pre=s.tail.slice(0,L);
            var mem=strs.filter(function(x){ return x.tail.length>L && x.tail.slice(0,L)===pre; });
            if(mem.length<2) continue;
            var perItem=pre.length-1-2;  // 用 1 字符因子名估算
            var gain=perItem*mem.length-(1+pre.length+9);
            if(gain>0 && (!best || gain>best.gain)) best={affix:pre, members:mem, gain:gain};
          }
        }
        if(!best) break;
        var fname=nextName();
        if(!fname) break;
        // 用实际因子名长度复核收益；不赚则归还名字并停止
        var perItem2=best.affix.length-fname.length-2;
        var gain2=perItem2*best.members.length-(fname.length+best.affix.length+9);
        if(gain2<=0){ taken.delete(fname); break; }
        best.members.forEach(function(s){
          s.tail=s.tail.slice(best.affix.length);
          s.factors.push(fname);
        });
        factorNames.push(fname);
        factorAffixes.push(best.affix);
      }

      if(!factorNames.length) return null;

      var edits=[];
      strs.forEach(function(s){
        if(!s.factors.length) return;
        var expr=s.factors.join('..');
        if(s.tail.length) expr += "..'"+s.tail+"'";
        edits.push({start:s.start, end:s.end, name:expr});
      });

      var decl='local '+factorNames.join(',')+'='+factorAffixes.map(function(a){return "'"+a+"'";}).join(',')+' ';
      var newBody=applyEdits(src, edits);
      var candidate=decl+newBody;
      if(candidate.length>=src.length){
        if(rec) rec('字符串因子(放弃: 不缩短)', src.length, src.length, '候选 '+candidate.length+' ≥ '+src.length);
        return null;
      }
      if(luaValidate && luaValidate(candidate)) return null;

      var newFactorMap=Object.create(null);
      for(var fi=0; fi<factorNames.length; fi++){ newFactorMap[factorNames[fi]]=factorAffixes[fi]; }
      var newAlias={
        byName: (priorAlias&&priorAlias.byName)||{},
        memberByLocal: (priorAlias&&priorAlias.memberByLocal)||{},
        factorLocals: (priorAlias&&priorAlias.factorLocals)||[],
        prefixFoldByLocal: Object.assign({}, (priorAlias&&priorAlias.prefixFoldByLocal)||{}),
        stringAliasByLocal: Object.assign({}, (priorAlias&&priorAlias.stringAliasByLocal)||{}, newFactorMap),
        dropLeading: priorDrop+1
      };
      if(!canCommit(originalCode, candidate, newAlias)) return null;
      assertParses(candidate, 'str-factor/syntax', steps);
      assertEquivalentAlias(originalCode, candidate, newAlias, '阶段1.4c/等价', steps);
      if(rec) rec('字符串因子(提交)', src.length, candidate.length, '提取 '+factorNames.length+' 级前缀');
      return {code:candidate, aliasMap:newAlias};
    }

    // ---------- 块包装（重复语句块提取薄函数） ----------
    // 把重复出现的【语句块】（1~N 条顶层语句，变化点在【任意位置】的叶子：标识符/字面量）打包成薄函数：
    //   func(AAA,var1,BB,CCC()) DD() EE() var2()  ×N  →  local function f(p1,p2)<块(p1,p2)>end  f(v1,v2)…
    // 固定点按"文本一致"判定，变化点作形参。多个候选块互斥 → 用加权区间调度取不重叠、总收益最大的一组。
    // 等价由 canonical 的块包装内联（blockWrapperInfo）验证；只缩短才提交 + candidate.length 闸门兜底。
    function foldBlockWrapper(src, priorAlias, steps, rec, originalCode, maxLen){
      if(maxLen==null) maxLen=8;
      if(maxLen<=0) return null;
      var ast; try{ ast=parse(src); }catch(e){ return null; }
      var priorDrop=(priorAlias && priorAlias.dropLeading)||0;
      var stmts=ast.body.slice(priorDrop);
      if(stmts.length<2) return null;

      var taken=new Set(); Object.keys(KEYWORDS).forEach(function(k){taken.add(k);});
      (function cn(n){
        if(!n||typeof n!=='object') return;
        if(Array.isArray(n)){n.forEach(cn);return;}
        if(n.type==='Identifier'&&n.name) taken.add(n.name);
        for(var k in n){ if(k!=='range'&&k!=='loc'&&Object.prototype.hasOwnProperty.call(n,k)) cn(n[k]); }
      })(ast.body);
      var POOL=candidateGenerator();
      function nextName(){ for(var i=0;i<POOL.length;i++){ if(!taken.has(POOL[i])&&!KEYWORDS[POOL[i]]){ taken.add(POOL[i]); return POOL[i]; } } return null; }

      var LEAF={Identifier:1,NumericLiteral:1,StringLiteral:1,BooleanLiteral:1,NilLiteral:1};
      function shapeOf(node){
        if(!node||typeof node!=='object') return '?';
        if(Array.isArray(node)) return '['+node.map(shapeOf).join('')+']';
        if(LEAF[node.type]) return node.type;
        var parts=[];
        for(var k in node){ if(k==='range'||k==='loc'||k==='raw') continue; if(Object.prototype.hasOwnProperty.call(node,k)) parts.push(k+shapeOf(node[k])); }
        return node.type+'('+parts.join(',')+')';
      }
      function collectSlots(tNode, repNodes, out){
        if(!tNode || typeof tNode!=='object') return;
        if(Array.isArray(tNode)){ for(var ai=0;ai<tNode.length;ai++) collectSlots(tNode[ai], repNodes.map(function(o){return o[ai];}), out); return; }
        if(LEAF[tNode.type]){
          var texts=[src.slice(tNode.range[0],tNode.range[1])];
          for(var r=0;r<repNodes.length;r++) texts.push(src.slice(repNodes[r].range[0],repNodes[r].range[1]));
          out.push({tRange:tNode.range, texts:texts});
          return;
        }
        for(var k in tNode){
          if(k==='range'||k==='loc'||k==='raw') continue;
          if(Object.prototype.hasOwnProperty.call(tNode,k)) collectSlots(tNode[k], repNodes.map(function(o){return o[k];}), out);
        }
      }

      // 枚举候选块（任意位置重复、shape 一致）：按 shape 序列哈希找出所有 ≥2 次出现的语句块，
      // 不再要求重复块相邻连续——真实代码里"重复操作"通常是散布的。
      var shapes=stmts.map(function(st){ return shapeOf(st); });
      var cands=[];
      for(var k=1;k<=maxLen && k<=stmts.length;k++){
        var seqMap=Object.create(null);
        for(var s=0;s+k<=stmts.length;s++){
          var key=shapes.slice(s,s+k).join('\u0000');
          (seqMap[key]=seqMap[key]||[]).push(s);
        }
        for(var key in seqMap){
          if(!Object.prototype.hasOwnProperty.call(seqMap,key)) continue;
          var positions=seqMap[key];
          if(positions.length>=2) cands.push({positions:positions, k:k, N:positions.length});
        }
      }
      if(!cands.length) return null;

      // 打分：参数化 + 收益（1 字名估算）
      var scored=[];
      cands.forEach(function(c){
        var template=stmts.slice(c.positions[0], c.positions[0]+c.k);
        var reps=c.positions.map(function(p){ return stmts.slice(p, p+c.k); });
        var slots=[];
        for(var j=0;j<c.k;j++) collectSlots(template[j], reps.slice(1).map(function(rp){return rp[j];}), slots);
        var varying=[];
        for(var i=0;i<slots.length;i++){
          var t=slots[i].texts;
          var same=t.every(function(x){return x===t[0];});
          if(!same) varying.push(slots[i]);
        }
        if(!varying.length) return;
        var V=varying.length;
        var origLen=0;
        reps.forEach(function(rp){ rp.forEach(function(st){ origLen+=st.range[1]-st.range[0]; }); });
        var blockStart=template[0].range[0], blockEnd=template[template.length-1].range[1];
        var bodyLen=(blockEnd-blockStart);
        varying.forEach(function(v){ bodyLen -= (v.tRange[1]-v.tRange[0]); });   // 变化点换 1 字形参
        bodyLen += V*1;
        var decl=('local function f('+new Array(V+1).join('x,')+')').length + bodyLen + 3 + 1; // 'end' + 分隔
        var calls=0;
        for(var r2=0;r2<c.N;r2++){
          var args=[];
          for(var vi=0;vi<V;vi++) args.push(varying[vi].texts[r2]);
          calls += ('f('+args.join(',')+')').length;
        }
        var gain=origLen-(decl+calls);
        if(gain>0) scored.push({positions:c.positions,k:c.k,N:c.N,V:V,gain:gain,template:template,reps:reps,varying:varying});
      });
      if(!scored.length) return null;

      // 贪心选块：按收益降序，选语句下标互不重叠的候选（散布重复块无法用区间调度）
      scored.sort(function(a,b){ return b.gain - a.gain; });
      var usedStmts=new Set();
      var chosen=[];
      scored.forEach(function(c){
        var overlap=false;
        for(var pi=0;pi<c.positions.length;pi++){
          for(var j=c.positions[pi]; j<c.positions[pi]+c.k; j++){ if(usedStmts.has(j)){ overlap=true; break; } }
          if(overlap) break;
        }
        if(overlap) return;
        for(var pi=0;pi<c.positions.length;pi++){
          for(var j=c.positions[pi]; j<c.positions[pi]+c.k; j++) usedStmts.add(j);
        }
        chosen.push(c);
      });
      if(!chosen.length) return null;

      // 分配真实别名 + 形参名，构建候选
      var decls=[], allEdits=[];
      chosen.forEach(function(c){
        var fname=nextName(); if(!fname) return;
        var params=[], ok=true;
        for(var p=0;p<c.V;p++){ var pn=nextName(); if(!pn){ ok=false; break; } params.push(pn); }
        if(!ok) return;
        var blockStart=c.template[0].range[0], blockEnd=c.template[c.template.length-1].range[1];
        var bodySrc=src.slice(blockStart, blockEnd);
        var bodyEdits=c.varying.map(function(v,i){ return {start:v.tRange[0]-blockStart, end:v.tRange[1]-blockStart, name:params[i]}; });
        var bodyText=applyEdits(bodySrc, bodyEdits);
        decls.push('local function '+fname+'('+params.join(',')+')'+bodyText+'end');
        for(var r=0;r<c.N;r++){
          var args=[];
          for(var vi=0;vi<c.V;vi++) args.push(c.varying[vi].texts[r]);
          var rbStart=c.reps[r][0].range[0], rbEnd=c.reps[r][c.reps[r].length-1].range[1];
          allEdits.push({start:rbStart, end:rbEnd, name:fname+'('+args.join(',')+')'});
        }
      });
      if(!decls.length) return null;

      var insertPos=0;
      if(priorDrop>0 && priorDrop<=ast.body.length && ast.body[priorDrop-1].range) insertPos=ast.body[priorDrop-1].range[1];
      var declText=decls.join(' ');
      var sep=(insertPos>0 && isNamePart(src[insertPos-1])) ? ' ' : '';
      var allEdits2=allEdits.concat([{start:insertPos, end:insertPos, name:sep+declText+' '}]);
      var candidate=applyEdits(src, allEdits2);

      if(candidate.length >= src.length){
        if(rec) rec('块包装(放弃: 不缩短)', src.length, src.length, '候选 '+candidate.length+' ≥ 当前 '+src.length);
        return null;
      }
      if(!canCommit(originalCode, candidate, priorAlias)) return null;
      assertParses(candidate, 'block-wrapper/syntax', steps);
      assertEquivalentAlias(originalCode, candidate, priorAlias, '阶段1.4d/等价', steps);
      if(rec) rec('块包装(提交)', src.length, candidate.length, '提取 '+decls.length+' 个块包装');
      return {code:candidate, aliasMap:priorAlias};
    }

    // Lua 5.3 call sugar: f("x") -> f"x", f({}) -> f{}.
    // Only syntax parentheses are removed; parsing and canonical equivalence still gate the edit.
    function foldCallSugar(src, priorAlias, steps, rec, originalCode){
      var ast; try{ ast=parse(src); }catch(e){ return null; }
      var edits=[];
      (function walk(n){
        if(!n||typeof n!=='object') return;
        if(Array.isArray(n)){ for(var i=0;i<n.length;i++) walk(n[i]); return; }
        if(n.type==='CallExpression' && n.arguments && n.arguments.length===1 && n.base && n.base.range && n.range){
          var arg=n.arguments[0];
          if(arg && arg.range && (arg.type==='StringLiteral'||arg.type==='TableConstructorExpression')){
            var left=src.slice(n.base.range[1],arg.range[0]);
            var right=src.slice(arg.range[1],n.range[1]);
            if(left.indexOf('(')>=0 && right.lastIndexOf(')')>=0){
              edits.push({start:n.base.range[1],end:arg.range[0],name:''});
              edits.push({start:arg.range[1],end:n.range[1],name:''});
            }
          }
        }
        for(var k in n){
          if(k==='range'||k==='loc') continue;
          if(Object.prototype.hasOwnProperty.call(n,k)) walk(n[k]);
        }
      })(ast.body);
      if(!edits.length) return null;
      var candidate=applyEdits(src, edits);
      if(candidate.length>=src.length) return null;
      if(!canCommit(originalCode, candidate, priorAlias)) return null;
      assertParses(candidate, 'call-sugar/syntax', steps);
      assertEquivalentAlias(originalCode, candidate, priorAlias, 'call-sugar/equivalence', steps);
      if(rec) rec('call-sugar', src.length, candidate.length, 'removed '+(edits.length/2)+' call-parenthesis pairs');
      return {code:candidate, aliasMap:priorAlias};
    }

    // ---------- 多重赋值拆分（点：a,b=v1,v2 → a=v1 b=v2 当 v1 符号结尾时省间隔） ----------
    // 对【非 local 的多重赋值】，当满足"安全分裂"条件且至少有 1 个非末值符号结尾时，拆成单赋值序列。
    // 安全条件由 canonical 的 multiAssignSafeToSplit 同步识别（语义等价的充要保守条件），
    // 故等价校验自然通过。
    //
    // 收益分析（per-statement）：
    //   原 a,b,c=v1,v2,v3 长度 = Σ|name|+(N-1)+1+Σ|val|+(N-1)
    //   拆 a=v1 b=v2 c=v3：每对 (ai, vi) 之间需要分隔 ai 与上一段尾 token；
    //     若上一段末值 vi 以符号结尾（) ] ' " }），紧贴 ai 不需分隔（省 1 字）；否则需 1 字空格。
    //   原成本：(N-1) 个名字间逗号 + 1 等号 + (N-1) 个值间逗号 = 2N-1
    //   新成本：N 等号 + (N-1) 个段间分隔（每个 0~1 字） + (N-1) 个目标-值之间不需分隔（=直接连接）
    //         = N + (N-1)*sep_avg
    //   差 = (2N-1) - (N + (N-1)*sep) = N-1 - (N-1)*sep = (N-1)(1-sep)
    //   每个非末值 vi 符号结尾 → 该位置 sep=0，省 1 字。
    //   只要至少 1 个非末值符号结尾就净赚（其余位置打平）。
    function splitMultiAssign(src, priorAlias, steps, rec, originalCode){
      var ast; try{ ast=parse(src); }catch(e){ return null; }
      var info=analyze(ast);

      // 找候选 AssignmentStatement
      var candidates=[];
      (function walk(n){
        if(!n||typeof n!=='object') return;
        if(Array.isArray(n)){ for(var i=0;i<n.length;i++) walk(n[i]); return; }
        if(n.type==='AssignmentStatement'){
          if(isSplitSafe(n, info)){
            // 估算 gain（保守估计：每个非末值符号结尾省 1 字）
            var inits=n.init||[];
            var symbolEndingNonLast=0;
            for(var i=0;i<inits.length-1;i++){
              var t=inits[i].type;
              if(t==='CallExpression'||t==='StringCallExpression'||t==='TableCallExpression'
                 ||t==='IndexExpression'||t==='TableConstructorExpression'||t==='StringLiteral'){
                symbolEndingNonLast++;
              }
            }
            if(symbolEndingNonLast>0) candidates.push(n);
          }
        }
        for(var k in n){ if(k!=='range'&&k!=='loc'&&Object.prototype.hasOwnProperty.call(n,k)) walk(n[k]); }
      })(ast.body);

      if(!candidates.length) return null;

      // 构造 edits：把整条 `a,b,c=v1,v2,v3` 替换为 `a=v1 b=v2 c=v3`，段间统一加空格——
      // 编码层后续会把"上段末值符号结尾 + 下段首字母"间的多余空格去掉，等效兑现"省 1 字"。
      var edits=[];
      for(var ci=0;ci<candidates.length;ci++){
        var st=candidates[ci];
        var vars=st.variables, inits=st.init;
        var parts=[];
        for(var i=0;i<vars.length;i++){
          parts.push(src.slice(vars[i].range[0], vars[i].range[1])
                    +'='
                    +src.slice(inits[i].range[0], inits[i].range[1]));
        }
        edits.push({start:st.range[0], end:st.range[1], name:parts.join(' ')});
      }

      var candidate=applyEdits(src, edits);

      // 用编码层模拟一遍：只有"编码后真的更短"才提交（结构层加空格后通常打平）
      var bodyCur = applyEncoding(src);
      var bodyCand = applyEncoding(candidate);
      if(bodyCand.length >= bodyCur.length){
        if(rec) rec('多赋值拆分(放弃: 不缩短)', src.length, src.length,
                    '编码后 '+bodyCand.length+' ≥ '+bodyCur.length);
        return null;
      }

      if(!canCommit(originalCode, candidate, priorAlias)) return null;
      assertParses(candidate, 'split/syntax', steps);
      assertEquivalentAlias(originalCode, candidate, priorAlias, '阶段1.7/等价', steps);
      if(rec) rec('多赋值拆分(提交)', src.length, candidate.length,
                  '拆分 '+candidates.length+' 条多重赋值');
      return {code:candidate, aliasMap:priorAlias};
    }

    // 与 canonical.multiAssignSafeToSplit 同步：判定一条 AssignmentStatement 是否能安全
    // 拆成单赋值序列。两份独立实现是因为各自访问的 info.varOf 来自不同的 analyze 调用。
    function isSplitSafe(stmt, info){
      var vars=stmt.variables, inits=stmt.init||[];
      if(vars.length<2 || vars.length!==inits.length) return false;
      var nameSeen=Object.create(null);
      var targetGlobalNames=Object.create(null);
      var targetBindings=new Set();
      for(var i=0;i<vars.length;i++){
        if(vars[i].type!=='Identifier') return false;
        if(nameSeen[vars[i].name]) return false;
        nameSeen[vars[i].name]=true;
        var b=info.varOf.get(vars[i]);
        if(b) targetBindings.add(b);
        else targetGlobalNames[vars[i].name]=true;
      }
      var coupled=false;
      (function w(n){
        if(coupled||!n||typeof n!=='object') return;
        if(Array.isArray(n)){ for(var k=0;k<n.length;k++) w(n[k]); return; }
        if(n.type==='Identifier'){
          var b2=info.varOf.get(n);
          if(b2){ if(targetBindings.has(b2)) { coupled=true; return; } }
          else { if(targetGlobalNames[n.name]) { coupled=true; return; } }
        }
        for(var k in n){ if(k!=='range'&&k!=='loc'&&Object.prototype.hasOwnProperty.call(n,k)) w(n[k]); }
      })(inits);
      return !coupled;
    }

    // ---------- local 合并（点4：消除多余 local 关键字） ----------
    // 把同一 block 内【连续】的简单 local 声明合并成一条：local A=x local B=y → local A,B=x,y
    // 安全前提（否则该处不合并）：后条初始化不引用本组刚声明的名字；组内不重名；
    //   非末条须 #init==#vars 且不以多返回值（调用/...）结尾，避免多/少值截断差异。
    // 严格"只缩短"闸门：合并后整体更短才提交。
    function foldLocals(src, priorAlias, steps, rec, originalCode, allowPrefixMerge){
      var ast; try{ ast=parse(src); }catch(e){ return null; }
      var protectN = allowPrefixMerge ? 0 : ((priorAlias&&priorAlias.dropLeading)||0);

      function isMergeableLocal(st){
        if(st.type!=='LocalStatement'||!st.variables||!st.variables.length) return false;
        for(var i=0;i<st.variables.length;i++) if(st.variables[i].type!=='Identifier') return false;
        return true;
      }
      function refsAny(exprs, nameSet){
        var found=false;
        (function w(n){
          if(found||!n||typeof n!=='object')return;
          if(Array.isArray(n)){n.forEach(w);return;}
          if(n.type==='Identifier'&&nameSet.has(n.name)){found=true;return;}
          for(var k in n){ if(k!=='range'&&k!=='loc'&&Object.prototype.hasOwnProperty.call(n,k)) w(n[k]); }
        })(exprs);
        return found;
      }
      var edits=[];
      function processBlock(stmts, skip){
        var i=skip||0;
        while(i<stmts.length){
          if(!isMergeableLocal(stmts[i])){ i++; continue; }
          var run=[stmts[i]]; var j=i+1;
          while(j<stmts.length && isMergeableLocal(stmts[j])){ run.push(stmts[j]); j++; }
          if(run.length>=2) tryMergeRun(run);
          i=j;
        }
        for(var k=0;k<stmts.length;k++) descend(stmts[k]);
      }
      function descend(st){
        switch(st.type){
          case 'IfStatement': st.clauses.forEach(function(c){processBlock(c.body||[]);}); break;
          case 'WhileStatement': case 'DoStatement': case 'ForNumericStatement':
          case 'ForGenericStatement': case 'RepeatStatement': processBlock(st.body||[]); break;
          default:
            (function w(n){
              if(!n||typeof n!=='object')return;
              if(Array.isArray(n)){n.forEach(w);return;}
              if(n.type==='FunctionDeclaration'){ processBlock(n.body||[]); return; }
              for(var k in n){ if(k!=='range'&&k!=='loc'&&Object.prototype.hasOwnProperty.call(n,k)) w(n[k]); }
            })(st);
        }
      }
      function tryMergeRun(run){
        var groups=[], cur=[run[0]];
        var declared=new Set(run[0].variables.map(function(v){return v.name;}));
        for(var r=1;r<run.length;r++){
          var st=run[r];
          var names=st.variables.map(function(v){return v.name;});
          var unsafe=false;
          if(refsAny(st.init||[], declared)) unsafe=true;
          for(var n=0;n<names.length;n++) if(declared.has(names[n])) unsafe=true;
          if(!unsafe){
            var prev=cur[cur.length-1];
            if((prev.init||[]).length!==prev.variables.length) unsafe=true;
          }
          if(unsafe){
            if(cur.length>=2) groups.push(cur);
            cur=[st]; declared=new Set(names);
          }else{
            cur.push(st); names.forEach(function(x){declared.add(x);});
          }
        }
        if(cur.length>=2) groups.push(cur);
        groups.forEach(emitMerge);
      }
      function emitMerge(group){
        var allNames=[], allExprs=[];
        for(var g=0;g<group.length;g++){
          var st=group[g];
          for(var v=0;v<st.variables.length;v++) allNames.push(src.slice(st.variables[v].range[0],st.variables[v].range[1]));
          var inits=st.init||[];
          for(var e=0;e<inits.length;e++) allExprs.push(src.slice(inits[e].range[0],inits[e].range[1]));
        }
        var merged='local '+allNames.join(',')+ (allExprs.length? ('='+allExprs.join(',')):'');
        edits.push({start:group[0].range[0], end:group[group.length-1].range[1], name:merged});
      }

      processBlock(ast.body, protectN);
      if(!edits.length) return null;
      var candidate=applyEdits(src, edits);
      if(candidate.length>=src.length){
        if(rec) rec('local 合并(放弃: 不缩短)', src.length, src.length, '候选 '+candidate.length+' ≥ '+src.length);
        return null;
      }
      if(!canCommit(originalCode, candidate, priorAlias)) return null;
      assertParses(candidate, '阶段1.7/语法', steps);
      assertEquivalentAlias(originalCode, candidate, priorAlias, '阶段1.7/等价', steps);
      if(rec) rec('local 合并(提交)', src.length, candidate.length, '合并 '+edits.length+' 组相邻 local');
      return {code:candidate, aliasMap:priorAlias};
    }

    // ---------- 变量复用（点5：活跃区间不重叠则共享名字并省 local） ----------
    // 现在可用 SSA 版本化 canonical 做等价校验（赋值=新逻辑变量），故复用可被验证。
    // 选取规则（健全性预筛，最终由 SSA 等价校验兜底）：
    //   - dead/live 同作用域、均未被闭包捕获、均单变量 local 单点声明；
    //   - 二者都不在循环体内（循环回边）；
    //   - dead 的最后使用严格早于 live 的声明位置。
    // 改写：live 改名为 dead 名，并把 live 的 `local X=...` 降级为 `X=...`（省 6 字 local ）。
    // 严格"只缩短"闸门。
    function foldReuse(src, priorAlias, steps, rec, originalCode){
      var ast; try{ ast=parse(src); }catch(e){ return null; }
      var info=analyze(ast);
      var protectN=(priorAlias&&priorAlias.dropLeading)||0;
      // protectEnd：以别名变量 Identifier 节点末尾为界（而非语句末尾），
      // 避免 foldLocals 合并后混合语句的末尾误覆盖 body 侧变量。
      var protectEnd=0;
      if(protectN>0){
        var _pa=priorAlias, _avSet=new Set();
        if(_pa.byName){ for(var _k in _pa.byName){if(_pa.byName.hasOwnProperty(_k)) _avSet.add(_pa.byName[_k]);} }
        if(_pa.memberByLocal){ for(var _k in _pa.memberByLocal){if(_pa.memberByLocal.hasOwnProperty(_k)) _avSet.add(_k);} }
        if(_pa.factorLocals){ _pa.factorLocals.forEach(function(n){_avSet.add(n);}); }
        if(_pa.transparentAliases){ for(var _k in _pa.transparentAliases){if(_pa.transparentAliases.hasOwnProperty(_k)) _avSet.add(_k);} }
        if(_pa.prefixFoldByLocal){ for(var _k in _pa.prefixFoldByLocal){if(_pa.prefixFoldByLocal.hasOwnProperty(_k)) _avSet.add(_k);} }
        if(_pa.stringAliasByLocal){ for(var _k in _pa.stringAliasByLocal){if(_pa.stringAliasByLocal.hasOwnProperty(_k)) _avSet.add(_k);} }
        for(var _pi=0;_pi<protectN&&_pi<ast.body.length;_pi++){
          var _pst=ast.body[_pi];
          if(_pst.type==='LocalStatement'&&_pst.variables){
            for(var _pv=0;_pv<_pst.variables.length;_pv++){
              var _pvn=_pst.variables[_pv];
              if(_avSet.has(_pvn.name)&&_pvn.range&&_pvn.range[1]>protectEnd) protectEnd=_pvn.range[1];
            }
          } else if(_pst.range){ protectEnd=Math.max(protectEnd,_pst.range[1]); }
        }
      }

      // 单变量 local 声明定位
      var stmtOfDecl=new Map();
      (function mark(stmts){
        for(var i=0;i<stmts.length;i++){
          var st=stmts[i];
          if(st.type==='LocalStatement'){ for(var v=0;v<st.variables.length;v++) stmtOfDecl.set(st.variables[v], {stmt:st, singleVar: st.variables.length===1}); }
          recChildren(st, mark);
        }
      })(ast.body);
      function recChildren(st, cb){
        switch(st.type){
          case 'IfStatement': st.clauses.forEach(function(c){cb(c.body||[]);}); break;
          case 'WhileStatement': case 'DoStatement': case 'ForNumericStatement':
          case 'ForGenericStatement': case 'RepeatStatement': cb(st.body||[]); break;
          default:
            (function w(n){ if(!n||typeof n!=='object')return; if(Array.isArray(n)){n.forEach(w);return;}
              if(n.type==='FunctionDeclaration'){ cb(n.body||[]); return; }
              for(var k in n){ if(k!=='range'&&k!=='loc'&&Object.prototype.hasOwnProperty.call(n,k)) w(n[k]); } })(st);
        }
      }

      var loopRanges=[];
      (function collect(node){
        if(!node||typeof node!=='object')return;
        if(Array.isArray(node)){node.forEach(collect);return;}
        if((node.type==='WhileStatement'||node.type==='RepeatStatement'||node.type==='ForNumericStatement'||node.type==='ForGenericStatement')&&node.range) loopRanges.push(node.range);
        for(var k in node){ if(k!=='range'&&k!=='loc'&&Object.prototype.hasOwnProperty.call(node,k)) collect(node[k]); }
      })(ast.body);
      function inLoop(pos){ for(var i=0;i<loopRanges.length;i++){ if(pos>=loopRanges[i][0]&&pos<loopRanges[i][1]) return true; } return false; }
      function lastUse(b){ var p=b.decls[0].range[1]; b.uses.forEach(function(u){ if(u.range[1]>p)p=u.range[1]; }); return p; }
      function declStart(b){ return b.decls[0].range[0]; }

      var byScope={};
      info.bindings.forEach(function(b){ if(b.captured||b.decls.length!==1) return; (byScope[b.scope.id]=byScope[b.scope.id]||[]).push(b); });

      var edits=[]; var reuseCount=0;
      Object.keys(byScope).forEach(function(sid){
        var arr=byScope[sid].slice().sort(function(a,b){return declStart(a)-declStart(b);});
        var pool=[];
        arr.forEach(function(b){
          var d=declStart(b);
          if(d<protectEnd){ return; }
          var meta=stmtOfDecl.get(b.decls[0]);
          var pick=-1;
          for(var i=0;i<pool.length;i++){ if(pool[i].freeAt < d){ pick=i; break; } }
          if(pick>=0 && meta && meta.singleVar){
            var reuseName=pool[pick].name;
            b.decls.concat(b.uses).forEach(function(nd){ edits.push({start:nd.range[0], end:nd.range[1], name:reuseName}); });
            edits.push({start:meta.stmt.range[0], end:meta.stmt.range[0]+6, name:''}); // "local "→""
            pool[pick].freeAt=lastUse(b); reuseCount++;
          }else{
            pool.push({name:b.name, freeAt:lastUse(b)});
          }
        });
      });
      if(!edits.length) return null;
      for(var i=0;i<edits.length;i++){ if(edits[i].name==='' && src.slice(edits[i].start,edits[i].end)!=='local ') return null; }
      var candidate=applyEdits(src, edits);
      if(candidate.length>=src.length){ if(rec) rec('变量复用(放弃: 不缩短)', src.length, src.length, '候选 '+candidate.length+' ≥ '+src.length); return null; }
      // 语法必须通过（真·Lua）
      var synErr = luaValidate ? luaValidate(candidate) : null;
      if(synErr){ return null; }
      // SSA 等价：非抛出式试探，未通过则放弃（优雅回退，不污染 steps）
      var ok=false;
      try{ ok = (canonical(originalCode)===canonical(candidate, priorAlias)); }catch(e){ ok=false; }
      if(!ok) return null;
      // 通过后，正式记录可见的校验步骤
      assertParses(candidate, '阶段1.7/语法', steps);
      assertEquivalentAlias(originalCode, candidate, priorAlias, '阶段1.7/等价', steps);
      if(rec) rec('变量复用(提交)', src.length, candidate.length, '复用 '+reuseCount+' 个变量名并省去其 local');
      return {code:candidate, aliasMap:priorAlias};
    }

    // ---------- 声明上提（前向 nil 声明合并，点3：智能声明合并） ----------
    // 把【顶层块内、声明在别名头之后】的局部变量上提到别名头里（作为前向 nil 占位），
    // 并把其原 `local X=v` 降级为普通赋值 `X=v`。借助 canonical 的"死前向声明归一"，
    // 这类变换可被严格验证。
    //
    // 收益模型：每上提一个变量 X，
    //   + 别名头名列表多 `,X`（2 字，单字母名时）
    //   − 其声明处省一个 `local `（6 字）减去原本可能搭顺风车的程度
    // 故单变量降级净省约 4 字；多变量 `local A,T=..` 整体降级省更多（一个 local 覆盖多变量）。
    // 严格"只缩短"闸门 + canonical 等价 + 真·Lua 语法，三关全过才提交，否则回退。
    //
    // 安全前提（在 canonical 等价校验兜底之上，再前置筛除明显不可上提者）：
    //   - 仅作用于顶层块（ast.body）内的 LocalStatement；
    //   - 别名头必须存在（priorAlias.dropLeading>0）且是顶层第一条 local；
    //   - 待上提变量：单作用域（顶层）、未被闭包捕获、声明不在循环体内、
    //     该变量在【别名头之后 ~ 自身声明之前】区间从不被读（前向 nil 健全性，由 canonical 复核）。
    function foldDeclHoist(src, priorAlias, steps, rec, originalCode){
      var priorDrop=(priorAlias && priorAlias.dropLeading)||0;
      if(priorDrop<=0) return null;
      var ast; try{ ast=parse(src); }catch(e){ return null; }
      if(!ast.body || ast.body.length<=priorDrop) return null;

      // 别名头：顶层前 priorDrop 条语句中的最后一条 batched local（注入点）
      var headerStmt=ast.body[priorDrop-1];
      if(!headerStmt || headerStmt.type!=='LocalStatement' || !headerStmt.variables || !headerStmt.variables.length) return null;
      // 头部 #init==#vars 才能安全在尾部追加 nil 占位（追加的 name 无对应 init → 自动 nil，
      // 但若头部本身 #init<#vars 已有尾随 nil，我们仍可在最末追加 name；为简单起见要求 #init==#vars）。
      if(!headerStmt.init || headerStmt.init.length!==headerStmt.variables.length) return null;
      var headerEnd=headerStmt.range[1];
      var headerNamesEnd=headerStmt.variables[headerStmt.variables.length-1].range[1]; // 最后一个变量名末尾

      var info=analyze(ast);

      // 顶层作用域 id
      var topId=info.topScope.id;

      // 循环范围（声明在循环体内的不上提）
      var loopRanges=[];
      (function collect(node){
        if(!node||typeof node!=='object')return;
        if(Array.isArray(node)){node.forEach(collect);return;}
        if((node.type==='WhileStatement'||node.type==='RepeatStatement'||node.type==='ForNumericStatement'||node.type==='ForGenericStatement')&&node.range) loopRanges.push(node.range);
        for(var k in node){ if(k!=='range'&&k!=='loc'&&Object.prototype.hasOwnProperty.call(node,k)) collect(node[k]); }
      })(ast.body);
      function inLoop(pos){ for(var i=0;i<loopRanges.length;i++){ if(pos>=loopRanges[i][0]&&pos<loopRanges[i][1]) return true; } return false; }

      // 候选：顶层块内、别名头之后声明的 LocalStatement 里的变量绑定。
      // 收集每条顶层 LocalStatement（在 header 之后）及其变量绑定。
      var hoistVars=[];   // {binding, varNode, stmt, posInStmt}
      var stmtSet=new Set();
      for(var si=priorDrop; si<ast.body.length; si++){
        var st=ast.body[si];
        if(st.type!=='LocalStatement' || !st.variables || !st.init) continue;
        if(st.init.length!==st.variables.length) continue;     // 多/少值截断，跳过整条
        if(inLoop(st.range[0])) continue;
        for(var vi=0; vi<st.variables.length; vi++){
          var vn=st.variables[vi];
          if(vn.type!=='Identifier') continue;
          var b=info.varOf.get(vn);
          if(!b) continue;
          if(b.scope.id!==topId) continue;       // 仅顶层
          if(b.captured) continue;               // 被闭包捕获不上提（捕获语义复杂）
          if(b.decls.length!==1) continue;
          hoistVars.push({binding:b, varNode:vn, stmt:st, posInStmt:vi});
          stmtSet.add(st);
        }
      }
      if(!hoistVars.length) return null;

      // 为避免与别名头重名：收集头部现有名字 + 全局名（保守）。上提的变量名都来自既有局部，
      // 它们已与头部别名经过 planAll 的统一着色不冲突，这里仅防御性检查不重复追加同名。
      var headerNames=new Set();
      headerStmt.variables.forEach(function(v){ if(v.type==='Identifier') headerNames.add(v.name); });

      // 生成候选 edits：
      //  ① 头部名列表尾部追加 `,X1,X2,...`（每个待上提变量名，去重）；不加 init（自动 nil）。
      //     但 Lua 要求 #init<=#vars 时尾随变量为 nil——合法。为保险，头部保持原样仅加名字。
      //  ② 每条待降级 LocalStatement：若其【所有】变量都被上提 → 去掉 'local '（变为赋值序列，
      //     但多变量 local 去掉 local 后是 `A,T=v1,v2` 多重赋值，仍合法且等价）；
      //     若仅部分变量被上提（这里全部上提，因为我们收集了该 stmt 的所有合格变量；
      //     若有不合格变量则不能简单去 local）——需逐条判断。
      var appendNames=[];
      var appendSeen=new Set();
      var edits=[];
      var hoistCount=0;

      // 按语句聚合
      var byStmt=new Map();
      hoistVars.forEach(function(h){ if(!byStmt.has(h.stmt)) byStmt.set(h.stmt, []); byStmt.get(h.stmt).push(h); });

      var abort=false;
      byStmt.forEach(function(list, st){
        if(abort) return;
        // 只有当该 LocalStatement 的【全部】变量都在候选里，才能整体去掉 'local '。
        if(list.length!==st.variables.length) return;   // 部分变量不合格 → 跳过该条（保守）
        // 头部追加这些名字
        list.forEach(function(h){
          if(!appendSeen.has(h.binding.name) && !headerNames.has(h.binding.name)){
            appendSeen.add(h.binding.name); appendNames.push(h.binding.name);
          } else if(headerNames.has(h.binding.name)){
            abort=true;   // 与头部已有名字冲突，放弃整次（罕见）
          }
        });
        // 去掉该语句的 'local '（前 6 字）。降级后为 `A=v` 或 `A,T=v1,v2`（多重赋值，合法）。
        if(src.slice(st.range[0], st.range[0]+6)!=='local ') { abort=true; return; }
        edits.push({start:st.range[0], end:st.range[0]+6, name:''});
        hoistCount+=list.length;
      });
      if(abort || !appendNames.length) return null;

      // 头部名列表尾部注入 `,X1,X2,...`
      edits.push({start:headerNamesEnd, end:headerNamesEnd, name:','+appendNames.join(',')});

      var candidate=applyEdits(src, edits);
      if(candidate.length>=src.length) return null;
      // 真·Lua 语法
      if(luaValidate && luaValidate(candidate)) return null;
      // canonical 等价（借助 forward-nil 归一）
      var ok=false;
      try{ ok=(canonical(originalCode)===canonical(candidate, priorAlias)); }catch(e){ ok=false; }
      if(!ok) return null;
      assertParses(candidate, '阶段1.7b/语法', steps);
      assertEquivalentAlias(originalCode, candidate, priorAlias, '阶段1.7b/等价', steps);
      if(rec) rec('声明上提(提交)', src.length, candidate.length, '上提 '+hoistCount+' 个变量到别名头并降级其 local');
      return {code:candidate, aliasMap:priorAlias};
    }

    // 严格"只缩短"闸门 + 真·Lua 语法 + canonical 等价，三关全过才提交，否则回退。
    function foldIfNot(src, priorAlias, steps, rec, originalCode){
      var ast; try{ ast=parse(src); }catch(e){ return null; }

      // 收集合格 IfStatement（不嵌套地由 applyEdits 跳过重叠；这里全收，靠等价校验兜底）
      var edits=[];
      (function walk(n){
        if(!n||typeof n!=='object') return;
        if(Array.isArray(n)){ for(var i=0;i<n.length;i++) walk(n[i]); return; }
        if(n.type==='IfStatement' && n.clauses && n.clauses.length===2
           && n.clauses[0].type==='IfClause' && n.clauses[1].type==='ElseClause'
           && n.clauses[0].condition && n.clauses[0].condition.type==='UnaryExpression'
           && n.clauses[0].condition.operator==='not' && n.range){
          var c0=n.clauses[0], c1=n.clauses[1];
          // 剥光全部前导 not，记个数
          var notCount=0, inner=c0.condition;
          while(inner && inner.type==='UnaryExpression' && inner.operator==='not'){ notCount++; inner=inner.argument; }
          if(inner && inner.range){
            var condText=src.slice(inner.range[0], inner.range[1]);   // 去掉全部 not 后的条件
            var aBody=c0.body||[], bBody=c1.body||[];
            var aText = aBody.length ? src.slice(aBody[0].range[0], aBody[aBody.length-1].range[1]) : '';
            var bText = bBody.length ? src.slice(bBody[0].range[0], bBody[bBody.length-1].range[1]) : '';
            // 奇数个 not → 对调（then=B, else=A）；偶数个 → 不对调（then=A, else=B）
            var thenText = (notCount%2===1) ? bText : aText;
            var elseText = (notCount%2===1) ? aText : bText;
            var rebuilt = 'if '+condText+' then '+thenText+' else '+elseText+' end';
            edits.push({start:n.range[0], end:n.range[1], name:rebuilt});
          }
        }
        for(var k in n){ if(k==='range'||k==='loc')continue; if(Object.prototype.hasOwnProperty.call(n,k)) walk(n[k]); }
      })(ast.body);
      if(!edits.length) return null;


      var candidate=applyEdits(src, edits);
      if(candidate.length>=src.length) return null;            // 只缩短才提交
      if(luaValidate && luaValidate(candidate)) return null;   // 真·Lua 语法
      var ok=false;
      try{ ok=(canonical(originalCode)===canonical(candidate, priorAlias)); }catch(e){ ok=false; }
      if(!ok) return null;
      assertParses(candidate, '阶段1.6b/语法', steps);
      assertEquivalentAlias(originalCode, candidate, priorAlias, '阶段1.6b/等价', steps);
      if(rec) rec('if-not二择(提交)', src.length, candidate.length, '去 not 并对调分支体 '+edits.length+' 处');
      return {code:candidate, aliasMap:priorAlias};
    }

    // ---------- obj["Field"] → obj.Field（括号访问转点访问） ----------
    // 仅当 index 是【无转义的标识符样字符串字面量】时改写，每处省 3 字。
    // 字段名位置允许关键字（obj.end ≡ obj["end"]），故无需排除关键字。
    function foldBracketDot(src, priorAlias, steps, rec, originalCode){
      var ast; try{ ast=parse(src); }catch(e){ return null; }
      var edits=[];
      (function walk(n){
        if(!n||typeof n!=='object') return;
        if(Array.isArray(n)){ for(var i=0;i<n.length;i++) walk(n[i]); return; }
        if(n.type==='IndexExpression' && n.index && n.index.type==='StringLiteral'
           && n.base && n.base.range && n.range){
          var m=/^(['"])([A-Za-z_][A-Za-z0-9_]*)\1$/.exec(n.index.raw||'');
          // 关键字不能作点访问字段名（obj.end 是语法错误），必须保留括号形式
          if(m && !KEYWORDS[m[2]]) edits.push({start:n.base.range[1], end:n.range[1], name:'.'+m[2]});
        }
        for(var k in n){ if(k==='range'||k==='loc')continue; if(Object.prototype.hasOwnProperty.call(n,k)) walk(n[k]); }
      })(ast.body);
      if(!edits.length) return null;
      var candidate=applyEdits(src, edits);
      if(candidate.length>=src.length) return null;
      if(!canCommit(originalCode, candidate, priorAlias)) return null;
      assertParses(candidate, 'bracket-dot/syntax', steps);
      assertEquivalentAlias(originalCode, candidate, priorAlias, 'bracket-dot/等价', steps);
      if(rec) rec('括号转点(提交)', src.length, candidate.length, '改写 '+edits.length+' 处 obj["Field"]→obj.Field');
      return {code:candidate, aliasMap:priorAlias};
    }

    // ---------- 只读局部内联（逆别名 / 反向纠错） ----------
    // 对"单声明、从不被赋值、init 为字面量"的局部，若内联回字面量比保留别名+声明更短，
    // 则内联并删除声明。这是字符串/数字/布尔别名技巧的反向纠错：手写的负优化别名会被拆回。
    function foldReadonlyInline(src, priorAlias, steps, rec, originalCode){
      var ast; try{ ast=parse(src); }catch(e){ return null; }
      var info=analyze(ast);
      var assignedB=new Set();
      (function collect(node){
        if(!node||typeof node!=='object')return;
        if(Array.isArray(node)){for(var i=0;i<node.length;i++)collect(node[i]);return;}
        if(node.type==='AssignmentStatement'&&node.variables){
          for(var i=0;i<node.variables.length;i++){
            var t=node.variables[i];
            if(t&&t.type==='Identifier'){var bb=info.varOf.get(t);if(bb)assignedB.add(bb);}
          }
        }
        for(var k in node){if(k==='range'||k==='loc'||k==='parent'||k==='scope')continue;if(Object.prototype.hasOwnProperty.call(node,k))collect(node[k]);}
      })(ast.body);
      function isPureExpr(node){
        if(!node||typeof node!=='object') return false;
        switch(node.type){
          case 'NumericLiteral': case 'StringLiteral': case 'BooleanLiteral': case 'NilLiteral': return true;
          case 'TableConstructorExpression':
            for(var i=0;i<node.fields.length;i++){
              var f=node.fields[i];
              if(f.type==='TableKey'){ if(!isPureExpr(f.key)||!isPureExpr(f.value)) return false; }
              else if(f.type==='TableKeyString'||f.type==='TableValue'){ if(!isPureExpr(f.value)) return false; }
            }
            return true;
          default: return false;
        }
      }
      var edits=[];
      (function walk(stmts){
        for(var si=0;si<stmts.length;si++){
          var st=stmts[si];
          if(st.type!=='LocalStatement'||!st.variables||!st.init) continue;
          if(st.variables.length!==1||st.init.length!==1) continue;
          var v=st.variables[0], ie=st.init[0];
          if(v.type!=='Identifier'||!ie||!ie.range) continue;
          var b=info.varOf.get(v);
          if(!b||b.decls.length!==1||assignedB.has(b)||b.captured) continue;
          var T=ie.type;
          var isLiteral=(T==='NumericLiteral'||T==='StringLiteral'||T==='BooleanLiteral');
          var isPure=isLiteral || isPureExpr(ie);
          if(!isPure) continue;
          var lit=src.slice(ie.range[0],ie.range[1]);
          var uses=b.uses.length, litLen=lit.length;
          if(uses===0){ edits.push({start:st.range[0],end:st.range[1],name:''}); continue; }
          if(!isLiteral) continue; // 纯但非字面量：仅删不用，不内联
          // 内联当 uses*(litLen-1) < litLen+9（单变量声明成本≈litLen+9，名字已重命名为单字母）
          if(uses*(litLen-1) >= litLen+9) continue;
          edits.push({start:st.range[0],end:st.range[1],name:''});
          b.uses.forEach(function(u){
            var nx=(u.range[1]<src.length)?src[u.range[1]]:undefined;
            var last=lit[lit.length-1];
            var spacer=(nx!==undefined&&(isNamePart(nx)||(nx==='.'&&last>='0'&&last<='9')))?' ':'';
            edits.push({start:u.range[0],end:u.range[1],name:lit+spacer});
          });
        }
      })(ast.body);
      if(!edits.length) return null;
      var candidate=applyEdits(src, edits);
      if(candidate.length>=src.length) return null;
      if(!canCommit(originalCode, candidate, priorAlias)) return null;
      assertParses(candidate, 'readonly-inline/syntax', steps);
      assertEquivalentAlias(originalCode, candidate, priorAlias, 'readonly-inline/等价', steps);
      if(rec) rec('只读内联(提交)', src.length, candidate.length, '内联并删除 '+edits.length+' 处负优化别名');
      return {code:candidate, aliasMap:priorAlias};
    }

    // ---------- 常量折叠（整数算术 / 字符串拼接 / not 布尔） ----------
    // canonical 已内置 constFold 常量归一（1+2 ≡ 3），等价校验走 canCommit，无需 fengari 逐处求值。
    function foldConstant(src, priorAlias, steps, rec, originalCode){
      var ast; try{ ast=parse(src); }catch(e){ return null; }
      // 递归常量求值：支持嵌套常量（1+2*3 → 7）一次折叠到位，避免单层遍历只折叠叶子导致不幂等。
      function evalConst(n){
        if(!n||typeof n!=='object') return null;
        if(n.type==='NumericLiteral'){
          var raw=n.raw||'';
          if(/^[+-]?\d+$/.test(raw)) return {kind:'int', v:parseInt(raw,10)};
          if(/^0[xX][0-9a-fA-F]+$/.test(raw)) return {kind:'int', v:parseInt(raw,16)};
          return null;
        }
        if(n.type==='StringLiteral'){
          var sraw=n.raw||'';
          if(sraw.length>=2 && sraw[0]==="'" && sraw[sraw.length-1]==="'") return {kind:'str', v:sraw.slice(1,-1)};
          return null;
        }
        if(n.type==='BinaryExpression'){
          var L=evalConst(n.left), R=evalConst(n.right);
          if(L&&R){
            if(n.operator==='..'&&L.kind==='str'&&R.kind==='str') return {kind:'str', v:L.v+R.v};
            if(L.kind==='int'&&R.kind==='int'){
              var r;
              if(n.operator==='+')r=L.v+R.v;
              else if(n.operator==='-')r=L.v-R.v;
              else if(n.operator==='*')r=L.v*R.v;
              else return null;
              if(Number.isInteger(r)&&Math.abs(r)<=9007199254740991) return {kind:'int', v:r};
            }
          }
          return null;
        }
        return null;
      }
      function fmt(v){
        if(v.kind==='int') return String(v.v);
        if(v.kind==='str'){
          if(v.v.indexOf("'")>=0||v.v.indexOf('\\')>=0||v.v.indexOf('\n')>=0||v.v.indexOf('\r')>=0) return null;
          return "'"+v.v+"'";
        }
        return null;
      }
      var edits=[];
      (function walk(n){
        if(!n||typeof n!=='object') return;
        if(Array.isArray(n)){ for(var i=0;i<n.length;i++) walk(n[i]); return; }
        if(n.type==='BinaryExpression'&&n.range){
          var v=evalConst(n);
          if(v){
            var rep=fmt(v);
            if(rep!==null && rep.length<n.range[1]-n.range[0]){
              edits.push({start:n.range[0],end:n.range[1],name:rep});
              return;   // 外层已折叠，不再递归子表达式（避免重叠编辑）
            }
          }
        }else if(n.type==='UnaryExpression'&&n.operator==='not'&&n.range&&n.argument&&n.argument.type==='BooleanLiteral'){
          var rep2=String(!n.argument.value);
          if(rep2.length<n.range[1]-n.range[0]){
            edits.push({start:n.range[0],end:n.range[1],name:rep2});
          }
        }
        for(var k in n){ if(k==='range'||k==='loc')continue; if(Object.prototype.hasOwnProperty.call(n,k)) walk(n[k]); }
      })(ast.body);
      if(!edits.length) return null;
      var candidate=applyEdits(src, edits);
      if(candidate.length>=src.length) return null;
      if(!canCommit(originalCode, candidate, priorAlias)) return null;
      assertParses(candidate, 'const-fold/syntax', steps);
      assertEquivalentAlias(originalCode, candidate, priorAlias, 'const-fold/等价', steps);
      if(rec) rec('常量折叠(提交)', src.length, candidate.length, '折叠 '+edits.length+' 处常量表达式');
      return {code:candidate, aliasMap:priorAlias};
    }

    // ---------- 常量条件折叠（if <bool字面量> then A else B end → do A end） ----------
    // 只处理顶层 if 条件为字面量 true/false 的简单形态（无 elseif）。分支用 do..end 包裹以保留局部作用域。
    // canonical 的 IfStatement 归一（constValue 解析布尔别名）把两侧收敛到 Do 块，等价校验自然通过。
    function foldConstCondition(src, priorAlias, steps, rec, originalCode){
      var ast; try{ ast=parse(src); }catch(e){ return null; }
      function branchHasLocals(body){
        for(var i=0;i<body.length;i++){
          var s=body[i], t=s.type;
          if(t==='LocalStatement'||t==='ForNumericStatement'||t==='ForGenericStatement') return true;
          if(t==='FunctionDeclaration' && s.isLocal) return true;   // local function 才引入局部
        }
        return false;
      }
      var edits=[];
      (function walk(n){
        if(!n||typeof n!=='object') return;
        if(Array.isArray(n)){ for(var i=0;i<n.length;i++) walk(n[i]); return; }
        if(n.type==='IfStatement' && n.clauses && n.clauses.length>=1 && n.clauses.length<=2 && n.range){
          var cond=n.clauses[0].condition;
          if(cond && cond.type==='BooleanLiteral'){
            var body = cond.value ? (n.clauses[0].body||[]) : (n.clauses[1] && n.clauses[1].body ? n.clauses[1].body : []);
            var name;
            if(!body.length){
              name='';                                  // 空分支 → 删除
            } else if(branchHasLocals(body)){
              var inner=src.slice(body[0].range[0], body[body.length-1].range[1]);
              name='do '+inner+' end';                  // 有局部声明 → 保留作用域
            } else {
              name=src.slice(body[0].range[0], body[body.length-1].range[1]);   // 无局部 → 直接展开
            }
            edits.push({start:n.range[0], end:n.range[1], name:name});
            return;   // 已折叠，不递归进 if 内部
          }
        }
        for(var k in n){ if(k!=='range'&&k!=='loc'&&Object.prototype.hasOwnProperty.call(n,k)) walk(n[k]); }
      })(ast.body);
      if(!edits.length) return null;
      var candidate=applyEdits(src, edits);
      if(candidate.length>=src.length) return null;
      if(!canCommit(originalCode, candidate, priorAlias)) return null;
      assertParses(candidate, 'const-cond/syntax', steps);
      assertEquivalentAlias(originalCode, candidate, priorAlias, 'const-cond/等价', steps);
      if(rec) rec('常量条件折叠(提交)', src.length, candidate.length, '折叠 '+edits.length+' 处常量条件');
      return {code:candidate, aliasMap:priorAlias};
    }

    // ---------- 表字段赋值 → 表构造器（local M={} M.X=v M.Y=w → local M={X=v,Y=w}） ----------
    // 仅合并紧邻声明的点访问赋值；字段值不得引用 M（否则构造器里对 M 的读会指到外层 M，语义不同）。
    // canonical 的 mergeTableFields 归一保证两侧等价；"M 不再被读"的退化情形由 canCommit 拒绝。
    function foldTableFields(src, priorAlias, steps, rec, originalCode){
      var ast; try{ ast=parse(src); }catch(e){ return null; }
      var info; try{ info=analyze(ast); }catch(e){ return null; }
      var varOf=info.varOf;
      function refsBinding(n, b){
        var found=false;
        (function w(x){
          if(found||!x||typeof x!=='object') return;
          if(Array.isArray(x)){ for(var i=0;i<x.length;i++) w(x[i]); return; }
          if(x.type==='Identifier' && varOf.has(x) && varOf.get(x)===b){ found=true; return; }
          for(var k in x){ if(k==='range'||k==='loc')continue; if(Object.prototype.hasOwnProperty.call(x,k)) w(x[k]); }
        })(n);
        return found;
      }
      var edits=[];
      for(var si=0; si<ast.body.length; si++){
        var st=ast.body[si];
        if(st.type!=='LocalStatement' || !st.variables || st.variables.length!==1 || !st.init || st.init.length!==1) continue;
        var init=st.init[0];
        if(init.type!=='TableConstructorExpression' || (init.fields && init.fields.length)) continue;
        var mv=st.variables[0];
        if(mv.type!=='Identifier' || !mv.range || !varOf.has(mv)) continue;
        var mB=varOf.get(mv);
        var fields=[];
        var j=si+1;
        while(j<ast.body.length){
          var as=ast.body[j];
          if(as.type==='AssignmentStatement' && as.variables && as.variables.length===1 && as.init && as.init.length===1){
            var tgt=as.variables[0];
            if(tgt.type==='MemberExpression' && tgt.indexer==='.' && tgt.base && tgt.base.type==='Identifier'
               && tgt.identifier && tgt.identifier.range && tgt.base.range
               && varOf.has(tgt.base) && varOf.get(tgt.base)===mB
               && as.init[0] && as.init[0].range && !refsBinding(as.init[0], mB)){
              fields.push({key:tgt.identifier.name, value:src.slice(as.init[0].range[0], as.init[0].range[1]), end:as.range[1]});
              j++;
              continue;
            }
          }
          break;
        }
        if(fields.length){
          var prefix=src.slice(st.range[0], init.range[0]);   // 'local M='
          var merged=prefix+'{'+fields.map(function(f){return f.key+'='+f.value;}).join(',')+'}';
          edits.push({start:st.range[0], end:fields[fields.length-1].end, name:merged});
        }
        si=j-1;
      }
      if(!edits.length) return null;
      var candidate=applyEdits(src, edits);
      if(candidate.length>=src.length) return null;
      if(!canCommit(originalCode, candidate, priorAlias)) return null;
      assertParses(candidate, 'table-fields/syntax', steps);
      assertEquivalentAlias(originalCode, candidate, priorAlias, 'table-fields/等价', steps);
      if(rec) rec('表字段合并(提交)', src.length, candidate.length, '合并 '+edits.length+' 组表字段');
      return {code:candidate, aliasMap:priorAlias};
    }

    // ---------- true/false 布尔常量别名 ----------
    // true(4)/false(5) 出现多次时提取 local Y=true 别名。反向纠错由 foldReadonlyInline 承担。
    // canonical 的 detectLit 会把 local Y=true 归一为字面量 true，等价校验自然通过。
    function foldBoolNil(src, priorAlias, steps, rec, originalCode){
      var ast; try{ ast=parse(src); }catch(e){ return null; }
      var priorDrop=(priorAlias && priorAlias.dropLeading)||0;
      var headerRanges=[];
      for(var hi=0; hi<priorDrop && hi<ast.body.length; hi++){ if(ast.body[hi]&&ast.body[hi].range) headerRanges.push(ast.body[hi].range); }
      function inHeader(node){ if(!node||!node.range) return false; for(var i=0;i<headerRanges.length;i++){ if(node.range[0]>=headerRanges[i][0]&&node.range[1]<=headerRanges[i][1]) return true; } return false; }
      var sites=Object.create(null);
      (function walk(n){
        if(!n||typeof n!=='object') return;
        if(Array.isArray(n)){ for(var i=0;i<n.length;i++) walk(n[i]); return; }
        if(n.type==='BooleanLiteral' && !inHeader(n) && n.range){
          var key=String(n.value);
          (sites[key]=sites[key]||[]).push({start:n.range[0], end:n.range[1]});
        }
        for(var k in n){ if(k==='range'||k==='loc')continue; if(Object.prototype.hasOwnProperty.call(n,k)) walk(n[k]); }
      })(ast.body);
      var taken=new Set(); Object.keys(KEYWORDS).forEach(function(k){taken.add(k);});
      (function cn(n){
        if(!n||typeof n!=='object')return;
        if(Array.isArray(n)){n.forEach(cn);return;}
        if(n.type==='Identifier'&&n.name) taken.add(n.name);
        for(var k in n){ if(k!=='range'&&k!=='loc'&&Object.prototype.hasOwnProperty.call(n,k)) cn(n[k]); }
      })(ast.body);
      var POOL=candidateGenerator();
      function nextName(){ for(var i=0;i<POOL.length;i++){ if(!taken.has(POOL[i])&&!KEYWORDS[POOL[i]]){ taken.add(POOL[i]); return POOL[i]; } } return null; }
      var chosen=[];
      ['false','true'].forEach(function(v){
        var group=sites[v];
        if(!group||group.length<3) return;
        var alias=nextName();
        if(!alias) return;
        var wordLen=v.length;
        var declCost=8+wordLen; // local A=v 约 (6+1+1+wordLen)，留 1 分隔空格
        var gain=group.length*(wordLen-1)-declCost;
        if(gain<=0) return;
        chosen.push({v:v, alias:alias, sites:group});
      });
      if(!chosen.length) return null;
      var edits=[];
      chosen.forEach(function(c){ c.sites.forEach(function(s){ edits.push({start:s.start, end:s.end, name:c.alias}); }); });
      var newBody=applyEdits(src, edits);
      var declNames=chosen.map(function(c){return c.alias;}).join(',');
      var declVals=chosen.map(function(c){return c.v;}).join(',');
      var candidate='local '+declNames+'='+declVals+' '+newBody;
      if(candidate.length>=src.length) return null;
      if(!canCommit(originalCode, candidate, priorAlias)) return null;
      assertParses(candidate, 'bool-alias/syntax', steps);
      assertEquivalentAlias(originalCode, candidate, priorAlias, 'bool-alias/等价', steps);
      if(rec) rec('布尔别名(提交)', src.length, candidate.length, '提取 '+chosen.length+' 个布尔别名');
      return {code:candidate, aliasMap:priorAlias};
    }

    // ---------- 数字字面量最小化：0.X → .X ----------
    // 前导 0 去除（浮点→浮点）。仅当前一字符不是 '.'（避免 1..0.5 → 1...5）且不是名字字符（避免合并）。
    function foldNumbers(src, priorAlias, steps, rec, originalCode){
      var ast; try{ ast=parse(src); }catch(e){ return null; }
      var edits=[];
      (function walk(n){
        if(!n||typeof n!=='object') return;
        if(Array.isArray(n)){ for(var i=0;i<n.length;i++) walk(n[i]); return; }
        if(n.type==='NumericLiteral' && n.raw && /^0\.\d+$/.test(n.raw) && n.range){
          var prev=(n.range[0]>0)?src[n.range[0]-1]:'';
          if(prev!=='.' && !isNamePart(prev)){
            edits.push({start:n.range[0], end:n.range[0]+1, name:''});
          }
        }
        for(var k in n){ if(k==='range'||k==='loc')continue; if(Object.prototype.hasOwnProperty.call(n,k)) walk(n[k]); }
      })(ast.body);
      if(!edits.length) return null;
      var candidate=applyEdits(src, edits);
      if(candidate.length>=src.length) return null;
      if(!canCommit(originalCode, candidate, priorAlias)) return null;
      assertParses(candidate, 'number-min/syntax', steps);
      assertEquivalentAlias(originalCode, candidate, priorAlias, 'number-min/等价', steps);
      if(rec) rec('数字归一(提交)', src.length, candidate.length, '删除 '+edits.length+' 处前导 0');
      return {code:candidate, aliasMap:priorAlias};
    }

    // ---------- 冗余括号消除 ----------
    // 仅删除"围绕主表达式"的括号（字面量/标识符/成员/调用/索引/表/函数），这些括号不承载优先级。
    // 关键排除：调用实参的括号是调用语法的一部分（f(x) 的 ( )），绝不可删——通过 inArgs 标记跳过。
    // canonical 用 luaparse（忽略括号），故 (x) 与 x 天然等价，等价校验自动通过。
    function foldParens(src, priorAlias, steps, rec, originalCode){
      var ast; try{ ast=parse(src); }catch(e){ return null; }
      var PRIMARY={Identifier:1,NumericLiteral:1,StringLiteral:1,BooleanLiteral:1,NilLiteral:1,VarargLiteral:1,
                   MemberExpression:1,IndexExpression:1,CallExpression:1,StringCallExpression:1,TableCallExpression:1,
                   TableConstructorExpression:1,FunctionDeclaration:1};
      var edits=[];
      (function walk(n, inArgs){
        if(!n||typeof n!=='object') return;
        if(Array.isArray(n)){ for(var i=0;i<n.length;i++) walk(n[i], inArgs); return; }
        if(PRIMARY[n.type] && n.range && !inArgs){
          var before=(n.range[0]>0)?src[n.range[0]-1]:'';
          var after=(n.range[1]<src.length)?src[n.range[1]]:'';
          // 载荷分号：x;(h)(x) 里的 (h) 若去括号，; 会从"后跟 ("变成"后跟名字"而被分号消除误删，改变语义
          var beforeParen=(n.range[0]>=2)?src[n.range[0]-2]:'';
          if(before==='(' && after===')' && beforeParen!==';'){
            edits.push({start:n.range[0]-1, end:n.range[0], name:''});
            edits.push({start:n.range[1], end:n.range[1]+1, name:''});
          }
        }
        for(var k in n){
          if(k==='range'||k==='loc') continue;
          if(!Object.prototype.hasOwnProperty.call(n,k)) continue;
          var ci=inArgs;
          if(n.type==='CallExpression' && k==='arguments') ci=true;      // 实参括号
          else if(n.type==='CallExpression' && k==='base') ci=false;      // 被调者括号可删
          walk(n[k], ci);
        }
      })(ast.body, false);
      if(!edits.length) return null;
      var candidate=applyEdits(src, edits);
      if(candidate.length>=src.length) return null;
      if(!canCommit(originalCode, candidate, priorAlias)) return null;
      assertParses(candidate, 'paren-removal/syntax', steps);
      assertEquivalentAlias(originalCode, candidate, priorAlias, 'paren-removal/等价', steps);
      if(rec) rec('括号消除(提交)', src.length, candidate.length, '删除 '+(edits.length/2)+' 对冗余括号');
      return {code:candidate, aliasMap:priorAlias};
    }

    // ---------- 比较重排：a()>b then → b<a() then ----------
    // 比较运算是代数恒等式：a OP b ≡ b FLIP(OP) a（==/~= 对称、< > <= >= 翻转）。因此无需求值验证，
    // 唯一风险是两侧都有副作用时求值顺序改变——用"至多一侧含调用/索引"约束排除。
    // 本 pass 自身不缩短（重排等长），作用是让 ) 收尾的操作数贴紧后续关键字，由后置 minimizeSpacing 兑现省 1 字。
    function foldCompareReorder(src, priorAlias, steps, rec, originalCode){
      var ast; try{ ast=parse(src); }catch(e){ return null; }
      var FLIP={'<':'>','>':'<','<=':'>=','>=':'<='};
      var edits=[];
      function hasSideEffect(node){
        var found=false;
        (function w(n){ if(found||!n||typeof n!=='object')return; if(Array.isArray(n)){for(var i=0;i<n.length;i++)w(n[i]);return;}
          if(n.type==='CallExpression'||n.type==='IndexExpression'){found=true;return;}
          for(var k in n){if(k==='range'||k==='loc')continue;if(Object.prototype.hasOwnProperty.call(n,k))w(n[k]);} })(node);
        return found;
      }
      function symEnd(t){ var c=t[t.length-1]; return c===')'||c===']'||c==="'"||c==='"'; }
      function nameEnd(t){ var c=t[t.length-1]; return isNamePart(c); }
      (function walk(n){
        if(!n||typeof n!=='object') return;
        if(Array.isArray(n)){ for(var i=0;i<n.length;i++) walk(n[i]); return; }
        if(n.type==='BinaryExpression' && n.range && n.left && n.right && n.left.range && n.right.range){
          var op=n.operator;
          if(op==='<'||op==='>'||op==='<='||op==='>='||op==='=='||op==='~='){
            var lc=hasSideEffect(n.left), rc=hasSideEffect(n.right);
            if(!(lc&&rc)){
              var lt=src.slice(n.left.range[0],n.left.range[1]);
              var rt=src.slice(n.right.range[0],n.right.range[1]);
              if(symEnd(lt) && nameEnd(rt)){
                var rebuilt=(op==='=='||op==='~=')?(rt+op+lt):(rt+FLIP[op]+lt);
                edits.push({start:n.range[0],end:n.range[1],name:rebuilt});
              }
            }
          }
        }
        for(var k in n){ if(k==='range'||k==='loc')continue; if(Object.prototype.hasOwnProperty.call(n,k)) walk(n[k]); }
      })(ast.body);
      if(!edits.length) return null;
      var candidate=applyEdits(src, edits);
      if(candidate.length>src.length) return null;   // 等长允许（靠后置空格消除兑现收益）
      if(luaValidate && luaValidate(candidate)) return null;
      assertParses(candidate, 'compare-reorder/syntax', steps);
      if(rec) rec('比较重排(提交)', src.length, candidate.length, '重排 '+edits.length+' 处比较');
      return {code:candidate, aliasMap:priorAlias};
    }

    // ---------- local function 并入前置 local 声明 ----------
    // local a=1 local function f()end → local a,f=1,function()end（省一个 "local "）。
    // 仅当前置 local #init==#vars 且末值不是多返回值表达式（追加值会改变截断）。
    function foldLocalFunc(src, priorAlias, steps, rec, originalCode){
      var ast; try{ ast=parse(src); }catch(e){ return null; }
      var info; try{ info=analyze(ast); }catch(e){ return null; }
      var varOf=info.varOf;
      var edits=[];
      function processBlock(stmts){
        for(var si=1; si<stmts.length; si++){
          var st=stmts[si], prev=stmts[si-1];
          // 统一识别两种等价形态：
          //   (A) local function f()BODY end  → FunctionDeclaration(isLocal)
          //   (B) local f=function()BODY end   → LocalStatement + 匿名 FunctionDeclaration init
          // 两者压成同一结果：直接合并 `local a,f=1,function()BODY`，或先声明后赋值 `local a,f=1 f=function()BODY`。
          var fn=null; // {name, value, body, declStart, declEnd, replaceWith}
          if(st.type==='FunctionDeclaration' && st.isLocal && st.identifier && st.identifier.type==='Identifier' && st.range && st.identifier.range){
            var full=src.slice(st.range[0], st.range[1]);
            var m=/^local\s+function\s+([A-Za-z_][A-Za-z0-9_]*)/.exec(full);
            if(m){
              fn={
                name:m[1],
                value:'function'+full.slice(m[0].length),
                body:st.body,
                declStart:st.range[0],
                declEnd:st.range[0]+m[0].length,
                replaceWith:m[1]+'=function'
              };
            }
          } else if(st.type==='LocalStatement' && st.variables && st.variables.length===1 && st.init && st.init.length===1
                     && st.init[0].type==='FunctionDeclaration' && !st.init[0].isLocal
                     && st.range && st.variables[0].range && st.init[0].range){
            fn={
              name:st.variables[0].name,
              value:src.slice(st.init[0].range[0], st.init[0].range[1]),
              body:st.init[0].body,
              declStart:st.range[0],
              declEnd:st.init[0].range[0],
              replaceWith:st.variables[0].name+'='
            };
          }
          if(!fn) continue;
          if(!(prev.type==='LocalStatement' && prev.variables && prev.init && prev.variables.length===prev.init.length && prev.variables.length>0)) continue;
          var lastInit=prev.init[prev.init.length-1];
          if(lastInit && (lastInit.type==='CallExpression'||lastInit.type==='StringCallExpression'||lastInit.type==='TableCallExpression'||lastInit.type==='VarargLiteral')) continue;
          // 健全性：函数体不得引用被合并的 prev 变量。否则合并成 `local a,b=...,function` 后，
          // 闭包里读到的 a 是外层同名变量（nil），而分离写法读到的是本语句刚声明的 a，语义不同。
          var prevBindings=new Set(); var refsPrev=false;
          for(var pv=0;pv<prev.variables.length;pv++){
            var pvn=prev.variables[pv];
            if(pvn.type==='Identifier' && varOf.has(pvn)) prevBindings.add(varOf.get(pvn));
          }
          if(prevBindings.size){
            (function chk(n){ if(refsPrev||!n||typeof n!=='object')return; if(Array.isArray(n)){for(var ci=0;ci<n.length;ci++)chk(n[ci]);return;}
              if(n.type==='Identifier'){ var b=varOf.get(n); if(b&&prevBindings.has(b)){refsPrev=true;return;} }
              for(var k in n){ if(k!=='range'&&k!=='loc'&&Object.prototype.hasOwnProperty.call(n,k)) chk(n[k]); } })(fn.body);
          }
          var lastVar=prev.variables[prev.variables.length-1];
          if(refsPrev){
            // 健全的「先声明、后赋值」退化：
            //   local a=1 local function f()BODY  →  local a,f=1 f=function()BODY
            edits.push({start:lastVar.range[1], end:lastVar.range[1], name:','+fn.name});
            edits.push({start:fn.declStart, end:fn.declEnd, name:fn.replaceWith});
          }else{
            var lastInitNode=prev.init[prev.init.length-1];
            edits.push({start:lastVar.range[1], end:lastVar.range[1], name:','+fn.name});
            edits.push({start:lastInitNode.range[1], end:lastInitNode.range[1], name:','+fn.value});
            edits.push({start:st.range[0], end:st.range[1], name:''});
          }
        }
        for(var i=0;i<stmts.length;i++) descend(stmts[i]);
      }
      function descend(st){
        switch(st.type){
          case 'IfStatement': st.clauses.forEach(function(c){processBlock(c.body||[]);}); break;
          case 'WhileStatement': case 'DoStatement': case 'ForNumericStatement':
          case 'ForGenericStatement': case 'RepeatStatement': processBlock(st.body||[]); break;
          default:
            (function w(n){ if(!n||typeof n!=='object')return; if(Array.isArray(n)){n.forEach(w);return;}
              if(n.type==='FunctionDeclaration'){ processBlock(n.body||[]); return; }
              for(var k in n){ if(k!=='range'&&k!=='loc'&&Object.prototype.hasOwnProperty.call(n,k)) w(n[k]); } })(st);
        }
      }
      processBlock(ast.body);
      if(!edits.length) return null;
      var candidate=applyEdits(src, edits);
      if(candidate.length>=src.length) return null;
      if(!canCommit(originalCode, candidate, priorAlias)) return null;
      assertParses(candidate, 'local-func/syntax', steps);
      assertEquivalentAlias(originalCode, candidate, priorAlias, 'local-func/等价', steps);
      if(rec) rec('local function 合并(提交)', src.length, candidate.length, '合并 '+Math.floor(edits.length/3)+' 处 local function');
      return {code:candidate, aliasMap:priorAlias};
    }

    C.preprocess=preprocess; C.foldMethods=foldMethods; C.foldFieldPrefix=foldFieldPrefix; C.foldStringLiterals=foldStringLiterals; C.foldStringFactors=foldStringFactors; C.foldBlockWrapper=foldBlockWrapper; C.foldCallSugar=foldCallSugar; C.splitMultiAssign=splitMultiAssign; C.isSplitSafe=isSplitSafe; C.foldLocals=foldLocals; C.foldReuse=foldReuse; C.foldDeclHoist=foldDeclHoist; C.foldIfNot=foldIfNot; C.foldBracketDot=foldBracketDot; C.foldReadonlyInline=foldReadonlyInline; C.foldConstant=foldConstant; C.foldConstCondition=foldConstCondition; C.foldTableFields=foldTableFields; C.foldBoolNil=foldBoolNil; C.foldNumbers=foldNumbers; C.foldParens=foldParens; C.foldCompareReorder=foldCompareReorder; C.foldLocalFunc=foldLocalFunc;
  }});
})(typeof window !== 'undefined' ? window : globalThis);
