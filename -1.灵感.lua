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

--6. 每秒随机BrokenKeys(默认3,最多12)个按键失灵。
-- GetBrokenKeys()可获取顺序表格，包含当前失灵的按键名称字符串。
l BrokenKeys=3;local A,C,D,M,N,T=Isaac.AddCallback,0,'GetFrameCount',ModCallbacks,{'LEFT','RIGHT','UP','DOWN','SHOOTLEFT','SHOOTRIGHT','SHOOTUP','SHOOTDOWN','BOMB','ITEM','PILLCARD','DROP'},{}A(T,M.MC_POST_UPDATE,function()local g,t,p=Game()t=g[D](g)if t<C or t>C+29 then for i=#N,1,-1 do p=Random()%i+1 N[i],N[p]=N[p],N[i]end C=t end end)A(T,M.MC_INPUT_ACTION,function(_,e,h,a)for i=1,BrokenKeys do if a==ButtonAction['ACTION_'..N[i]]then return h==InputHook.GET_ACTION_VALUE and 0 end end end)function GetBrokenKeys()return table.move(N,1,BrokenKeys,1,{})end

--7. 冰雹雨：每隔Hail(默认0.1)秒，随机天降HailNum(默认3)个冰雹。
l Hail,HailNum=0.1,3;local I=Isaac I.AddCallback({},ModCallbacks.MC_POST_UPDATE,function()if Game():GetFrameCount()%(30*Hail)<1 then for i=1,HailNum do local p=I.Spawn(EntityType.ENTITY_TEAR,TearVariant.ICE,0,I.GetRandomPosition(),Vector.Zero,nil):ToTear()p.FallingAcceleration,p.Height,p.Scale=10,-1e3,.5+math.random()p:AddTearFlags(TearFlags.TEAR_ICE)end end end)

--8. 抵近攻击：敌人距离玩家超过Dist(默认3)格远时，受到的伤害按距离衰减。
l local Dist=3;local H,G,P,T,O=GetPtrHash,40,'Position',{}O=P..'Offset'Isaac.AddCallback({},ModCallbacks.MC_ENTITY_TAKE_DMG,function(_,e,a,...)local h,p,q=H(e),Game():GetRandomPlayer(Vector.Zero,0)if not T[h]and e:IsEnemy()then q=(p[O]+p[P]-e[O]-e[P]):Length()-G*Dist if q>0 then T[h]=true e:TakeDamage(G*a/(G+q),...)T[h]=nil return false end end end)
--[Repentogon]
l local Dist=3;local G,P,O=40,'Position'O=P..'Offset'Isaac.AddCallback({},ModCallbacks.MC_ENTITY_TAKE_DMG,function(_,e,d)if e:IsEnemy()then local p,q=Game():GetRandomPlayer(Vector.Zero,0)q=(p[O]+p[P]-e[O]-e[P]):Length()-G*Dist if q>0 then return{Damage=G*d/(G+q)}end end end)
--.