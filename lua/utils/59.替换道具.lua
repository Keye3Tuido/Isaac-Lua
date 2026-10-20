--替换道具。

--[[
作为模板: true
模板id: replace-collectibles
说明: |-
  非任务道具替换为以下道具之一：{P2}
参数:
  P1: {类型: "道具id列表", 默认: "36,74,667", 性质: "局部", 说明: "替换候选道具id列表"}
  P2: {类型: "描述", 默认: "道具36(大便)、道具74(25美分)、道具667(稻草人)", 性质: "局部", 说明: "说明文本中的替换候选道具描述"}
]]
l local I,M,C,A=Isaac,ModCallbacks,{P1}A=I.AddCallback;A({},M.MC_POST_PICKUP_INIT,function(_,p)local s=p.SubType if not I.GetItemConfig():GetCollectible(s):HasTags(ItemConfig.TAG_QUEST)then for _,v in pairs(C)do if v==s then return end end local r=RNG()r:SetSeed(p.InitSeed,35)p:Morph(p.Type,p.Variant,C[r:RandomInt(#C)+1],true,true)end end,PickupVariant.PICKUP_COLLECTIBLE)A({},M.MC_PRE_GET_COLLECTIBLE,function(_,_,_,s)return C[s%#C+1]end)

--[[
作为模板: true
模板id: replace-preset-collectible
说明: 所有预生成非任务道具替换为道具{P2}
参数:
  P1: {类型: "道具id", 默认: "612", 性质: "局部", 说明: "行首局部变量ItemId的值（内联），预生成道具被替换成的道具id"}
  P2: {类型: "描述", 默认: "612-迷失游魂", 性质: "局部", 说明: "说明文本中的替换目标道具描述"}
]]
l local ItemId=P1 Isaac.AddCallback({},ModCallbacks.MC_PRE_ROOM_ENTITY_SPAWN,function(c,t,v,s)if t==EntityType.ENTITY_PICKUP and v==PickupVariant.PICKUP_COLLECTIBLE then c=Isaac.GetItemConfig():GetCollectible(s)if not(c and c:HasTags(ItemConfig.TAG_QUEST))then return{t,v,ItemId}end end end)
