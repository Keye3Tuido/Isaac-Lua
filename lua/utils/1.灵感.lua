--灵感

--[[
作为模板: true
模板id: burst-fireball
说明: 爆裂天火：每Burst(默认{P1})秒随机天降一颗爆裂火球。
参数定义:
  P1: {类型: 数值, 默认: 5, 性质: 全局, 说明: "全局变量Burst，天降爆裂火球的间隔秒数（默认5）"}
]]
l Burst=P1;local I,P=Isaac,ProjectileFlags I.AddCallback({},ModCallbacks.MC_POST_UPDATE,function()if Game():GetFrameCount()%(30*Burst)<1 then local p=I.Spawn(EntityType.ENTITY_PROJECTILE,ProjectileVariant.PROJECTILE_FIRE,0,I.GetRandomPosition(),Vector.Zero,nil):ToProjectile()p:AddHeight(-30)p:AddProjectileFlags(P.EXPLODE|P.FIRE_WAVE|P.FIRE_WAVE_X|P.FIRE_SPAWN)p:AddEntityFlags(EntityFlag.FLAG_PERSISTENT)end end)

--[[
作为模板: true
模板id: poison-aura
说明: 毒性光晕：屏幕内随机出现PoisonNum(默认{P1})个悬浮毒性光晕。
参数定义:
  P1: {类型: 数值, 默认: 5, 性质: 全局, 说明: "全局变量PoisonNum，悬浮毒性光晕的数量（默认5）"}
]]
l PoisonNum=P1;local E,F,I,P=EntityType.ENTITY_PROJECTILE,ProjectileFlags,Isaac,'ToProjectile'F=F.GODHEAD|F.CANT_HIT_PLAYER I.AddCallback({},ModCallbacks.MC_POST_UPDATE,function()local c,e=0 for k,v in pairs(I.FindByType(E))do e=v[P](v)if e:HasProjectileFlags(F)then c,e.FallingSpeed,e.FallingAccel=c+1,0,-.1 end end while c<PoisonNum do e=I.Spawn(E,0,0,I.GetRandomPosition(),Vector.Zero,nil)c,e=c+1,e[P](e)e:AddProjectileFlags(F)end end)

--[[
作为模板: true
模板id: punish-damage-open-doors
说明: 玩家在当前房间受到惩罚伤害的总次数人均达到Threshold(默认{P1}次)后，打开当前房间所有门。
参数定义:
  P1: {类型: 数值, 默认: 5, 性质: 全局, 说明: "全局变量Threshold，人均惩罚伤害次数阈值（默认5次）"}
]]
l Threshold=P1;local A,D,E,M,N,T=Isaac.AddCallback,DamageFlag,EntityType,ModCallbacks,0,{}A(T,M.MC_POST_NEW_ROOM,function()N=0 end)A(T,M.MC_ENTITY_TAKE_DMG,function(_,e,a,f,s)e=e:ToPlayer()if e:GetPlayerType()==PlayerType.PLAYER_JACOB_B and s.Type==E.ENTITY_DARK_ESAU or 0<f&(D.DAMAGE_RED_HEARTS|D.DAMAGE_IV_BAG|D.DAMAGE_FAKE|D.DAMAGE_NO_PENALTIES)then return end N=N+1 end,E.ENTITY_PLAYER)A(T,M.MC_POST_UPDATE,function()if N>=Threshold*Game():GetNumPlayers()then for i=0,7 do local d=Game():GetRoom():GetDoor(i)if d then d:Open()end end end end)

--[[
作为模板: true
模板id: restart-key-bind
说明: |-
  移动键&攻击键&鼠标左键绑定重开键
  原版控制台存在BUG，运行此代码需要忏悔龙
]]
l local A,C,H,I,B=ButtonAction,Isaac,InputHook,Input,{'LEFT','RIGHT','UP','DOWN'}C.AddCallback({},ModCallbacks.MC_INPUT_ACTION,function(_,e,h,a)if a==A.ACTION_RESTART then for i=1,Game():GetNumPlayers()do local x,t=C.GetPlayer(i-1).ControllerIndex for k,v in pairs(A)do for p,q in ipairs(B)do if k:match(q)then if h==H.IS_ACTION_PRESSED and(I.IsActionPressed(v,x)or I.IsMouseBtnPressed(Mouse.MOUSE_BUTTON_LEFT))or h==H.IS_ACTION_TRIGGERED and I.IsActionTriggered(v,x)then return true elseif h==H.GET_ACTION_VALUE then t=I.GetActionValue(v,x)if t>0 then return t end end end end end end end end)

