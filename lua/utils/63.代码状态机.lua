--代码状态机。

--[[
作为模板: true
模板id: state-machine
说明: |-
  代码状态机，每秒30帧。初态为state=0，map中的key为状态值(非nil、非false)；value是一个函数，表示当前状态下执行的行为。返回值为下一个状态值，若返回nil或false则保持当前状态不变。
参数:
  P1: {类型: 状态表, 性质: 局部, 默认: '[0]=function()end', 说明: "map 表内容：key=状态值，value=该状态执行的行为函数"}
]]
l local M={state=0,map={P1}}Isaac.AddCallback({},ModCallbacks.MC_POST_UPDATE,function()M.state=M.map[M.state]()or M.state end)
