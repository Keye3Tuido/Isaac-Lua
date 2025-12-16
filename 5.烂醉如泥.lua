--烂醉如泥（注意！很晕！！！）
--输入下面的代码后，开始一局新游戏
--除非重新加载了模组，否则不要重复输入代码

---- 代码效果(不用管中文，全选复制即可) ----

--* 前置功能性代码（重复输入不额外生效）
l if not(REPENTOGON or _CBH)then local D,E,F,I,J,O,P,Y,W,A,B,C,G,H,K,L,Q,R=require'debug',{},'Function',Isaac,'Callback',{},pairs,true,{}_CBH,A,B,C,G,K,Q,R=Y,D.getlocal,D.setlocal,D.sethook,I.GetCallbacks,'Run'..J,function(i)for _,m in P(G(i))do local o=m[F]if not W[o]then m[F]=O[o]or R(o)end end end,function(f)local function r(...)local s={pcall(f,...)}if s[1]then return table.unpack(s,2)end end O[f],W[r]=r,f return r end L=function(i)_,i=A(3,i)if not E[i]then E[i]=Y Q(i)end end for _,i in P(ModCallbacks)do E[i]=Y end function Wrap()if not H then for i,_ in P(E)do Q(i)end C(function(e)local a=D.getinfo(2,'f').func if a==I['AddPriority'..J]then _,a=A(2,4)L(2)if not W[a]then B(2,4,O[a]or R(a))end elseif a==I['Remove'..J]then _,a=A(2,3)L(2)if not W[a]then B(2,3,O[a]or a)end elseif a==I[K]or a==I[K..'WithParam']or a==G then L(1)end end,'c')H=Y end end function Unwrap()if H then C()for i,_ in P(E)do for _,m in P(G(i))do m[F]=W[m[F]]or m[F]end end O,W,H={},{}end end end -- 安全包装,预防模组兼容问题
l local A,I,M=ModCallbacks,Isaac,'Mod'function CLM(t,m)for i,j in pairs(A)do t=I.GetCallbacks(j)for x=#t,1,-1 do m=t[x][M]if not(m and m.Name)then I.RemoveCallback(m,j,t[x].Function)end end end end -- 清理匿名模组回调,预防代码污染
--0. 避免代码污染和模组不兼容问题，游戏胜利后自动清除代码效果。
--依赖代码* | 提供接口: CLM()删除匿名回调; Wrap()包装模组回调; Unwrap()取消包装。
l Wrap,Unwrap=Wrap or CLM,Unwrap or CLM Wrap()CLM()Isaac.AddCallback({},ModCallbacks.MC_POST_GAME_END,function(_,f)if not f then Unwrap()CLM()end end)

--1. 所有实体贴图会旋转、变大或变小；游戏会不时变慢和变快（损坏的怀表效果）
l local I,M,V,R,S=Isaac,math,Vector,'SpriteRotation','SpriteScale'I.AddCallback({},1,function()local t,r,a,b,d,g,s=I.GetTime()/1e3,Game():GetRoom()a,b=M.sin(t),M.cos(t)for _,e in pairs(I.GetRoomEntities())do if e.Type~=1 or e.Parent then d=e.InitSeed if d&1==0 then d=1 else d=-1 end e[R]=(e[R]+d)%360 e[S]=V(1.5*a,1+.5*b)e.SizeMulti=e[S]else e[R]=20*a end r:SetBrokenWatchState(t//1%3)end for i=0,r:GetGridSize()-1 do g=r:GetGridEntity(i)if g then s=g:GetSprite()d=i if d&1==0 then d=1 else d=-1 end s.Rotation=(s.Rotation+d)%360 s.Scale=V(1+.5*a,1.5*b)end end end)

--2. 玩家眼泪获得追踪、幽灵和穿刺效果；每进入新楼层，都会在初始房间生成一个死亡证明
l local A=Isaac.AddCallback A({},8,function(_,p)p.TearFlags=p.TearFlags|7 end,32)A({},18,function()Isaac.ExecuteCommand('spawn 5.100.628')end)
--.