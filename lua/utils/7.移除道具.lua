--移除道具。

--[[
作为模板: true
模板id: remove-collectibles
名称: 移除道具
说明: |-
  从游戏中移除{P2}
参数:
  P1: {类型: "道具id列表", 默认: "329,579", 性质: "局部", 说明: "要移除的道具id列表"}
  P2: {类型: "描述", 默认: "道具329(鲁多维科科技)和579(英灵剑)", 性质: "局部", 说明: "说明文本中的被移除对象描述"}
]]
l local I,C,Y,T,A=Isaac,{P1},true,{}A=I.AddCallback A(T,23,function(_,c)for _,v in pairs(C)do if c==v then return Y end end end)A(T,31,function(_,p)for _,i in pairs(C)do while p:HasCollectible(i)do p:RemoveCollectible(i)end end end)A(T,37,function(p,f,v,s)if v==100 then repeat p,f=Game():GetItemPool()for _,i in pairs(C)do if i==s then f,s=1,p:GetCollectible(p:GetLastPool(),Y)break end end until not f return{v,s}end end)

--[[
模板: remove-collectibles
参数:
  P1: "52,68,114,118,152,168,244,329,399,579,640,643,678,696"
  P2: "可绕过眼泪输出的道具"
]]
--[[
模板: remove-collectibles
参数:
  P1: "360,399,640,643,680,696,698"
  P2: "所有绕过蒙眼输出的道具"
]]

--[[
作为模板: true
模板id: avoid-pickup-items
说明: 角色无法拾取非任务道具和错误道具
]]
l local a,b,h,d,F=ModCallbacks,Isaac,PickupVariant.PICKUP_COLLECTIBLE d=b.AddCallback d({},a.MC_POST_UPDATE,function()F=nil for i=1,Game():GetNumPlayers()do if b.GetPlayer(i):HasCollectible(CollectibleType.COLLECTIBLE_FLIP)then F=true break end end end)d({},a.MC_POST_PLAYER_UPDATE,function(c,p)c=p.QueuedItem c=c.Touched and c.Item if c and c:IsCollectible()then c=c.ID p:FlushQueueItem()p:RemoveCollectible(c)b.Spawn(EntityType.ENTITY_PICKUP,h,c,p.Position,Vector.Zero,p)end end,0)d({},a.MC_POST_PICKUP_UPDATE,function(s,p)s=p.SubType p.Touched=s<1 or not b.GetItemConfig():GetCollectible(s):HasTags(ItemConfig.TAG_QUEST)if s==0 and not F then p:Remove()end end,h)