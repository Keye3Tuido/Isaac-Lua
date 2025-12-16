--风雨交加
--输入下面的代码后，重新开始一局新游戏
--除非重新加载了模组，否则不要重复输入代码！

---- 代码效果(不用管中文，全选复制即可) ----

--* 前置功能性代码（重复输入不额外生效）
l if not(REPENTOGON or _CBH)then local D,E,F,I,J,O,P,Y,W,A,B,C,G,H,K,L,Q,R=require'debug',{},'Function',Isaac,'Callback',{},pairs,true,{}_CBH,A,B,C,G,K,Q,R=Y,D.getlocal,D.setlocal,D.sethook,I.GetCallbacks,'Run'..J,function(i)for _,m in P(G(i))do local o=m[F]if not W[o]then m[F]=O[o]or R(o)end end end,function(f)local function r(...)local s={pcall(f,...)}if s[1]then return table.unpack(s,2)end end O[f],W[r]=r,f return r end L=function(i)_,i=A(3,i)if not E[i]then E[i]=Y Q(i)end end for _,i in P(ModCallbacks)do E[i]=Y end function Wrap()if not H then for i,_ in P(E)do Q(i)end C(function(e)local a=D.getinfo(2,'f').func if a==I['AddPriority'..J]then _,a=A(2,4)L(2)if not W[a]then B(2,4,O[a]or R(a))end elseif a==I['Remove'..J]then _,a=A(2,3)L(2)if not W[a]then B(2,3,O[a]or a)end elseif a==I[K]or a==I[K..'WithParam']or a==G then L(1)end end,'c')H=Y end end function Unwrap()if H then C()for i,_ in P(E)do for _,m in P(G(i))do m[F]=W[m[F]]or m[F]end end O,W,H={},{}end end end -- 安全包装,预防模组兼容问题
l local A,I,M=ModCallbacks,Isaac,'Mod'function CLM(t,m)for i,j in pairs(A)do t=I.GetCallbacks(j)for x=#t,1,-1 do m=t[x][M]if not(m and m.Name)then I.RemoveCallback(m,j,t[x].Function)end end end end -- 清理匿名模组回调,预防代码污染
--0. 避免代码污染和模组不兼容问题，游戏胜利后自动清除代码效果。
--依赖代码* | 提供接口: CLM()删除匿名回调; Wrap()包装模组回调; Unwrap()取消包装。
l Wrap()CLM()Isaac.AddCallback({},ModCallbacks.MC_POST_GAME_END,function(_,f)if not f then Unwrap()CLM()end end)

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