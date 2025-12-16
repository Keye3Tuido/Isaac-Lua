--拖家带口
--限定角色: 游魂
--输入下面的代码后，重新开始一局新游戏
--除非重新加载了模组，否则不要重复输入代码！

---- 代码效果(不用管中文，全选复制即可) ----

--* 前置功能性代码（重复输入不额外生效）
l if not(REPENTOGON or _CBH)then local D,E,F,I,J,O,P,Y,W,A,B,C,G,H,K,L,Q,R=require'debug',{},'Function',Isaac,'Callback',{},pairs,true,{}_CBH,A,B,C,G,K,Q,R=Y,D.getlocal,D.setlocal,D.sethook,I.GetCallbacks,'Run'..J,function(i)for _,m in P(G(i))do local o=m[F]if not W[o]then m[F]=O[o]or R(o)end end end,function(f)local function r(...)local s={pcall(f,...)}if s[1]then return table.unpack(s,2)end end O[f],W[r]=r,f return r end L=function(i)_,i=A(3,i)if not E[i]then E[i]=Y Q(i)end end for _,i in P(ModCallbacks)do E[i]=Y end function Wrap()if not H then for i,_ in P(E)do Q(i)end C(function(e)local a=D.getinfo(2,'f').func if a==I['AddPriority'..J]then _,a=A(2,4)L(2)if not W[a]then B(2,4,O[a]or R(a))end elseif a==I['Remove'..J]then _,a=A(2,3)L(2)if not W[a]then B(2,3,O[a]or a)end elseif a==I[K]or a==I[K..'WithParam']or a==G then L(1)end end,'c')H=Y end end function Unwrap()if H then C()for i,_ in P(E)do for _,m in P(G(i))do m[F]=W[m[F]]or m[F]end end O,W,H={},{}end end end -- 安全包装,预防模组兼容问题
l local A,I,M=ModCallbacks,Isaac,'Mod'function CLM(t,m)for i,j in pairs(A)do t=I.GetCallbacks(j)for x=#t,1,-1 do m=t[x][M]if not(m and m.Name)then I.RemoveCallback(m,j,t[x].Function)end end end end -- 清理匿名模组回调,预防代码污染
--0. 避免代码污染和模组不兼容问题，游戏胜利后自动清除代码效果。
--依赖代码* | 提供接口: CLM()删除匿名回调; Wrap()包装模组回调; Unwrap()取消包装。
l Wrap()CLM()Isaac.AddCallback({},ModCallbacks.MC_POST_GAME_END,function(_,f)if not f then Unwrap()CLM()end end)

--1. 用于储存数据，无实际效果。
-- _Data()返回的表兼容发光沙漏和rewind（可回溯）,_Data(entity)=entity:GetData()（可回溯）,_rew()返回当前是否处于rew状态（不要更新表中的数据）,_Pata()返回的数据仅在游戏结束时重置（不回溯）。
l local B,I,M,H,T,F,A,C,D,R,S='MC_POST_NEW_ROOM',Isaac,ModCallbacks,function(e)return e.InitSeed end,true,false A,C,R,S,D=function(S,...)I.AddPriorityCallback(D.M,S,CallbackPriority.IMPORTANT,...)end,function(s)if type(s)=='table'then local c={}for k,v in pairs(s)do c[k]=C(v)end return c end return s end,function()D.R,D.C,D.T=T,F,C(D.B)end,I.GetFrameCount,{B={},D={},T={},R=F,C=F,G=F,M={},W={}}A(M.MC_USE_ITEM,R,CollectibleType.COLLECTIBLE_GLOWING_HOUR_GLASS)A(M[B],function()if D.G then if D.R then if D.C then D.R=F end D.C=not D.C end if not D.R then D.W=C(D.B)D.B=C(D.T)end end end)A(M.MC_POST_GAME_STARTED,function(_,c)D.R,D.C,D.G=F,F,T if c then if D.E==S()then D.B=C(D.W)R()I.RunCallback(M[B])else D.B=C(D.T)end else D.T,D.B,D.D={},{},{}end end)A(M.MC_PRE_GAME_EXIT,function(_,d)D.E=d and S()if not d then D.D,D.B,D.T={},{},{}end D.R,D.C,D.G=F,F,F end)A(M.MC_POST_ENTITY_REMOVE,function(_,e)D.T[H(e)]=nil end)function _Data(e)if e then local k=H(e)D.T[k]=D.T[k]or{}return D.T[k]end return D.T end function _rew()return D.R or not D.G end function _Pata()return D.D end

