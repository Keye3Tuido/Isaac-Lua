--天堂制造
--禁用Goodtrip

---- 代码效果 ----

--0. 前置功能性代码：避免代码污染和重复输入问题;
--默认锁定游戏成就;
--游戏胜利后自动清除代码效果; 长按重开键10秒自动清空代码效果;
--提供接口: CLM()删除匿名回调, MEC()包装报错模组, DEMEC()撤销对报错模组的包装
l local a,b,g,d,e,h,c=Isaac,pairs,ModCallbacks,'AddPriorityCallback','RemoveCallback','GetCallbacks','Function'if not(REPENTOGON or _MEC)then _MEC=true local m,s,j,i,o=false,function(f,l)return function(...)local k=table.pack(pcall(f,...))if k[1]then return table.unpack(k,2,k.n)end a.ConsoleOutput(string.format('Error:%s@%s\n',l and l.Name or'Anonymous',k[2]))end end,{},{}o=function(f,l)local k=j[f]or s(f,l)j[k]=f j[f]=k i[f]=(i[f]or 0)+1 return k end local p,n,t=a[d],a[e]t=function(f,k,l,q,r)p(f,k,l,o(q,f),r)end local function u(q,r,f)if i[f]then n(q,r,j[f])i[f]=i[f]-1 if 1>i[f]then local l={}for k,v in b(i)do if k~=f then l[k]=v end end i=l l={}for k,v in b(j)do if k~=f and v~=f then l[k]=v end end j=l end else n(q,r,f)end end function MEC()if not m then a[d]=t a[e]=u for _,k in b(g)do _=a[h](k)for _,f in b(_)do f[c]=o(f[c],f.Mod)end end m=true end end function DEMEC()if m then a[d]=p a[e]=n for _,k in b(g)do _=a[h](k)for _,f in b(_)do f[c]=j[f[c]]or f[c]end end j={}i={}m=false end end end --[[ 包装报错模组 ]]MEC()function CLM(t,m)for i,j in pairs(ModCallbacks)do t=Isaac.GetCallbacks(j)for x=#t,1,-1 do m=t[x].Mod if not(m and m.Name)then Isaac.RemoveCallback(m,j,t[x].Function)end end end end --[[ 清理匿名模组回调,预防代码污染 ]]CLM()local I,M,A,T,F=Isaac,ModCallbacks T=I.GetTime F=T()A=I.AddCallback A({},M.MC_POST_GAME_END,function(_,f)if not f then DEMEC()CLM()end end)A({},M.MC_POST_RENDER,function(p)p=T()for i=1,Game():GetNumPlayers()do if Input.IsActionPressed(ButtonAction.ACTION_RESTART,I.GetPlayer(i).ControllerIndex)then if p-F>=1e4 then DEMEC()CLM()Game():FinishChallenge()Game():Fadeout(1,2)end return end end F=p end) --[[ 自动清理回调 ]] Isaac.AddPriorityCallback({},ModCallbacks.MC_POST_GAME_STARTED,CallbackPriority.IMPORTANT,function(_,c)if not c then Isaac.ExecuteCommand('seed '..Seeds.Seed2String(Game():GetSeeds():GetNextSeed()))end end) --[[ 游戏锁定成就 ]]

--1. 游戏会缓慢加速
l local a,s,I,u,i,f,Z,b,t,T,A,N=0,1,Isaac,0,0,0,{}T,A=I.GetFrameCount,I.AddCallback t=T()A(Z,1,function()u=T()if(u-t>59)then t=u s=s+.001 end if(b)then return end b=1 i=s//1 f=s-i a=a+f if(a>=1)then i=i+1 a=a-1 end for _=1,i-1 do Game():Update()end b=N end)A(Z,2,function()I.RenderText(string.format('%.3f',s),I.GetScreenWidth()/2,10,0,1,1,1)end)A(Z,15,function(_,c)if(not c)then s=1 end end)


--2. [不适配手柄]禁止玩家暂停游戏、禁止使用控制台(忏悔+不生效)；可使用Esc返回游戏菜单
l local A,B,M,T,O,P=Isaac.AddCallback,ButtonAction,ModCallbacks,{},Options,'PauseOnFocusLost'A(T,M.MC_POST_RENDER,function()O[P]=false for i=1,Game():GetNumPlayers()do local c=Isaac.GetPlayer(i-1).ControllerIndex if Input.IsActionPressed(B.ACTION_MENUBACK,c)then Game():Fadeout(1,2)end end end)A(T,M.MC_INPUT_ACTION,function(_,_,h,b)if b==B.ACTION_CONSOLE or b==B.ACTION_PAUSE then return h==InputHook.GET_ACTION_VALUE and 0 or false end end)A(T,M.MC_PRE_MOD_UNLOAD,function()O[P]=true end)

--重开一局新游戏。
l local A,B,C,Z=Isaac,ModCallbacks.MC_POST_UPDATE,{}Z=function()A.ExecuteCommand'restart'A.RemoveCallback(C,B,Z)end A.AddCallback(C,B,Z)
--.
