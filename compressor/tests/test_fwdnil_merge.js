// 回归专项：noMetatable 路径上的两处漏优化
//  ① 前向 nil 多目标赋值整体下沉（foldFwdNilInline 多目标版）：
//     1.7b 声明上提把 `local f,g=...` 降级为 `f,g=...` 后，1.7d 应把 RHS 按位并回头部
//     local（`local b,a,f,g=MC,CT f,g=UF,IAC` → `local b,a,f,g=MC,CT,UF,IAC`），
//     而不是留下分裂的「声明 + 赋值」两句。
//  ② 字段前缀折叠等 pass 构造 newAlias 时必须传播 chainAliasByLocal / transparentAliases，
//     否则成员链 CSE（noMetatable 1.1c2）之后，字段前缀折叠（1.3）/ 字面量内联（1.4b）/
//     字符串因子（1.4c）/ method 折叠（1.2）的 canonical 等价校验恒失败、永远无法提交。
// 每个用例校验：canonical 等价 + 幂等（严格固定点）+ 输出长度上界。
const luaparse = require('luaparse');
const fengari = require('fengari');
require('../core.js');
const LuaMin = globalThis.LuaMin.create(luaparse, fengari);

function bodyOf(s) { return s.indexOf('l ') === 0 ? s.slice(2) : s; }

// 复现输入（以撒 How to Jump 模组片段）：三处 a.COLLECTIBLE_* + 两条成员链别名。
const REPRO = "Isaac.AddCallback({},ModCallbacks.MC_USE_ITEM,function(_,_,_,p)p:UseActiveItem(CollectibleType.COLLECTIBLE_TAMMYS_HEAD,UseFlag.USE_NOANIM)p:GetData().H2J=14+Game():GetFrameCount()end,CollectibleType.COLLECTIBLE_HOW_TO_JUMP)Isaac.AddCallback({},ModCallbacks.MC_POST_PLAYER_UPDATE,function(d,p)d=p:GetData()if d.H2J and d.H2J<=Game():GetFrameCount()then p:UseActiveItem(CollectibleType.COLLECTIBLE_WAIT_WHAT,UseFlag.USE_NOANIM)d.H2J=nil end end)";

const cases = [
  // ② 的端到端复现：noMetatable 下字段前缀因子必须被提取，且声明合并后 ≤393（含 'l '）。
  { name: '复现:noMetatable+search32 ≤393', code: REPRO, opts: { noMetatable: true, searchLevel: 32 }, maxLen: 393,
    mustContain: "'COLLECTIBLE_'" },
  // 纯规则系统（关搜索）同样命中两处优化。
  { name: '复现:noMetatable 规则系统 ≤393', code: REPRO, opts: { noMetatable: true }, maxLen: 393,
    mustContain: "'COLLECTIBLE_'" },
  // 默认模式不退化：历史输出 413，只允许更短。
  { name: '复现:默认模式不退化 ≤413', code: REPRO, opts: {}, maxLen: 413 },
  { name: '复现:默认+search32 不退化 ≤413', code: REPRO, opts: { searchLevel: 32 }, maxLen: 413 },

  // ① 的合成形态：上提产生的多目标赋值应被并回头部 local。
  // memberChain 提取两条整链别名 → declHoist 上提为 `f,g=...` → fwdNilInline 并回。
  { name: '多目标下沉:链别名并回头部', code: REPRO, opts: { noMetatable: true }, maxLen: 393,
    // 头部必须是一条 local 直接带全部值，不允许残留 ` f,g=UseFlag` 赋值句
    mustNotMatch: /local [^\n]*\w,\w=UseFlag\.USE_NOANIM,Isaac\.AddCallback/ },

  // 安全负例：nil 占位变量在赋值前被读 → 不得下沉（输出仍须等价、合法）。
  { name: '安全:读在赋值前不下沉', code: 'local a=Game() local x=Isaac print(x) local y=Isaac x,y=a,y print(x,y)', opts: {}, maxLen: 999 },

  // 安全负例：多目标 RHS 引用同条 local 的占位变量 → 不得下沉。
  { name: '安全:RHS引用占位变量不下沉', code: 'local a=Game() local x=Isaac local y=Isaac x,y=y,a print(x,y)', opts: {}, maxLen: 999 },
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
  let lenOk = out1.length <= c.maxLen;
  let containOk = !c.mustContain || out1.indexOf(c.mustContain) >= 0;
  let notMatchOk = !c.mustNotMatch || !c.mustNotMatch.test(out1);
  const ok = eq && idem && lenOk && containOk && notMatchOk;
  if (ok) { pass++; console.log('✓ ' + c.name + '  (' + out1.length + ' 字) 等价+幂等'); }
  else {
    fail++;
    console.log('✗ ' + c.name + ' eq=' + eq + ' idem=' + idem + ' lenOk=' + lenOk +
      '(' + out1.length + '<=' + c.maxLen + ') containOk=' + containOk + ' notMatchOk=' + notMatchOk +
      '\n   ->  ' + out1);
  }
}

console.log('=== fwdnil-merge / chain-alias propagation: ' + pass + ' pass, ' + fail + ' fail ===');
process.exit(fail ? 1 : 0);
