--框架夹具

--===--
--[[
说明: 框架前置。
]]
l local FA=1

--===--
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

--===--
--[[
模板: random-string-output
]]
