--快刀游戏
--限定角色：堕化犹大
--输入下面的代码后，重新开始一局新游戏


---- 代码效果(不用管中文，全选复制即可) ----

--0. 前置功能性代码：避免代码污染、重复输入和模组不兼容问题;
--游戏胜利后自动清除代码效果; 长按重开键10秒自动清空代码效果;
--挑战若卡顿可按下"-"键关闭兼容模式；按下"="键可重新开启兼容模式（可能卡顿）、兼容模式下代码和模组的兼容会更稳定；
--提供接口: CLM()删除匿名回调; Wrap()包装模组回调; Unwrap()取消包装。
l if not(REPENTOGON or _CBH)then local D,E,F,I,J,O,P,Y,W,A,B,C,G,H,K,L,Q,R=require'debug',{},'Function',Isaac,'Callback',{},pairs,true,{}_CBH,A,B,C,G,K,Q,R=Y,D.getlocal,D.setlocal,D.sethook,I.GetCallbacks,'Run'..J,function(i)for _,m in P(G(i))do local o=m[F]if not W[o]then m[F]=O[o]or R(o)end end end,function(f)local function r(...)local s={pcall(f,...)}if s[1]then return table.unpack(s,2)end end O[f],W[r]=r,f return r end L=function(i)_,i=A(3,i)if not E[i]then E[i]=Y Q(i)end end for _,i in P(ModCallbacks)do E[i]=Y end function Wrap()if not H then for i,_ in P(E)do Q(i)end C(function()local a=D.getinfo(2,'f').func if a==I['AddPriority'..J]then _,a=A(2,4)L(2)if not W[a]then B(2,4,O[a]or R(a))end elseif a==I['Remove'..J]then _,a=A(2,3)L(2)if not W[a]then B(2,3,O[a]or a)end elseif a==I[K]or a==I[K..'WithParam']or a==G then L(1)end end,'c')H=Y end end function Unwrap()if H then C()for i,_ in P(E)do for _,m in P(G(i))do m[F]=W[m[F]]or m[F]end end O,W,H={},{}end end end -- 安全包装,预防模组兼容问题
l local A,I=ModCallbacks,Isaac;function CLM(t,m)for i,j in pairs(A)do t=I.GetCallbacks(j)for x=#t,1,-1 do m=t[x].Mod if not(m and m.Name)then I.RemoveCallback(m,j,t[x].Function)end end end end -- 清理匿名模组回调,预防代码污染
l Wrap,Unwrap=Wrap or CLM,Unwrap or CLM Wrap()CLM()local E,I,K,M,N,A,B,T,F=error,Isaac,Keyboard,ModCallbacks,Input B=N.IsButtonTriggered T=I.GetTime F=T()A=I.AddCallback A({},M.MC_POST_GAME_END,function(_,f)if not f then Unwrap()CLM()end end)A({},M.MC_POST_RENDER,function(p,q)p=T()for i=1,Game():GetNumPlayers()do q=I.GetPlayer(i).ControllerIndex if B(K.KEY_MINUS,q)then Unwrap()E('CBWrapper Disabled',0)elseif B(K.KEY_EQUAL,q)then Wrap()E('CBWrapper Enabled',0)end if N.IsActionPressed(ButtonAction.ACTION_RESTART,q)then if p-F>=1e4 then Unwrap()CLM()end return end end F=p end) -- 对外提供接口、自动清理回调、按键包装回调

--1. 所有玩家永久蒙眼（在矿洞逃亡中不生效）。
l Isaac.AddCallback({},31,function(s,p,g,c,f)f,s,g=1,'Challenge',Game()c=g[s]if p:HasCurseMistEffect()then g[s],f=0 p:TryRemoveNullCostume(14)elseif p:CanShoot()then g[s],f=6 p:AddNullCostume(14)end if not f then p:UpdateCanShoot()end g[s]=c end)

