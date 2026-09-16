--网络延迟


---- 代码效果 ----

--0. 前置功能性代码：避免代码污染和重复输入问题;
--默认锁定游戏成就;
--游戏胜利后自动清除代码效果; 长按重开键10秒自动清空代码效果;
--提供接口: CLM()删除匿名回调, MEC()包装报错模组, DEMEC()撤销对报错模组的包装
l local a,b,g,d,e,h,c=Isaac,pairs,ModCallbacks,'AddPriorityCallback','RemoveCallback','GetCallbacks','Function'if not(REPENTOGON or _MEC)then _MEC=true local m,s,j,i,o=false,function(f,l)return function(...)local k=table.pack(pcall(f,...))if k[1]then return table.unpack(k,2,k.n)end a.ConsoleOutput(string.format('Error:%s@%s\n',l and l.Name or'Anonymous',k[2]))end end,{},{}o=function(f,l)local k=j[f]or s(f,l)j[k]=f j[f]=k i[f]=(i[f]or 0)+1 return k end local p,n,t=a[d],a[e]t=function(f,k,l,q,r)p(f,k,l,o(q,f),r)end local function u(q,r,f)if i[f]then n(q,r,j[f])i[f]=i[f]-1 if 1>i[f]then local l={}for k,v in b(i)do if k~=f then l[k]=v end end i=l l={}for k,v in b(j)do if k~=f and v~=f then l[k]=v end end j=l end else n(q,r,f)end end function MEC()if not m then a[d]=t a[e]=u for _,k in b(g)do _=a[h](k)for _,f in b(_)do f[c]=o(f[c],f.Mod)end end m=true end end function DEMEC()if m then a[d]=p a[e]=n for _,k in b(g)do _=a[h](k)for _,f in b(_)do f[c]=j[f[c]]or f[c]end end j={}i={}m=false end end end --[[ 包装报错模组 ]]MEC()function CLM(t,m)for i,j in pairs(ModCallbacks)do t=Isaac.GetCallbacks(j)for x=#t,1,-1 do m=t[x].Mod if not(m and m.Name)then Isaac.RemoveCallback(m,j,t[x].Function)end end end end --[[ 清理匿名模组回调,预防代码污染 ]]CLM()local I,M,A,T,F=Isaac,ModCallbacks T=I.GetTime F=T()A=I.AddCallback A({},M.MC_POST_GAME_END,function(_,f)if not f then DEMEC()CLM()end end)A({},M.MC_POST_RENDER,function(p)p=T()for i=1,Game():GetNumPlayers()do if Input.IsActionPressed(ButtonAction.ACTION_RESTART,I.GetPlayer(i).ControllerIndex)then if p-F>=1e4 then DEMEC()CLM()Game():FinishChallenge()Game():Fadeout(1,2)end return end end F=p end) --[[ 自动清理回调 ]] Isaac.AddPriorityCallback({},ModCallbacks.MC_POST_GAME_STARTED,CallbackPriority.IMPORTANT,function(_,c)if not c then Isaac.ExecuteCommand('seed '..Seeds.Seed2String(Game():GetSeeds():GetNextSeed()))end end) --[[ 游戏锁定成就 ]]

--1. 将玩家的输入延迟15帧（约0.5秒），可在控制台输入lua Lag = 数值 来调整延迟帧数。
l Lag=15 local B,C,H,I,M,N,O,T,A,G=table,'ControllerIndex',InputHook,Isaac,ModCallbacks,Input,{},{}A,G=I.AddCallback,I.GetFrameCount A(T,M.MC_POST_PLAYER_RENDER,function(_,p)local t={i=p[C],t=G(),o={}}for k,v in pairs(ButtonAction)do t.o[v]={a=N.IsActionTriggered(v,t.i),p=N.IsActionPressed(v,t.i),v=N.GetActionValue(v,t.i)}end B.insert(O,t)end)A(T,M.MC_INPUT_ACTION,function(_,e,h,a)e=e and e:ToPlayer()local t,r,v=G()for k=#O,1,-1 do v=O[k]r=t-v.t-Lag if r>0 then B.remove(O,k)elseif e and v.i==e[C]and r==0 then if h==H.GET_ACTION_VALUE then return v.o[a].v elseif h==H.IS_ACTION_PRESSED then return v.o[a].p elseif h==H.IS_ACTION_TRIGGERED then return v.o[a].a end end end end)

--2. 实时显示当前的输入延迟帧数。
-- 可在控制台输入lua DisplayLag = false 来关闭显示，true来开启显示。
--依赖代码1
l DisplayLag=true;local I=Isaac I.AddCallback({},ModCallbacks.MC_POST_RENDER,function()if DisplayLag then local s=string.format('%.2fs',Lag/30)I.RenderText(s,(I.GetScreenWidth()-I.GetTextWidth(s))/2,10,1,1,0,1)end end)

--重开一局新游戏。
l local A,B,C,Z=Isaac,ModCallbacks.MC_POST_UPDATE,{}Z=function()A.ExecuteCommand'restart'A.RemoveCallback(C,B,Z)end A.AddCallback(C,B,Z)
--.
