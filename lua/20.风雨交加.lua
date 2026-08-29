--风雨交加


---- 代码效果 ----

--0. 前置功能性代码：避免代码污染和重复输入问题;
--默认锁定游戏成就;
--游戏胜利后自动清除代码效果; 长按重开键10秒自动清空代码效果;
--提供接口: CLM()删除匿名回调, MEC()包装报错模组, DEMEC()撤销对报错模组的包装
l local g,a,b,h,d,e,i,c=table,Isaac,pairs,ModCallbacks,'AddPriorityCallback','RemoveCallback','GetCallbacks','Function'if not(REPENTOGON or _MEC)then _MEC=true local n,t,l,j,p=false,function(f)return function(...)local k=g.pack(pcall(f,...))if k[1]then return g.unpack(k,2,k.n)end end end,{},{}p=function(f)local k=l[f]or t(f)l[k]=f l[f]=k j[f]=(j[f]or 0)+1 return k end local q,o,u=a[d],a[e]u=function(f,k,m,r,s)q(f,k,m,p(r),s)end local function w(r,s,f)if j[f]then o(r,s,l[f])j[f]=j[f]-1 if 1>j[f]then local m={}for k,v in b(j)do if k~=f then m[k]=v end end j=m m={}for k,v in b(l)do if k~=f and v~=f then m[k]=v end end l=m end else o(r,s,f)end end function MEC()if not n then a[d]=u a[e]=w for _,k in b(h)do _=a[i](k)for _,f in b(_)do f[c]=p(f[c])end end n=true end end function DEMEC()if n then a[d]=q a[e]=o for _,k in b(h)do _=a[i](k)for _,f in b(_)do f[c]=l[f[c]]or f[c]end end l={}j={}n=false end end end --[[ 包装报错模组 ]]MEC()function CLM(t,m)for i,j in pairs(ModCallbacks)do t=Isaac.GetCallbacks(j)for x=#t,1,-1 do m=t[x].Mod if not(m and m.Name)then Isaac.RemoveCallback(m,j,t[x].Function)end end end end --[[ 清理匿名模组回调,预防代码污染 ]]CLM()local I,M,A,T,F=Isaac,ModCallbacks T=I.GetTime F=T()A=I.AddCallback A({},M.MC_POST_GAME_END,function(_,f)if not f then DEMEC()CLM()end end)A({},M.MC_POST_RENDER,function(p)p=T()for i=1,Game():GetNumPlayers()do if Input.IsActionPressed(ButtonAction.ACTION_RESTART,I.GetPlayer(i).ControllerIndex)then if p-F>=1e4 then DEMEC()CLM()Game():FinishChallenge()Game():Fadeout(1,2)end return end end F=p end) --[[ 自动清理回调 ]] Isaac.AddPriorityCallback({},ModCallbacks.MC_POST_GAME_STARTED,CallbackPriority.IMPORTANT,function(_,c)if not c then Isaac.ExecuteCommand('seed '..Seeds.Seed2String(Game():GetSeeds():GetNextSeed()))end end) --[[ 游戏锁定成就 ]]

--1. 房间中吹起微风，可在控制台输入lua Windy = 数值 来调整风力系数(默认25)。
--屏幕上方会显示当前房间的风力大小，风力大小和楼层数、房间难度和风力系数有关。
--风会从进入房间的门吹向其他门，实体会被风吹动。
l Windy=25 local C,I,M,V,T,A=0,Isaac,ModCallbacks,Vector,{}A=I.AddCallback A(T,M.MC_POST_UPDATE,function()for _,v in pairs(I.GetRoomEntities())do if not v:ToEffect()then local O,Z,R=0,V.Zero,Game():GetRoom()for i=0,7 do if R:GetDoor(i)then O,L=O+1,v.Position-R:GetDoorSlotPosition(i)Z=Z+C/v.Mass*(i==Game():GetLevel().EnterDoor and 1 or-1)*L:Normalized()/(L:Length()+40)end end v:AddVelocity((O==1 and-1 or 1)*Z/math.max(1,O))end end end)A(T,M.MC_POST_NEW_ROOM,function()local L=Game():GetLevel()C=Windy*L:GetCurrentRoomDesc().Data.Difficulty*(L:GetStage()/10+1)end)A(T,M.MC_POST_RENDER,function()local t=string.format('%.2f',C/100)I.RenderText(t,(I.GetScreenWidth()-I.GetTextWidth(t))/2,I.GetScreenHeight()/16,0,1,0,1)end)

--2. 实体的加速度变小，可在控制台输入lua Inertia = 数值 来调整系数(默认30)。
-- 加速度变动为原先的Inertia%，Inertia取值范围0~100。
l Inertia=30;local H,I,M,T,X,U,V,A=GetPtrHash,Isaac,ModCallbacks,{},math,'Velocity',{}A=I.AddCallback A(T,M.MC_POST_UPDATE,function()for _,v in pairs(I.GetRoomEntities())do if not v:ToEffect()then local p,h=X.min(100,X.max(0,Inertia))/100,H(v)if V[h]then v[U]=v[U]*p+V[h]*(1-p)end V[h]=v[U]end end end)A(T,M.MC_POST_NEW_ROOM,function()V={}end)

--3. 屏幕变黑，周期性被照明，可在控制台输入lua Thunder = 数值 来调整照明时间(默认2秒)。
l Thunder=2;local I,V,B=Isaac,Vector,Sprite()B:Load('gfx/ui/loading.anm2',true)B:Play('1',true)B.Scale=V.One*9 I.AddCallback({},ModCallbacks.MC_POST_RENDER,function()local p,t=Thunder t=Game():GetFrameCount()/30%(3*p)B.Color=Color(1,1,1,math.max(1-8*t,1-(t/p-3)^2/4))B:RenderLayer(0,V.Zero)end)

--4. 播放雷声，房间中有雷声和雨滴效果，房间地面有积水效果。
l local I,F,M,D,O,P,T,A=Isaac,'Flags',ModCallbacks,{'THUNDER'},RoomDescriptor,{'HAS_WATER','FLOODED'},{}A=I.AddCallback A(T,M.MC_POST_UPDATE,function()local S=SFXManager()for k,v in pairs(D)do local s=SoundEffect['SOUND_'..v]if not S:IsPlaying(s)then S:Play(s,1,0,false)end end for i=1,3 do I.Spawn(EntityType.ENTITY_EFFECT,EffectVariant.RAIN_DROP,0,I.GetRandomPosition(),Vector.Zero,nil):AddEntityFlags(EntityFlag.FLAG_PERSISTENT)end end)A(T,ModCallbacks.MC_POST_NEW_ROOM,function()local L,R=Game():GetLevel()R=L:GetRooms()for i=1,#R do local r=L:GetRoomByIdx(R:Get(i-1).SafeGridIndex)for k,v in pairs(P)do r[F]=O['FLAG_'..v]|r[F]end end end)

--重开一局新游戏。
l local A,B,C,Z=Isaac,ModCallbacks.MC_POST_UPDATE,{}Z=function()A.ExecuteCommand'restart'A.RemoveCallback(C,B,Z)end A.AddCallback(C,B,Z)
--.
