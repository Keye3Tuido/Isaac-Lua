--回合结束与连胜。

--[[
作为模板: true
模板id: finish-run-keep-streak
说明: 立即结束本局游戏，并不影响连胜进度。
]]
l Game():FinishChallenge()Game():Fadeout(9,2)

--[[
作为模板: true
模板id: add-win-streak
说明: 连胜次数增加{P2}次。
参数:
  P1: {类型: "数值", 默认: "1e3", 性质: "局部", 说明: "增加的连胜次数，1000=1e3"}
  P2: {类型: "描述", 默认: "1000", 性质: "局部", 说明: "说明文本中的连胜次数显示值（1000=1e3）"}
]]
l for _=1,P1 do Game():End(0)end
