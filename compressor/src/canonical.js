/* LuaMin part: canonical — 由 _refactor_split.js 从 core.js 抽取，函数体逐字保留 */
(function(root){
  'use strict';
  (root.__LuaMinParts = root.__LuaMinParts || []).push({name:'canonical', install:function(C){
    var luaparse=C.luaparse, luaValidate=C.luaValidate, parse=C.parse, analyze=C.analyze;

    // Canonical output is immutable text. Cache only the alias-free form by exact source,
    // because alias-aware canonicalization depends on the complete alias map.
    // A bounded LRU prevents browser sessions from retaining unbounded user source.
    var CANONICAL_CACHE_ENTRIES=32;
    var CANONICAL_CACHE_CHARS=2*1024*1024;
    var canonicalCache=new Map();
    var canonicalCacheChars=0;
    function getCachedCanonical(src){
      if(!canonicalCache.has(src)) return undefined;
      var value=canonicalCache.get(src);
      canonicalCache.delete(src);
      canonicalCache.set(src,value);
      return value;
    }
    function putCachedCanonical(src, value){
      var cost=src.length+value.length;
      if(cost>CANONICAL_CACHE_CHARS) return;
      if(canonicalCache.has(src)){
        canonicalCacheChars-=src.length+canonicalCache.get(src).length;
        canonicalCache.delete(src);
      }
      canonicalCache.set(src,value);
      canonicalCacheChars+=cost;
      while(canonicalCache.size>CANONICAL_CACHE_ENTRIES || canonicalCacheChars>CANONICAL_CACHE_CHARS){
        var oldest=canonicalCache.keys().next().value;
        var oldValue=canonicalCache.get(oldest);
        canonicalCacheChars-=oldest.length+oldValue.length;
        canonicalCache.delete(oldest);
      }
    }
    function canonical(src, aliasMap){
      var cacheable=aliasMap==null;
      if(cacheable){
        var cached=getCachedCanonical(src);
        if(cached!==undefined) return cached;
      }
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
      // 纯成员链冗余消除：local v=a.b.c 后，对 v 的所有读等价于 a.b.c（整链别名）。
      // 该登记让 canonical 把读 v 归一为整条访问链，从而"直接写 a.b.c"与"提取 v 后读 v"等价。
      var chainAliasByLocal=(aliasMap&&aliasMap.chainAliasByLocal)||null;

      var transparentAliases=(aliasMap&&aliasMap.transparentAliases)||null;
      var aliasLocalNames=new Set(), globalOfAlias={}, fieldOfAlias={}, prefixOfAlias={}, stringOfAlias={}, chainAliasNames=new Set();
      if(byName){ for(var gk in byName){ if(byName.hasOwnProperty(gk)){ aliasLocalNames.add(byName[gk]); globalOfAlias[byName[gk]]=gk; } } }
      if(transparentAliases){ for(var tk in transparentAliases){ if(transparentAliases.hasOwnProperty(tk)){ aliasLocalNames.add(tk); globalOfAlias[tk]=transparentAliases[tk]; } } }
      if(memberByLocal){ for(var mk in memberByLocal){ if(memberByLocal.hasOwnProperty(mk)){ aliasLocalNames.add(mk); fieldOfAlias[mk]=memberByLocal[mk]; } } }
      if(factorLocals){ for(var fi=0;fi<factorLocals.length;fi++) aliasLocalNames.add(factorLocals[fi]); }
      if(prefixFoldByLocal){ for(var pk in prefixFoldByLocal){ if(prefixFoldByLocal.hasOwnProperty(pk)){ aliasLocalNames.add(pk); prefixOfAlias[pk]=prefixFoldByLocal[pk]; } } }
      if(stringAliasByLocal){ for(var sk in stringAliasByLocal){ if(stringAliasByLocal.hasOwnProperty(sk)){ aliasLocalNames.add(sk); stringOfAlias[sk]=stringAliasByLocal[sk]; } } }
      if(chainAliasByLocal){ for(var ck in chainAliasByLocal){ if(chainAliasByLocal.hasOwnProperty(ck)){ aliasLocalNames.add(ck); chainAliasNames.add(ck); } } }

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

      // ---- 薄块包装检测（block-wrapper inlining）----
      // 形如 local function f(p1..pV)<语句块>end（或 local f=function(p1..pV)<语句块>end）的"薄包装"：
      // 函数体是一组"简单语句"（调用语句 / return 单调用），每个形参作为 Identifier 叶子恰好出现一次
      // （不进入嵌套函数）。其调用 f(a1..aV) ≡ 把形参替换为实参后的语句块；
      // 归一化时做语句级内联展开、并删除包装声明，使"提取块包装"可严格验证。
      var wrapperInline = new Map(); // binding -> {body:[AST], paramBindingToIndex:Map, paramCount}
      (function detectWrappers(){
        function blockWrapperInfo(fn){
          var params = fn.parameters || [];
          var body = fn.body || [];
          if(!body.length) return null;
          for(var bi=0; bi<body.length; bi++){
            var bst = body[bi];
            if(bst.type==='CallStatement') continue;
            return null;   // 只允许"纯调用语句"体（return 会在语句位内联时改变控制流，不支持）
          }
          var paramBindingToIndex = new Map();
          for(var pi=0; pi<params.length; pi++){
            var p = params[pi];
            if(p.type!=='Identifier' || !varOf.has(p)) return null;
            paramBindingToIndex.set(varOf.get(p), pi);
          }
          // 每个形参至少出现一次（可出现多次）；不进入嵌套函数。
          // 出现多次的形参记录进 multiUse：内联时其对应实参必须是"纯值"（无调用/vararg），
          // 否则一次求值变多次求值会改变语义——由 CallStatement 内联点做纯度守卫。
          var counts = new Map();
          function scan(node){
            if(!node || typeof node!=='object') return;
            if(Array.isArray(node)){ for(var i=0;i<node.length;i++) scan(node[i]); return; }
            if(node.type==='FunctionDeclaration'){ return; }
            if(node.type==='Identifier' && varOf.has(node)){
              var b = varOf.get(node);
              if(paramBindingToIndex.has(b)) counts.set(b, (counts.get(b)||0)+1);
              return;
            }
            for(var k in node){ if(k==='range'||k==='loc') continue; if(Object.prototype.hasOwnProperty.call(node,k)) scan(node[k]); }
          }
          body.forEach(scan);
          var multiUse=[];
          for(var ci=0; ci<params.length; ci++){
            var cnt = counts.get(varOf.get(params[ci])) || 0;
            if(cnt < 1) return null;      // 形参未出现：无用形参，不作为薄包装
            if(cnt > 1) multiUse.push(ci);
          }
          return {body: body, paramBindingToIndex: paramBindingToIndex, paramCount: params.length, multiUse: multiUse};
        }
        (function scanStmts(stmts){
          for(var si=0; si<stmts.length; si++){
            var st = stmts[si];
            var fn = null, nameNode = null;
            if(st.type === 'FunctionDeclaration' && st.isLocal && st.identifier){ fn = st; nameNode = st.identifier; }
            else if(st.type === 'LocalStatement' && st.variables && st.variables.length===1 && st.init && st.init.length===1 && st.init[0].type==='FunctionDeclaration'){
              fn = st.init[0]; nameNode = st.variables[0];
            }
            if(fn && nameNode && nameNode.type==='Identifier' && varOf.has(nameNode)){
              var info = blockWrapperInfo(fn);
              if(info) wrapperInline.set(varOf.get(nameNode), info);
            }
          }
        })(ast.body);
      })();

      // 语法级替换：把包装体内的形参节点换成实参节点（用于语句级内联）。不进入嵌套函数。
      function substituteWrapperBody(node, paramBindingToIndex, args){
        if(!node || typeof node!=='object') return node;
        if(Array.isArray(node)){ return node.map(function(x){ return substituteWrapperBody(x, paramBindingToIndex, args); }); }
        if(node.type==='FunctionDeclaration'){ return node; }
        if(node.type==='Identifier' && varOf.has(node)){
          var b = varOf.get(node);
          if(paramBindingToIndex.has(b)) return args[paramBindingToIndex.get(b)];
          return node;
        }
        var clone = {};
        for(var k in node){
          if(k==='range'||k==='loc') continue;
          if(Object.prototype.hasOwnProperty.call(node,k)) clone[k] = substituteWrapperBody(node[k], paramBindingToIndex, args);
        }
        return clone;
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

      // ---- 只读字面量别名归一（literal copy-propagation 标准形）----
      // 形态：local t=1000000 / local u='X' / local f=false（单声明、从不被赋值、init 为字面量），
      // 读 t ≡ 读 1000000（两侧一致施加）。这是"只读局部内联（逆别名）"得以被严格验证的基础：
      // `local t=1000000 ...=t...` 与 `...=1000000...` 归一收敛同形。
      var autoLitByBinding=new Map(); // binding -> 归一化字面量节点
      (function detectLit(){
        var assignedB=new Set();
        (function collect(node){
          if(!node||typeof node!=='object')return;
          if(Array.isArray(node)){for(var i=0;i<node.length;i++)collect(node[i]);return;}
          if(node.type==='AssignmentStatement'&&node.variables){
            for(var i=0;i<node.variables.length;i++){
              var t=node.variables[i];
              if(t&&t.type==='Identifier'){var bb=varOf.get(t);if(bb)assignedB.add(bb);}
            }
          }
          for(var k in node){if(k==='range'||k==='loc')continue;if(Object.prototype.hasOwnProperty.call(node,k))collect(node[k]);}
        })(ast.body);
        (function walk(stmts){
          for(var si=0;si<stmts.length;si++){
            var st=stmts[si];
            if(st.type==='LocalStatement'&&st.variables&&st.init){
              for(var vi=0;vi<st.variables.length;vi++){
                var v=st.variables[vi], ie=st.init[vi];
                if(!v||v.type!=='Identifier'||!ie)continue;
                var b=varOf.get(v);
                if(!b||b.decls.length!==1||assignedB.has(b))continue;
                var T=ie.type;
                if(T==='NumericLiteral'||T==='StringLiteral'||T==='BooleanLiteral'){
                  autoLitByBinding.set(b, normExpr(ie));
                }else{
                  // 常量表达式 init（如 local x=1+2）也按常量别名归一，保证与折叠后 local x=3 同形
                  var cf=constFold(ie);
                  if(cf!==null) autoLitByBinding.set(b, cf);
                }
              }
            }
          }
        })(ast.body);
      })();

      // ---- forward-nil 字面量归一（让 local v=lit 与 local v=nil v=lit 两种写法收敛同形）----
      (function detectFwdLit(){
        var assignCount=new Map();
        (function collect(node){
          if(!node||typeof node!=='object')return;
          if(Array.isArray(node)){for(var i=0;i<node.length;i++)collect(node[i]);return;}
          if(node.type==='AssignmentStatement'&&node.variables){
            for(var i=0;i<node.variables.length;i++){
              var t=node.variables[i];
              if(t&&t.type==='Identifier'){var bb=varOf.get(t);if(bb)assignCount.set(bb,(assignCount.get(bb)||0)+1);}
            }
          }
          for(var k in node){if(k==='range'||k==='loc')continue;if(Object.prototype.hasOwnProperty.call(node,k))collect(node[k]);}
        })(ast.body);
        function refIn(node,b){
          var c=0;
          (function w(n){if(!n||typeof n!=='object')return;if(Array.isArray(n)){n.forEach(w);return;}if(n.type==='Identifier'&&varOf.get(n)===b){c++;}for(var k in n){if(k==='range'||k==='loc')continue;if(Object.prototype.hasOwnProperty.call(n,k))w(n[k]);}})(node);
          return c;
        }
        (function walk(stmts){
          for(var si=0;si<stmts.length;si++){
            var st=stmts[si];
            if(st.type!=='LocalStatement'||!st.variables)continue;
            for(var vi=0;vi<st.variables.length;vi++){
              var vnode=st.variables[vi];
              if(vnode.type!=='Identifier')continue;
              var b=varOf.get(vnode);
              if(!b||b.decls.length!==1||autoLitByBinding.has(b))continue;
              if((assignCount.get(b)||0)!==1)continue;  // 恰好赋值一次（首次赋值即"声明"）
              var ie=(st.init&&st.init[vi])?st.init[vi]:null;
              if(ie && ie.type!=='NilLiteral')continue;  // 声明必须是 nil/缺省
              var firstInit=null;
              for(var j=si+1;j<stmts.length;j++){
                var s2=stmts[j];
                var hit=-1;
                if(s2.type==='AssignmentStatement'&&s2.variables&&s2.init){
                  for(var t=0;t<s2.variables.length;t++){
                    if(s2.variables[t].type==='Identifier'&&varOf.get(s2.variables[t])===b){hit=t;break;}
                  }
                }
                if(hit>=0){ firstInit=s2.init[hit]; break; }
                if(refIn(s2,b)>0) break;  // 赋值前读到 b → 保守放弃
              }
              if(!firstInit)continue;
              var T=firstInit.type;
              if(T==='NumericLiteral'||T==='StringLiteral'||T==='BooleanLiteral'){
                autoLitByBinding.set(b, normExpr(firstInit));
              }else{
                var cf=constFold(firstInit);
                if(cf!==null) autoLitByBinding.set(b, cf);
              }
            }
          }
        })(ast.body);
      })();

      // ---- 未使用纯局部归一（dead-pure-local elimination，标准形）----
      // 单声明、从不被读写、init 无副作用（字面量/标识符/纯表构造）的局部，其声明可整体删除：
      // `local x={} ...(不用x)...` ≡ `...(不用x)...`。两侧一致施加，使局部死代码消除可被严格验证。
      var deadPureBindings=new Set();
      (function detectDeadPure(){
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
        (function walk(stmts){
          for(var si=0;si<stmts.length;si++){
            var st=stmts[si];
            if(st.type==='LocalStatement'&&st.variables&&st.init){
              for(var vi=0;vi<st.variables.length;vi++){
                var v=st.variables[vi], ie=st.init[vi];
                if(!v||v.type!=='Identifier'||!ie)continue;
                var b=varOf.get(v);
                if(!b||b.decls.length!==1||b.uses.length!==0)continue;
                if(isPureExpr(ie)) deadPureBindings.add(b);
              }
            }
          }
        })(ast.body);
      })();

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

      // ---- 纯成员链别名归一（整链 copy-propagation）----
      // 形态：local v=a.b.c（单声明、从不被赋值、init 为成员/索引访问链，且 foldMemberChain 已证明链纯）。
      // 读 v ≡ 读 a.b.c（两侧一致施加）。把整链别名并入 autoLitByBinding，读处替换、声明处删除。
      if(chainAliasNames.size>0){
        var chainAssignedB=new Set();
        (function collectChainAssigned(node){
          if(!node||typeof node!=='object')return;
          if(Array.isArray(node)){for(var ci=0;ci<node.length;ci++)collectChainAssigned(node[ci]);return;}
          if(node.type==='AssignmentStatement'&&node.variables){
            for(var cj=0;cj<node.variables.length;cj++){
              var tv=node.variables[cj];
              if(tv&&tv.type==='Identifier'){ var tb=varOf.get(tv); if(tb) chainAssignedB.add(tb); }
            }
          }
          for(var k in node){if(k==='range'||k==='loc'||k==='parent'||k==='scope')continue;if(Object.prototype.hasOwnProperty.call(node,k))collectChainAssigned(node[k]);}
        })(ast.body);
        (function detectChainAlias(node){
          if(!node||typeof node!=='object')return;
          if(Array.isArray(node)){for(var di=0;di<node.length;di++)detectChainAlias(node[di]);return;}
          if(node.type==='LocalStatement'&&node.variables&&node.init){
            for(var dj=0;dj<node.variables.length;dj++){
              var vv=node.variables[dj], ie=node.init[dj];
              if(!vv||vv.type!=='Identifier'||!ie) continue;
              if(!chainAliasNames.has(vv.name)) continue;
              var cb=varOf.get(vv);
              if(!cb||cb.decls.length!==1||chainAssignedB.has(cb)) continue;
              if(ie.type!=='MemberExpression' && ie.type!=='IndexExpression') continue;
              autoLitByBinding.set(cb, normExpr(ie));
            }
          }
          for(var k in node){if(k==='range'||k==='loc'||k==='parent'||k==='scope')continue;if(Object.prototype.hasOwnProperty.call(node,k))detectChainAlias(node[k]);}
        })(ast.body);
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

      // ---- 常量折叠归一（constant-folding 标准形）----
      // 1+2 ≡ 3、'a'..'b' ≡ 'ab'、not true ≡ false。两侧一致施加，使 foldConstant 折叠后可被严格验证。
      function litConst(node){
        if(!node||typeof node!=='object') return null;
        if(node.type==='NumericLiteral'){
          var raw=node.raw||'';
          if(/^[+-]?\d+$/.test(raw)) return {kind:'int', v:parseInt(raw,10)};
          if(/^0[xX][0-9a-fA-F]+$/.test(raw)) return {kind:'int', v:parseInt(raw,16)};
          return null; // 浮点/科学计数不折叠（避免 int/float 混淆）
        }
        if(node.type==='StringLiteral'){
          var sc=stringContent(node);
          if(sc===null||sc.indexOf('\\')>=0) return null; // 长字符串或含转义不折叠
          return {kind:'str', v:sc};
        }
        if(node.type==='BooleanLiteral') return {kind:'bool', v:!!node.value};
        return null;
      }
      function numNode(r){
        if(r<0) return {type:'UnaryExpression', operator:'-', argument:{type:'NumericLiteral', value:-r, isInt:true}};
        return {type:'NumericLiteral', value:r, isInt:true};
      }
      function constValue(node){
        var lit=litConst(node);
        if(lit) return lit;
        // 解析字面量别名：读 u（u='X'/u=100）≡ 读字面量，使 constFold 能折叠 u..'Y' 这类拼接。
        if(node.type==='Identifier' && varOf.has(node)){
          var b2=varOf.get(node);
          if(b2 && stringOfAlias.hasOwnProperty(b2.name)) return {kind:'str', v:stringOfAlias[b2.name]};
          if(b2 && autoLitByBinding.has(b2)){
            var ln=autoLitByBinding.get(b2);
            if(ln && ln.type==='StringLiteral') return {kind:'str', v:ln.content};
            if(ln && ln.type==='NumericLiteral') return {kind:'int', v:ln.value};
            if(ln && ln.type==='BooleanLiteral') return {kind:'bool', v:ln.value};
          }
        }
        if(node.type==='BinaryExpression'){
          var L=constValue(node.left), R=constValue(node.right);
          if(L&&R){
            if(node.operator==='..'&&L.kind==='str'&&R.kind==='str') return {kind:'str', v:L.v+R.v};
            if(L.kind==='int'&&R.kind==='int'){
              var r;
              if(node.operator==='+')r=L.v+R.v;
              else if(node.operator==='-')r=L.v-R.v;
              else if(node.operator==='*')r=L.v*R.v;
              else return null;
              if(Number.isInteger(r)&&Math.abs(r)<=9007199254740991) return {kind:'int', v:r};
            }
          }
          return null;
        }
        if(node.type==='UnaryExpression'&&node.operator==='not'){
          var A=constValue(node.argument);
          if(A&&A.kind==='bool') return {kind:'bool', v:!A.v};
          return null;
        }
        return null;
      }
      function constFold(node){
        var cv=constValue(node);
        if(cv===null) return null;
        if(cv.kind==='int') return numNode(cv.v);
        if(cv.kind==='str'){ if(cv.v.indexOf('\\')<0&&cv.v.indexOf("'")<0) return {type:'StringLiteral', content:cv.v}; return null; }
        if(cv.kind==='bool') return {type:'BooleanLiteral', value:cv.v, raw:cv.v?'true':'false'};
        return null;
      }
      // 条件真值判定：返回 true（恒真）/ false（恒假）/ null（未知）。
      // 用于循环/分支条件归一——在"条件位置"只看真值，`true`≡`1`≡`'x'`（恒真）、`false`≡`nil`（恒假）。
      function condTruthy(node){
        var cv=constValue(node);
        if(cv===null) return null;
        if(cv.kind==='bool') return cv.v;
        if(cv.kind==='int') return cv.v!==0;
        if(cv.kind==='str') return cv.v!=='';
        return null;
      }
      // 是否含 break/goto：repeat until true 展开成 do/直接体时，break/goto 目标会从"repeat"变成"外层循环/块外"，语义不同。
      function hasBreakOrGoto(node){
        var found=false;
        (function w(n){ if(found||!n||typeof n!=='object')return; if(Array.isArray(n)){for(var i=0;i<n.length;i++)w(n[i]);return;}
          if(n.type==='BreakStatement'||n.type==='GotoStatement'){found=true;return;}
          for(var k in n){if(k==='range'||k==='loc')continue;if(Object.prototype.hasOwnProperty.call(n,k))w(n[k]);} })(node);
        return found;
      }

      function hasSideEffectNode(node){
        var found=false;
        (function w(n){ if(found||!n||typeof n!=='object')return; if(Array.isArray(n)){for(var i=0;i<n.length;i++)w(n[i]);return;}
          if(n.type==='CallExpression'||n.type==='StringCallExpression'||n.type==='TableCallExpression'){found=true;return;}
          // IndexExpression(obj[k]) 本身不是副作用：只有 base/index 里嵌套的调用才是。递归探查。
          for(var k in n){if(k==='range'||k==='loc')continue;if(Object.prototype.hasOwnProperty.call(n,k))w(n[k]);} })(node);
        return found;
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
            // 只读字面量别名：读 t ≡ 读其字面量（反向纠错验证基础）
            if(autoLitByBinding.has(b)) return autoLitByBinding.get(b);
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
        if(node.type==='NumericLiteral'){
          var raw=node.raw||'';
          var isInt=/^[+-]?\d+$/.test(raw)||/^0[xX][0-9a-fA-F]+$/.test(raw);
          return {type:'NumericLiteral', value:node.value, isInt:isInt};
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
        if(node.type==='StringCallExpression'){
          // 冒号方法糖参数：obj:m'X' ≡ obj:m('X') ≡ obj:m(X)，与 CallExpression 冒号分支同标准形，
          // 否则 base 的 MemberExpression(':') 会走通用递归、与 Access 形态不一致。
          if(node.base && node.base.type==='MemberExpression' && node.base.indexer===':'){
            var self2=node.base.base;
            return {type:'Call', base:{type:'Access', base:normExpr(self2), key:{field:node.base.identifier.name}},
                    args:[normExpr(self2), normExpr(node.argument)]};
          }
          return {type:'Call', base:normExpr(node.base), args:[normExpr(node.argument)]};
        }
        if(node.type==='TableCallExpression')
          return {type:'Call', base:normExpr(node.base), args:[normExpr(node.arguments)]};
        if(node.type==='IndexExpression'){
          var idx=node.index;
          if(idx && idx.type==='Identifier' && varOf.has(idx)){
            var ib=varOf.get(idx);
            if(ib && fieldOfAlias.hasOwnProperty(ib.name)) return normAccess(node.base, fieldOfAlias[ib.name], null);
            // 字符串字面量别名：obj[u] 与 obj['X'] 等价 → obj.X
            if(ib && stringOfAlias.hasOwnProperty(ib.name)) return normAccess(node.base, stringOfAlias[ib.name], null);
            // 只读字面量别名用作索引：obj[e]（e='X'）≡ obj['X'] ≡ obj.X，与点访问统一标准形
            if(ib && autoLitByBinding.has(ib)){
              var lit=autoLitByBinding.get(ib);
              if(lit && lit.type==='StringLiteral') return normAccess(node.base, lit.content, null);
            }
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
                if(b && fieldOfAlias.hasOwnProperty(b.name)) return fieldOfAlias[b.name];
              }
              return null;
            }
            var lp=asPrefixLocal(idx.left), ls=asLiteralOrStringAlias(idx.left);
            var rp=asPrefixLocal(idx.right), rs=asLiteralOrStringAlias(idx.right);
            if(lp!=null && rs!=null) return normAccess(node.base, lp+rs, null);
            if(ls!=null && rp!=null) return normAccess(node.base, ls+rp, null);
            if(ls!=null && rs!=null) return normAccess(node.base, ls+rs, null);
          }
          var sc=idx?stringContent(idx):null;
          if(sc!==null) return normAccess(node.base, sc, null);
          return normAccess(node.base, null, idx);
        }
        if(node.type==='FunctionDeclaration')
          return normFunction(node);
        // 常量折叠归一
        var cf=constFold(node);
        if(cf!==null) return cf;
        // 德摩根归一：not X or not Y ≡ not(X and Y)；not X and not Y ≡ not(X or Y)。
        // 两侧一致施加，使"把两个 not 合并成一个"的缩短 fold 可被严格验证。
        // 求值逻辑保持：not 是"先求值操作数再取反"，De Morgan 不改变操作数的求值顺序与次数。
        if(node.type==='LogicalExpression' && (node.operator==='or'||node.operator==='and')
           && node.left && node.left.type==='UnaryExpression' && node.left.operator==='not'
           && node.right && node.right.type==='UnaryExpression' && node.right.operator==='not'){
          var dmFlip = (node.operator==='or') ? 'and' : 'or';
          return {type:'UnaryExpression', operator:'not', argument:{type:'LogicalExpression', operator:dmFlip, left:normExpr(node.left.argument), right:normExpr(node.right.argument)}};
        }
        // 比较运算归一：a OP b ≡ b FLIP(OP) a（操作数字典序），仅当至多一侧有副作用
        if(node.type==='BinaryExpression'){
          var op2=node.operator;
          if(op2==='<'||op2==='>'||op2==='<='||op2==='>='||op2==='=='||op2==='~='){
            var lse=hasSideEffectNode(node.left), rse=hasSideEffectNode(node.right);
            if(!(lse&&rse)){
              var LA=normExpr(node.left), RA=normExpr(node.right);
              var sa=JSON.stringify(LA), sb=JSON.stringify(RA);
              if(sa<=sb) return {type:'BinaryExpression', operator:op2, left:LA, right:RA};
              var flip2={'<':'>','>':'<','<=':'>=','>=':'<='}[op2];
              return {type:'BinaryExpression', operator:(flip2||op2), left:RA, right:LA};
            }
          }
        }
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
      // 守卫检测：if c then return end / if c then break end（单 clause、无 else、体为单条 return/break）
      function isGuardStmt(st, target){
        if(!(st && st.type==='IfStatement' && st.clauses && st.clauses.length===1
           && st.clauses[0].type==='IfClause'
           && st.clauses[0].body && st.clauses[0].body.length===1)) return false;
        var inner=st.clauses[0].body[0];
        if(target==='return') return inner.type==='ReturnStatement' && (!inner.arguments || inner.arguments.length===0);
        if(target==='break') return inner.type==='BreakStatement';
        return false;
      }
      // 块开头的连续守卫归一（target='return' 用于函数体；'break' 用于循环体）：
      //   if c1 then <target> end if c2 then <target> end rest  ≡  if not(c1 or c2) then rest end
      // 两侧一致施加，"反条件省 return/break"（含多重 early return/break）得以被验证。
      function normGuardedBody(rawBody, target){
        var i=0, conds=[];
        while(i<rawBody.length && isGuardStmt(rawBody[i], target)){
          conds.push(normExpr(rawBody[i].clauses[0].condition));
          i++;
        }
        if(!conds.length) return normBlock(rawBody);
        var rest=normBlock(rawBody.slice(i));
        var orCond=conds[0];
        for(var c=1;c<conds.length;c++) orCond={type:'LogicalExpression', operator:'or', left:orCond, right:conds[c]};
        var notCond={type:'UnaryExpression', operator:'not', argument:orCond};
        return [{type:'If', clauses:[{type:'IfClause', cond:notCond, body:rest}]}];
      }

      function normFunction(node){
        // 参数 binding 取 v0（声明即定义）
        (node.parameters||[]).forEach(function(p){ if(p.type==='Identifier' && varOf.has(p)){ var b=varOf.get(p); bumpDef(b); } });
        var body=normGuardedBody(node.body||[], 'return');
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
              var drop=kb && (autoTAByBinding.has(kb) || fwdNilBindings.has(kb) || aliasLocalBindings.has(kb) || autoLitByBinding.has(kb) || deadPureBindings.has(kb) || wrapperInline.has(kb));
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
            // 先过滤被"别名归一/死纯归一/透明别名"删除的赋值目标（其"赋值即声明"应被删除）
            var keepRawVars=[], keepRawInits=[];
            for(var ai=0; ai<st.variables.length; ai++){
              var rawV=st.variables[ai];
              var kb=(rawV.type==='Identifier' && varOf.has(rawV) && varOf.get(rawV)) ? varOf.get(rawV) : null;
              if(kb && (autoTAByBinding.has(kb) || autoLitByBinding.has(kb) || deadPureBindings.has(kb) || aliasLocalBindings.has(kb))) continue;
              keepRawVars.push(rawV);
              keepRawInits.push(st.init ? st.init[ai] : undefined);
            }
            if(keepRawVars.length===0) return {type:'__DROP__'};
            var rhs=keepRawInits.map(function(e){ return e ? normExpr(e) : {type:'NilLiteral'}; });  // 先求值 RHS
            var tgts=keepRawVars.map(function(v){
              if(v.type==='Identifier' && varOf.has(v) && varOf.get(v)){
                var b=varOf.get(v);
                if(aliasLocalNames.has(b.name)) return normExpr(v);
                var nv=bumpDef(b); return {type:'Identifier',kind:'local',n:idFor(b,nv)};
              }
              return normExpr(v);
            });
            var allLocalTargets = keepRawVars.every(function(v){ return v.type==='Identifier' && varOf.has(v) && varOf.get(v) && !aliasLocalNames.has(varOf.get(v).name); });
            if(allLocalTargets) return {type:'LocalDecl', vars:tgts, init:rhs};
            return {type:'Assign', targets:tgts, init:rhs};
          }
          case 'CallStatement': {
            // 薄块包装语句级内联：f(a1..aV) ≡ 把形参替换为实参后的包装体语句块
            var cexpr = st.expression;
            if(cexpr && cexpr.type==='CallExpression' && cexpr.base && cexpr.base.type==='Identifier' && varOf.has(cexpr.base)){
              var wb2 = varOf.get(cexpr.base);
              if(wb2 && wrapperInline.has(wb2)){
                var wi2 = wrapperInline.get(wb2);
                var wargs = cexpr.arguments || [];
                // 纯度守卫：出现多次的形参，其实参必须无调用/vararg（否则一次求值变多次，语义不同）
                if(wi2.multiUse && wi2.multiUse.length){
                  var impure=false;
                  for(var mi2=0; mi2<wi2.multiUse.length && !impure; mi2++){
                    var an=wargs[wi2.multiUse[mi2]];
                    if(an && hasSideEffectNode(an)) impure=true;
                    if(an && (function(n){var f=false;(function w(x){if(f||!x||typeof x!=='object')return;if(Array.isArray(x)){for(var i=0;i<x.length;i++)w(x[i]);return;}if(x.type==='VarargLiteral'){f=true;return;}for(var k in x){if(k==='range'||k==='loc')continue;if(Object.prototype.hasOwnProperty.call(x,k))w(x[k]);}})(n);return f;})(an)) impure=true;
                  }
                  if(impure) return {type:'CallStmt', expr:normExpr(st.expression)};   // 不内联，按普通调用
                }
                var expanded = [];
                for(var bi2=0; bi2<wi2.body.length; bi2++){
                  var sub = substituteWrapperBody(wi2.body[bi2], wi2.paramBindingToIndex, wargs);
                  var ns2 = normStmt(sub);
                  if(ns2 && ns2.type!=='__DROP__') expanded.push(ns2);
                }
                return {type:'__EXPAND__', body:expanded};
              }
            }
            return {type:'CallStmt', expr:normExpr(st.expression)};
          }
          case 'ReturnStatement': return {type:'Return', args:(st.arguments||[]).map(normExpr)};
          case 'IfStatement': {
            // 常量条件折叠归一（真值语义）：if <常量> then A else B end ≡ do A end / do B end。
            // 用 condTruthy 解析条件（含别名 Y→true/1/'x'），恒真/恒假时归一为对应分支的 Do 块。
            var ct0 = st.clauses && st.clauses[0] && st.clauses[0].condition ? condTruthy(st.clauses[0].condition) : null;
            if(ct0 !== null){
              var takenBody = ct0 ? (st.clauses[0].body||[]) : (st.clauses[1] && st.clauses[1].body ? st.clauses[1].body : []);
              return {type:'Do', body: normBlock(takenBody)};
            }
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
            // 常量条件归一（真值语义）：while false/nil ≡ 空（体绝不执行）；while true/1/'x' ≡ while true
            var wt = condTruthy(st.condition);
            if(wt === false) return {type:'__DROP__'};
            var cond = (wt === true) ? {type:'BooleanLiteral', value:true, raw:'true'} : normExpr(st.condition);
            var snap=new Map(curVer);
            var body=normGuardedBody(st.body||[], 'break');
            // 循环体可能重定义 → 合并点提升
            var t=new Set(); curVer.forEach(function(ver,b){ if(snap.get(b)!==ver) t.add(b); });
            curVer=new Map(snap); t.forEach(function(b){bumpDef(b);});
            return {type:'While', cond:cond, body:body};
          }
          case 'RepeatStatement': {
            // 常量条件归一（真值语义）：repeat A until true/1 ≡ do A end；until false/nil ≡ while true do A end
            var rt = condTruthy(st.condition);
            var snap2=new Map(curVer);
            var body2=normGuardedBody(st.body||[], 'break');
            var t2=new Set(); curVer.forEach(function(ver,b){ if(snap2.get(b)!==ver) t2.add(b); });
            curVer=new Map(snap2); t2.forEach(function(b){bumpDef(b);});
            if(rt !== null){
              if(rt === false) return {type:'While', cond:{type:'BooleanLiteral', value:true, raw:'true'}, body:body2};
              if(!hasBreakOrGoto(st.body)) return {type:'Do', body:body2};   // until true → do A end（体无 break/goto 才安全）
            }
            var cond2=normExpr(st.condition);
            return {type:'Repeat', cond:cond2, body:body2};
          }
          case 'DoStatement': return {type:'Do', body:normBlock(st.body||[])};
          case 'ForNumericStatement': {
            var s1=normExpr(st.start), e1=normExpr(st.end), st1=st.step?normExpr(st.step):null;
            if(st.variable && varOf.has(st.variable)) bumpDef(varOf.get(st.variable));
            var v1=(st.variable&&varOf.has(st.variable))?{type:'Identifier',kind:'local',n:idFor(varOf.get(st.variable),curVersion(varOf.get(st.variable)))}:null;
            var snap3=new Map(curVer);
            var body3=normGuardedBody(st.body||[], 'break');
            var t3=new Set(); curVer.forEach(function(ver,b){ if(snap3.get(b)!==ver) t3.add(b); });
            curVer=new Map(snap3); t3.forEach(function(b){bumpDef(b);});
            return {type:'ForNum', var:v1, start:s1, end:e1, step:st1, body:body3};
          }
          case 'ForGenericStatement': {
            var its=(st.iterators||[]).map(normExpr);
            (st.variables||[]).forEach(function(v){ if(v.type==='Identifier'&&varOf.has(v)) bumpDef(varOf.get(v)); });
            var vs=(st.variables||[]).map(function(v){ return (v.type==='Identifier'&&varOf.has(v))?{type:'Identifier',kind:'local',n:idFor(varOf.get(v),curVersion(varOf.get(v)))}:normExpr(v); });
            var snap4=new Map(curVer);
            var body4=normGuardedBody(st.body||[], 'break');
            var t4=new Set(); curVer.forEach(function(ver,b){ if(snap4.get(b)!==ver) t4.add(b); });
            curVer=new Map(snap4); t4.forEach(function(b){bumpDef(b);});
            return {type:'ForGen', vars:vs, iters:its, body:body4};
          }
          case 'FunctionDeclaration': {
            if(st.isLocal && st.identifier && st.identifier.type==='Identifier' && varOf.has(st.identifier)){
              var b=varOf.get(st.identifier);
              if(wrapperInline.has(b)) return {type:'__DROP__'};   // 薄包装声明：内联后删除
              var nv=bumpDef(b);
              // local function f() end ≡ local f=function() end：归一为 LocalDecl，与合并后的 local a,f=... 同形
              return {type:'LocalDecl', vars:[{type:'Identifier',kind:'local',n:idFor(b,nv)}], init:[normFunction(st)]};
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
          if(ns && ns.type==='__EXPAND__'){ for(var ei=0; ei<ns.body.length; ei++) out.push(ns.body[ei]); continue; } // 薄块包装内联展开
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
        out = mergeTableFields(out);
        out = flattenEmptyDo(out);
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
      // 判断 Do 块体是否引入局部绑定（local / for 循环变量）
      function doHasLocalDecls(body){
        for(var i=0;i<body.length;i++){
          var s=body[i];
          if(s.type==='LocalDecl' || s.type==='ForNum' || s.type==='ForGen') return true;
        }
        return false;
      }
      // 空作用域 Do 块展开归一：`do A end`（A 无局部声明）≡ `A`
      function flattenEmptyDo(list){
        var out=[];
        for(var i=0;i<list.length;i++){
          var s=list[i];
          if(s && s.type==='Do' && s.body && !doHasLocalDecls(s.body)){
            for(var j=0;j<s.body.length;j++) out.push(s.body[j]);
          } else {
            out.push(s);
          }
        }
        return out;
      }
      // 表字段赋值合并归一：`local M={} M.X=1 M.Y=2` ≡ `local M={X=1,Y=2}`。
      // 仅当字段值不引用 M（否则构造器里对 M 的读会指到外层 M，语义不同）且赋值紧邻声明。
      function mergeTableFields(list){
        var out=[], i=0;
        while(i<list.length){
          var st=list[i];
          var merged=false;
          if(st && st.type==='LocalDecl' && st.vars.length===1 && st.init.length===1
             && st.init[0] && st.init[0].type==='TableConstructorExpression'
             && (!st.init[0].fields || st.init[0].fields.length===0)
             && st.vars[0] && st.vars[0].kind==='local' && typeof st.vars[0].n==='number'){
            var mid=st.vars[0].n;
            var fields=[], j=i+1;
            while(j<list.length){
              var as=list[j];
              if(as && as.type==='Assign' && as.targets.length===1 && as.init.length===1
                 && as.targets[0] && as.targets[0].type==='Access'
                 && as.targets[0].base && as.targets[0].base.kind==='local' && as.targets[0].base.n===mid
                 && as.targets[0].key && as.targets[0].key.field
                 && !refsLocalId(as.init[0], mid)){
                fields.push({type:'TableKeyString', key:{type:'Identifier', name:as.targets[0].key.field}, value:as.init[0]});
                j++;
              } else break;
            }
            if(fields.length){
              out.push({type:'LocalDecl', vars:st.vars, init:[{type:'TableConstructorExpression', fields:fields}]});
              i=j; merged=true;
            }
          }
          if(!merged){ out.push(st); i++; }
        }
        return out;
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
      var result=JSON.stringify(tree);
      if(cacheable) putCachedCanonical(src,result);
      return result;
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
      var ast;
      try{ ast=parse(src); }
      catch(e){
        if(steps) steps.push({stage:stageName, kind:'luaparse', ok:false, detail:e.message||String(e)});
        throw new Error('['+stageName+'] luaparse 语法校验失败: '+(e.message||e));
      }
      if(steps) steps.push({stage:stageName, kind:'luaparse', ok:true, detail:'luaparse AST 构建通过'});
      return ast;
    }

    C.canonical=canonical; C.assertEquivalent=assertEquivalent; C.assertEquivalentAlias=assertEquivalentAlias; C.assertParses=assertParses;
  }});
})(typeof window !== 'undefined' ? window : globalThis);
