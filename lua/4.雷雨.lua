--雷雨

---- 代码效果 ----

--0. 前置功能性代码：避免代码污染和重复输入问题;
--默认锁定游戏成就;
--游戏胜利后自动清除代码效果; 长按重开键10秒自动清空代码效果;
--提供接口: CLM()删除匿名回调, MEC()包装报错模组, DEMEC()恢复对报错模组的包装
l local c,a,b,i,e,g,h,j,d=table,Isaac,pairs,ModCallbacks,'unpack','AddPriorityCallback','RemoveCallback','GetCallbacks','Function'if not(REPENTOGON or _MEC)then _MEC=true local o,u,m,l,r,p=false,function(f)return function(...)local k=c.pack(pcall(f,...))if k[1]then return c[e](k,2,k.n)end end end,{},{},a[g],a[h]local q=function(f)local k=m[f]or u(f)m[k]=f m[f]=k l[f]=(l[f]or 0)+1 return k end local w,x=function(s,t,v,f,k)r(s,t,v,q(f),k)end,function(s,t,f)if l[f]then p(s,t,m[f])l[f]=l[f]-1 if l[f]<1 then local n={}for k,v in b(l)do if k~=f then n[k]=v end end l=n n={}for k,v in b(m)do if k~=f and v~=f then n[k]=v end end m=n end else p(s,t,f)end end function MEC()if not o then a[g]=w a[h]=x for _,k in b(i)do local n=a[j](k)for _,f in b(n)do f[d]=q(f[d])end end o=true end end function DEMEC()if o then a[g]=r a[h]=p for _,k in b(i)do local n=a[j](k)for _,f in b(n)do f[d]=m[f[d]]or f[d]end end m={}l={}o=false end end end --[[ 包装报错模组 ]]MEC()function CLM(t,m)for i,j in pairs(ModCallbacks)do t=Isaac.GetCallbacks(j)for x=#t,1,-1 do m=t[x].Mod if not(m and m.Name)then Isaac.RemoveCallback(m,j,t[x].Function)end end end end --[[ 清理匿名模组回调,预防代码污染 ]]CLM()local I,M,A,T,F=Isaac,ModCallbacks T=I.GetTime F=T()A=I.AddCallback A({},M.MC_POST_GAME_END,function(_,f)if not f then DEMEC()CLM()end end)A({},M.MC_POST_RENDER,function(p)p=T()for i=1,Game():GetNumPlayers()do if Input.IsActionPressed(ButtonAction.ACTION_RESTART,I.GetPlayer(i).ControllerIndex)then if p-F>=1e4 then DEMEC()CLM()end return end end F=p end) --[[ 自动清理回调 ]] Isaac.AddPriorityCallback({},ModCallbacks.MC_POST_GAME_STARTED,CallbackPriority.IMPORTANT,function(_,c)if not c then Isaac.ExecuteCommand('seed '..Seeds.Seed2String(Game():GetSeeds():GetNextSeed()))end end) --[[ 游戏锁定成就 ]]

--1. 所有玩家永久蒙眼（在矿洞逃亡中不生效）。
l Isaac.AddCallback({},31,function(s,p,g,c,f)f=1 s='Challenge'g=Game()c=g[s]if p:HasCurseMistEffect()then g[s],f=0 p:TryRemoveNullCostume(14)elseif p:CanShoot()then g[s],f=6 p:AddNullCostume(14)end if not f then p:UpdateCanShoot()end g[s]=c end)

--2. 每秒随机天降火箭,落地处生成可投掷的手雷。火箭数量为每个玩家的运气的绝对值+1的总和，每位玩家运气触发上限为30
l local I,F,G,Z,M,N=Isaac,Isaac.AddCallback,GetPtrHash,Vector.Zero,{}F({},31,function(_,s)local t,r,p=math.abs(s.Luck)if(I.GetFrameCount()%60<=math.min(t,30))then p=I.GetRandomPosition()I.Spawn(1e3,30,0,p,Z,s):ToEffect().Timeout=30 r=I.Spawn(1e3,31,0,p,Z,s)r:ToEffect().Timeout=30 M[G(r)]=1 end end)F({},67,function(_,e)if(M[G(e)])then M[G(e)]=N I.Spawn(5,41,0,e.Position,Z,N):ToPickup().Timeout=90 end end,1e3)

--3. 从游戏中移除捐款机
l Isaac.AddCallback({},18,function()Game():SetStateFlag(17,true)end)

--重开一局新游戏。
l local A,B,C,Z=Isaac,ModCallbacks.MC_POST_UPDATE,{}Z=function()A.ExecuteCommand'restart'A.RemoveCallback(C,B,Z)end A.AddCallback(C,B,Z)
--.
