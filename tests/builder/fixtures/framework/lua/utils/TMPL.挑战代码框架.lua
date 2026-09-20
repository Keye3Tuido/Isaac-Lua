--框架夹具
--挑战代码框架：前置区 = 框架前置块，后置区 = 重开 + random-string 引用

--===--
--[[
说明: 框架前置甲。
名称: 框架甲
]]
l local FA=1

--[[
说明: 框架前置乙。
依赖: [框架甲]
]]
l print(FA)

--===--
--[[
说明: 框架正文说明。
]]
l print("doc")

--===--
--[[
说明: 框架重开。
]]
l print("restart")

--[[
模板: random-string-output
]]

--.
