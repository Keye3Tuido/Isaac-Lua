--俄南蘑菇
--限定攻击方式为眼泪

--[[
模板: tear-miss-action
说明: 玩家的眼泪未命中实体时，使用一次致幻蘑菇
参数:
  P1: "t=t.SpawnerEntity if t then t:ToPlayer():UseActiveItem(CollectibleType.COLLECTIBLE_WAVY_CAP,UseFlag.USE_NOANIM)end"
]]

--[[
模板: force-give-items
参数:
  P1: "'c69'"
  P2: "道具69(巧克力牛奶)"
]]

--[[
模板: remove-collectibles
参数:
  P1: "52,68,114,118,152,168,244,329,399,579,640,643,678,696"
  P2: "可绕过眼泪输出的道具"
]]

--[[
说明: 每到达新的一层时，清理所有玩家的致幻层数
]]
l Isaac.AddCallback({},ModCallbacks.MC_POST_NEW_LEVEL,function(p,a,b)a=CollectibleType.COLLECTIBLE_WAVY_CAP b=NullItemID.ID_WAVY_CAP_1 for i=1,Game():GetNumPlayers()do p=Isaac.GetPlayer(i-1):GetEffects()p:RemoveCollectibleEffect(a,p:GetCollectibleEffectNum(a))p:RemoveNullEffect(b,p:GetNullEffectNum(b))end end)

--[[
模板: restart-game
]]
