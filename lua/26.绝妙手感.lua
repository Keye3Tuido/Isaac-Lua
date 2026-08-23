--绝妙手感


---- 代码效果 ----

--0. 前置功能性代码：避免代码污染和重复输入问题;
--默认锁定游戏成就;
--游戏胜利后自动清除代码效果; 长按重开键10秒自动清空代码效果;
--提供接口: CLM()删除匿名回调。
l function CLM(t,m)for i,j in pairs(ModCallbacks)do t=Isaac.GetCallbacks(j)for x=#t,1,-1 do m=t[x].Mod if not(m and m.Name)then Isaac.RemoveCallback(m,j,t[x].Function)end end end end --[[ 清理匿名模组回调,预防代码污染 ]]CLM()local I,M,A,T,F=Isaac,ModCallbacks T=I.GetTime F=T()A=I.AddCallback A({},M.MC_POST_GAME_END,function(_,f)if not f then CLM()end end)A({},M.MC_POST_RENDER,function(p)p=T()for i=1,Game():GetNumPlayers()do if Input.IsActionPressed(ButtonAction.ACTION_RESTART,I.GetPlayer(i).ControllerIndex)then if p-F>=1e4 then CLM()end return end end F=p end) --[[ 自动清理回调 ]] Isaac.AddPriorityCallback({},ModCallbacks.MC_POST_GAME_STARTED,CallbackPriority.IMPORTANT,function(_,c)if not c then Isaac.ExecuteCommand('seed '..Seeds.Seed2String(Game():GetSeeds():GetNextSeed()))end end) --[[ 游戏锁定成就 ]]

--1. 每WaitFrames(默认10)帧随机BrokenKeys(默认2,最多12)个按键失灵。
-- 可在控制台输入lua BrokenKeys = 数值 来调整失灵按键数量。
-- 可在控制台输入lua WaitFrames = 数值 来调整失灵按键刷新间隔的帧数。
-- GetBrokenKeys()可获取顺序表格，包含当前失灵的按键名称字符串。
l BrokenKeys=2;WaitFrames=10;local A,C,D,M,N,T=Isaac.AddCallback,0,'GetFrameCount',ModCallbacks,{'LEFT','RIGHT','UP','DOWN','SHOOTLEFT','SHOOTRIGHT','SHOOTUP','SHOOTDOWN','BOMB','ITEM','PILLCARD','DROP'},{}A(T,M.MC_POST_UPDATE,function()local g,t,p=Game()t=g[D](g)if t<C or t>=C+WaitFrames then for i=#N,1,-1 do p=Random()%i+1 N[i],N[p]=N[p],N[i]end C=t end end)A(T,M.MC_INPUT_ACTION,function(_,e,h,a)for i=1,BrokenKeys do if a==ButtonAction['ACTION_'..N[i]]then return h==InputHook.GET_ACTION_VALUE and 0 end end end)function GetBrokenKeys()return table.move(N,1,BrokenKeys,1,{})end

--2. 将玩家的输入延迟5帧（约0.17秒），可在控制台输入lua Lag = 数值 来调整延迟帧数。
l Lag=5 local B,C,H,I,M,N,O,T,A,G=table,'ControllerIndex',InputHook,Isaac,ModCallbacks,Input,{},{}A,G=I.AddCallback,I.GetFrameCount A(T,M.MC_POST_PLAYER_RENDER,function(_,p)local t={i=p[C],t=G(),o={}}for k,v in pairs(ButtonAction)do t.o[v]={a=N.IsActionTriggered(v,t.i),p=N.IsActionPressed(v,t.i),v=N.GetActionValue(v,t.i)}end B.insert(O,t)end)A(T,M.MC_INPUT_ACTION,function(_,e,h,a)e=e and e:ToPlayer()local t,r,v=G()for k=#O,1,-1 do v=O[k]r=t-v.t-Lag if r>0 then B.remove(O,k)elseif e and v.i==e[C]and r==0 then if h==H.GET_ACTION_VALUE then return v.o[a].v elseif h==H.IS_ACTION_PRESSED then return v.o[a].p elseif h==H.IS_ACTION_TRIGGERED then return v.o[a].a end end end end)

--重开一局新游戏。
l local A,B,C,Z=Isaac,ModCallbacks.MC_POST_UPDATE,{}Z=function()A.ExecuteCommand'restart'A.RemoveCallback(C,B,Z)end A.AddCallback(C,B,Z)
--.
