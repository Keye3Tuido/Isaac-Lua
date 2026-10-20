--取消屏幕晃动。

--[[
作为模板: true
模板id: no-screen-shake
说明: |-
  取消屏幕晃动。
]]
l Isaac.AddCallback({},ModCallbacks.MC_POST_UPDATE,function()Game():ShakeScreen(0)end)
