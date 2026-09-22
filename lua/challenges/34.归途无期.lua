--归途无期

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

---- 代码效果 ----

--===--
--[[
说明: 新游戏开始时，在初始房间生成铲柄、将计时器调整到{P3}，并直接传送到最后一个Boss房。
参数定义:
  P1: {类型: 整数, 默认: "300", 性质: 局部, 说明: "计时器调整时长（帧），10秒=300帧，代码中出现两处需同步"}
  P2: {类型: 整数, 默认: "550", 性质: 局部, 说明: "生成的掉落物变种id（550=铲柄）"}
  P3: {类型: 描述, 默认: "10秒", 性质: 局部, 说明: "说明文本中的计时器时长显示值（10秒=300帧）"}
]]
l Isaac.AddCallback({},ModCallbacks.MC_POST_GAME_STARTED,function(l,c)if not c then for i=1,Game():GetNumPlayers()do Isaac.GetPlayer(i).ControlsCooldown=P1 end repeat Game():Update()until P1<=Game():GetFrameCount()Isaac.Spawn(EntityType.ENTITY_PICKUP,PickupVariant.PICKUP_BROKEN_SHOVEL,P2,Game():GetRoom():GetCenterPos(),Vector.Zero,nil)l=Game():GetLevel()l:ChangeRoom(l:GetRooms():Get(l:GetLastBossRoomListIndex()).SafeGridIndex)end end)

--[[
说明: 不可拾取非任务道具和错误道具。
]]
l local a,A,B,C,D,X,Y,Z=PickupVariant.PICKUP_COLLECTIBLE,Isaac,ModCallbacks,function(c)return c and(c.ID<0 or not c:HasTags(ItemConfig.TAG_QUEST))end,'Collectible'Z=A.AddCallback Y=A.GetItemConfig()X='Get'..D Z({},B.MC_POST_PLAYER_UPDATE,function(i,p,c)if not p:IsItemQueueEmpty()then i=p.QueuedItem.Item if i:IsCollectible()and C(i)then A.Spawn(EntityType.ENTITY_PICKUP,a,i.ID,p.Position,Vector.Zero,p):ToPickup().Touched=true p:FlushQueueItem()end end i=Y[X..'s'](Y).Size repeat i=i-1 c=Y[X](Y,i)if C(c)then while p['Has'..D](p,i,true)do p['Remove'..D](p,i)end end until not c and i<0 end)Z({},B.MC_POST_PICKUP_UPDATE,function(_,e)if C(Y[X](Y,e.SubType))then e.Touched=true end if e.SubType==0 then e:Remove()end end,a)

--[[
说明: 献祭不再飞升。
]]
l local A,B,C,Z=Isaac,ModCallbacks,{}Z=A.AddCallback Z({},B.MC_POST_UPDATE,function(r,g,d,f)r=Game():GetRoom()if RoomType.ROOM_SACRIFICE==r:GetType()then for i=1,r:GetGridSize()do g=r:GetGridEntity(i-1)d='VarData'if g and g:ToSpikes()then f=g.Desc.SpawnSeed if C[f]then g[d]=0 elseif 10<g[d]then g[d]=0 C[f]=true end end end end end)Z({},B.MC_POST_NEW_LEVEL,function()C={}end)

--[[
说明: 妈腿层只能走回溯门。
]]
l Isaac.AddCallback({},ModCallbacks.MC_POST_UPDATE,function(l,s,c,a)a=LevelStage l=Game():GetLevel()s=l:GetStage()c=0<LevelCurse.CURSE_OF_LABYRINTH&l:GetCurses()if not l:IsAscent()and(s==a.STAGE3_1 and c or s==a.STAGE3_2 and not c)and GridRooms.ROOM_SECRET_EXIT_IDX~=l:GetCurrentRoomIndex()then s=l:GetCurrentRoom()for i=0,s:GetGridSize()-1 do c=s:GetGridEntity(i)if c and GridEntityType.GRID_TRAPDOOR==c:GetType()then s:RemoveGridEntity(i,0,false)end end for _,v in pairs(Isaac.FindByType(EntityType.ENTITY_EFFECT,EffectVariant.HEAVEN_LIGHT_DOOR,0))do v:Remove()end end end)

