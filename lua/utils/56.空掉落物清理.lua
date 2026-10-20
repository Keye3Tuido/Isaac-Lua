--空掉落物清理。

--[[
作为模板: true
模板id: remove-empty-items
说明: |-
  移除空箱子、空底座和空机器
  (拥有道具711"生死逆转"时不移除空底座)
]]
l local b,c,d,e,f,A,h,g=PickupVariant,ModCallbacks,Isaac,pairs,'Remove',{}h,g=d.AddCallback,c.MC_POST_PICKUP_UPDATE h(A,g,function(t,p)t=p:GetData()t[A]=p:GetSprite():GetAnimation()=='Open'and(t[A]or 0)+1 or 0 if 59<t[A]then p[f](p)end end,b.PICKUP_ETERNALCHEST)for _,v in e{b.PICKUP_CHEST,b.PICKUP_BOMBCHEST,b.PICKUP_SPIKEDCHEST,b.PICKUP_MIMICCHEST,b.PICKUP_OLDCHEST,b.PICKUP_WOODENCHEST,b.PICKUP_MEGACHEST,b.PICKUP_HAUNTEDCHEST,b.PICKUP_LOCKEDCHEST,b.PICKUP_REDCHEST}do h(A,g,function(_,p)if p.SubType==0 then p[f](p)end end,v)end h(A,c.MC_POST_UPDATE,function(a)for _,s in e(d.FindByType(EntityType.ENTITY_SLOT))do a=s:GetSprite():GetAnimation()if a=='Broken'or a=='Death'then a=s:GetData()a[A]=1+(a[A]or 0)if 5<a[A]then s[f](s)end end end end)h(A,g,function(_,p)if p.SubType==0 then for i=1,Game():GetNumPlayers()do if d.GetPlayer(i):HasCollectible(CollectibleType.COLLECTIBLE_FLIP)then return end end p[f](p)end end,b.PICKUP_COLLECTIBLE)
