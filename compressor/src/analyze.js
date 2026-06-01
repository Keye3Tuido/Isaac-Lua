/* LuaMin part: analyze — 由 _refactor_split.js 从 core.js 抽取，函数体逐字保留 */
(function(root){
  'use strict';
  (root.__LuaMinParts = root.__LuaMinParts || []).push({name:'analyze', install:function(C){
    var luaparse=C.luaparse;
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

    C.parse=parse; C.analyze=analyze; C.collectGlobalNames=collectGlobalNames; C.candidateGenerator=candidateGenerator; C.collectMemberAccess=collectMemberAccess;
  }});
})(typeof window !== 'undefined' ? window : globalThis);
