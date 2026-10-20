--彩蛋种子。

--[[
作为模板: true
模板id: seed-fixed
说明: |-
  固定开启指定彩蛋种子。
参数:
  P1: {类型: "彩蛋种子列表", 默认: "SeedEffect.SEED_G_FUEL", 性质: "局部", 说明: "SeedEffect枚举列表"}
]]
l local S={P1}Isaac.AddCallback({},ModCallbacks.MC_POST_UPDATE,function()local D,f=Game():GetSeeds()for _,d in pairs(S)do if D:CanAddSeedEffect(d)then D:AddSeedEffect(d)f=true end end if f then Isaac.ExecuteCommand'restart'end end)
