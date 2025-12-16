--丢雷佬
--禁用角色：Lilith, Lilith(Tainted)
--除非重新加载了模组，否则不要重复输入代码！

---- 代码效果(不用管中文，全选复制即可) ----

--* 前置功能性代码（重复输入不额外生效）
l if not(REPENTOGON or _CBH)then local D,E,F,I,J,O,P,Y,W,A,B,C,G,H,K,L,Q,R=require'debug',{},'Function',Isaac,'Callback',{},pairs,true,{}_CBH,A,B,C,G,K,Q,R=Y,D.getlocal,D.setlocal,D.sethook,I.GetCallbacks,'Run'..J,function(i)for _,m in P(G(i))do local o=m[F]if not W[o]then m[F]=O[o]or R(o)end end end,function(f)local function r(...)local s={pcall(f,...)}if s[1]then return table.unpack(s,2)end end O[f],W[r]=r,f return r end L=function(i)_,i=A(3,i)if not E[i]then E[i]=Y Q(i)end end for _,i in P(ModCallbacks)do E[i]=Y end function Wrap()if not H then for i,_ in P(E)do Q(i)end C(function(e)local a=D.getinfo(2,'f').func if a==I['AddPriority'..J]then _,a=A(2,4)L(2)if not W[a]then B(2,4,O[a]or R(a))end elseif a==I['Remove'..J]then _,a=A(2,3)L(2)if not W[a]then B(2,3,O[a]or a)end elseif a==I[K]or a==I[K..'WithParam']or a==G then L(1)end end,'c')H=Y end end function Unwrap()if H then C()for i,_ in P(E)do for _,m in P(G(i))do m[F]=W[m[F]]or m[F]end end O,W,H={},{}end end end -- 安全包装,预防模组兼容问题
l local A,I,M=ModCallbacks,Isaac,'Mod'function CLM(t,m)for i,j in pairs(A)do t=I.GetCallbacks(j)for x=#t,1,-1 do m=t[x][M]if not(m and m.Name)then I.RemoveCallback(m,j,t[x].Function)end end end end -- 清理匿名模组回调,预防代码污染
--0. 避免代码污染和模组不兼容问题，游戏胜利后自动清除代码效果。
--依赖代码* | 提供接口: CLM()删除匿名回调; Wrap()包装模组回调; Unwrap()取消包装。
l Wrap,Unwrap=Wrap or CLM,Unwrap or CLM Wrap()CLM()Isaac.AddCallback({},ModCallbacks.MC_POST_GAME_END,function(_,f)if not f then Unwrap()CLM()end end)

--1. 所有玩家永久蒙眼（在矿洞逃亡中不生效）。
l Isaac.AddCallback({},31,function(s,p,g,c,f)f,s,g=1,'Challenge',Game()c=g[s]if p:HasCurseMistEffect()then g[s],f=0 p:TryRemoveNullCostume(14)elseif p:CanShoot()then g[s],f=6 p:AddNullCostume(14)end if not f then p:UpdateCanShoot()end g[s]=c end)

--2. 玩家放置炸弹改为托举炸弹（被托举的炸弹与道具-胎儿博士-拥有相同的伤害与特效），同时不再消耗炸弹数量：
l local I,Z,F,P=Isaac,Vector.Zero,Isaac.AddCallback,'Position'F({},2,function()for i=0,Game():GetNumPlayers()-1 do local p,d,b=I.GetPlayer(i)d=p.ControllerIndex if Input.IsActionTriggered(8,d)and not p:IsHoldingItem()then if p:GetNumGigaBombs()>0 then b=I.Spawn(4,17,0,p[P],Z,p):ToBomb()p:AddGigaBombs(-1)else b=p:FireBomb(p[P],Z)end b.Flags=p:GetBombFlags()p:TryHoldEntity(b)end end end)F({},13,function(_,e,_,a)if e and e:ToPlayer()and a==8 then return false end end,1)

--3. 炸弹掉落物50%替换为超级炸弹，50%替换为大笑脸炸弹：
l local I,F=Isaac,Isaac.AddCallback F({},24,function(_,t,v,s,_,_,_,d)if t==5 and v==40 then if d&1==0 then s=7 else t,v,s=4,4,0 end end return{t,v,s,d}end)F({},34,function(_,e)if e.SubType~=7 then I.Spawn(5,40,0,e.Position,e.Velocity,e.SpawnerEntity)e:Remove()end end,40)
--.