--天降酸雨
--角色限定：初始攻击方式为眼泪
--输入下面的代码后，开始一局新游戏
--除非重新加载了模组，否则不要重复输入代码！

---- 代码效果(不用管中文，全选复制即可) ----

--* 前置功能性代码（重复输入不额外生效）
l if not(REPENTOGON or _CBH)then local D,E,F,I,J,O,P,Y,W,A,B,C,G,H,K,L,Q,R=require'debug',{},'Function',Isaac,'Callback',{},pairs,true,{}_CBH,A,B,C,G,K,Q,R=Y,D.getlocal,D.setlocal,D.sethook,I.GetCallbacks,'Run'..J,function(i)for _,m in P(G(i))do local o=m[F]if not W[o]then m[F]=O[o]or R(o)end end end,function(f)local function r(...)local s={pcall(f,...)}if s[1]then return table.unpack(s,2)end end O[f],W[r]=r,f return r end L=function(i)_,i=A(3,i)if not E[i]then E[i]=Y Q(i)end end for _,i in P(ModCallbacks)do E[i]=Y end function Wrap()if not H then for i,_ in P(E)do Q(i)end C(function(e)local a=D.getinfo(2,'f').func if a==I['AddPriority'..J]then _,a=A(2,4)L(2)if not W[a]then B(2,4,O[a]or R(a))end elseif a==I['Remove'..J]then _,a=A(2,3)L(2)if not W[a]then B(2,3,O[a]or a)end elseif a==I[K]or a==I[K..'WithParam']or a==G then L(1)end end,'c')H=Y end end function Unwrap()if H then C()for i,_ in P(E)do for _,m in P(G(i))do m[F]=W[m[F]]or m[F]end end O,W,H={},{}end end end -- 安全包装,预防模组兼容问题
l local A,I,M=ModCallbacks,Isaac,'Mod'function CLM(t,m)for i,j in pairs(A)do t=I.GetCallbacks(j)for x=#t,1,-1 do m=t[x][M]if not(m and m.Name)then I.RemoveCallback(m,j,t[x].Function)end end end end -- 清理匿名模组回调,预防代码污染
--0. 避免代码污染和模组不兼容问题，游戏胜利后自动清除代码效果。
--依赖代码* | 提供接口: CLM()删除匿名回调; Wrap()包装模组回调; Unwrap()取消包装。
l Wrap,Unwrap=Wrap or CLM,Unwrap or CLM Wrap()CLM()Isaac.AddCallback({},ModCallbacks.MC_POST_GAME_END,function(_,f)if not f then Unwrap()CLM()end end)

--1. 强制锁定所有玩家射程为100（受谷底石、天秤影响）；锁定弹速为0（无法更改）
l local f=Isaac.AddCallback f(_,4,function(_,p)p.ShotSpeed=0 end)f(_,8,function(_,p)p.TearRange=4e3 end,8)

--2. 强制给予玩家道具149-吐根酊,315-怪异磁铁,330-豆奶,540-扁石。
l Isaac.AddCallback({},31,function(c,p,n)if 40~=p:GetPlayerType()and not p:HasCurseMistEffect()then for _,i in pairs({149,315,330,540})do c,n=table.unpack(type(i)=='table'and i or{i,1})while n>p:GetCollectibleNum(c)do p:AddCollectible(c,Isaac.GetItemConfig():GetCollectible(c).InitCharge)end Game():GetItemPool():RemoveCollectible(c)end end end)
--.