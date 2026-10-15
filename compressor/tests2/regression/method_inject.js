// tests2/regression/method_inject.js — v1 tests/test_method_inject.js 的 v2 移植
// 方法折叠/成员字段折叠的「注入已有 local」形态：v2 由 mkAliasDecl 智能声明 +
// hoist.localsMerge 不动点组合实现（不再是各 pass 手工搬运）。
'use strict';
const { runCases } = require('./_v2harness.js');

const REPRO = "local a,c=Isaac,ModCallbacks local g,h,i=EntityType.ENTITY_STONE_EYE,a.AddCallback,a.FindByType h({},c.MC_POST_UPDATE,function(r)r=Game():GetRoom()if 1>#i(g)then a.Spawn(g,0,0,a.GetFreeNearPosition((r:GetGridPosition(r:GetGridSize()-1)+r:GetGridPosition(0))/2,0),Vector.Zero,nil)end end)h({},c.MC_NPC_UPDATE,function(_,e)if i(e.Type)[1].InitSeed==e.InitSeed then e.State=4 end end,g)";

function run(){
  return runCases([
    // 方法折叠注入头部 batched local
    { name: '复现:方法折叠注入头部 ≤383', code: REPRO, opts: {}, maxLen: 383,
      mustContain: "'GetGridPosition'" },
    { name: '复现:noMetatable ≤383', code: REPRO, opts: { noMetatable: true }, maxLen: 383,
      mustContain: "'GetGridPosition'" },
    // 最小用例：无头部别名，注入顶层首条普通 local
    // 最小用例：无头部别名，注入顶层首条普通 local。
    // v2 移植注：v2 用【前插】注入（local a,r='M',Game()），与 v1 的尾插形态
    // （local r,a=Game(),'M'）等价同长——mustContain 放宽为两种形态均可。
    { name: '最小:注入普通local', code: "local r=Game() r:GetGridPosition(0) r:GetGridPosition(1)",
      opts: {}, maxLen: 55, mustContain: "'GetGridPosition'" },
    { name: '最小×3:注入普通local', code: "local r=Game() r:GetGridPosition(0) r:GetGridPosition(1) r:GetGridPosition(2)",
      opts: {}, maxLen: 64, mustContain: "'GetGridPosition'" },
    // 头部 batched local 注入（plan 别名头）
    { name: '注入plan别名头', code: "local a,c=Isaac,ModCallbacks local r=Game():GetRoom() print(r:GetGridPosition(0)) print(r:GetGridPosition(1))",
      opts: {}, maxLen: 106, mustContain: "'GetGridPosition'" },
    // 任意 base（调用链[1]）成员字段折叠：×3 处经济性为正
    { name: '成员字段:任意base可折叠', code: "local i,e=FindByType,Ent print(i(e)[1].InitSeed) print(i(e)[2].InitSeed) print(e.InitSeed)",
      opts: {}, maxLen: 81, mustContain: "[1][" },
    // 经济性负例：×2 净亏不折叠
    { name: '成员字段:×2净亏不折叠', code: "local i,e=FindByType,Ent if i(e.Type)[1].InitSeed==e.InitSeed then e.State=4 end",
      opts: {}, maxLen: 999, mustNotMatch: /'InitSeed'/ },
    // 安全负例：init 数 < 变量数 → 拒绝注入（s 依赖 Game() 第二返回值）
    // 安全负例：init 数 < 变量数 → v1 拒绝【尾插】注入（s 会错位读到别名值）。
    // v2 移植注：v2 的注入是【前插】（local a,r,s='M',Game()——a 占位不抢值，
    // r/s 的 Game() 返回值截断不变），语义安全且更短；该断言改为校验产物等价 +
    // 不含尾插错位形态（,'M' 出现在 Game() 之后才是危险形态）。
    { name: '安全:init数不足不注入', code: "local r,s=Game() r:GetGridPosition(0) r:GetGridPosition(1) print(s)",
      opts: {}, maxLen: 999, mustNotMatch: /Game\(\),'GetGridPosition'/ },
    // 安全负例：用点在声明语句内 → 拒绝注入
    { name: '安全:用点在声明语句内不注入', code: "local q=r:GetGridPosition(0) print(r:GetGridPosition(1))",
      opts: {}, maxLen: 999, mustNotMatch: /,'GetGridPosition'/ },
    // 安全负例：首条语句是 local function → 拒绝注入
    { name: '安全:local function不注入', code: "local function f()end local r=Game() r:GetGridPosition(0) r:GetGridPosition(1)",
      opts: {}, maxLen: 999, mustNotMatch: /,'GetGridPosition'/ },
  ]);
}

module.exports = { name: 'method_inject', run };
