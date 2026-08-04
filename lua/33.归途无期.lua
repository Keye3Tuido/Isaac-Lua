--归途无期
--限定角色：以撒
--限定难度：困难模式
--输入下面的代码后，重新开始一局新游戏

--代码介绍：
--仅可拾取 任务道具；且目标是收集全部任务道具：
--菜刀碎片1
--菜刀碎片2
--铲子碎片1
--铲子碎片2
--妈妈的铲子
--钥匙碎片1
--钥匙碎片2
--全家福/底片
--爸爸的便条
--教条

---- 代码效果(不用管中文，全选复制即可) ----

--0. 前置功能性代码：避免代码污染和重复输入问题;
--默认锁定游戏成就;
--游戏胜利后自动清除代码效果; 长按重开键10秒自动清空代码效果;
--提供接口: CLM()删除匿名回调。
l function CLM(t,m)for i,j in pairs(ModCallbacks)do t=Isaac.GetCallbacks(j)for x=#t,1,-1 do m=t[x].Mod if not(m and m.Name)then Isaac.RemoveCallback(m,j,t[x].Function)end end end end --[[ 清理匿名模组回调,预防代码污染 ]]CLM()local I,M,A,T,F=Isaac,ModCallbacks T=I.GetTime F=T()A=I.AddCallback A({},M.MC_POST_GAME_END,function(_,f)if not f then CLM()end end)A({},M.MC_POST_RENDER,function(p)p=T()for i=1,Game():GetNumPlayers()do if Input.IsActionPressed(ButtonAction.ACTION_RESTART,I.GetPlayer(i).ControllerIndex)then if p-F>=1e4 then CLM()end return end end F=p end) --[[ 自动清理回调 ]] Isaac.AddPriorityCallback({},ModCallbacks.MC_POST_GAME_STARTED,CallbackPriority.IMPORTANT,function(_,c)if not c then Isaac.ExecuteCommand('seed '..Seeds.Seed2String(Game():GetSeeds():GetNextSeed()))end end) --[[ 游戏锁定成就 ]]

--1. 新游戏开始时，在初始房间生成铲柄，并直接传送到最后一个Boss房。
l Isaac.AddCallback({},ModCallbacks.MC_POST_GAME_STARTED,function(l,c)if not c then Isaac.Spawn(EntityType.ENTITY_PICKUP,PickupVariant.PICKUP_BROKEN_SHOVEL,550,Game():GetRoom():GetCenterPos(),Vector.Zero,nil)l=Game():GetLevel()l:ChangeRoom(l:GetRooms():Get(l:GetLastBossRoomListIndex()).SafeGridIndex)end end)

--2. 不可拾取非任务道具和错误道具。
l local A,B,C,D,X,Y,Z=Isaac,ModCallbacks,function(c)return c and(c.ID<0 or not c:HasTags(ItemConfig.TAG_QUEST))end,'Collectible'Z=A.AddCallback Y=A.GetItemConfig()X='Get'..D Z({},B.MC_POST_PLAYER_UPDATE,function(i,p,c)i=Y[X..'s'](Y).Size repeat i=i-1 c=Y[X](Y,i)if C(c)then while p['Has'..D](p,i,true)do p['Remove'..D](p,i)end end until not c and i<0 end)Z({},B.MC_POST_PICKUP_UPDATE,function(_,e)if C(Y[X](Y,e.SubType))then e.Touched=true end end,PickupVariant.PICKUP_COLLECTIBLE)

--3. 献祭不再飞升。
l local A,B,C,Z=Isaac,ModCallbacks,{}Z=A.AddCallback Z({},B.MC_POST_UPDATE,function(r,g,d,f)r=Game():GetRoom()if RoomType.ROOM_SACRIFICE==r:GetType()then for i=1,r:GetGridSize()do g=r:GetGridEntity(i-1)d='VarData'if g and g:ToSpikes()then f=g.Desc.SpawnSeed if C[f]then g[d]=0 elseif 10<g[d]then g[d]=0 C[f]=true end end end end end)Z({},B.MC_POST_NEW_LEVEL,function()C={}end)

--4. 妈腿层只能走回溯门。
l Isaac.AddCallback({},ModCallbacks.MC_POST_UPDATE,function(l,s,c,a)a=LevelStage l=Game():GetLevel()s=l:GetStage()c=0<LevelCurse.CURSE_OF_LABYRINTH&l:GetCurses()if not l:IsAscent()and(s==a.STAGE3_1 and c or s==a.STAGE3_2 and not c)and GridRooms.ROOM_SECRET_EXIT_IDX~=l:GetCurrentRoomIndex()then s=l:GetCurrentRoom()for i=0,s:GetGridSize()-1 do c=s:GetGridEntity(i)if c and GridEntityType.GRID_TRAPDOOR==c:GetType()then s:RemoveGridEntity(i,0,false)end end for _,v in pairs(Isaac.FindByType(EntityType.ENTITY_EFFECT,EffectVariant.HEAVEN_LIGHT_DOOR,0))do v:Remove()end end end)

