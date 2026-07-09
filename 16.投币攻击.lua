--投币攻击
--角色限定：堕化店主


---- 代码效果(不用管中文，全选复制即可) ----

--0. 前置功能性代码：避免代码污染、重复输入和模组不兼容问题;
--默认锁定游戏成就;
--游戏胜利后自动清除代码效果; 长按重开键10秒自动清空代码效果;
--挑战代码若与其他模组冲突，可按“=”键开启兼容模式(可能卡顿)，按“-”键可关闭兼容模式;挑战默认关闭兼容模式;
--提供接口: CLM()删除匿名回调; Wrap()包装模组回调; Unwrap()取消包装。
l if not(REPENTOGON or _CBH)then local D,E,F,I,J,O,P,Y,W,A,B,C,G,H,K,L,Q,R=require'debug',{},'Function',Isaac,'Callback',{},pairs,true,{}_CBH,A,B,C,G,K,Q,R=Y,D.getlocal,D.setlocal,D.sethook,I.GetCallbacks,'Run'..J,function(i)for _,m in P(G(i))do local o=m[F]if not W[o]then m[F]=O[o]or R(o)end end end,function(f)local function r(...)local s={pcall(f,...)}if s[1]then return table.unpack(s,2)end end O[f],W[r]=r,f return r end L=function(i)_,i=A(3,i)if not E[i]then E[i]=Y Q(i)end end for _,i in P(ModCallbacks)do E[i]=Y end function Wrap()if not H then for i,_ in P(E)do Q(i)end C(function()local a=D.getinfo(2,'f').func if a==I['AddPriority'..J]then _,a=A(2,4)L(2)if not W[a]then B(2,4,O[a]or R(a))end elseif a==I['Remove'..J]then _,a=A(2,3)L(2)if not W[a]then B(2,3,O[a]or a)end elseif a==I[K]or a==I[K..'WithParam']or a==G then L(1)end end,'c')H=Y end end function Unwrap()if H then C()for i,_ in P(E)do for _,m in P(G(i))do m[F]=W[m[F]]or m[F]end end O,W,H={},{}end end end --[[ 安全包装,预防模组兼容问题 ]] local A,I=ModCallbacks,Isaac;function CLM(t,m)for i,j in pairs(A)do t=I.GetCallbacks(j)for x=#t,1,-1 do m=t[x].Mod if not(m and m.Name)then I.RemoveCallback(m,j,t[x].Function)end end end end --[[ 清理匿名模组回调,预防代码污染 ]] Wrap,Unwrap=Wrap or CLM,Unwrap or CLM CLM()local E,I,K,M,N,A,B,T,F=error,Isaac,Keyboard,ModCallbacks,Input B=N.IsButtonTriggered T=I.GetTime F=T()A=I.AddCallback A({},M.MC_POST_GAME_END,function(_,f)if not f then Unwrap()CLM()end end)A({},M.MC_POST_RENDER,function(p,q)p=T()for i=1,Game():GetNumPlayers()do q=I.GetPlayer(i).ControllerIndex if B(K.KEY_MINUS,q)then Unwrap()E('CBWrapper Disabled',0)elseif B(K.KEY_EQUAL,q)then Wrap()E('CBWrapper Enabled',0)end if N.IsActionPressed(ButtonAction.ACTION_RESTART,q)then if p-F>=1e4 then Unwrap()CLM()end return end end F=p end) --[[ 对外提供接口、自动清理回调、按键包装回调 ]] Isaac.AddPriorityCallback({},ModCallbacks.MC_POST_GAME_STARTED,CallbackPriority.IMPORTANT,function(_,c)if not c then Isaac.ExecuteCommand('seed '..Seeds.Seed2String(Game():GetSeeds():GetNextSeed()))end end) --[[ 游戏锁定成就 ]]

