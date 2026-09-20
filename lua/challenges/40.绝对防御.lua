--绝对防御


---- 代码效果 ----

--===--
--[[
模板: safe-wrap-mec
名称: 安全包装
]]

--[[
说明: "启用安全包装。"
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
]]

--[[
模板: force-give-items
参数:
  P1: "'c467'"
  P2: "道具467(手指!)"
]]

--[[
模板: divine-intervention
]]

--===--
--[[
模板: restart-game
]]
