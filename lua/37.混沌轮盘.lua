--混沌轮盘


---- 代码效果 ----

--0. 前置功能性代码：避免代码污染和重复输入问题;
--默认锁定游戏成就;
--游戏胜利后自动清除代码效果; 长按重开键10秒自动清空代码效果;
--提供接口: CLM()删除匿名回调。
l function CLM(t,m)for i,j in pairs(ModCallbacks)do t=Isaac.GetCallbacks(j)for x=#t,1,-1 do m=t[x].Mod if not(m and m.Name)then Isaac.RemoveCallback(m,j,t[x].Function)end end end end --[[ 清理匿名模组回调,预防代码污染 ]]CLM()local I,M,A,T,F=Isaac,ModCallbacks T=I.GetTime F=T()A=I.AddCallback A({},M.MC_POST_GAME_END,function(_,f)if not f then CLM()end end)A({},M.MC_POST_RENDER,function(p)p=T()for i=1,Game():GetNumPlayers()do if Input.IsActionPressed(ButtonAction.ACTION_RESTART,I.GetPlayer(i).ControllerIndex)then if p-F>=1e4 then CLM()end return end end F=p end) --[[ 自动清理回调 ]] Isaac.AddPriorityCallback({},ModCallbacks.MC_POST_GAME_STARTED,CallbackPriority.IMPORTANT,function(_,c)if not c then Isaac.ExecuteCommand('seed '..Seeds.Seed2String(Game():GetSeeds():GetNextSeed()))end end) --[[ 游戏锁定成就 ]]

--1. 角色的面板属性发生轮换：
-- 移速 <> 攻击
-- 射程 <> 射速
-- 弹速 <> 幸运
l local A,B,C,D,E,F,G,H,I,J,Z,Y,X,W,V=Isaac,ModCallbacks,CacheFlag,pairs,'MoveSpeed','MaxFireDelay','Damage','TearRange','ShotSpeed','Luck'Z=A.AddCallback Y=A.RemoveCallback X=B.MC_EVALUATE_CACHE W={[C.CACHE_SPEED]=E,[C.CACHE_FIREDELAY]=F,[C.CACHE_DAMAGE]=G,[C.CACHE_RANGE]=H,[C.CACHE_SHOTSPEED]=I,[C.CACHE_LUCK]=J}V=function(p)p:AddCacheFlags(C.CACHE_ALL)p:EvaluateItems()end Z({},B.MC_POST_PEFFECT_UPDATE,function(a,p,b)a={}for k,v in D(W)do a[k]=function()a[v]=p[v]end Z(a,X,a[k],k)end V(p)for k,_ in D(W)do Y(a,X,a[k])end b=function()p[E]=a[G]p[G]=a[E]p[H]=1200/(a[F]+1)p[F]=1200/a[H]-1 p[I]=a[J]p[J]=a[I]end Z(a,X,b)V(p)Y(a,X,b)end)

--重开一局新游戏。
l local A,B,C,Z=Isaac,ModCallbacks.MC_POST_UPDATE,{}Z=function()A.ExecuteCommand'restart'A.RemoveCallback(C,B,Z)end A.AddCallback(C,B,Z)
--.
