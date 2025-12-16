--网络延迟
--除非重新加载了模组，否则不要重复输入代码！

---- 代码效果(不用管中文，全选复制即可) ----

--* 前置功能性代码（重复输入不额外生效）
l if not(REPENTOGON or _CBH)then local D,E,F,I,J,O,P,Y,W,A,B,C,G,H,K,L,Q,R=require'debug',{},'Function',Isaac,'Callback',{},pairs,true,{}_CBH,A,B,C,G,K,Q,R=Y,D.getlocal,D.setlocal,D.sethook,I.GetCallbacks,'Run'..J,function(i)for _,m in P(G(i))do local o=m[F]if not W[o]then m[F]=O[o]or R(o)end end end,function(f)local function r(...)local s={pcall(f,...)}if s[1]then return table.unpack(s,2)end end O[f],W[r]=r,f return r end L=function(i)_,i=A(3,i)if not E[i]then E[i]=Y Q(i)end end for _,i in P(ModCallbacks)do E[i]=Y end function Wrap()if not H then for i,_ in P(E)do Q(i)end C(function(e)local a=D.getinfo(2,'f').func if a==I['AddPriority'..J]then _,a=A(2,4)L(2)if not W[a]then B(2,4,O[a]or R(a))end elseif a==I['Remove'..J]then _,a=A(2,3)L(2)if not W[a]then B(2,3,O[a]or a)end elseif a==I[K]or a==I[K..'WithParam']or a==G then L(1)end end,'c')H=Y end end function Unwrap()if H then C()for i,_ in P(E)do for _,m in P(G(i))do m[F]=W[m[F]]or m[F]end end O,W,H={},{}end end end -- 安全包装,预防模组兼容问题
l local A,I,M=ModCallbacks,Isaac,'Mod'function CLM(t,m)for i,j in pairs(A)do t=I.GetCallbacks(j)for x=#t,1,-1 do m=t[x][M]if not(m and m.Name)then I.RemoveCallback(m,j,t[x].Function)end end end end -- 清理匿名模组回调,预防代码污染
--0. 避免代码污染和模组不兼容问题，游戏胜利后自动清除代码效果。
--依赖代码* | 提供接口: CLM()删除匿名回调; Wrap()包装模组回调; Unwrap()取消包装。
l Wrap,Unwrap=Wrap or CLM,Unwrap or CLM Wrap()CLM()Isaac.AddCallback({},ModCallbacks.MC_POST_GAME_END,function(_,f)if not f then Unwrap()CLM()end end)

--1. 将玩家的输入延迟15帧（0.25秒），可在控制台输入l Lag = 数值 来调整延迟帧数。
l Lag = 15 local B,C,H,I,M,N,O,T,A,G=table,'ControllerIndex',InputHook,Isaac,ModCallbacks,Input,{},{}A,G=I.AddCallback,I.GetFrameCount A(T,M.MC_POST_PLAYER_RENDER,function(_,p)local t={i=p[C],t=G(),o={}}for k,v in pairs(ButtonAction)do t.o[v]={a=N.IsActionTriggered(v,t.i),p=N.IsActionPressed(v,t.i),v=N.GetActionValue(v,t.i)}end B.insert(O,t)end)A(T,M.MC_INPUT_ACTION,function(_,e,h,a)e=e and e:ToPlayer()local t,r,v=G()for k=#O,1,-1 do v=O[k]r=t-v.t-Lag if r>0 then B.remove(O,k)elseif e and v.i==e[C]and r==0 then if h==H.GET_ACTION_VALUE then return v.o[a].v elseif h==H.IS_ACTION_PRESSED then return v.o[a].p elseif h==H.IS_ACTION_TRIGGERED then return v.o[a].a end end end end)
--.