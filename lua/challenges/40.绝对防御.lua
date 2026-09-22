--绝对防御


---- 代码效果 ----

--===--

--[[
模板: fly-permanent
]]

--[[
模板: force-give-items
参数:
  P1: "'c546'"
  P2: "道具546(爸爸的戒指)"
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
说明: "玩家体型不大于2"
]]
l Isaac.AddCallback({},ModCallbacks.MC_POST_PLAYER_UPDATE,function(_,p)p.Size=math.min(2,p.Size)end)

--[[
说明: "“爸爸的戒指”光环变大50%"
]]
l Isaac.AddCallback({},ModCallbacks.MC_POST_EFFECT_INIT,function(_,e)if e.SubType<1 then e.SpriteScale=3/2*Vector.One e.PositionOffset=Vector(0,26)end end,EffectVariant.HALO)

--===--
--[[
模板: restart-game
]]

