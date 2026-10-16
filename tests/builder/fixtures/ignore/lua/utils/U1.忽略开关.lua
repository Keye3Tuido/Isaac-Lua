-- 忽略开关夹具（工具文件自由格式：普通注释随意）

--[[
作为模板: true
模板id: tpl-basic
说明: 基础安全包装。
]]
l local BASIC=true print(BASIC)

--[[
注释: true
作为模板: true
模板id: tpl-dead
]]
l DEADTEMPLATE=1

--[[
作为模板: true
模板id: clean-globals
说明: 释放全局变量{P1}。
参数:
  P1: {类型: 文本, 默认: '', 性质: 局部, 说明: 全局变量名列表}
]]
l local _CodeEnding={P1} print(_CodeEnding)
