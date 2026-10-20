--每层道具奖励。

--[[
作为模板: true
模板id: per-floor-spawn-collectibles
说明: |-
  每层在初始房间生成{P2}。
  离开房间后道具消失。
参数:
  P1: {类型: "道具列表", 默认: "247,{612,2}", 性质: "局部", 说明: "道具id或{id,数量}的列表"}
  P2: {类型: "描述", 默认: "1*道具247-好朋友一辈子!、2*道具612-迷失游魂", 性质: "局部", 说明: "说明文本中的生成道具描述"}
]]
l local Items={P1}local I=Isaac I.AddCallback({},ModCallbacks.MC_POST_NEW_LEVEL,function()for k,v in pairs(Items)do local c,n=table.unpack(type(v)=='table'and v or{v,1})for i=1,n*(0<LevelCurse.CURSE_OF_LABYRINTH&Game():GetLevel():GetCurses()and 2 or 1)do I.Spawn(EntityType.ENTITY_PICKUP,PickupVariant.PICKUP_COLLECTIBLE,c,I.GetFreeNearPosition(Game():GetRoom():GetCenterPos(),0),Vector.Zero,nil):ToPickup().Timeout=9e9 end end end)

--[[
作为模板: true
模板id: per-floor-give-collectibles
说明: |-
  每层给予所有玩家{P2}。
参数:
  P1: {类型: "道具列表", 默认: "247,{612,2}", 性质: "局部", 说明: "道具id或{id,数量}的列表"}
  P2: {类型: "描述", 默认: "1*道具247-好朋友一辈子!、2*道具612-迷失游魂", 性质: "局部", 说明: "说明文本中的给予道具描述"}
]]
l local Items={P1}local I=Isaac I.AddCallback({},ModCallbacks.MC_POST_NEW_LEVEL,function()for x=1,Game():GetNumPlayers()do local p,c,n=I.GetPlayer(x-1)for k,v in pairs(Items)do c,n=table.unpack(type(v)=='table'and v or{v,1})for i=1,n*(0<LevelCurse.CURSE_OF_LABYRINTH&Game():GetLevel():GetCurses()and 2 or 1)do p:AddCollectible(c,I.GetItemConfig():GetCollectible(c).InitCharge)end end end end)
