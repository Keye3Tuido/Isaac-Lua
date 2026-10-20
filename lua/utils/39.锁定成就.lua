--锁定成就。

--[[
作为模板: true
模板id: lock-achievements
说明: |-
  游戏锁定成就。
]]
l Isaac.AddPriorityCallback({},ModCallbacks.MC_POST_GAME_STARTED,CallbackPriority.IMPORTANT,function(_,c)if not c then Isaac.ExecuteCommand('seed '..Seeds.Seed2String(Game():GetSeeds():GetNextSeed()))end end)
