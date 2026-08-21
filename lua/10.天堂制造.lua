--天堂制造
--禁用Goodtrip

---- 代码效果 ----

--0. 前置功能性代码：避免代码污染和重复输入问题;
--默认锁定游戏成就;
--游戏胜利后自动清除代码效果; 长按重开键10秒自动清空代码效果;
--提供接口: CLM()删除匿名回调。
l function CLM(t,m)for i,j in pairs(ModCallbacks)do t=Isaac.GetCallbacks(j)for x=#t,1,-1 do m=t[x].Mod if not(m and m.Name)then Isaac.RemoveCallback(m,j,t[x].Function)end end end end --[[ 清理匿名模组回调,预防代码污染 ]]CLM()local I,M,A,T,F=Isaac,ModCallbacks T=I.GetTime F=T()A=I.AddCallback A({},M.MC_POST_GAME_END,function(_,f)if not f then CLM()end end)A({},M.MC_POST_RENDER,function(p)p=T()for i=1,Game():GetNumPlayers()do if Input.IsActionPressed(ButtonAction.ACTION_RESTART,I.GetPlayer(i).ControllerIndex)then if p-F>=1e4 then CLM()end return end end F=p end) --[[ 自动清理回调 ]] Isaac.AddPriorityCallback({},ModCallbacks.MC_POST_GAME_STARTED,CallbackPriority.IMPORTANT,function(_,c)if not c then Isaac.ExecuteCommand('seed '..Seeds.Seed2String(Game():GetSeeds():GetNextSeed()))end end) --[[ 游戏锁定成就 ]]

--1. 游戏会缓慢加速
l local a,s,I,u,i,f,Z,b,t,T,A,N=0,1,Isaac,0,0,0,{}T,A=I.GetFrameCount,I.AddCallback t=T()A(Z,1,function()u=T()if(u-t>59)then t=u s=s+.001 end if(b)then return end b=1 i=s//1 f=s-i a=a+f if(a>=1)then i=i+1 a=a-1 end for _=1,i-1 do Game():Update()end b=N end)A(Z,2,function()I.RenderText(string.format('%.3f',s),I.GetScreenWidth()/2,10,0,1,1,1)end)A(Z,15,function(_,c)if(not c)then s=1 end end)


--2. [不适配手柄]禁止玩家暂停游戏、禁止使用控制台(忏悔+不生效)；可使用Esc返回游戏菜单
l local A,B,M,T,O,P=Isaac.AddCallback,ButtonAction,ModCallbacks,{},Options,'PauseOnFocusLost'A(T,M.MC_POST_RENDER,function()O[P]=false for i=1,Game():GetNumPlayers()do local c=Isaac.GetPlayer(i-1).ControllerIndex if Input.IsActionPressed(B.ACTION_MENUBACK,c)then Game():Fadeout(1,2)end end end)A(T,M.MC_INPUT_ACTION,function(_,_,h,b)if b==B.ACTION_CONSOLE or b==B.ACTION_PAUSE then return h==InputHook.GET_ACTION_VALUE and 0 or false end end)A(T,M.MC_PRE_MOD_UNLOAD,function()O[P]=true end)

--重开一局新游戏。
l Isaac.ExecuteCommand'restart'
--.
