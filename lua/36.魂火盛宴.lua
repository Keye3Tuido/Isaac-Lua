--魂火盛宴
--限定角色：伯大尼


---- 代码效果 ----

--0. 前置功能性代码：避免代码污染和重复输入问题;
--默认锁定游戏成就;
--游戏胜利后自动清除代码效果; 长按重开键10秒自动清空代码效果;
--提供接口: CLM()删除匿名回调。
l function CLM(t,m)for i,j in pairs(ModCallbacks)do t=Isaac.GetCallbacks(j)for x=#t,1,-1 do m=t[x].Mod if not(m and m.Name)then Isaac.RemoveCallback(m,j,t[x].Function)end end end end --[[ 清理匿名模组回调,预防代码污染 ]]CLM()local I,M,A,T,F=Isaac,ModCallbacks T=I.GetTime F=T()A=I.AddCallback A({},M.MC_POST_GAME_END,function(_,f)if not f then CLM()end end)A({},M.MC_POST_RENDER,function(p)p=T()for i=1,Game():GetNumPlayers()do if Input.IsActionPressed(ButtonAction.ACTION_RESTART,I.GetPlayer(i).ControllerIndex)then if p-F>=1e4 then CLM()end return end end F=p end) --[[ 自动清理回调 ]] Isaac.AddPriorityCallback({},ModCallbacks.MC_POST_GAME_STARTED,CallbackPriority.IMPORTANT,function(_,c)if not c then Isaac.ExecuteCommand('seed '..Seeds.Seed2String(Game():GetSeeds():GetNextSeed()))end end) --[[ 游戏锁定成就 ]]

--1. 所有玩家永久蒙眼（在矿洞逃亡中不生效）。
l Isaac.AddCallback({},31,function(s,p,g,c,f)f=1 s='Challenge'g=Game()c=g[s]if p:HasCurseMistEffect()then g[s],f=0 p:TryRemoveNullCostume(14)elseif p:CanShoot()then g[s],f=6 p:AddNullCostume(14)end if not f then p:UpdateCanShoot()end g[s]=c end)

--2. 初始给予玩家道具640(灵魂之瓮)。
l local I,G=Isaac,Game()I.AddCallback({},15,function(p,c,t,n)if not c then for _,i in pairs{640}do for k=1,G:GetNumPlayers()do p,t,n=I.GetPlayer(k-1),table.unpack(type(i)=='table'and i or{i,1})for _=1,n do p:AddCollectible(t,I.GetItemConfig():GetCollectible(t).InitCharge)end end G:GetItemPool():RemoveCollectible(t)end end end)