--5. 妈腿层秘密出口房间内，若玩家没有道具“钥匙碎片1”“钥匙碎片2”和“妈妈的铲子”，则活板门和天堂光柱都关闭。
l Isaac.AddCallback({},ModCallbacks.MC_POST_UPDATE,function(l,s,c,a)a=LevelStage l=Game():GetLevel()s=l:GetStage()c=0<LevelCurse.CURSE_OF_LABYRINTH&l:GetCurses()if(s==a.STAGE3_1 and c or s==a.STAGE3_2 and not c)and GridRooms.ROOM_SECRET_EXIT_IDX==l:GetCurrentRoomIndex()then c=0 s={['KEY_PIECE_1']=1,['KEY_PIECE_2']=1,['MOMS_SHOVEL']=1}for i=1,Game():GetNumPlayers()do for k,v in pairs(s)do if v and Isaac.GetPlayer(i-1):HasCollectible(CollectibleType['COLLECTIBLE_'..k])then s[k]=nil c=c+1 end end if c>=3 then return end end s=l:GetCurrentRoom()for i=0,s:GetGridSize()-1 do c=s:GetGridEntity(i)if c and GridEntityType.GRID_TRAPDOOR==c:GetType()then c.State=0 c:GetSprite():Play('Closed',true)end end for _,v in pairs(Isaac.FindByType(EntityType.ENTITY_EFFECT,EffectVariant.HEAVEN_LIGHT_DOOR,0))do v:ToEffect().State=0 v:GetSprite():Play('Appear',true)end end end)

--6. 第一层必须拿到铲柄才能下层。
l Isaac.AddCallback({},ModCallbacks.MC_POST_UPDATE,function(l,s,c)l=Game():GetLevel()if not l:IsAscent()and 3>l:GetStageType()and LevelStage.STAGE1_1==l:GetStage()then for i=1,Game():GetNumPlayers()do if Isaac.GetPlayer(i-1):HasCollectible(CollectibleType.COLLECTIBLE_BROKEN_SHOVEL_1)then return end end s=l:GetCurrentRoom()for i=0,s:GetGridSize()-1 do c=s:GetGridEntity(i)if c and GridEntityType.GRID_TRAPDOOR==c:GetType()then c.State=0 c:GetSprite():Play('Closed',true)end end for _,v in pairs(Isaac.FindByType(EntityType.ENTITY_EFFECT,EffectVariant.HEAVEN_LIGHT_DOOR,0))do v:ToEffect().State=0 v:GetSprite():Play('Appear',true)end end end)

--7. 水层必须拿到刀把才能下层。
l Isaac.AddCallback({},ModCallbacks.MC_POST_UPDATE,function(l,s,c,a)l=Game():GetLevel()a=LevelStage s=l:GetStage()c=0<LevelCurse.CURSE_OF_LABYRINTH&l:GetCurses()if not l:IsAscent()and 3<l:GetStageType()and(s==a.STAGE1_1 and c or s==a.STAGE1_2 and not c)then for i=1,Game():GetNumPlayers()do if Isaac.GetPlayer(i-1):HasCollectible(CollectibleType.COLLECTIBLE_KNIFE_PIECE_1)then return end end s=l:GetCurrentRoom()for i=0,s:GetGridSize()-1 do c=s:GetGridEntity(i)if c and GridEntityType.GRID_TRAPDOOR==c:GetType()then c.State=0 c:GetSprite():Play('Closed',true)end end for _,v in pairs(Isaac.FindByType(EntityType.ENTITY_EFFECT,EffectVariant.HEAVEN_LIGHT_DOOR,0))do v:ToEffect().State=0 v:GetSprite():Play('Appear',true)end end end)

--8. 矿层必须拿到刀头才能下层。
l Isaac.AddCallback({},ModCallbacks.MC_POST_UPDATE,function(l,s,c,a)l=Game():GetLevel()a=LevelStage s=l:GetStage()c=0<LevelCurse.CURSE_OF_LABYRINTH&l:GetCurses()if not l:IsAscent()and 3<l:GetStageType()and(s==a.STAGE2_1 and c or s==a.STAGE2_2 and not c)then for i=1,Game():GetNumPlayers()do if Isaac.GetPlayer(i-1):HasCollectible(CollectibleType.COLLECTIBLE_KNIFE_PIECE_2)then return end end s=l:GetCurrentRoom()for i=0,s:GetGridSize()-1 do c=s:GetGridEntity(i)if c and GridEntityType.GRID_TRAPDOOR==c:GetType()then c.State=0 c:GetSprite():Play('Closed',true)end end for _,v in pairs(Isaac.FindByType(EntityType.ENTITY_EFFECT,EffectVariant.HEAVEN_LIGHT_DOOR,0))do v:ToEffect().State=0 v:GetSprite():Play('Appear',true)end end end)

