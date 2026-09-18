--网络延迟


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
模板: input-lag
名称: 输入延迟
参数:
  P1: "15"
  P2: "0.5秒"
]]

--[[
说明: |-
  实时显示当前的输入延迟帧数。
  可在控制台输入lua DisplayLag = {P2} 来关闭显示，{P3}来开启显示。
依赖: [输入延迟]
参数定义:
  P1: {类型: 布尔, 默认: 'true', 性质: 全局, 说明: "全局变量DisplayLag，开关输入延迟显示（true开/false关）"}
  P2: {类型: 描述, 默认: 'false', 性质: 局部, 说明: "说明文本中关闭显示命令的取值"}
  P3: {类型: 描述, 默认: 'true', 性质: 局部, 说明: "说明文本中开启显示命令的取值"}
]]
l DisplayLag=P1;local I=Isaac I.AddCallback({},ModCallbacks.MC_POST_RENDER,function()if DisplayLag then local s=string.format('%.2fs',Lag/30)I.RenderText(s,(I.GetScreenWidth()-I.GetTextWidth(s))/2,10,1,1,0,1)end end)

--===--
--[[
模板: restart-game
说明: |-
  重开一局新游戏。
]]
