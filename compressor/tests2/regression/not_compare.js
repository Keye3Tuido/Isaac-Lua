// tests2/regression/not_compare.js — norm.notCompare + earlyReturn 主块扩展回归
// 覆盖：not(x==y)→x~=y（双向）、守卫条件为比较时的折叠+取反联动、主块守卫折叠。
'use strict';
const { runCases } = require('./_v2harness');

function run(){
  const cases = [
    { name: 'not(x==y)→x~=y', code: 'l if not(x==y) then print(x) end', mustNotMatch: /not/ },
    { name: 'not(x~=y)→x==y', code: 'l if not(x~=y) then print(x) end', mustNotMatch: /not/ },
    { name: 'not((a+b)==c)→a+b~=c', code: 'l if not((a+b)==c) then print(x) end', mustNotMatch: /not/ },
    { name: 'not((a==b)==c) 链式比较', code: 'l if not((a==b)==c) then print(x) end', mustNotMatch: /not/ },
    { name: 'not(x<y) 不动', code: 'l if not(x<y) then print(x) end', mustContain: 'not' },
    { name: '主块守卫折叠', code: 'l if x then return end print(x)', mustNotMatch: /then return end/ },
    { name: '主块守卫(比较)→取反', code: 'l if x==y then return end print(x)', mustNotMatch: /then return end|not/ },
    { name: '函数守卫(比较)→取反', code: 'l function f(x) if x==y then return end print(x) end', mustNotMatch: /then return end|not/ },
    { name: '循环 break 守卫(比较)→取反', code: 'l while 1 do if x==y then break end print(x) end', mustNotMatch: /then break end|not/ },
    { name: '多重守卫合并', code: 'l function f(x) if x then return end if y then return end print(x) end', mustNotMatch: /then return end/ },
    { name: '德摩根不变方向保留', code: 'l return not a or not b', mustContain: 'not(' }
  ];
  const res = runCases(cases.map(function(c){ return { name: c.name, code: c.code, opts: {}, mustContain: c.mustContain, mustNotMatch: c.mustNotMatch }; }));
  console.log('[not_compare] pass', res.pass, ' fail', res.fail, ' pending', res.pending);
  return res;
}

module.exports = { name: 'not_compare', run };
