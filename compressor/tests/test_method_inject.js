// 回归专项：foldMethods / foldMemberField 的「注入已有 local」形态
//  ① foldMethods 的长度闸门原先用「独立 local 声明」计价（+26），漏掉真实净省的方法折叠。
//     现在优先注入已有 local 尾部（',a='M''，省 6 字）：先尝试 dropLeading 头部 batched
//     local，其次顶层首条普通 local（init 数 ≥ 变量数、无 FunctionDeclaration 初值、
//     改写点不落在语句内部），最后才退回独立 local；三形态都过三重校验 + 只缩短闸门。
//  ② foldMemberField 同步获得注入形态；其 base 本就支持任意表达式
//    （collectMemberAccess 无 base 限制，canonical.js 的 memberByLocal 还原对任意 base
//     生效），复现里 `i(e.Type)[1].InitSeed` 不折叠是纯经济性：×2 处省 12 < 注入成本 13。
// 每个用例校验：canonical 等价 + 幂等（严格固定点）+ 输出长度上界。
const luaparse = require('luaparse');
const fengari = require('fengari');
require('../core.js');
const LuaMin = globalThis.LuaMin.create(luaparse, fengari);

function bodyOf(s) { return s.indexOf('l ') === 0 ? s.slice(2) : s; }

// 缺陷 1 的端到端复现（385 → 382，含 'l ' 前缀）
const REPRO = "local a,c=Isaac,ModCallbacks local g,h,i=EntityType.ENTITY_STONE_EYE,a.AddCallback,a.FindByType h({},c.MC_POST_UPDATE,function(r)r=Game():GetRoom()if 1>#i(g)then a.Spawn(g,0,0,a.GetFreeNearPosition((r:GetGridPosition(r:GetGridSize()-1)+r:GetGridPosition(0))/2,0),Vector.Zero,nil)end end)h({},c.MC_NPC_UPDATE,function(_,e)if i(e.Type)[1].InitSeed==e.InitSeed then e.State=4 end end,g)";

const cases = [
  // ① 复现：方法折叠注入头部 batched local（',b='GetGridPosition''），≤383
  { name: '复现:方法折叠注入头部 ≤383', code: REPRO, opts: {}, maxLen: 383,
    mustContain: "'GetGridPosition'" },
  { name: '复现:noMetatable+K32 ≤383', code: REPRO, opts: { noMetatable: true, searchLevel: 32 }, maxLen: 383,
    mustContain: "'GetGridPosition'" },

  // ① 最小用例：无头部 local，注入顶层首条普通 local（init 数对齐，末值是调用也安全）
  { name: '最小:注入普通local', code: "local r=Game() r:GetGridPosition(0) r:GetGridPosition(1)",
    opts: {}, maxLen: 55, mustContain: ",a=Game(),'GetGridPosition'" },
  // ×3 次：旧路径靠 foldLocals 合并救回，新路径直接注入（结果同长或更短）
  { name: '最小×3:注入普通local', code: "local r=Game() r:GetGridPosition(0) r:GetGridPosition(1) r:GetGridPosition(2)",
    opts: {}, maxLen: 64, mustContain: "'GetGridPosition'" },
  // 头部 batched local 注入（plan 产生的别名头）
  { name: '注入plan别名头', code: "local a,c=Isaac,ModCallbacks local r=Game():GetRoom() print(r:GetGridPosition(0)) print(r:GetGridPosition(1))",
    opts: {}, maxLen: 106, mustContain: "'GetGridPosition'" },

  // ② 任意 base（调用链[1]）的成员字段折叠通路：×3 处经济性为正，必须折叠出 [1][b] 形态
  { name: '成员字段:任意base可折叠', code: "local i,e=FindByType,Ent print(i(e)[1].InitSeed) print(i(e)[2].InitSeed) print(e.InitSeed)",
    opts: {}, maxLen: 81, mustContain: "[1][" },

  // ② 经济性负例：InitSeed ×2 净亏 1 字（省 12 < 注入成本 13），必须保持不折叠
  { name: '成员字段:×2净亏不折叠', code: "local i,e=FindByType,Ent if i(e.Type)[1].InitSeed==e.InitSeed then e.State=4 end",
    opts: {}, maxLen: 999, mustNotMatch: /'InitSeed'/ },

  // 安全负例：`local r,s=Game()` 的 s 依赖 Game() 第二返回值（init 数 < 变量数），
  // 注入会让 s 错位读到 'GetGridPosition' → 必须拒绝注入（canonical 在此形态会误判等价，
  // 故用 mustNotMatch 做语义级守卫）
  { name: '安全:init数不足不注入', code: "local r,s=Game() r:GetGridPosition(0) r:GetGridPosition(1) print(s)",
    opts: {}, maxLen: 999, mustNotMatch: /'GetGridPosition'/ },

  // 安全负例：方法调用点就在首条 local 内部，注入会变成「用点在声明前」读到 nil → 拒绝
  { name: '安全:用点在声明语句内不注入', code: "local q=r:GetGridPosition(0) print(r:GetGridPosition(1))",
    opts: {}, maxLen: 999, mustNotMatch: /,'GetGridPosition'/ },

  // 安全负例：首条语句是 local function（语法上不能追加名字）→ 拒绝注入
  { name: '安全:local function不注入', code: "local function f()end local r=Game() r:GetGridPosition(0) r:GetGridPosition(1)",
    opts: {}, maxLen: 999, mustNotMatch: /,'GetGridPosition'/ },
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

console.log('=== method-inject / member-field-base: ' + pass + ' pass, ' + fail + ' fail ===');
process.exit(fail ? 1 : 0);
