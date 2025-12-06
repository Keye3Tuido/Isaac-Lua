--拖家带口
--限定角色: 游魂
--输入下面的代码后，重新开始一局新游戏
--除非重新加载了模组，否则不要重复输入代码！

---- 代码效果(不用管中文，全选复制即可) ----

--1. 用于储存数据，无实际效果（兼容发光沙漏，不兼容rewind）
--_Data()返回的数据兼容发光沙漏,_Data(entity)=entity:GetData(),_rew()返回当前是否处于rew状态（不更新数据）,_Pata()返回的数据仅在游戏结束时重置;rewind会触发游戏结束和游戏开始。
l local I,M,N,H,T,F,D,A=Isaac,ModCallbacks,'MC_POST_NEW_ROOM',function(e)return e.InitSeed end,true,false D,A={B={},D={},T={},R=F,C=F,G=F,M={}},function(S,...)I.AddPriorityCallback(D.M,S,CallbackPriority.IMPORTANT,...)end local function C(s)if type(s)=='table'then local c={}for k,v in pairs(s)do c[k]=C(v)end return c end return s end A(M.MC_USE_ITEM,function()D.T=C(D.B)D.R,D.C=T,F end,CollectibleType.COLLECTIBLE_GLOWING_HOUR_GLASS)A(M[N],function()if not D.G then D.G=T return end if D.R then if D.C then D.R=F end D.C=not D.C end if not D.R then D.B=C(D.T)end end)A(M.MC_POST_GAME_STARTED,function(_,c)D.R,D.C=F,F if c then D.T=C(D.B)else D.T,D.B,D.D={},{},{}end I.RunCallback(M[N])end)A(M.MC_PRE_GAME_EXIT,function(_,d)if d then D.B=C(D.T)else D.D,D.B={},{}end D.R,D.C,D.G,D.T=F,F,F,{}end)A(M.MC_POST_ENTITY_REMOVE,function(_,e)D.T[H(e)]=nil end)function _Data(e)if e then local k=H(e)D.T[k]=D.T[k]or{}return D.T[k]end return D.T end function _rew()return D.R end function _Pata()return D.D end

--2. 道具:迷失游魂 可叠加。
-- 依赖代码1
l local B,C,D,E,F,G,H,I,J,L,M,P,R,S,T,A,K,N=_Data,'Player','InitSeed',EntityType.ENTITY_FAMILIAR,FamiliarVariant.LOST_SOUL,'Position',GetPtrHash,Isaac,'ToFamiliar',Vector,ModCallbacks,'Parent','Remove','State',{}A,N,K=I.AddCallback,I.FindByType,G..'Offset'A(T,M.MC_POST_NEW_LEVEL,function()for k,v in pairs(B())do v.N=0 end end)A(T,M.MC_POST_PLAYER_UPDATE,function(_,p)local a,b,c,h,n,e=N(E,F),{},0,H(p)n=p:GetCollectibleNum(CollectibleType.COLLECTIBLE_LOST_SOUL)-(B(p).N or 0)for k,v in pairs(a)do e=v[J](v)if h==H(e[C])then c=c+1 if c>n then e[R](e)else b[#b+1]=e end end end while c<n and 64>#N(E)do c,e=c+1,I.Spawn(E,F,0,p[G]+p[K],L.Zero,p)b[#b+1]=e[J](e)end table.sort(b,function(x,y)return x[D]<y[D]end)for k,v in pairs(b)do v[C],v[P],e=p,p,b[1]v:FollowPosition(p[G]+p[K]+40*L.FromAngle(360*k/#b+Game():GetFrameCount()))end end)A(T,M.MC_FAMILIAR_UPDATE,function(_,f)local p=f[C]if f[S]==4 and f:GetSprite():IsFinished()then B(p).N=(B(p).N or 0)+1 f[R](f)end end,F)

--3. 强制角色为游魂。
l Isaac.AddCallback({},ModCallbacks.MC_POST_PLAYER_UPDATE,function(_,p)local t=PlayerType.PLAYER_THELOST if t~=p:GetPlayerType()then p:ChangePlayerType(t)end end)

--4. 初始给予玩家道具247(好朋友一辈子!)。
l local I,G=Isaac,Game()I.AddCallback({},15,function(p,c,t,n)if not c then for _,i in pairs({247})do for k=1,G:GetNumPlayers()do p,t,n=I.GetPlayer(k-1),table.unpack(type(i)=='table'and i or{i,1})while n>p:GetCollectibleNum(t)do p:AddCollectible(t,I.GetItemConfig():GetCollectible(t).InitCharge)end end G:GetItemPool():RemoveCollectible(t)end end end)

--5. 每层在初始房间生成2*道具612-迷失游魂。
l local Items={{612,2}};local I=Isaac I.AddCallback({},ModCallbacks.MC_POST_NEW_LEVEL,function()for k,v in pairs(Items)do local c,n=table.unpack(type(v)=='table'and v or{v,1})for i=1,n do I.ExecuteCommand('spawn 5.100.'..c)end end end)

--6. 删除每层的：宝箱房(类型为4)、星象房(类型为24)。
l local Del={4,24};local D,S,T='Data','SafeGridIndex','Type'Isaac.AddCallback({},ModCallbacks.MC_POST_NEW_LEVEL,function()local L,R,r=Game():GetLevel()R=L:GetRooms()for i=1,#R do r=R:Get(i-1)for k,v in pairs(Del)do if v==r[D][T]then L:GetRoomByIdx(r[S])[D]=L:GetCurrentRoomDesc()[D]break end end end L:UpdateVisibility()end)

--7. 从游戏中移除道具567(逾越节蜡烛)
l local I,C,Y,T,A=Isaac,{567},true,{}A=I.AddCallback A(T,23,function(_,c)for _,v in pairs(C)do if c==v then return Y end end end)A(T,31,function(_,p)for _,i in pairs(C)do for _=1,p:GetCollectibleNum(i)do p:RemoveCollectible(i)end end end)A(T,37,function(p,f,v,s)if v==100 then repeat p,f=Game():GetItemPool()for _,i in pairs(C)do if i==s then f,s=1,p:GetCollectible(p:GetLastPool(),Y)break end end until not f return{v,s}end end)
--.