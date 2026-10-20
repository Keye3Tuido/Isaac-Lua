--达摩克里斯之剑。

--[[
作为模板: true
模板id: damocles-never-fall
说明: 达摩克里斯之剑永不落下。
]]
l Isaac.AddCallback({},ModCallbacks.MC_FAMILIAR_UPDATE,function(_,f)f.State=1 end,FamiliarVariant.DAMOCLES)

--[[
作为模板: true
模板id: damocles-fall-now
说明: 达摩克里斯之剑立刻落下。
]]
l for _,v in pairs(Isaac.FindByType(EntityType.ENTITY_FAMILIAR,FamiliarVariant.DAMOCLES))do v:ToFamiliar().State=2 end