--[[
作为模板: true
模板id: lost-soul-death-kill
说明: 迷失游魂死亡时，杀死角色。
]]
l Isaac.AddCallback({},ModCallbacks.MC_FAMILIAR_UPDATE,function(_,f)if f.State==4 then f.Player:Die()end end,FamiliarVariant.LOST_SOUL)

--[[
作为模板: true
模板id: hail-rain
说明: 冰雹雨：每隔Hail(默认{P1})秒，随机天降HailNum(默认{P2})个冰雹。
参数定义:
  P1: {类型: 数值, 默认: 0.1, 性质: 全局, 说明: "全局变量Hail，冰雹降落间隔秒数（默认0.1）"}
  P2: {类型: 数值, 默认: 3, 性质: 全局, 说明: "全局变量HailNum，每次天降冰雹的数量（默认3）"}
]]
l Hail,HailNum=P1,P2;local I=Isaac I.AddCallback({},ModCallbacks.MC_POST_UPDATE,function()if Game():GetFrameCount()%(30*Hail)<1 then for i=1,HailNum do local p=I.Spawn(EntityType.ENTITY_TEAR,TearVariant.ICE,0,I.GetRandomPosition(),Vector.Zero,nil):ToTear()p.FallingAcceleration,p.Height,p.Scale=10,-1e3,.5+math.random()p:AddTearFlags(TearFlags.TEAR_ICE)end end end)

--[[
作为模板: true
模板id: distance-damage-falloff
说明: 抵近攻击：敌人距离玩家超过Dist(默认{P1})格远时，受到的伤害按距离衰减。
参数定义:
  P1: {类型: 数值, 默认: 3, 性质: 局部, 说明: "局部变量Dist，伤害开始衰减的距离格数（默认3）"}
]]
l local Dist=P1;local H,G,P,T=GetPtrHash,40,'Position',{}Isaac.AddCallback({},ModCallbacks.MC_ENTITY_TAKE_DMG,function(_,e,a,...)local h,p,q=H(e),Game():GetRandomPlayer(Vector.Zero,0)if not T[h]and e:IsEnemy()then q=(p[P]-e[P]):Length()-G*Dist if q>0 then T[h]=true e:TakeDamage(G*a/(G+q),...)T[h]=nil return false end end end)

--[[
作为模板: true
模板id: dr-fetus-golden-bomb
说明: |-
  胎儿博士的炸弹被替换为金色即爆炸弹，兼容特效、伤害和爆炸范围。
  灵感来源:bilibili@妖狐みれい,uid:3493076226017574
]]
l local I,V,a,c=Isaac,BombVariant.BOMB_GOLDENTROLL,'ExplosionDamage','RadiusMultiplier'I.AddCallback({},ModCallbacks.MC_POST_BOMB_UPDATE,function(f,b,d,r)if b.IsFetus then f=b.Flags d=b[a]r=b[c]if b.Variant~=V then b:Remove()b=I.Spawn(b.Type,V,b.SubType,b.Position,b.Velocity,b.SpawnerEntity):ToBomb()b:AddTearFlags(f)b[a],b[c]=d,r end end end)

--[[
作为模板: true
模板id: my-shadow-follow-cursor
说明: |-
  实体“我的影子”追随准星。
  灵感来源:bilibili@妖狐みれい,uid:3493076226017574
]]
l local b,c,a=Isaac,GetPtrHash,'Position'b.AddCallback({},ModCallbacks.MC_FAMILIAR_UPDATE,function(_,f)for k,v in pairs(b.FindByType(1e3))do if(v.Variant==30 or v.Variant==153)and c(v.SpawnerEntity)==c(f.Player)then f:FollowPosition(v[a])f:AddVelocity(v[a]-f[a])end end end,131)

