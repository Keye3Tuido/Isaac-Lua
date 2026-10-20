--致幻抑制。

--[[
作为模板: true
模板id: no-hallucination-stack
说明: 保持致幻层数为0。
]]
l Isaac.AddCallback({},ModCallbacks.MC_POST_PLAYER_UPDATE,function(a,p,b)a=CollectibleType.COLLECTIBLE_WAVY_CAP b=NullItemID.ID_WAVY_CAP_1 p=p:GetEffects()p:RemoveCollectibleEffect(a,p:GetCollectibleEffectNum(a))p:RemoveNullEffect(b,p:GetNullEffectNum(b))end,0)
