--灵感

--1. 爆裂天火：每Burst(默认5)秒随机天降一颗爆裂火球。
l Burst=5;local I,P=Isaac,ProjectileFlags I.AddCallback({},ModCallbacks.MC_POST_UPDATE,function()if Game():GetFrameCount()%(30*Burst)<1 then local p=I.Spawn(EntityType.ENTITY_PROJECTILE,ProjectileVariant.PROJECTILE_FIRE,0,I.GetRandomPosition(),Vector.Zero,nil):ToProjectile()p:AddHeight(-30)p:AddProjectileFlags(P.EXPLODE|P.FIRE_WAVE|P.FIRE_WAVE_X|P.FIRE_SPAWN)p:AddEntityFlags(EntityFlag.FLAG_PERSISTENT)end end)

--2. 毒性光晕：屏幕内随机出现PoisonNum(默认5)个悬浮毒性光晕。
l PoisonNum=5;local E,F,I,P=EntityType.ENTITY_PROJECTILE,ProjectileFlags,Isaac,'ToProjectile'F=F.GODHEAD|F.CANT_HIT_PLAYER I.AddCallback({},ModCallbacks.MC_POST_UPDATE,function()local c,e=0 for k,v in pairs(I.FindByType(E))do e=v[P](v)if e:HasProjectileFlags(F)then c,e.FallingSpeed,e.FallingAccel=c+1,0,-.1 end end while c<PoisonNum do e=I.Spawn(E,0,0,I.GetRandomPosition(),Vector.Zero,nil)c,e=c+1,e[P](e)e:AddProjectileFlags(F)end end)

--3. 玩家在当前房间受到惩罚伤害的总次数人均达到Threshold(默认5次)后，打开当前房间所有门。
l Threshold=5;local A,D,E,M,N,T=Isaac.AddCallback,DamageFlag,EntityType,ModCallbacks,0,{}A(T,M.MC_POST_NEW_ROOM,function()N=0 end)A(T,M.MC_ENTITY_TAKE_DMG,function(_,e,a,f,s)e=e:ToPlayer()if e:GetPlayerType()==PlayerType.PLAYER_JACOB_B and s.Type==E.ENTITY_DARK_ESAU or 0<f&(D.DAMAGE_RED_HEARTS|D.DAMAGE_IV_BAG|D.DAMAGE_FAKE|D.DAMAGE_NO_PENALTIES)then return end N=N+1 end,E.ENTITY_PLAYER)A(T,M.MC_POST_UPDATE,function()if N>=Threshold*Game():GetNumPlayers()then for i=0,7 do local d=Game():GetRoom():GetDoor(i)if d then d:Open()end end end end)

--4. 移动键&攻击键&鼠标左键绑定重开键
-- 原版控制台存在BUG，运行此代码需要忏悔龙
l local A,C,H,I,B=ButtonAction,Isaac,InputHook,Input,{'LEFT','RIGHT','UP','DOWN'}C.AddCallback({},ModCallbacks.MC_INPUT_ACTION,function(_,e,h,a)if a==A.ACTION_RESTART then for i=1,Game():GetNumPlayers()do local x,t=C.GetPlayer(i-1).ControllerIndex for k,v in pairs(A)do for p,q in ipairs(B)do if k:match(q)then if h==H.IS_ACTION_PRESSED and(I.IsActionPressed(v,x)or I.IsMouseBtnPressed(Mouse.MOUSE_BUTTON_LEFT))or h==H.IS_ACTION_TRIGGERED and I.IsActionTriggered(v,x)then return true elseif h==H.GET_ACTION_VALUE then t=I.GetActionValue(v,x)if t>0 then return t end end end end end end end end)

--5. 迷失游魂死亡时，杀死角色。
l Isaac.AddCallback({},ModCallbacks.MC_FAMILIAR_UPDATE,function(_,f)if f.State==4 then f.Player:Die()end end,FamiliarVariant.LOST_SOUL)

--6. 冰雹雨：每隔Hail(默认0.1)秒，随机天降HailNum(默认3)个冰雹。
l Hail,HailNum=0.1,3;local I=Isaac I.AddCallback({},ModCallbacks.MC_POST_UPDATE,function()if Game():GetFrameCount()%(30*Hail)<1 then for i=1,HailNum do local p=I.Spawn(EntityType.ENTITY_TEAR,TearVariant.ICE,0,I.GetRandomPosition(),Vector.Zero,nil):ToTear()p.FallingAcceleration,p.Height,p.Scale=10,-1e3,.5+math.random()p:AddTearFlags(TearFlags.TEAR_ICE)end end end)

--7. 抵近攻击：敌人距离玩家超过Dist(默认3)格远时，受到的伤害按距离衰减。
l local Dist=3;local H,G,P,T=GetPtrHash,40,'Position',{}Isaac.AddCallback({},ModCallbacks.MC_ENTITY_TAKE_DMG,function(_,e,a,...)local h,p,q=H(e),Game():GetRandomPlayer(Vector.Zero,0)if not T[h]and e:IsEnemy()then q=(p[P]-e[P]):Length()-G*Dist if q>0 then T[h]=true e:TakeDamage(G*a/(G+q),...)T[h]=nil return false end end end)

