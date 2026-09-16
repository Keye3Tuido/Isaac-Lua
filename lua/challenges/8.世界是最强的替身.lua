--世界是最强的替身

---- 代码效果 ----

--0. 前置功能性代码：避免代码污染和重复输入问题;
--默认锁定游戏成就;
--游戏胜利后自动清除代码效果; 长按重开键10秒自动清空代码效果;
--提供接口: CLM()删除匿名回调, MEC()包装报错模组, DEMEC()撤销对报错模组的包装
l local a,b,g,d,e,h,c=Isaac,pairs,ModCallbacks,'AddPriorityCallback','RemoveCallback','GetCallbacks','Function'if not(REPENTOGON or _MEC)then _MEC=true local m,s,j,i,o=false,function(f,l)return function(...)local k=table.pack(pcall(f,...))if k[1]then return table.unpack(k,2,k.n)end a.ConsoleOutput(string.format('Error:%s@%s\n',l and l.Name or'Anonymous',k[2]))end end,{},{}o=function(f,l)local k=j[f]or s(f,l)j[k]=f j[f]=k i[f]=(i[f]or 0)+1 return k end local p,n,t=a[d],a[e]t=function(f,k,l,q,r)p(f,k,l,o(q,f),r)end local function u(q,r,f)if i[f]then n(q,r,j[f])i[f]=i[f]-1 if 1>i[f]then local l={}for k,v in b(i)do if k~=f then l[k]=v end end i=l l={}for k,v in b(j)do if k~=f and v~=f then l[k]=v end end j=l end else n(q,r,f)end end function MEC()if not m then a[d]=t a[e]=u for _,k in b(g)do _=a[h](k)for _,f in b(_)do f[c]=o(f[c],f.Mod)end end m=true end end function DEMEC()if m then a[d]=p a[e]=n for _,k in b(g)do _=a[h](k)for _,f in b(_)do f[c]=j[f[c]]or f[c]end end j={}i={}m=false end end end --[[ 包装报错模组 ]]MEC()function CLM(t,m)for i,j in pairs(ModCallbacks)do t=Isaac.GetCallbacks(j)for x=#t,1,-1 do m=t[x].Mod if not(m and m.Name)then Isaac.RemoveCallback(m,j,t[x].Function)end end end end --[[ 清理匿名模组回调,预防代码污染 ]]CLM()local I,M,A,T,F=Isaac,ModCallbacks T=I.GetTime F=T()A=I.AddCallback A({},M.MC_POST_GAME_END,function(_,f)if not f then DEMEC()CLM()end end)A({},M.MC_POST_RENDER,function(p)p=T()for i=1,Game():GetNumPlayers()do if Input.IsActionPressed(ButtonAction.ACTION_RESTART,I.GetPlayer(i).ControllerIndex)then if p-F>=1e4 then DEMEC()CLM()Game():FinishChallenge()Game():Fadeout(1,2)end return end end F=p end) --[[ 自动清理回调 ]] Isaac.AddPriorityCallback({},ModCallbacks.MC_POST_GAME_STARTED,CallbackPriority.IMPORTANT,function(_,c)if not c then Isaac.ExecuteCommand('seed '..Seeds.Seed2String(Game():GetSeeds():GetNextSeed()))end end) --[[ 游戏锁定成就 ]]

--1. 当游戏暂停时，玩家可以正常行动。
l I,Y,U,P,T=Isaac,true,'Update','ToPlayer'T={['Trapdoor']=Y,['MinecartEnter']=Y,['FallIn']=Y,['LeapUp']=Y,['SuperLeapUp']=Y,['LeapDown']=Y,['SuperLeapDown']=Y}I.AddCallback({},ModCallbacks.MC_POST_RENDER,function()if Game():IsPaused()then for _,e in pairs(I.GetRoomEntities())do local p,r,l,k=e[P](e),e.Parent,e:ToLaser(),e:ToKnife()if p and not T[p:GetSprite():GetAnimation()]then p[U](p)elseif r and r[P](r)then if l then l.DisableFollowParent=Y elseif k and not k:IsFlying()then k[U](k)end end end end end)

--重开一局新游戏。
l local A,B,C,Z=Isaac,ModCallbacks.MC_POST_UPDATE,{}Z=function()A.ExecuteCommand'restart'A.RemoveCallback(C,B,Z)end A.AddCallback(C,B,Z)
--.
