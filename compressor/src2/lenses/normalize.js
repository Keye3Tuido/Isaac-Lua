/* ===================================================================
 * LuaMin v2 lens family: normalize — 改写透镜族（M3）
 * 移植 v1 src/folds.js 的局部归一 pass（阶段 1.1b–1.1h + ifNot + splitMultiAssign），
 * 每枚透镜 = 单点候选发现（match）+ 文本编辑（extract）+ 精确成本（cost 预演）。
 *
 * inject 方向说明：本族改写大多【语义单向】——常量折叠、parens 消除等的逆改写
 * 不产生压缩收益且目标形态不唯一，故 inject 一律返回 null（文档化的一方向透镜，
 * 见计划 §3 verify 条款）；verify 走默认 canonical 前向等价（mkVerifyDefault：
 * 无 aliasEntries 时即 canonicalKey(ir) === canonicalKey(产物)），
 * 各改写形态在 v1 canonical 均有对应归一规则（见各透镜注释），故性质成立。
 * 例外：bracketDot 有真实逆（.x → ['x']），实现了双向。
 *
 * requires/provides 诚实登记：查绑定事实（ssa）的透镜声明 requires:['ssa']；
 * boolNil 产生字面量别名，provides:['alias:literal']；纯句法改写 requires:[]。
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
  function needIR(deps){ var m=(deps&&deps.ir)||irMod; if(!m) throw new Error('normalize.js: 需要 src2/ir.js'); return m; }

  /* ---------- 共享小工具 ---------- */

  // walkAst(node, visit)：通用 AST 先序遍历（跳过 range/loc 元数据）
  function walkAst(node, visit){
    if(!node || typeof node !== 'object') return;
    if(Array.isArray(node)){ for(var i=0;i<node.length;i++) walkAst(node[i], visit); return; }
    if(visit(node) === false) return;   // visit 返回 false = 不再深入（已整体处理该子树）
    for(var k in node){
      if(k === 'range' || k === 'loc') continue;
      if(Object.prototype.hasOwnProperty.call(node, k)) walkAst(node[k], visit);
    }
  }

  // preview(ir, edits, deps)：成本预演 = 文本编辑 + encodeDelta（不重建 IR，恒等于实测）
  function preview(ir, edits, deps){
    var IR = needIR(deps);
    return lensMod.encodeDelta(ir.src, IR.applyTextEdits(ir.src, edits), deps);
  }

  // oneWayInject()：单向透镜的 inject 占位——返回 null 并注明语义原因（见文件头）
  function oneWayInject(){ return null; }

  // isNamePart 局部副本（core.js 未导出；纯字符判定，复制以避免发明新口径）
  function isNamePart(c){ return !!c && (/[A-Za-z0-9_]/).test(c); }

  /* ---------- norm.bracketDot：obj['Field'] → obj.Field ----------
   * 仅当 index 是无转义标识符样字符串字面量；关键字字段保留括号（obj['end'] 合法）。
   * canonical normAccess 归一 obj['F'] ≡ obj.F（canonical.js:853），默认 verify 覆盖。 */
  function createBracketDotLens(deps){
    var KEYWORDS = root.LuaMin ? root.LuaMin.KEYWORDS : {};
    return {
      name: 'norm.bracketDot', kind: 'rewrite',
      requires: [], provides: [], consumes: [], conflicts: [],
      match: function(ir){
        var out = [];
        walkAst(ir.ast.body, function(n){
          if(n.type === 'IndexExpression' && n.index && n.index.type === 'StringLiteral'
             && n.base && n.base.range && n.range){
            var m = /^(['"])([A-Za-z_][A-Za-z0-9_]*)\1$/.exec(n.index.raw || '');
            if(m && !KEYWORDS[m[2]]){
              out.push({ id: 'bracketDot@' + n.range[0], field: m[2],
                _edits: [{ start: n.base.range[1], end: n.range[1], text: '.' + m[2] }] });
            }
          }
        });
        return out;
      },
      cost: function(ir, cand){ return { delta: preview(ir, cand._edits, deps), confidence: 'exact' }; },
      extract: function(ir, cand){ return { edits: cand._edits, form: {}, residue: {} }; },
      // 真实逆方向：.Field → ['Field']（搜索层 inv 步可撤销过度 bracketDot）
      inject: function(ir, dotSite){
        var out = null;
        walkAst(ir.ast.body, function(n){
          if(out) return false;
          if(n.type === 'MemberExpression' && n.indexer === '.' && n.base && n.base.range && n.range
             && n.identifier && n.identifier.name === dotSite){
            out = { edits: [{ start: n.base.range[1], end: n.range[1], text: "['" + n.identifier.name + "']" }], form: {}, residue: {} };
            return false;
          }
        });
        return out;
      }
    };
  }

  /* ---------- norm.readonlyInline：只读字面量局部内联（负优化别名拆回） ----------
   * 移植 foldReadonlyInline：顶层单变量单值声明、SSA 单版本（只读）、未捕获；
   * uses*(litLen-1) < litLen+9 才内联（v1 公式逐字）；uses===0 的纯 init 只删声明。
   * canonical 对字面量单用归一（detectLit/纯代入归一）覆盖等价。 */
  function createReadonlyInlineLens(deps){
    function isPureExpr(node){
      if(!node || typeof node !== 'object') return false;
      switch(node.type){
        case 'NumericLiteral': case 'StringLiteral': case 'BooleanLiteral': case 'NilLiteral': return true;
        case 'TableConstructorExpression':
          for(var i=0;i<node.fields.length;i++){
            var f = node.fields[i];
            if(f.type === 'TableKey'){ if(!isPureExpr(f.key) || !isPureExpr(f.value)) return false; }
            else if(f.type === 'TableKeyString' || f.type === 'TableValue'){ if(!isPureExpr(f.value)) return false; }
          }
          return true;
        default: return false;
      }
    }
    return {
      name: 'norm.readonlyInline', kind: 'rewrite',
      requires: ['ssa'], provides: [], consumes: [], conflicts: [],
      match: function(ir){
        var src = ir.src, info = ir.info, out = [];
        for(var si=0; si<ir.ast.body.length; si++){
          var st = ir.ast.body[si];
          if(st.type !== 'LocalStatement' || !st.variables) continue;
          // 多变量全无使用的纯声明删除（uses===0 死代码消除）：local a,b,c=1 → ''
          // 条件：全部变量无使用/未捕获/SSA 单版本；全部显式 init 为纯表达式（无副作用，
          // f() 等调用 init 不删）；隐式 nil（少值/无 init 声明）天然纯。
          // 实证：local a,b,c=1 与 local a=1（原单变量路径已消）应同口径为空。
          var initLen = st.init ? st.init.length : 0;
          if(st.variables.length > 1 || initLen !== 1){
            var deadOk = true;
            for(var vi=0; vi<st.variables.length; vi++){
              var dv = st.variables[vi];
              if(dv.type !== 'Identifier'){ deadOk = false; break; }
              var db = info.varOf.get(dv);
              if(!db || db.decls.length !== 1 || db.captured || db.uses.length !== 0){ deadOk = false; break; }
              var dEntry = ir.ssa.byBinding.get(db);
              if(!dEntry || dEntry.versions.length !== 1){ deadOk = false; break; }
            }
            if(deadOk && st.init){
              for(var di=0; di<st.init.length; di++){
                if(!isPureExpr(st.init[di])){ deadOk = false; break; }
              }
            }
            if(deadOk){
              out.push({ id: 'roInline:deadDecl@' + st.range[0],
                _edits: [{ start: st.range[0], end: st.range[1], text: '' }] });
              continue;
            }
          }
          if(!st.init) continue;
          if(st.variables.length !== 1 || st.init.length !== 1) continue;
          var v = st.variables[0], ie = st.init[0];
          if(v.type !== 'Identifier' || !ie || !ie.range) continue;
          var b = info.varOf.get(v);
          if(!b || b.decls.length !== 1 || b.captured) continue;
          var entry = ir.ssa.byBinding.get(b);
          if(!entry || entry.versions.length !== 1) continue;   // 只读（SSA 证据）
          var T = ie.type;
          var isLiteral = (T === 'NumericLiteral' || T === 'StringLiteral' || T === 'BooleanLiteral');
          if(!isLiteral && !isPureExpr(ie)) continue;
          var lit = src.slice(ie.range[0], ie.range[1]);
          var uses = b.uses.length, litLen = lit.length;
          var edits = [{ start: st.range[0], end: st.range[1], text: '' }];
          if(uses === 0){
            out.push({ id: 'roInline:' + v.name + '@' + st.range[0], _edits: edits });
            continue;
          }
          if(!isLiteral) continue;   // 纯但非字面量：仅删不用，不内联
          if(uses * (litLen-1) >= litLen + 9) continue;          // v1 盈亏闸门
          b.uses.forEach(function(u){
            var nx = (u.range[1] < src.length) ? src[u.range[1]] : undefined;
            var spacer = ir._base._needsSepAfter(lit[lit.length-1], nx) ? ' ' : '';
            edits.push({ start: u.range[0], end: u.range[1], text: lit + spacer });
          });
          out.push({ id: 'roInline:' + v.name + '@' + st.range[0], _edits: edits });
        }
        return out;
      },
      cost: function(ir, cand){ return { delta: preview(ir, cand._edits, deps), confidence: 'exact' }; },
      extract: function(ir, cand){ return { edits: cand._edits, form: {}, residue: {} }; },
      inject: oneWayInject   // 单向：内联的逆 = 重新提取别名，由 alias/factor 族负责（M2/M4）
    };
  }

  /* ---------- norm.constFold：常量折叠（1+2*3→7、'a'..'b'→'ab'、not true→false） ----------
   * evalConst/fmt 逐字移植 foldConstant；canonical 常量折叠归一（litConst）覆盖等价。 */
  function createConstFoldLens(deps){
    function evalConst(n){
      if(!n || typeof n !== 'object') return null;
      if(n.type === 'NumericLiteral'){
        var raw = n.raw || '';
        if(/^[+-]?\d+$/.test(raw)) return { kind:'int', v:parseInt(raw,10) };
        if(/^0[xX][0-9a-fA-F]+$/.test(raw)) return { kind:'int', v:parseInt(raw,16) };
        return null;
      }
      if(n.type === 'StringLiteral'){
        var sraw = n.raw || '';
        if(sraw.length >= 2 && sraw[0] === "'" && sraw[sraw.length-1] === "'") return { kind:'str', v:sraw.slice(1,-1) };
        return null;
      }
      if(n.type === 'BinaryExpression'){
        var L = evalConst(n.left), R = evalConst(n.right);
        if(L && R){
          if(n.operator === '..' && L.kind === 'str' && R.kind === 'str') return { kind:'str', v:L.v+R.v };
          if(L.kind === 'int' && R.kind === 'int'){
            var r;
            if(n.operator === '+') r = L.v+R.v;
            else if(n.operator === '-') r = L.v-R.v;
            else if(n.operator === '*') r = L.v*R.v;
            else return null;
            if(Number.isInteger(r) && Math.abs(r) <= 9007199254740991) return { kind:'int', v:r };
          }
        }
        return null;
      }
      return null;
    }
    function fmt(v, ir){
      if(v.kind === 'int') return String(v.v);
      if(v.kind === 'str'){
        if(!ir._base._canSingleQuote(v.v)) return null;
        return "'" + v.v + "'";
      }
      return null;
    }
    return {
      name: 'norm.constFold', kind: 'rewrite',
      requires: [], provides: [], consumes: [], conflicts: [],
      match: function(ir){
        var out = [];
        walkAst(ir.ast.body, function(n){
          if(n.type === 'BinaryExpression' && n.range){
            var v = evalConst(n);
            if(v){
              var rep = fmt(v, ir);
              if(rep !== null && rep.length < n.range[1]-n.range[0]){
                out.push({ id:'constFold@'+n.range[0],
                  _edits:[{ start:n.range[0], end:n.range[1], text:rep }] });
                return false;   // 外层已折叠，不递归子表达式（防重叠候选）
              }
            }
          }else if(n.type === 'UnaryExpression' && n.operator === 'not' && n.range
                   && n.argument && n.argument.type === 'BooleanLiteral'){
            var rep2 = String(!n.argument.value);
            if(rep2.length < n.range[1]-n.range[0]){
              out.push({ id:'constNot@'+n.range[0],
                _edits:[{ start:n.range[0], end:n.range[1], text:rep2 }] });
            }
          }
        });
        return out;
      },
      cost: function(ir, cand){ return { delta: preview(ir, cand._edits, deps), confidence: 'exact' }; },
      extract: function(ir, cand){ return { edits: cand._edits, form: {}, residue: {} }; },
      inject: oneWayInject   // 单向：常量求值的逆不唯一（7 可拆 1+6/2+5/…），无压缩意义
    };
  }

  /* ---------- norm.constCondition：if <bool> then A else B end → do A end ----------
   * 逐字移植 foldConstCondition；canonical IfStatement 归一覆盖等价。 */
  function createConstConditionLens(deps){
    function branchHasLocals(body){
      for(var i=0;i<body.length;i++){
        var s = body[i], t = s.type;
        if(t === 'LocalStatement' || t === 'ForNumericStatement' || t === 'ForGenericStatement') return true;
        if(t === 'FunctionDeclaration' && s.isLocal) return true;
      }
      return false;
    }
    return {
      name: 'norm.constCondition', kind: 'rewrite',
      requires: [], provides: [], consumes: [], conflicts: [],
      match: function(ir){
        var src = ir.src, out = [];
        walkAst(ir.ast.body, function(n){
          if(n.type === 'IfStatement' && n.clauses && n.clauses.length >= 1 && n.clauses.length <= 2 && n.range){
            var cond = n.clauses[0].condition;
            if(cond && cond.type === 'BooleanLiteral'){
              var body = cond.value ? (n.clauses[0].body||[]) : (n.clauses[1] && n.clauses[1].body ? n.clauses[1].body : []);
              var text;
              if(!body.length) text = '';
              else if(branchHasLocals(body)) text = 'do ' + src.slice(body[0].range[0], body[body.length-1].range[1]) + ' end';
              else text = src.slice(body[0].range[0], body[body.length-1].range[1]);
              out.push({ id:'constCond@'+n.range[0],
                _edits:[{ start:n.range[0], end:n.range[1], text:text }] });
              return false;
            }
          }
        });
        return out;
      },
      cost: function(ir, cand){ return { delta: preview(ir, cand._edits, deps), confidence: 'exact' }; },
      extract: function(ir, cand){ return { edits: cand._edits, form: {}, residue: {} }; },
      inject: oneWayInject   // 单向：分支恢复需重建条件字面量，无压缩意义
    };
  }

  /* ---------- norm.constLoop：while false→删 / while true→while 1 / repeat 常量归一 ----------
   * 逐字移植 foldConstLoop；canonical While/Repeat 常量归一覆盖等价。 */
  function createConstLoopLens(deps){
    function bodyHasLocals(body){
      for(var i=0;i<body.length;i++){
        var t = body[i].type;
        if(t === 'LocalStatement' || t === 'ForNumericStatement' || t === 'ForGenericStatement') return true;
        if(t === 'FunctionDeclaration' && body[i].isLocal) return true;
      }
      return false;
    }
    function hasBreakOrGoto(node){
      var found = false;
      walkAst(node, function(n){
        if(found) return false;
        if(n.type === 'BreakStatement' || n.type === 'GotoStatement'){ found = true; return false; }
      });
      return found;
    }
    return {
      name: 'norm.constLoop', kind: 'rewrite',
      requires: [], provides: [], consumes: [], conflicts: [],
      match: function(ir){
        var src = ir.src, out = [];
        walkAst(ir.ast.body, function(n){
          if(n.type === 'WhileStatement' && n.condition && n.condition.type === 'BooleanLiteral' && !n.condition.value && n.range){
            out.push({ id:'whileFalse@'+n.range[0], _edits:[{ start:n.range[0], end:n.range[1], text:'' }] });
            return false;
          }
          if(n.type === 'WhileStatement' && n.condition && n.condition.type === 'BooleanLiteral' && n.condition.value && n.condition.range){
            out.push({ id:'whileTrue@'+n.range[0],
              _edits:[{ start:n.condition.range[0], end:n.condition.range[1], text:'1' }] });
            return true;   // 体里可能有嵌套循环，继续深入
          }
          if(n.type === 'RepeatStatement' && n.condition && n.condition.type === 'BooleanLiteral' && n.range){
            var body = n.body || [];
            var inner = body.length ? src.slice(body[0].range[0], body[body.length-1].range[1]) : '';
            var text;
            if(n.condition.value){
              if(!body.length) text = '';
              else if(hasBreakOrGoto(body)) return true;   // 展开后 break/goto 目标会变，跳过
              else if(bodyHasLocals(body)) text = 'do ' + inner + ' end';
              else text = inner;
            }else{
              text = 'while 1 do ' + inner + ' end';
            }
            out.push({ id:'repeatConst@'+n.range[0], _edits:[{ start:n.range[0], end:n.range[1], text:text }] });
            return false;
          }
        });
        return out;
      },
      cost: function(ir, cand){ return { delta: preview(ir, cand._edits, deps), confidence: 'exact' }; },
      extract: function(ir, cand){ return { edits: cand._edits, form: {}, residue: {} }; },
      inject: oneWayInject   // 单向：循环条件恢复不唯一
    };
  }

  /* ---------- norm.earlyReturn：if c then return end ×N → if not(c1 or …) then rest end ----------
   * 逐字移植 foldEarlyReturn（函数体 return / 循环体 break 两靶）；
   * canonical normGuardedFunctionBody 归一覆盖等价。 */
  function createEarlyReturnLens(deps){
    function isGuard(st, target){
      if(!(st && st.type === 'IfStatement' && st.clauses && st.clauses.length === 1
         && st.clauses[0].type === 'IfClause'
         && st.clauses[0].body && st.clauses[0].body.length === 1
         && st.clauses[0].condition && st.clauses[0].condition.range)) return false;
      var inner = st.clauses[0].body[0];
      if(target === 'return') return inner.type === 'ReturnStatement' && (!inner.arguments || inner.arguments.length === 0);
      if(target === 'break') return inner.type === 'BreakStatement';
      return false;
    }
    return {
      name: 'norm.earlyReturn', kind: 'rewrite',
      requires: [], provides: [], consumes: [], conflicts: [],
      match: function(ir){
        var src = ir.src, out = [];
        function processBody(body, target){
          if(!body || body.length < 2) return;
          var i = 0;
          while(i < body.length && isGuard(body[i], target)) i++;
          if(i === 0) return;
          var rest = body.slice(i);
          if(!rest.length) return;   // 全是守卫无后续体：不比空更短，跳过
          var conds = [];
          for(var c=0;c<i;c++) conds.push(src.slice(body[c].clauses[0].condition.range[0], body[c].clauses[0].condition.range[1]));
          var inner = src.slice(rest[0].range[0], rest[rest.length-1].range[1]);
          var text = 'if not(' + conds.join(' or ') + ') then ' + inner + ' end';
          out.push({ id:'earlyRet@'+body[0].range[0],
            _edits:[{ start:body[0].range[0], end:rest[rest.length-1].range[1], text:text }] });
        }
        // 主块顶部的 return 守卫同样可折叠（return 直接结束整个块）
        processBody(ir.ast.body, 'return');
        walkAst(ir.ast.body, function(n){
          if(n.type === 'FunctionDeclaration'){ processBody(n.body, 'return'); return true; }
          if(n.type === 'WhileStatement' || n.type === 'RepeatStatement'
             || n.type === 'ForNumericStatement' || n.type === 'ForGenericStatement'){
            processBody(n.body, 'break'); return true;
          }
        });
        return out;
      },
      cost: function(ir, cand){ return { delta: preview(ir, cand._edits, deps), confidence: 'exact' }; },
      extract: function(ir, cand){ return { edits: cand._edits, form: {}, residue: {} }; },
      inject: oneWayInject   // 单向：守卫拆分有多种等价形态
    };
  }

  /* ---------- norm.deMorgan：not X or not Y → not(X and Y) ----------
   * 逐字移植 foldDeMorgan；canonical 德摩根归一覆盖等价。 */
  function createDeMorganLens(deps){
    return {
      name: 'norm.deMorgan', kind: 'rewrite',
      requires: [], provides: [], consumes: [], conflicts: [],
      match: function(ir){
        var src = ir.src, out = [];
        function operandText(op){
          var t = src.slice(op.range[0], op.range[1]);
          if(op.type === 'LogicalExpression') t = '(' + t + ')';   // 防优先级错误
          return t;
        }
        walkAst(ir.ast.body, function(n){
          if(n.type === 'LogicalExpression' && (n.operator === 'or' || n.operator === 'and')
             && n.left && n.left.type === 'UnaryExpression' && n.left.operator === 'not'
             && n.right && n.right.type === 'UnaryExpression' && n.right.operator === 'not'
             && n.range && n.left.range && n.right.range && n.left.argument && n.left.argument.range
             && n.right.argument && n.right.argument.range){
            var flip = (n.operator === 'or') ? 'and' : 'or';
            var text = 'not(' + operandText(n.left.argument) + ' ' + flip + ' ' + operandText(n.right.argument) + ')';
            if(text.length < n.range[1]-n.range[0]){
              out.push({ id:'deMorgan@'+n.range[0],
                _edits:[{ start:n.range[0], end:n.range[1], text:text }] });
              return false;
            }
          }
        });
        return out;
      },
      cost: function(ir, cand){ return { delta: preview(ir, cand._edits, deps), confidence: 'exact' }; },
      extract: function(ir, cand){ return { edits: cand._edits, form: {}, residue: {} }; },
      inject: oneWayInject   // 单向：not 分配回双分支无压缩收益
    };
  }

  /* ---------- norm.inlineValue：单用邻接代入（local B=E <紧邻语句单读 B> → 读点代入 (E)） ----------
   * RHS 允许含调用/全局（求值时机不变：定义句与读点语句相邻、读点不穿函数边界）；
   * 判定直接复用 canonical2.collectSingleUseInlines（与 canonical 归一层 normSingleUseAdjacent
   * 同一份逻辑，零分叉），verify 走 equivalent——其兜底 normSingleUseAdjacent 正是本形态的
   * 双侧归一，故 `local p=Var+func() print(p)` → `print((Var+func()))` 可被严格验证。 */
  function createInlineValueLens(deps){
    return {
      name: 'norm.inlineValue', kind: 'rewrite',
      requires: ['ssa'], provides: [], consumes: [], conflicts: [],
      match: function(ir){
        if(!canonMod || !canonMod.collectSingleUseInlines) return [];
        // 排除函数声明 RHS：单用局部函数不内联成 IIFE（(function..end)()），交由函数类
        // 既有优化（hoist.funcMerge 等）处理——本透镜聚焦「含调用/全局的值表达式」单用内联。
        return canonMod.collectSingleUseInlines(ir, function(rhs){ return rhs.type !== 'FunctionDeclaration'; })
          .map(function(c){ return { id: c.key, _edits: c.edits }; });
      },
      cost: function(ir, cand){ return { delta: preview(ir, cand._edits, deps), confidence: 'exact' }; },
      extract: function(ir, cand){ return { edits: cand._edits, form: {}, residue: {} }; },
      inject: oneWayInject,   // 单向：拆回声明形态不唯一
      verify: function(ir, cand, result){
        try{ return !!canonMod.equivalent(ir.src, result.ir.src, deps, ir, result.ir, {pureInline:true}); }
        catch(e){ return false; }
      }
    };
  }

  /* ---------- norm.notCompare：not(X == Y) → X ~= Y（反向同） ----------
   * 比较取反消 not：== ↔ ~=（Lua 语言层定义 ~= 为 not (a==b)，含 __eq 元方法亦严格等价）。
   * 大小比较 < <= > >= 不纳入：__lt/__le 元方法可不一致，not(a<b) 与 a>=b 不严格等价。
   * canonical not-比较归一覆盖等价。 */
  function createNotCompareLens(deps){
    var CMP_INV = { '==':'~=', '~=':'==' };
    var CMP_PRIORITY = 3;   // BIN_PRIORITY 比较档位：操作数优先级 ≤3 时包括号防粘连/链式比较
    function wrapOperand(node, src){
      var t = src.slice(node.range[0], node.range[1]);
      if(node.type === 'BinaryExpression' || node.type === 'LogicalExpression'){
        if(exprPriority(node) <= CMP_PRIORITY || node.type === 'LogicalExpression') return '(' + t + ')';
      }
      return t;
    }
    return {
      name: 'norm.notCompare', kind: 'rewrite',
      requires: [], provides: [], consumes: [], conflicts: [],
      match: function(ir){
        var src = ir.src, out = [];
        walkAst(ir.ast.body, function(n){
          if(n.type === 'UnaryExpression' && n.operator === 'not' && n.range
             && n.argument && n.argument.type === 'BinaryExpression'
             && CMP_INV[n.argument.operator] && n.argument.left && n.argument.left.range
             && n.argument.right && n.argument.right.range){
            var a = n.argument;
            var text = wrapOperand(a.left, src) + CMP_INV[a.operator] + wrapOperand(a.right, src);
            if(text.length < n.range[1]-n.range[0]){
              out.push({ id:'notCompare@'+n.range[0],
                _edits:[{ start:n.range[0], end:n.range[1], text:text }] });
              return false;
            }
          }
        });
        return out;
      },
      cost: function(ir, cand){ return { delta: preview(ir, cand._edits, deps), confidence: 'exact' }; },
      extract: function(ir, cand){ return { edits: cand._edits, form: {}, residue: {} }; },
      inject: oneWayInject   // 单向：加 not 回比较无压缩收益
    };
  }

  /* ---------- norm.tableFields：local M={} M.X=v … → local M={X=v,…} ----------
   * 逐字移植 foldTableFields（仅顶层紧邻声明；字段值不得引用 M）；
   * canonical mergeTableFields 归一覆盖等价。
   * 推广到多名 local（v2 调度序实证必需：localsMerge/mkAliasDecl 拓扑序先于本透镜，
   * `local stage={}` 会被合进多名批——luacheck detect_reversed 系 +6 根因），两种形态：
   *   A. 并入（无兄弟引用、无代值成本）：空表 init 须处【末位值槽】（求值序不变）；
   *      字段值引用同句兄弟名时按别名条目【按名代值】（字面量/链/字——编译期常量）。
   *   B. 拆句（有兄弟引用）：把表变量从批内拆出独立 local（置于被删字段区末尾、
   *      占位赋值之后）——兄弟名在新语句中已绑定，免代值成本与 init 未绑定捕获隐患
   *      （实证 sqlite/utils 巨型批内 M.if_nil 族：代值 +40 反超并入收益 +28）。
   * 两形态间穿插的【同句占位赋值】（批内 nil 槽的 `u=g"luv"` 类 hoist 产物）允许跳过：
   * 纯占位移动，字段值若含即时调用则要求全在占位赋值之后求值（拆句形态恒满足）。 */
  function createTableFieldsLens(deps){
    // siblingRefs(valNode, siblingsSet, varOf) -> bool：值内是否引用同句兄弟名
    function siblingRefs(valNode, siblingsSet, varOf){
      var found = false;
      walkAst(valNode, function(x){
        if(found) return false;
        if(x.type === 'Identifier' && varOf.has(x)){
          var b = varOf.get(x);
          if(b && siblingsSet.has(b)){ found = true; return false; }
        }
      });
      return found;
    }
    return {
      name: 'norm.tableFields', kind: 'rewrite',
      requires: ['ssa'], provides: ['tableFields'], consumes: [], conflicts: [],
      match: function(ir){
        var src = ir.src, varOf = ir.info.varOf, out = [];
        function refsBinding(n, b){
          var found = false;
          walkAst(n, function(x){
            if(found) return false;
            if(x.type === 'Identifier' && varOf.has(x) && varOf.get(x) === b){ found = true; return false; }
          });
          return found;
        }
        function hasCallExpr(node){
          var found = false;
          walkAst(node, function(x){
            if(found) return false;
            if(x.type === 'FunctionDeclaration') return false;   // 函数体求值延后（创建闭包本身无副作用）
            if(x.type === 'CallExpression' || x.type === 'StringCallExpression'
               || x.type === 'TableCallExpression'){ found = true; return false; }
          });
          return found;
        }
        var body = ir.ast.body;
        for(var si=0; si<body.length; si++){
          var st = body[si];
          if(st.type !== 'LocalStatement' || !st.variables || !st.init) continue;
          for(var vi=0; vi<st.variables.length; vi++){
            var mv = st.variables[vi];
            if(mv.type !== 'Identifier' || !mv.range || !varOf.has(mv)) continue;
            if(vi >= st.init.length) continue;
            var init = st.init[vi];
            if(!init || init.type !== 'TableConstructorExpression' || (init.fields && init.fields.length)) continue;
            var mB = varOf.get(mv);
            var siblings = new Set(), stVars = new Set();
            st.variables.forEach(function(v2){
              if(v2.type !== 'Identifier' || !varOf.has(v2)) return;
              stVars.add(varOf.get(v2));
              if(v2 !== mv) siblings.add(varOf.get(v2));
            });
            // 字段与占位赋值扫描：M.X=v 为字段；目标全属本 local 声明 binding 的赋值为占位赋值
            var fields = [], artifacts = [], anySibRef = false;
            var j = si+1;
            while(j < body.length){
              var as = body[j];
              if(as.type !== 'AssignmentStatement' || !as.variables || !as.init
                 || as.init.length !== as.variables.length) break;
              var isField = false;
              if(as.variables.length === 1){
                var tgt = as.variables[0];
                if(tgt.type === 'MemberExpression' && tgt.indexer === '.' && tgt.base && tgt.base.type === 'Identifier'
                   && tgt.identifier && tgt.identifier.range && tgt.base.range
                   && varOf.has(tgt.base) && varOf.get(tgt.base) === mB
                   && as.init[0] && as.init[0].range
                   && !refsBinding(as.init[0], mB)){
                  var sibRef = siblingRefs(as.init[0], siblings, varOf);
                  fields.push({ key:tgt.identifier.name,
                    value: src.slice(as.init[0].range[0], as.init[0].range[1]),
                    end: as.range[1], node: as.init[0],
                    call: hasCallExpr(as.init[0]), sibRef: sibRef });
                  if(sibRef) anySibRef = true;
                  j++; isField = true;
                  continue;
                }
              }
              if(!isField){
                var allInSt = as.variables.every(function(t){
                  return t && t.type === 'Identifier' && varOf.has(t) && stVars.has(varOf.get(t));
                });
                if(allInSt){
                  artifacts.push({ start: as.range[0], end: as.range[1], node: as });
                  j++; continue;
                }
              }
              break;
            }
            if(!fields.length) continue;
            var lastEnd = fields[fields.length-1].end;
            var mergedInit = '{' + fields.map(function(f){ return f.key + '=' + f.value; }).join(',') + '}';
            if(!anySibRef && !artifacts.length && vi === st.init.length - 1){
              // 形态 A：直接并入（无兄弟引用、末位值槽——v1 同形态的多名推广）
              out.push({ id:'tableFields@'+st.range[0]+':'+vi,
                _edits:[
                  { start: init.range[0], end: init.range[1], text: mergedInit },
                  { start: st.range[1], end: lastEnd, text: '' }
                ] });
              continue;
            }
            // 形态 B：拆句。批内变量/值槽移除 M 与 {}，新 local 置于字段区末尾（占位
            // 赋值原文保留在前）。有占位赋值穿插时字段值不得含即时调用（求值序保守）。
            if(st.variables.length < 2) continue;
            if(artifacts.length && fields.some(function(f){ return f.call; })) continue;
            var vPrev = st.variables[vi-1], vNext = st.variables[vi+1];
            var nameEdit = vPrev
              ? { start: vPrev.range[1], end: mv.range[1], text: '' }
              : { start: mv.range[0], end: vNext.range[0], text: '' };
            var iPrev = st.init[vi-1], iNext = st.init[vi+1];
            var initEdit = iPrev
              ? { start: iPrev.range[1], end: init.range[1], text: '' }
              : { start: init.range[0], end: iNext.range[0], text: '' };
            var regionText = artifacts.map(function(a){ return ' ' + src.slice(a.start, a.end); }).join('')
                           + ' local ' + src.slice(mv.range[0], mv.range[1]) + '=' + mergedInit;
            out.push({ id:'tableFieldsSplit@'+st.range[0]+':'+vi,
              _edits:[ nameEdit, initEdit,
                { start: st.range[1], end: lastEnd, text: regionText } ] });
          }
        }
        return out;
      },
      cost: function(ir, cand){ return { delta: preview(ir, cand._edits, deps), confidence: 'exact' }; },
      extract: function(ir, cand){ return { edits: cand._edits, form: {}, residue: {} }; },
      inject: oneWayInject   // 单向：构造器拆回逐条赋值是合并族的逆，无独立压缩意义
    };
  }

  /* ---------- norm.boolNil：true/false 字面量别名提取 ----------
   * 移植 foldBoolNil（≥3 处且 gain>0：k*(wordLen-1) > 8+wordLen）。
   * 产生别名条目（kind='literal'）；canonical detectLit 归一 local A=true ≡ true，
   * 终审无需 aliasMap 还原，故 dropLeading 不必进 canonical（仅 INV-1 登记）。 */
  function createBoolNilLens(deps){
    return {
      name: 'norm.boolNil', kind: 'extract',
      requires: ['ssa'], provides: ['alias:literal'], consumes: [], conflicts: [],
      match: function(ir){
        var src = ir.src, out = [];
        // 头部别名声明区间内的字面量不参与（v1 inHeader 同口径：dropLeading 条头部语句）
        var headerEnd = 0, drop = ir.aliases.dropLeading || 0;
        if(drop > 0 && drop <= ir.ast.body.length && ir.ast.body[drop-1].range)
          headerEnd = ir.ast.body[drop-1].range[1];
        var sites = Object.create(null);
        walkAst(ir.ast.body, function(n){
          if(n.type === 'BooleanLiteral' && n.range && n.range[0] >= headerEnd){
            var key = String(n.value);
            (sites[key] = sites[key] || []).push({ start:n.range[0], end:n.range[1] });
          }
        });
        ['false','true'].forEach(function(v){
          var group = sites[v];
          if(!group || group.length < 3) return;
          var taken = ir._base._collectTakenNames(ir.ast);
          ir.aliases.entries.forEach(function(_, n){ taken.add(n); });
          var alias = ir._base._createNameAllocator(taken)();
          if(!alias) return;
          var wordLen = v.length;
          if(group.length * (wordLen-1) - (8+wordLen) <= 0) return;   // v1 盈亏公式
          var edits = [{ start:0, end:0, text:'local ' + alias + '=' + v + ' ' }];
          group.forEach(function(s){ edits.push({ start:s.start, end:s.end, text:alias }); });
          out.push({ id:'boolNil:'+v, name:alias, target:v,
            _edits:edits, _declRange:[0, 6+alias.length] });
        });
        return out;
      },
      cost: function(ir, cand){ return { delta: preview(ir, cand._edits, deps), confidence: 'exact' }; },
      extract: function(ir, cand){
        return {
          edits: cand._edits,
          form: { aliasEntries: [{ name: cand.name, entry: {
            kind: 'literal', target: cand.target, declRange: cand._declRange.slice(),
            introducedBy: 'norm.boolNil', roundtripKey: cand.id
          }}], dropLeading: 1 },
          residue: {}
        };
      },
      // 双向：别名内联由 alias.js 的 injectAlias 通用承担（字面量 init 直接代回）
      inject: aliasMod.injectAlias
    };
  }

  /* ---------- norm.numbers：0.X → .X ----------
   * 逐字移植 foldNumbers（前一字符是 '.' 或名字字符则跳过）；canonical 按值归一覆盖。 */
  function createNumbersLens(deps){
    return {
      name: 'norm.numbers', kind: 'rewrite',
      requires: [], provides: [], consumes: [], conflicts: [],
      match: function(ir){
        var src = ir.src, out = [];
        walkAst(ir.ast.body, function(n){
          if(n.type === 'NumericLiteral' && n.raw && /^0\.\d+$/.test(n.raw) && n.range){
            var prev = (n.range[0] > 0) ? src[n.range[0]-1] : '';
            if(prev !== '.' && !isNamePart(prev)){
              out.push({ id:'numbers@'+n.range[0],
                _edits:[{ start:n.range[0], end:n.range[0]+1, text:'' }] });
            }
          }
        });
        return out;
      },
      cost: function(ir, cand){ return { delta: preview(ir, cand._edits, deps), confidence: 'exact' }; },
      extract: function(ir, cand){ return { edits: cand._edits, form: {}, residue: {} }; },
      inject: oneWayInject   // 单向：补回前导 0 无压缩意义
    };
  }

  /* ---------- 括号消除的三道闸门 ----------
   * 判定口径 = 「删掉这对括号后重新解析得到的 AST 与原 AST 相同」。luaparse 不记录括号，
   * 括号的语义因此只体现在三处，各设一道闸门：
   *  (1) 位置语法闸门（parensNeeded kind:'base'）：后缀基座必须是 prefixexp——表构造器 /
   *      函数表达式 / 字面量作基座时括号是语法（`({})[1]`、`("a"):rep(2)`、`(function()end)()`）。
   *  (2) 优先级/结合性闸门（parensNeeded kind:'binop'|'unary'）：按 Lua 5.3 优先级表判定
   *      括号是否承载分组语义；结合性一致（左结合看左操作数、右结合看右操作数）才可删。
   *  (3) 多值截断闸门（parensNeeded 调用方看 ctx.truncates）：括号把调用 / vararg 截断成
   *      单值——两侧 AST 完全相同而语义不同，luaparse 与 canonical 都发现不了，必须显式排除
   *      （return 与调用的末位实参、表构造器末位裸值字段、目标数多于本位的赋值/局部声明末位 RHS）。
   * 粘连（`and(x)` → `andx`、`-(-a)` → `--a`）不靠保留括号兜底：删除位改为插入空格，
   * 编码层随后按最小间隔还原——压缩率不损，中间文本却保持可解析。
   * 载荷分号 `x=1;(h)(x)` 保护沿用 v1 口径（前置字符为 ';' 时保留）。
   * 本实现把 v1 foldParens 的「主表达式整包」口径推广到任意表达式（含二元/逻辑/一元/串接）；
   * 漏判方向由默认 verify（canonicalKey 双解析比对）与全局门禁兜底否决。 */

  // Lua 5.3 二元运算符优先级表（lparser.c priority[] 的 left/right 两栏）。
  // 左 9/右 8（`..`）与左 14/右 13（`^`）即右结合，其余左右相等即左结合。
  var BIN_PRIORITY = {
    'or':[1,1], 'and':[2,2],
    '<':[3,3], '>':[3,3], '<=':[3,3], '>=':[3,3], '==':[3,3], '~=':[3,3],
    '|':[4,4], '~':[5,5], '&':[6,6],
    '<<':[7,7], '>>':[7,7],
    '..':[9,8],
    '+':[10,10], '-':[10,10],
    '*':[11,11], '/':[11,11], '//':[11,11], '%':[11,11],
    '^':[14,13]
  };
  var UNARY_PRIORITY = 12;    // Lua: UNARY_PRIORITY
  var PREC_SIMPLE = 99;       // 简单表达式（标识符/字面量/调用/表/函数）：不参与优先级竞争

  // exprPriority(node)：节点顶层运算符的优先级；简单表达式取 PREC_SIMPLE（比任何二元都紧）。
  function exprPriority(node){
    if(node.type === 'BinaryExpression' || node.type === 'LogicalExpression'){
      var p = BIN_PRIORITY[node.operator];
      return p ? p[0] : PREC_SIMPLE;
    }
    if(node.type === 'UnaryExpression') return UNARY_PRIORITY;
    return PREC_SIMPLE;
  }

  // isPrefixExpNode(node)：可作为后缀基座（prefixexp）的节点——`(x).f` / `(x)[1]` / `(x)()` 去括号的前提。
  var PREFIX_EXP_NODES = { Identifier:1, MemberExpression:1, IndexExpression:1,
                           CallExpression:1, StringCallExpression:1, TableCallExpression:1 };
  function isPrefixExpNode(node){ return !!PREFIX_EXP_NODES[node.type]; }

  // isMultiValueNode(node)：可展开为多值的表达式——括号落在展开位上会截断它。
  var MULTI_VALUE_NODES = { CallExpression:1, StringCallExpression:1, TableCallExpression:1, VarargLiteral:1 };
  function isMultiValueNode(node){ return !!MULTI_VALUE_NODES[node.type]; }

  // mergeAt(a, b)：删除括号后 a 与 b 相邻是否会粘成另一个词法单元（保守：可疑即插空格）。
  function mergeAt(a, b){
    if(!a || !b) return false;
    if(isNamePart(a) && isNamePart(b)) return true;          // `and(x)`→`andx`；`1 and(x)` 数字粘字母（malformed number）
    if(a === '-' && b === '-') return true;                  // `-(-a)` → `--a` 注释吞行
    if(a === '.' && b === '.') return true;                  // `a..(…)` / `(…)..b` → `...` 变参
    if(a === '[' && (b === '[' || b === '=')) return true;    // 长括号 `[[` / `[=`
    if(a === ':' && b === ':') return true;                  // 标签 `::`
    if(a === '.' && b >= '0' && b <= '9') return true;       // `.5` 小数
    if(a >= '0' && a <= '9' && b === '.') return true;       // `5.` 小数
    return false;
  }

  // parensNeeded(node, ctx)：该位置的括号是否承载语义（true = 保留）。
  // ctx.kind：'base'（后缀基座）| 'binop'（二元/逻辑操作数，带 parent+side）| 'unary'（一元操作数）
  //           | 'expr'（其余位置：条件/表字段/实参/索引键/赋值右侧……括号纯分组）。
  // ctx.truncates 由遍历方按展开位标注，本函数不看（闸门 3 在调用方）。
  function parensNeeded(node, ctx){
    var kind = (ctx && ctx.kind) || 'expr';
    if(kind === 'base') return !isPrefixExpNode(node);
    if(kind === 'binop'){
      var pP = BIN_PRIORITY[ctx.parent.operator][0];
      var pX = exprPriority(node);
      if(pX > pP) return false;
      if(pX < pP){
        // `^` 右操作数直接接受一元：`a^-b` 合法且结合为 `a^(-b)`（Lua 该位从 subexpr(13) 起手 unop）
        if(ctx.parent.operator === '^' && ctx.side === 'right' && node.type === 'UnaryExpression') return false;
        return true;
      }
      // 同优先级：结合性一致才不改变分组
      var rightAssoc = (ctx.parent.operator === '^' || ctx.parent.operator === '..');
      return rightAssoc ? (ctx.side !== 'right') : (ctx.side !== 'left');
    }
    if(kind === 'unary'){
      // 一元操作数按 subexpr(12) 解析：仅 `^`(14) 与一元自身可裸放进该位
      if(node.type === 'UnaryExpression') return false;   // `not not a` / `- -a`（粘连由空格处理）
      return exprPriority(node) <= UNARY_PRIORITY;
    }
    return false;
  }

  /* ---------- norm.parens：冗余括号消除（优先级 + 结合性 + 多值截断） ---------- */
  function createParensLens(deps){
    return {
      name: 'norm.parens', kind: 'rewrite',
      requires: [], provides: [], consumes: [], conflicts: [],
      match: function(ir){
        var src = ir.src, out = [];
        var EXPR = { kind:'expr', truncates:false };
        var TRUNC = { kind:'expr', truncates:true };
        // push(node, ctx)：紧邻包裹的括号对是否为可删分组括号（见文件内三闸门说明）
        function push(node, ctx){
          if(!node.range) return;
          var s = node.range[0], e = node.range[1];
          if(s <= 0 || e >= src.length) return;
          if(src[s-1] !== '(' || src[e] !== ')') return;
          if(s >= 2 && src[s-2] === ';') return;                  // 载荷分号保护
          if(ctx.argOpen === s - 1) return;                       // 实参表括号（语法括号，非分组）
          // 双包 `((X))`：外层括号已独立承载分组语义，删内层不改变解析（`((a+b))*c` 的内层
          // 就是这种「邻接但被外层接管」的冗余括号）。唯一例外：外层括号是**实参表括号**——
          // 它不是分组括号、不截断多值，删掉内层会让 `f((g()))` 变成 `f(g())`（多值展开）。
          var outerIsArgList = !!(ctx.callArg && ctx.argOpen === s - 2);
          var doubleWrap = (s >= 2 && src[s-2] === '(' && e+1 < src.length && src[e+1] === ')')
                           && !(outerIsArgList && isMultiValueNode(node));
          if(!doubleWrap){
            if(ctx.truncates && isMultiValueNode(node)) return;   // 多值截断闸门
            if(parensNeeded(node, ctx)) return;                   // 位置/优先级/结合性闸门
          }
          var openMerge = mergeAt(s >= 2 ? src[s-2] : '', src[s]);
          var closeMerge = mergeAt(src[e-1], (e+1 < src.length) ? src[e+1] : '');
          out.push({ id:'parens@'+s, _edits:[
            { start:s-1, end:s, text: openMerge ? ' ' : '' },
            { start:e, end:e+1, text: closeMerge ? ' ' : '' }
          ]});
        }
        function visit(node, ctx){
          if(!node || typeof node !== 'object') return;
          if(Array.isArray(node)){ for(var i=0;i<node.length;i++) visit(node[i], EXPR); return; }
          if(node.type) push(node, ctx || EXPR);
          var t = node.type;
          for(var k in node){
            if(k === 'range' || k === 'loc') continue;
            if(!Object.prototype.hasOwnProperty.call(node, k)) continue;
            // 函数形参括号是声明语法的一部分（`function(a)`），绝非可删的分组括号
            if(t === 'FunctionDeclaration' && k === 'parameters') continue;
            var child = node[k];
            if(child === null || child === undefined) continue;
            // 展开位：末位实参 / 末位裸值字段 / 多目标末位 RHS——括号在此截断多值
            if(Array.isArray(child) && k === 'arguments'
               && (t === 'ReturnStatement' || t === 'CallExpression')){
              // 实参表自身的括号是语法（`f(x)` 的 `(x)`）而非分组括号：定位其左括号位置，
              // 供 push 排除「把实参表括号误当冗余分组括号」的假候选（`for k,v in b(i)do` 形态）。
              var argOpen = -1;
              if(t === 'CallExpression' && node.base && node.base.range){
                for(var q = node.base.range[1]; q < node.range[1]; q++){
                  if(src[q] === '('){ argOpen = q; break; }
                }
              }
              for(var ai=0; ai<child.length; ai++)
                visit(child[ai], { kind:'expr', truncates:(ai === child.length-1),
                                   callArg:(t === 'CallExpression'), argOpen:argOpen });
              continue;
            }
            if(Array.isArray(child) && k === 'init'
               && (t === 'AssignmentStatement' || t === 'LocalStatement')){
              var nv = (node.variables && node.variables.length) || 0;
              for(var ii=0; ii<child.length; ii++)
                visit(child[ii], (ii === child.length-1 && nv > ii+1) ? TRUNC : EXPR);
              continue;
            }
            // 泛型 for 的迭代器表也是 explist（末位可展开）：`for k,v in (it())do` 的括号
            // 让 it() 只提供迭代函数（state/control 为 nil），删掉会变成 it() 展开三个值。
            if(Array.isArray(child) && k === 'iterators' && t === 'ForGenericStatement'){
              for(var xi=0; xi<child.length; xi++)
                visit(child[xi], (xi === child.length-1) ? TRUNC : EXPR);
              continue;
            }
            if(Array.isArray(child) && k === 'fields' && t === 'TableConstructorExpression'){
              for(var fi=0; fi<child.length; fi++){
                var f = child[fi], last = (fi === child.length-1);
                if(f && f.type === 'TableValue') visit(f.value, { kind:'expr', truncates:last });
                else if(f && (f.type === 'TableKey' || f.type === 'TableKeyString')){ visit(f.key, EXPR); visit(f.value, EXPR); }
                else visit(f, EXPR);
              }
              continue;
            }
            // 位置语境（上层语境不下传：子节点的括号是否可删只由它自己的位置决定）
            var cctx = EXPR;
            if(t === 'BinaryExpression' || t === 'LogicalExpression'){
              if(k === 'left') cctx = { kind:'binop', parent:node, side:'left', truncates:false };
              else if(k === 'right') cctx = { kind:'binop', parent:node, side:'right', truncates:false };
            }else if(t === 'UnaryExpression' && k === 'argument'){
              cctx = { kind:'unary', parent:node, truncates:false };
            }else if(k === 'base' && (t === 'MemberExpression' || t === 'IndexExpression' || t === 'CallExpression'
                     || t === 'StringCallExpression' || t === 'TableCallExpression')){
              cctx = { kind:'base', parent:node, truncates:false };
            }
            if(Array.isArray(child)){ for(var ci=0; ci<child.length; ci++) visit(child[ci], EXPR); }
            else visit(child, cctx);
          }
        }
        visit(ir.ast.body, EXPR);
        return out;
      },
      cost: function(ir, cand){ return { delta: preview(ir, cand._edits, deps), confidence: 'exact' }; },
      extract: function(ir, cand){ return { edits: cand._edits, form: {}, residue: {} }; },
      inject: oneWayInject   // 单向：补括号位置不唯一
    };
  }

  /* ---------- norm.ifNot：if not c then A else B end → if c then B else A end ----------
   * 逐字移植 foldIfNot（剥光前导 not 记奇偶；v1 的 while 循环由调度器不动点替代）。
   * canonical if-not 归一覆盖等价。 */
  function createIfNotLens(deps){
    return {
      name: 'norm.ifNot', kind: 'rewrite',
      requires: [], provides: [], consumes: [], conflicts: [],
      match: function(ir){
        var src = ir.src, out = [];
        walkAst(ir.ast.body, function(n){
          if(n.type === 'IfStatement' && n.clauses && n.clauses.length === 2
             && n.clauses[0].type === 'IfClause' && n.clauses[1].type === 'ElseClause'
             && n.clauses[0].condition && n.clauses[0].condition.type === 'UnaryExpression'
             && n.clauses[0].condition.operator === 'not' && n.range){
            var c0 = n.clauses[0], c1 = n.clauses[1];
            var notCount = 0, inner = c0.condition;
            while(inner && inner.type === 'UnaryExpression' && inner.operator === 'not'){ notCount++; inner = inner.argument; }
            if(inner && inner.range){
              var condText = src.slice(inner.range[0], inner.range[1]);
              var aBody = c0.body || [], bBody = c1.body || [];
              var aText = aBody.length ? src.slice(aBody[0].range[0], aBody[aBody.length-1].range[1]) : '';
              var bText = bBody.length ? src.slice(bBody[0].range[0], bBody[bBody.length-1].range[1]) : '';
              var thenText = (notCount % 2 === 1) ? bText : aText;
              var elseText = (notCount % 2 === 1) ? aText : bText;
              var rebuilt = 'if ' + condText + ' then ' + thenText + ' else ' + elseText + ' end';
              out.push({ id:'ifNot@'+n.range[0],
                _edits:[{ start:n.range[0], end:n.range[1], text:rebuilt }] });
              return false;   // 嵌套合格 if 留给不动点下一轮（防重叠）
            }
          }
        });
        return out;
      },
      cost: function(ir, cand){ return { delta: preview(ir, cand._edits, deps), confidence: 'exact' }; },
      extract: function(ir, cand){ return { edits: cand._edits, form: {}, residue: {} }; },
      inject: oneWayInject   // 单向：翻转的逆就是它自己，由 match 在下一形态自然发现
    };
  }

  /* ---------- norm.splitMultiAssign：a,b=v1,v2 → a=v1 b=v2（非 local，符号结尾省间隔） ----------
   * 移植 splitMultiAssign + isSplitSafe（RHS 不读目标/目标不重名/全 Identifier 才安全）。
   * v1 用 applyEncoding 模拟做闸门；透镜口径 = preview 的 encodeDelta（同机制更精确）。
   * canonical multiAssignSafeToSplit 归一覆盖等价。 */
  function createSplitMultiAssignLens(deps){
    function isSplitSafe(stmt, info){
      var vars = stmt.variables, inits = stmt.init || [];
      if(vars.length < 2 || vars.length !== inits.length) return false;
      var nameSeen = Object.create(null);
      var targetGlobalNames = Object.create(null);
      var targetBindings = new Set();
      for(var i=0;i<vars.length;i++){
        if(vars[i].type !== 'Identifier') return false;
        if(nameSeen[vars[i].name]) return false;
        nameSeen[vars[i].name] = true;
        var b = info.varOf.get(vars[i]);
        if(b) targetBindings.add(b);
        else targetGlobalNames[vars[i].name] = true;
      }
      var coupled = false;
      walkAst(inits, function(n){
        if(coupled) return false;
        if(n.type === 'Identifier'){
          var b2 = info.varOf.get(n);
          if(b2){ if(targetBindings.has(b2)){ coupled = true; return false; } }
          else if(targetGlobalNames[n.name]){ coupled = true; return false; }
        }
      });
      return !coupled;
    }
    return {
      name: 'norm.splitMultiAssign', kind: 'rewrite',
      requires: ['ssa'], provides: [], consumes: [], conflicts: [],
      match: function(ir){
        var src = ir.src, out = [];
        walkAst(ir.ast.body, function(n){
          if(n.type === 'AssignmentStatement' && n.range && isSplitSafe(n, ir.info)){
            var inits = n.init || [];
            var symEnd = 0;
            for(var i=0;i<inits.length-1;i++){
              var t = inits[i].type;
              if(t === 'CallExpression' || t === 'StringCallExpression' || t === 'TableCallExpression'
                 || t === 'IndexExpression' || t === 'TableConstructorExpression' || t === 'StringLiteral') symEnd++;
            }
            if(symEnd > 0){
              var parts = [];
              for(var j=0;j<n.variables.length;j++){
                parts.push(src.slice(n.variables[j].range[0], n.variables[j].range[1])
                          + '=' + src.slice(inits[j].range[0], inits[j].range[1]));
              }
              out.push({ id:'split@'+n.range[0],
                _edits:[{ start:n.range[0], end:n.range[1], text:parts.join(' ') }] });
            }
          }
        });
        return out;
      },
      cost: function(ir, cand){ return { delta: preview(ir, cand._edits, deps), confidence: 'exact' }; },
      extract: function(ir, cand){ return { edits: cand._edits, form: {}, residue: {} }; },
      inject: oneWayInject   // 单向：合并回多赋值是 foldLocals/合并族的职责（M4）
    };
  }

  /* ---------- norm.inlinePure：纯表达式单用代入（foldInlinePure 移植） ----------
   * 提取的逆变换：单声明、恰好单读、RHS 可移动纯表达式（无调用/全局/变参）的局部，
   * 代入使用点（一律加括号保优先级）并删除声明槽位（同句槽位成对合并删除）。
   * 支配/作用域守卫（赋值句与使用点同块且在前）、RHS 引用在使用前不得被改赋值——
   * 全部经 SSA/varOf 查询。verify = 透镜私有等价理论：两侧先各做纯代入归一
   * （v1 normPureCopyProp，别名感知）再严格 canonical——即 v1 的同口径夹层。 */
  function createInlinePureLens(deps){
    return {
      name: 'norm.inlinePure', kind: 'rewrite',
      requires: ['ssa'], provides: [], consumes: [], conflicts: [],
      match: function(ir){
        var src = ir.src, info = ir.info;
        // 别名排除集合（AliasEnv 单一事实来源；字符串/成员别名例外——代入恢复字面量）
        var aliasB = new Set();
        ir.aliases.entries.forEach(function(e, n){
          if(e.kind === 'string' || e.kind === 'member') return;   // 值别名：代入字面量形态
          aliasB.add(n);
        });
        Object.keys(ir.aliases.transparent || {}).forEach(function(n){ aliasB.add(n); });
        function aliasLitVal(name){
          var e = ir.aliases.entries.get(name);
          return (e && (e.kind === 'string' || e.kind === 'member')) ? e.target : null;
        }

        // 语句 → 所属块语句列（支配/作用域检查：赋值句与使用点须同块且文本在前）
        var blkOf = (function(){
          var m = new Map();
          function tagTree(n, blk){
            if(!n || typeof n !== 'object') return;
            if(Array.isArray(n)){ for(var i=0;i<n.length;i++) tagTree(n[i], blk); return; }
            m.set(n, blk);
            for(var k in n){
              if(k === 'range' || k === 'loc' || k === 'body' || k === 'clauses') continue;
              var c = n[k];
              if(c && typeof c === 'object') tagTree(c, blk);
            }
            if(Array.isArray(n.body)) blockOfList(n.body);
            if(n.clauses) for(var j=0;j<n.clauses.length;j++){
              if(n.clauses[j].condition) tagTree(n.clauses[j].condition, blk);
              if(Array.isArray(n.clauses[j].body)) blockOfList(n.clauses[j].body);
            }
          }
          function blockOfList(list){ for(var i=0;i<list.length;i++) tagTree(list[i], list); }
          blockOfList(ir.ast.body);
          return m;
        })();
        function sameBlkBefore(a, b){
          var la = blkOf.get(a), lb = blkOf.get(b);
          return la != null && la === lb && a.range[0] < b.range[0];
        }

        // 节点 → 所属函数根（版本粒度 v0 读点的闭包捕获守卫；惰性构建一次）
        var funcOf = null;
        function buildFuncOf(ir){
          var m = new Map();
          (function tag(n, fn){
            if(!n || typeof n !== 'object') return;
            if(Array.isArray(n)){ for(var i=0;i<n.length;i++) tag(n[i], fn); return; }
            if(n.type === 'FunctionDeclaration') fn = n;
            m.set(n, fn);
            for(var k in n){
              if(k === 'range' || k === 'loc') continue;
              if(Object.prototype.hasOwnProperty.call(n, k)) tag(n[k], fn);
            }
          })(ir.ast.body, null);
          return m;
        }

        // 赋值目标语句集（区分定义性赋值与重赋值）
        var assignedStmts = new Map();
        walkAst(ir.ast.body, function(n){
          if(n.type === 'AssignmentStatement' && n.variables){
            n.variables.forEach(function(t){
              if(t && t.type === 'Identifier'){
                var bb = info.varOf.get(t);
                if(bb){
                  if(!assignedStmts.has(bb)) assignedStmts.set(bb, new Set());
                  assignedStmts.get(bb).add(n);
                }
              }
            });
          }
        });

        // 可移动纯表达式（标识符须解析为局部且非别名；字符串值别名可读≡字面量）
        function movable(node){
          if(!node || typeof node !== 'object') return false;
          switch(node.type){
            case 'NumericLiteral': case 'StringLiteral': case 'BooleanLiteral': case 'NilLiteral': return true;
            case 'Identifier': {
              var b = info.varOf.get(node);
              if(!b) return false;
              if(!aliasB.has(node.name)) return true;
              return aliasLitVal(node.name) !== null;
            }
            case 'UnaryExpression': return movable(node.argument);
            case 'BinaryExpression': case 'LogicalExpression': return movable(node.left) && movable(node.right);
            case 'MemberExpression': return movable(node.base);
            case 'IndexExpression': return movable(node.base) && movable(node.index);
            case 'TableConstructorExpression':
              for(var i=0;i<node.fields.length;i++){
                var f = node.fields[i];
                if(f.type === 'TableKey'){ if(!movable(f.key) || !movable(f.value)) return false; }
                else if(f.type === 'TableKeyString' || f.type === 'TableValue'){ if(!movable(f.value)) return false; }
              }
              return true;
            default: return false;
          }
        }
        function rhsRefBindings(node){
          var set = new Set();
          walkAst(node, function(n){
            if(n.type === 'Identifier'){
              var rb = info.varOf.get(n);
              if(rb) set.add(rb);
            }
          });
          return set;
        }
        function reassignedBetween(rhsNode, fromStmt, useNode){
          var refs = rhsRefBindings(rhsNode);
          if(!refs.size) return false;
          var lo = fromStmt.range[1], hi = useNode.range[0];
          for(var rb of refs){
            var asg = assignedStmts.get(rb);
            if(!asg) continue;
            for(var st of asg)
              if(st !== fromStmt && st.range[0] >= lo && st.range[1] <= hi) return true;
          }
          return false;
        }

        // 声明槽位定位（对齐/不对齐两表；递归所有块——局部多在回调体内）
        var declLoc = new Map(), declAnyLoc = new Map();
        walkAst(ir.ast.body, function(it){
          if(it && it.type === 'LocalStatement' && it.variables){
            var aligned = it.init && it.variables.length === it.init.length;
            for(var j=0;j<it.variables.length;j++){
              var vb = it.variables[j];
              if(vb && vb.type === 'Identifier'){
                var bb = info.varOf.get(vb);
                if(bb){
                  declAnyLoc.set(bb, { stmt: it, idx: j });
                  if(aligned) declLoc.set(bb, { stmt: it, idx: j });
                }
              }
            }
          }
        });

        // 别名表按【名字】索引，而同名遮蔽会产生多个绑定（`local b='x' local b=({1})`）：
        // 名字级取到的别名值属于另一个绑定，代入本绑定的读点会写错值，而且 canonical 的
        // 别名还原按名字做、看不见这种差异（闸门系统性失明）。故名字在本文件出现多次时
        // 一律不走名字级别名代入；binding 级路径（声明/赋值句）不受影响。
        var nameCount = Object.create(null);
        info.bindings.forEach(function(b){ nameCount[b.name] = (nameCount[b.name] || 0) + 1; });

        var out = [];
        info.bindings.forEach(function(b){
          if(b.decls.length !== 1) return;
          if(aliasB.has(b.name) && aliasLitVal(b.name) === null) return;
          var aliasVal = (nameCount[b.name] === 1) ? aliasLitVal(b.name) : null;
          var asg = assignedStmts.get(b);
          var asgTarget = null, asgIdx = -1, asgStmt = null;
          if(asg){
            if(asg.size !== 1) return;
            var as = asg.values().next().value;
            if(as.init.length !== as.variables.length) return;
            for(var qi=0; qi<as.variables.length; qi++){
              var qv = as.variables[qi];
              if(qv && qv.type === 'Identifier' && info.varOf.get(qv) === b){ asgIdx = qi; asgTarget = qv; break; }
            }
            if(!asgTarget) return;
            asgStmt = as;
          }
          // 读点 = uses 减去定义性赋值目标（analyze 把赋值目标也计入 uses）
          var reads = b.uses.filter(function(u){ return u !== asgTarget; });
          // 版本粒度放宽：绑定恰一次定义性赋值且赋值版本(v1)的读点恰好唯一时，允许仅
          // 代入 v1 的值、删赋值句（声明与 v0 读点不动——SSA 单赋值保证赋值前的读点
          // 属 v0）；v0 的单用代入由不动点后续轮完成。声明版本(v0)原本就单读的绑定
          // 被 varReuse 并入新值后整绑定变双读、两个单用代入全堵（实证 ldoc/lang.lua
          // 的 auto_assign/res：v1 双双内联，v2 颗粒度不足卡死在合并形态 +12）。
          // 安全边界：v0 读点必须与赋值句同函数——嵌套函数内的捕获读可在赋值后的
          // 任意时刻求值（文本顺序不足判版本），拒判。
          if(asg && reads.length > 1){
            if(!funcOf) funcOf = buildFuncOf(ir);
            var v1read = null, v1ok = true;
            for(var ri=0; ri<reads.length; ri++){
              var ru = reads[ri];
              if(!ru.range){ v1ok = false; break; }
              if(ru.range[0] >= asgStmt.range[0] && ru.range[0] <= asgStmt.range[1]){ v1ok = false; break; }   // 赋值句内部读点（f=f+1 形）拒判
              if(ru.range[0] > asgStmt.range[1]){
                if(v1read){ v1ok = false; break; }
                v1read = ru;
              }else if(funcOf.get(ru) !== funcOf.get(asgStmt)){ v1ok = false; break; }
            }
            if(!v1ok || !v1read) return;
            // 邻接约束（与 canonical2 单用邻接代入归一 B2 式同口径）：赋值句与 v1
            // 读点语句须同列相邻——门禁的等价理论只覆盖邻接形态，更宽的提交会被
            // 门禁否决并入黑名单，白耗候选。
            var aList = blkOf.get(asgStmt), aIdx = -1;
            if(aList){ for(var ai2=0; ai2<aList.length; ai2++) if(aList[ai2] === asgStmt){ aIdx = ai2; break; } }
            if(aIdx < 0 || aIdx + 1 >= aList.length) return;
            var rdStmt = aList[aIdx + 1];
            if(!(v1read.range[0] >= rdStmt.range[0] && v1read.range[1] <= rdStmt.range[1])) return;
            reads = [v1read];
          }
          if(reads.length !== 1) return;
          var use = reads[0];
          if(!use.range) return;

          var valueNode = null, valueText = null, delStmt = null, delSlot = false, delIdx = -1, declDrop = null;
          if(aliasVal !== null){
            // 字符串值别名：代入恢复后的字面量
            var aloc = declLoc.get(b);
            if(!aloc) return;
            if(use.range[0] < aloc.stmt.range[1]) return;
            valueText = ir._base._canSingleQuote(aliasVal) ? ("'" + aliasVal + "'") : ('"' + aliasVal + '"');
            delStmt = aloc.stmt; delSlot = true; delIdx = aloc.idx;
          }else if(asg){
            var as2 = asg.values().next().value;
            if(!declAnyLoc.get(b)) return;
            if(!sameBlkBefore(as2, use)) return;
            if(reassignedBetween(as2.init[asgIdx], as2, use)) return;
            valueNode = as2.init[asgIdx]; delStmt = as2; delSlot = true; delIdx = asgIdx;
            var dl = declAnyLoc.get(b);
            if(dl && dl.stmt !== delStmt && dl.idx >= (dl.stmt.init ? dl.stmt.init.length : 0))
              declDrop = dl;   // nil 填充槽联动删除
          }else{
            var loc = declLoc.get(b);
            if(!loc) return;
            valueNode = loc.stmt.init[loc.idx]; delStmt = loc.stmt;
            delSlot = loc.stmt.variables.length > 1; delIdx = loc.idx;
            var refsOther = false;
            walkAst(valueNode, function(n){
              if(refsOther) return false;
              if(n.type === 'Identifier'){
                var rb = info.varOf.get(n);
                if(rb && rb !== b && delStmt.variables.some(function(v){ return info.varOf.get(v) === rb; }))
                  refsOther = true;
              }
            });
            if(refsOther) return;
          }
          if(valueNode && (!valueNode.range || !movable(valueNode))) return;
          if(!valueNode && !valueText) return;
          if(use.range[0] < delStmt.range[1]) return;
          if(valueNode && reassignedBetween(valueNode, delStmt, use)) return;

          // 单候选编辑组（inlinePureEdits 的单候选特化：同句槽位合并重写）
          var edits = [];
          var drops = [];
          if(delSlot) drops.push({ stmt: delStmt, idx: delIdx });
          if(declDrop) drops.push({ stmt: declDrop.stmt, idx: declDrop.idx });
          var byStmt = new Map();
          drops.forEach(function(d){
            if(!byStmt.has(d.stmt)) byStmt.set(d.stmt, new Set());
            byStmt.get(d.stmt).add(d.idx);
          });
          // 槽位删除的多值展开守卫：末位 init 可展开（调用/变参）且目标数多于 init 数时，末位 init
          // 之后的槽位由它供给（`local a,b,c=f()` 的 b、c）——删这种槽位会把后面的返回值前移
          // （删 b → `local a,c=f()`，c 拿到 f() 的第 2 个值）；两侧 AST 相同，canonical 看不见。
          // 口径：删的槽位下标 ≥ 末位 init 下标即拒判（更早的槽位各有独立 init，删除不移动映射）。
          var dropUnsafe = false;
          byStmt.forEach(function(dropIdx, stmt){
            var vv0 = stmt.variables, ii0 = stmt.init || [];
            if(!(ii0.length && isMultiValueNode(ii0[ii0.length-1]) && vv0.length > ii0.length)) return;
            dropIdx.forEach(function(dd){ if(dd >= ii0.length - 1) dropUnsafe = true; });
          });
          if(dropUnsafe) return;
          byStmt.forEach(function(dropIdx, stmt){
            var vv = stmt.variables, ii = stmt.init || [];
            if(dropIdx.size >= vv.length){
              edits.push({ start: stmt.range[0], end: stmt.range[1], text: '' });
              return;
            }
            var newVars = [], newInits = [];
            for(var k=0;k<vv.length;k++){
              if(dropIdx.has(k)) continue;
              newVars.push(src.slice(vv[k].range[0], vv[k].range[1]));
              newInits.push(k < ii.length ? src.slice(ii[k].range[0], ii[k].range[1]) : null);
            }
            while(newInits.length && newInits[newInits.length-1] === null) newInits.pop();
            edits.push({ start: vv[0].range[0], end: vv[vv.length-1].range[1], text: newVars.join(',') });
            if(ii.length){
              var initTxt = newInits.map(function(v){ return v === null ? 'nil' : v; }).join(',');
              var afterPos = ii[ii.length-1].range[1];
              var nx2 = (afterPos < src.length) ? src[afterPos] : undefined;
              if(initTxt && ir._base._needsSepAfter(initTxt[initTxt.length-1], nx2)) initTxt += ' ';
              edits.push({ start: ii[0].range[0], end: afterPos, text: initTxt });
            }
          });
          if(!delSlot) edits.push({ start: delStmt.range[0], end: delStmt.range[1], text: '' });
          var rhsText = valueText || src.slice(valueNode.range[0], valueNode.range[1]);
          // 索引位使用点 + 标识符安全字符串 → 点访问形态（canonical normAccess 同范式）
          var bare = null, mQ = /^['"]([A-Za-z_][A-Za-z0-9_]*)['"]$/.exec(rhsText);
          if(mQ) bare = mQ[1];
          var u0 = use.range[0], u1 = use.range[1];
          var bracketed = (u0 > 0 && src[u0-1] === '[' && u1 < src.length && src[u1] === ']');
          if(bare && bracketed){
            var dotRepl = '.' + bare;
            var nxD = (u1+1 < src.length) ? src[u1+1] : undefined;
            if(ir._base._needsSepAfter(bare[bare.length-1], nxD)) dotRepl += ' ';
            edits.push({ start: u0-1, end: u1+1, text: dotRepl });
          }else{
            var repl = '(' + rhsText + ')';   // 代入一律加括号保优先级
            var nx = (u1 < src.length) ? src[u1] : undefined;
            if(ir._base._needsSepAfter(')', nx)) repl += ' ';
            edits.push({ start: u0, end: u1, text: repl });
          }
          out.push({ id:'inlinePure:' + b.name + '@' + u0, _edits: edits });
        });
        return out;
      },
      cost: function(ir, cand){ return { delta: preview(ir, cand._edits, deps), confidence: 'exact' }; },
      extract: function(ir, cand){ return { edits: cand._edits, form: {}, residue: {} }; },
      inject: oneWayInject,   // 逆 = 提取（alias/factor/block 族职责，互逆仲裁在调度层）
      // verify 覆盖：透镜私有等价理论（纯代入归一夹层）——两侧各自 normPureCopyProp
      // 不动点后严格 canonical（v1 foldInlinePure 同口径，归一规则按透镜下沉 §3）。
      // 版本链候选（v1 先代入一步、v0 留待不动点后续轮）落在 npc 的绑定粒度之外：
      // 一侧还需再代入一代才收敛，npc 夹层判不下——经 canonical2 的单用邻接代入归一
      // （含 B2 版本链式，与全局门禁同一理论）补充判定。
      verify: function(ir, cand, result){
        try{
          var npc = ir._base._normPureCopyProp;
          var na, nb;
          try{ na = npc(ir.src); }catch(e){ na = ir.src; }
          try{ nb = npc(result.ir.src); }catch(e){ nb = result.ir.src; }
          if(ir._base._canonical(na) === ir._base._canonical(nb)) return true;
        }catch(e){}
        try{
          return !!(canonMod && canonMod.equivalent(ir.src, result.ir.src, deps, ir, result.ir, { pureInline: true }));
        }catch(e){ return false; }
      }
    };
  }

  /* ---------- norm.tailSymbol：多值赋值尾值符号收尾（foldTailSymbol 移植） ----------
   * 把"以符号(引号/花括号)收尾"的纯字面量值排到多值 local 的末位，使后续关键字前
   * 可省一个空格。只交换纯字面量（求值顺序无关）；canonical 只读字面量别名归一覆盖。 */
  function createTailSymbolLens(deps){
    function isPureLit(n){
      if(!n || typeof n !== 'object') return false;
      if(n.type === 'NumericLiteral' || n.type === 'StringLiteral'
         || n.type === 'BooleanLiteral' || n.type === 'NilLiteral') return true;
      if(n.type === 'TableConstructorExpression'){
        for(var i=0;i<n.fields.length;i++){
          var f = n.fields[i];
          if(f.type === 'TableKey'){ if(!isPureLit(f.key) || !isPureLit(f.value)) return false; }
          else if(f.type === 'TableKeyString' || f.type === 'TableValue'){ if(!isPureLit(f.value)) return false; }
        }
        return true;
      }
      return false;
    }
    function endsSpaceFree(text){ var c = text[text.length-1]; return c === "'" || c === '"' || c === '}'; }
    function endsSpaceNeeded(text){ return (/[0-9A-Za-z_]/).test(text[text.length-1]); }
    return {
      name: 'norm.tailSymbol', kind: 'rewrite',
      requires: [], provides: [], consumes: [], conflicts: [],
      match: function(ir){
        var src = ir.src, out = [];
        walkAst(ir.ast.body, function(n){
          if(n.type === 'LocalStatement' && n.variables && n.init && n.init.length >= 2 && n.range){
            for(var v=0; v<n.init.length; v++)
              if(n.variables[v].type !== 'Identifier') return;   // 全 Identifier 才交换
            var li = n.init.length-1;
            var lastText = src.slice(n.init[li].range[0], n.init[li].range[1]);
            if(!endsSpaceNeeded(lastText)) return;   // 末值已符号收尾
            for(var si=li-1; si>=0; si--){
              var stText = src.slice(n.init[si].range[0], n.init[si].range[1]);
              if(endsSpaceFree(stText) && isPureLit(n.init[si])){
                out.push({ id:'tailSymbol@'+n.range[0], _edits: [
                  { start:n.variables[si].range[0], end:n.variables[si].range[1],
                    text: src.slice(n.variables[li].range[0], n.variables[li].range[1]) },
                  { start:n.variables[li].range[0], end:n.variables[li].range[1],
                    text: src.slice(n.variables[si].range[0], n.variables[si].range[1]) },
                  { start:n.init[si].range[0], end:n.init[si].range[1], text: lastText },
                  { start:n.init[li].range[0], end:n.init[li].range[1], text: stText }
                ]});
                return;   // 本语句处理完（v1 同：每语句至多一处交换）
              }
            }
            return;
          }
        });
        return out;
      },
      cost: function(ir, cand){ return { delta: preview(ir, cand._edits, deps), confidence: 'exact' }; },
      extract: function(ir, cand){ return { edits: cand._edits, form: {}, residue: {} }; },
      inject: oneWayInject   // 单向：重排的逆由 match 在下一形态发现
    };
  }

  /* ---------- 工厂与 part 注册 ---------- */

  // createNormalizeLenses(deps) -> [Lens]：归一族透镜（注册顺序≈v1 阶段序 1.1b→1.7）
  function createNormalizeLenses(deps){
    return [
      createBracketDotLens(deps),
      createReadonlyInlineLens(deps),
      createConstFoldLens(deps),
      createConstConditionLens(deps),
      createConstLoopLens(deps),
      createEarlyReturnLens(deps),
      createDeMorganLens(deps),
      createNotCompareLens(deps),
      createInlineValueLens(deps),
      createTableFieldsLens(deps),
      createBoolNilLens(deps),
      createNumbersLens(deps),
      createParensLens(deps),
      createIfNotLens(deps),
      createSplitMultiAssignLens(deps),
      createInlinePureLens(deps),
      createTailSymbolLens(deps)
    ];
  }

  var api = { createNormalizeLenses: createNormalizeLenses };
  (root.__LuaMin2Parts = root.__LuaMin2Parts || []).push({
    name: 'lenses/normalize',
    install: function(C){ for(var k in api) C[k] = api[k]; }
  });
  root.__LuaMin2Modules = root.__LuaMin2Modules || {};
  root.__LuaMin2Modules['lenses/normalize'] = api;
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
