--混沌轮盘


---- 代码效果 ----

--0. 前置功能性代码：避免代码污染和重复输入问题;
--默认锁定游戏成就;
--游戏胜利后自动清除代码效果; 长按重开键10秒自动清空代码效果;
--提供接口: CLM()删除匿名回调。
l function CLM(t,m)for i,j in pairs(ModCallbacks)do t=Isaac.GetCallbacks(j)for x=#t,1,-1 do m=t[x].Mod if not(m and m.Name)then Isaac.RemoveCallback(m,j,t[x].Function)end end end end --[[ 清理匿名模组回调,预防代码污染 ]]CLM()local I,M,A,T,F=Isaac,ModCallbacks T=I.GetTime F=T()A=I.AddCallback A({},M.MC_POST_GAME_END,function(_,f)if not f then CLM()end end)A({},M.MC_POST_RENDER,function(p)p=T()for i=1,Game():GetNumPlayers()do if Input.IsActionPressed(ButtonAction.ACTION_RESTART,I.GetPlayer(i).ControllerIndex)then if p-F>=1e4 then CLM()end return end end F=p end) --[[ 自动清理回调 ]] Isaac.AddPriorityCallback({},ModCallbacks.MC_POST_GAME_STARTED,CallbackPriority.IMPORTANT,function(_,c)if not c then Isaac.ExecuteCommand('seed '..Seeds.Seed2String(Game():GetSeeds():GetNextSeed()))end end) --[[ 游戏锁定成就 ]]

--1. 角色的面板属性发生轮换(不兼容谷底石)：
-- 控制台输入lua STATS_SWITCH={...}可以指定轮换次序，输入lua STATS_SWITCH=nil 可以取消轮换次序
-- [A] = B 表示用序号B代表的属性替换序号A的属性
-- 移速(1) <> 攻击(3)
-- 射程(4) <> 射速(2)
-- 弹速(5) <> 幸运(6)
l STATS_SWITCH={[1]=3,[2]=4,[3]=1,[4]=2,[5]=6,[6]=5}local A,B,C,D,E,F,G,H,I,J,Z,Y,X,W,V=Isaac,ModCallbacks.MC_EVALUATE_CACHE,CacheFlag,'MoveSpeed','MaxFireDelay','Damage','TearRange','ShotSpeed','Luck',ipairs Z=A.AddCallback Y=A.RemoveCallback X=function(p,f)p:AddCacheFlags(f)p:EvaluateItems()end W={[1]={k=D,f=C.CACHE_SPEED,i=function(p,i)p[D]=i end,o=function(p)return p[D]end},[2]={k=E,f=C.CACHE_FIREDELAY,i=function(p,i)p[E]=30/i-1 end,o=function(p)return 30/(p[E]+1)end},[3]={k=F,f=C.CACHE_DAMAGE,i=function(p,i)p[F]=i end,o=function(p)return p[F]end},[4]={k=G,f=C.CACHE_RANGE,i=function(p,i)p[G]=40*i end,o=function(p)return p[G]/40 end},[5]={k=H,f=C.CACHE_SHOTSPEED,i=function(p,i)p[H]=i end,o=function(p)return p[H]end},[6]={k=I,f=C.CACHE_LUCK,i=function(p,i)p[I]=i end,o=function(p)return p[I]end}}Z({},B,function(a,p,t,f)t=STATS_SWITCH if t and not V then V=p a={}for _,v in J(W)do f=v.f a[f]=function()Y(a,B,a[f])a[v.k]=v.o(p)end Z(a,B,a[f],f)X(p,f)end for k,v in J(W)do f=v.f a[f]=function()Y(a,B,a[f])v.i(p,a[W[t[k]].k])end Z(a,B,a[f],f)X(p,f)end V=nil end end)

--2. 从游戏中移除道具562(谷底石).
l local I,C,Y,T,A=Isaac,{562},true,{}A=I.AddCallback A(T,23,function(_,c)for _,v in pairs(C)do if c==v then return Y end end end)A(T,31,function(_,p)for _,i in pairs(C)do while p:HasCollectible(i)do p:RemoveCollectible(i)end end end)A(T,37,function(p,f,v,s)if v==100 then repeat p,f=Game():GetItemPool()for _,i in pairs(C)do if i==s then f,s=1,p:GetCollectible(p:GetLastPool(),Y)break end end until not f return{v,s}end end)

--重开一局新游戏。
l local A,B,C,Z=Isaac,ModCallbacks.MC_POST_UPDATE,{}Z=function()A.ExecuteCommand'restart'A.RemoveCallback(C,B,Z)end A.AddCallback(C,B,Z)
--.