--8. 胎儿博士的炸弹被替换为金色即爆炸弹，兼容特效、伤害和爆炸范围。
l local I,V,a,c=Isaac,BombVariant.BOMB_GOLDENTROLL,'ExplosionDamage','RadiusMultiplier'I.AddCallback({},ModCallbacks.MC_POST_BOMB_UPDATE,function(f,b,d,r)if b.IsFetus then f=b.Flags d=b[a]r=b[c]if b.Variant~=V then b:Remove()b=I.Spawn(b.Type,V,b.SubType,b.Position,b.Velocity,b.SpawnerEntity):ToBomb()b:AddTearFlags(f)b[a],b[c]=d,r end end end)

--9. 实体“我的影子”追随准星。
l local b,c,a=Isaac,GetPtrHash,'Position'b.AddCallback({},ModCallbacks.MC_FAMILIAR_UPDATE,function(_,f)for k,v in pairs(b.FindByType(1e3))do if(v.Variant==30 or v.Variant==153)and c(v.SpawnerEntity)==c(f.Player)then f:FollowPosition(v[a])f:AddVelocity(v[a]-f[a])end end end,131)

--10. 每进入一个新房间，移动键随机互换、攻击键随机互换、功能键随机互换。
l local A,B,C,D,E,F,Z=Input,Isaac,ModCallbacks,{},{},{'A','D','W','S','<','>','^','v','E','Space','Q','Ctrl'}Z=B.AddCallback for k=0,11 do D[k]=k end Z(E,C.MC_POST_NEW_ROOM,function(a)for i=0,8,4 do for j=i+3,i+1,-1 do a=math.random(i,j)D[j],D[a]=D[a],D[j]end end end)Z(E,C.MC_INPUT_ACTION,function(a,e,h,b)a,e=InputHook,e and e:ToPlayer()b=D[b]if e and b then if h==a.IS_ACTION_PRESSED then h=A.IsActionPressed elseif h==a.IS_ACTION_TRIGGERED then h=A.IsActionTriggered else h=A.GetActionValue end return h(b,e.ControllerIndex)end end)Z(E,C.MC_POST_RENDER,function(a,b,c,p)c=Vector p=c(B.GetScreenWidth()/3,.9*B.GetScreenHeight())a=function(z,y,x,...)B.RenderScaledText(z,y.X-x*B.GetTextWidth(z)/2,y.Y,x,x,...)end for k,v in ipairs{-180,0,-90,90}do b=8*c.FromAngle(v)a(F[D[k-1]+1],p+b,.8,0,1,0,1)a(F[D[k+3]+1],p+2*b,1,1,0,0,1)end p.X=2*p.X for k,v in pairs{Bomb=-12,Active=-4,Card=4,Drop=12}do a(k..': '..F[D[(v+12)//8+8]+1],p+c(0,v),.8,1,1,0,1)end end)

--11. 没捡到闪烁的硬币时，所有角色受伤一次，不忽略无敌帧。
l local A,B,C,E,F,G=Isaac.AddCallback,ModCallbacks,PickupVariant.PICKUP_COIN,GetPtrHash,{},{}A(G,B.MC_POST_PICKUP_UPDATE,function(h,p)h=E(p)if p.Timeout>=0 and not F[h]then F[h]=1 end end,C)A(G,B.MC_PRE_PICKUP_COLLISION,function(h,p,c)h=E(p)if c:ToPlayer()and F[h]then F[h]=2 end end,C)A(G,B.MC_PRE_PLAYER_COLLISION,function(h,p,c)h=E(c)if c:ToPickup()and F[h]then F[h]=3 end end)A(G,B.MC_POST_ENTITY_REMOVE,function(h,e)h=E(e)if 1==F[h]then for i=1,Game():GetNumPlayers()do Isaac.GetPlayer(i-1):TakeDamage(1,0,EntityRef(e),60)end end if F[h]then h,F[h]={}for k,v in pairs(F)do if v then h[k]=v end end F=h e:Remove()end end,EntityType.ENTITY_PICKUP)

--12. 角色每次发射眼泪时，原地生成一个可拾取的炸弹。
l Isaac.AddCallback({},ModCallbacks.MC_POST_FIRE_TEAR,function(_,t)Isaac.Spawn(EntityType.ENTITY_PICKUP,PickupVariant.PICKUP_THROWABLEBOMB,0,t.Position,Vector.Zero,nil)end)

--13. 游戏随机卡顿、删除角色眼泪、删除凋落物。
l local c,d,A,B,Z=Random,pairs,Isaac,EntityType Z=A.FindByType A.AddCallback({},ModCallbacks.MC_POST_UPDATE,function(a,b)a=c()%1e3 if a<8 then for _=1,1e5 do A.GetRoomEntities()end b={}for _,v in d{'HEART','COIN','KEY','BOMB','POOP','GRAB_BAG','PILL','LIL_BATTERY','TAROTCARD','TRINKET'}do a=Z(B.ENTITY_PICKUP,PickupVariant['PICKUP_'..v])table.move(a,1,#a,#b+1,b)end elseif a<24 then b=Z(B.ENTITY_TEAR)end for _,v in d(b or{})do if c()%100<20 then v:Remove()end end end)

--14. 敌人的碰撞箱大小和贴图大小随血量变化。
l Isaac.AddCallback({},ModCallbacks.MC_POST_NPC_RENDER,function(s,n,o,d,v,e,f)d=n:GetData()v='Visible'e='InitSeed'f=n[e]if n:IsVulnerableEnemy()and n:IsActiveEnemy(false)and not d[f]then s=(1.9*n.HitPoints/n.MaxHitPoints+.1)*Vector.One n.SpriteScale,n.SizeMulti=s,s n[v]=true d[f]=s n:Render(o)n[v],d[f]=false end end)

--.
