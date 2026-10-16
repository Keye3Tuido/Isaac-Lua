-- 说明模板库（工具文件自由格式：普通注释随意）

--[[
作为模板: true
模板id: restart-as-character
说明: 角色{P1}专用重启。
参数:
  P1: {默认: '', 性质: 全局, 说明: 角色名}
]]
l local who='P1' print(who)

--[[
作为模板: true
模板id: restart-game
说明: 重开一局新游戏。
]]
l print("restart")

--[[
作为模板: true
模板id: random-string-output
说明: 输出随机字符串。
]]
l Isaac.ConsoleOutput(tostring({}):match('%w%w%w%w$'))
