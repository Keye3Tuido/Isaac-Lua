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
  移除空箱子和空底座
  (拥有道具711"生死逆转"时不移除空底座)
]]
l local a,b,d=Isaac,{}d=a.AddCallback for _,v in pairs{50,51,52,53,54,55,56,57,58,60,360}do b[v]=1 end d({},35,function(s,p)if p.SubType==0 then s=p.Variant if b[s]then p:Remove()return end if s==100 then for i=1,Game():GetNumPlayers()do if a.GetPlayer(i):HasCollectible(711)then return end end p:Remove()end end end)d({},1,function()for _,s in pairs(a.FindByType(6))do if s:GetSprite():GetAnimation()=='Death'then s:Remove()end end end)