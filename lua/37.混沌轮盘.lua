--混沌轮盘


---- 代码效果 ----

--0. 前置功能性代码：避免代码污染和重复输入问题;
--默认锁定游戏成就;
--游戏胜利后自动清除代码效果; 长按重开键10秒自动清空代码效果;
--提供接口: CLM()删除匿名回调。
l function CLM(t,m)for i,j in pairs(ModCallbacks)do t=Isaac.GetCallbacks(j)for x=#t,1,-1 do m=t[x].Mod if not(m and m.Name)then Isaac.RemoveCallback(m,j,t[x].Function)end end end end --[[ 清理匿名模组回调,预防代码污染 ]]CLM()local I,M,A,T,F=Isaac,ModCallbacks T=I.GetTime F=T()A=I.AddCallback A({},M.MC_POST_GAME_END,function(_,f)if not f then CLM()end end)A({},M.MC_POST_RENDER,function(p)p=T()for i=1,Game():GetNumPlayers()do if Input.IsActionPressed(ButtonAction.ACTION_RESTART,I.GetPlayer(i).ControllerIndex)then if p-F>=1e4 then CLM()end return end end F=p end) --[[ 自动清理回调 ]] Isaac.AddPriorityCallback({},ModCallbacks.MC_POST_GAME_STARTED,CallbackPriority.IMPORTANT,function(_,c)if not c then Isaac.ExecuteCommand('seed '..Seeds.Seed2String(Game():GetSeeds():GetNextSeed()))end end) --[[ 游戏锁定成就 ]]

--1. 角色的面板属性突破限制、轮转替换。
l local j,l,a,b,c,d,e,f,i,m,g,h=CacheFlag,pairs,'MoveSpeed','MaxFireDelay','Damage','TearRange','ShotSpeed','Luck',Isaac,ModCallbacks g=i.AddCallback h=m.MC_EVALUATE_CACHE g({},m.MC_POST_PEFFECT_UPDATE,function(t,p,q,r)q={}r={}t={[j.CACHE_SPEED]=a,[j.CACHE_FIREDELAY]=b,[j.CACHE_DAMAGE]=c,[j.CACHE_RANGE]=d,[j.CACHE_SHOTSPEED]=e,[j.CACHE_LUCK]=f}for k,v in l(t)do q[k]=function()q[v]=p[v]end g(r,h,q[k],k)end p:AddCacheFlags(j.CACHE_ALL)p:EvaluateItems()for k,v in l(t)do i.RemoveCallback(r,h,q[k])end p[a]=30/(1+q[b])p[b]=30/q[c]-1 p[c]=p[d]/40 p[d]=q[e]*40 p[e]=q[f]p[f]=q[a]end)

--重开一局新游戏。
l local A,B,C,Z=Isaac,ModCallbacks.MC_POST_UPDATE,{}Z=function()A.ExecuteCommand'restart'A.RemoveCallback(C,B,Z)end A.AddCallback(C,B,Z)
--.
