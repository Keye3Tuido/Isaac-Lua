--天堂制造
--禁用Goodtrip
--输入下面的代码后，开始一局新游戏
--除非重新加载了模组，否则不要重复输入代码!

---- 代码效果(不用管中文，全选复制即可) ----

--0. 删除匿名模组的回调。游戏胜利后自动清理代码效果。
--控制台输入 lua CLM() 可删除所有匿名模组的回调，用于预防重复输入代码和清理代码效果。
--重复输入此代码不额外生效。
l local A,I,M,t,m=ModCallbacks,Isaac,'Mod'function CLM()for i,j in pairs(A)do t=I.GetCallbacks(j)for x=#t,1,-1 do m=t[x][M]if not(m and m.Name)then I.RemoveCallback(m,j,t[x].Function)end end end end CLM()I.AddCallback({},A.MC_POST_GAME_END,function(_,f)if not f then CLM()end end)

--1. 游戏会缓慢加速
l local a,s,I,u,i,f,Z,b,t,T,A,N=0,1,Isaac,0,0,0,{}T,A=I.GetFrameCount,I.AddCallback t=T()A(Z,1,function()u=T()if(u-t>59)then t=u s=s+.001 end if(b)then return end b=1 i=s//1 f=s-i a=a+f if(a>=1)then i=i+1 a=a-1 end for _=1,i-1 do Game():Update()end b=N end)A(Z,2,function()I.RenderText(string.format('%.3f',s),I.GetScreenWidth()/2,10,0,1,1,1)end)A(Z,15,function(_,c)if(not c)then s=1 end end)


--2. [不适配手柄]禁止玩家暂停游戏、禁止使用控制台(忏悔+不生效)；可使用Esc返回游戏菜单
l local A,B,M,T,O,P=Isaac.AddCallback,ButtonAction,ModCallbacks,{},Options,'PauseOnFocusLost'A(T,M.MC_POST_RENDER,function()O[P]=false for i=1,Game():GetNumPlayers()do local c=Isaac.GetPlayer(i-1).ControllerIndex if Input.IsActionPressed(B.ACTION_MENUBACK,c)then Game():Fadeout(1,2)end end end)A(T,M.MC_INPUT_ACTION,function(_,_,h,b)if b==B.ACTION_CONSOLE or b==B.ACTION_PAUSE then return h==InputHook.GET_ACTION_VALUE and 0 or false end end)A(T,M.MC_PRE_MOD_UNLOAD,function()O[P]=true end)
--.