--2. 强制给予：道具251(新手牌组)、467(手指)、534(书包)、饰品88(不!)
-- 格式：c=道具,t/T=饰品(仅保证层数一致),单物品={类别,1}
l ITEMS={'c251','c467','c534','t88'}local C,D,E,F,H,I,L,M,T=CollectibleType,'OLLECTIBLE','GetPlayerType',PlayerType,'Get',Isaac,'Remove',ModCallbacks,{}local A,B,G,J,K,N,O=I.AddCallback D,B='C'..D,'C'..D:lower()J=H..B K=J..'Num'O=L..B N=function(i,a,b)a,i=table.unpack(type(i)=='table'and i or{i,1})a,b=a:match('(%a)(%d+)')return i,a,tonumber(b)end G=function(_,a,b,p)for _,i in pairs(ITEMS)do i,a,b=N(i)if a=='c'then while 0<p[K](p,b)do p[O](p,b)end end end end A(T,M.MC_POST_PLAYER_UPDATE,function(a,p,b,c,e,g,h,j,k,l)if F.PLAYER_THESOUL_B~=p[E](p)and not p:HasCurseMistEffect()then c=I.GetItemConfig()e='Trinket'h='Add'for _,i in pairs(ITEMS)do i,a,b=N(i)if a=='T'then a='t'i=i*2 end if a=='c'then g=Game():GetItemPool()g[O](g,b)while i>p[K](p,b)do p[h..B](p,b,c[J](c,b).InitCharge)end elseif a=='t'then g=H..e l=h..e while 1 do j=i-p[g..'Multiplier'](p,b)if j<=0 then break end k={}for s=0,1 do k[s]=p[g](p,s)p['Try'..L..e](p,k[s])p[l](p,b|((j>1 and s==0 or j>3)and TrinketType.TRINKET_GOLDEN_FLAG or 0))end p:UseActiveItem(C[D..'_SMELTER'],2315)for s=0,1 do p[l](p,k[s],false)end end end end end end)A(T,M.MC_PRE_USE_ITEM,G,C[D..'_D4'])A(T,M.MC_ENTITY_TAKE_DMG,function(d,e,u,f)d=DamageFlag u='DAMAGE_'e=e:ToPlayer()if F.PLAYER_EDEN_B==e[E](e)and 0==f&(d[u..'RED_HEARTS']|d[u..'IV_BAG']|d[u..'FAKE']|d[u..'NO_PENALTIES'])then G(e,e,e,e)end end,EntityType.ENTITY_PLAYER)

--3. 初始给予玩家道具116(9伏特)、9*311(犹大的影子)、356(车载电池)、468(阴影)、619(长子权)。
l local I,G=Isaac,Game()I.AddCallback({},15,function(p,c,t,n)if not c then for _,i in pairs({116,{311,9},356,468,619})do for k=1,G:GetNumPlayers()do p,t,n=I.GetPlayer(k-1),table.unpack(type(i)=='table'and i or{i,1})while n>p:GetCollectibleNum(t)do p:AddCollectible(t,I.GetItemConfig():GetCollectible(t).InitCharge)end end G:GetItemPool():RemoveCollectible(t)end end end)

--4. 强制角色为堕化犹大。
l Isaac.AddCallback({},ModCallbacks.MC_POST_PLAYER_UPDATE,function(_,p)local t=PlayerType.PLAYER_JUDAS_B if t~=p:GetPlayerType()then p:ChangePlayerType(t)end end)

--5. 每隔一段时间强制切换玩家的某个槽位物品为道具暗仪刺刀、其他槽位为道具计划C或卡牌自杀之王。可在控制台输入 lua Duration = 数值 来调整切换间隔，数值单位为逻辑帧，默认90逻辑帧(3秒)。
l Duration=90;local C,D,E,F,G,H,I,M,N,P,Q,S,T,A,U,V='GetFrameCount','ControlsCooldown','SetPocketActiveItem',0,0,math,Isaac,ModCallbacks,false,CollectibleType,Card.CARD_SUICIDE_KING,true,{}A,U,V=I.AddCallback,P.COLLECTIBLE_PLAN_C,P.COLLECTIBLE_DARK_ARTS A(T,M.MC_POST_PLAYER_UPDATE,function(_,p)local g,s,t=Game()if g[C](g)%Duration<1 then F=(F+H.random(1,5))%6 for i=0,3 do s,t=(i==F)and V or U,p:GetActiveItem(i)if s~=t or i>1 then p:RemoveCollectible(t,S,i,S)if i<2 then p:AddCollectible(s,I.GetItemConfig():GetCollectible(s).InitCharge,N,i)end end end for i=0,3 do if Q~=p:GetCard(i)then p:DropPocketItem(i,I.GetFreeNearPosition(p.Position,9))end end G=(F>1)and F or G p[E](p,F>1 and V or U,2,N)p[E](p,U,3,N)for i=2,3 do p:SetCard(i,Q)end end end)A(T,M.MC_INPUT_ACTION,function(_,e,h,a)if e and e:ToPlayer()and a==ButtonAction.ACTION_DROP and G>0 then G=G-1 return S end end,InputHook.IS_ACTION_TRIGGERED)A(T,M.MC_POST_RENDER,function()local d,g,t,c,s=Duration,Game()t=(d-g[C](g)%d)/30 c,s=t*30/d,string.format('%.2fs',t)I.RenderText(s,(I.GetScreenWidth()-I.GetTextWidth(s))/2,I.GetScreenHeight()/16,1,c,c,1)end)A(T,M.MC_USE_ITEM,function(_,c,r,p)p[D]=H.max(p[D],180)end,U)A(T,M.MC_POST_PICKUP_INIT,function(_,e)if e.SubType==Q then e:Remove()end end,PickupVariant.PICKUP_TAROTCARD)
--.