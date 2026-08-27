--世界是最强的替身

---- 代码效果 ----

--0. 前置功能性代码：避免代码污染和重复输入问题;
--默认锁定游戏成就;
--游戏胜利后自动清除代码效果; 长按重开键10秒自动清空代码效果;
--提供接口: CLM()删除匿名回调, MEC()包装报错模组, DEMEC()恢复对报错模组的包装
l local c,a,b,i,e,g,h,j,d=table,Isaac,pairs,ModCallbacks,'unpack','AddPriorityCallback','RemoveCallback','GetCallbacks','Function'if not(REPENTOGON or _MEC)then _MEC=true local o,u,m,l,r,p=false,function(f)return function(...)local k=c.pack(pcall(f,...))if k[1]then return c[e](k,2,k.n)end end end,{},{},a[g],a[h]local q=function(f)local k=m[f]or u(f)m[k]=f m[f]=k l[f]=(l[f]or 0)+1 return k end local w,x=function(s,t,v,f,k)r(s,t,v,q(f),k)end,function(s,t,f)if l[f]then p(s,t,m[f])l[f]=l[f]-1 if l[f]<1 then local n={}for k,v in b(l)do if k~=f then n[k]=v end end l=n n={}for k,v in b(m)do if k~=f and v~=f then n[k]=v end end m=n end else p(s,t,f)end end function MEC()if not o then a[g]=w a[h]=x for _,k in b(i)do local n=a[j](k)for _,f in b(n)do f[d]=q(f[d])end end o=true end end function DEMEC()if o then a[g]=r a[h]=p for _,k in b(i)do local n=a[j](k)for _,f in b(n)do f[d]=m[f[d]]or f[d]end end m={}l={}o=false end end end --[[ 包装报错模组 ]]MEC()function CLM(t,m)for i,j in pairs(ModCallbacks)do t=Isaac.GetCallbacks(j)for x=#t,1,-1 do m=t[x].Mod if not(m and m.Name)then Isaac.RemoveCallback(m,j,t[x].Function)end end end end --[[ 清理匿名模组回调,预防代码污染 ]]CLM()local I,M,A,T,F=Isaac,ModCallbacks T=I.GetTime F=T()A=I.AddCallback A({},M.MC_POST_GAME_END,function(_,f)if not f then DEMEC()CLM()end end)A({},M.MC_POST_RENDER,function(p)p=T()for i=1,Game():GetNumPlayers()do if Input.IsActionPressed(ButtonAction.ACTION_RESTART,I.GetPlayer(i).ControllerIndex)then if p-F>=1e4 then DEMEC()CLM()Game():FinishChallenge()Game():Fadeout(1,2)end return end end F=p end) --[[ 自动清理回调 ]] Isaac.AddPriorityCallback({},ModCallbacks.MC_POST_GAME_STARTED,CallbackPriority.IMPORTANT,function(_,c)if not c then Isaac.ExecuteCommand('seed '..Seeds.Seed2String(Game():GetSeeds():GetNextSeed()))end end) --[[ 游戏锁定成就 ]]

--1. 当游戏暂停时，玩家可以正常行动。
l I,Y,U,P,T=Isaac,true,'Update','ToPlayer'T={['Trapdoor']=Y,['MinecartEnter']=Y,['FallIn']=Y,['LeapUp']=Y,['SuperLeapUp']=Y,['LeapDown']=Y,['SuperLeapDown']=Y}I.AddCallback({},ModCallbacks.MC_POST_RENDER,function()if Game():IsPaused()then for _,e in pairs(I.GetRoomEntities())do local p,r,l,k=e[P](e),e.Parent,e:ToLaser(),e:ToKnife()if p and not T[p:GetSprite():GetAnimation()]then p[U](p)elseif r and r[P](r)then if l then l.DisableFollowParent=Y elseif k and not k:IsFlying()then k[U](k)end end end end end)

--重开一局新游戏。
l local A,B,C,Z=Isaac,ModCallbacks.MC_POST_UPDATE,{}Z=function()A.ExecuteCommand'restart'A.RemoveCallback(C,B,Z)end A.AddCallback(C,B,Z)
--.
