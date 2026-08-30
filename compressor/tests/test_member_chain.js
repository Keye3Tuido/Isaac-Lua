// 成员链冗余消除（CSE）专项：safe 模式（纯局部，无元表证明）+ 无元表模式。
// 校验：压缩结果与原始输入 canonical 等价 + 压缩结果再压缩幂等（严格固定点）。
const luaparse = require('luaparse');
const fengari = require('fengari');
require('../core.js');
const LuaMin = globalThis.LuaMin.create(luaparse, fengari);

function bodyOf(s) { return s.indexOf('l ') === 0 ? s.slice(2) : s; }

const cases = [
  { name: '纯局部链CSE(提取t.data.pos)', code: 'local t={data={pos={x=1}}}local a=t.data.pos local b=t.data.pos local c=t.data.pos', opts: {} },
  { name: '深链读CSE(t.a.b.c)', code: 'local p=print local t={a={b={c=42}}}p(t.a.b.c)p(t.a.b.c)p(t.a.b.c)', opts: {} },
  { name: '有写不折叠', code: 'local t={x=1}t.x=5 print(t.x)print(t.x)', opts: {} },
  { name: '逃逸不折叠', code: 'local t={x=1}print(t.x)local u=t print(u.x)', opts: {} },
  { name: 'setmetatable出现不折叠', code: 'local t={x=1}setmetatable(t,{})print(t.x)print(t.x)', opts: {} },
  { name: '无元表模式折叠全局链', code: 'print(Game.GetRoom)print(Game.GetRoom)', opts: { noMetatable: true } },
  { name: '无元表模式折叠局部(非字面量init)', code: 'local t=f() print(t.data)print(t.data)print(t.data)', opts: { noMetatable: true } },
  { name: '关成员字段折叠整链提取(Isaac.AddCallback)', code: 'Isaac.AddCallback(a.bcd)'.repeat(25), opts: { noMetatable: true, memberFold: false } },
];

let pass = 0, fail = 0;
for (const c of cases) {
  const pre = LuaMin._preprocess(c.code);
  let r1, r2;
  try { r1 = LuaMin.compress(pre, c.opts); }
  catch (e) { fail++; console.log('✗ ' + c.name + ' 压缩失败: ' + e.message); continue; }
  const out1 = r1.output;
  const b1 = bodyOf(out1);
  let eq = false;
  try {
    eq = LuaMin._canonical(pre) === (r1.aliasMapInfo ? LuaMin._canonical(b1, r1.aliasMapInfo) : LuaMin._canonical(b1));
  } catch (e) { eq = false; }
  let idem = false;
  try { r2 = LuaMin.compress(LuaMin._preprocess(out1), c.opts); idem = (out1 === r2.output); }
  catch (e) { idem = false; }
  const ok = eq && idem;
  if (ok) { pass++; console.log('✓ ' + c.name + '  (' + r1.bodyLength + ' 字) 等价+幂等'); }
  else { fail++; console.log('✗ ' + c.name + ' eq=' + eq + ' idem=' + idem + '  ->  ' + out1); }
}

console.log('=== member-chain CSE: ' + pass + ' pass, ' + fail + ' fail ===');
process.exit(fail ? 1 : 0);
