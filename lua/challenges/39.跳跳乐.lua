--跳跳乐


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
说明: 玩家使用道具跳跃教程时，起跳时触发塔米猫的头，落地时触发棉豆
]]
l local b,a,f,g,h=ModCallbacks,CollectibleType,UseFlag.USE_NOANIM,Isaac.AddCallback,'COLLECTIBLE_'g({},b.MC_USE_ITEM,function(_,_,_,p)p:UseActiveItem(a[h..'BUTTER_BEAN'],f)p:GetData().H2J=14+Game():GetFrameCount()end,a[h..'HOW_TO_JUMP'])g({},b.MC_POST_PLAYER_UPDATE,function(d,p)d=p:GetData()if d.H2J and d.H2J<=Game():GetFrameCount()then p:UseActiveItem(a[h..'TAMMYS_HEAD'],f)d.H2J=nil end end)

--[[
模板: force-give-items
参数:
  P1: "'c282'"
  P2: "道具282(跳跃教程)"
]]

--===--
--[[
模板: restart-game
说明: 重开一局新游戏。
]]
