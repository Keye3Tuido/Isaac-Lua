--面板不等于输出


---- 代码效果 ----

--0. 前置功能性代码：避免代码污染和重复输入问题;
--默认锁定游戏成就;
--游戏胜利后自动清除代码效果; 长按重开键10秒自动清空代码效果;
--提供接口: CLM()删除匿名回调, MEC()包装报错模组, DEMEC()撤销对报错模组的包装
l local a,b,g,d,e,h,c=Isaac,pairs,ModCallbacks,'AddPriorityCallback','RemoveCallback','GetCallbacks','Function'if not(REPENTOGON or _MEC)then _MEC=true local m,s,j,i,o=false,function(f,l)return function(...)local k=table.pack(pcall(f,...))if k[1]then return table.unpack(k,2,k.n)end a.ConsoleOutput(string.format('Error:%s@%s\n',l and l.Name or'Anonymous',k[2]))end end,{},{}o=function(f,l)local k=j[f]or s(f,l)j[k]=f j[f]=k i[f]=(i[f]or 0)+1 return k end local p,n,t=a[d],a[e]t=function(f,k,l,q,r)p(f,k,l,o(q,f),r)end local function u(q,r,f)if i[f]then n(q,r,j[f])i[f]=i[f]-1 if 1>i[f]then local l={}for k,v in b(i)do if k~=f then l[k]=v end end i=l l={}for k,v in b(j)do if k~=f and v~=f then l[k]=v end end j=l end else n(q,r,f)end end function MEC()if not m then a[d]=t a[e]=u for _,k in b(g)do _=a[h](k)for _,f in b(_)do f[c]=o(f[c],f.Mod)end end m=true end end function DEMEC()if m then a[d]=p a[e]=n for _,k in b(g)do _=a[h](k)for _,f in b(_)do f[c]=j[f[c]]or f[c]end end j={}i={}m=false end end end --[[ 包装报错模组 ]]MEC()function CLM(t,m)for i,j in pairs(ModCallbacks)do t=Isaac.GetCallbacks(j)for x=#t,1,-1 do m=t[x].Mod if not(m and m.Name)then Isaac.RemoveCallback(m,j,t[x].Function)end end end end --[[ 清理匿名模组回调,预防代码污染 ]]CLM()local I,M,A,T,F=Isaac,ModCallbacks T=I.GetTime F=T()A=I.AddCallback A({},M.MC_POST_GAME_END,function(_,f)if not f then DEMEC()CLM()end end)A({},M.MC_POST_RENDER,function(p)p=T()for i=1,Game():GetNumPlayers()do if Input.IsActionPressed(ButtonAction.ACTION_RESTART,I.GetPlayer(i).ControllerIndex)then if p-F>=1e4 then DEMEC()CLM()Game():FinishChallenge()Game():Fadeout(1,2)end return end end F=p end) --[[ 自动清理回调 ]] Isaac.AddPriorityCallback({},ModCallbacks.MC_POST_GAME_STARTED,CallbackPriority.IMPORTANT,function(_,c)if not c then Isaac.ExecuteCommand('seed '..Seeds.Seed2String(Game():GetSeeds():GetNextSeed()))end end) --[[ 游戏锁定成就 ]]

--1. 角色的面板属性发生轮换：
-- 控制台输入lua STATS_SWITCH='123456'可以指定轮换次序，输入lua STATS_SWITCH=nil 可以取消轮换次序
-- 如：STATS_SWITCH='341265' 表示将属性面板从上到下，依次替换为第3、4、1、2、6、5个属性，即：
-- 移速(1) <-> 攻击(3)
-- 射程(4) <-> 射速(2)
-- 弹速(5) <-> 幸运(6)
l STATS_SWITCH='341265'local A,B,C,D,E,F,G,H,I,J,Z,Y,X,W,V=Isaac,ModCallbacks.MC_EVALUATE_CACHE,CacheFlag,'MoveSpeed','MaxFireDelay','Damage','TearRange','ShotSpeed','Luck',ipairs Z=A.AddCallback Y=A.RemoveCallback X=function(p)p:AddCacheFlags(C.CACHE_ALL)p:EvaluateItems()end W={{k=D,f=C.CACHE_SPEED,b=-1,i=function(p,i)p[D]=i end,o=function(p)return p[D]end},{k=E,f=C.CACHE_FIREDELAY,b=0,i=function(p,i)p[E]=30/i-1 end,o=function(p)return 30/(p[E]+1)end},{k=F,f=C.CACHE_DAMAGE,b=0,i=function(p,i)p[F]=i end,o=function(p)return p[F]end},{k=G,f=C.CACHE_RANGE,b=0,i=function(p,i)p[G]=40*i end,o=function(p)return p[G]/40 end},{k=H,f=C.CACHE_SHOTSPEED,b=0,i=function(p,i)p[H]=i end,o=function(p)return p[H]end},{k=I,f=C.CACHE_LUCK,b=-1/0,i=function(p,i)p[I]=i end,o=function(p)return p[I]end}}Z({},B,function(a,p,t,f)t=STATS_SWITCH if t and not V then V=p a={}f=function(_,e,h)for _,v in J(W)do if h==v.f then a[v.k]=v.o(e)v.i(e,v.b)end end end Z(a,B,f)X(p)Y(a,B,f)f=function(_,e,h)for k,v in J(W)do if h==v.f then v.i(e,a[W[tonumber(string.sub(t,k,k))].k])end end end Z(a,B,f)X(p)Y(a,B,f)V=nil end end)

--重开一局新游戏。
l local A,B,C,Z=Isaac,ModCallbacks.MC_POST_UPDATE,{}Z=function()A.ExecuteCommand'restart'A.RemoveCallback(C,B,Z)end A.AddCallback(C,B,Z)
--.
