--子弹时间
--推荐攻击方式：眼泪攻击


---- 代码效果(不用管中文，全选复制即可) ----

--0. 前置功能性代码：避免代码污染和重复输入问题;
--默认锁定游戏成就;
--游戏胜利后自动清除代码效果; 长按重开键10秒自动清空代码效果;
--提供接口: CLM()删除匿名回调。
l function CLM(t,m)for i,j in pairs(ModCallbacks)do t=Isaac.GetCallbacks(j)for x=#t,1,-1 do m=t[x].Mod if not(m and m.Name)then Isaac.RemoveCallback(m,j,t[x].Function)end end end end --[[ 清理匿名模组回调,预防代码污染 ]]CLM()local I,M,A,T,F=Isaac,ModCallbacks T=I.GetTime F=T()A=I.AddCallback A({},M.MC_POST_GAME_END,function(_,f)if not f then CLM()end end)A({},M.MC_POST_RENDER,function(p)p=T()for i=1,Game():GetNumPlayers()do if Input.IsActionPressed(ButtonAction.ACTION_RESTART,I.GetPlayer(i).ControllerIndex)then if p-F>=1e4 then CLM()end return end end F=p end) --[[ 自动清理回调 ]] Isaac.AddPriorityCallback({},ModCallbacks.MC_POST_GAME_STARTED,CallbackPriority.IMPORTANT,function(_,c)if not c then Isaac.ExecuteCommand('seed '..Seeds.Seed2String(Game():GetSeeds():GetNextSeed()))end end) --[[ 游戏锁定成就 ]]