--[[
说明: 妈腿层秘密出口房间内，若玩家没有道具“钥匙碎片1”“钥匙碎片2”和“妈妈的铲子”，则活板门和天堂光柱都关闭。
]]
l Isaac.AddCallback({},ModCallbacks.MC_POST_UPDATE,function(l,s,c,a)a=LevelStage l=Game():GetLevel()s=l:GetStage()c=0<LevelCurse.CURSE_OF_LABYRINTH&l:GetCurses()if(s==a.STAGE3_1 and c or s==a.STAGE3_2 and not c)and GridRooms.ROOM_SECRET_EXIT_IDX==l:GetCurrentRoomIndex()then c=0 s={['KEY_PIECE_1']=1,['KEY_PIECE_2']=1,['MOMS_SHOVEL']=1}for i=1,Game():GetNumPlayers()do for k,v in pairs(s)do if v and Isaac.GetPlayer(i-1):HasCollectible(CollectibleType['COLLECTIBLE_'..k])then s[k]=nil c=c+1 end end if c>=3 then return end end s=l:GetCurrentRoom()for i=0,s:GetGridSize()-1 do c=s:GetGridEntity(i)if c and GridEntityType.GRID_TRAPDOOR==c:GetType()then c.State=0 c:GetSprite():Play('Closed',true)end end for _,v in pairs(Isaac.FindByType(EntityType.ENTITY_EFFECT,EffectVariant.HEAVEN_LIGHT_DOOR,0))do v:ToEffect().State=0 v:GetSprite():Play('Appear',true)end end end)

--[[
说明: 第一层必须拿到铲柄才能下层。
]]
l Isaac.AddCallback({},ModCallbacks.MC_POST_UPDATE,function(l,s,c)l=Game():GetLevel()if not l:IsAscent()and 3>l:GetStageType()and LevelStage.STAGE1_1==l:GetStage()then for i=1,Game():GetNumPlayers()do if Isaac.GetPlayer(i-1):HasCollectible(CollectibleType.COLLECTIBLE_BROKEN_SHOVEL_1)then return end end s=l:GetCurrentRoom()for i=0,s:GetGridSize()-1 do c=s:GetGridEntity(i)if c and GridEntityType.GRID_TRAPDOOR==c:GetType()then c.State=0 c:GetSprite():Play('Closed',true)end end for _,v in pairs(Isaac.FindByType(EntityType.ENTITY_EFFECT,EffectVariant.HEAVEN_LIGHT_DOOR,0))do v:ToEffect().State=0 v:GetSprite():Play('Appear',true)end end end)

--[[
说明: 水层必须拿到刀把才能下层。
]]
l Isaac.AddCallback({},ModCallbacks.MC_POST_UPDATE,function(l,s,c,a)l=Game():GetLevel()a=LevelStage s=l:GetStage()c=0<LevelCurse.CURSE_OF_LABYRINTH&l:GetCurses()if not l:IsAscent()and 3<l:GetStageType()and(s==a.STAGE1_1 and c or s==a.STAGE1_2 and not c)then for i=1,Game():GetNumPlayers()do if Isaac.GetPlayer(i-1):HasCollectible(CollectibleType.COLLECTIBLE_KNIFE_PIECE_1)then return end end s=l:GetCurrentRoom()for i=0,s:GetGridSize()-1 do c=s:GetGridEntity(i)if c and GridEntityType.GRID_TRAPDOOR==c:GetType()then c.State=0 c:GetSprite():Play('Closed',true)end end for _,v in pairs(Isaac.FindByType(EntityType.ENTITY_EFFECT,EffectVariant.HEAVEN_LIGHT_DOOR,0))do v:ToEffect().State=0 v:GetSprite():Play('Appear',true)end end end)

--[[
说明: 矿层必须拿到刀头才能下层。
]]
l Isaac.AddCallback({},ModCallbacks.MC_POST_UPDATE,function(l,s,c,a)l=Game():GetLevel()a=LevelStage s=l:GetStage()c=0<LevelCurse.CURSE_OF_LABYRINTH&l:GetCurses()if not l:IsAscent()and 3<l:GetStageType()and(s==a.STAGE2_1 and c or s==a.STAGE2_2 and not c)then for i=1,Game():GetNumPlayers()do if Isaac.GetPlayer(i-1):HasCollectible(CollectibleType.COLLECTIBLE_KNIFE_PIECE_2)then return end end s=l:GetCurrentRoom()for i=0,s:GetGridSize()-1 do c=s:GetGridEntity(i)if c and GridEntityType.GRID_TRAPDOOR==c:GetType()then c.State=0 c:GetSprite():Play('Closed',true)end end for _,v in pairs(Isaac.FindByType(EntityType.ENTITY_EFFECT,EffectVariant.HEAVEN_LIGHT_DOOR,0))do v:ToEffect().State=0 v:GetSprite():Play('Appear',true)end end end)

