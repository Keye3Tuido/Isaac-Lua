--网络延迟


---- 代码效果 ----

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

