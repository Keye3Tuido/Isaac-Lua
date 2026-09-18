--影流之主
--限定角色：堕化犹大


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
模板: blind-permanent
说明: 所有玩家永久蒙眼（在矿洞逃亡中不生效）。
]]

--[[
模板: replace-collectibles
参数: {P1: "468", P2: "道具468(阴影)"}
]]

--[[
模板: force-give-items
参数:
  P1: "'c467'"
  P2: "道具467(手指)"
]]

--[[
说明: 阴影永不瓦解，且更新频率增加
]]
l local E={}Isaac.AddCallback({},ModCallbacks.MC_FAMILIAR_UPDATE,function(h,p,t)h=GetPtrHash(p)if not E[h]then E[h]=true for _=1,2 do p:Update()end t,E[h]={}for k,v in pairs(E)do if v then t[k]=v end end E=t end p.SubType=0 p.State=0 end,FamiliarVariant.SHADE)

--[[
模板: remove-collectibles
说明: 移除所有绕过蒙眼输出的道具
参数:
  P1: "360,399,640,643,680,696,698"
  P2: "所有绕过蒙眼输出的道具"
]]

--[[
模板: force-character
说明: 强制角色为堕化犹大。
参数: {P1: "PlayerType.PLAYER_JUDAS_B"}
]]

--[[
模板: fly-permanent
说明: 玩家永久飞行。
]]

--===--
--[[
模板: restart-as-character
说明: 以堕化犹大重开一局新游戏。
参数: {P1: "PlayerType.PLAYER_JUDAS_B"}
]]
