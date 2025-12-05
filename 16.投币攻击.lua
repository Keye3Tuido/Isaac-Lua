--投币攻击
--角色限定：堕化店主
--除非重新加载了模组，否则不要重复输入代码！

---- 代码效果(不用管中文，全选复制即可) ----
--1. 强制敌人变为精英怪(不包括6无敌变种和25彩虹变种)。
l local A,I,C={[0]=1,[1]=1,[2]=1,[3]=1,[4]=1,[5]=1,[6]=0,[7]=1,[8]=1,[9]=1,[10]=1,[11]=1,[12]=1,[13]=1,[14]=1,[15]=1,[16]=1,[17]=1,[18]=1,[19]=1,[20]=1,[21]=1,[22]=1,[23]=1,[24]=1,[25]=0},'InitSeed',{}for k,v in pairs(A)do for _=1,v do C[#C+1]=k end end Isaac.AddCallback({}, ModCallbacks.MC_NPC_UPDATE, function(_,e)if e:IsVulnerableEnemy()and e:IsActiveEnemy(false)and not e:IsBoss()and not e:IsInvincible() and not e:IsChampion()then e:MakeChampion(e[I],C[e[I]%#C+1])end end)


--2. 强制给予玩家道具202(弥达斯之触)、227(小猪存钱罐)、295(魔术手指)、304(天秤座)、416(深口袋)、501(贪婪的胃袋)、道具590(水星)。
l Isaac.AddCallback({},31,function(c,p,n)if 40~=p:GetPlayerType()and not p:HasCurseMistEffect()then for _,i in pairs({202,227,295,304,416,501,590})do c,n=table.unpack(type(i)=='table'and i or{i,1})while n>p:GetCollectibleNum(c)do p:AddCollectible(c,Isaac.GetItemConfig():GetCollectible(c).InitCharge)end Game():GetItemPool():RemoveCollectible(c)end end end)

--3. 强制玩家变为堕化店主，给予副手道具金剃刀片，移动速度变为金钱数量*0.003
l local A,M,T=Isaac.AddCallback,ModCallbacks,{}A(T,M.MC_POST_PEFFECT_UPDATE,function(_,p)p.MoveSpeed=3e-3+3e-3*p:GetNumCoins()end)A(T,M.MC_POST_PLAYER_UPDATE,function(_,p)local k,c,s=PlayerType.PLAYER_KEEPER_B,CollectibleType.COLLECTIBLE_GOLDEN_RAZOR,ActiveSlot.SLOT_POCKET if k~=p:GetPlayerType()then p:ChangePlayerType(k)end if c~=p:GetActiveItem(s)then p:SetPocketActiveItem(c,s,true)end end)

--4. 黏币变为镍币
l Isaac.AddCallback({},ModCallbacks.MC_POST_PICKUP_INIT,function(_,p)if p.SubType==CoinSubType.COIN_STICKYNICKEL then p:Morph(p.Type,p.Variant,CoinSubType.COIN_NICKEL,true)end end,PickupVariant.PICKUP_COIN)

--5. 角色吸引硬币
l Isaac.AddCallback({},ModCallbacks.MC_POST_PICKUP_UPDATE,function(_,p)local e,l=Game():GetNearestPlayer(p.Position+p.PositionOffset)l=e.Position+e.PositionOffset-p.Position-p.PositionOffset p.Velocity=3*(l:Length()>10 and math.log(l:Length())or 0)*l:Normalized()p.GridCollisionClass=EntityGridCollisionClass.GRIDCOLL_NONE end,PickupVariant.PICKUP_COIN)

--6. 角色使用道具魔术手指的同时，在原地生成三滴眼泪；眼泪会追踪敌人，命中敌人后生成硬币
l local A,M,T=Isaac.AddCallback,ModCallbacks,{T={}}A(T,M.MC_USE_ITEM,function(_,_,_,p)for _=1,3 do local t=p:FireTear(p.Position+p.PositionOffset,Vector.Zero)t.TearFlags=t.TearFlags|TearFlags.TEAR_HOMING end end,CollectibleType.COLLECTIBLE_MAGIC_FINGERS)A(T,M.MC_POST_NEW_ROOM,function()T.T={}end)A(T,M.MC_PRE_TEAR_COLLISION,function(_,t,c)if c:IsVulnerableEnemy()and c:IsActiveEnemy(false)then T.T[t.InitSeed]=true end end)A(T,M.MC_POST_ENTITY_REMOVE,function(_,e)if T.T[e.InitSeed]then Isaac.Spawn(EntityType.ENTITY_PICKUP,PickupVariant.PICKUP_COIN,CoinSubType.COIN_PENNY,e.Position+e.PositionOffset,Vector.Zero,nil)T.T[e.InitSeed]=nil end end,EntityType.ENTITY_TEAR)

--7. 长按道具键/副手键1s以上=连续多次按键
l local A,M,H,B,K,G=Isaac.AddCallback,ModCallbacks,GetPtrHash,ButtonAction,{'ACTION_ITEM','ACTION_PILLCARD'},{M={}}A(G.M,M.MC_POST_PLAYER_RENDER,function(_,p)local k,n,a=H(p)G[k]=G[k]or{}n=G[k]for _,b in pairs(K)do a=B[b]if Input.IsActionPressed(a,p.ControllerIndex)then n[a]=n[a]or Isaac.GetTime()else n[a]=nil end end end)A(G.M,M.MC_INPUT_ACTION,function(_,e,_,a)e=e and e:ToPlayer()if e then local k,t,s=H(e),Isaac.GetTime()s=G[k]and G[k][a]if s and s<t then return t>1e3+s end end end,InputHook.IS_ACTION_TRIGGERED)A(G.M,M.MC_POST_ENTITY_REMOVE,function(_,e)G[H(e)]=nil end,EntityType.ENTITY_PLAYER)

--8. 非任务道具替换为以下道具之一：道具36(大便)、道具74(25美分)、道具667(稻草人)
l local I,C=Isaac,{36,74,667}I.AddCallback({},ModCallbacks.MC_POST_PICKUP_INIT,function(_,p)local s=p.SubType if not I.GetItemConfig():GetCollectible(s):HasTags(ItemConfig.TAG_QUEST)then for _,v in pairs(C)do if v==s then return end end local r=RNG()r:SetSeed(p.InitSeed,35)p:Morph(p.Type,p.Variant,C[r:RandomInt(#C)+1],true,true)end end,PickupVariant.PICKUP_COLLECTIBLE)

--9. 非主角色透明度降低为0.3
l Isaac.AddCallback({},ModCallbacks.MC_POST_PLAYER_RENDER,function(_,p)if p.Parent then local c=p.Color p.Color=Color(c.R,c.G,c.B,0.3,c.RO,c.GO,c.BO)end end)
--.