--9. 强制下水。
l Isaac.AddCallback({},ModCallbacks.MC_POST_UPDATE,function(l,s,c,a)a=LevelStage l=Game():GetLevel()s=l:GetStage()c=0<LevelCurse.CURSE_OF_LABYRINTH&l:GetCurses()if not l:IsAscent()and 3>l:GetStageType()and(s==a.STAGE1_1 and c or s==a.STAGE1_2 and not c)and GridRooms.ROOM_SECRET_EXIT_IDX~=l:GetCurrentRoomIndex()then s=l:GetCurrentRoom()for i=0,s:GetGridSize()-1 do c=s:GetGridEntity(i)if c and GridEntityType.GRID_TRAPDOOR==c:GetType()then s:RemoveGridEntity(i,0,false)end end for _,v in pairs(Isaac.FindByType(EntityType.ENTITY_EFFECT,EffectVariant.HEAVEN_LIGHT_DOOR,0))do v:Remove()end end end)

--10. 强制下矿。
l Isaac.AddCallback({},ModCallbacks.MC_POST_UPDATE,function(l,s,c,a)a=LevelStage l=Game():GetLevel()s=l:GetStage()c=0<LevelCurse.CURSE_OF_LABYRINTH&l:GetCurses()if not l:IsAscent()and 3>l:GetStageType()and(s==a.STAGE2_1 and c or s==a.STAGE2_2 and not c)and GridRooms.ROOM_SECRET_EXIT_IDX~=l:GetCurrentRoomIndex()then s=l:GetCurrentRoom()for i=0,s:GetGridSize()-1 do c=s:GetGridEntity(i)if c and GridEntityType.GRID_TRAPDOOR==c:GetType()then s:RemoveGridEntity(i,0,false)end end for _,v in pairs(Isaac.FindByType(EntityType.ENTITY_EFFECT,EffectVariant.HEAVEN_LIGHT_DOOR,0))do v:Remove()end end end)

--11. 强制下妈腿。
l Isaac.AddCallback({},ModCallbacks.MC_POST_UPDATE,function(l,s,c,a,b)a=LevelStage l=Game():GetLevel()s=l:GetStage()c=0<LevelCurse.CURSE_OF_LABYRINTH&l:GetCurses()b=3>l:GetStageType()if not l:IsAscent()and(not b and(s==a.STAGE2_1 and c or s==a.STAGE2_2 and not c)or b and s==a.STAGE3_1 and not c)and GridRooms.ROOM_SECRET_EXIT_IDX==l:GetCurrentRoomIndex()then s=l:GetCurrentRoom()for i=0,s:GetGridSize()-1 do c=s:GetGridEntity(i)if c and GridEntityType.GRID_TRAPDOOR==c:GetType()then s:RemoveGridEntity(i,0,false)end end for _,v in pairs(Isaac.FindByType(EntityType.ENTITY_EFFECT,EffectVariant.HEAVEN_LIGHT_DOOR,0))do v:Remove()end end end)

--12. 从游戏中移除卡牌73(XVII-星星?)、魂石92(莉莉丝的魂石)。
l local b,Y,F,G={73,92},true,Isaac.AddCallback,Game()F({},31,function(_,p)for _,i in pairs(b)do for s=0,3 do if p:GetCard(s)==i then p:SetCard(s,0)end end end end)F({},37,function(r,f,v,s)if v==300 then repeat f=Y for _,i in pairs(b)do if i==s then f,r=false,G:GetRandomPlayer(Vector.Zero,0):GetCardRNG(REPENTANCE_PLUS and-1 or 0)s=G:GetItemPool():GetCard(r:GetSeed(),22<s and s<32,Y,31<s and s<42 or 55==s or 80<s)r:Next()break end end until f return{v,s}end end)

--12. 从游戏中移除饰品138('M)。
l local G,F,b=32768,Isaac.AddCallback,{138}F({},31,function(_,p)for _,i in pairs(b)do if p:HasTrinket(i)then p:TryRemoveTrinket(i)end end end)F({},37,function(_,f,v,s)if v==350 then repeat f=1 for _,i in pairs(b)do if i|G==s|G then f,s=0,Game():GetItemPool():GetTrinket()break end end until f>0 return{v,s}end end)

--13. 一分钟内未击败首层boss自动重开。
l Isaac.AddCallback({},ModCallbacks.MC_POST_UPDATE,function(l)l=Game():GetLevel()if not l:IsAscent()and 3>l:GetStageType()and LevelStage.STAGE1_1==l:GetStage()and 1800<Game():GetFrameCount()and not l:GetRooms():Get(l:GetLastBossRoomListIndex()).Clear then Isaac.ExecuteCommand'restart'end end)

--.