--3. 强制给予玩家：道具223(纵火狂)、道具640(灵魂之瓮)
-- 主动道具数量不够时，强制锁门，房间内生成对应道具
-- 格式：c=道具,t/T=饰品(仅保证层数一致),物品={'类别',数量};数量为一时可简化为物品='类别'; 道具id必须>0
l ITEMS={'c223','c640'}local C,D,E,F,H,I,P,Q,L,M,T=CollectibleType,'OLLECTIBLE','GetPlayerType',PlayerType,'Get',Isaac,pairs,EntityType,'Remove',ModCallbacks,{}local A,B,G,J,K,N,O,S,U=I.AddCallback D,B='C'..D,'C'..D:lower()J=H..B K=J..'Num'O=L..B N=function(i,a,b)a,i=table.unpack(type(i)=='table'and i or{i,1})a,b=a:match('(%a)(%d+)')return i,a,tonumber(b)end G=function(_,a,b,p)for _,i in P(ITEMS)do i,a,b=N(i)if a=='c'then while 0<p[K](p,b)do p[O](p,b)end end end end A(T,M.MC_POST_PLAYER_UPDATE,function(a,p,b,c,e,g,h,j,k,l)if F.PLAYER_THESOUL_B~=p[E](p)and not p:HasCurseMistEffect()then c=I.GetItemConfig()e='Trinket'h='Add'for _,i in P(ITEMS)do i,a,b=N(i)if a=='T'then a='t'i=i*2 end if a=='c'then g=Game():GetItemPool()g[O](g,b)g=0 if not p:IsItemQueueEmpty()then g=p.QueuedItem.Item g=g and g['Is'..B](g)and b==g.ID and 1 or 0 end while i>g+p[K](p,b)do if c[J](c,b).Type==ItemType.ITEM_ACTIVE then S=b break else p[h..B](p,b)end end elseif a=='t'then g=H..e l=h..e while 1 do j=i-p[g..'Multiplier'](p,b)if j<=0 then break end k={}for s=0,1 do k[s]=p[g](p,s)p['Try'..L..e](p,k[s])p[l](p,b|((j>1 and s==0 or j>3)and TrinketType.TRINKET_GOLDEN_FLAG or 0))end p:UseActiveItem(C[D..'_SMELTER'],2315)for s=0,1 do p[l](p,k[s],false)end end end end end end)A(T,M.MC_POST_UPDATE,function(d,r,v,s)if S then r=Game():GetRoom()for _,i in P(DoorSlot)do d=r:GetDoor(i)if d then d:Close()end end d=Q.ENTITY_PICKUP v=PickupVariant.PICKUP_COLLECTIBLE s=I.FindByType if 1>#s(d,v,S)then U=U and U+1 or 1 if U>29 then I.Spawn(d,v,S,r:GetCenterPos(),Vector.Zero,nil)end else U=nil end for _,e in P(s(d,v,0))do e:Remove()end end S=nil end)A(T,M.MC_PRE_USE_ITEM,G,C[D..'_D4'])A(T,M.MC_ENTITY_TAKE_DMG,function(d,e,u,f)d=DamageFlag u='DAMAGE_'e=e:ToPlayer()if F.PLAYER_EDEN_B==e[E](e)and 0==f&(d[u..'RED_HEARTS']|d[u..'IV_BAG']|d[u..'FAKE']|d[u..'NO_PENALTIES'])then G(e,e,e,e)end end,Q.ENTITY_PLAYER)

--4. 在未清理的房间，每5秒为灵魂之瓮充能。
l Isaac.AddCallback({},ModCallbacks.MC_POST_UPDATE,function(a,b,c)b=Game()c=Isaac if not    b:GetRoom():IsClear()and b:GetFrameCount()%150<1 then for i=1,b:GetNumPlayers()do a=Vector.Zero a=c.Spawn(EntityType.ENTITY_EFFECT,EffectVariant.ENEMY_SOUL,0,a,a,nil)a.Target=c.GetPlayer(i)a:Remove()end end end)

--5. 将灵魂之瓮的魂火替换为炼狱恶鬼。
l Isaac.AddCallback({},ModCallbacks.MC_POST_TEAR_INIT,function(_,t)Isaac.Spawn(EntityType.ENTITY_EFFECT,EffectVariant.PURGATORY,1,t.Position,t.Velocity,t.SpawnerEntity):GetSprite():Play('Charge')t:Remove()end,TearVariant.FIRE)

--6. 在炼狱恶鬼被移除的位置，触发爆炸效果。
l Isaac.AddCallback({},ModCallbacks.MC_POST_ENTITY_REMOVE,function(p,e)p=e.Variant==EffectVariant.PURGATORY and e.SubType==1 and e.SpawnerEntity p=p and p:ToPlayer()if p then e=p:FireTear(e.Position,e.Velocity,false,true):ToTear()e:AddTearFlags(TearFlags.TEAR_EXPLOSIVE)e:Die()end end,EntityType.ENTITY_EFFECT)

--7. 强制角色为游伯大尼。
l Isaac.AddCallback({},ModCallbacks.MC_POST_PLAYER_UPDATE,function(_,p)local t=PlayerType.PLAYER_BETHANY if t~=p:GetPlayerType()then p:ChangePlayerType(t)end end)

--以伯大尼重开一局新游戏。
l local A,B,C,Z=Isaac,ModCallbacks.MC_POST_UPDATE,{}Z=function()A.ExecuteCommand('restart '..PlayerType.PLAYER_BETHANY)A.RemoveCallback(C,B,Z)end A.AddCallback(C,B,Z)
--.
