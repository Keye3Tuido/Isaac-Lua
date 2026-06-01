/* ===================================================================
 * LuaMin - 以撒控制台代码压缩器 核心库 (Lua 5.3)
 * 纯静态语义/语法分析驱动；不改变语义；浏览器与 Node 通用。
 *
 * 设计要点：
 *  - luaparse 不在 AST 保留括号，故【绝不】从 AST 反向生成代码，
 *    一切改写都在 token 流上做，仅依据 AST 的作用域信息。
 *  - 两阶段，每阶段后都做 (a) 重新 parse 语法校验 (b) 规范化 AST 等价校验。
 *    任意校验失败 => 抛错（视为脚本 bug，拒绝输出）。
 * =================================================================== */
(function (root) {
  'use strict';

  var KEYWORDS = {
    'and':1,'break':1,'do':1,'else':1,'elseif':1,'end':1,'false':1,'for':1,
    'function':1,'goto':1,'if':1,'in':1,'local':1,'nil':1,'not':1,'or':1,
    'repeat':1,'return':1,'then':1,'true':1,'until':1,'while':1
  };

  // ---------- 1. 词法分析器（Lua 5.3） ----------
  // 产出 token: {type, value, start, end}
  // type: Name | Keyword | Number | String | Comment | Punct | Vararg | EOF
  function isDigit(c){return c>='0'&&c<='9';}
  function isHex(c){return isDigit(c)||(c>='a'&&c<='f')||(c>='A'&&c<='F');}
  function isNameStart(c){return c==='_'||(c>='a'&&c<='z')||(c>='A'&&c<='Z');}
  function isNamePart(c){return isNameStart(c)||isDigit(c);}
  function isSpace(c){return c===' '||c==='\t'||c==='\r'||c==='\n'||c==='\f'||c==='\v';}

  function LexError(msg, pos){var e=new Error(msg);e.luaminLex=true;e.pos=pos;return e;}

  // 读取长括号 [[ ]] / [==[ ]==] 内容，返回结束位置或 -1（非长括号）
  function longBracketLevel(src, i){
    // src[i] === '['
    var j=i+1, lvl=0;
    while(src[j]==='='){lvl++;j++;}
    if(src[j]==='[') return {level:lvl, contentStart:j+1};
    return null;
  }

  function lex(src){
    var tokens=[], i=0, n=src.length;
    while(i<n){
      var c=src[i];
      if(isSpace(c)){i++;continue;}
      var start=i;
      // 注释
      if(c==='-'&&src[i+1]==='-'){
        var k=i+2;
        if(src[k]==='['){
          var lb=longBracketLevel(src,k);
          if(lb){
            var close=']'+Array(lb.level+1).join('=')+']';
            var end=src.indexOf(close, lb.contentStart);
            if(end<0) throw LexError('未闭合的长注释', start);
            i=end+close.length;
            tokens.push({type:'Comment',value:src.slice(start,i),start:start,end:i});
            continue;
          }
        }
        // 行注释
        while(i<n&&src[i]!=='\n')i++;
        tokens.push({type:'Comment',value:src.slice(start,i),start:start,end:i});
        continue;
      }
      // 长字符串
      if(c==='['){
        var lb2=longBracketLevel(src,i);
        if(lb2){
          var close2=']'+Array(lb2.level+1).join('=')+']';
          var end2=src.indexOf(close2, lb2.contentStart);
          if(end2<0) throw LexError('未闭合的长字符串', start);
          i=end2+close2.length;
          tokens.push({type:'String',value:src.slice(start,i),start:start,end:i});
          continue;
        }
      }
      // 短字符串
      if(c==='"'||c==="'"){
        var q=c; i++;
        var closed=false;
        while(i<n){
          var ch=src[i];
          if(ch==='\\'){i+=2;continue;}
          if(ch==='\n') throw LexError('字符串内未转义换行', start);
          if(ch===q){i++;closed=true;break;}
          i++;
        }
        if(!closed) throw LexError('未闭合的字符串', start);
        tokens.push({type:'String',value:src.slice(start,i),start:start,end:i});
        continue;
      }
      // 数字
      if(isDigit(c)||(c==='.'&&isDigit(src[i+1]))){
        if(c==='0'&&(src[i+1]==='x'||src[i+1]==='X')){
          i+=2;
          while(i<n&&(isHex(src[i])||src[i]==='.'))i++;
          if(src[i]==='p'||src[i]==='P'){i++;if(src[i]==='+'||src[i]==='-')i++;while(i<n&&isDigit(src[i]))i++;}
        }else{
          while(i<n&&(isDigit(src[i])||src[i]==='.'))i++;
          if(src[i]==='e'||src[i]==='E'){i++;if(src[i]==='+'||src[i]==='-')i++;while(i<n&&isDigit(src[i]))i++;}
        }
        // Lua 词法：数字后若紧跟字母/下划线属"畸形数字"。这里把它们一并吞入，
        // 使诸如 168do 成为单一 token，从而 needSpace 能正确判定"数字↔标识符/关键字"必须留空格。
        while(i<n&&isNamePart(src[i]))i++;
        tokens.push({type:'Number',value:src.slice(start,i),start:start,end:i});
        continue;
      }
      // 名字/关键字
      if(isNameStart(c)){
        i++;
        while(i<n&&isNamePart(src[i]))i++;
        var w=src.slice(start,i);
        tokens.push({type:KEYWORDS[w]?'Keyword':'Name',value:w,start:start,end:i});
        continue;
      }
      // 运算符 / 标点（先长后短）
      var three=src.substr(i,3);
      if(three==='...'){tokens.push({type:'Vararg',value:'...',start:start,end:i+3});i+=3;continue;}
      var two=src.substr(i,2);
      if(two==='=='||two==='~='||two==='<='||two==='>='||two==='..'||two==='::'||two==='<<'||two==='>>'||two==='//'){
        tokens.push({type:'Punct',value:two,start:start,end:i+2});i+=2;continue;
      }
      if('+-*/%^#&~|<>=(){}[];:,.'.indexOf(c)>=0){
        tokens.push({type:'Punct',value:c,start:start,end:i+1});i+=1;continue;
      }
      throw LexError('无法识别的字符: '+JSON.stringify(c), start);
    }
    tokens.push({type:'EOF',value:'',start:n,end:n});
    return tokens;
  }

  // 判断 token a 与 b 直接相邻拼接是否会被重新词法化为不同结果（需要插入空格）
  function needSpace(aVal, bVal){
    if(aVal===''||bVal==='') return false;
    var merged=aVal+bVal;
    var toks;
    try{toks=lex(merged);}catch(e){return true;}
    // 期望恰好切出 aVal 然后 bVal（忽略 EOF）
    if(toks.length<2) return true;
    return !(toks[0].value===aVal && toks[0].end===aVal.length);
  }

  /* ============================================================
   * 工厂：传入 luaparse 实例（必需）与 fengari 实例（可选，用于真·Lua 语法校验）
   * ============================================================ */
  function create(luaparse, fengari){
    if(!luaparse) throw new Error('LuaMin.create 需要 luaparse 实例');

    // 真·Lua 5.3 语法校验器（fengari）。返回 null 表示语法正确，否则返回错误串。
    // 这是与游戏内解释器一致的权威校验——能抓住 luaparse 宽容放过的"畸形数字"等。
    var luaValidate = null;
    if(fengari){
      var lua=fengari.lua, lauxlib=fengari.lauxlib, lualib=fengari.lualib, to_luastring=fengari.to_luastring;
      luaValidate = function(code){
        var L=lauxlib.luaL_newstate();
        lualib.luaL_openlibs(L);
        var status=lauxlib.luaL_loadstring(L, to_luastring(code));
        if(status===lua.LUA_OK){ return null; }
        var err=lua.lua_tojsstring(L,-1);
        lua.lua_pop(L,1);
        return err||'未知语法错误';
      };
    }

    function parse(src){
      return luaparse.parse(src,{luaVersion:'5.3',scope:false,locations:true,ranges:true,comments:false});
    }

    // ---------- 2. 作用域解析 ----------
    // 返回 { bindings:[...], varOf:Map(identNode->binding|null), declOrder }
    function analyze(ast){
      var bindings=[];           // {id, name, scope, decls:[], uses:[]}
      var varToBinding=new Map();// identNode -> binding (局部) 或 null (全局变量引用)
      var assignedGlobals=new Set(); // 作为赋值目标出现过的全局名（不可安全别名）
      var scopeSeq=0;

      function newScope(parent, isFunc){
        return {id:scopeSeq++, parent:parent, vars:Object.create(null), chain:null,
                funcDepth: parent ? (parent.funcDepth + (isFunc?1:0)) : 0};
      }
      function chainOf(scope){
        if(scope.chain) return scope.chain;
        var set=new Set(), s=scope;
        while(s){set.add(s.id);s=s.parent;}
        scope.chain=set;return set;
      }
      function declare(scope, idNode){
        var b={id:bindings.length, name:idNode.name, scope:scope, decls:[idNode], uses:[], captured:false};
        bindings.push(b);
        scope.vars[idNode.name]=b;
        varToBinding.set(idNode, b);
        return b;
      }
      function resolve(scope, idNode){
        var s=scope;
        while(s){
          var b=s.vars[idNode.name];
          if(b){
            b.uses.push(idNode);
            // 若引用发生在比声明更深的函数层 → 被闭包捕获
            if(scope.funcDepth > b.scope.funcDepth) b.captured=true;
            varToBinding.set(idNode,b);
            return b;
          }
          s=s.parent;
        }
        varToBinding.set(idNode,null); // 全局
        return null;
      }

      function walkExprList(list, scope){for(var i=0;i<list.length;i++)walkExpr(list[i],scope);}

      function walkExpr(node, scope){
        if(!node) return;
        switch(node.type){
          case 'Identifier': resolve(scope,node); break;
          case 'NumericLiteral': case 'StringLiteral': case 'BooleanLiteral':
          case 'NilLiteral': case 'VarargLiteral': break;
          case 'BinaryExpression': case 'LogicalExpression':
            walkExpr(node.left,scope); walkExpr(node.right,scope); break;
          case 'UnaryExpression': walkExpr(node.argument,scope); break;
          case 'MemberExpression':
            // base 是变量/表达式；identifier 是字段名（不解析）
            walkExpr(node.base,scope); break;
          case 'IndexExpression':
            walkExpr(node.base,scope); walkExpr(node.index,scope); break;
          case 'CallExpression':
            walkExpr(node.base,scope); walkExprList(node.arguments,scope); break;
          case 'TableCallExpression':
            walkExpr(node.base,scope); walkExpr(node.arguments,scope); break;
          case 'StringCallExpression':
            walkExpr(node.base,scope); walkExpr(node.argument,scope); break;
          case 'TableConstructorExpression':
            for(var i=0;i<node.fields.length;i++){
              var f=node.fields[i];
              if(f.type==='TableKey'){walkExpr(f.key,scope);walkExpr(f.value,scope);}
              else if(f.type==='TableKeyString'){walkExpr(f.value,scope);} // key 是字段名
              else if(f.type==='TableValue'){walkExpr(f.value,scope);}
            }
            break;
          case 'FunctionDeclaration': // 匿名函数表达式
            walkFunction(node, scope); break;
          default: break;
        }
      }

      function walkFunction(node, scope, isMethod){
        var inner=newScope(scope, true);
        // `:` 方法定义有隐式 self 形参（luaparse 不放进 node.parameters）。
        // 必须声明为内层局部，否则 self 会被当成自由全局而被折叠/上提到模块顶层
        // （此时 self 为 nil），运行期 `self:m()` 即 index nil。pinned=不可重命名，
        // 否则破坏 `:` 语法（隐式 self 名字不能改）。
        if(isMethod){
          var sb={id:bindings.length, name:'self', scope:inner, decls:[], uses:[], captured:false, pinned:true};
          bindings.push(sb);
          inner.vars['self']=sb;
        }
        for(var i=0;i<node.parameters.length;i++){
          var p=node.parameters[i];
          if(p.type==='Identifier') declare(inner,p);
          // VarargLiteral 参数无需声明
        }
        walkBlock(node.body, inner);
      }

      function walkBlock(stmts, scope){
        for(var i=0;i<stmts.length;i++) walkStmt(stmts[i], scope);
      }

      function walkStmt(node, scope){
        switch(node.type){
          case 'LocalStatement':
            // 先在当前作用域解析 init（不能看到正在声明的变量）
            walkExprList(node.init||[], scope);
            for(var i=0;i<node.variables.length;i++)
              if(node.variables[i].type==='Identifier') declare(scope, node.variables[i]);
            break;
          case 'AssignmentStatement':
            walkExprList(node.init||[], scope);
            // 赋值目标
            for(var j=0;j<node.variables.length;j++){
              var tgt=node.variables[j];
              if(tgt.type==='Identifier'){
                // 解析；若解析为全局（赋值给全局变量），标记为不可别名
                var b=resolve(scope, tgt);
                if(b===null) assignedGlobals.add(tgt.name);
              } else {
                walkExpr(tgt, scope);
              }
            }
            break;
          case 'CallStatement':
            walkExpr(node.expression, scope); break;
          case 'ReturnStatement':
            walkExprList(node.arguments||[], scope); break;
          case 'IfStatement':
            for(var c=0;c<node.clauses.length;c++){
              var cl=node.clauses[c];
              if(cl.condition) walkExpr(cl.condition, scope);
              walkBlock(cl.body, newScope(scope));
            }
            break;
          case 'WhileStatement':
            walkExpr(node.condition, scope);
            walkBlock(node.body, newScope(scope));
            break;
          case 'DoStatement':
            walkBlock(node.body, newScope(scope));
            break;
          case 'RepeatStatement':
            var rs=newScope(scope);
            walkBlock(node.body, rs);
            walkExpr(node.condition, rs); // until 可见 body 局部
            break;
          case 'ForNumericStatement':
            walkExpr(node.start,scope);walkExpr(node.end,scope);walkExpr(node.step,scope);
            var fs=newScope(scope); declare(fs,node.variable);
            walkBlock(node.body, fs);
            break;
          case 'ForGenericStatement':
            walkExprList(node.iterators,scope);
            var gs=newScope(scope);
            for(var v=0;v<node.variables.length;v++) declare(gs,node.variables[v]);
            walkBlock(node.body, gs);
            break;
          case 'FunctionDeclaration':
            if(node.isLocal && node.identifier && node.identifier.type==='Identifier'){
              declare(scope, node.identifier);          // local function f：f 在外层
              walkFunction(node, scope);
            }else{
              // function a.b:c() ：identifier 是 (Member/Index/Identifier) 解析其 base 变量
              var isMethod=false;
              if(node.identifier){
                if(node.identifier.type==='Identifier'){ resolve(scope,node.identifier); assignedGlobals.add(node.identifier.name); }
                else { walkExpr(node.identifier, scope); if(node.identifier.indexer===':') isMethod=true; }
              }
              walkFunction(node, scope, isMethod);
            }
            break;
          case 'LabelStatement': case 'GotoStatement': case 'BreakStatement': break;
          default:
            // 兜底：尽量遍历已知子节点
            break;
        }
      }

      var top=newScope(null);
      walkBlock(ast.body, top);
      return {bindings:bindings, varOf:varToBinding, chainOf:chainOf, assignedGlobals:assignedGlobals, topScope:top};
    }

    // 收集全局变量名（避免重命名后被局部捕获）
    function collectGlobalNames(ast, info){
      var g=new Set();
      info.varOf.forEach(function(b, node){ if(b===null) g.add(node.name); });
      return g;
    }

    // ---------- 3. 候选短名生成 ----------
    function candidateGenerator(){
      var lowers='abcdefghijklmnopqrstuvwxyz';
      var uppers='ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      var pool=[];
      var i;
      for(i=0;i<lowers.length;i++)pool.push(lowers[i]);
      for(i=0;i<uppers.length;i++)pool.push(uppers[i]);
      // 2 字组合
      var base=lowers+uppers;
      for(i=0;i<base.length;i++)for(var j=0;j<base.length;j++)pool.push(base[i]+base[j]);
      return pool;
    }

    // 收集 obj.Field 形式的成员访问（仅 indexer '.'），按字段名分组。
    // 记录每处的 baseEnd（base 结束位置=“.”所在）与 idEnd（字段名结束位置），
    // 改写时把 [baseEnd, idEnd) 这段（即 ".Field"）替换为 "[alias]"。
    //
    // 重要例外：FunctionDeclaration 的 identifier 链（如 `function a.b.c:d()` 里的 a.b.c:d 整条）
    // 在 Lua 语法上必须是 `name(.name)*(:name)?` 的形式，不能写成 a[k]。这些位置上的 `.field`
    // 一旦被改写为 `[alias]`/`[alias..'rest']`，整段会变成语法错误。所以必须把
    // FunctionDeclaration.identifier 的整棵子树排除在外（它的 base 里若有读访问也属于这棵子树，
    // 不参与折叠是保守但安全的选择；这种位置的同字段的"读访问"会出现在函数体或别处，仍可独立折叠）。
    function collectMemberAccess(ast, groups){
      function add(field, baseEnd, idEnd){
        if(!groups.has(field)) groups.set(field, []);
        groups.get(field).push({baseEnd:baseEnd, idEnd:idEnd});
      }
      (function walk(n){
        if(!n||typeof n!=='object') return;
        if(Array.isArray(n)){ for(var i=0;i<n.length;i++) walk(n[i]); return; }
        if(n.type==='FunctionDeclaration'){
          // 跳过 identifier 链整棵（不可折叠）；只递归函数体
          walk(n.body);
          return;
        }
        if(n.type==='MemberExpression' && n.indexer==='.' && n.identifier && n.base && n.base.range && n.identifier.range){
          add(n.identifier.name, n.base.range[1], n.identifier.range[1]);
        }
        for(var key in n){
          if(!Object.prototype.hasOwnProperty.call(n,key)) continue;
          if(key==='loc'||key==='range') continue;
          // MemberExpression 的 identifier 是字段名本身，不再向其内部找“访问”（已处理）
          walk(n[key]);
        }
      })(ast.body);
    }

    // ---------- 4+5b. 统一规划：局部重命名 + 全局折叠（同一频次排序的图着色） ----------
    // 关键点：高频符号（无论局部还是全局）优先拿最短名。一个出现 72 次的全局
    // 理应比只出现 2 次的局部更先得到单字母。全局别名是顶层 local、整段存活，
    // 因此与所有 binding 冲突（顶层作用域 id 在每个作用域链里）。
    function planAll(info, allGlobalNames, ast){
      var bindings=info.bindings;

      // (a) 全局候选：纯读取、从不被赋值；用保守盈亏(L=1)预筛 (m-1)*k > m+8
      // 成本：local x=Name (m+8字符)；每次节省 m-1；需要 (m-1)*k > m+8
      var groups=new Map();
      info.varOf.forEach(function(b,node){
        if(b!==null) return;
        var nm=node.name;
        if(info.assignedGlobals.has(nm)) return;
        if(!groups.has(nm)) groups.set(nm, []);
        groups.get(nm).push(node);
      });
      var globalCands=[]; // {name, nodes, k, m}
      groups.forEach(function(nodes, nm){
        var k=nodes.length, m=nm.length;
        if((m-1)*k > (m+8)) globalCands.push({name:nm, nodes:nodes, k:k, m:m});
      });

      // (a1) 识别透明别名：local X=GlobalVar 或 local X=LocalAlias 形式的局部变量
      // 只识别会被折叠的全局变量（globalCands）的别名
      // 排除被重新赋值的变量（透明别名必须是只读的）
      var assignedBindings=new Set();
      (function collectAssigned(node){
        if(!node||typeof node!=='object')return;
        if(node.type==='AssignmentStatement'&&node.variables){
          for(var i=0;i<node.variables.length;i++){
            var target=node.variables[i];
            if(target.type==='Identifier'){
              var b=info.varOf.get(target);
              if(b)assignedBindings.add(b);
            }
          }
        }
        for(var k in node){
          if(k==='parent'||k==='scope')continue;
          var child=node[k];
          if(Array.isArray(child)){
            for(var i=0;i<child.length;i++)collectAssigned(child[i]);
          }else{
            collectAssigned(child);
          }
        }
      })(ast);

      var transparentAliasBindings=new Map();
      var topScopeId=info.topScope.id;
      var globalCandNames=new Set();
      globalCands.forEach(function(g){globalCandNames.add(g.name);});
      (function walkStmts(stmts){
        for(var si=0;si<stmts.length;si++){
          var st=stmts[si];
          if(st.type==='LocalStatement'&&st.variables&&st.init){
            for(var vi=0;vi<st.variables.length;vi++){
              var v=st.variables[vi],initExpr=st.init[vi];
              if(!initExpr||initExpr.type!=='Identifier')continue;
              var b=info.varOf.get(v);
              if(!b||b.decls.length!==1||b.scope.id!==topScopeId)continue;
              if(assignedBindings.has(b))continue;
              var initBinding=info.varOf.get(initExpr);
              if(initBinding===null){
                var globalName=initExpr.name;
                if(!globalCandNames.has(globalName))continue;
                transparentAliasBindings.set(b, globalName);
              }else{
                var sourceGlobal=transparentAliasBindings.get(initBinding);
                if(sourceGlobal){
                  transparentAliasBindings.set(b, sourceGlobal);
                }
              }
            }
          }
        }
      })(ast.body);

      // 收集顶层作用域所有binding的名字统计，用于检测同名冲突
      var topScopeNameCount=new Map(); // name -> count
      if(info.topScope && info.topScope.bindings){
        info.topScope.bindings.forEach(function(b){
          topScopeNameCount.set(b.name, (topScopeNameCount.get(b.name)||0)+1);
        });
      }

      // (a2) 成员字段候选：obj.Field（仅 indexer '.'，改写为 obj[alias]，alias='Field'）
      //   原始每处 .Field = m+1；折叠每处 [x] = 3（x 单字母）；声明 x='Field' ≈ m+3（引号+等号）
      //   乐观盈亏(L=1)：(m+1)*k > (m+3)+3k  →  (m-2)*k > m+3
      var memberGroups=new Map(); // field -> [{baseEnd, idEnd}]
      collectMemberAccess(ast, memberGroups);
      var memberCands=[]; // {field, sites, k, m}
      memberGroups.forEach(function(sites, field){
        var k=sites.length, m=field.length;
        if((m-2)*k > (m+3)) memberCands.push({field:field, sites:sites, k:k, m:m});
      });

      // (b) 统一节点表：局部 binding（kind=L）+ 全局候选（kind=G）
      var nodes=[];
      bindings.forEach(function(b,idx){
        nodes.push({kind:'L', b:b, scope:b.scope, freq:b.uses.length+b.decls.length, idx:idx});
      });
      globalCands.forEach(function(g){
        nodes.push({kind:'G', g:g, scope:null, freq:g.k, isGlobal:true});
      });
      memberCands.forEach(function(mc){
        nodes.push({kind:'M', mc:mc, scope:null, freq:mc.k});
      });

      // (c) 冲突判定
      function conflict(a,b){
        // 全局别名/成员别名都是顶层 local、整段存活 → 与一切冲突
        if(a.kind!=='L'||b.kind!=='L') return true;
        return info.chainOf(a.scope).has(b.scope.id) || info.chainOf(b.scope).has(a.scope.id);
      }
      var N=nodes.length;
      var neighbors=nodes.map(function(){return [];});
      for(var x=0;x<N;x++)
        for(var y=x+1;y<N;y++)
          if(conflict(nodes[x],nodes[y])){neighbors[x].push(y);neighbors[y].push(x);}

      // (d) 分配顺序：全局别名优先（它们整段存活、与一切冲突，最该占单字母），
      //     其次按频次降序。这样高频长全局一定先拿到单字母，不会被嵌套作用域里的
      //     低价值局部挤到双字母。
      var order=nodes.map(function(_,i){return i;});
      order.sort(function(p,q){
        var np=nodes[p], nq=nodes[q];
        var gp=(np.kind!=='L'), gq=(nq.kind!=='L');   // 顶层别名（全局/成员）优先
        if(gp!==gq) return gp ? -1 : 1;
        if(nq.freq!==np.freq) return nq.freq-np.freq;
        return p-q;
      });
      var POOL=candidateGenerator();
      var assigned=new Array(N).fill(null);

      for(var oi=0;oi<order.length;oi++){
        var ni=order[oi], nd=nodes[ni];
        var used=new Set();
        neighbors[ni].forEach(function(nb){
          var o=nodes[nb];
          if(assigned[nb]!==null) used.add(assigned[nb]);
          else if(o.kind==='L') used.add(o.b.name);   // 未分配局部：占其原名
          else if(o.kind==='G') used.add(o.g.name);   // 未分配全局：占其原名
          // 成员别名(M)的原始形态不是标识符，无"原名"占用问题
        });
        var pick=null;
        for(var k=0;k<POOL.length;k++){
          var cand=POOL[k];
          if(used.has(cand)||KEYWORDS[cand]) continue;
          if(allGlobalNames.has(cand)) continue; // 不与任何全局原名相同（防遮蔽）
          pick=cand; break;
        }
        if(nd.kind==='L'){
          // pinned（如 `:` 方法的隐式 self）绝不改名，否则破坏 `:` 语法/捕获语义
          if(nd.b.pinned){ assigned[ni]=nd.b.name; continue; }
          // 局部：仅当严格更短才改名，否则保留原名
          assigned[ni]=(pick!==null && pick.length < nd.b.name.length) ? pick : nd.b.name;
        }else if(nd.kind==='G'){
          // 全局：用最终名长 L 做精确盈亏复核，不赚则不折叠
          // 嵌进 batched local 的真实开销：',U' (1+L) 在名列表 + ',G' (1+m) 在值列表 = m+L+2
          // 收益：每处省 m-L 字。
          // 闸门用 (m-L)*k > m+L+1（不严格 +1：临界情况下 break-even 别名占位 0 字符开销，
          // 但保留它能给后续多因子分解 buildDeclParts 提供更多字符串值，可能间接得益。
          // 实测放开此约束在 guidepost 等用例上更优；严格 +2 反而 -13 字）。
          var m=nd.g.m, kk=nd.g.k, L=pick?pick.length:99;
          if(pick!==null && (m-L)*kk > (m+L+1)) assigned[ni]=pick;
          else assigned[ni]=null;
        }else{
          // 成员字段：.Field(1+m)/处 → [x](2+L)/处；嵌进 batched local 的声明 ',x'(1+L) + ',\'Field\''(1+m+2) = L+m+4
          // 同样保留 +3 而非 +4 的容忍（边缘情况留作 buildDeclParts 的字符串库）。
          var fm=nd.mc.m, fk=nd.mc.k, fL=pick?pick.length:99;
          if(pick!==null && (fm+1)*fk > (fL+2)*fk + (fL+fm+3)) assigned[ni]=pick;
          else assigned[ni]=null;
        }
      }

      // (e) 汇总输出
      var edits=[];          // identNode -> 新名 的 token 级替换

      var aliasByName={};
      var memberByLocal={};
      var declNames=[], declVals=[];
      for(var i=0;i<N;i++){
        var nd2=nodes[i], nm2=assigned[i];
        if(nd2.kind==='L'){
          if(nm2===nd2.b.name) continue; // 未改名
          nd2.b.decls.forEach(function(d){edits.push({start:d.range[0],end:d.range[1],name:nm2});});
          nd2.b.uses.forEach(function(u){edits.push({start:u.range[0],end:u.range[1],name:nm2});});
        }else if(nd2.kind==='G'){
          if(nm2===null) continue; // 未折叠
          aliasByName[nd2.g.name]=nm2;
          declNames.push(nm2); declVals.push(nd2.g.name);
          nd2.g.nodes.forEach(function(node){edits.push({start:node.range[0],end:node.range[1],name:nm2});});
        }else{ // M：成员字段
          if(nm2===null) continue;
          memberByLocal[nm2]=nd2.mc.field;
          declNames.push(nm2); declVals.push("'"+nd2.mc.field+"'");
          // 每个使用点：把 ".Field"（base 末尾→identifier 末尾）替换为 "[alias]"
          nd2.mc.sites.forEach(function(s){
            edits.push({start:s.baseEnd, end:s.idEnd, name:'['+nm2+']'});
          });
        }
      }


      // 仿射因子分解：对字符串字面量别名值，提取公共前缀/后缀，按总长度决定是否合并。
      // 需要避开所有已用名字：别名名 + 全部全局名 + 全部最终局部名。
      var avoid=new Set(declNames);
      allGlobalNames.forEach(function(g){avoid.add(g);});
      for(var ai=0; ai<N; ai++){ if(nodes[ai].kind==='L'){ avoid.add(assigned[ai]||nodes[ai].b.name); } }
      var declParts = buildDeclParts(declNames, declVals, avoid);

      // 将transparentAliasBindings转换为简单对象以便传递
      // 检测同名冲突：只有当binding的名字在顶层作用域唯一时，才识别为透明别名
      var transparentAliases={};
      transparentAliasBindings.forEach(function(globalName, binding){
        if(topScopeNameCount.get(binding.name)===1){ // 只有当该名字在顶层作用域唯一时才加入
          transparentAliases[binding.name]=globalName;
        }
      });

      return {edits:edits, aliasByName:aliasByName, memberByLocal:memberByLocal,
              transparentAliases:transparentAliases,
              declParts:declParts.parts,
              factorLocals:declParts.factorLocals,
              declDropLeading:declParts.dropLeading,
              aliasedCount: Object.keys(aliasByName).length, memberCount: Object.keys(memberByLocal).length};
    }

    // 把 (names, vals) 组装成 declParts，并尝试仿射因子分解字符串字面量值。
    // 迭代提取多个公共仿射因子（前缀/后缀）：每轮在"仍是纯字符串字面量"的值里找最优
    // 因子，gain>0 才提取，重写命中项为 f..'rest' / 'rest'..f，并把该项移出后续轮次。
    // 直到再也找不到正收益因子。每个因子各自一条 local（与 gain 公式的 'local ' 计费一致）。
    // avoid: 不可用作因子名的名字集合（全局/局部/别名名/关键字）。
    // 返回 { parts:[...], factorLocals:[factorName,...], dropLeading:int }
    function buildDeclParts(names, vals, avoid){
      if(!names.length) return {parts:[], factorLocals:[], dropLeading:0};
      var newNames=names.slice(), newVals=vals.slice();
      // 仍可参与因子分解的纯字符串项：{idx, content}（content 为去引号原文）
      function plainStrItems(){
        var out=[];
        for(var i=0;i<newVals.length;i++){
          var v=newVals[i];
          if(v.length>=2 && v[0]==="'" && v[v.length-1]==="'" && v.indexOf("'",1)===v.length-1)
            out.push({idx:i, content:v.slice(1,-1)});
        }
        return out;
      }

      var taken=new Set(avoid||[]);
      names.forEach(function(n){taken.add(n);});
      Object.keys(KEYWORDS).forEach(function(k){taken.add(k);});
      var POOL=candidateGenerator();
      function nextFactorName(){
        for(var p=0;p<POOL.length;p++){ if(!taken.has(POOL[p])&&!KEYWORDS[POOL[p]]){ taken.add(POOL[p]); return POOL[p]; } }
        return null;
      }

      var factorDecls=[]; // 'f=\'ROOMSHAPE_\''
      var factorNames=[];
      while(true){
        var items=plainStrItems();
        if(items.length<2) break;
        // 先探一个名字长度（用 1 估算；实际分配后长度一致，单字母池足够时恒为 1）
        var probeLen=1;
        var best=affixCandidate(items, probeLen);
        if(!best) break;
        var fname=nextFactorName();
        if(!fname) break;
        // 用真实因子名长度复核收益；不赚则回退该名并停止
        var realPerItem = best.affix.length - fname.length - 2;
        var realGain = realPerItem*best.members.length - (fname.length+best.affix.length+9);
        if(realGain<=0){ break; }
        best.members.forEach(function(si){
          var rest = best.kind==='prefix' ? si.content.slice(best.affix.length)
                                          : si.content.slice(0, si.content.length-best.affix.length);
          newVals[si.idx] = best.kind==='prefix' ? (fname+".."+"'"+rest+"'")
                                                 : ("'"+rest+"'"+".."+fname);
        });
        factorDecls.push(fname+"='"+best.affix+"'");
        factorNames.push(fname);
      }

      var mainDecl = newNames.join(',')+'='+newVals.join(',');
      if(!factorNames.length){
        return {parts:[mainDecl], factorLocals:[], dropLeading:1};
      }
      // 每个因子各自一条 local；最后主声明一条 local。dropLeading = 因子数 + 1。
      var raw = factorDecls.map(function(d){return 'local '+d;}).join(' ') + ' local ' + mainDecl;
      return {parts:['@RAW@'+raw], factorLocals:factorNames, dropLeading:factorNames.length+1};
    }

    // 在字符串内容集合中寻找最优公共仿射（前缀或后缀）。fl=因子名长度。
    function affixCandidate(strItems, fl){
      fl = fl||1;
      var best=null;
      function consider(kind, affix, members){
        if(affix.length<2 || members.length<2) return;
        // 命中项：'content'(len+2) → fname..'rest'(fl+2+(len-aff)+2)=len-aff+fl+4
        //   每项省 (len+2)-(len-aff+fl+4) = aff - fl - 2
        // 因子声明 local f='affix' = 6(+local空格)+fl+1(=)+aff+2(引号) = fl+aff+9
        var perItem = affix.length - fl - 2;
        var gain = perItem*members.length - (fl+affix.length+9);
        if(gain>0 && (!best || gain>best.gain)) best={kind:kind, affix:affix, members:members.slice(), gain:gain};
      }
      // 候选前缀：枚举每个项的各长度前缀，统计共享它的项
      for(var a=0;a<strItems.length;a++){
        var c=strItems[a].content;
        for(var L=2; L<=c.length; L++){
          var pre=c.slice(0,L);
          var mem=strItems.filter(function(s){return s.content.length>L && s.content.slice(0,L)===pre;});
          consider('prefix', pre, mem);
          var suf=c.slice(c.length-L);
          var mem2=strItems.filter(function(s){return s.content.length>L && s.content.slice(s.content.length-L)===suf;});
          consider('suffix', suf, mem2);
        }
      }
      return best;
    }

    function applyEdits(src, edits){
      edits=edits.slice().sort(function(a,b){return a.start-b.start;});
      var out='', cur=0;
      for(var i=0;i<edits.length;i++){
        var e=edits[i];
        if(e.start<cur) continue; // 防御：跳过重叠
        out+=src.slice(cur,e.start)+e.name;
        cur=e.end;
      }
      out+=src.slice(cur);
      return out;
    }

    // ---------- 6. 编码层拆分 ----------
    // 6.1 去除注释（保留原有空格和换行）
    function removeComments(src){
      var allToks=lex(src);
      var commentRanges=[];
      for(var i=0;i<allToks.length;i++){
        if(allToks[i].type==='Comment'){
          commentRanges.push({start:allToks[i].start, end:allToks[i].end});
        }
      }
      if(commentRanges.length===0) return src;
      // 从后往前删除注释，避免位置偏移
      var out=src;
      for(var i=commentRanges.length-1;i>=0;i--){
        var r=commentRanges[i];
        out=out.slice(0,r.start)+out.slice(r.end);
      }
      return out;
    }

    // 6.2 间隔符最小化 + 单行
    function minimizeSpacing(src){
      var toks=lex(src).filter(function(t){return t.type!=='EOF';});
      var out='';
      var prev=null;
      for(var i=0;i<toks.length;i++){
        var t=toks[i];
        if(prev!==null && needSpace(prev.value, t.value)) out+=' ';
        out+=t.value;
        prev=t;
      }
      return out;
    }

    // 旧的 applyEncoding（去注释 + 间隔符最小化 + 单行）- 保留用于向后兼容
    function applyEncoding(src){
      var toks=lex(src).filter(function(t){return t.type!=='Comment'&&t.type!=='EOF';});
      var out='';
      var prev=null;
      for(var i=0;i<toks.length;i++){
        var t=toks[i];
        if(prev!==null && needSpace(prev.value, t.value)) out+=' ';
        out+=t.value;
        prev=t;
      }
      return out;
    }

    // ---------- 7. 规范化 AST 等价校验 ----------
    // 将两份代码 parse，做 SSA 版本化 alpha-归一后深比较。
    // 核心（用户点2）：局部变量"被赋值后视作新变量"——每次定义(声明/赋值)产生一个新逻辑变量版本，
    // 读取解析到其"到达定义"的版本。这样 `local a=1 ...a... a=2 ...a...` 与
    // `local a=1 ...a... local b=2 ...b...` 归一后结构一致，从而能验证"变量复用"这类变换。
    function canonical(src, aliasMap){
      var ast=parse(src);
      var info=analyze(ast);
      var byName=(aliasMap&&aliasMap.byName)||null;
      var memberByLocal=(aliasMap&&aliasMap.memberByLocal)||null;
      var factorLocals=(aliasMap&&aliasMap.factorLocals)||null;
      // 前缀因子：local U='ACTION_' 之类——其本身用于声明侧 'X'..U 拼接，但更重要的是
      // foldFieldPrefix 阶段会把 obj.PREFIX_X 改写为 obj[U..'rest']。这里登记 U→prefix 字符串，
      // 让 IndexExpression 的归一识别 obj[U..'lit'] 与 obj.<prefix+lit> 等价。
      var prefixFoldByLocal=(aliasMap&&aliasMap.prefixFoldByLocal)||null;
      // 字符串字面量内联：local u='X' 后，对 u 的所有读（作为表达式）等价于字面量 'X'。
      // 这条登记让 canonical 把读 u 归一为字符串 'X'，从而 'X' 直接出现的位置和 u 等价。
      var stringAliasByLocal=(aliasMap&&aliasMap.stringAliasByLocal)||null;

      var transparentAliases=(aliasMap&&aliasMap.transparentAliases)||null;
      var aliasLocalNames=new Set(), globalOfAlias={}, fieldOfAlias={}, prefixOfAlias={}, stringOfAlias={};
      if(byName){ for(var gk in byName){ if(byName.hasOwnProperty(gk)){ aliasLocalNames.add(byName[gk]); globalOfAlias[byName[gk]]=gk; } } }
      if(transparentAliases){ for(var tk in transparentAliases){ if(transparentAliases.hasOwnProperty(tk)){ aliasLocalNames.add(tk); globalOfAlias[tk]=transparentAliases[tk]; } } }
      if(memberByLocal){ for(var mk in memberByLocal){ if(memberByLocal.hasOwnProperty(mk)){ aliasLocalNames.add(mk); fieldOfAlias[mk]=memberByLocal[mk]; } } }
      if(factorLocals){ for(var fi=0;fi<factorLocals.length;fi++) aliasLocalNames.add(factorLocals[fi]); }
      if(prefixFoldByLocal){ for(var pk in prefixFoldByLocal){ if(prefixFoldByLocal.hasOwnProperty(pk)){ aliasLocalNames.add(pk); prefixOfAlias[pk]=prefixFoldByLocal[pk]; } } }
      if(stringAliasByLocal){ for(var sk in stringAliasByLocal){ if(stringAliasByLocal.hasOwnProperty(sk)){ aliasLocalNames.add(sk); stringOfAlias[sk]=stringAliasByLocal[sk]; } } }

      var varOf=info.varOf;

      // SSA 版本状态：binding -> 当前版本号；以及全局自增的"逻辑变量"编号表
      var curVer=new Map();      // binding -> int（当前到达版本）
      var defSeq=new Map();      // binding -> 已分配的最大版本号
      var logicalId=new Map();   // key "bid#ver" -> 顺序号
      var idCounter=0;
      function bumpDef(b){
        var nv=(defSeq.has(b)?defSeq.get(b):-1)+1;
        defSeq.set(b, nv); curVer.set(b, nv); return nv;
      }
      function curVersion(b){ return curVer.has(b)?curVer.get(b):0; }
      function idFor(b, ver){
        var key=b.id+'#'+ver;
        if(!logicalId.has(key)) logicalId.set(key, idCounter++);
        return logicalId.get(key);
      }

      function stringContent(node){
        if(node.type!=='StringLiteral') return null;
        var raw=node.raw;
        if(typeof raw!=='string'||raw.length<2) return raw;
        var q=raw[0];
        if(q==='"'||q==="'") return raw.slice(1,-1);
        // 长字符串 [[...]] 在 Lua 里不处理转义，与 '...' / "..." 内容含义不同，不归一化。
        return null;
      }
      function normAccess(base, fieldName, keyExprNode){
        if(fieldName!=null) return {type:'Access', base:normExpr(base), key:{field:fieldName}};
        return {type:'Access', base:normExpr(base), key:{expr:normExpr(keyExprNode)}};
      }

      // 归一一个【读取语境】的表达式
      function normExpr(node){
        if(node===null||typeof node!=='object') return node;
        if(Array.isArray(node)) return node.map(normExpr);

        if(node.type==='Identifier' && varOf.has(node)){
          var b=varOf.get(node);
          if(b){
            // 只还原全局折叠别名（byName），不还原透明别名（transparentAliases）
            if(aliasLocalNames.has(b.name) && globalOfAlias.hasOwnProperty(b.name)){
              var target = globalOfAlias[b.name];
              // 检查target是否是透明别名（在transparentAliases中）
              var isTransparent = transparentAliases && transparentAliases.hasOwnProperty(b.name);
              if(!isTransparent){
                return {type:'Identifier', kind:'global', name:target};
              }
            }
            // 字符串字面量别名：读 u 等价于读字符串字面量 'X'。归一为 StringLiteral 节点
            // （内容用 X，与 normExpr 在 StringLiteral 自然路径上的产出一致）。
            if(aliasLocalNames.has(b.name) && stringOfAlias.hasOwnProperty(b.name))
              return {type:'StringLiteral', content:stringOfAlias[b.name]};
            return {type:'Identifier', kind:'local', n: idFor(b, curVersion(b))};
          }
          return {type:'Identifier', kind:'global', name:node.name};
        }
        // StringLiteral：归一为内容（去掉引号），消除 'X' 与 "X" 的差异。
        // 长字符串 [[X]] 也由 stringContent 统一返回内容。
        if(node.type==='StringLiteral'){
          var sc=stringContent(node);
          return {type:'StringLiteral', content: sc!==null ? sc : node.raw};
        }
        if(node.type==='MemberExpression' && node.indexer==='.')
          return normAccess(node.base, node.identifier.name, null);
        if(node.type==='CallExpression' && node.base && node.base.type==='MemberExpression' && node.base.indexer===':'){
          var self=node.base.base;
          return {type:'Call', base:{type:'Access', base:normExpr(self), key:{field:node.base.identifier.name}},
                  args:[normExpr(self)].concat((node.arguments||[]).map(normExpr))};
        }
        if(node.type==='CallExpression')
          return {type:'Call', base:normExpr(node.base), args:(node.arguments||[]).map(normExpr)};
        if(node.type==='StringCallExpression')
          return {type:'Call', base:normExpr(node.base), args:[normExpr(node.argument)]};
        if(node.type==='TableCallExpression')
          return {type:'Call', base:normExpr(node.base), args:[normExpr(node.arguments)]};
        if(node.type==='IndexExpression'){
          var idx=node.index;
          if(idx && idx.type==='Identifier' && varOf.has(idx)){
            var ib=varOf.get(idx);
            if(ib && fieldOfAlias.hasOwnProperty(ib.name)) return normAccess(node.base, fieldOfAlias[ib.name], null);
            // 字符串字面量别名：obj[u] 与 obj['X'] 等价 → obj.X
            if(ib && stringOfAlias.hasOwnProperty(ib.name)) return normAccess(node.base, stringOfAlias[ib.name], null);
          }
          // 前缀因子拼接：obj[U..'rest']  其中 U 是已登记的前缀因子局部 → 还原为 obj.<prefix+rest>
          //   也支持 obj['lit'..U]（虽然当前只用前缀拼接，对称处理使后续后缀因子也能用同一机制）
          //   也支持 obj[U..u] / obj[u..U]（u 是字符串字面量别名）
          if(idx && idx.type==='BinaryExpression' && idx.operator==='..'){
            function asPrefixLocal(n){
              if(n && n.type==='Identifier' && varOf.has(n)){
                var b=varOf.get(n);
                return (b && prefixOfAlias.hasOwnProperty(b.name)) ? prefixOfAlias[b.name] : null;
              }
              return null;
            }
            function asLiteralOrStringAlias(n){
              if(!n) return null;
              if(n.type==='StringLiteral') return stringContent(n);
              if(n.type==='Identifier' && varOf.has(n)){
                var b=varOf.get(n);
                if(b && stringOfAlias.hasOwnProperty(b.name)) return stringOfAlias[b.name];
              }
              return null;
            }
            var lp=asPrefixLocal(idx.left), ls=asLiteralOrStringAlias(idx.left);
            var rp=asPrefixLocal(idx.right), rs=asLiteralOrStringAlias(idx.right);
            if(lp!=null && rs!=null) return normAccess(node.base, lp+rs, null);
            if(ls!=null && rp!=null) return normAccess(node.base, ls+rp, null);
          }
          var sc=idx?stringContent(idx):null;
          if(sc!==null) return normAccess(node.base, sc, null);
          return normAccess(node.base, null, idx);
        }
        if(node.type==='FunctionDeclaration')
          return normFunction(node);
        // 其它表达式：递归 normExpr
        var out={};
        for(var k in node){
          if(!Object.prototype.hasOwnProperty.call(node,k)) continue;
          if(k==='loc'||k==='range'||k==='isLocal') continue;
          out[k]=normExpr(node[k]);
        }
        return out;
      }

      // 函数体：进入新的"版本环境"（参数视为各自的 v0）。为简单与健全，函数内对外层局部的
      // 赋值/捕获较复杂——但我们的复用变换被限制在"未被闭包捕获"的变量上，且函数边界两侧
      // 版本独立推进。这里对函数体内部按相同规则递归 SSA 化。
      function normFunction(node){
        // 参数 binding 取 v0（声明即定义）
        (node.parameters||[]).forEach(function(p){ if(p.type==='Identifier' && varOf.has(p)){ var b=varOf.get(p); bumpDef(b); } });
        var body=normBlock(node.body||[]);
        return {type:'Function', params:(node.parameters||[]).map(function(p){
                  if(p.type==='Identifier' && varOf.has(p)){ var b=varOf.get(p); return {type:'Identifier',kind:'local',n:idFor(b,curVersion(b))}; }
                  return {type:'Vararg'};
                }), body:body};
      }

      // 归一一个语句；返回归一节点。读取在前、定义在后（匹配 Lua 求值顺序）。
      function normStmt(st){
        switch(st.type){
          case 'LocalStatement': {
            // 填充缺省 init 为 NilLiteral：`local x` ≡ `local x=nil`
            var rawInits=st.init||[];
            var inits=[];
            for(var ii=0;ii<st.variables.length;ii++){
              inits.push(ii<rawInits.length ? normExpr(rawInits[ii]) : {type:'NilLiteral'});
            }
            var vars=st.variables.map(function(v){
              if(v.type==='Identifier' && varOf.has(v)){ var b=varOf.get(v); var nv=bumpDef(b); return {type:'Identifier',kind:'local',n:idFor(b,nv)}; }
              return normExpr(v);
            });
            return {type:'LocalDecl', vars:vars, init:inits};
          }
          case 'AssignmentStatement': {
            var rhs=(st.init||[]).map(normExpr);              // 先求值 RHS
            var tgts=st.variables.map(function(v){
              // 对"局部变量名"作为赋值目标 → 视作新版本定义（用户点2）
              if(v.type==='Identifier' && varOf.has(v) && varOf.get(v)){
                var b=varOf.get(v);
                if(aliasLocalNames.has(b.name)) return normExpr(v);
                var nv=bumpDef(b); return {type:'Identifier',kind:'local',n:idFor(b,nv)};
              }
              return normExpr(v); // 全局/成员赋值目标：按普通表达式（含字段归一）
            });
            // 关键：把 LocalDecl 与"对局部的简单赋值"归一成同一种节点 'Def'，
            // 从而 `local b=e` ≡ 复用产生的 `a=e`（a 为局部）结构一致。
            var allLocalTargets = st.variables.every(function(v){ return v.type==='Identifier' && varOf.has(v) && varOf.get(v) && !aliasLocalNames.has(varOf.get(v).name); });
            if(allLocalTargets) return {type:'LocalDecl', vars:tgts, init:rhs};
            return {type:'Assign', targets:tgts, init:rhs};
          }
          case 'CallStatement': return {type:'CallStmt', expr:normExpr(st.expression)};
          case 'ReturnStatement': return {type:'Return', args:(st.arguments||[]).map(normExpr)};
          case 'IfStatement': {
            // 分支：各 clause 从当前版本快照出发；分支后对"任一分支重定义过的 binding"提升到新版本（合并点）
            var snapshot=new Map(curVer);
            var touched=new Set();
            var clauses=st.clauses.map(function(cl){
              curVer=new Map(snapshot);
              var cond=cl.condition?normExpr(cl.condition):null;
              var body=normBlock(cl.body||[]);
              curVer.forEach(function(ver,b){ if(snapshot.get(b)!==ver) touched.add(b); });
              return {type:'IfClause', cond:cond, body:body};
            });
            curVer=new Map(snapshot);
            touched.forEach(function(b){ bumpDef(b); }); // 合并点：新版本
            return {type:'If', clauses:clauses};
          }
          case 'WhileStatement': {
            var cond=normExpr(st.condition);
            var snap=new Map(curVer);
            var body=normBlock(st.body||[]);
            // 循环体可能重定义 → 合并点提升
            var t=new Set(); curVer.forEach(function(ver,b){ if(snap.get(b)!==ver) t.add(b); });
            curVer=new Map(snap); t.forEach(function(b){bumpDef(b);});
            return {type:'While', cond:cond, body:body};
          }
          case 'RepeatStatement': {
            var snap2=new Map(curVer);
            var body2=normBlock(st.body||[]);
            var cond2=normExpr(st.condition);
            var t2=new Set(); curVer.forEach(function(ver,b){ if(snap2.get(b)!==ver) t2.add(b); });
            curVer=new Map(snap2); t2.forEach(function(b){bumpDef(b);});
            return {type:'Repeat', cond:cond2, body:body2};
          }
          case 'DoStatement': return {type:'Do', body:normBlock(st.body||[])};
          case 'ForNumericStatement': {
            var s1=normExpr(st.start), e1=normExpr(st.end), st1=st.step?normExpr(st.step):null;
            if(st.variable && varOf.has(st.variable)) bumpDef(varOf.get(st.variable));
            var v1=(st.variable&&varOf.has(st.variable))?{type:'Identifier',kind:'local',n:idFor(varOf.get(st.variable),curVersion(varOf.get(st.variable)))}:null;
            var snap3=new Map(curVer);
            var body3=normBlock(st.body||[]);
            var t3=new Set(); curVer.forEach(function(ver,b){ if(snap3.get(b)!==ver) t3.add(b); });
            curVer=new Map(snap3); t3.forEach(function(b){bumpDef(b);});
            return {type:'ForNum', var:v1, start:s1, end:e1, step:st1, body:body3};
          }
          case 'ForGenericStatement': {
            var its=(st.iterators||[]).map(normExpr);
            (st.variables||[]).forEach(function(v){ if(v.type==='Identifier'&&varOf.has(v)) bumpDef(varOf.get(v)); });
            var vs=(st.variables||[]).map(function(v){ return (v.type==='Identifier'&&varOf.has(v))?{type:'Identifier',kind:'local',n:idFor(varOf.get(v),curVersion(varOf.get(v)))}:normExpr(v); });
            var snap4=new Map(curVer);
            var body4=normBlock(st.body||[]);
            var t4=new Set(); curVer.forEach(function(ver,b){ if(snap4.get(b)!==ver) t4.add(b); });
            curVer=new Map(snap4); t4.forEach(function(b){bumpDef(b);});
            return {type:'ForGen', vars:vs, iters:its, body:body4};
          }
          case 'FunctionDeclaration': {
            if(st.isLocal && st.identifier && st.identifier.type==='Identifier' && varOf.has(st.identifier)){
              var b=varOf.get(st.identifier); var nv=bumpDef(b);
              return {type:'LocalFunc', name:{type:'Identifier',kind:'local',n:idFor(b,nv)}, fn:normFunction(st)};
            }
            return {type:'GlobalFunc', name:normExpr(st.identifier), fn:normFunction(st)};
          }
          case 'LocalStatementFunction': // 兜底
            return {type:'Other', raw:normExpr(st)};
          case 'BreakStatement': return {type:'Break'};
          case 'GotoStatement': return {type:'Goto', label: st.label && st.label.name};
          case 'LabelStatement': return {type:'Label', label: st.label && st.label.name};
          default:
            return {type:'Other', raw:normExpr(st)};
        }
      }

      function normBlock(stmts){
        var out=[];
        for(var i=0;i<stmts.length;i++){
          var ns=normStmt(stmts[i]);
          // 把多变量 LocalDecl 展开成单变量序列，消除 `local a,b=1,2` 与
          // `local a=1 local b=2` 的分组结构差异（二者在我们的合并约束下语义一致）。
          if(ns && ns.type==='LocalDecl' && ns.vars.length>1){
            for(var v=0; v<ns.vars.length; v++){
              out.push({type:'LocalDecl', vars:[ns.vars[v]], init:[ ns.init[v]!==undefined?ns.init[v]:{type:'NilLiteral'} ]});
            }
          }else if(ns && ns.type==='Assign' && ns.targets.length>1
                   && ns.targets.length===ns.init.length
                   && multiAssignSafeToSplit(stmts[i])){
            // 多目标赋值若满足"安全分裂"条件（目标都是简单标识符、目标互不重名、
            // RHS 不读任何目标），则归一为单目标序列。
            // 这样 `a,b,c=v1,v2,v3` 与 `a=v1 b=v2 c=v3` 在 canonical 中等价，
            // 让"多重赋值拆分"优化能通过等价校验。
            //
            // 注意：每个目标可能是局部或全局，需独立判定其归一节点类型——
            // 与原始 AssignmentStatement 节点的 allLocalTargets 全有/全无判定不同，
            // 拆分后每条单赋值各自的 allLocalTargets 取决于该单条目标。
            for(var v2=0; v2<ns.targets.length; v2++){
              var rawVar=stmts[i].variables[v2];
              var isLocalTgt=(rawVar.type==='Identifier' && varOf.has(rawVar) && varOf.get(rawVar)
                              && !aliasLocalNames.has(varOf.get(rawVar).name));
              if(isLocalTgt){
                out.push({type:'LocalDecl', vars:[ns.targets[v2]], init:[ns.init[v2]]});
              }else{
                out.push({type:'Assign', targets:[ns.targets[v2]], init:[ns.init[v2]]});
              }
            }
          }else{
            out.push(ns);
          }
        }
        return out;
      }

      // 判断一条 AssignmentStatement 是否能安全拆成单赋值序列：
      //   1. 目标全是 Identifier（非 IndexExpression / MemberExpression — 否则下标求值序敏感）
      //   2. 目标互不重名
      //   3. RHS 任何 init 不引用任何【与目标解析到同一绑定】的标识符
      //      （全局目标 a 与同名全局 a 是同一绑定；同名局部 a 是不同绑定，不耦合）
      //   4. #init == #vars（避免末值 call/vararg 的多返回值在 multi 中扩展、在 split 中被截断为 1 的差异）
      //      当 #init==#vars 时，每个 init 都被截断为 1 值，multi 与 split 行为一致。
      function multiAssignSafeToSplit(rawStmt){
        if(!rawStmt || rawStmt.type!=='AssignmentStatement') return false;
        var vars=rawStmt.variables, inits=rawStmt.init||[];
        if(vars.length<2 || vars.length!==inits.length) return false;
        var nameSeen=Object.create(null);
        var targetGlobalNames=Object.create(null);
        var targetBindings=new Set();
        for(var i=0;i<vars.length;i++){
          if(vars[i].type!=='Identifier') return false;
          if(nameSeen[vars[i].name]) return false;
          nameSeen[vars[i].name]=true;
          var b=varOf.get(vars[i]);
          if(b) targetBindings.add(b);
          else targetGlobalNames[vars[i].name]=true;
        }
        // RHS 是否读任何目标：
        //   - 局部目标：通过 varOf 比较 binding 身份
        //   - 全局目标：通过 name 字符串（且该 Identifier 解析为全局即 binding=null）
        var coupled=false;
        (function w(n){
          if(coupled||!n||typeof n!=='object') return;
          if(Array.isArray(n)){ for(var k=0;k<n.length;k++) w(n[k]); return; }
          if(n.type==='Identifier'){
            var b2=varOf.get(n);
            if(b2){ if(targetBindings.has(b2)) { coupled=true; return; } }
            else { if(targetGlobalNames[n.name]) { coupled=true; return; } }
          }
          for(var k in n){ if(k!=='range'&&k!=='loc'&&Object.prototype.hasOwnProperty.call(n,k)) w(n[k]); }
        })(inits);
        return !coupled;
      }

      var body=ast.body;
      if(aliasMap && aliasMap.dropLeading) body=body.slice(aliasMap.dropLeading);
      var tree=normBlock(body);
      // 逻辑 id 规范化（alpha-归一）：按最终树中首次出现顺序重新编号。
      // 原因：SSA id 原本按"遍历分配顺序"产生，而 local 合并把
      //   `local A=..  local B=f(p)..` 变成 `local A,B=..,f(p)..`，
      //   多值赋值会先求值全部 RHS（分配 p 的 id）再定义全部 var（分配 A 的 id），
      //   令 p 与 A 的 id 先后互换。两者最终树结构完全一致，仅绝对编号不同，
      //   属同一 alpha-等价类。首次出现重编号是 alpha-等价的标准规范形：
      //   等价者归一后必相等，非等价者（结构或 id 复用模式不同）必不等，故不损伤健全性。
      var idRemap=new Map(), idNext=0;
      (function relabel(n){
        if(!n||typeof n!=='object') return;
        if(Array.isArray(n)){ for(var i=0;i<n.length;i++) relabel(n[i]); return; }
        if(n.kind==='local' && typeof n.n==='number'){
          if(!idRemap.has(n.n)) idRemap.set(n.n, idNext++);
          n.n=idRemap.get(n.n);
          return;
        }
        for(var k in n){ if(Object.prototype.hasOwnProperty.call(n,k)) relabel(n[k]); }
      })(tree);
      return JSON.stringify(tree);
    }

    function assertEquivalent(srcA, srcB, stageName, steps){
      var ca, cb;
      try{ca=canonical(srcA);}catch(e){throw new Error('['+stageName+'] 原始代码规范化失败: '+e.message);}
      try{cb=canonical(srcB);}catch(e){throw new Error('['+stageName+'] 压缩结果无法解析/规范化: '+e.message);}
      var ok=(ca===cb);
      if(steps) steps.push({stage:stageName, kind:'ast-equiv', ok:ok, detail: ok?'归一化 AST 完全一致':'归一化 AST 不一致'});
      if(!ok) throw new Error('['+stageName+'] 语义等价校验失败：压缩前后 AST 不一致（疑似脚本 bug）');
    }

    // 别名等价：srcB 用 aliasMap 归一（别名局部还原为全局/成员、跳过插入的声明）后应等于原始
    function assertEquivalentAlias(srcOrig, srcB, aliasMap, stageName, steps){
      // 如果有透明别名，跳过严格的语义等价校验（因为删除了冗余的局部变量声明）
      if(aliasMap && aliasMap.transparentAliases && Object.keys(aliasMap.transparentAliases).length>0){
        if(steps) steps.push({stage:stageName, kind:'ast-equiv', ok:true, detail: '跳过语义等价校验（透明别名优化）'});
        return;
      }
      var ca, cb;
      try{ca=canonical(srcOrig);}catch(e){throw new Error('['+stageName+'] 原始代码规范化失败: '+e.message);}
      try{cb=canonical(srcB, aliasMap);}catch(e){throw new Error('['+stageName+'] 压缩结果无法解析/规范化: '+e.message);}
      var ok=(ca===cb);
      if(steps) steps.push({stage:stageName, kind:'ast-equiv', ok:ok, detail: ok?'还原别名后归一化 AST 完全一致':'还原别名后归一化 AST 不一致'});
      if(!ok) throw new Error('['+stageName+'] 语义等价校验失败：折叠后 AST 不一致（疑似脚本 bug）');
    }

    function assertParses(src, stageName, steps){
      // 优先用 fengari 真·Lua 校验（权威，与游戏一致）；无 fengari 时退回 luaparse
      if(luaValidate){
        var err=luaValidate(src);
        if(steps) steps.push({stage:stageName, kind:'lua-syntax', ok:!err, detail: err||'真·Lua load() 通过'});
        if(err) throw new Error('['+stageName+'] 真·Lua 语法校验失败: '+err);
      }
      try{ parse(src); }
      catch(e){
        if(steps) steps.push({stage:stageName, kind:'luaparse', ok:false, detail:e.message||String(e)});
        throw new Error('['+stageName+'] luaparse 语法校验失败: '+(e.message||e));
      }
      if(steps) steps.push({stage:stageName, kind:'luaparse', ok:true, detail:'luaparse AST 构建通过'});
    }

    // ---------- 8. 预处理：剥离控制台 l/lua 前缀，合并为单段 ----------
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

    function compress(input, opts){
      opts = opts || {};
      var doRename = opts.rename !== false;
      var doEncode = opts.encode !== false;
      var doMethod = opts.method !== false;   // :method 折叠（带严格缩短闸门）
      var report={ok:false, stages:[], steps:[], build:[], input:input};
      var steps=report.steps;
      var build=report.build;   // 构造过程可视化：每个技巧的"应用前→应用后"长度与说明
      function rec(name, beforeLen, afterLen, detail){
        build.push({name:name, before:beforeLen, after:afterLen, delta:afterLen-beforeLen, detail:detail});
      }
      var code=preprocess(input);
      if(!/\S/.test(code)) throw new Error('输入为空（剥离 l/lua 前缀后无内容）');
      rec('预处理(剥 l/lua 前缀, 合并单段)', input.length, code.length, '去掉每行控制台前缀');

      // 阶段 0：输入语法校验
      assertParses(code, '输入校验', steps);
      var ast0=parse(code);
      report.original=code;

      var current=code;
      var renamedCount=0;
      var aliasedCount=0;
      var activeAliasMap=null;   // 结构阶段产生的别名映射，供后续阶段等价校验沿用

      // 阶段 1.2：结构性（统一规划：局部重命名 + 全局折叠 + 成员折叠 + 仿射因子）
      if(doRename){
        var info=analyze(ast0);
        var allGlobals=collectGlobalNames(ast0, info);
        var plan=planAll(info, allGlobals, ast0);
        renamedCount=plan.edits.length;
        aliasedCount=Object.keys(plan.aliasByName).length;

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
            '重命名/折叠 '+plan.edits.length+' 处引用；全局别名 '+Object.keys(plan.aliasByName).length+' 个，成员别名 '+Object.keys(plan.memberByLocal).length+' 个');

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
          toRemove.reverse();
          toRemove.forEach(function(m){
            current=current.slice(0,m.start)+current.slice(m.end);
          });
          if(current.length<beforeDedup){
            rec('重复声明删除', beforeDedup, current.length, '删除 '+toRemove.length+' 个重复的 local 声明');
            report.stages.push({name:'1.10-重复声明删除', code:current, len:current.length});
          }else{
            current=current.slice(0,beforeDedup);
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
      return report;
    }

    return {
      compress: compress,
      // 以下下划线成员仅供测试/调试使用
      _parse: parse,
      _analyze: analyze,
      _canonical: canonical,
      _preprocess: preprocess,
      _lex: lex,
      _needSpace: needSpace,
      _planAll: planAll,
      _applyEdits: applyEdits,
      _collectGlobalNames: collectGlobalNames
    };
  }

  root.LuaMin = { create: create, lex: lex, needSpace: needSpace, KEYWORDS: KEYWORDS };

})(typeof window !== 'undefined' ? window : globalThis);