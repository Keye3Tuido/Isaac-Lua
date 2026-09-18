--块内参数缺默认值挑战

--===--
--[[
说明: 前置。
]]
l local X=1
--===--
--[[
说明: 参数没有默认值。
参数定义:
  P1: {性质: 局部, 说明: 道具编号}
]]
l Isaac.Spawn(5,100,P1,Vector.Zero,Vector.Zero,nil)
--===--
--[[
说明: 后置。
]]
l local Z=1
