/* LuaMin part: plan — 由 _refactor_split.js 从 core.js 抽取，函数体逐字保留 */
(function(root){
  'use strict';
  (root.__LuaMinParts = root.__LuaMinParts || []).push({name:'plan', install:function(C){
    var KEYWORDS=C.KEYWORDS, candidateGenerator=C.candidateGenerator, collectMemberAccess=C.collectMemberAccess;
    function planAll(info, allGlobalNames, ast, allowElision){
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

      // transparentAliasBindings: binding -> 它最终别名到的全局名（溯源到最底层）
      // taSiteStmt/taSiteIdx/taInitNode: 记录每个透明别名 binding 的声明位置与 init 节点，
      //   供后续生成"删除声明项"的精确 token 区间编辑。
      var transparentAliasBindings=new Map();
      var taSiteStmt=new Map(), taSiteIdx=new Map(), taInitNode=new Map();
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
                taSiteStmt.set(b, st); taSiteIdx.set(b, vi); taInitNode.set(b, initExpr);
              }else{
                var sourceGlobal=transparentAliasBindings.get(initBinding);
                if(sourceGlobal){
                  transparentAliasBindings.set(b, sourceGlobal);
                  taSiteStmt.set(b, st); taSiteIdx.set(b, vi); taInitNode.set(b, initExpr);
                }
              }
            }
          }
        }
      })(ast.body);

      // ---- 透明别名最终判定（在 planAll 内完成"变量值追踪 + 别名替换"规划）----
      // 规则 R1（按名归并防误判）：一个名字 N 仅当【AST 中所有名为 N 的 binding】都被识别为
      //   同一全局 G 的透明别名时，N 才可被消解。这保证 canonical 按名还原/删声明的操作是
      //   全局一致、可证等价的。
      // 规则 R2（可安全删除声明项）：N 的每个 binding 所在 local 声明里只含 1 个透明别名变量，
      //   且该声明 #init==#vars（位置对齐），否则放弃该名（其 binding 退回普通局部，正常重命名）。
      var bindingsByName=new Map();
      info.bindings.forEach(function(b){
        if(!bindingsByName.has(b.name)) bindingsByName.set(b.name, []);
        bindingsByName.get(b.name).push(b);
      });
      var candNames=new Map(); // name -> global（通过 R1 的候选名）
      bindingsByName.forEach(function(list, name){
        var g=null, ok=true;
        for(var i=0;i<list.length;i++){
          if(!transparentAliasBindings.has(list[i])){ ok=false; break; }
          var gg=transparentAliasBindings.get(list[i]);
          if(g===null) g=gg; else if(g!==gg){ ok=false; break; }
        }
        if(ok && g!==null) candNames.set(name, g);
      });
      // 每条声明里的"透明候选变量"计数（仅统计通过 R1 的候选）
      var cntPerStmt=new Map();
      transparentAliasBindings.forEach(function(g, b){
        if(!candNames.has(b.name)) return;
        var st=taSiteStmt.get(b);
        cntPerStmt.set(st, (cntPerStmt.get(st)||0)+1);
      });
      function elidableBinding(b){
        var st=taSiteStmt.get(b);
        if(!st || cntPerStmt.get(st)!==1) return false;          // R2: 单声明内只允许 1 个透明别名
        if(!st.init || st.init.length!==st.variables.length) return false; // R2: 位置对齐
        return true;
      }
      var finalTA={};            // name -> global（最终消解集）
      var elideBindings=new Set();
      if(allowElision){
        candNames.forEach(function(g, name){
          var list=bindingsByName.get(name);
          if(list.every(elidableBinding)){
            finalTA[name]=g;
            list.forEach(function(b){ elideBindings.add(b); });
          }
        });
      }
      var forceFoldGlobals=new Set();          // 这些全局必须折叠（消解后别名使用都指向它）
      for(var fk in finalTA){ if(finalTA.hasOwnProperty(fk)) forceFoldGlobals.add(finalTA[fk]); }
      var reservedElidedNames=new Set(Object.keys(finalTA)); // 禁止其它局部复用被消解的名字
      // 被消解 binding 的 init 节点：全局 init 用于在全局折叠编辑里跳过（落在删除区间内）；
      // 全部 init（含局部链式 init）用于在使用重定向里跳过（同样落在删除区间内）。
      var aliasInitNodes=new Set(), allElidedInitNodes=new Set();
      elideBindings.forEach(function(b){
        var init=taInitNode.get(b);
        if(!init) return;
        allElidedInitNodes.add(init);
        if(info.varOf.get(init)===null) aliasInitNodes.add(init);
      });

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
      //   被消解的透明别名 binding 不进入着色表：它们的声明会被删除、使用会重定向到全局别名，
      //   因此既不参与重命名也不占用名字资源。
      var nodes=[];
      bindings.forEach(function(b,idx){
        if(elideBindings.has(b)) return;
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
          if(reservedElidedNames.has(cand)) continue; // 不复用被消解的透明别名名字（防止与还原冲突）
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
          // forceFoldGlobals：被透明别名消解指向的全局必须折叠，否则重定向后的使用点没有目标别名。
          var m=nd.g.m, kk=nd.g.k, L=pick?pick.length:99;
          if(pick!==null && ((m-L)*kk > (m+L+1) || forceFoldGlobals.has(nd.g.name))) assigned[ni]=pick;
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
          nd2.g.nodes.forEach(function(node){
            if(aliasInitNodes.has(node)) return; // 该全局读位于被删除的透明别名声明里，跳过
            edits.push({start:node.range[0],end:node.range[1],name:nm2});
          });
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

      // (e2) 透明别名消解：把别名使用重定向到全局折叠别名，并删除别名声明项。
      //   仅当目标全局确实拿到了折叠别名（aliasByName 有值）才执行；否则放弃该名的消解
      //   （binding 已被排除出着色表 → 保持原名与原声明，仍然语义自洽）。
      var emittedTA={};
      elideBindings.forEach(function(b){
        var g=transparentAliasBindings.get(b);
        var galias=aliasByName[g];
        if(!galias){ return; } // 目标全局未折叠成功：放弃此 binding 的消解
        emittedTA[b.name]=g;
        // 使用点重定向（跳过落在被删声明项里的链式 init 读）
        b.uses.forEach(function(u){
          if(allElidedInitNodes.has(u)) return;
          edits.push({start:u.range[0], end:u.range[1], name:galias});
        });
        // 删除声明项
        var st=taSiteStmt.get(b), vi=taSiteIdx.get(b);
        var vars=st.variables, inits=st.init, n=vars.length;
        if(n===1){
          edits.push({start:st.range[0], end:st.range[1], name:''}); // 整条删除
        }else if(vi===0){
          edits.push({start:vars[0].range[0], end:vars[1].range[0], name:''});  // 删 "M,"
          edits.push({start:inits[0].range[0], end:inits[1].range[0], name:''}); // 删 "val,"
        }else{
          edits.push({start:vars[vi-1].range[1], end:vars[vi].range[1], name:''});   // 删 ",M"
          edits.push({start:inits[vi-1].range[1], end:inits[vi].range[1], name:''}); // 删 ",val"
        }
      });
      // 仅保留真正消解成功的名字进 transparentAliases（供 canonical 双侧还原 + 删声明）
      var transparentAliases={};
      for(var en in emittedTA){
        if(emittedTA.hasOwnProperty(en) && finalTA.hasOwnProperty(en)) transparentAliases[en]=emittedTA[en];
      }


      // 仿射因子分解：对字符串字面量别名值，提取公共前缀/后缀，按总长度决定是否合并。
      // 需要避开所有已用名字：别名名 + 全部全局名 + 全部最终局部名。
      var avoid=new Set(declNames);
      allGlobalNames.forEach(function(g){avoid.add(g);});
      for(var ai=0; ai<N; ai++){ if(nodes[ai].kind==='L'){ avoid.add(assigned[ai]||nodes[ai].b.name); } }
      var declParts = buildDeclParts(declNames, declVals, avoid);

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

    C.planAll=planAll; C.buildDeclParts=buildDeclParts; C.affixCandidate=affixCandidate; C.applyEdits=applyEdits;
  }});
})(typeof window !== 'undefined' ? window : globalThis);
