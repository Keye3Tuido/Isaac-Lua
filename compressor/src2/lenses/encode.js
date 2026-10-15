/* ===================================================================
 * LuaMin v2 lens family: encode — 编码透镜族（M3）
 *   encode.semicolon       分号消除（AST 语句边界判定，替代 v1 括号栈猜测）
 *   encode.compareReorder  比较重排（a OP b ≡ b FLIP(OP) a，贴关键字省空格）
 *
 * §6.1 根因修复：v1 minimizeSpacing 用括号栈猜 ';' 是否表内字段分隔符，
 * 表内嵌函数体（{f=function()a;b end}）会误判；且语句边界靠 "后跟 (" 启发式。
 * v2 判定口径：
 *   - 表字段分隔符：';' 落在某 TableConstructorExpression 的【直接字段间隙】
 *     （field[i].end, field[i+1].start）内 → 保留（字段分隔符，删除会破坏表）；
 *     表内嵌函数体里的语句 ';' 不在任何字段间隙 → 按语句分隔符正常判定。
 *   - 语句分隔符：可省 iff 后一有效 token 不是 '('（载荷分号 ;( 保留，防调用续接）。
 * =================================================================== */
(function(root){
  'use strict';

  var irMod = null, lensMod = null;
  if(typeof module !== 'undefined' && module.exports){
    irMod = require('../ir.js');
    lensMod = require('../lens.js');
  }else if(root.__LuaMin2Modules){
    irMod = root.__LuaMin2Modules['ir'];
    lensMod = root.__LuaMin2Modules['lens'];
  }
  function needIR(deps){ var m=(deps&&deps.ir)||irMod; if(!m) throw new Error('lenses/encode.js: 需要 src2/ir.js'); return m; }

  function preview(ir, edits, deps){
    var IR = needIR(deps);
    return lensMod.encodeDelta(ir.src, IR.applyTextEdits(ir.src, edits), deps);
  }
  function oneWayInject(){ return null; }
  function isNamePart(c){ return !!c && (/[A-Za-z0-9_]/).test(c); }

  /* ---------- encode.semicolon ---------- */

  // fieldSeparatorRanges(ast)：全部表构造器的【直接字段间隙】区间集合（半开 [s,e)）。
  // 语义：间隙里的 ','/';' 是字段分隔符；函数体等嵌套结构内的 ';' 不在其中。
  function fieldSeparatorRanges(ast){
    var ranges = [];
    (function walk(n){
      if(!n || typeof n !== 'object') return;
      if(Array.isArray(n)){ for(var i=0;i<n.length;i++) walk(n[i]); return; }
      if(n.type === 'TableConstructorExpression' && n.fields && n.fields.length > 1){
        for(var i=0;i+1<n.fields.length;i++){
          var a = n.fields[i], b = n.fields[i+1];
          if(a.range && b.range) ranges.push([a.range[1], b.range[0]]);
        }
      }
      for(var k in n){
        if(k === 'range' || k === 'loc') continue;
        if(Object.prototype.hasOwnProperty.call(n, k)) walk(n[k]);
      }
    })(ast.body);
    return ranges;
  }

  // inRanges(pos, ranges)：pos 是否落在任一字段间隙内
  function inRanges(pos, ranges){
    for(var i=0;i<ranges.length;i++) if(pos >= ranges[i][0] && pos < ranges[i][1]) return true;
    return false;
  }

  function createSemicolonLens(deps){
    return {
      name: 'encode.semicolon', kind: 'encode',
      requires: [], provides: [], consumes: [], conflicts: [],
      commitAtZero: true,   // 归一透镜：';'→'' / ' ' 常等长，收益是形态归一而非字节
      // match(ir)：每条可删语句分隔 ';' 一个候选；字段分隔符/载荷分号不产生候选
      match: function(ir){
        var toks = ir._base._lex(ir.src);
        var needSpace = ir._base._needSpace;
        var fieldGaps = fieldSeparatorRanges(ir.ast);
        var out = [];
        for(var i=0;i<toks.length;i++){
          var tk = toks[i];
          if(tk.type !== 'Punct' || tk.value !== ';') continue;
          if(inRanges(tk.start, fieldGaps)) continue;          // 表字段分隔符：AST 判定保留
          // 前/后一有效 token（跳过注释）
          var pj = i-1;
          while(pj >= 0 && toks[pj].type === 'Comment') pj--;
          var nj = i+1;
          while(nj < toks.length && toks[nj].type === 'Comment') nj++;
          var prevTok = (pj >= 0) ? toks[pj] : null;
          var nextTok = (nj < toks.length) ? toks[nj] : null;
          if(nextTok && nextTok.value === '(') continue;       // 载荷分号 ;( ：保留
          // 删除后相邻 token 直接拼接可能被重词法化（如 a=1;b=2 → 1b 畸形数字），
          // 此时须以空格替换（v1「needSpace 自然补空格」口径的文本层等价物）
          var rep = (prevTok && nextTok && nextTok.type !== 'EOF'
                     && needSpace(prevTok.value, nextTok.value)) ? ' ' : '';
          out.push({ id:'semicolon@'+tk.start, _edits:[{ start:tk.start, end:tk.end, text:rep }] });
        }
        return out;
      },
      cost: function(ir, cand){ return { delta: preview(ir, cand._edits, deps), confidence: 'exact' }; },
      extract: function(ir, cand){ return { edits: cand._edits, form: {}, residue: {} }; },
      inject: oneWayInject   // 单向：分号补回位置不唯一；AST 恒等改写，canonical 自动等价
    };
  }

  /* ---------- encode.compareReorder：比较/可交换二元重排 ----------
   * 逐字移植 foldCompareReorder。代数恒等式改写（==/~= 对称、</>/<=/>= 翻转、& | ~ 交换），
   * v1 canonical 无比较翻转归一，故 verify 覆盖为【解析合法 + 等长或更短】——
   * 语义安全由 match 的"至多一侧含调用/索引"约束保证（改写本身是恒等式）。
   */
  function createCompareReorderLens(deps){
    var FLIP = { '<':'>', '>':'<', '<=':'>=', '>=':'<=' };
    var COMMUTE = { '&':1, '|':1, '~':1 };
    function hasSideEffect(node){
      var found = false;
      (function w(n){
        if(found || !n || typeof n !== 'object') return;
        if(Array.isArray(n)){ for(var i=0;i<n.length;i++) w(n[i]); return; }
        if(n.type === 'CallExpression' || n.type === 'IndexExpression'){ found = true; return; }
        for(var k in n){ if(k === 'range' || k === 'loc') continue; if(Object.prototype.hasOwnProperty.call(n,k)) w(n[k]); }
      })(node);
      return found;
    }
    function symEnd(t){ var c = t[t.length-1]; return c === ')' || c === ']' || c === "'" || c === '"'; }
    function nameEnd(t){ var c = t[t.length-1]; return isNamePart(c); }
    return {
      name: 'encode.compareReorder', kind: 'encode',
      requires: [], provides: [], consumes: [], conflicts: [],
      match: function(ir){
        var src = ir.src, lex = ir._base._lex, needSpace = ir._base._needSpace;
        var out = [];
        function firstTok(s){ var t = lex(s); for(var i=0;i<t.length;i++) if(t[i].type !== 'EOF' && t[i].type !== 'Comment') return t[i].value; return ''; }
        function lastTok(s){ var t = lex(s); for(var i=t.length-1;i>=0;i--) if(t[i].type !== 'EOF' && t[i].type !== 'Comment') return t[i].value; return ''; }
        function boundary(start, end, rt, newRight, op){
          var op2 = (op === '==' || op === '~=') ? op : FLIP[op];
          var text = rt + op2 + newRight;
          var first = firstTok(rt), last = lastTok(newRight);
          var isSpace = function(c){ return c === ' ' || c === '\t' || c === '\r' || c === '\n'; };
          if(start > 0 && !isSpace(src[start-1]) && needSpace(lastTok(src.slice(0,start)), first)) text = ' ' + text;
          if(end < src.length && !isSpace(src[end]) && needSpace(last, firstTok(src.slice(end)))) text = text + ' ';
          return text;
        }
        function commuteToEnd(node){
          if(!node || node.type !== 'BinaryExpression' || !COMMUTE[node.operator] || !node.left || !node.right || !node.left.range || !node.right.range) return null;
          if(hasSideEffect(node.left) && hasSideEffect(node.right)) return null;
          var left = src.slice(node.left.range[0], node.left.range[1]);
          var right = src.slice(node.right.range[0], node.right.range[1]);
          var op = node.operator;
          if(symEnd(left)) return right + op + left;
          if(symEnd(right)) return left + op + right;
          return null;
        }
        (function walk(n){
          if(!n || typeof n !== 'object') return;
          if(Array.isArray(n)){ for(var i=0;i<n.length;i++) walk(n[i]); return; }
          if(n.type === 'BinaryExpression' && n.range && n.left && n.right && n.left.range && n.right.range){
            var op = n.operator;
            if(op === '<' || op === '>' || op === '<=' || op === '>=' || op === '==' || op === '~='){
              var lc = hasSideEffect(n.left), rc = hasSideEffect(n.right);
              if(!(lc && rc)){
                var lt = src.slice(n.left.range[0], n.left.range[1]);
                var rt = src.slice(n.right.range[0], n.right.range[1]);
                // v1 口径：右操作数须以名字字符收尾（翻转后 lt 的符号尾贴下一关键字省空格；
                // rt 若为符号尾则翻转无收益）
                if(nameEnd(rt)){
                  var start = n.range[0], end = n.range[1];
                  var best = null;
                  var commuted = commuteToEnd(n.left);
                  if(commuted){
                    var c1 = boundary(start, end, rt, commuted, op);
                    if(!best || c1.length < best.length) best = c1;
                  }
                  if(symEnd(lt)){
                    var moved = n.left.type === 'LogicalExpression' ? '(' + lt + ')' : lt;
                    var c2 = boundary(start, end, rt, moved, op);
                    if(!best || c2.length < best.length) best = c2;
                  }
                  if(best){
                    out.push({ id:'cmpReorder@'+start, _edits:[{ start:start, end:end, text:best }] });
                    return;   // 整体重写，不深入操作数（嵌套比较留给不动点）
                  }
                }
              }
            }
          }
          for(var k in n){ if(k === 'range' || k === 'loc') continue; if(Object.prototype.hasOwnProperty.call(n,k)) walk(n[k]); }
        })(ir.ast.body);
        return out;
      },
      cost: function(ir, cand){ return { delta: preview(ir, cand._edits, deps), confidence: 'exact' }; },
      extract: function(ir, cand){ return { edits: cand._edits, form: {}, residue: {} }; },
      inject: oneWayInject,   // 单向：重排的逆由 match 在翻转形态上自然发现
      // verify 覆盖：代数恒等式无 canonical 归一（v1 同样只查语法），
      // 故验证 = 产物解析合法（luaparse + fengari 双重，fengari 经 deps 可选）。
      verify: function(ir, cand, result){
        try{
          ir._base._parse(result.ir.src);
          var fengari = (deps && deps.fengari) || (ir._deps && ir._deps.fengari);
          if(fengari){
            var lua=fengari.lua, lauxlib=fengari.lauxlib, lualib=fengari.lualib;
            var Ls=lauxlib.luaL_newstate(); lualib.luaL_openlibs(Ls);
            var st=lauxlib.luaL_loadstring(Ls, fengari.to_luastring(result.ir.src));
            if(st !== lua.LUA_OK) return false;
          }
          return true;
        }catch(e){ return false; }
      }
    };
  }

  /* ---------- encode.trailingSep：表构造器尾随分隔符消除（,}/;}） ----------
   * 语义：','/';' 后紧跟 '}' 只可能出现在表构造器字段列表末尾（Lua 语法上
   * 参数列表/声明列表不允许尾随分隔符），删除恒安全。v1 由 minimizeSpacing
   * 括号栈顺手处理；v2 收编为独立透镜（所有权单一，§6.1）。 */
  function createTrailingSepLens(deps){
    return {
      name: 'encode.trailingSep', kind: 'encode',
      requires: [], provides: [], consumes: [], conflicts: [],
      match: function(ir){
        var toks = ir._base._lex(ir.src);
        var out = [];
        for(var i=0;i<toks.length;i++){
          var tk = toks[i];
          if(tk.type !== 'Punct' || (tk.value !== ',' && tk.value !== ';')) continue;
          var nj = i+1;
          while(nj < toks.length && toks[nj].type === 'Comment') nj++;
          if(nj < toks.length && toks[nj].value === '}')
            out.push({ id:'trailingSep@'+tk.start, _edits:[{ start:tk.start, end:tk.end, text:'' }] });
        }
        return out;
      },
      cost: function(ir, cand){ return { delta: preview(ir, cand._edits, deps), confidence: 'exact' }; },
      extract: function(ir, cand){ return { edits: cand._edits, form: {}, residue: {} }; },
      inject: oneWayInject
    };
  }

  /* ---------- 工厂与 part 注册 ---------- */

  // createEncodeLenses(deps) -> [Lens]：编码族透镜（kind='encode'，调度末尾执行）
  function createEncodeLenses(deps){
    return [ createSemicolonLens(deps), createCompareReorderLens(deps), createTrailingSepLens(deps) ];
  }

  var api = { createEncodeLenses: createEncodeLenses, fieldSeparatorRanges: fieldSeparatorRanges };
  (root.__LuaMin2Parts = root.__LuaMin2Parts || []).push({
    name: 'lenses/encode',
    install: function(C){ for(var k in api) C[k] = api[k]; }
  });
  root.__LuaMin2Modules = root.__LuaMin2Modules || {};
  root.__LuaMin2Modules['lenses/encode'] = api;
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
