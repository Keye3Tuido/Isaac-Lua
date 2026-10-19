--移除与替换道具：道具/饰品/药丸/卡牌的移除与替换。

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
作为模板: true
模板id: remove-donation-machine
说明: |-
  从游戏中移除捐款机
]]
l Isaac.AddCallback({},18,function()Game():SetStateFlag(17,true)end)

--[[
作为模板: true
模板id: remove-trinkets
名称: 移除饰品
说明: |-
  从游戏中移除饰品{P2}。
参数:
  P1: {类型: "饰品id列表", 默认: "85", 性质: "局部", 说明: "要移除的饰品id列表"}
  P2: {类型: "描述", 默认: "85(业报)", 性质: "局部", 说明: "说明文本中的被移除饰品描述"}
]]
l local G,F,b=32768,Isaac.AddCallback,{P1}F({},31,function(_,p)for _,i in pairs(b)do if p:HasTrinket(i)then p:TryRemoveTrinket(i)end end end,0)F({},37,function(_,f,v,s)if v==350 then repeat f=1 for _,i in pairs(b)do if i|G==s|G then f,s=0,Game():GetItemPool():GetTrinket()break end end until f>0 return{v,s}end end)

--[[
作为模板: true
模板id: remove-cards
说明: |-
  从游戏中移除{P2}
参数:
  P1: {类型: "卡牌符文id列表", 默认: "41,74,83", 性质: "局部", 说明: "要移除的卡牌/符文/魂石id列表"}
  P2: {类型: "描述", 默认: "符文41(黑符文)、卡牌74(月亮?)和魂石83(该隐的魂石)。", 性质: "局部", 说明: "说明文本中的被移除卡牌/符文/魂石描述"}
]]
l local b,Y,F,G={P1},true,Isaac.AddCallback,Game()F({},31,function(_,p)for _,i in pairs(b)do for s=0,3 do if p:GetCard(s)==i then p:SetCard(s,0)end end end end,0)F({},37,function(r,f,v,s)if v==300 then repeat f=Y for _,i in pairs(b)do if i==s then f,r=false,G:GetRandomPlayer(Vector.Zero,0):GetCardRNG(REPENTANCE_PLUS and-1 or 0)s=G:GetItemPool():GetCard(r:GetSeed(),22<s and s<32,Y,31<s and s<42 or 55==s or 80<s)r:Next()break end end until f return{v,s}end end)

--[[
作为模板: true
模板id: remove-pills
说明: |-
  从游戏中移除药丸{P2}。
参数:
  P1: {类型: "药丸id列表", 默认: "23", 性质: "局部", 说明: "要移除的药丸id列表"}
  P2: {类型: "描述", 默认: "23(我能永远看清)", 性质: "局部", 说明: "说明文本中的被移除药丸描述"}
]]
l local b,Y,N,F,G,P,E,L,T={P1},true,false,Isaac.AddCallback,Game(),'GetItemPool','GetPillEffect','GetPill',{}F(T,31,function(_,p,o)o=G[P](G)for _,i in pairs(b)do for s=0,3 do if o[E](o,p[L](p,s),p)==i then p:SetPill(s,0)end end end end)F(T,37,function(p,f,v,s,r)p=G[P](G)if v==70 then repeat f=Y for _,i in pairs(b)do if i==p[E](p,s)then f,r=N,G:GetRandomPlayer(Vector.Zero,0):GetPillRNG(REPENTANCE_PLUS and-1 or 0)s=p[L](p,r:GetSeed())r:Next()break end end until f return{v,s}end end)

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
