--移除捐款机。

--[[
作为模板: true
模板id: remove-donation-machine
说明: |-
  从游戏中移除捐款机
]]
l Isaac.AddCallback({},18,function()Game():SetStateFlag(17,true)end)
