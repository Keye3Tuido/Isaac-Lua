--中文字体。

--[[
作为模板: true
模板id: get-zh-font
说明: 提供全局接口 GetZhFont() -> Font
名称: 获取中文字体
]]
l function GetZhFont(f)f=Font()f:Load'font/cjk/lanapixel.fnt'if f:IsLoaded()then return f end end
