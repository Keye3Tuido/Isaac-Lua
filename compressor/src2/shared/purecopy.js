/* LuaMin v2 shared part: shared/purecopy — 输入预处理 + 纯代入归一（normPureCopyProp）。
 * preprocess：剥除每行行首的 `lua `/`l ` 控制台前缀。
 * normPureCopyProp：把「单用纯局部代入」重写应用到不动点——inlinePure 透镜族等价验证的
 * 预处理归一（两侧先各自归一，再走严格 canonical）。
 * 函数体沿用原实现，逐字保留。
 */
(function(root){
  'use strict';
  var part = {name:'shared/purecopy', install:function(C){
    var parse=C.parse, analyze=C.analyze, canSingleQuote=C.canSingleQuote, needsSepAfter=C.needsSepAfter;

    function preprocess(input){
      var lines=input.replace(/\r\n?/g,'\n').split('\n');
      var stripped=lines.map(function(line){
        return line.replace(/^[ \t]*(?:lua|l)[ \t]+/, '');
      });
      return stripped.join('\n');
    }

    // 编辑契约：半开区间 [start,end)，按 start 稳定排序后从左到右应用；
    // 允许零长插入（start===end），允许紧贴上一段末尾（start===cur），
    // 同一偏移的多个零长插入按 push 顺序全部生效。
    // 除此之外的任何重叠（e.start<cur）一律视为调用方 bug：抛错，不静默丢弃
    // （历史上静默跳过曾掩盖 foldIfNot 的嵌套重叠编辑——已在调用侧根治）。
    function applyEdits(src, edits){
      edits=edits.slice().sort(function(a,b){return a.start-b.start;});
      var out='', cur=0, prevStart=0, prevEnd=0;
      for(var i=0;i<edits.length;i++){
        var e=edits[i];
        if(e.start<cur){
          throw new Error('applyEdits: 编辑重叠（调用方 bug）——排序后第 '+i+' 段 ['+e.start+','+e.end+')="'+
            String(e.name).slice(0,30)+'" 与上一段 ['+prevStart+','+prevEnd+') 重叠；附近源码: '+
            JSON.stringify(src.slice(Math.max(0,e.start-20), Math.min(src.length,e.end+20))));
        }
        out+=src.slice(cur,e.start)+e.name;
        prevStart=e.start; prevEnd=e.end; cur=e.end;
      }
      out+=src.slice(cur);
      return out;
    }

    // ---------- 纯表达式单用代入（提取的逆变换：按压缩率仲裁取短者） ----------
    // 原则：提取（CSE）与代入（inline）互逆，两边各自带"只缩短才提交"闸门——
    // 提取更短时提取 pass 成交，代入更短时本 pass 成交，天然形成按压缩率的互逆仲裁。
    // 安全子集（保守）：
    //  1. 局部变量声明一次（decls.length===1）、未被重新赋值、恰好被读 1 次（闭包内也算）；
    //  2. 值来源：声明即赋值（单变量单值 LocalStatement 槽位），或独立赋值语句（单目标）；
    //     拆分形态下声明句里的 nil 填充槽联动删除（local p,w=f() 删成 local p=f()）；
    //  3. RHS 可移动纯表达式：字面量、局部/参数标识符、字段/索引访问、二元/一元运算、纯表构造
    //     ——不含任何调用、全局、变参；代入处一律加圆括号保优先级；
    //  4. 使用点在赋值之后；候选间"使用点落在其他候选删除语句内"的冲突由被包含方让位。
    // 等价验证：不改全局 canonical 语义，两侧先各自做纯代入归一（normPureCopyProp，
    // 本 fold 自己的重写理论），再走严格 canonical——避免影响其他 fold 的校验收敛性。
    function inlinePureAnalyze(src, aliasMap){
      var ast; try{ ast=parse(src); }catch(e){ return null; }
      var info=analyze(ast);
      // 语句 → 所属块语句列（内层块覆盖外层标记）。用于支配/作用域检查：
      // 赋值句形态的代入要求赋值句与使用点【同块且文本在前】——否则赋值可能
      // 未执行（if/for 体跳过），且 RHS 局部在块外不可见（2026-10-13 运行期炸码事故）。
      var blkOf=(function(){
        var m=new Map();
        function tagTree(n, blk){
          if(!n||typeof n!=='object')return;
          if(Array.isArray(n)){for(var i=0;i<n.length;i++)tagTree(n[i],blk);return;}
          m.set(n, blk);
          for(var k in n){
            if(k==='range'||k==='loc'||k==='comments'||k==='body'||k==='clauses')continue;
            var c=n[k];
            if(c&&typeof c==='object') tagTree(c, blk);
          }
          if(Array.isArray(n.body)) blockOfList(n.body);
          if(n.clauses){ for(var j=0;j<n.clauses.length;j++){
            if(n.clauses[j].condition) tagTree(n.clauses[j].condition, blk);
            if(Array.isArray(n.clauses[j].body)) blockOfList(n.clauses[j].body);
          } }
        }
        function blockOfList(list){ for(var i=0;i<list.length;i++) tagTree(list[i], list); }
        blockOfList(ast.body);
        return m;
      })();
      function sameBlkBefore(a, b){
        var la=blkOf.get(a), lb=blkOf.get(b);
        return la!=null && la===lb && a.range[0] < b.range[0];
      }
      // 别名感知：与 canonical 相同的排除集合（byName/member/string/factor/prefix/chain/transparent）
      var aliasB=new Set();
      if(aliasMap){
        ['byName','memberByLocal','stringAliasByLocal','prefixFoldByLocal','chainAliasByLocal','transparentAliases'].forEach(function(tbl){
          var t=aliasMap[tbl];
          if(t) for(var k in t) if(Object.prototype.hasOwnProperty.call(t,k)) aliasB.add(k);
        });
        (aliasMap.factorLocals||[]).forEach(function(n){ aliasB.add(n); });
      }
      function isAliasNm(nm){ return aliasB.has(nm); }
      // binding → 以其为赋值目标的语句集合（区分"定义性赋值"与"重新赋值"）
      var assignedStmts=new Map();
      function markAssigned(node){
        if(!node||typeof node!=='object')return;
        if(Array.isArray(node)){for(var i=0;i<node.length;i++)markAssigned(node[i]);return;}
        if(node.type==='AssignmentStatement'&&node.variables){
          for(var i=0;i<node.variables.length;i++){
            var t=node.variables[i];
            if(t&&t.type==='Identifier'){
              var bb=info.varOf.get(t);
              if(bb){ if(!assignedStmts.has(bb)) assignedStmts.set(bb, new Set()); assignedStmts.get(bb).add(node); }
            }
          }
        }
        for(var k in node){if(k==='range'||k==='loc'||k==='parent'||k==='scope')continue;if(Object.prototype.hasOwnProperty.call(node,k))markAssigned(node[k]);}
      }
      markAssigned(ast.body);
      // 可移动纯表达式：不含调用/全局/变参；标识符必须解析为局部
      function movable(node){
        if(!node||typeof node!=='object') return false;
        switch(node.type){
          case 'NumericLiteral': case 'StringLiteral': case 'BooleanLiteral': case 'NilLiteral': return true;
          case 'Identifier': {
            if(!(info.varOf.get(node)!==null && info.varOf.get(node)!==undefined)) return false;
            if(!aliasB.has(node.name)) return true;
            // 字符串值别名的读 ≡ 字符串字面量（与 canonical 归一同规则）
            if(aliasMap && aliasMap.stringAliasByLocal && Object.prototype.hasOwnProperty.call(aliasMap.stringAliasByLocal, node.name)) return true;
            if(aliasMap && aliasMap.memberByLocal && Object.prototype.hasOwnProperty.call(aliasMap.memberByLocal, node.name)) return true;
            if(aliasMap && aliasMap.prefixFoldByLocal && Object.prototype.hasOwnProperty.call(aliasMap.prefixFoldByLocal, node.name)) return true;
            if(aliasMap && (aliasMap.factorLocals||[]).indexOf(node.name)>=0) return true;
            return false;
          }
          case 'UnaryExpression': return movable(node.argument);
          case 'BinaryExpression': case 'LogicalExpression': return movable(node.left)&&movable(node.right);
          case 'MemberExpression': return movable(node.base);   // identifier 是字段名，不求值
          case 'IndexExpression': return movable(node.base)&&movable(node.index);
          case 'TableConstructorExpression':
            for(var i=0;i<node.fields.length;i++){
              var f=node.fields[i];
              if(f.type==='TableKey'){ if(!movable(f.key)||!movable(f.value)) return false; }
              else if(f.type==='TableKeyString'||f.type==='TableValue'){ if(!movable(f.value)) return false; }
            }
            return true;
          default: return false;
        }
      }
      // RHS 引用集合（varOf 解析为局部的标识符 binding）
      function rhsRefBindings(node){
        var set=new Set();
        (function scan(n){
          if(!n||typeof n!=='object')return;
          if(Array.isArray(n)){for(var i=0;i<n.length;i++)scan(n[i]);return;}
          if(n.type==='Identifier'){
            var rb=info.varOf.get(n);
            if(rb) set.add(rb);
            return;
          }
          for(var k in n){ if(k==='range'||k==='loc')continue; if(Object.prototype.hasOwnProperty.call(n,k)) scan(n[k]); }
        })(node);
        return set;
      }
      // 声明/赋值与使用之间，RHS 引用变量不得被重新赋值（否则代入的是变化后的值）：
      // 2026-10-14 字节解包误编译——al=a%256 的读被跨过 a=a//256 重赋值内联到使用点。
      function reassignedBetween(rhsNode, fromStmt, useNode){
        var refs=rhsRefBindings(rhsNode);
        if(!refs.size) return false;
        var lo=fromStmt.range[1], hi=useNode.range[0];
        for(var rb of refs){
          var asg=assignedStmts.get(rb);
          if(!asg) continue;
          for(var st of asg){
            if(st!==fromStmt && st.range[0]>=lo && st.range[1]<=hi) return true;
          }
        }
        return false;
      }
      // declLoc: binding → {stmt, idx}（声明符所在 LocalStatement 槽位，变量与 init 对齐）。
      // declAnyLoc: 同映射击到不对齐声明（init 长度单独记录，供 nil 填充槽联动删除）。
      // 递归遍历所有块——控制台代码的局部几乎都藏在回调/函数体里，只扫顶层会整批漏掉。
      var declLoc=new Map(), declAnyLoc=new Map();
      (function scanDecl(n){
        if(!n||typeof n!=='object')return;
        if(Array.isArray(n)){
          for(var i=0;i<n.length;i++){
            var it=n[i];
            if(it && it.type==='LocalStatement' && it.variables){
              var aligned=it.init && it.variables.length===it.init.length;
              for(var j=0;j<it.variables.length;j++){
                var vb=it.variables[j];
                if(vb && vb.type==='Identifier'){
                  var bb=info.varOf.get(vb);
                  if(bb){
                    declAnyLoc.set(bb, {stmt:it, idx:j});
                    if(aligned) declLoc.set(bb, {stmt:it, idx:j});
                  }
                }
              }
            }
            scanDecl(it);
          }
          return;
        }
        for(var k in n){ if(k==='range'||k==='loc')continue; if(Object.prototype.hasOwnProperty.call(n,k)) scanDecl(n[k]); }
      })(ast.body);

      var cands=[];
      info.bindings.forEach(function(b){
        if(b.decls.length!==1) return;
        // 字符串值别名（string/member 别名局部）不跳过：单读时代入其【恢复后的字面量】，
        // 与 canonical 的 detectLit 归一（715 行索引位点形式还原）收敛到同一范式——
        // 消除"别名出处不同导致两遍代入判定不同"的幂等裂缝。其余别名（byName/
        // transparent/chain/factor/prefix）维持排除。
        var aliasVal=(aliasMap && ((aliasMap.stringAliasByLocal&&Object.prototype.hasOwnProperty.call(aliasMap.stringAliasByLocal,b.name)&&aliasMap.stringAliasByLocal[b.name])
                                   ||(aliasMap.memberByLocal&&Object.prototype.hasOwnProperty.call(aliasMap.memberByLocal,b.name)&&aliasMap.memberByLocal[b.name])))||null;
        var asg=assignedStmts.get(b);
        var asgTarget=null, asgIdx=-1;
        if(asg){
          if(asg.size!==1) return;               // 多次赋值 → 保守跳过
          var as=asg.values().next().value;
          if(as.init.length!==as.variables.length) return;   // 目标与值须对位
          for(var qi=0; qi<as.variables.length; qi++){
            var qv=as.variables[qi];
            if(qv && qv.type==='Identifier' && info.varOf.get(qv)===b){ asgIdx=qi; asgTarget=qv; break; }
          }
          if(!asgTarget) return;
        }
        // 读点 = uses 减去定义性赋值目标（analyze 把赋值目标也计入 uses）
        var reads=b.uses.filter(function(u){ return u!==asgTarget; });
        if(reads.length!==1) return;
        var use=reads[0];
        if(!use.range) return;
        if(aliasVal!==null){
          // 字符串值别名候选：代入【恢复后的字面量】（与 canonical 的 detectLit 归一
          // 收敛同范式），声明槽经槽位合并删除。仅限单读。
          var aloc=declLoc.get(b);
          if(!aloc) return;
          if(use.range[0] < aloc.stmt.range[1]) return;
          var vt=canSingleQuote(aliasVal)?("'"+aliasVal+"'"):('"'+aliasVal+'"');
          cands.push({valueNode:null, valueText:vt, delStmt:aloc.stmt, delSlot:true, delIdx:aloc.idx, use:use, declDrop:null});
          return;
        }
        var valueNode=null, delStmt=null, delSlot=false, delIdx=-1;
        if(asg){
          // 拆分赋值形态：值来源是该目标在唯一赋值句里的对应值（多目标逐位）。
          // 必须有 LocalStatement 声明（形参是压缩器的 scratch 惯用法，禁止代入）。
          var as2=asg.values().next().value;
          if(!declAnyLoc.get(b)) return;
          if(!sameBlkBefore(as2, use)) return;   // 支配+作用域：赋值句与使用点须同块且在前
          if(reassignedBetween(as2.init[asgIdx], as2, use)) return;   // RHS 引用在使用前不得被改赋值
          valueNode=as2.init[asgIdx]; delStmt=as2;
          delSlot=true; delIdx=asgIdx;   // 走槽位合并：从赋值句中成对删除该目标/值
        }else{
          // 声明即赋值形态：值来源是声明槽位的 init
          var loc=declLoc.get(b);
          if(!loc) return;
          valueNode=loc.stmt.init[loc.idx]; delStmt=loc.stmt;
          delSlot=loc.stmt.variables.length>1; delIdx=loc.idx;
          // RHS 不得引用同语句其他变量（避免槽位删除后引用悬空/前向 nil 语义变化）
          var refsOther=false;
          (function scanRefs(n){
            if(refsOther||!n||typeof n!=='object')return;
            if(Array.isArray(n)){for(var i=0;i<n.length;i++)scanRefs(n[i]);return;}
            if(n.type==='Identifier'){
              var rb=info.varOf.get(n);
              if(rb && rb!==b && delStmt.variables.some(function(v){return info.varOf.get(v)===rb;})) refsOther=true;
              return;
            }
            for(var k in n){ if(k==='range'||k==='loc')continue; if(Object.prototype.hasOwnProperty.call(n,k)) scanRefs(n[k]); }
          })(valueNode);
          if(refsOther) return;
        }
        if(!valueNode || !valueNode.range || !movable(valueNode)) return;
        if(use.range[0] < delStmt.range[1]) return;  // 使用须在赋值之后
        if(reassignedBetween(valueNode, delStmt, use)) return;  // RHS 引用在使用前不得被改赋值
        // 拆分赋值路径：声明句里的 w 槽（nil 填充）联动删除（如 local p,w=f() 删成 local p=f()）
        var declDrop=null;
        if(asg){
          var dl=declAnyLoc.get(b);
          if(dl && dl.stmt!==delStmt && dl.idx>=(dl.stmt.init?dl.stmt.init.length:0)){
            declDrop=dl;   // 仅 nil 填充槽（idx 超出 init 列表）——删除不影响任何求值
          }
        }
        cands.push({valueNode:valueNode, delStmt:delStmt, delSlot:delSlot, delIdx:delIdx, use:use, declDrop:declDrop});
      });
      // 候选间冲突：使用点落在其他候选删除语句内 → 被包含方让位
      cands=cands.filter(function(c){
        return !cands.some(function(o){
          return o!==c && o.delStmt.range[0]<=c.use.range[0] && c.use.range[1]<=o.delStmt.range[1];
        });
      });
      return {src:src, cands:cands};
    }

    function inlinePureEdits(ctx){
      var src=ctx.src, cands=ctx.cands, edits=[];
      // 同一声明句内的【所有】槽删除（delSlot 声明槽 + declDrop 联动槽）按句合并成对
      // 重写，避免相邻槽位的删除区间相互重叠（applyEdits 重叠即抛"调用方 bug"）。
      var slotGroups=new Map();   // stmt → Set(idx)
      function addDrop(stmt, idx){
        if(!slotGroups.has(stmt)) slotGroups.set(stmt, new Set());
        slotGroups.get(stmt).add(idx);
      }
      cands.forEach(function(c){
        if(c.delSlot) addDrop(c.delStmt, c.delIdx);
        if(c.declDrop) addDrop(c.declDrop.stmt, c.declDrop.idx);   // 与 delSlot 独立（asg 候选两者皆有）
      });
      slotGroups.forEach(function(dropIdx, stmt){
        var vv=stmt.variables, ii=stmt.init||[];
        if(dropIdx.size>=vv.length){
          // 全槽均为候选（init 纯且已代入使用点）→ 整条声明删除
          edits.push({start:stmt.range[0], end:stmt.range[1], name:''});
          return;
        }
        var newVars=[], newInits=[];
        for(var k=0;k<vv.length;k++){
          if(dropIdx.has(k)) continue;
          newVars.push(src.slice(vv[k].range[0], vv[k].range[1]));
          newInits.push(k<ii.length ? src.slice(ii[k].range[0], ii[k].range[1]) : null);  // null = nil 填充槽
        }
        // 尾部 nil 填充槽可省略（Lua 自动补 nil）；中间的必须显式 nil 以保持对位。
        // 项目惯例（README §3.3）视不对齐尾部槽为 nil，与 fwd-lit 归一一致。
        while(newInits.length && newInits[newInits.length-1]===null) newInits.pop();
        edits.push({start:vv[0].range[0], end:vv[vv.length-1].range[1], name:newVars.join(',')});
        if(ii.length){
          var initTxt=newInits.map(function(v){ return v===null?'nil':v; }).join(',');
          // 分隔守卫：原 init 若以符号收尾（如 }），替换值以字母收尾时，紧跟的关键字
          // 会与之融合成非法 token——按 needsSepAfter 补空格。
          var afterPos=ii[ii.length-1].range[1];
          var nx2=(afterPos<src.length)?src[afterPos]:undefined;
          if(initTxt && needsSepAfter(initTxt[initTxt.length-1], nx2)) initTxt+=' ';
          edits.push({start:ii[0].range[0], end:afterPos, name:initTxt});
        }
      });
      cands.forEach(function(c){
        // 赋值句删除（declDrop 路径的赋值句；delSlot 路径无独立赋值句）
        if(!c.delSlot) edits.push({start:c.delStmt.range[0], end:c.delStmt.range[1], name:''});
        var rhsText=c.valueText || src.slice(c.valueNode.range[0], c.valueNode.range[1]);
        // 索引位使用点且值为标识符安全字符串 → 直接写成点访问（与 canonical 的
        // detectLit 归一（715 行索引位还原 normAccess）收敛同范式，避免括号形态残留）
        var bare=null;
        var mQ=/^['"]([A-Za-z_][A-Za-z0-9_]*)['"]$/.exec(rhsText);
        if(mQ) bare=mQ[1];
        var u0=c.use.range[0], u1=c.use.range[1];
        var bracketed=(u0>0 && src[u0-1]==='[' && u1<src.length && src[u1]===']');
        if(bare && bracketed){
          var dotRepl='.'+bare;
          var nxD=(u1+1<src.length)?src[u1+1]:undefined;
          if(needsSepAfter(bare[bare.length-1], nxD)) dotRepl+=' ';
          edits.push({start:u0-1, end:u1+1, name:dotRepl});
          return;
        }
        var repl='('+rhsText+')';   // 代入一律加括号保优先级
        var nx=(u1<src.length)?src[u1]:undefined;
        if(needsSepAfter(')', nx)) repl+=' ';
        edits.push({start:u0, end:u1, name:repl});
      });
      return edits;
    }

    // 纯代入归一：把"单用纯局部"重写理论应用到不动点（本 fold 专用等价验证的预处理）
    function normPureCopyProp(src, aliasMap){
      var cur=src;
      for(var pass=0; pass<4; pass++){
        var ctx=inlinePureAnalyze(cur, aliasMap);
        if(!ctx || !ctx.cands.length) break;
        var edits=inlinePureEdits(ctx);
        if(!edits.length) break;
        var nxt=applyEdits(cur, edits);
        if(nxt===cur) break;
        cur=nxt;
      }
      return cur;
    }

    C.preprocess=preprocess; C.applyEdits=applyEdits; C.normPureCopyProp=normPureCopyProp;
  }};
  root.__LuaMin2Modules = root.__LuaMin2Modules || {};
  root.__LuaMin2Modules[part.name] = part;
  if(typeof module !== 'undefined' && module.exports) module.exports = part;
})(typeof window !== 'undefined' ? window : globalThis);