--2. 道具:迷失游魂 可叠加。
-- 依赖代码1
l local B,C,D,E,F,G,H,I,J,L,M,O,P,R,S,T,A,K,N=_Data,'Player','InitSeed',EntityType.ENTITY_FAMILIAR,FamiliarVariant.LOST_SOUL,'Position',GetPtrHash,Isaac,'ToFamiliar',Vector,ModCallbacks,math,'Parent','Remove','State',{}A,N,K=I.AddCallback,I.FindByType,G..'Offset'A(T,M.MC_POST_NEW_LEVEL,function()for k,v in pairs(B())do v.N=0 end end)A(T,M.MC_POST_PLAYER_UPDATE,function(_,p)local a,b,c,h,n,e=N(E,F),{},0,H(p)n=p:GetCollectibleNum(CollectibleType.COLLECTIBLE_LOST_SOUL)-(B(p).N or 0)for k,v in pairs(a)do e=v[J](v)if h==H(e[C])then c=c+1 if c>n then e[R](e)else b[#b+1]=e end end end while c<n and 64>#N(E)do c,e=c+1,I.Spawn(E,F,0,p[G]+p[K],L.Zero,p)b[#b+1]=e[J](e)end table.sort(b,function(x,y)return x[D]<y[D]end)for k,v in pairs(b)do v[C],v[P],e=p,p,b[1]a=e[G]+e[K]if k>1 then v:FollowPosition(a+(40-O.max(O.min((v[G]+v[K]-a):Length(),160),1)/8)*L.FromAngle(360*k/(#b-1)+Game():GetFrameCount()))end end end)A(T,M.MC_FAMILIAR_UPDATE,function(_,f)local p=f[C]if f[S]==4 and f:GetSprite():IsFinished()then B(p).N=(B(p).N or 0)+1 f[R](f)end end,F)

--3. 强制角色为游魂。
l Isaac.AddCallback({},ModCallbacks.MC_POST_PLAYER_UPDATE,function(_,p)local t=PlayerType.PLAYER_THELOST if t~=p:GetPlayerType()then p:ChangePlayerType(t)end end)

--4. 初始给予玩家道具247(好朋友一辈子!)。
l local I,G=Isaac,Game()I.AddCallback({},15,function(p,c,t,n)if not c then for _,i in pairs({247})do for k=1,G:GetNumPlayers()do p,t,n=I.GetPlayer(k-1),table.unpack(type(i)=='table'and i or{i,1})while n>p:GetCollectibleNum(t)do p:AddCollectible(t,I.GetItemConfig():GetCollectible(t).InitCharge)end end G:GetItemPool():RemoveCollectible(t)end end end)

--5. 每层在初始房间生成2*道具612-迷失游魂。
--离开房间后道具消失。
l local Items={{612,2}};local I=Isaac I.AddCallback({},ModCallbacks.MC_POST_NEW_LEVEL,function()for k,v in pairs(Items)do local c,n=table.unpack(type(v)=='table'and v or{v,1})for i=1,n*(0<LevelCurse.CURSE_OF_LABYRINTH&Game():GetLevel():GetCurses()and 2 or 1)do I.Spawn(EntityType.ENTITY_PICKUP,PickupVariant.PICKUP_COLLECTIBLE,c,I.GetFreeNearPosition(Game():GetRoom():GetCenterPos(),0),Vector.Zero,nil):ToPickup().Timeout=9e9 end end end)

--6. 删除每层的：宝箱房(类型为4)、星象房(类型为24)。
l local Del={4,24};local D,G,S,T='Data','GetRoomByIdx','SafeGridIndex','Type'Isaac.AddCallback({},ModCallbacks.MC_POST_NEW_LEVEL,function()local L,C,R,r=Game():GetLevel()C,R=L:GetCurrentRoomDesc(),L:GetRooms()for i=1,#R do r=R:Get(i-1)for k,v in pairs(Del)do if v==r[D][T]then L[G](L,r[S])[D]=C[D]break end end end L:UpdateVisibility()for i=0,8 do r=Game():GetRoom():GetDoor(i)if r then R=L[G](L,r.TargetRoomIndex)[D][T]if R~=r.TargetRoomType then r:SetRoomTypes(C[D][T],R)end end end end)

--7. 从游戏中移除道具123(怪物手册)、567(逾越节蜡烛)、704(狂怒!)
l local I,C,Y,T,A=Isaac,{123,567,704},true,{}A=I.AddCallback A(T,23,function(_,c)for _,v in pairs(C)do if c==v then return Y end end end)A(T,31,function(_,p)for _,i in pairs(C)do for _=1,p:GetCollectibleNum(i)do p:RemoveCollectible(i)end end end)A(T,37,function(p,f,v,s)if v==100 then repeat p,f=Game():GetItemPool()for _,i in pairs(C)do if i==s then f,s=1,p:GetCollectible(p:GetLastPool(),Y)break end end until not f return{v,s}end end)

--8. 从游戏中移除符文87(参孙的魂石)。
l local b,Y,F,G={87},true,Isaac.AddCallback,Game()F({},31,function(_,p)for _,i in pairs(b)do for s=0,3 do if p:GetCard(s)==i then p:SetCard(s,0)end end end end)F({},37,function(r,f,v,s)if v==300 then repeat f=Y for _,i in pairs(b)do if i==s then f,r=false,G:GetRandomPlayer(Vector.Zero,0):GetCardRNG(REPENTANCE_PLUS and -1 or 0)s=G:GetItemPool():GetCard(r:GetSeed(),22<s and s<32,Y,31<s and s<42 or 55==s or 80<s)r:Next()break end end until f return{v,s}end end)
--.