--[[
说明: 强制下水。
]]
l Isaac.AddCallback({},ModCallbacks.MC_POST_UPDATE,function(l,s,c,a)a=LevelStage l=Game():GetLevel()s=l:GetStage()c=0<LevelCurse.CURSE_OF_LABYRINTH&l:GetCurses()if not l:IsAscent()and 3>l:GetStageType()and(s==a.STAGE1_1 and c or s==a.STAGE1_2 and not c)and GridRooms.ROOM_SECRET_EXIT_IDX~=l:GetCurrentRoomIndex()then s=l:GetCurrentRoom()for i=0,s:GetGridSize()-1 do c=s:GetGridEntity(i)if c and GridEntityType.GRID_TRAPDOOR==c:GetType()then s:RemoveGridEntity(i,0,false)end end for _,v in pairs(Isaac.FindByType(EntityType.ENTITY_EFFECT,EffectVariant.HEAVEN_LIGHT_DOOR,0))do v:Remove()end end end)

--[[
说明: 强制下矿。
]]
l Isaac.AddCallback({},ModCallbacks.MC_POST_UPDATE,function(l,s,c,a)a=LevelStage l=Game():GetLevel()s=l:GetStage()c=0<LevelCurse.CURSE_OF_LABYRINTH&l:GetCurses()if not l:IsAscent()and 3>l:GetStageType()and(s==a.STAGE2_1 and c or s==a.STAGE2_2 and not c)and GridRooms.ROOM_SECRET_EXIT_IDX~=l:GetCurrentRoomIndex()then s=l:GetCurrentRoom()for i=0,s:GetGridSize()-1 do c=s:GetGridEntity(i)if c and GridEntityType.GRID_TRAPDOOR==c:GetType()then s:RemoveGridEntity(i,0,false)end end for _,v in pairs(Isaac.FindByType(EntityType.ENTITY_EFFECT,EffectVariant.HEAVEN_LIGHT_DOOR,0))do v:Remove()end end end)

--[[
说明: 强制下妈腿。
]]
l Isaac.AddCallback({},ModCallbacks.MC_POST_UPDATE,function(l,s,c,a,b)a=LevelStage l=Game():GetLevel()s=l:GetStage()c=0<LevelCurse.CURSE_OF_LABYRINTH&l:GetCurses()b=3>l:GetStageType()if not l:IsAscent()and(not b and(s==a.STAGE2_1 and c or s==a.STAGE2_2 and not c)or b and s==a.STAGE3_1 and not c)and GridRooms.ROOM_SECRET_EXIT_IDX==l:GetCurrentRoomIndex()then s=l:GetCurrentRoom()for i=0,s:GetGridSize()-1 do c=s:GetGridEntity(i)if c and GridEntityType.GRID_TRAPDOOR==c:GetType()then s:RemoveGridEntity(i,0,false)end end for _,v in pairs(Isaac.FindByType(EntityType.ENTITY_EFFECT,EffectVariant.HEAVEN_LIGHT_DOOR,0))do v:Remove()end end end)

--[[
模板: remove-cards
参数: {P1: "73,92", P2: "卡牌73(XVII-星星?)、魂石92(莉莉丝的魂石)。"}
]]

--[[
模板: remove-trinkets
参数: {P1: "138,154", P2: "138('M)、饰品154(骰子袋)"}
]]

--[[
说明: 一分钟内停留在首层，且未击败首层boss自动重开。
]]
l local a,d,A=ModCallbacks,Isaac.AddCallback d({},a.MC_POST_UPDATE,function(l)l=Game():GetLevel()A=A or l:GetRooms():Get(l:GetLastBossRoomListIndex()).Clear if not l:IsAscent()and 3>l:GetStageType()and LevelStage.STAGE1_1==l:GetStage()and 1800<Game():GetFrameCount()and not A then Isaac.ExecuteCommand'restart'end end)d({},a.MC_POST_GAME_STARTED,function(_,c)if not c then A=nil end end)

--[[
说明: 每局新游戏开始时，所有玩家失去一个炸弹。
]]
l Isaac.AddCallback({},ModCallbacks.MC_POST_GAME_STARTED,function(_,c)if not c then Isaac.GetPlayer():AddBombs(-Game():GetNumPlayers())end end)

--===--
--[[
模板: restart-game
]]

