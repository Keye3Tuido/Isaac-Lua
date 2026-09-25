--绝对防御

--[[
模板: fly-permanent
]]

--[[
模板: divine-intervention
]]

--[[
模板: champion-force
参数:
  P10: "1"
  P26: "将所有非精英敌人变为粉色精英怪"
]]

--[[
说明: "投射物自带激光射击"
]]
l Isaac.AddCallback({},ModCallbacks.MC_POST_PROJECTILE_INIT,function(_,p)p:AddProjectileFlags(ProjectileFlags.LASER_SHOT)end)

--[[
模板: restart-game
]]