--[[
作为模板: true
模板id: random-key-swap
说明: |-
  每进入一个新房间，移动键随机互换、攻击键随机互换、功能键随机互换。
  灵感来源:bilibili@月半之大_0813,uid:400635734
]]
l local A,B,C,D,E,F,Z=Input,Isaac,ModCallbacks,{},{},{'A','D','W','S','<','>','^','v','E','Space','Q','Ctrl'}Z=B.AddCallback for k=0,11 do D[k]=k end Z(E,C.MC_POST_NEW_ROOM,function(a)for i=0,8,4 do for j=i+3,i+1,-1 do a=math.random(i,j)D[j],D[a]=D[a],D[j]end end end)Z(E,C.MC_INPUT_ACTION,function(a,e,h,b)a,e=InputHook,e and e:ToPlayer()b=D[b]if e and b then if h==a.IS_ACTION_PRESSED then h=A.IsActionPressed elseif h==a.IS_ACTION_TRIGGERED then h=A.IsActionTriggered else h=A.GetActionValue end return h(b,e.ControllerIndex)end end)Z(E,C.MC_POST_RENDER,function(a,b,c,p)c=Vector p=c(B.GetScreenWidth()/3,.9*B.GetScreenHeight())a=function(z,y,x,...)B.RenderScaledText(z,y.X-x*B.GetTextWidth(z)/2,y.Y,x,x,...)end for k,v in ipairs{-180,0,-90,90}do b=8*c.FromAngle(v)a(F[D[k-1]+1],p+b,.8,0,1,0,1)a(F[D[k+3]+1],p+2*b,1,1,0,0,1)end p.X=2*p.X for k,v in pairs{Bomb=-12,Active=-4,Card=4,Drop=12}do a(k..': '..F[D[(v+12)//8+8]+1],p+c(0,v),.8,1,1,0,1)end end)

--[[
作为模板: true
模板id: blinking-coin-punish
说明: |-
  没捡到闪烁的硬币时，所有角色受伤一次，不忽略无敌帧。
  灵感来源:bilibili@AAA笑脸批发商,uid:379358804
]]
l local A,B,C,E,F,G=Isaac.AddCallback,ModCallbacks,PickupVariant.PICKUP_COIN,GetPtrHash,{},{}A(G,B.MC_POST_PICKUP_UPDATE,function(h,p)h=E(p)if p.Timeout>=0 and not F[h]then F[h]=1 end end,C)A(G,B.MC_PRE_PICKUP_COLLISION,function(h,p,c)h=E(p)if c:ToPlayer()and F[h]then F[h]=2 end end,C)A(G,B.MC_PRE_PLAYER_COLLISION,function(h,p,c)h=E(c)if c:ToPickup()and F[h]then F[h]=3 end end)A(G,B.MC_POST_ENTITY_REMOVE,function(h,e)h=E(e)if 1==F[h]then for i=1,Game():GetNumPlayers()do Isaac.GetPlayer(i-1):TakeDamage(1,0,EntityRef(e),60)end end if F[h]then h,F[h]={}for k,v in pairs(F)do if v then h[k]=v end end F=h e:Remove()end end,EntityType.ENTITY_PICKUP)

--[[
作为模板: true
模板id: random-lag-remove
说明: |-
  游戏随机卡顿、删除角色眼泪、删除掉落物。
  灵感来源:bilibili@AAA笑脸批发商,uid:379358804
]]
l local c,d,A,B,Z=Random,pairs,Isaac,EntityType Z=A.FindByType A.AddCallback({},ModCallbacks.MC_POST_UPDATE,function(a,b)a=c()%1e3 if a<8 then for _=1,1e5 do A.GetRoomEntities()end b={}for _,v in d{'HEART','COIN','KEY','BOMB','POOP','GRAB_BAG','PILL','LIL_BATTERY','TAROTCARD','TRINKET'}do a=Z(B.ENTITY_PICKUP,PickupVariant['PICKUP_'..v])table.move(a,1,#a,#b+1,b)end elseif a<24 then b=Z(B.ENTITY_TEAR)end for _,v in d(b or{})do if c()%100<20 then v:Remove()end end end)

--[[
作为模板: true
模板id: nearby-projectile-freeze
说明: |-
  角色半径1格内的投射物会被冻结，效果类似道具“爸爸的戒指”。
  灵感来源:bilibili@月半之大_0813,uid:400635734
]]
l Isaac.AddCallback({},ModCallbacks.MC_POST_PROJECTILE_UPDATE,function(p,t,s)s='Position'p=Game():GetNearestPlayer(t[s])if 40+t.Size/2>=t[s]:Distance(p[s])then t:AddFreeze(EntityRef(p),1)end end)

--[[
作为模板: true
模板id: collectible-fixed-set
说明: |-
  生成的道具被替换为道具17、18、32、190、628中的一个，其中出现628的概率为0.5%，且道具628的贴图会被替换为17、18、32、190中的一个。
  灵感来源:bilibili@赫腊梅,uid:646846635
]]
l local b,t=Isaac.AddCallback,{17,18,32,190,628}b({},63,function(_,_,_,_,d)return t[d%1e5//24875+1]end)b({},34,function(s,p)if p.SubType==t[5]then s=p:GetSprite()s:ReplaceSpritesheet(1,Isaac.GetItemConfig():GetCollectible(t[(p.InitSeed%1e5+1)//25e3+1]).GfxFileName)s:LoadGraphics()end end,100)

--[[
作为模板: true
模板id: tears-hurt-player
说明: |-
  眼泪可以伤害角色。
  灵感来源:bilibili@AAA笑脸批发商,uid:379358804
]]
l Isaac.AddCallback({},ModCallbacks.MC_POST_PLAYER_UPDATE,function(_,p)for _,t in pairs(Isaac.FindByType(EntityType.ENTITY_TEAR))do if t.Size+p.Size>=2*t.Position:Distance(p.Position)then return p:TakeDamage(1,0,EntityRef(t),30)end end end)

--[[
作为模板: true
模板id: sparse-room-grudge
说明: |-
  当房间内(除去墙和门)障碍物的面积占房间面积的比例小于30%时，在房间四个角各生成一个窥眼刺块。
  灵感来源:bilibili@Aguid_Einzebern,uid:398102143
]]
l local a=GridEntityType Isaac.AddCallback({},ModCallbacks.MC_POST_NEW_ROOM,function(r,s,c,w,h,p,q,g,d)r=Game():GetRoom()c=0 s=r:GetGridSize()c=0 w=r:GetGridWidth()h=s/w s=0 g={}for i=1,h do for j=1,w do p=j+w*(i-1)q=r:GetGridPosition(p)d=r:GetGridEntity(p)d=d and d:GetType()if r:IsPositionInRoom(q,0)and not(d and(d==a.GRID_WALL or d==a.GRID_DOOR))then s=s+1 if d then c=c+1 else for k,v in ipairs{{1,1},{w,1},{1,h},{w,h}}do d=(v[1]-j)^2+(v[2]-i)^2 if not g[k]or g[k].d>d then g[k]={d=d,p=q}end end end end end end if c/s<.3 then for _,v in pairs(g)do if v then Isaac.Spawn(EntityType.ENTITY_GRUDGE,0,0,v.p,Vector.Zero,nil)end end end end)

--[[
作为模板: true
模板id: tear-reroll-enemy
说明: 玩家的攻击可以给怪物降级。
]]
l Isaac.AddCallback({},ModCallbacks.MC_EVALUATE_CACHE,function(_,p)p.TearFlags=p.TearFlags|TearFlags.TEAR_REROLL_ENEMY end,CacheFlag.CACHE_TEARFLAG)

--[[
作为模板: true
模板id: room-wind
说明: 房间中吹起微风，可在控制台输入 lua Windy = 数值 来调整风力系数（默认{P1}）。屏幕上方会显示当前房间的风力大小，风力大小和楼层数、房间难度和风力系数有关。风会从进入房间的门吹向其他门，实体会被风吹动。
参数定义:
  P1: {类型: 数值, 默认: 25, 性质: 全局, 说明: "全局变量Windy，风力系数（默认25）"}
]]
l Windy=P1 local C,I,M,V,T,A=0,Isaac,ModCallbacks,Vector,{}A=I.AddCallback A(T,M.MC_POST_UPDATE,function()for _,v in pairs(I.GetRoomEntities())do if not v:ToEffect()then local O,Z,R=0,V.Zero,Game():GetRoom()for i=0,7 do if R:GetDoor(i)then O,L=O+1,v.Position-R:GetDoorSlotPosition(i)Z=Z+C/v.Mass*(i==Game():GetLevel().EnterDoor and 1 or-1)*L:Normalized()/(L:Length()+40)end end v:AddVelocity((O==1 and-1 or 1)*Z/math.max(1,O))end end end)A(T,M.MC_POST_NEW_ROOM,function()local L=Game():GetLevel()C=Windy*L:GetCurrentRoomDesc().Data.Difficulty*(L:GetStage()/10+1)end)A(T,M.MC_POST_RENDER,function()local t=string.format('%.2f',C/100)I.RenderText(t,(I.GetScreenWidth()-I.GetTextWidth(t))/2,I.GetScreenHeight()/16,0,1,0,1)end)

--[[
作为模板: true
模板id: entity-inertia
说明: 实体的加速度变小，可在控制台输入 lua Inertia = 数值 来调整系数（默认{P1}）。加速度变动为原先的 Inertia%，Inertia 取值范围 0~100。
参数定义:
  P1: {类型: 数值, 默认: 30, 性质: 全局, 说明: "全局变量Inertia，加速度百分比系数（默认30）"}
]]
l Inertia=P1;local H,I,M,T,X,U,V,A=GetPtrHash,Isaac,ModCallbacks,{},math,'Velocity',{}A=I.AddCallback A(T,M.MC_POST_UPDATE,function()for _,v in pairs(I.GetRoomEntities())do if not v:ToEffect()then local p,h=X.min(100,X.max(0,Inertia))/100,H(v)if V[h]then v[U]=v[U]*p+V[h]*(1-p)end V[h]=v[U]end end end)A(T,M.MC_POST_NEW_ROOM,function()V={}end)

--[[
作为模板: true
模板id: thunder-flash
说明: 屏幕变黑，周期性被照明，可在控制台输入 lua Thunder = 数值 来调整照明时间（默认{P1}秒）。
参数定义:
  P1: {类型: 数值, 默认: 2, 性质: 全局, 说明: "全局变量Thunder，闪电强度系数（默认2）"}
]]
l Thunder=P1;local I,V,B=Isaac,Vector,Sprite()B:Load('gfx/ui/loading.anm2',true)B:Play('1',true)B.Scale=V.One*9 I.AddCallback({},ModCallbacks.MC_POST_RENDER,function()local p,t=Thunder t=Game():GetFrameCount()/30%(3*p)B.Color=Color(1,1,1,math.max(1-8*t,1-(t/p-3)^2/4))B:RenderLayer(0,V.Zero)end)

--[[
作为模板: true
模板id: force-slot-switch
说明: 每隔一段时间强制切换玩家的某个槽位物品为道具暗仪刺刀、其他槽位为道具计划C或卡牌自杀之王。可在控制台输入 lua Duration = 数值 来调整切换间隔，数值单位为逻辑帧，默认{P1}逻辑帧({P2})。
参数定义:
  P1: {类型: 数值, 默认: 90, 性质: 全局, 说明: "全局变量Duration，强制切换的间隔帧数（默认90）"}
  P2: {类型: 描述, 默认: "3秒", 性质: 局部, 说明: "说明文本中的切换间隔秒数显示值（90帧=3秒）"}
]]
l Duration=P1;local C,D,E,F,G,H,I,M,N,P,Q,S,T,A,U,V='GetFrameCount','ControlsCooldown','SetPocketActiveItem',0,0,math,Isaac,ModCallbacks,false,CollectibleType,Card.CARD_SUICIDE_KING,true,{}A,U,V=I.AddCallback,P.COLLECTIBLE_PLAN_C,P.COLLECTIBLE_DARK_ARTS A(T,M.MC_POST_PLAYER_UPDATE,function(_,p)local g,s,t=Game()if g[C](g)%Duration<1 then F=(F+H.random(1,5))%6 for i=0,3 do s,t=(i==F)and V or U,p:GetActiveItem(i)if s~=t or i>1 then p:RemoveCollectible(t,S,i,S)if i<2 then p:AddCollectible(s,I.GetItemConfig():GetCollectible(s).InitCharge,N,i)end end end for i=0,3 do if Q~=p:GetCard(i)then p:DropPocketItem(i,I.GetFreeNearPosition(p.Position,9))end end G=(F>1)and F or G p[E](p,F>1 and V or U,2,N)p[E](p,U,3,N)for i=2,3 do p:SetCard(i,Q)end end end)A(T,M.MC_INPUT_ACTION,function(_,e,h,a)if e and e:ToPlayer()and a==ButtonAction.ACTION_DROP and G>0 then G=G-1 return S end end,InputHook.IS_ACTION_TRIGGERED)A(T,M.MC_POST_RENDER,function()local d,g,t,c,s=Duration,Game()t=(d-g[C](g)%d)/30 c,s=t*30/d,string.format('%.2fs',t)I.RenderText(s,(I.GetScreenWidth()-I.GetTextWidth(s))/2,I.GetScreenHeight()/16,1,c,c,1)end)A(T,M.MC_USE_ITEM,function(_,c,r,p)p[D]=H.max(p[D],180)end,U)A(T,M.MC_POST_PICKUP_INIT,function(_,e)if e.SubType==Q then e:Remove()end end,PickupVariant.PICKUP_TAROTCARD)

--[[
作为模板: true
模板id: pool-quality-shuffle
说明: 从道具池抽取道具时，大部分道具按照品质从低到高抽取；(1/SHUFFLE)*100% 的道具会被插入到道具池底部。可在控制台输入 lua SHUFFLE = 数值 调整（默认{P1}）。
参数定义:
  P1: {类型: 数值, 默认: 8, 性质: 全局, 说明: "全局变量SHUFFLE，道具池质量洗牌档位（默认8）"}
]]
l SHUFFLE=P1;local f,Z=Isaac f.AddCallback({},ModCallbacks.MC_PRE_GET_COLLECTIBLE,function(a,z,y,x,b,c,d,e,g,h)if not Z then b=f.GetItemConfig()a=Game():GetItemPool()d='GetCollectible'g={}h=Game():GetSeeds():GetStartSeed()for i=0,10 do e=b[d..'s'](b).Size if i<10 then repeat e=e-1 c=b[d](b,e)if c then if not g[e]then g[e]=e~h for j=1,4 do g[e]=g[e]~(g[e]<<((j<<1)+1))~(g[e]>>(((j+1)<<1)+1))end g[e]=g[e]%math.max(1,SHUFFLE)end if c.Quality>i%5 or i<5 and 1>g[e]then a:AddRoomBlacklist(e)end end until e<0 and not c end Z=true c=b[d](b,a[d](a,z,y,x))e=c.ID Z=nil a:ResetRoomBlacklist()if CollectibleType.COLLECTIBLE_BREAKFAST~=e then return e end end end end)

--[[
作为模板: true
模板id: wisp-soul-system
说明: |-
  玩家周围每秒生成｛射速｝只小精灵，小精灵存在时间为｛{P1}*射程^{P2}｝秒，飞行速度与｛弹速｝相关。小精灵会自动攻击房间内的敌人，并对敌人发射｛玩家泪弹｝，不兼容弹道数量和攻击方式。
  可按住鼠标左键指定小精灵的优先攻击位置。
  击败敌人时，敌人会释放1只灵魂；灵魂会四散逃逸然后飞向玩家，每收集一只灵魂都会为玩家提供｛灵魂所属敌人最大生命值1%｝的临时或永久属性增益，其中临时属性增益每帧（每秒60次）衰减｛{P3}(最低0.001)｝。
  灵魂有4种颜色，32.8125%为红色，会对路径上的敌人造成2秒｛灼烧｝伤害（每秒造成等同于玩家攻击力的伤害），并给予玩家｛临时攻击力增益｝；32.8125%为绿色，会对路径上的敌人造成2秒｛中毒｝伤害（每秒造成敌人最大血量10%的伤害(头目为1%)，并给予玩家｛临时射速增益｝；32.8125%为蓝色，会对路径上的敌人造成3秒｛冰冻｝效果，并给予玩家｛临时射程增益｝；1.5625%为白色，会对路径上的敌人使用｛圣光｝攻击，并给予玩家｛永久幸运增益｝，圣光会对敌人造成最多6段伤害，每段伤害为｛200%玩家的攻击力｝。
  场上最多存在100只小精灵，超过时玩家不再召唤小精灵，已存在的小精灵可以触发多次攻击。
  场上最多存在{P4}只灵魂，超过时新的灵魂将被储存入队。场上灵魂数量低于上限时，储存的灵魂将被释放。
  小退和rewind会清除所有增益。
参数定义:
  P1: {类型: 数值, 默认: '.37', 性质: 局部, 说明: "小精灵存在时间系数（默认.37，公式 系数*（射程/40)^指数 秒）"}
  P2: {类型: 数值, 默认: '.57', 性质: 局部, 说明: "小精灵存在时间指数（默认.57）"}
  P3: {类型: 数值, 默认: '1e-3', 性质: 局部, 说明: "临时属性增益每帧衰减率（默认1e-3=0.1%）"}
  P4: {类型: 数值, 默认: 20, 性质: 局部, 说明: "场上灵魂数量上限（默认20）"}
]]
l local Ve,Af,Hf,Ga,Is,Re,Di,Q,R,I,F,B,J,C,Z,O,Y,E,K,G,P,D,L,A,U,M,S,V,W,T,H,N,X='AddVelocity','AddEntityFlags','HasEntityFlags',Game(),'IsVulnerableEnemy','Remove','Distance',math,Random,Isaac,Isaac.AddCallback,Isaac.Spawn,Isaac.GetRoomEntities,Vector,Vector.Zero,Color,true,1e3,1<<37,Isaac.GetFrameCount,'Position','InitSeed','FromAngle','Parent','Variant','Color','MaxHitPoints',1<<29,{[1]={'Damage',function(l,a)return l+a end},[2]={'MaxFireDelay',function(l,a)return(30/(30/(l+1)+a))-1 end},[8]={'TearRange',function(l,a)return l+40*a end},[1024]={'Luck',function(l,a)return l+a end}},{},function(m)local a,b='Size','SizeMulti'return m and m[a]/2*(m[b].X+m[b].Y)or 0 end,{}X=function(e)local s=e[D]N[s]=N[s]or{}return N[s]end F(N,4,function(_,p)p:EvaluateItems()end)for f,t in pairs(W)do F(N,8,function(_,p)local d,s=X(p),t[1]p[s]=t[2](p[s],d[s]or 0)end,f)end F(N,15,function()N,T={},{}end)F(N,29,function(_,e)if e:IsEnemy()and not e:IsInvincible()then N.W=N.W or{}N.W[#N.W+1]=e end end)F(N,31,function(_,p)local d,t,w,s,c=X(p),.5/(1+p[W[2][1]])for f,r in pairs(W)do s=r[1]d[s]=Q.max(0,d[s]and(d[s]-(f~=1024 and Q.max(P3,d[s]*P3)or 0))or 0)p:AddCacheFlags(f)end d.A=d.A and d.A+t or t if d.A>=1 then d.A=d.A-1 if not N.C or N.C<100 then w=B(E,65,0,p[P]+80*C[L](R()),Z,p)c=w:GetSprite()[M]w[M]=O(c.R,c.G,c.B,2)w[Af](w,K)X(w).T=G()T[w[D]]=p N.C=N.C and N.C+1 or 1 else d.B=d.B and d.B+1 or 1 end end if(not N.I or N.I<P4)and N.W and#N.W>0 then w=table.remove(N.W,1)d=B(E,179,1,w[P],90*C[L](R()),w)d.Target=p d[Af](d,K)X(d).H=w[S]/100 t=B(E,166,0,d[P],Z,d)t[A]=d t[Af](t,K)d.Child=t c=d[D]&63 if c<21 then d[M]=O(1,0,0,3)elseif c<42 then d[M]=O(0,1,0,3)elseif c<63 then d[M]=O(0,1,1,3)else d[M]=O(1,1,1,10)end t[M]=d[M]T[d[D]]=p T[t[D]]=p N.I=N.I and N.I+1 or 1 end end)F(N,55,function(_,e)local p,x,j,s,u,a,k,l,v,f,c,t=T[e[D]],Input.GetMousePosition(Y),1/0,e[P]if p then a=X(p)t=P1*(p[W[8][1]]/40)^P2 u=(G()-X(e).T)/60 c=e[M]e[M]=O(c.R,c.G,c.B,2*(1-u/t))if t<u then e[Re](e)return end f=function(m,z)local d,v,t=z or m[P]v=(d-s):Normalized()*p.ShotSpeed if d[Di](d,s)<=H(m)+H(e)then t=p:FireTear(s,10*v,Y,Y)t:AddTearFlags(1)t.Scale=.1 if a.B and a.B>0 then a.B=a.B-1 else e[Re](e)end else e[Ve](e,v)end end if Ga:GetRoom():IsMirrorWorld()then x.X=x.X-2*I.ScreenToWorldDistance(I.WorldToScreen(x)-I.WorldToRenderPosition(C(320,240))).X end if Input.IsMouseBtnPressed(0)then return f(nil,x)else for _,m in pairs(J())do if m[Is](m)and not m[Hf](m,V)then l=m[P][Di](m[P],s)-H(m)if l<j then j,k=l,m end end end end if l then return f(k)end v=(p[P]+80*C[L](R())-s):Normalized()e[Ve](e,.1*v+.2*C[L](R()))end end,65)F(N,55,function(_,e)local p,v,x,w,d,h=T[e[D]]if e[U]~=65 and p then for _,n in pairs(J())do if e[A]then e[P]=e[A][P]elseif R()&7==0 then v=(n[P]-e[P]):Normalized()e[Ve](e,((e[D]&1)*2-1)*C(-v.Y,v.X))end if n[Is](n)and not n[Hf](n,V)and n[P][Di](n[P],e[P])<=H(n)+H(e)then x,w=(e[A]and e[A][D]or e[D])&63,EntityRef(p)if x<21 then n:AddBurn(w,60,p[W[1][1]]/30)elseif x<42 then if n:IsBoss()then d=3e3 else d=3e2 end n:AddPoison(w,60,e[S]/d)elseif x<63 then n:AddFreeze(w,90)else h=B(E,19,0,n[P],Z,p)h[A]=p h.CollisionDamage=2*p[W[1][1]]end end end end end)F(N,67,function(_,e)local h,x,p,d,f=X(e).H,e[D]&63,T[e[D]]if p then if e[U]==179 then d=X(p)N.I=N.I and N.I-1 or 0 if x<21 then f=W[1][1]elseif x<42 then f=W[2][1]elseif x<63 then f=W[8][1]else f=W[1024][1]end d[f]=d[f]and d[f]+h or h elseif e[U]==65 then N.C=N.C-1 end end T[e[D]]=nil end,E)F(N,67,function(_,e)N[e[D]]=nil end)


--[[
作为模板: true
模板id: time-erase
说明: 每{P3}会删除角色{P4}的时间
参数定义:
  P1: {类型: 毫秒, 默认: '1e4', 性质: 局部, 说明: 删除时间的触发间隔(毫秒)，10秒=1e4}
  P2: {类型: 帧, 默认: 45, 性质: 局部, 说明: 每次删除的时长(帧)，1.5秒=45帧}
  P3: {类型: 描述, 默认: "10秒", 性质: 局部, 说明: "说明文本中的触发间隔显示值（10秒=1e4毫秒）"}
  P4: {类型: 描述, 默认: "1.5秒", 性质: 局部, 说明: "说明文本中的删除时长显示值（1.5秒=45帧）"}
]]
l local s,a,e,n=0,1 Isaac.AddCallback({},1,function()e=Isaac.GetTime()if a and e-s>P1 then s=e a=n for _=1,P2 do Game():Update()end a=1 end end)

--[[
作为模板: true
模板id: sfx-volume-adjust
说明: 音效{P1}的音量调整至{P3}。
参数定义:
  P1: {类型: 音效id列表, 默认: [182, 477], 性质: 局部, 说明: 需调整音量的音效id列表}
  P2: {类型: 数值, 默认: '.3', 性质: 局部, 说明: 音量系数，30%=.3}
  P3: {类型: 描述, 默认: "30%", 性质: 局部, 说明: "说明文本中的音量百分比显示值（30%=.3）"}
]]
l Isaac.AddCallback({},ModCallbacks.MC_POST_UPDATE,function()for _,v in pairs{P1}do SFXManager():AdjustVolume(v,P2)end end)

--[[
作为模板: true
模板id: open-map-red-rooms
说明: |-
  进入新房间时，自动开启地图全部房间和红房间，并移除所有房间的红色标签。
]]
l Isaac.AddCallback({},19,function()local l,r,s,t,f,g,x,e,o,n,a,m=Game():GetLevel(),{},'SafeGridIndex','Data','Flags','GetRooms','GetRoomByIdx'l:SetCanSeeEverything(true)e,o=function(c,k,d)c[f],d,k=~(1<<10)&c[f],c[t]and c[t].Doors,c[s]if k<0 then return end for j=0,7 do if not d or d&1>0 then l:MakeRedRoomDoor(k,j)l:UncoverHiddenDoor(k,j)end d=d and d>>1 end r[k]=1 end,l[g](l)n=#o e(l[x](l,l:GetCurrentRoomDesc()[s]))while a~=n do a=n for j=1,n do m=l[x](l,o:Get(j-1)[s])if not r[m[s]]then e(m)end end o=l[g](l)n=#o end end)

--[[
作为模板: true
模板id: invincible-stone-eye
说明: |-
  在房间中心生成一个永远激活的石眼(Stone Eye)
  灵感来源:bilibili@莉雅liyar,uid:158295392
]]
l local a,c,g,b,h,i=Isaac,ModCallbacks,EntityType.ENTITY_STONE_EYE,'GetGridPosition'h,i=a.AddCallback,a.FindByType h({},c.MC_POST_UPDATE,function(r)r=Game():GetRoom()if 1>#i(g)then a.Spawn(g,0,0,a.GetFreeNearPosition((r[b](r,r:GetGridSize()-1)+r[b](r,0))/2,0),Vector.Zero,nil)end end)h({},c.MC_NPC_UPDATE,function(_,e)if i(g)[1].InitSeed==e.InitSeed then e.State=4 end end,g)

--[[
作为模板: true
模板id: divine-intervention
说明: |-
  在玩家周围生成隐形的神圣干预同心圆
]]
l local b,c,h,k,n,i,a,m,K=Isaac,ModCallbacks,GetPtrHash,EffectVariant.DIVINE_INTERVENTION,Vector,'SpawnerEntity','Position'm=b.AddCallback K={}m(K,c.MC_POST_PLAYER_UPDATE,function(d,p)d=p:GetData()d[K]=d[K]or{}d=d[K]for i=0,107 do d[i]=d[i]or{}if not(d[i].e and d[i].e:Exists())then d[i].e=b.Spawn(EntityType.ENTITY_EFFECT,k,0,p[a],n.Zero,p)d[i].h=h(d[i].e)d[i].e:GetData()[K]=i end end end)m(K,c.MC_POST_EFFECT_UPDATE,function(p,e,l,d,j)p=e[i]d=e:GetData()[K]l=p and p:GetData()[K]if l and p:Exists()and d and l[d]and l[d].h==h(e)then e.Visible=false j=d>35 and 1 or 2 e.Size=3*j e.Rotation=5*j*d e[a]=p[a]+(20+10*j)*n.FromAngle(5*j*d)else e:Remove()end end,k)