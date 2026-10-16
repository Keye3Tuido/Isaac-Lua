// tests2/regression/canonical_fwdnil.js — v1 tests/test_canonical_fwdnil.js 的 v2 移植
// 前向 nil 归一的【验证器守卫】：v2 终审委托 v1 canonical，这些 POS/NEG 用例
// 守护的正是 hoist.fwdNil/placeholderHoist 互逆对依赖的等价理论——NEG 误判=不安全。
'use strict';
const lp = require('../../node_modules/luaparse');
const f = require('fengari');
const L = require('../../src2/base.js').create({ luaparse: lp, fengari: f });

function run(){
  let pass = 0, fail = 0;
  const bad = [];
  function eq(a, b){ return L._canonical(a) === L._canonical(b); }
  function pos(label, a, b){ if(eq(a,b)) pass++; else { fail++; bad.push('POS ' + label); } }
  function neg(label, a, b){ if(!eq(a,b)) pass++; else { fail++; bad.push('NEG ' + label + '（误判等价=不安全！）'); } }

  // POSITIVE
  pos('basic single', "local x,y=1 f(x) y=2 g(y)", "local x=1 f(x) local y=2 g(y)");
  pos('batched ride', "local a,b,y=1,2 use(a,b) y=3 use(y)", "local a,b=1,2 use(a,b) local y=3 use(y)");
  pos('two fwd', "local p,q,r=1 g(p) q=2 r=3 h(q,r)", "local p=1 g(p) local q=2 local r=3 h(q,r)");
  pos('unrelated between', "local x,z=1 print(x) print(x) z=9 print(z)", "local x=1 print(x) print(x) local z=9 print(z)");
  pos('reassign after', "local x,y=0 f(x) y=1 y=2 g(y)", "local x=0 f(x) local y=1 y=2 g(y)");
  pos('multi basic', "local a,x,y=1 f(a) x,y=2,3 g(x,y)", "local a=1 f(a) local x,y=2,3 g(x,y)");
  pos('multi batched ride', "local a,b,x,y=1,2 use(a,b) x,y=3,4 use(x,y)", "local a,b=1,2 use(a,b) local x,y=3,4 use(x,y)");
  pos('multi chain-alias shape', "local b,a,f,g=M,C f,g=U.N,I.A g(b,f)", "local b,a=M,C local f,g=U.N,I.A g(b,f)");
  // NEGATIVE
  neg('read between', "local x,y=1 f(y) y=2 g(y)", "local x=1 f(y) local y=2 g(y)");
  neg('captured before', "local x,y=1 local fn=function() return y end y=2 fn()", "local x=1 local fn=function() return y end local y=2 fn()");
  neg('self in rhs', "local x,y=1 y=(y or 5) g(y)", "local x=1 local y=(y or 5) g(y)");
  // dead-pure 归一扩展（隐式 nil 少值声明可消）后：左 y（隐式 nil、无使用）与右 y=2
  // （无使用纯值）均被消解，两侧判等价——语义安全（y 为局部且无任何使用点，无可观察差异；
  // 若有使用则 dead-pure 不含 y，NEG 仍成立）。fwd-nil 归一本身并未误动 y（找不到首次赋值）。
  pos('no assignment (dead-pure 消解后等价)', "local x,y=1 g(x)", "local x=1 g(x) local y=2");
  neg('different value', "local x,y=1 f(x) y=2 g(y)", "local x=1 f(x) local y=3 g(y)");
  neg('read in nested if', "local x,y=1 if cond then h(y) end y=2 g(y)", "local x=1 if cond then h(y) end local y=2 g(y)");
  neg('multi read between', "local a,x,y=1 f(x) x,y=2,3 g(x,y)", "local a=1 f(x) local x,y=2,3 g(x,y)");
  neg('multi rhs refs placeholder', "local a,x,y=1 x,y=y,3 g(x,y)", "local a=1 local x,y=y,3 g(x,y)");
  neg('multi swapped values', "local a,x,y=1 x,y=2,3 g(x,y)", "local a=1 local x,y=3,2 g(x,y)");
  neg('multi captured before', "local a,x,y=1 local fn=function() return y end x,y=2,3 fn()", "local a=1 local fn=function() return y end local x,y=2,3 fn()");

  bad.forEach(function(b){ console.log('✗', b); });
  return { pass, fail };
}

module.exports = { name: 'canonical_fwdnil', run };
