--雷雨
--禁用角色：Lilith, Lilith(Tainted)
--输入下面的代码后，开始一局新游戏
--除非重新加载了模组，否则不要重复输入代码！

---- 代码效果(不用管中文，全选复制即可) ----

--1. 所有玩家永久蒙眼（在矿洞逃亡中不生效）。
l Isaac.AddCallback({},31,function(s,p,g,c,f)f,s,g=1,'Challenge',Game()c=g[s]if p:HasCurseMistEffect()then g[s],f=0 p:TryRemoveNullCostume(14)elseif p:CanShoot()then g[s],f=6 p:AddNullCostume(14)end if not f then p:UpdateCanShoot()end g[s]=c end)

--2. 每秒随机天降火箭,落地处生成可投掷的手雷。火箭数量为每个玩家的运气的绝对值+1的总和，每位玩家运气触发上限为30
l local I,F,G,Z,M,N=Isaac,Isaac.AddCallback,GetPtrHash,Vector.Zero,{}F({},31,function(_,s)local t,r,p=math.abs(s.Luck)if(I.GetFrameCount()%60<=math.min(t,30))then p=I.GetRandomPosition()I.Spawn(1e3,30,0,p,Z,s):ToEffect().Timeout=30 r=I.Spawn(1e3,31,0,p,Z,s)r:ToEffect().Timeout=30 M[G(r)]=1 end end)F({},67,function(_,e)if(M[G(e)])then M[G(e)]=N I.Spawn(5,41,0,e.Position,Z,N):ToPickup().Timeout=90 end end,1e3)

--3. 从游戏中移除捐款机
l Isaac.AddCallback({},18,function()Game():SetStateFlag(17,true)end)
--.