--1. 强制敌人变为精英怪(不包括6无敌变种和25彩虹变种)。
l local A,I,C={[0]=1,[1]=1,[2]=1,[3]=1,[4]=1,[5]=1,[6]=0,[7]=1,[8]=1,[9]=1,[10]=1,[11]=1,[12]=1,[13]=1,[14]=1,[15]=1,[16]=1,[17]=1,[18]=1,[19]=1,[20]=1,[21]=1,[22]=1,[23]=1,[24]=1,[25]=0},'InitSeed',{}for k,v in pairs(A)do for _=1,v do C[#C+1]=k end end Isaac.AddCallback({}, ModCallbacks.MC_NPC_UPDATE, function(_,e)if e:IsVulnerableEnemy()and e:IsActiveEnemy(false)and not e:IsBoss()and not e:IsInvincible() and not e:IsChampion()then e:MakeChampion(e[I],C[e[I]%#C+1])end end)


--2. 强制给予玩家：道具202(弥达斯之触)、227(小猪存钱罐)、295(魔术手指)、304(天秤座)、416(深口袋)、501(贪婪的胃袋)、590(水星)
-- 主动道具数量不够时，强制锁门，房间内生成对应道具
-- 格式：c=道具,t/T=饰品(仅保证层数一致),单物品={类别,1}
l ITEMS={'c202','c227','c295','c304','c416','c501','c590'}local C,D,E,F,H,I,P,Q,L,M,T=CollectibleType,'OLLECTIBLE','GetPlayerType',PlayerType,'Get',Isaac,pairs,EntityType,'Remove',ModCallbacks,{}local A,B,G,J,K,N,O,S,U=I.AddCallback D,B='C'..D,'C'..D:lower()J=H..B K=J..'Num'O=L..B N=function(i,a,b)a,i=table.unpack(type(i)=='table'and i or{i,1})a,b=a:match('(%a)(%d+)')return i,a,tonumber(b)end G=function(_,a,b,p)for _,i in P(ITEMS)do i,a,b=N(i)if a=='c'then while 0<p[K](p,b)do p[O](p,b)end end end end A(T,M.MC_POST_PLAYER_UPDATE,function(a,p,b,c,e,g,h,j,k,l)if F.PLAYER_THESOUL_B~=p[E](p)and not p:HasCurseMistEffect()then c=I.GetItemConfig()e='Trinket'h='Add'for _,i in P(ITEMS)do i,a,b=N(i)if a=='T'then a='t'i=i*2 end if a=='c'then g=Game():GetItemPool()g[O](g,b)g=0 if not p:IsItemQueueEmpty()then g=p.QueuedItem.Item g=g and g['Is'..B](g)and b==g.ID and 1 or 0 end while i>g+p[K](p,b)do if c[J](c,b).Type==ItemType.ITEM_ACTIVE then S=b break else p[h..B](p,b)end end elseif a=='t'then g=H..e l=h..e while 1 do j=i-p[g..'Multiplier'](p,b)if j<=0 then break end k={}for s=0,1 do k[s]=p[g](p,s)p['Try'..L..e](p,k[s])p[l](p,b|((j>1 and s==0 or j>3)and TrinketType.TRINKET_GOLDEN_FLAG or 0))end p:UseActiveItem(C[D..'_SMELTER'],2315)for s=0,1 do p[l](p,k[s],false)end end end end end end)A(T,M.MC_POST_UPDATE,function(d,r,v,s)if S then r=Game():GetRoom()for _,i in P(DoorSlot)do d=r:GetDoor(i)if d then d:Close()end end d=Q.ENTITY_PICKUP v=PickupVariant.PICKUP_COLLECTIBLE s=I.FindByType if 1>#s(d,v,S)then U=U and U+1 or 1 if U>29 then I.Spawn(d,v,S,r:GetCenterPos(),Vector.Zero,nil)end else U=nil end for _,e in P(s(d,v,0))do e:Remove()end end S=nil end)A(T,M.MC_PRE_USE_ITEM,G,C[D..'_D4'])A(T,M.MC_ENTITY_TAKE_DMG,function(d,e,u,f)d=DamageFlag u='DAMAGE_'e=e:ToPlayer()if F.PLAYER_EDEN_B==e[E](e)and 0==f&(d[u..'RED_HEARTS']|d[u..'IV_BAG']|d[u..'FAKE']|d[u..'NO_PENALTIES'])then G(e,e,e,e)end end,Q.ENTITY_PLAYER)

--3. 强制玩家变为堕化店主，给予副手道具金剃刀片，移动速度变为金钱数量*0.003
l local A,M,T=Isaac.AddCallback,ModCallbacks,{}A(T,M.MC_POST_PEFFECT_UPDATE,function(_,p)p.MoveSpeed=3e-3+3e-3*p:GetNumCoins()end)A(T,M.MC_POST_PLAYER_UPDATE,function(_,p)local k,c,s=PlayerType.PLAYER_KEEPER_B,CollectibleType.COLLECTIBLE_GOLDEN_RAZOR,ActiveSlot.SLOT_POCKET if k~=p:GetPlayerType()then p:ChangePlayerType(k)end if c~=p:GetActiveItem(s)then p:SetPocketActiveItem(c,s,true)end end)

--4. 黏币变为镍币
l Isaac.AddCallback({},ModCallbacks.MC_POST_PICKUP_INIT,function(_,p)if p.SubType==CoinSubType.COIN_STICKYNICKEL then p:Morph(p.Type,p.Variant,CoinSubType.COIN_NICKEL,true)end end,PickupVariant.PICKUP_COIN)

--5. 角色吸引硬币
l Isaac.AddCallback({},ModCallbacks.MC_POST_PICKUP_UPDATE,function(_,p)local e,l=Game():GetNearestPlayer(p.Position)l=e.Position-p.Position p.Velocity=3*(l:Length()>10 and math.log(l:Length())or 0)*l:Normalized()p.GridCollisionClass=EntityGridCollisionClass.GRIDCOLL_NONE end,PickupVariant.PICKUP_COIN)

--6. 角色使用道具魔术手指的同时，在原地生成三滴眼泪；眼泪会追踪敌人，命中敌人后生成硬币
l local A,M,T=Isaac.AddCallback,ModCallbacks,{T={}}A(T,M.MC_USE_ITEM,function(_,_,_,p)for _=1,3 do local t=p:FireTear(p.Position,Vector.Zero)t.TearFlags=t.TearFlags|TearFlags.TEAR_HOMING end end,CollectibleType.COLLECTIBLE_MAGIC_FINGERS)A(T,M.MC_POST_NEW_ROOM,function()T.T={}end)A(T,M.MC_PRE_TEAR_COLLISION,function(_,t,c)if c:IsVulnerableEnemy()and c:IsActiveEnemy(false)then T.T[t.InitSeed]=true end end)A(T,M.MC_POST_ENTITY_REMOVE,function(_,e)if T.T[e.InitSeed]then Isaac.Spawn(EntityType.ENTITY_PICKUP,PickupVariant.PICKUP_COIN,CoinSubType.COIN_PENNY,e.Position,Vector.Zero,nil)T.T[e.InitSeed]=nil end end,EntityType.ENTITY_TEAR)

--7. 长按道具键/副手键1s以上=连续多次按键
l local A,M,H,B,K,G=Isaac.AddCallback,ModCallbacks,GetPtrHash,ButtonAction,{'ACTION_ITEM','ACTION_PILLCARD'},{M={}}A(G.M,M.MC_POST_PLAYER_RENDER,function(_,p)local k,n,a=H(p)G[k]=G[k]or{}n=G[k]for _,b in pairs(K)do a=B[b]if Input.IsActionPressed(a,p.ControllerIndex)then n[a]=n[a]or Isaac.GetTime()else n[a]=nil end end end)A(G.M,M.MC_INPUT_ACTION,function(_,e,_,a)e=e and e:ToPlayer()if e then local k,t,s=H(e),Isaac.GetTime()s=G[k]and G[k][a]if s and s<t then return t>1e3+s end end end,InputHook.IS_ACTION_TRIGGERED)A(G.M,M.MC_POST_ENTITY_REMOVE,function(_,e)G[H(e)]=nil end,EntityType.ENTITY_PLAYER)

--8. 非任务道具替换为以下道具之一：道具36(大便)、道具74(25美分)、道具667(稻草人)
l local I,M,C,A=Isaac,ModCallbacks,{36,74,667}A=I.AddCallback;A({},M.MC_POST_PICKUP_INIT,function(_,p)local s=p.SubType if not I.GetItemConfig():GetCollectible(s):HasTags(ItemConfig.TAG_QUEST)then for _,v in pairs(C)do if v==s then return end end local r=RNG()r:SetSeed(p.InitSeed,35)p:Morph(p.Type,p.Variant,C[r:RandomInt(#C)+1],true,true)end end,PickupVariant.PICKUP_COLLECTIBLE)A({},M.MC_PRE_GET_COLLECTIBLE,function(_,_,_,s)return C[s%#C+1]end)

--9. 非主角色透明度降低为0.3
l Isaac.AddCallback({},ModCallbacks.MC_POST_PLAYER_RENDER,function(_,p)if p.Parent then local c=p.Color p.Color=Color(c.R,c.G,c.B,0.3,c.RO,c.GO,c.BO)end end)

--.
