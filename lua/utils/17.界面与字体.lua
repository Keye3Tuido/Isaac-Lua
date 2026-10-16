--界面与字体：中文字体加载与界面文本输出。

--[[
作为模板: true
模板id: random-string-output
说明: 输出4位随机字符串，用于区分每次的输入。
]]
l Isaac.ConsoleOutput(tostring{}:sub(-4)..'\n')

--[[
作为模板: true
模板id: get-zh-font
说明: 提供全局接口 GetZhFont() -> Font
名称: 获取中文字体
]]
l function GetZhFont(f)f=Font()f:Load'font/cjk/lanapixel.fnt'if f:IsLoaded()then return f end end
