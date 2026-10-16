// tests2/regression/parens.js — 括号消除专项（优先级 / 结合性 / 多值截断三闸门）
//
// 覆盖 src2/lenses/normalize.js 的 norm.parens：
//   ① 优先级：更紧的括号可删（有净收益才提交），更松的括号必留；
//   ② 结合性：左结合看左操作数、右结合（`..` / `^`）看右操作数，同优先级异侧必留；
//   ③ 多值截断：括号把调用/vararg 截断为单值——两侧 AST 完全相同，luaparse 与 canonical
//      都发现不了，只能靠显式闸门；故本套件除了 harness 的 canonical 等价/幂等断言，
//      另加一组 **fengari 真·Lua 实跑比对**（原程序与压缩产物的 print 输出逐字相等）。
//   ④ 语法括号：后缀基座（`({})[1]` / `("s"):rep(2)`）、实参表（`f(x)`）、形参表（`function(a)`）
//      的括号不是分组括号，不得误删；⑤ 粘连（`-(-a)`→`--a`）靠删除位插空格解决而非保留括号。
'use strict';
const { runCases, v2 } = require('./_v2harness.js');
const { luaPrint: luaRun } = require('../_helpers.js');

// ---------- 形态断言案例（harness：解析 + canonical 等价 + 严格幂等 + 形态） ----------
const cases = [
  // ① 优先级：更紧 → 可删（净收益为正才提交）
  { name: 'prec-mul-in-add', code: 'return (a*b)+c', mustContain: 'return a*b+c' },
  { name: 'prec-pow-in-mul', code: 'return (a^b)*c', mustContain: 'a^b*c' },
  { name: 'prec-cmp-in-eq', code: 'return (a<b)==c', mustContain: 'a<b==c' },
  { name: 'prec-not-in-eq', code: 'return (not a)==b', mustContain: 'not a==b' },
  // ① 优先级：更松 → 必留
  { name: 'prec-add-in-mul', code: 'return (a+b)*c', mustContain: '(a+b)*c' },
  { name: 'prec-or-in-and', code: 'return (a or b)and c', mustContain: '(a or b)and c' },
  { name: 'prec-not-and', code: 'return not(a and b)', mustContain: 'not(a and b)' },
  { name: 'prec-unary-arg', code: 'return -(a*b)', mustContain: '-(a*b)' },
  // 一元与 `^`：`^` 比一元更紧
  { name: 'unary-in-mul', code: 'return (-a)*b', mustContain: '-a*b' },
  { name: 'unary-pow-arg', code: 'return -(a^b)', mustContain: '-a^b' },
  { name: 'pow-of-unary', code: 'return (-a)^b', mustContain: '(-a)^b' },
  { name: 'pow-unary-right', code: 'return 2^(-1)', mustContain: '2^-1' },
  // ② 结合性
  { name: 'assoc-add-left', code: 'return (a+b)+c', mustContain: 'a+b+c' },
  { name: 'assoc-add-right', code: 'return a+(b+c)', mustContain: 'a+(b+c)' },
  { name: 'assoc-sub-left', code: 'return (a-b)-c', mustContain: 'a-b-c' },
  { name: 'assoc-sub-right', code: 'return a-(b-c)', mustContain: 'a-(b-c)' },
  { name: 'assoc-concat-right', code: 'return a..(b..c)', mustContain: 'a..b..c' },
  { name: 'assoc-concat-left', code: 'return (a..b)..c', mustContain: '(a..b)..c' },
  { name: 'assoc-pow-right', code: 'return a^(b^c)', mustContain: 'a^b^c' },
  { name: 'assoc-pow-left', code: 'return (a^b)^c', mustContain: '(a^b)^c' },
  { name: 'assoc-div-right', code: 'return a*(b/c)', mustContain: 'a*(b/c)' },
  { name: 'assoc-div-left', code: 'return (a/b)*c', mustContain: 'a/b*c' },
  { name: 'assoc-and-right', code: 'return a and(b and c)', mustContain: 'a and(b and c)' },
  // ④ 后缀基座：表/函数/字面量/弱优先级表达式作基座必须带括号
  { name: 'base-table', code: 'return ({})[1]', mustContain: '({})[1]' },
  { name: 'base-func', code: 'return (function()end)()', mustContain: '(function()end)()' },
  { name: 'base-string', code: "return ('s'):rep(2)", mustContain: "('s'):rep(2)" },
  { name: 'base-logical', code: 'return (f or g)(x)', mustContain: '(f or g)(x)' },
  { name: 'base-member-ok', code: 'return (t).x', mustContain: 'return t.x' },
  { name: 'base-call-ok', code: 'return (f()).x', mustContain: 'return f().x' },
  // ③ 多值截断：末位展开位必须保留括号
  { name: 'trunc-return', code: 'local f=function()return 1,2 end return (f())', mustContain: 'return(f())' },
  { name: 'trunc-call-last', code: 'local f=function()return 1,2 end print((f()))', mustContain: 'print((f()))' },
  { name: 'trunc-local-2', code: 'local f=function()return 1,2 end local a,b=(f())print(a,b)', mustContain: 'a,b=(f())' },
  { name: 'trunc-table-last', code: 'local f=function()return 1,2 end local t={(f())}print(t)', mustContain: '{(f())}' },
  { name: 'trunc-vararg', code: 'local a,b=(...)print(a,b)', mustContain: 'a,b=(...)' },
  // 泛型 for 的迭代器表也是 explist：末位括号删掉会让 it() 由「只给迭代函数」变成「展开三值」
  { name: 'trunc-forin-iterator', code: 'for k,v in (it())do print(k)end', mustContain: 'in(it())do' },
  { name: 'trunc-nonlast-ok', code: 'local f=function()return 1,2 end print((f()),1)', mustContain: 'print(f(),1)' },
  // ④ 实参表 / 形参表括号不得误删（曾把 `for k,v in b(i)do` 的实参表括号当分组括号删掉）
  { name: 'arglist-forin', code: 'for k,v in b(i)do print(k)end', mustContain: 'in b(i)do' },
  { name: 'arglist-nested-ok', code: 'print(a+(b)*c)', mustContain: 'print(a+b*c)' },
  { name: 'params-kept', code: 'local f=function(a)return a end print(f(1))', mustContain: 'function(a)' },
  // ⑤ 粘连：删除位插空格（而非保留括号），压缩收益不丢
  { name: 'merge-unary', code: 'return -(-a)', mustContain: '- -a' },
  { name: 'merge-not', code: 'return not(not a)', mustContain: 'not not a' },
  { name: 'merge-name', code: 'local x=1 return x and(a)', mustContain: '1 and a' },
  // 双包 `((X))`：内层纯冗余（外层括号独立承载分组）
  { name: 'double-wrap', code: 'return ((a+b))*c', mustContain: '(a+b)*c', mustNotMatch: /\(\(a\+b\)\)/ },
  { name: 'double-wrap-trunc', code: 'local f=function()return 1,2 end print(((f())))', mustContain: 'print((f()))' },
  // 其它位置：条件/表键可删；载荷分号保护沿用 v1 口径
  { name: 'table-key', code: 'local t={[((a))]=1}print(t)', mustContain: '{[a]=1}' },
  { name: 'semicolon-guard', code: 'local t={}t.x=1;(h)(t)', mustContain: ';(h)' },
  // 等长不提交（`if(a)then` ≡ `if a then`，同为 9 字节）：保持输出上界即可
  { name: 'cond-if-equal-len', code: 'if (a) then return 1 end', maxLen: 24 },
  { name: 'cond-while-equal-len', code: 'while (a) do break end', maxLen: 24 },
];

