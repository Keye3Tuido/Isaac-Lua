-- 基础模板库（工具文件自由格式：普通注释随意）

--[[
作为模板: true
模板id: tpl-basic
说明: 基础安全包装。
]]
l local BASIC=true print(BASIC)

--[[
作为模板: true
模板id: tpl-param
说明: 生成道具{P1}，数量{P2}。
参数定义:
  P1: {类型: 道具id, 默认: 653, 性质: 局部, 说明: 道具编号}
  P2: {类型: 列表, 默认: [1, 2], 性质: 局部, 说明: 数量列表}
]]
l local ids={P2} Isaac.Spawn(5,100,P1,Vector.Zero,Vector.Zero,nil)