--1. 强制给予玩家：道具48(丘比特之箭)、221(橡胶胶水)、282(跳跃教程)、饰品149(紧急按钮)
-- 主动道具数量不够时，强制锁门，房间内生成对应道具
-- 格式：c=道具,t/T=饰品(仅保证层数一致),物品={'类别',数量};数量为一时可简化为物品='类别'; 道具id必须>0
l ITEMS={'c48','c221','c282','t149'}local C,D,E,F,H,I,P,Q,L,M,T=CollectibleType,'OLLECTIBLE','GetPlayerType',PlayerType,'Get',Isaac,pairs,EntityType,'Remove',ModCallbacks,{}local A,B,G,J,K,N,O,S,U=I.AddCallback D,B='C'..D,'C'..D:lower()J=H..B K=J..'Num'O=L..B N=function(i,a,b)a,i=table.unpack(type(i)=='table'and i or{i,1})a,b=a:match('(%a)(%d+)')return i,a,tonumber(b)end G=function(_,a,b,p)for _,i in P(ITEMS)do i,a,b=N(i)if a=='c'then while 0<p[K](p,b)do p[O](p,b)end end end end A(T,M.MC_POST_PLAYER_UPDATE,function(a,p,b,c,e,g,h,j,k,l)if F.PLAYER_THESOUL_B~=p[E](p)and not p:HasCurseMistEffect()then c=I.GetItemConfig()e='Trinket'h='Add'for _,i in P(ITEMS)do i,a,b=N(i)if a=='T'then a='t'i=i*2 end if a=='c'then g=Game():GetItemPool()g[O](g,b)g=0 if not p:IsItemQueueEmpty()then g=p.QueuedItem.Item g=g and g['Is'..B](g)and b==g.ID and 1 or 0 end while i>g+p[K](p,b)do if c[J](c,b).Type==ItemType.ITEM_ACTIVE then S=b break else p[h..B](p,b)end end elseif a=='t'then g=H..e l=h..e while 1 do j=i-p[g..'Multiplier'](p,b)if j<=0 then break end k={}for s=0,1 do k[s]=p[g](p,s)p['Try'..L..e](p,k[s])p[l](p,b|((j>1 and s==0 or j>3)and TrinketType.TRINKET_GOLDEN_FLAG or 0))end p:UseActiveItem(C[D..'_SMELTER'],2315)for s=0,1 do p[l](p,k[s],false)end end end end end end)A(T,M.MC_POST_UPDATE,function(d,r,v,s)if S then r=Game():GetRoom()for _,i in P(DoorSlot)do d=r:GetDoor(i)if d then d:Close()end end d=Q.ENTITY_PICKUP v=PickupVariant.PICKUP_COLLECTIBLE s=I.FindByType if 1>#s(d,v,S)then U=U and U+1 or 1 if U>29 then I.Spawn(d,v,S,r:GetCenterPos(),Vector.Zero,nil)end else U=nil end for _,e in P(s(d,v,0))do e:Remove()end end S=nil end)A(T,M.MC_PRE_USE_ITEM,G,C[D..'_D4'])A(T,M.MC_ENTITY_TAKE_DMG,function(d,e,u,f)d=DamageFlag u='DAMAGE_'e=e:ToPlayer()if F.PLAYER_EDEN_B==e[E](e)and 0==f&(d[u..'RED_HEARTS']|d[u..'IV_BAG']|d[u..'FAKE']|d[u..'NO_PENALTIES'])then G(e,e,e,e)end end,Q.ENTITY_PLAYER)

--3. 实时监测游戏帧率，可使用指令：lua SetTimeScale(数值) 来设置游戏速率(默认1，最小0)。
-- GetTimeScale()可获取{[1]=当前渲染帧倍率,[2]=当前逻辑帧倍率}。
-- 由于监测数据和调控速率之间存在延迟，实际效果与预期效果会有一定偏差。
l local H,I,J,K,M,N,O,P,U,V,X,T,A,B,C,D,E,F,G,L,Q='GetFrameCount',Isaac,1,Game,ModCallbacks,math.max,1,1,1,1,true,{}A=I.AddCallback D=I.GetTime L=K().IsPaused B=I[H]C=K()[H]Q=X E=B()F=C(K())G=D()A(T,M.MC_POST_RENDER,function()local c,r,g,d=D(),B(),C(K())d=c-G G,E,O=c,r,50/d/3*(r-E)if r&1<1 then F,P=g,50/d/3*(g-F)end if J<1 and not L(K())then if J<O then U=U*1.2 elseif J>O then U=N(U/2,.5)end for i=1,U do I.GetRoomEntities()end end end)A(T,M.MC_POST_UPDATE,function()if Q and J>1 and not L(K())then if J>P then V=V*1.2 elseif J<P then V=N(V/2,.5)end Q=false for i=1,V do K():Update()end Q=X end end)function SetTimeScale(v)J=N(tonumber(v)or 1,0)end function GetTimeScale()return{O,P}end

--4. 游戏1.5倍速运行。
-- 可通过指令 lua TimeScale = 数值 来调整默认游戏速率(默认1.5倍)。
-- 紧急按钮触发主动道具时，将会进入子弹时间状态 5 秒。
-- 可通过指令 lua BulletTime = 数值 来调整子弹时间的持续时间(默认5秒)。
-- 依赖代码3.
l BulletTime=5;TimeScale=1.5;local A,B,C,I,M,T=Isaac.AddCallback,TimeScale,ButtonAction,Input.IsActionTriggered,ModCallbacks,{}A(T,M.MC_PRE_USE_ITEM,function(_,_,_,p)local x=p.ControllerIndex if not(I(C.ACTION_ITEM,x)or I(C.ACTION_PILLCARD,x))then B=.1 end end)A(T,M.MC_POST_UPDATE,function()local t=TimeScale SetTimeScale(B<t and B or t)if B<t then B=B+.03/BulletTime end end)

--5. 强制非精英敌人变为精英怪(仅包括10粉色变种，“0”和“1”可替换为非负整数表示权重)。
l local A,I,C={[0]=0,[1]=0,[2]=0,[3]=0,[4]=0,[5]=0,[6]=0,[7]=0,[8]=0,[9]=0,[10]=1,[11]=0,[12]=0,[13]=0,[14]=0,[15]=0,[16]=0,[17]=0,[18]=0,[19]=0,[20]=0,[21]=0,[22]=0,[23]=0,[24]=0,[25]=0},'InitSeed',{}for k,v in pairs(A)do for _=1,v do C[#C+1]=k end end Isaac.AddCallback({},ModCallbacks.MC_NPC_UPDATE,function(_,e)if e:IsVulnerableEnemy()and e:IsActiveEnemy(false)and not e:IsBoss()and not e:IsInvincible()and not e:IsChampion()then e:MakeChampion(e[I],C[e[I]%#C+1])end end)

--6. 角色受到惩罚伤害时,会清除所有投射物。
l local function Action(p,a,f,s,c)for k,v in pairs(Isaac.FindByType(EntityType.ENTITY_PROJECTILE))do v:Remove()end end;local D,E=DamageFlag,EntityType Isaac.AddCallback({},ModCallbacks.MC_ENTITY_TAKE_DMG,function(_,e,a,f,s,c)e=e:ToPlayer()if e:GetPlayerType()==PlayerType.PLAYER_JACOB_B and s.Type==E.ENTITY_DARK_ESAU or 0<f&(D.DAMAGE_RED_HEARTS|D.DAMAGE_IV_BAG|D.DAMAGE_FAKE|D.DAMAGE_NO_PENALTIES)then return end Action(e,a,f,s,c)end,E.ENTITY_PLAYER)

--7. 泪弹尺寸固定为1。投射物更加危险。
l local A,C,D,E,F,G,M,T=Isaac.AddCallback,ProjectileFlags,{'CHANGE_FLAGS_AFTER_TIMEOUT','C.CHANGE_VELOCITY_AFTER_TIMEOUT'},table,{},'InitSeed',ModCallbacks,{}for k,v in pairs(C)do E.insert(F,v)for i,j in pairs(D)do if k==j then E.remove(F,#F)end end end A(T,M.MC_POST_FIRE_TEAR,function(_,t)t.Scale=1 end)A(T,M.MC_POST_PROJECTILE_INIT,function(_,p)for i=1,2 do p:AddProjectileFlags(F[p[G]*i%#F+1])end end)

--8. 角色的下列属性不会超出限定的值（nil表示不做限制）：射击延迟(nil~0.1)；攻击力(100~nil)
l local A,M,V,T,E=Isaac.AddCallback,ModCallbacks,{['MoveSpeed']={min=nil,max=nil,F='SPEED'},['MaxFireDelay']={min=299,max=nil,F='FIREDELAY'},['Damage']={min=100,max=nil,F='DAMAGE'},['TearRange']={min=nil,max=nil,F='RANGE'},['ShotSpeed']={min=nil,max=nil,F='SHOTSPEED'},['Luck']={min=nil,max=nil,F='LUCK'},['SpriteScale']={min=nil,max=nil,F='SIZE'}},{}E=function(p,k,v)local l,r=v.min,v.max if l and l>p[k]then p[k]=l end if r and r<p[k]then p[k]=r end end A(T,M.MC_EVALUATE_CACHE,function(_,p,f)for k,v in pairs(V)do if f==CacheFlag['CACHE_'..v.F]then return E(p,k,v)end end end)A(T,M.MC_POST_PEFFECT_UPDATE,function(_,p)for k,v in pairs(V)do E(p,k,v)end end)

--9. 玩家的泪弹强制变为橡皮擦
l Isaac.AddCallback({},ModCallbacks.MC_POST_TEAR_UPDATE,function(v,t)v=TearVariant.ERASER if t.Variant~=v and t.SpawnerType==EntityType.ENTITY_PLAYER then t:ChangeVariant(v)end end)

--重开一局新游戏。
l Isaac.ExecuteCommand'restart'
--.
