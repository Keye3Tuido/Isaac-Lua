--眼泪变种强制。

--[[
作为模板: true
模板id: tear-variant-force
说明: |-
  将眼泪强制替换为指定TearVariant。
参数:
  P1: {类型: "眼泪变种枚举", 默认: "TearVariant.CHAOS_CARD", 性质: "局部", 说明: "TearVariant枚举值"}
]]
l Isaac.AddCallback({},ModCallbacks.MC_POST_TEAR_UPDATE,function(v,t)v=P1 if t.Variant~=v and t.SpawnerType==EntityType.ENTITY_PLAYER then t:ChangeVariant(v)end end)
