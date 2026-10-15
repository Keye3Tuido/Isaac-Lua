// tests2/regression/member_chain.js — v1 tests/test_member_chain.js 的 v2 移植
// 成员链 CSE：safe 模式（纯局部+无元表证明）+ noMetatable 模式。
// v1 失败例「逃逸不折叠」（eq=false 于 print((t).x)）在 v2 必须转绿——
// v2 纯度证据单一实现（IR 证据槽 metatableFree），逃逸形式根本不会被折叠。
'use strict';
const { runCases } = require('./_v2harness.js');

function run(){
  return runCases([
    { name: '纯局部链CSE(提取t.data.pos)', code: 'local t={data={pos={x=1}}}local a=t.data.pos local b=t.data.pos local c=t.data.pos', opts: {} },
    { name: '深链读CSE(t.a.b.c)', code: 'local p=print local t={a={b={c=42}}}p(t.a.b.c)p(t.a.b.c)p(t.a.b.c)', opts: {} },
    { name: '有写不折叠', code: 'local t={x=1}t.x=5 print(t.x)print(t.x)', opts: {} },
    // v1 失败例：逃逸（u=t）后 v1 产出 canonical 误判的 print((t).x)；v2 不得折叠且等价+幂等
    { name: '逃逸不折叠', code: 'local t={x=1}print(t.x)local u=t print(u.x)', opts: {} },
    { name: 'setmetatable出现不折叠', code: 'local t={x=1}setmetatable(t,{})print(t.x)print(t.x)', opts: {} },
    { name: '无元表模式折叠全局链', code: 'print(Game.GetRoom)print(Game.GetRoom)', opts: { noMetatable: true } },
    { name: '无元表模式折叠局部(非字面量init)', code: 'local t=f() print(t.data)print(t.data)print(t.data)', opts: { noMetatable: true } },
    { name: '关成员字段折叠整链提取(Isaac.AddCallback)', code: 'Isaac.AddCallback(a.bcd)'.repeat(25), opts: { noMetatable: true, memberFold: false } },
  ]);
}

module.exports = { name: 'member_chain', run };
