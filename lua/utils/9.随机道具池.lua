--随机道具池：随机道具/饰品池与 D4 重随。

--[[
作为模板: true
模板id: random-items
说明: |-
  函数 RandomItems([BlackList]) 返回一个表，包含两个子表：Active和Passive，分别存储随机排序的主动道具和被动道具的道具ID列表。BlackList为可选参数，是一个包含不希望被选择的道具ID的黑名单表。道具列表中包含本局已经存在的错误道具。
名称: RandomItems
参数:
  P1: {类型: "道具id黑名单", 默认: "59", 性质: "局部", 说明: "不希望被选择的道具id列表"}
]]
l function RandomItems(BlackList)local A,B,C,E,G,T,P,t,c,f,Q={},BlackList or{P1},Isaac.GetItemConfig(),'Type','GetCollectible',ItemType,{},-1 while C[G](C,t)do t=t-1 end for i=t+1,#C[G..'s'](C)-1 do c=C[G](C,i)if c then f=true for j=1,#B do if B[j]==i then f=false break end end if f then Q=T.ITEM_ACTIVE==c[E]and A or T.ITEM_NULL~=c[E]and P or{}table.insert(Q,math.random(#Q+1),i)end end end return{Active=A,Passive=P}end

--[[
作为模板: true
模板id: d4-reroll
名称: D4重随
说明: |-
  函数 D4(EntityPlayer[,BlackList]) 移除玩家身上的所有道具，并随机给予相同数量的随机道具(主动道具1个，其余为被动道具)。
依赖: RandomItems
参数:
  P1: {类型: "道具id黑名单", 默认: "59,584", 性质: "局部", 说明: "不希望被选择的道具id列表"}
]]
l function D4(EntityPlayer,BlackList)local B,C,N,T,p,m,t,G,H='Collectible',Isaac.GetItemConfig(),0,RandomItems(BlackList or{P1}),EntityPlayer,0,-1 G,H='Get'..B,'Add'..B while C[G](C,t)do t=t-1 end for i=t+1,#C[G..'s'](C)-1 do while p['Has'..B](p,i,true)do N=N+1 p['Remove'..B](p,i,true)end end if N>0 then t=T.Active[1]p[H](p,t,C[G](C,t).InitCharge,false)t=T.Passive for i=2,N do m=m%#t+1 p[H](p,t[m],0,false)end end end

--[[
作为模板: true
模板id: random-trinkets
说明: |-
  函数 RandomTrinkets([BlackList]) 返回一个表，存储随机排序的饰品ID列表。BlackList为可选参数，是一个包含不希望被选择的饰品ID的黑名单表。
名称: RandomTrinkets
参数:
  P1: {类型: "饰品id黑名单", 默认: "", 性质: "局部", 说明: "不希望被选择的饰品id列表"}
]]
l function RandomTrinkets(BlackList)local A,B,C,G,c,f={},BlackList or{P1},Isaac.GetItemConfig(),'GetTrinket',-1 for i=1,#C[G..'s'](C)-1 do c=C[G](C,i)if c then f=true for j=1,#B do if B[j]==i then f=false break end end if f then table.insert(A,math.random(#A+1),i)end end end return A end

--[[
作为模板: true
模板id: d4-trinket-reroll
名称: D4重随饰品
说明: |-
  函数 D4_1(EntityPlayer[,BlackList]) 移除玩家身上的所有饰品，并随机给予相同数量的随机饰品。
依赖: RandomTrinkets
参数:
  P1: {类型: "饰品id黑名单", 默认: "64,75,180", 性质: "局部", 说明: "不希望被选择的饰品id列表"}
]]
l function D4_1(EntityPlayer,BlackList)local B,C,N,T,p,m,G='Trinket',Isaac.GetItemConfig(),0,RandomTrinkets(BlackList or{P1}),EntityPlayer,0 G='Get'..B for i=1,#C[G..'s'](C)-1 do while p['Has'..B](p,i)do N=N+1 p['TryRemove'..B](p,i)end end for i=1,N do m=m%#T+1 p['Add'..B](p,T[m],false)p:UseActiveItem(CollectibleType.COLLECTIBLE_SMELTER,3339)end end
