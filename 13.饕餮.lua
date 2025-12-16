--饕餮
--除非重新加载了模组，否则不要重复输入代码！

---- 代码效果(不用管中文，全选复制即可) ----

--* 前置功能性代码（重复输入不额外生效）
l if not(REPENTOGON or _CBH)then local D,E,F,I,J,O,P,Y,W,A,B,C,G,H,K,L,Q,R=require'debug',{},'Function',Isaac,'Callback',{},pairs,true,{}_CBH,A,B,C,G,K,Q,R=Y,D.getlocal,D.setlocal,D.sethook,I.GetCallbacks,'Run'..J,function(i)for _,m in P(G(i))do local o=m[F]if not W[o]then m[F]=O[o]or R(o)end end end,function(f)local function r(...)local s={pcall(f,...)}if s[1]then return table.unpack(s,2)end end O[f],W[r]=r,f return r end L=function(i)_,i=A(3,i)if not E[i]then E[i]=Y Q(i)end end for _,i in P(ModCallbacks)do E[i]=Y end function Wrap()if not H then for i,_ in P(E)do Q(i)end C(function(e)local a=D.getinfo(2,'f').func if a==I['AddPriority'..J]then _,a=A(2,4)L(2)if not W[a]then B(2,4,O[a]or R(a))end elseif a==I['Remove'..J]then _,a=A(2,3)L(2)if not W[a]then B(2,3,O[a]or a)end elseif a==I[K]or a==I[K..'WithParam']or a==G then L(1)end end,'c')H=Y end end function Unwrap()if H then C()for i,_ in P(E)do for _,m in P(G(i))do m[F]=W[m[F]]or m[F]end end O,W,H={},{}end end end -- 安全包装,预防模组兼容问题
l local A,I,M=ModCallbacks,Isaac,'Mod'function CLM(t,m)for i,j in pairs(A)do t=I.GetCallbacks(j)for x=#t,1,-1 do m=t[x][M]if not(m and m.Name)then I.RemoveCallback(m,j,t[x].Function)end end end end -- 清理匿名模组回调,预防代码污染
--0. 避免代码污染和模组不兼容问题，游戏胜利后自动清除代码效果。
--依赖代码* | 提供接口: CLM()删除匿名回调; Wrap()包装模组回调; Unwrap()取消包装。
l Wrap()CLM()Isaac.AddCallback({},ModCallbacks.MC_POST_GAME_END,function(_,f)if not f then Unwrap()CLM()end end)

--1. 玩家拾取非任务道具时，自动触发道具477-虚空效果；玩家拾取饰品时，自动触发道具479-熔炉效果。
l Isaac.AddCallback({},31,function(i,p,u,f)i,f,u=p.QueuedItem.Item,3339,'UseActiveItem'if 0~=p:GetTrinket(0)then p[u](p,479,f)end if(not p:IsItemQueueEmpty())then if(i:IsCollectible()and not i:HasTags(1<<15))then p[u](p,477,f)elseif(i:IsTrinket())then p[u](p,479,f)end end end)

--2. 掉落物受玩家吸引。
l local P,O='Position','PositionOffset'Isaac.AddCallback({},35,function(v,e,p)p=Game():GetNearestPlayer(e[P]+e[O])v=p[P]+p[O]-e[P]-e[O]e.GridCollisionClass=0 e:AddVelocity(10<v:Length()and v:Normalized()or Vector.Zero)end)

--3. 玩家会自动使用副手的卡牌、符文、药丸等消耗品
l Isaac.AddCallback({},31,function(_,p,t,u)for i=0,1 do t,u=p:GetPill(i),p:GetCard(i)if t~=0 then p:UsePill(Game():GetItemPool():GetPillEffect(t,p),t)p:SetPill(i,0)elseif u~=0 then p:UseCard(u)p:SetCard(i,0)end end end)

--4. 强制给予玩家饰品140(所多玛之果)。
l Isaac.AddCallback({},31,function(a,p,b)if 40~=p:GetPlayerType()and not p:HasCurseMistEffect()then b='Parent'a=p[b]p[b]=nil for _,i in pairs({140})do if not p:HasTrinket(i)then p:DropTrinket(p.Position+p.PositionOffset,true)p:AddTrinket(i)p:UseActiveItem(479,3339)end end p[b]=a end end)
--.