--永久飞行。

--[[
作为模板: true
模板id: fly-permanent
说明: |-
  玩家永久飞行(矿洞逃亡中不生效)。
]]
l Isaac.AddCallback({},ModCallbacks.MC_EVALUATE_CACHE,function(e,p)if not p:HasCurseMistEffect()then p.CanFly=true e=CollectibleType.COLLECTIBLE_BIBLE p=p:GetEffects()if not p:HasCollectibleEffect(e)then p:AddCollectibleEffect(e)end end end,CacheFlag.CACHE_FLYING)
