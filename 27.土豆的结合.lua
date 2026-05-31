--土豆的结合（原：合成肉鸽）
--禁用角色：堕化以撒，雅各&以扫，堕化遗骸，堕化拉撒路，莉莉丝，堕化莉莉丝，堕化夏娃，堕化伯大尼，堕化参孙，堕化该隐
--输入下面的代码后，重新开始一局新游戏

-- 玩法简介：
-- 拾取道具时，若按住MAP键，则将道具给予自己
-- 否则，道具将给予被绿色十字标记的炮台
-- 按DROP键可以切换绿色十字标记
-- 每个炮台的属性独立计算

---- 代码效果(不用管中文，全选复制即可) ----

--* 前置功能性代码（重复输入不额外生效）
l if not(REPENTOGON or _CBH)then local D,E,F,I,J,O,P,Y,W,A,B,C,G,H,K,L,Q,R=require'debug',{},'Function',Isaac,'Callback',{},pairs,true,{}_CBH,A,B,C,G,K,Q,R=Y,D.getlocal,D.setlocal,D.sethook,I.GetCallbacks,'Run'..J,function(i)for _,m in P(G(i))do local o=m[F]if not W[o]then m[F]=O[o]or R(o)end end end,function(f)local function r(...)local s={pcall(f,...)}if s[1]then return table.unpack(s,2)end end O[f],W[r]=r,f return r end L=function(i)_,i=A(3,i)if not E[i]then E[i]=Y Q(i)end end for _,i in P(ModCallbacks)do E[i]=Y end function Wrap()if not H then for i,_ in P(E)do Q(i)end C(function(e)local a=D.getinfo(2,'f').func if a==I['AddPriority'..J]then _,a=A(2,4)L(2)if not W[a]then B(2,4,O[a]or R(a))end elseif a==I['Remove'..J]then _,a=A(2,3)L(2)if not W[a]then B(2,3,O[a]or a)end elseif a==I[K]or a==I[K..'WithParam']or a==G then L(1)end end,'c')H=Y end end function Unwrap()if H then C()for i,_ in P(E)do for _,m in P(G(i))do m[F]=W[m[F]]or m[F]end end O,W,H={},{}end end end -- 安全包装,预防模组兼容问题
l local A,I=ModCallbacks,Isaac;function CLM(t,m)for i,j in pairs(A)do t=I.GetCallbacks(j)for x=#t,1,-1 do m=t[x].Mod if not(m and m.Name)then I.RemoveCallback(m,j,t[x].Function)end end end end -- 清理匿名模组回调,预防代码污染
--0. 避免代码污染、重复输入和模组不兼容问题;
--游戏胜利后自动清除代码效果; 长按重开键10秒自动清空代码效果;
--依赖代码* | 提供接口: CLM()删除匿名回调; Wrap()包装模组回调; Unwrap()取消包装。
l Wrap,Unwrap=Wrap or CLM,Unwrap or CLM Wrap()CLM()local I,M,A,T,F=Isaac,ModCallbacks T=I.GetFrameCount F=T()A=I.AddCallback A({},M.MC_POST_GAME_END,function(_,f)if not f then Unwrap()CLM()end end)A({},M.MC_POST_RENDER,function(p)p=T()for i=1,Game():GetNumPlayers()do if Input.IsActionPressed(ButtonAction.ACTION_RESTART,I.GetPlayer(i).ControllerIndex)then if p-F>599 then Unwrap()CLM()end return end end F=p end)

--1. 所有玩家永久蒙眼（在矿洞逃亡中不生效）。
l Isaac.AddCallback({},31,function(s,p,g,c,f)f,s,g=1,'Challenge',Game()c=g[s]if p:HasCurseMistEffect()then g[s],f=0 p:TryRemoveNullCostume(14)elseif p:CanShoot()then g[s],f=6 p:AddNullCostume(14)end if not f then p:UpdateCanShoot()end g[s]=c end)

