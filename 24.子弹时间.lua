--子弹时间
--除非重新加载了模组，否则不要重复输入代码！

---- 代码效果(不用管中文，全选复制即可) ----

--1. 强制给予玩家道具282(跳跃教程)。
l Isaac.AddCallback({},31,function(c,p,n)if 40~=p:GetPlayerType()and not p:HasCurseMistEffect()then for _,i in pairs({282})do c,n=table.unpack(type(i)=='table'and i or{i,1})while n>p:GetCollectibleNum(c)do p:AddCollectible(c,Isaac.GetItemConfig():GetCollectible(c).InitCharge)end Game():GetItemPool():RemoveCollectible(c)end end end)

--2. 强制给予玩家饰品149(紧急按钮)。
l Isaac.AddCallback({},31,function(a,p,b)if 40~=p:GetPlayerType()and not p:HasCurseMistEffect()then b='Parent'a=p[b]p[b]=nil for _,i in pairs({149})do if not p:HasTrinket(i)then p:DropTrinket(p.Position+p.PositionOffset,true)p:AddTrinket(i)p:UseActiveItem(479,3339)end end p[b]=a end end)

--3. 实时监测游戏帧率，可使用指令：lua SetTimeScale(数值) 来设置游戏速率(默认1，最小0)。
-- GetTimeScale()可获取{[1]=当前渲染帧倍率,[2]=当前逻辑帧倍率}。
-- 由于监测数据和调控速率之间存在延迟，实际效果与预期效果会有一定偏差。
l local H,I,J,K,M,N,O,P,U,V,X,T,A,B,C,D,E,F,G,L,Q='GetFrameCount',Isaac,1,Game,ModCallbacks,math.max,1,1,1,1,true,{}A,D,L,B,C=I.AddCallback,I.GetTime,K().IsPaused,I[H],K()[H]Q,E,F,G=X,B(),C(K()),D()A(T,M.MC_POST_RENDER,function()local c,r,g,d=D(),B(),C(K())d=c-G G,E,O=c,r,50/d/3*(r-E)if r&1<1 then F,P=g,50/d/3*(g-F)end if J<1 and not L(K())then if J<O then U=U*1.2 elseif J>O then U=N(U/2,.5)end for i=1,U do I.GetRoomEntities()end end end)A(T,M.MC_POST_UPDATE,function()if Q and J>1 and not L(K())then if J>P then V=V*1.2 elseif J<P then V=N(V/2,.5)end Q=false for i=1,V do K():Update()end Q=X end end)function SetTimeScale(v)J=N(tonumber(v)or 1,0)end function GetTimeScale()return{O,P}end

--4. 游戏1.5倍速运行。
-- 可通过指令 lua TimeScale = 数值 来调整默认游戏速率(默认1.5倍)。
-- 紧急按钮触发主动道具时，将会进入子弹时间状态 5 秒。
-- 可通过指令 lua BulletTime = 数值 来调整子弹时间的持续时间(默认5秒)。
-- 依赖代码3.
l BulletTime=5;TimeScale=1.5;local A,B,M,T=Isaac.AddCallback,TimeScale,ModCallbacks,{}A(T,M.MC_PRE_USE_ITEM,function(_,_,_,p)if not Input.IsActionTriggered(ButtonAction.ACTION_ITEM,p.ControllerIndex)then B=.1 end end)A(T,M.MC_POST_UPDATE,function()local t=TimeScale SetTimeScale(B<t and B or t)if B<t then B=B+.03/BulletTime end end)
--.