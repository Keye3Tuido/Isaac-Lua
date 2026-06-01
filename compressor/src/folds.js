/* LuaMin part: folds — 由 _refactor_split.js 从 core.js 抽取，函数体逐字保留 */
(function(root){
  'use strict';
  (root.__LuaMinParts = root.__LuaMinParts || []).push({name:'folds', install:function(C){
    var KEYWORDS=C.KEYWORDS, luaValidate=C.luaValidate, parse=C.parse, analyze=C.analyze, candidateGenerator=C.candidateGenerator, applyEdits=C.applyEdits, applyEncoding=C.applyEncoding, canonical=C.canonical, assertEquivalentAlias=C.assertEquivalentAlias, assertParses=C.assertParses, isNamePart=C.isNamePart;
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
      assertParses(candidate, '阶段1.7/语法', steps);
      var newAlias = {
        byName: (priorAlias&&priorAlias.byName)||{},
        memberByLocal: memberByLocal,
        factorLocals: (priorAlias&&priorAlias.factorLocals)||[],
        prefixFoldByLocal: Object.assign({}, (priorAlias&&priorAlias.prefixFoldByLocal)||{}),
        stringAliasByLocal: Object.assign({}, (priorAlias&&priorAlias.stringAliasByLocal)||{}),
        dropLeading: ((priorAlias&&priorAlias.dropLeading)||0) + 1   // 多了一条 local 声明
      };
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

      // 选取候选：贪心，每轮选"乐观收益最高"的前缀，提取后从字段集合里移除已用到的字段。
      // 因为一个字段一次只能挂一个前缀因子（不能同时被两个前缀重写），需互斥分配。
      // 真实因子名长度 |U| 在 nextName() 之后才确定（可能 1 也可能 2），用真实长度复核单因子收益，
      // 防止"批次总收益正、个别因子单看是负"的次优选择。
      // 声明开销取决于注入模式：能否合并进 priorAlias 的 batched local 决定每因子是 |U|+|P|+4 还是 |U|+|P|+10。
      // 这里先用乐观（注入模式）估算预筛，注入路径在后面统一判断；最终由 candidate.length 闸门兜底。
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
      var usedFields=Object.create(null);
      var chosen=[]; // {prefix, alias, fields:[{field,sites}], totalSites}
      while(true){
        var bestPref=null, bestGain=0;
        for(var p in prefixGroups){
          if(!Object.prototype.hasOwnProperty.call(prefixGroups,p)) continue;
          if(p.length<2) continue;
          var grp=prefixGroups[p].filter(function(x){return !usedFields[x.field];});
          if(grp.length<2) continue;
          var totalSites=grp.reduce(function(s,x){return s+x.sites;},0);
          // 乐观估算（|U|=1）：每处省 |P|−6，单因子声明 |P|+1+declOverhead
          var perSite=p.length-6;
          var declCost=p.length+1+declOverhead;
          var gain=perSite*totalSites - declCost;
          if(gain>bestGain){ bestGain=gain; bestPref={prefix:p, fields:grp, totalSites:totalSites}; }
        }
        if(!bestPref) break;
        var alias=nextName();
        if(!alias) break;
        // 用真实 |U| 复核：每处省 = |P|−|U|−5，单因子声明 = |U|+|P|+declOverhead
        var realPer = bestPref.prefix.length - alias.length - 5;
        var realDecl = alias.length + bestPref.prefix.length + declOverhead;
        var realGain = realPer * bestPref.totalSites - realDecl;
        if(realGain<=0){
          delete prefixGroups[bestPref.prefix];
          continue;
        }
        chosen.push({prefix:bestPref.prefix, alias:alias, fields:bestPref.fields, totalSites:bestPref.totalSites});
        bestPref.fields.forEach(function(x){ usedFields[x.field]=true; });
      }
      if(!chosen.length) return null;

      // 构造 edits：把每处 .PREFIX_X (区间 [baseEnd, idEnd)) 替换为 [alias..'rest']
      var edits=[];
      var newPrefixMap={};
      chosen.forEach(function(c){
        newPrefixMap[c.alias]=c.prefix;
        c.fields.forEach(function(x){
          var rest=x.field.slice(c.prefix.length);
          fieldSites[x.field].forEach(function(s){
            edits.push({start:s.baseEnd, end:s.idEnd, name:"["+c.alias+"..'"+rest+"']"});
          });
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
      var candidate;
      var dropDelta;
      if(injectStmt){
        // 在最后一个变量名后插入 ',aliases'，在整条语句末尾插入 ',values'
        var lastVar=injectStmt.variables[injectStmt.variables.length-1];
        var stmtEnd=injectStmt.range[1];
        var injectNames=','+chosen.map(function(c){return c.alias;}).join(',');
        var injectVals=','+chosen.map(function(c){return "'"+c.prefix+"'";}).join(',');
        // edits 已经基于原 src 偏移；把这两条注入也加进去
        var allEdits=edits.concat([
          {start:lastVar.range[1], end:lastVar.range[1], name:injectNames},
          {start:stmtEnd, end:stmtEnd, name:injectVals}
        ]);
        candidate=applyEdits(src, allEdits);
        dropDelta=0;     // 没新增 local 语句，dropLeading 不增
      }else{
        // 退路：独立 local（正确格式 local a,b='prefix1','prefix2'）
        var newBody = applyEdits(src, edits);
        var declNames = chosen.map(function(c){return c.alias;}).join(',');
        var declVals  = chosen.map(function(c){return "'"+c.prefix+"'";}).join(',');
        candidate = 'local '+declNames+'='+declVals+' '+newBody;
        dropDelta=1;
      }

      if(candidate.length >= src.length){
        if(rec) rec('字段前缀折叠(放弃: 不缩短)', src.length, src.length, '候选 '+candidate.length+' ≥ 当前 '+src.length);
        return null;
      }

      assertParses(candidate, '阶段1.7/语法', steps);
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
      assertEquivalentAlias(originalCode, candidate, newAlias, '阶段1.4/等价', steps);
      if(rec) rec('字段前缀折叠(提交)', src.length, candidate.length,
                  '提取 '+chosen.map(function(c){return c.alias+"='"+c.prefix+"'×"+c.totalSites+'处';}).join('；'));
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

      var lit2sites=Object.create(null);  // content -> [{start, end}]
      // 收集到一组"被排除"的 StringLiteral 节点（语法糖位置：require'X' / f{...}）。
      // 这些位置上字符串字面量与"无括号调用"是绑定的：require'X' 的 'X' 是 StringCallExpression 的
      // argument，去掉引号换成 identifier 会产生 requireu 这种合并 token——可能 parse 通过但语义不等。
      // 同理 TableCallExpression（f{...}）也不能改写。
      var excluded=new Set();
      (function markExcluded(n){
        if(!n||typeof n!=='object') return;
        if(Array.isArray(n)){ n.forEach(markExcluded); return; }
        if(n.type==='StringCallExpression' && n.argument && n.argument.type==='StringLiteral'){
          excluded.add(n.argument);
        }
        // TableCallExpression 的 arguments 是 TableConstructorExpression，不会是 StringLiteral，无须处理
        for(var k in n){ if(k!=='range'&&k!=='loc'&&Object.prototype.hasOwnProperty.call(n,k)) markExcluded(n[k]); }
      })(ast.body);

      (function walk(n, parent, parentKey){
        if(!n||typeof n!=='object') return;
        if(Array.isArray(n)){ for(var i=0;i<n.length;i++) walk(n[i], n, i); return; }
        if(n.type==='StringLiteral' && !inHeader(n) && !excluded.has(n)){
          var raw=n.raw;
          if(typeof raw==='string' && raw.length>=4 && (raw[0]==="'"||raw[0]==='"')){
            var content=raw.slice(1,-1);
            if(content.length>=3 && /^[A-Za-z_][A-Za-z0-9_]*$/.test(content)){
              (lit2sites[content]=lit2sites[content]||[]).push({start:n.range[0], end:n.range[1]});
            }
          }
        }
        for(var k in n){ if(k!=='range'&&k!=='loc'&&Object.prototype.hasOwnProperty.call(n,k)) walk(n[k], n, k); }
      })(ast.body, null, null);

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
        var perSite = cand.content.length + 2 - alias.length;        // 'X' → u 每处省
        var declCost = alias.length + cand.content.length + declOverhead;
        var realGain = perSite*cand.sites.length - declCost;
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
          var spacer = (s.end < src.length && isNamePart(src[s.end])) ? ' ' : '';
          edits.push({start:s.start, end:s.end, name:c.alias + spacer});
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

      assertParses(candidate, '阶段1.7/语法', steps);
      var newAlias = {
        byName: (priorAlias&&priorAlias.byName)||{},
        memberByLocal: (priorAlias&&priorAlias.memberByLocal)||{},
        factorLocals: (priorAlias&&priorAlias.factorLocals)||[],
        prefixFoldByLocal: Object.assign({}, (priorAlias&&priorAlias.prefixFoldByLocal)||{}),
        stringAliasByLocal: Object.assign({}, (priorAlias&&priorAlias.stringAliasByLocal)||{}, newStringMap),
        dropLeading: ((priorAlias&&priorAlias.dropLeading)||0) + dropDelta
      };
      assertEquivalentAlias(originalCode, candidate, newAlias, '阶段1.4/等价', steps);
      if(rec) rec('字面量内联(提交)', src.length, candidate.length,
                  '提取 '+chosen.map(function(c){return c.alias+"='"+c.content+"'×"+c.sites.length;}).join('；'));
      return {code:candidate, aliasMap:newAlias};
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
      assertParses(candidate, '阶段1.7/语法', steps);

      // 用编码层模拟一遍：只有"编码后真的更短"才提交（结构层加空格后通常打平）
      var bodyCur = applyEncoding(src);
      var bodyCand = applyEncoding(candidate);
      if(bodyCand.length >= bodyCur.length){
        if(rec) rec('多赋值拆分(放弃: 不缩短)', src.length, src.length,
                    '编码后 '+bodyCand.length+' ≥ '+bodyCur.length);
        return null;
      }

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
    function foldLocals(src, priorAlias, steps, rec, originalCode){
      var ast; try{ ast=parse(src); }catch(e){ return null; }
      // 保护：开头由别名/因子注入的 dropLeading 条 local 不参与合并（否则 dropLeading 计数失效）
      var protectN = (priorAlias && priorAlias.dropLeading) || 0;

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
      function tailMultiRet(st){
        var ex=st.init||[]; if(!ex.length) return false;
        var last=ex[ex.length-1];
        return last.type==='CallExpression'||last.type==='StringCallExpression'||last.type==='TableCallExpression'||last.type==='VarargLiteral';
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
            if((prev.init||[]).length!==prev.variables.length || tailMultiRet(prev)) unsafe=true;
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
      var protectEnd=(protectN>0 && ast.body[protectN-1])?ast.body[protectN-1].range[1]:0;

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
          if(d<protectEnd || inLoop(d)){ return; }
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

    // 删除重复的局部声明
    function removeDuplicateLocalDecls(code){
      // 匹配local声明：支持成员访问(X.Y)、索引(X[Y])、字符串('...')
      var localPattern=/local\s+[A-Za-z_,]+=(?:[A-Za-z_]+(?:\.[A-Za-z_]+|\[[^\]]+\])?|'[^']*')(?:,(?:[A-Za-z_]+(?:\.[A-Za-z_]+|\[[^\]]+\])?|'[^']*'))* (?=[A-Z])/g;
      var matches=[];
      var match;
      while((match=localPattern.exec(code))!==null){
        matches.push({text:match[0], start:match.index, end:match.index+match[0].length});
      }

      // 识别重复的声明
      var seen=new Set();
      var toRemove=[];
      matches.forEach(function(m){
        if(seen.has(m.text)){
          toRemove.push(m);
        }else{
          seen.add(m.text);
        }
      });

      // 删除重复的声明（从后往前删除，避免索引变化）
      toRemove.reverse().forEach(function(m){
        code=code.slice(0,m.start)+code.slice(m.end);
      });

      return code;
    }

    // ---------- if-not 二择（去 not + 对调分支体） ----------
    // `if not C then A else B end` → `if C then B else A end`，省一个 `not`（约 4 字含空格）。
    // 仅处理恰好两分支（if + else、无 elseif）、且 if 条件顶层是一元 `not` 的语句。
    // C 只求值一次、对调分支不改变语义；canonical 的 if-not 归一可严格验证。
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
          var arg=c0.condition.argument;
          if(arg && arg.range){
            var condText=src.slice(arg.range[0], arg.range[1]);   // 去掉 not 后的条件
            var aBody=c0.body||[], bBody=c1.body||[];
            var aText = aBody.length ? src.slice(aBody[0].range[0], aBody[aBody.length-1].range[1]) : '';
            var bText = bBody.length ? src.slice(bBody[0].range[0], bBody[bBody.length-1].range[1]) : '';
            // 重建：if <cond> then <B> else <A> end（分支体对调）。空体则该段留空。
            var rebuilt = 'if '+condText+' then '+bText+' else '+aText+' end';
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
      assertParses(candidate, '阶段1.7c/语法', steps);
      assertEquivalentAlias(originalCode, candidate, priorAlias, '阶段1.7c/等价', steps);
      if(rec) rec('if-not二择(提交)', src.length, candidate.length, '去 not 并对调分支体 '+edits.length+' 处');
      return {code:candidate, aliasMap:priorAlias};
    }

    C.preprocess=preprocess; C.foldMethods=foldMethods; C.foldFieldPrefix=foldFieldPrefix; C.foldStringLiterals=foldStringLiterals; C.splitMultiAssign=splitMultiAssign; C.isSplitSafe=isSplitSafe; C.foldLocals=foldLocals; C.foldReuse=foldReuse; C.foldDeclHoist=foldDeclHoist; C.removeDuplicateLocalDecls=removeDuplicateLocalDecls; C.foldIfNot=foldIfNot;
  }});
})(typeof window !== 'undefined' ? window : globalThis);
