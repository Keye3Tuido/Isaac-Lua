--随机字符串输出。

--[[
作为模板: true
模板id: random-string-output
说明: 输出4位随机字符串，用于区分每次的输入。
]]
l Isaac.ConsoleOutput(tostring{}:sub(-4)..'\n')
