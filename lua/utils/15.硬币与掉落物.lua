--硬币与掉落物：硬币吸引、黏币变形与传送胶囊辨认。

--[[
作为模板: true
模板id: sticky-to-nickel
说明: |-
  黏币变为镍币。
]]
l Isaac.AddCallback({},ModCallbacks.MC_POST_PICKUP_INIT,function(_,p)if p.SubType==CoinSubType.COIN_STICKYNICKEL then p:Morph(p.Type,p.Variant,CoinSubType.COIN_NICKEL,true)end end,PickupVariant.PICKUP_COIN)

--[[
作为模板: true
模板id: attract-coins
说明: |-
  角色吸引硬币。
]]
l Isaac.AddCallback({},ModCallbacks.MC_POST_PICKUP_UPDATE,function(_,p)local e,l=Game():GetNearestPlayer(p.Position)l=e.Position-p.Position p.Velocity=3*(l:Length()>10 and math.log(l:Length())or 0)*l:Normalized()p.GridCollisionClass=EntityGridCollisionClass.GRIDCOLL_NONE end,PickupVariant.PICKUP_COIN)

--[[
作为模板: true
模板id: teleport-pill-reveal
说明: |-
  辨认传送胶囊。
]]
l Isaac.AddCallback({},ModCallbacks.MC_POST_PLAYER_UPDATE,function(t,p)t=Game():GetItemPool()for _,c in pairs(PillColor)do if t:GetPillEffect(c,p)==PillEffect.PILLEFFECT_TELEPILLS and not t:IsPillIdentified(c)then t:IdentifyPill(c)end end end,0)
