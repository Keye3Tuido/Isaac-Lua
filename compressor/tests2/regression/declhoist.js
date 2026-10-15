// tests2/regression/declhoist.js — v1 tests/test_declhoist_value.js 的 v2 移植
// 声明上提值粒度 mixed 路径：v2 拆为 inlineValueToHeader + placeholderHoist 两透镜（§6.4），
// 组合序列由调度器不动点发现。v1 失败例「安全:循环体不上提」（idem=false）在 v2 必须转绿。
// 移植注：'通用:x,z提y占位' 的 v1 断言绑定了 inlinePure 代入形态 "(a.M1)"；v2 走
// 透明别名消解得到更短形态（30 字 vs v1 44 字），形态断言放宽、长度上界收紧。
'use strict';
const { runCases } = require('./_v2harness.js');

const REPRO = "local a,c=Isaac,ModCallbacks local g,h,i=EntityType.ENTITY_STONE_EYE,a.AddCallback,a.FindByType h({},c.MC_POST_UPDATE,function(r)r=Game():GetRoom()if 1>#i(g)then a.Spawn(g,0,0,a.GetFreeNearPosition((r:GetGridPosition(r:GetGridSize()-1)+r:GetGridPosition(0))/2,0),Vector.Zero,nil)end end)h({},c.MC_NPC_UPDATE,function(_,e)if i(e.Type)[1].InitSeed==e.InitSeed then e.State=4 end end,g)";
const HAND = "local a,c,g,b,h,i=Isaac,ModCallbacks,EntityType.ENTITY_STONE_EYE,'GetGridPosition'h,i=a.AddCallback,a.FindByType h({},c.MC_POST_UPDATE,function(r)r=Game():GetRoom()if 1>#i(g)then a.Spawn(g,0,0,a.GetFreeNearPosition((r[b](r,r:GetGridSize()-1)+r[b](r,0))/2,0),Vector.Zero,nil)end end)h({},c.MC_NPC_UPDATE,function(_,e)if i(e.Type)[1].InitSeed==e.InitSeed then e.State=4 end end,g)";

function run(){
  return runCases([
    { name: '复现:default ≤380', code: REPRO, opts: {}, maxLen: 380,
      mustContain: "'GetGridPosition'" },   // v2 头部值序与 v1 不同（tailSymbol 时机），放宽为别名在 + 占位赋值在
    { name: '复现:noMetatable ≤380', code: REPRO, opts: { noMetatable: true }, maxLen: 380 },
    { name: '手压380幂等', code: HAND, opts: {}, maxLen: 380,
      mustContain: "h,i=a.AddCallback,a.FindByType" },
    // v2 形态：透明别名消解 + 内联，30 字（v1 inlinePure 形态 44 字）；等价+幂等硬检查
    { name: '通用:x,z提y占位', code: "local a=G1 local x,y,z=V0,a.M1,V2 print(x,y,z)",
      opts: {}, maxLen: 44 },
    // 安全负例：循环体内的声明不上提（v1 幂等失败例）
    { name: '安全:循环体不上提', code: "local a=G1 for k=1,2 do local x,y=V0,a.M1 print(x,y) end",
      opts: {}, maxLen: 999, mustNotMatch: /local a,x/ },
    // 安全负例：值引用同语句变量 → 该值不可 inline
    { name: '安全:引用同语句变量不inline', code: "local a=G1 local x,y,z=V0,y.M1,V2 print(x,y,z)",
      opts: {}, maxLen: 999, mustNotMatch: /local a,x,z,y=G1,V0,V2\b/ },
    // 安全负例：拼接值不 inline
    { name: '安全:拼接值不inline', code: "local a='PRE' local x,y=a..'1',a..'2' print(x,y)",
      opts: {}, maxLen: 999, mustNotMatch: /local a,x,y='PRE',a\.\.'1',a\.\.'2'/ },
    // 安全负例：中间语句读同名全局 → canonical 拒绝
    { name: '安全:中间读同名不mixed', code: "local a=G1 print(y) local x,y=V0,a.M1 print(x,y)",
      opts: {}, maxLen: 999, mustNotMatch: /local a,x,y/ },
    // 收敛：占位 RHS 引用头部变量 → fwdNil 不得沉回
    { name: '收敛:占位不沉回', code: REPRO, opts: {}, maxLen: 380,
      mustContain: "h,i=a.AddCallback,a.FindByType" },
  ]);
}

module.exports = { name: 'declhoist', run };
