--挑战名称
--禁用角色：
--限定角色：
--禁止难度：
--限定难度：


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
说明: |-
  代码模板(总字数指排除XXX,func,arg外的总字数)
  回调数N=1 | 总字数=35
]]
l Isaac.AddCallback({},ModCallbacks.XXX,func,arg)

--[[
说明: 2<=回调数N<=4 | 总字数=41+8N
]]
l local A,M=Isaac.AddCallback,ModCallbacks;A({},M.XXX,func,arg)

--[[
说明: 4<=回调数N<=10 | 总字数=45+7N
]]
l local A,M,T=Isaac.AddCallback,ModCallbacks,{}A(T,M.XXX,func,arg)

--[[
说明: 10<=回调数N | 总字数=65+5N
]]
l local M,A=ModCallbacks,function(...)Isaac.AddCallback({},...)end;A(M.XXX,func,arg)

--===--
--[[
模板: restart-game
]]