// 程序自带可复现输出（无随机/地址/时间）；两侧输出必须逐字相等。（luaRun = _helpers.luaPrint）
const SEMANTIC = [
  { name: 'sem-trunc-local2', code: 'local f=function()return 1,2 end local a,b=(f())print(a,b)' },
  { name: 'sem-trunc-local2-single', code: 'local f=function()return 1,2 end local a=(f())print(a)' },
  { name: 'sem-trunc-call-last', code: 'local f=function()return 1,2 end print((f()))' },
  { name: 'sem-trunc-call-nonlast', code: 'local f=function()return 1,2 end print((f()),9)' },
  { name: 'sem-trunc-table', code: 'local f=function()return 1,2 end local t={(f())}print(#t,t[1],t[2])' },
  { name: 'sem-trunc-table-key', code: 'local f=function()return 1,2 end local t={a=(f())}print(t.a)' },
  { name: 'sem-trunc-vararg', code: 'local a,b=(...)print(a,b)' },
  { name: 'sem-trunc-forin', code:
    'local function f(s,c)print(s,c)return nil end ' +
    'local function it()return f,"S",1 end for k,v in (it())do end for k,v in it()do end' },
  { name: 'sem-trunc-return', code: 'local function g()local f=function()return 1,2 end return (f())end print(g())' },
  { name: 'sem-double-wrap', code: 'local f=function()return 1,2 end print(((f())))' },
  { name: 'sem-assoc-float', code: 'local a,b,c=0.1,0.2,0.3 print((a+b)+c)print(a+(b+c))' },
  { name: 'sem-assoc-sub', code: 'local a,b,c=10,3,2 print((a-b)-c)print(a-(b-c))' },
  { name: 'sem-assoc-div', code: 'local a,b,c=100,7,3 print((a/b)/c)print(a/(b/c))' },
  { name: 'sem-assoc-pow', code: 'print(2^3^2)print((2^3)^2)' },
  { name: 'sem-prec-mul-add', code: 'local a,b,c=2,3,4 print((a+b)*c)print(a+b*c)' },
  { name: 'sem-unary-pow', code: 'local a=2 print(-(a^2))print((-a)^2)' },
  { name: 'sem-not-and', code: 'local a,b=true,false print(not(a and b))print(not a and b)' },
  { name: 'sem-concat-mt', code:
    'local function mk(s)return setmetatable({s=s},{__tostring=function(t)return t.s end,' +
    '__concat=function(x,y)return "("..tostring(x).."+"..tostring(y)..")"end})end ' +
    'local a,b,c=mk("a"),mk("b"),mk("c")print((a..b)..c)print(a..(b..c))' },
  { name: 'sem-parens-noise', code: 'local a,b=3,4 print((a)+((b)))print((a*b)+((a)))' },
];

