/* LuaMin part: canonical — 由 _refactor_split.js 从 core.js 抽取，函数体逐字保留 */
(function(root){
  'use strict';
  (root.__LuaMinParts = root.__LuaMinParts || []).push({name:'canonical', install:function(C){
    var luaparse=C.luaparse, luaValidate=C.luaValidate, parse=C.parse, analyze=C.analyze;
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
      // 别名声明 binding 集合（binding 级，不误伤嵌套同名局部）：
      // 扫描顶层语句，凡 LocalStatement 中变量名在 aliasLocalNames 里的，把其 binding 加入集合。
      var aliasLocalBindings=new Set();
      if(aliasLocalNames.size>0){
        for(var _si=0;_si<ast.body.length;_si++){
          var _st=ast.body[_si];
          if(_st.type==='LocalStatement'&&_st.variables){
            for(var _vi=0;_vi<_st.variables.length;_vi++){
              var _vn=_st.variables[_vi];
              if(_vn.type==='Identifier'&&aliasLocalNames.has(_vn.name)){
                var _vb=varOf.get(_vn); if(_vb) aliasLocalBindings.add(_vb);
              }
            }
          }
        }
      }

      // ---- 内在透明别名归一（copy-propagation 标准形）----
      // 一个只读局部 M（单次声明、从不被赋值）若 init 为"从不被赋值的全局 G"或"另一透明别名链至 G"，
      // 则读 M 与读 G 在语义上完全等价（G 不变，M 即 G 的快照常量）。canonical 把这类 M 的声明删除、
      // 把对 M 的读还原为对 G 的读。该归一是【纯结构、语义保持】的，对任何代码两侧一致施加，
      // 因此外部校验（原始侧不传 aliasMap）与压缩侧（传 aliasMap）都会收敛到同一标准形——
      // 这正是"透明别名消解"优化得以被严格验证的基础（非旁路）。
      var autoTAByBinding=new Map(); // binding -> 全局名 G
      (function detectTA(){
        var assignedG=info.assignedGlobals;           // 被赋值过的全局名（不可作 alias 源）
        var assignedB=new Set();                      // 被赋值过的局部 binding（不可作透明别名）
        (function collect(node){
          if(!node||typeof node!=='object') return;
          if(Array.isArray(node)){ for(var i=0;i<node.length;i++) collect(node[i]); return; }
          if(node.type==='AssignmentStatement'&&node.variables){
            for(var i=0;i<node.variables.length;i++){
              var t=node.variables[i];
              if(t&&t.type==='Identifier'){ var bb=varOf.get(t); if(bb) assignedB.add(bb); }
            }
          }
          for(var k in node){ if(k==='range'||k==='loc')continue; if(Object.prototype.hasOwnProperty.call(node,k)) collect(node[k]); }
        })(ast.body);
        // 迭代到不动点以解析别名链（local g=Global; local h=g）
        var changed=true, guard=0;
        while(changed && guard++<64){
          changed=false;
          (function walk(stmts){
            for(var si=0;si<stmts.length;si++){
              var st=stmts[si];
              if(st&&st.type==='LocalStatement'&&st.variables&&st.init){
                for(var vi=0;vi<st.variables.length;vi++){
                  var v=st.variables[vi], initExpr=st.init[vi];
                  if(!v||v.type!=='Identifier'||!initExpr||initExpr.type!=='Identifier') continue;
                  var b=varOf.get(v);
                  if(!b||autoTAByBinding.has(b)||b.decls.length!==1||assignedB.has(b)) continue;
                  var ib=varOf.get(initExpr);
                  if(ib===null){
                    // init 是全局标识符；若它本身是 byName 折叠别名（如 a→ModCallbacks），
                    // 解析为其真实全局名，使"原始侧 M=ModCallbacks"与"输出侧 M=a"收敛同一标准形。
                    var gname=globalOfAlias.hasOwnProperty(initExpr.name)?globalOfAlias[initExpr.name]:initExpr.name;
                    if(assignedG.has(gname)) continue;     // 源全局被赋值过 → 不安全
                    autoTAByBinding.set(b, gname); changed=true;
                  }else if(autoTAByBinding.has(ib)){
                    autoTAByBinding.set(b, autoTAByBinding.get(ib)); changed=true;
                  }
                }
              }
              // 递归进入嵌套块
              for(var k in st){ if(k==='range'||k==='loc')continue;
                var ch=st[k];
                if(Array.isArray(ch)){ for(var ci=0;ci<ch.length;ci++){ var cc=ch[ci]; if(cc&&cc.body&&Array.isArray(cc.body)) walk(cc.body); } }
                else if(ch&&ch.body&&Array.isArray(ch.body)) walk(ch.body);
              }
            }
          })(ast.body);
        }
      })();
      function autoTAGlobal(b){ return autoTAByBinding.has(b) ? autoTAByBinding.get(b) : null; }

      // ---- 死前向声明归一（forward-nil elimination，标准形）----
      // 形态：`local v=nil`（或 `local v` 缺省 init）后，v 在到达其【同块内首次赋值】之前
      // 从不被读到（包括嵌套函数捕获、嵌套块读取），则该 nil 声明与"把首次赋值当作声明"
      // 语义等价：`local v=nil ...(不读v)... v=e ...`  ≡  `...(不读v)... local v=e ...`。
      // canonical 对此归一：① 不发射该 nil 声明（fwdNilDeclNodes 标记的 LocalDecl 变量项）；
      //   ② 不对该 binding 在 nil 声明处 bumpDef（使其首次赋值成为 v0，与 in-place 声明对齐）。
      // 该归一【对两侧一致施加、纯结构、语义保持】，因此 in-place 与 forward-nil 两种写法收敛同形。
      //
      // 健全性前提（任一不满足则不消除该 binding）：
      //   (P1) binding 单作用域单声明（decls.length===1），且声明 init 为 nil/缺省；
      //   (P2) 声明语句与"首次赋值"在【同一语句块】内（顶层 ast.body 或同一 block 数组）；
      //        跨块（if/loop/do 内的赋值）不消除——合并点版本语义复杂，保守放弃；
      //   (P3) 首次赋值是对该 binding 的【简单赋值】（AssignmentStatement 中 target 为该 binding，
      //        且该赋值不在更深的嵌套块/函数里）；
      //   (P4) 从声明语句之后到首次赋值语句之前（不含赋值语句本身的 RHS 之外、含其它目标），
      //        v 在任何位置都【不被引用】——包括嵌套函数体（捕获）与嵌套块；
      //   (P5) 首次赋值语句自身的 RHS 不读 v（自引用读到 nil，不等价）。
      var fwdNilBindings=new Set();       // 可消除的 forward-nil binding
      var fwdNilDeclVarNode=new Map();    // binding -> 其在声明语句里的变量 Identifier 节点
      (function detectFwdNil(){
        // 引用计数辅助：统计某 binding 在给定节点子树内的引用次数（decls 不算引用，uses 算）
        function refCountIn(node, b){
          var cnt=0;
          (function w(n){
            if(!n||typeof n!=='object') return;
            if(Array.isArray(n)){ for(var i=0;i<n.length;i++) w(n[i]); return; }
            if(n.type==='Identifier' && varOf.get(n)===b){ cnt++; }
            for(var k in n){ if(k==='range'||k==='loc')continue; if(Object.prototype.hasOwnProperty.call(n,k)) w(n[k]); }
          })(node);
          return cnt;
        }
        // 在一个语句块（stmts 数组）内尝试识别 forward-nil。
        function scanBlock(stmts){
          for(var i=0;i<stmts.length;i++){
            var st=stmts[i];
            if(st.type==='LocalStatement' && st.variables){
              for(var vi=0;vi<st.variables.length;vi++){
                var vnode=st.variables[vi];
                if(vnode.type!=='Identifier') continue;
                var b=varOf.get(vnode);
                if(!b || fwdNilBindings.has(b)) continue;
                if(b.decls.length!==1) continue;                       // P1
                // init 必须是 nil / 缺省
                var initExpr=(st.init&&st.init[vi])?st.init[vi]:null;
                if(initExpr && initExpr.type!=='NilLiteral') continue;  // P1
                // 在同块内寻找该 binding 的首次简单赋值（AssignmentStatement，target==b）
                var assignIdx=-1, assignTargetPos=-1;
                for(var j=i+1;j<stmts.length;j++){
                  var s2=stmts[j];
                  if(s2.type==='AssignmentStatement' && s2.variables){
                    var hit=-1;
                    for(var t=0;t<s2.variables.length;t++){
                      var tv=s2.variables[t];
                      if(tv.type==='Identifier' && varOf.get(tv)===b){ hit=t; break; }
                    }
                    if(hit>=0){ assignIdx=j; assignTargetPos=hit; break; }
                  }
                  // 若在找到赋值前，该语句内读到了 b（P4 违反），停止（不可消除）
                  if(refCountIn(s2, b)>0){ assignIdx=-2; break; }
                }
                if(assignIdx<0) continue;                              // 无同块首次赋值（或中途被读）
                var asg=stmts[assignIdx];
                // P3：首次赋值是对该 binding 的赋值。单目标直接可消除；多目标仅当该多重赋值
                //   "安全可拆"（multiAssignSafeToSplit：目标皆简单 Identifier、互不重名、
                //   #init==#vars、RHS 不读任何目标）时才消除——否则 multi 与 split 两形态在
                //   canonical 下不收敛，会造成不对称（仅 split 形被消除）的假不等价。
                if(asg.variables.length===1){
                  if(asg.init && asg.init.length!==1) continue;
                }else{
                  if(!multiAssignSafeToSplit(asg)) continue;
                }
                // P5：赋值 RHS 不读 b
                if(refCountIn(asg.init||[], b)>0) continue;
                // P4 补充：声明语句【其余变量项的 init】不读 b（同语句内 b 之后的 init 已在解析期处理，
                //   但保守再查一次整条声明 init，排除 b 出现在其它 init）
                if(st.init && refCountIn(st.init, b)>0) continue;
                // 通过全部前提 → 标记消除
                fwdNilBindings.add(b);
                fwdNilDeclVarNode.set(b, vnode);
              }
            }
            // 递归进入嵌套块（但 forward-nil 只在【同块】配对，嵌套块自成一作用域）
            descendBlocks(st, scanBlock);
          }
        }
        function descendBlocks(st, cb){
          switch(st.type){
            case 'IfStatement': st.clauses.forEach(function(c){cb(c.body||[]);}); break;
            case 'WhileStatement': case 'DoStatement': case 'ForNumericStatement':
            case 'ForGenericStatement': case 'RepeatStatement': cb(st.body||[]); break;
            default:
              (function w(n){ if(!n||typeof n!=='object')return; if(Array.isArray(n)){n.forEach(w);return;}
                if(n.type==='FunctionDeclaration'){ cb(n.body||[]); return; }
                for(var k in n){ if(k==='range'||k==='loc')continue; if(Object.prototype.hasOwnProperty.call(n,k)) w(n[k]); } })(st);
          }
        }
        scanBlock(ast.body);
      })();

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
            // 内在透明别名：读 M ≡ 读其源全局 G（两侧一致施加，标准形）。优先于其它别名处理。
            if(autoTAByBinding.has(b)){
              return {type:'Identifier', kind:'global', name: autoTAByBinding.get(b)};
            }
            // 别名还原（byName 全局折叠别名）：读别名 ≡ 读全局。
            if(aliasLocalNames.has(b.name) && globalOfAlias.hasOwnProperty(b.name)){
              return {type:'Identifier', kind:'global', name: globalOfAlias[b.name]};
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
            // 声明项过滤：① 透明别名（autoTA）两侧一致删除（其读已还原为全局 G）；
            //   ② 死前向声明（fwdNil）两侧一致删除（其首次赋值会成为标准声明，且不 bumpDef）。
            var keepIdx=[];
            for(var ki=0;ki<st.variables.length;ki++){
              var kv=st.variables[ki];
              var kb=(kv.type==='Identifier' && varOf.has(kv)) ? varOf.get(kv) : null;
              var drop=kb && (autoTAByBinding.has(kb) || fwdNilBindings.has(kb) || aliasLocalBindings.has(kb));
              if(!drop) keepIdx.push(ki);
            }
            if(keepIdx.length===0) return {type:'__DROP__'};
            var inits=[];
            for(var kj=0;kj<keepIdx.length;kj++){
              var ii=keepIdx[kj];
              inits.push(ii<rawInits.length ? normExpr(rawInits[ii]) : {type:'NilLiteral'});
            }
            var vars=keepIdx.map(function(ii){
              var v=st.variables[ii];
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
            // if-not 二择归一：`if not C then A else B end` ≡ `if C then B else A end`。
            // 推广到【条件顶层是连续若干个 not】：剥光全部前导 not，按 not 个数的奇偶决定是否对调分支——
            //   偶数个（如 `not not c`）：if 条件本就只看真假，双否抵消 → 去掉全部 not、分支不动；
            //   奇数个（如 `not c` / `not not not c`）：去掉全部 not、两分支对调一次。
            // 三种写法（`if c`、`if not not c`、`if not c`-对调）经此归一收敛同形，使"去 not(换分支)"可严格验证。
            // 安全约束：必须恰好两 clause（if+else，无 elseif，否则无可对调的分支）；
            //   只在【if 条件】这一布尔语境里抵消 not（值语境的 `not not x` 会强制成布尔，语义不同，不在此处理）；
            //   被剥的 not 必须层层都是一元 not（顶层是 `not a and b` 这类则不匹配，因为顶层是 and/or）。
            //   C 只求值一次，奇偶对调不改变语义。
            var ifClauses = st.clauses;
            if(ifClauses && ifClauses.length===2
               && ifClauses[0].type==='IfClause' && ifClauses[1].type==='ElseClause'
               && ifClauses[0].condition && ifClauses[0].condition.type==='UnaryExpression'
               && ifClauses[0].condition.operator==='not'){
              var notCount=0, inner=ifClauses[0].condition;
              while(inner && inner.type==='UnaryExpression' && inner.operator==='not'){ notCount++; inner=inner.argument; }
              var ifBody=ifClauses[0].body, elseBody=ifClauses[1].body;
              // 奇数个 not → 对调分支；偶数个 → 分支不动。两者都用剥光 not 的 inner 作条件。
              var thenBody = (notCount%2===1) ? elseBody : ifBody;
              var elsBody  = (notCount%2===1) ? ifBody  : elseBody;
              ifClauses = [
                {type:'IfClause', condition: inner, body: thenBody},
                {type:'ElseClause', body: elsBody}
              ];
            }
            // 分支：各 clause 从当前版本快照出发；分支后对"任一分支重定义过的 binding"提升到新版本（合并点）
            var snapshot=new Map(curVer);
            var touched=new Set();
            var clauses=ifClauses.map(function(cl){
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
          if(ns && ns.type==='__DROP__') continue; // 透明别名整条声明被消解，两侧一致跳过
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
        // ---- 可重定位声明的下沉归一（hoist-with-value 标准形）----
        // 把"初值可安全重定位的单变量 LocalDecl"（形如 `LocalDecl T={}` / =数字 / =字符串 /
        // =布尔 / =nil）在块内向下移动，越过所有【不引用 T】的后续语句，直到 T 被首次引用
        // 之前（或块尾）。这样两种写法收敛同形：
        //   (A) 前向 nil + 后续赋值（已由 fwdNil 归一成"赋值处的 LocalDecl T=e"）；
        //   (B) 值放进别名头（`local ...,T=e ...`）。
        // 二者经下沉后，`LocalDecl T=e` 都停在 T 首次使用前的同一位置。
        // 健全性：初值是无副作用、无外部依赖的字面量（重定位不改变其值，也不产生可观察副作用），
        //   且只越过不读 T 的语句（被越过语句看不到 T 的存在差异）。下沉是块内稳定移动，
        //   不跨越任何引用 T 的语句，故语义保持。
        bubbleRelocatableDecls(out);
        return out;
      }

      // 判断归一后的 init 节点是否"可安全重定位"（重新求值/改变求值时机都不可观察）：
      //   空表 {}、数字、字符串、布尔、nil。非空表 {..}（字段可能依赖可变状态/有标识语义）、
      //   调用、索引、成员、标识符读取等一律排除。
      function isRelocatableInit(node){
        if(!node||typeof node!=='object') return false;
        switch(node.type){
          case 'NumericLiteral': case 'StringLiteral': case 'BooleanLiteral': case 'NilLiteral':
            return true;
          case 'TableConstructorExpression':
            return !node.fields || node.fields.length===0;   // 仅空表 {}
          default: return false;
        }
      }
      // 归一节点子树是否引用某 local 逻辑 id n
      function refsLocalId(node, n){
        var found=false;
        (function w(x){
          if(found||!x||typeof x!=='object') return;
          if(Array.isArray(x)){ for(var i=0;i<x.length;i++) w(x[i]); return; }
          if(x.kind==='local' && x.n===n){ found=true; return; }
          for(var k in x){ if(Object.prototype.hasOwnProperty.call(x,k)) w(x[k]); }
        })(node);
        return found;
      }
      // 取单变量 LocalDecl 的 (localId, initNode)；不符合则返回 null
      function singleLocalDecl(stmt){
        if(!stmt || stmt.type!=='LocalDecl' || stmt.vars.length!==1 || stmt.init.length!==1) return null;
        var v=stmt.vars[0];
        if(!v || v.kind!=='local' || typeof v.n!=='number') return null;
        return {n:v.n, init:stmt.init[0]};
      }
      // 块内稳定下沉：对每个可重定位单变量 LocalDecl，后移到其变量【首次被引用】之前。
      // 仅当该变量在块内后续确有引用时才下沉（否则停在原位，避免无引用声明四处漂移导致
      // 两种写法发散）。下沉只越过不引用它的语句，停在首个引用它的语句之前。
      function bubbleRelocatableDecls(list){
        // 把每个"可重定位单变量 LocalDecl"（字面量/空表初值、单变量）下沉到其变量首次被引用
        // 之前的规范位置。做法：先把所有【在其后确有引用】的可重定位声明抽离，再按"首次引用所在
        // （抽离后）语句"为锚点重新插入到该语句之前；同锚点多个声明按逻辑 id 升序稳定排列。
        // 这样无论原始写法把声明放在批量头还是就近，都收敛到同一规范位置。
        // 健全性：只在"声明与首次引用之间不含对该变量的引用"时移动（被越过语句看不到该变量），
        // 且可重定位初值重新定位不可观察。无后续引用的声明不动（避免无依据漂移导致发散）。
        var pulls=[];   // {decl, n}
        var rest=[];
        for(var i=0;i<list.length;i++){
          var st=list[i];
          var info=singleLocalDecl(st);
          if(info && isRelocatableInit(info.init)){
            // 该变量在 list 后续是否有引用
            var hasLater=false;
            for(var k=i+1;k<list.length;k++){ if(refsLocalId(list[k], info.n)){ hasLater=true; break; } }
            if(hasLater){ pulls.push({decl:st, n:info.n}); continue; }
          }
          rest.push(st);
        }
        if(!pulls.length) return;
        // 对每个待插入声明，找到 rest 中首个引用其变量的语句下标作为插入锚点。
        // 同锚点按 n 升序，保证多个声明的相对顺序规范。
        pulls.forEach(function(p){
          var anchor=rest.length;
          for(var r=0;r<rest.length;r++){ if(refsLocalId(rest[r], p.n)){ anchor=r; break; } }
          p.anchor=anchor;
        });
        pulls.sort(function(a,b){ if(a.anchor!==b.anchor) return a.anchor-b.anchor; return a.n-b.n; });
        // 从后往前插入，保证已计算的 anchor 下标不被前面的插入破坏。
        for(var pi=pulls.length-1; pi>=0; pi--){ rest.splice(pulls[pi].anchor, 0, pulls[pi].decl); }
        // 写回 list
        list.length=0;
        for(var q=0;q<rest.length;q++) list.push(rest[q]);
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

    // 别名等价：srcB 用 aliasMap 归一（别名局部还原为全局/成员、跳过插入的声明）后应等于原始。
    // 透明别名消解由 canonical 内在归一（autoTA copy-propagation）双侧一致处理，无需在此特殊传参。
    function assertEquivalentAlias(srcOrig, srcB, aliasMap, stageName, steps){
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

    C.canonical=canonical; C.assertEquivalent=assertEquivalent; C.assertEquivalentAlias=assertEquivalentAlias; C.assertParses=assertParses;
  }});
})(typeof window !== 'undefined' ? window : globalThis);
