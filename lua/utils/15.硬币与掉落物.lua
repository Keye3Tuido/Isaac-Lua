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

--[[
作为模板: true
模板id: remove-empty-items
说明: |-
  移除空箱子、空底座和空机器
  (拥有道具711"生死逆转"时不移除空底座)
]]
l local b,c,d,e,f,A,h,g=PickupVariant,ModCallbacks,Isaac,pairs,'Remove',{}h,g=d.AddCallback,c.MC_POST_PICKUP_UPDATE h(A,g,function(t,p)t=p:GetData()t[A]=p:GetSprite():GetAnimation()=='Open'and(t[A]or 0)+1 or 0 if 59<t[A]then p[f](p)end end,b.PICKUP_ETERNALCHEST)for _,v in e{b.PICKUP_CHEST,b.PICKUP_BOMBCHEST,b.PICKUP_SPIKEDCHEST,b.PICKUP_MIMICCHEST,b.PICKUP_OLDCHEST,b.PICKUP_WOODENCHEST,b.PICKUP_MEGACHEST,b.PICKUP_HAUNTEDCHEST,b.PICKUP_LOCKEDCHEST,b.PICKUP_REDCHEST}do h(A,g,function(_,p)if p.SubType==0 then p[f](p)end end,v)end h(A,c.MC_POST_UPDATE,function(a)for _,s in e(d.FindByType(EntityType.ENTITY_SLOT))do a=s:GetSprite():GetAnimation()if a=='Broken'or a=='Death'then s[f](s)end end end)h(A,g,function(_,p)if p.SubType==0 then for i=1,Game():GetNumPlayers()do if d.GetPlayer(i):HasCollectible(CollectibleType.COLLECTIBLE_FLIP)then return end end p[f](p)end end,b.PICKUP_COLLECTIBLE)