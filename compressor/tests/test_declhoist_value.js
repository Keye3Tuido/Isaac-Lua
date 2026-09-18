// 回归专项：foldDeclHoist 值粒度部分上提（mixed 路径）
//  背景：声明上提原是「整条声明」粒度——`local g,h,i=V0,V1,V2` 全提（前向 nil 占位 +
//  降级赋值）等长不赚，故不提。值粒度上提按值分类：不引用「头部/同语句声明变量」且
//  形态为纯访问链/字面量的值（如 V0）直接并入头部值列表（inline）；引用头部变量的
//  值（V1=a.M1）对应的变量前向 nil 占位、原地降级赋值补齐。与 foldFwdNilInline（下沉）
//  的关系：占位值的 RHS 必引用头部/同语句 binding（refsAnyBinding 拒绝沉回），已进
//  头部的 inline 值不是 nil 占位（不参与下沉），两方向收敛不打架，迭代固定点稳定。
//  mixed 语句限制：变量数 ≤4 且与头部（传递）相邻；值形态仅纯访问链/字面量（拼接/
//  调用/函数会干扰头部字符串因子分解且求值提前风险高）。无 inline 的语句走 legacy
//  纯占位路径（旧行为：全部变量合格且不被闭包捕获）。full/legacy 双候选分别过三重
//  验证后取更短，保证不退旧收益。
// 每个用例校验：canonical 等价 + 幂等（严格固定点）+ 输出长度上界。
const luaparse = require('luaparse');
const fengari = require('fengari');
require('../core.js');
const LuaMin = globalThis.LuaMin.create(luaparse, fengari);

function bodyOf(s) { return s.indexOf('l ') === 0 ? s.slice(2) : s; }

// 端到端复现（382 → 380）：g 的值不引用头部变量可 inline，h,i 引用 a 须占位
const REPRO = "local a,c=Isaac,ModCallbacks local g,h,i=EntityType.ENTITY_STONE_EYE,a.AddCallback,a.FindByType h({},c.MC_POST_UPDATE,function(r)r=Game():GetRoom()if 1>#i(g)then a.Spawn(g,0,0,a.GetFreeNearPosition((r:GetGridPosition(r:GetGridSize()-1)+r:GetGridPosition(0))/2,0),Vector.Zero,nil)end end)h({},c.MC_NPC_UPDATE,function(_,e)if i(e.Type)[1].InitSeed==e.InitSeed then e.State=4 end end,g)";
// 用户手压 380 形态（验证幂等固定点）
const HAND = "local a,c,g,b,h,i=Isaac,ModCallbacks,EntityType.ENTITY_STONE_EYE,'GetGridPosition'h,i=a.AddCallback,a.FindByType h({},c.MC_POST_UPDATE,function(r)r=Game():GetRoom()if 1>#i(g)then a.Spawn(g,0,0,a.GetFreeNearPosition((r[b](r,r:GetGridSize()-1)+r[b](r,0))/2,0),Vector.Zero,nil)end end)h({},c.MC_NPC_UPDATE,function(_,e)if i(e.Type)[1].InitSeed==e.InitSeed then e.State=4 end end,g)";

const cases = [
  // 复现：default 与 noMetatable+K32 均 ≤380
  { name: '复现:default ≤380', code: REPRO, opts: {}, maxLen: 380,
    mustContain: ",EntityType.ENTITY_STONE_EYE,'GetGridPosition'h,i=a.AddCallback" },
  { name: '复现:noMetatable+K32 ≤380', code: REPRO, opts: { noMetatable: true, searchLevel: 32 }, maxLen: 380 },
  // 手压形态幂等 380
  { name: '手压380幂等', code: HAND, opts: {}, maxLen: 380,
    mustContain: "h,i=a.AddCallback,a.FindByType" },

  // 通用：x、z 可提（V0、V2 不引用头部变量），y 占位（a.M1 引用头部 a）
  { name: '通用:x,z提y占位', code: "local a=G1 local x,y,z=V0,a.M1,V2 print(x,y,z)",
    opts: {}, maxLen: 44, mustContain: "y=a.M1" },

  // 安全负例：循环体内的声明不上提
  { name: '安全:循环体不上提', code: "local a=G1 for k=1,2 do local x,y=V0,a.M1 print(x,y) end",
    opts: {}, maxLen: 999, mustNotMatch: /local a,x/ },

  // 安全负例：值引用同语句变量 → 该值不可 inline（y.M1 的 y 是同语句声明）
  { name: '安全:引用同语句变量不inline', code: "local a=G1 local x,y,z=V0,y.M1,V2 print(x,y,z)",
    opts: {}, maxLen: 999, mustNotMatch: /local a,x,z,y=G1,V0,V2\b/ },

  // 安全负例：拼接值不 inline（干扰头部字符串因子分解 + 求值提前风险）
  { name: '安全:拼接值不inline', code: "local a='PRE' local x,y=a..'1',a..'2' print(x,y)",
    opts: {}, maxLen: 999, mustNotMatch: /local a,x,y='PRE',a\.\.'1',a\.\.'2'/ },

  // 安全负例：中间语句读同名全局（占位上提会把全局读变局部 nil 读）→ canonical 拒绝
  { name: '安全:中间读同名不mixed', code: "local a=G1 print(y) local x,y=V0,a.M1 print(x,y)",
    opts: {}, maxLen: 999, mustNotMatch: /local a,x,y/ },

  // 收敛：占位 RHS 引用头部变量 → fwdNilInline 不得沉回（输出保持 h,i= 赋值形态）
  { name: '收敛:占位不沉回', code: REPRO, opts: {}, maxLen: 380,
    mustContain: "h,i=a.AddCallback,a.FindByType" },
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

console.log('=== declhoist-value-grain: ' + pass + ' pass, ' + fail + ' fail ===');
process.exit(fail ? 1 : 0);