--2. 生成6个与玩家类型相同、跟随玩家的炮台；
-- 玩家拾取的道具，会给予被十字标记的炮台，道具栏右侧会显示标记炮台的物品栏
-- 按住MAP键时，道具会给予玩家自身
-- 按下DROP键可切换当前标记的炮台
-- 玩家的每个炮台攻击倍率为玩家原本属性的1/30
-- 玩家自身的攻击倍率为原本属性的2/45
l local F,I,J,K,L,G,H,D,M,O,S,T,U,V,W,X,Z,E,Q,R,C,B,A,P,N,Y=1,Isaac,Game,true,false,function(p)return tostring(p:GetCollectibleRNG(1):GetSeed())end,'MAP',FamiliarVariant,ModCallbacks,CacheFlag.CACHE_DAMAGE,{},{},'GetPlayerType','Parent','Position','Player',Vector,'Visible','INCUBUS','KING_BABY','Collectible',Sprite()A,P,N=I.AddCallback,I.GetPlayer,function(b,x)return Input['IsAction'..(x and'Triggered'or'Pressed')](ButtonAction['ACTION_'..b],P().ControllerIndex)end;B:Load('gfx/1000.185_redemption.anm2',K)B.Color=Color(0,1,0,1)B:Play('Idle',K)A(T,M.MC_POST_GAME_STARTED,function(_,c)F=1 if not c then S={}end end)A(T,M.MC_POST_UPDATE,function(m,d,i,p,h,u)B:Update()if Y then J():GetHUD():AssignPlayerHUDs()end m,Y=P()d,i=0,1 while d<6 do p=P(i)h=G(p)if h==G(m)then I.ExecuteCommand('addplayer '..m[U](m))p=P(i)Y,h=K,G(p)end u=p[U](p)if u<PlayerType.NUM_PLAYER_TYPES then d=d+1 S[h]={n=d,p=p,x=50*Z.FromAngle(60*d)}S[i]=S[h]if Y then p:AddCacheFlags(O)p:EvaluateItems()end end i=i+1 end end)A(T,M.MC_POST_PLAYER_UPDATE,function(u,p,m,o,y,z,b,t,a)m=P()a='Add'u,o,b,z=G(p),_G[C..'Type'],a..C,'COLLECTIBLE_'y=S[u]if y or u==G(m)then if not p:HasCurseMistEffect()then for k,v in pairs{[L]=o[z..Q],[K]=o[z..R]}do if not p['Has'..C](p,v)and(y or k)then p[b](p,v)end end end o='Remove'..C if y then if y.n==F then p[V]=nil p[b](p,7)p[o](p,7)end y.p,p.SpriteScale,p[E],p[V],p[W],o=p,Z.Zero,L,m,m[W],'BrokenHearts'z=a..o p:SetMinDamageCooldown(1)p[z](p,1e3)p[z](p,-p['Get'..o](p))p:AddMaxHearts(2)p:AddHearts(2)p:Revive()z=m[U](m)if z~=p[U](p)then p:ChangePlayerType(z)end elseif not p:IsItemQueueEmpty()then z=p.QueuedItem y=z.Item if y.Type~=ItemType.ITEM_ACTIVE and y['Is'..C](y)and not y:HasTags(ItemConfig.TAG_QUEST)then t,m,y=p.FlushQueueItem,y.ID,S[F].p if N(H)then t(p)else y[b](y,m,0,not z.Touched)t(p)p[o](p,m)end end end end end)A(T,M.MC_INPUT_ACTION,function(x,e,h,a)e=e and e:ToPlayer()x=e and G(e)if e and(S[x]or x==G(P()))then if h==InputHook.GET_ACTION_VALUE then e,h=1,0 else e,h=K,L end if a//4==1 then for _,v in pairs{'LEFT','RIGHT','UP','DOWN'}do if N('SHOOT'..v)then return a==4+J():GetFrameCount()%4 and e or h end end elseif not S[x]then return end return h end end)A(T,M.MC_FAMILIAR_UPDATE,function(p,f,v,s)v,p,s=f.Variant,P()[W],S[G(f[X])]if v==D[R]then f[E],f[W]=L,p elseif s then if v==D[Q]then f:AddVelocity(s.x+p-f[W])else f:FollowPosition(2*s.x+p)end end end)A(T,M.MC_POST_FAMILIAR_RENDER,function(s,f,o,p)p,s=N(H),S[G(f[X])]if s then f[E],o=not p,o+I.WorldToRenderPosition(p and P()[W]or f[W])if s.n==F then B:Render(o+Z(0,p and 10 or 20))end end end,D[Q])A(T,M.MC_POST_RENDER,function()if N('DROP',K)and not N(H)and not J():IsPaused()then F=F%6+1 end end)A(T,M.MC_EVALUATE_CACHE,function(d,p)d=G(p)if d==G(P())or S[d]then d='Damage'p[d]=p[d]/22.5 end end,O)

--3. 从游戏中移除道具122(巴比伦大淫妇)、482(遥控器)、704(狂怒)
l local I,C,Y,T,A=Isaac,{122,482,704},true,{}A=I.AddCallback A(T,23,function(_,c)for _,v in pairs(C)do if c==v then return Y end end end)A(T,31,function(_,p)for _,i in pairs(C)do for _=1,p:GetCollectibleNum(i)do p:RemoveCollectible(i)end end end)A(T,37,function(p,f,v,s)if v==100 then repeat p,f=Game():GetItemPool()for _,i in pairs(C)do if i==s then f,s=1,p:GetCollectible(p:GetLastPool(),Y)break end end until not f return{v,s}end end)

--4. 初始给予玩家道具376(补货)、402(混沌)、416(深口袋)、602(会员卡)。
l local I,G=Isaac,Game()I.AddCallback({},15,function(p,c,t,n)if not c then for _,i in pairs({376,402,416,602})do for k=1,G:GetNumPlayers()do p,t,n=I.GetPlayer(k-1),table.unpack(type(i)=='table'and i or{i,1})while n>p:GetCollectibleNum(t)do p:AddCollectible(t,I.GetItemConfig():GetCollectible(t).InitCharge)end end G:GetItemPool():RemoveCollectible(t)end end end)

--5. 清理房间时生成硬币
l local I=Isaac I.AddCallback({},ModCallbacks.MC_PRE_SPAWN_CLEAN_AWARD,function(_,_,p)for _=1,2 do I.Spawn(EntityType.ENTITY_PICKUP,PickupVariant.PICKUP_COIN,0,I.GetFreeNearPosition(p,0),Vector.Zero,I.GetPlayer())end end)

--6. 角色吸引硬币
l Isaac.AddCallback({},ModCallbacks.MC_POST_PICKUP_UPDATE,function(_,p)local e,l=Game():GetNearestPlayer(p.Position+p.PositionOffset)l=e.Position+e.PositionOffset-p.Position-p.PositionOffset p.Velocity=3*(l:Length()>10 and math.log(l:Length())or 0)*l:Normalized()p.GridCollisionClass=EntityGridCollisionClass.GRIDCOLL_NONE end,PickupVariant.PICKUP_COIN)

--7. 黏币变为镍币
l Isaac.AddCallback({},ModCallbacks.MC_POST_PICKUP_INIT,function(_,p)if p.SubType==CoinSubType.COIN_STICKYNICKEL then p:Morph(p.Type,p.Variant,CoinSubType.COIN_NICKEL,true)end end,PickupVariant.PICKUP_COIN)

--8. 抽取道具时不再抽取淫魔和作孽双子
l Isaac.AddCallback({},ModCallbacks.MC_PRE_GET_COLLECTIBLE,function()for _,c in pairs{360,698}do Game():GetItemPool():AddRoomBlacklist(c)end end)
--.