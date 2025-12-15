--风雨交加
--输入下面的代码后，重新开始一局新游戏
--除非重新加载了模组，否则不要重复输入代码！

---- 代码效果(不用管中文，全选复制即可) ----

--0. 删除匿名模组的回调。游戏胜利后自动清理代码效果。
--控制台输入 lua CLM() 可删除所有匿名模组的回调，用于预防重复输入代码和清理代码效果。
--重复输入此代码不额外生效。
l local A,I,M,t,m=ModCallbacks,Isaac,'Mod'function CLM()for i,j in pairs(A)do t=I.GetCallbacks(j)for x=#t,1,-1 do m=t[x][M]if not(m and m.Name)then I.RemoveCallback(m,j,t[x].Function)end end end end CLM()I.AddCallback({},A.MC_POST_GAME_END,function(_,f)if not f then CLM()end end)

--1. 房间中吹起微风，可在控制台输入lua Windy = 数值 来调整风力系数(默认25)。
--屏幕上方会显示当前房间的风力大小，风力大小和楼层数、房间难度和风力系数有关。
--风会从进入房间的门吹向其他门，实体会被风吹动。
l Windy=25;local C,I,M,V,T,A=0,Isaac,ModCallbacks,Vector,{}A=I.AddCallback A(T,M.MC_POST_UPDATE,function()for _,v in pairs(I.GetRoomEntities())do if not v:ToEffect()then local O,Z,R=0,V.Zero,Game():GetRoom()for i=0,7 do if R:GetDoor(i)then O,L=O+1,v.Position+v.PositionOffset-R:GetDoorSlotPosition(i)Z=Z+C/v.Mass*(i==Game():GetLevel().EnterDoor and 1 or -1)*L:Normalized()/(L:Length()+40)end end v:AddVelocity((O==1 and -1 or 1)*Z/math.max(1,O))end end end)A(T,M.MC_POST_NEW_ROOM,function()local L=Game():GetLevel()C=Windy*L:GetCurrentRoomDesc().Data.Difficulty*(L:GetStage()/10+1)end)A(T,M.MC_POST_RENDER,function()local t=string.format('%.2f',C/100)I.RenderText(t,(I.GetScreenWidth()-I.GetTextWidth(t))/2,I.GetScreenHeight()/16,0,1,0,1)end)

--2. 实体的加速度变小，可在控制台输入lua Inertia = 数值 来调整系数(默认30)。
-- 加速度变动为原先的Inertia%，Inertia取值范围0~100。
l Inertia=30;local H,I,M,T,X,U,V,A=GetPtrHash,Isaac,ModCallbacks,{},math,'Velocity',{}A=I.AddCallback A(T,M.MC_POST_UPDATE,function()for _,v in pairs(I.GetRoomEntities())do if not v:ToEffect()then local p,h=X.min(100,X.max(0,Inertia))/100,H(v)if V[h]then v[U]=v[U]*p+V[h]*(1-p)end V[h]=v[U]end end end)A(T,M.MC_POST_NEW_ROOM,function()V={}end)

--3. 屏幕变黑，周期性被照明，可在控制台输入lua Thunder = 数值 来调整照明时间(默认2秒)。
l Thunder=2;local I,V,B=Isaac,Vector,Sprite()B:Load('gfx/ui/loading.anm2',true)B:Play('1',true)B.Scale=V.One*9 I.AddCallback({},ModCallbacks.MC_POST_RENDER,function()local p,t=Thunder t=Game():GetFrameCount()/30%(3*p)B.Color=Color(1,1,1,math.max(1-8*t,1-(t/p-3)^2/4))B:RenderLayer(0,V.Zero)end)

--4. 播放雷声，房间中有雷声和雨滴效果，房间地面有积水效果。
l local I,F,M,D,O,P,T,A=Isaac,'Flags',ModCallbacks,{'THUNDER'},RoomDescriptor,{'HAS_WATER','FLOODED'},{}A=I.AddCallback A(T,M.MC_POST_UPDATE,function()local S=SFXManager()for k,v in pairs(D)do local s=SoundEffect['SOUND_'..v]if not S:IsPlaying(s)then S:Play(s,1,0,false)end end for i=1,3 do I.Spawn(EntityType.ENTITY_EFFECT,EffectVariant.RAIN_DROP,0,I.GetRandomPosition(),Vector.Zero,nil):AddEntityFlags(EntityFlag.FLAG_PERSISTENT)end end)A(T,ModCallbacks.MC_POST_NEW_ROOM,function()local L,R=Game():GetLevel()R=L:GetRooms()for i=1,#R do local r=L:GetRoomByIdx(R:Get(i-1).SafeGridIndex)for k,v in pairs(P)do r[F]=O['FLAG_'..v]|r[F]end end end)
--.