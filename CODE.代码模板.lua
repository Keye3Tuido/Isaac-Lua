--挑战名称
--禁用角色：
--限定角色：
--禁止难度：
--限定难度：
--输入下面的代码后，重新开始一局新游戏


---- 代码效果(不用管中文，全选复制即可) ----

--0. 前置功能性代码：避免代码污染、重复输入和模组不兼容问题;
--游戏胜利后自动清除代码效果; 长按重开键10秒自动清空代码效果;
--挑战若卡顿可按下"-"键关闭兼容模式；按下"="键可重新开启兼容模式（可能卡顿）、兼容模式下代码和模组的兼容会更稳定；
--提供接口: CLM()删除匿名回调; Wrap()包装模组回调; Unwrap()取消包装。
l if not(REPENTOGON or _CBH)then local D,E,F,I,J,O,P,Y,W,A,B,C,G,H,K,L,Q,R=require'debug',{},'Function',Isaac,'Callback',{},pairs,true,{}_CBH,A,B,C,G,K,Q,R=Y,D.getlocal,D.setlocal,D.sethook,I.GetCallbacks,'Run'..J,function(i)for _,m in P(G(i))do local o=m[F]if not W[o]then m[F]=O[o]or R(o)end end end,function(f)local function r(...)local s={pcall(f,...)}if s[1]then return table.unpack(s,2)end end O[f],W[r]=r,f return r end L=function(i)_,i=A(3,i)if not E[i]then E[i]=Y Q(i)end end for _,i in P(ModCallbacks)do E[i]=Y end function Wrap()if not H then for i,_ in P(E)do Q(i)end C(function()local a=D.getinfo(2,'f').func if a==I['AddPriority'..J]then _,a=A(2,4)L(2)if not W[a]then B(2,4,O[a]or R(a))end elseif a==I['Remove'..J]then _,a=A(2,3)L(2)if not W[a]then B(2,3,O[a]or a)end elseif a==I[K]or a==I[K..'WithParam']or a==G then L(1)end end,'c')H=Y end end function Unwrap()if H then C()for i,_ in P(E)do for _,m in P(G(i))do m[F]=W[m[F]]or m[F]end end O,W,H={},{}end end end -- 安全包装,预防模组兼容问题
l local A,I=ModCallbacks,Isaac;function CLM(t,m)for i,j in pairs(A)do t=I.GetCallbacks(j)for x=#t,1,-1 do m=t[x].Mod if not(m and m.Name)then I.RemoveCallback(m,j,t[x].Function)end end end end -- 清理匿名模组回调,预防代码污染
l Wrap,Unwrap=Wrap or CLM,Unwrap or CLM Wrap()CLM()local E,I,K,M,N,A,B,T,F=error,Isaac,Keyboard,ModCallbacks,Input B=N.IsButtonTriggered T=I.GetTime F=T()A=I.AddCallback A({},M.MC_POST_GAME_END,function(_,f)if not f then Unwrap()CLM()end end)A({},M.MC_POST_RENDER,function(p,q)p=T()for i=1,Game():GetNumPlayers()do q=I.GetPlayer(i).ControllerIndex if B(K.KEY_MINUS,q)then Unwrap()E('CBWrapper Disabled',0)elseif B(K.KEY_EQUAL,q)then Wrap()E('CBWrapper Enabled',0)end if N.IsActionPressed(ButtonAction.ACTION_RESTART,q)then if p-F>=1e4 then Unwrap()CLM()end return end end F=p end) -- 对外提供接口、自动清理回调、按键包装回调

--代码模板(总字数指排除XXX,func,arg外的总字数)
--回调数N=1 | 总字数=35
l Isaac.AddCallback({},ModCallbacks.XXX,func,arg)
--1<回调数N<=4 | 总字数=41+8N
l local A,M=Isaac.AddCallback,ModCallbacks;A({},M.XXX,func,arg)
--4<=回调数N<=10 | 总字数=45+7N
l local A,M,T=Isaac.AddCallback,ModCallbacks,{}A(T,M.XXX,func,arg)
--10<=回调数N | 总字数=65+5N
l local M,A=ModCallbacks,function(...)Isaac.AddCallback({},...)end;A(M.XXX,func,arg)

--.
