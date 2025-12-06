--失而复得
--限定角色: 游魂
--输入下面的代码后，重新开始一局新游戏
--除非重新加载了模组，否则不要重复输入代码！

---- 代码效果(不用管中文，全选复制即可) ----

--1. 用于储存数据，无实际效果（兼容发光沙漏，不兼容rewind）
--_Data()返回的数据兼容发光沙漏,_Data(entity)=entity:GetData(),_rew()返回当前是否处于rew状态（不更新数据）,_Pata()返回的数据仅在游戏结束时重置;rewind会触发游戏结束和游戏开始。
l local I,M,N,H,T,F,D,A=Isaac,ModCallbacks,'MC_POST_NEW_ROOM',function(e)return e.InitSeed end,true,false D,A={B={},D={},T={},R=F,C=F,G=F,M={}},function(S,...)I.AddPriorityCallback(D.M,S,CallbackPriority.IMPORTANT,...)end local function C(s)if type(s)=='table'then local c={}for k,v in pairs(s)do c[k]=C(v)end return c end return s end A(M.MC_USE_ITEM,function()D.T=C(D.B)D.R,D.C=T,F end,CollectibleType.COLLECTIBLE_GLOWING_HOUR_GLASS)A(M[N],function()if not D.G then D.G=T return end if D.R then if D.C then D.R=F end D.C=not D.C end if not D.R then D.B=C(D.T)end end)A(M.MC_POST_GAME_STARTED,function(_,c)D.R,D.C=F,F if c then D.T=C(D.B)else D.T,D.B,D.D={},{},{}end I.RunCallback(M[N])end)A(M.MC_PRE_GAME_EXIT,function(_,d)if d then D.B=C(D.T)else D.D,D.B={},{}end D.R,D.C,D.G,D.T=F,F,F,{}end)A(M.MC_POST_ENTITY_REMOVE,function(_,e)D.T[H(e)]=nil end)function _Data(e)if e then local k=H(e)D.T[k]=D.T[k]or{}return D.T[k]end return D.T end function _rew()return D.R end function _Pata()return D.D end

--2. 道具:迷失游魂 可叠加。
-- 依赖代码1
l local B,C,D,E,F,G,H,I,J,M,P,R,S,T,A,K=_Data,'Player','InitSeed',EntityType.ENTITY_FAMILIAR,FamiliarVariant.LOST_SOUL,'Position',GetPtrHash,Isaac,'ToFamiliar',ModCallbacks,'Parent','Remove','State',{}A,K=I.AddCallback,G..'Offset'A(T,M.MC_POST_NEW_LEVEL,function()for k,v in pairs(B())do v.N=0 end end)A(T,M.MC_POST_PLAYER_UPDATE,function(_,p)local a,b,c,h,n,e=I.FindByType(E,F),{},0,H(p)n=p:GetCollectibleNum(CollectibleType.COLLECTIBLE_LOST_SOUL)-(B(p).N or 0)for k,v in pairs(a)do e=v[J](v)if h==H(e[C])then c=c+1 if c>n then e[R](e)else b[#b+1]=e end end end while c<n do c,e=c+1,I.Spawn(E,F,0,p[G]+p[K],Vector.Zero,p)b[#b+1]=e[J](e)end table.sort(b,function(x,y)return x[D]<y[D]end)for k,v in pairs(b)do v[P]=k<2 and p or b[k-1]if k>1 then v:FollowPosition(v[P][G]+v[P][K])end end end)A(T,M.MC_FAMILIAR_UPDATE,function(_,f)local p=f[C]if f[S]==4 and f:GetSprite():IsFinished()then B(p).N=(B(p).N or 0)+1 f[R](f)end end,F)

--3. 强制角色为游魂。
l Isaac.AddCallback({},ModCallbacks.MC_POST_PLAYER_UPDATE,function(_,p)local t=PlayerType.PLAYER_THELOST if t~=p:GetPlayerType()then p:ChangePlayerType(t)end end)

--4. 每开启新游戏时，在初始房间根据玩家人数n，生成n组多选一道具(247-好朋友一辈子!)
l local V,g,N=Vector,{247}Isaac.AddCallback({},15,function(_,c)local n,x,y=Game():GetNumPlayers()if not c then x,y=(720-#g*80)/2,(640-n*80)/2 for i=1,n do for j=1,#g do Isaac.Spawn(5,100,g[j],V(x+80*(j-1),y),V.Zero,N):ToPickup().OptionsPickupIndex=i end y=y+80 end end end)

--5. 所有预生成道具替换为道具612-迷失游魂
l local ItemId=612;Isaac.AddCallback({},ModCallbacks.MC_PRE_ROOM_ENTITY_SPAWN,function(_,t,v)if t==EntityType.ENTITY_PICKUP and v==PickupVariant.PICKUP_COLLECTIBLE then return{t,v,ItemId}end end)
--.