function run(){
  const r = runCases(cases);
  let pass = r.pass, fail = r.fail;
  const bad = [];
  function ok(cond, label, detail){
    if(cond){ pass++; }
    else { fail++; if(bad.length < 20) bad.push(label + (detail ? ' | ' + detail : '')); }
  }
  const L2 = v2({});
  for(const p of SEMANTIC){
    let want, got, out;
    try{ want = luaRun(p.code); }
    catch(e){ ok(false, p.name, '原程序无法执行: ' + String(e.message).slice(0, 80)); continue; }
    try{ out = L2.compress(p.code).body; }
    catch(e){ ok(false, p.name, '压缩失败: ' + String(e.message).slice(0, 80)); continue; }
    try{ got = luaRun(out); }
    catch(e){ ok(false, p.name, '产物无法执行: ' + String(e.message).slice(0, 80) + ' <- ' + out.slice(0, 80)); continue; }
    ok(want === got, p.name, '实跑输出不一致: 原 ' + JSON.stringify(want) + ' vs 产物 ' + JSON.stringify(got) + ' <- ' + out.slice(0, 90));
  }
  if(bad.length){
    console.log('--- 失败明细 ---');
    bad.forEach(function(b){ console.log('✗', b); });
  }
  return { pass: pass, fail: fail };
}

module.exports = { name: 'parens', run };
