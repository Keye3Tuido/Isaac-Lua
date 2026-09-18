--俄南蘑菇
--限定攻击方式为眼泪


---- 代码效果 ----

--===--
--[[
模板: safe-wrap-mec
名称: 安全包装
]]

--[[
说明: 启用安全包装。
依赖: [安全包装]
]]
l MEC()

--[[
模板: clean-anon-callbacks
名称: 清理回调
]]

--[[
说明: 游戏胜利后自动清除代码效果; 长按重开键10秒自动清空代码效果。
依赖: [安全包装, 清理回调]
]]
l CLM()local I,M,A,T,F=Isaac,ModCallbacks T=I.GetTime F=T()A=I.AddCallback A({},M.MC_POST_GAME_END,function(_,f)if not f then DEMEC()CLM()end end)A({},M.MC_POST_RENDER,function(p)p=T()for i=1,Game():GetNumPlayers()do if Input.IsActionPressed(ButtonAction.ACTION_RESTART,I.GetPlayer(i).ControllerIndex)then if p-F>=1e4 then DEMEC()CLM()Game():FinishChallenge()Game():Fadeout(1,2)end return end end F=p end)

--[[
模板: lock-achievements
]]
--===--
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

--===--
--[[
模板: restart-game
说明: 重开一局新游戏。
]]
