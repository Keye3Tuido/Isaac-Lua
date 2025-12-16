--快刀游戏
--限定角色：堕化犹大
--输入下面的代码后，重新开始一局新游戏
--除非重新加载了模组，否则不要重复输入代码！

---- 代码效果(不用管中文，全选复制即可) ----

--* 前置功能性代码（重复输入不额外生效）
l if not(REPENTOGON or _CBH)then local D,E,F,I,J,O,P,Y,W,A,B,C,G,H,K,L,Q,R=require'debug',{},'Function',Isaac,'Callback',{},pairs,true,{}_CBH,A,B,C,G,K,Q,R=Y,D.getlocal,D.setlocal,D.sethook,I.GetCallbacks,'Run'..J,function(i)for _,m in P(G(i))do local o=m[F]if not W[o]then m[F]=O[o]or R(o)end end end,function(f)local function r(...)local s={pcall(f,...)}if s[1]then return table.unpack(s,2)end end O[f],W[r]=r,f return r end L=function(i)_,i=A(3,i)if not E[i]then E[i]=Y Q(i)end end for _,i in P(ModCallbacks)do E[i]=Y end function Wrap()if not H then for i,_ in P(E)do Q(i)end C(function(e)local a=D.getinfo(2,'f').func if a==I['AddPriority'..J]then _,a=A(2,4)L(2)if not W[a]then B(2,4,O[a]or R(a))end elseif a==I['Remove'..J]then _,a=A(2,3)L(2)if not W[a]then B(2,3,O[a]or a)end elseif a==I[K]or a==I[K..'WithParam']or a==G then L(1)end end,'c')H=Y end end function Unwrap()if H then C()for i,_ in P(E)do for _,m in P(G(i))do m[F]=W[m[F]]or m[F]end end O,W,H={},{}end end end -- 安全包装,预防模组兼容问题
l local A,I,M=ModCallbacks,Isaac,'Mod'function CLM(t,m)for i,j in pairs(A)do t=I.GetCallbacks(j)for x=#t,1,-1 do m=t[x][M]if not(m and m.Name)then I.RemoveCallback(m,j,t[x].Function)end end end end -- 清理匿名模组回调,预防代码污染
--0. 避免代码污染和模组不兼容问题，游戏胜利后自动清除代码效果。
--依赖代码* | 提供接口: CLM()删除匿名回调; Wrap()包装模组回调; Unwrap()取消包装。
l Wrap()CLM()Isaac.AddCallback({},ModCallbacks.MC_POST_GAME_END,function(_,f)if not f then Unwrap()CLM()end end)

--1. 所有玩家永久蒙眼（在矿洞逃亡中不生效）。
l Isaac.AddCallback({},31,function(s,p,g,c,f)f,s,g=1,'Challenge',Game()c=g[s]if p:HasCurseMistEffect()then g[s],f=0 p:TryRemoveNullCostume(14)elseif p:CanShoot()then g[s],f=6 p:AddNullCostume(14)end if not f then p:UpdateCanShoot()end g[s]=c end)

--2. 强制给予玩家道具251(新手牌组)、467(手指)、534(书包)。
l Isaac.AddCallback({},31,function(c,p,n)if 40~=p:GetPlayerType()and not p:HasCurseMistEffect()then for _,i in pairs({251,467,534})do c,n=table.unpack(type(i)=='table'and i or{i,1})while n>p:GetCollectibleNum(c)do p:AddCollectible(c,Isaac.GetItemConfig():GetCollectible(c).InitCharge)end Game():GetItemPool():RemoveCollectible(c)end end end)

--3. 初始给予玩家道具116(9伏特)、9*311(犹大的影子)、356(车载电池)、468(阴影)、619(长子权)。
l local I,G=Isaac,Game()I.AddCallback({},15,function(p,c,t,n)if not c then for _,i in pairs({116,{311,9},356,468,619})do for k=1,G:GetNumPlayers()do p,t,n=I.GetPlayer(k-1),table.unpack(type(i)=='table'and i or{i,1})while n>p:GetCollectibleNum(t)do p:AddCollectible(t,I.GetItemConfig():GetCollectible(t).InitCharge)end end G:GetItemPool():RemoveCollectible(t)end end end)

--4. 强制给予玩家饰品88(不!)。
l Isaac.AddCallback({},31,function(a,p,b)if 40~=p:GetPlayerType()and not p:HasCurseMistEffect()then b='Parent'a=p[b]p[b]=nil for _,i in pairs({88})do if not p:HasTrinket(i)then p:DropTrinket(p.Position+p.PositionOffset,true)p:AddTrinket(i)p:UseActiveItem(479,3339)end end p[b]=a end end)

--5. 强制角色为堕化犹大。
l Isaac.AddCallback({},ModCallbacks.MC_POST_PLAYER_UPDATE,function(_,p)local t=PlayerType.PLAYER_JUDAS_B if t~=p:GetPlayerType()then p:ChangePlayerType(t)end end)

--6. 每隔一段时间强制切换玩家的某个槽位物品为道具暗仪刺刀、其他槽位为道具计划C或卡牌自杀之王。可在控制台输入 lua Duration = 数值 来调整切换间隔，数值单位为逻辑帧，默认90逻辑帧(3秒)。
l Duration=90;local C,D,E,F,G,H,I,M,N,P,Q,S,T,A,U,V='GetFrameCount','ControlsCooldown','SetPocketActiveItem',0,0,math,Isaac,ModCallbacks,false,CollectibleType,Card.CARD_SUICIDE_KING,true,{}A,U,V=I.AddCallback,P.COLLECTIBLE_PLAN_C,P.COLLECTIBLE_DARK_ARTS A(T,M.MC_POST_PLAYER_UPDATE,function(_,p)local g,s,t=Game()if g[C](g)%Duration<1 then F=(F+H.random(1,5))%6 for i=0,3 do s,t=(i==F)and V or U,p:GetActiveItem(i)if s~=t or i>1 then p:RemoveCollectible(t,S,i,S)if i<2 then p:AddCollectible(s,I.GetItemConfig():GetCollectible(s).InitCharge,N,i)end end end for i=0,3 do if Q~=p:GetCard(i)then p:DropPocketItem(i,I.GetFreeNearPosition(p.Position+p.PositionOffset,9))end end G=(F>1)and F or G p[E](p,F>1 and V or U,2,N)p[E](p,U,3,N)for i=2,3 do p:SetCard(i,Q)end end end)A(T,M.MC_INPUT_ACTION,function(_,e,h,a)if e and e:ToPlayer()and a==ButtonAction.ACTION_DROP and G>0 then G=G-1 return S end end,InputHook.IS_ACTION_TRIGGERED)A(T,M.MC_POST_RENDER,function()local d,g,t,c,s=Duration,Game()t=(d-g[C](g)%d)/30 c,s=t*30/d,string.format('%.2fs',t)I.RenderText(s,(I.GetScreenWidth()-I.GetTextWidth(s))/2,I.GetScreenHeight()/16,1,c,c,1)end)A(T,M.MC_USE_ITEM,function(_,c,r,p)p[D]=H.max(p[D],180)end,U)A(T,M.MC_POST_PICKUP_INIT,function(_,e)if e.SubType==Q then e:Remove()end end,PickupVariant.PICKUP_TAROTCARD)
--.