--风雨交加


---- 代码效果 ----

--===--
--[[
模板: safe-wrap-mec
名称: 安全包装
]]

--[[
说明: 启用安全包装。
依赖: [安全包装]
]]
l MEC()

--[[
模板: clean-anon-callbacks
名称: 清理回调
]]

--[[
说明: 游戏胜利后自动清除代码效果; 长按重开键10秒自动清空代码效果。
依赖: [安全包装, 清理回调]
]]
l CLM()local I,M,A,T,F=Isaac,ModCallbacks T=I.GetTime F=T()A=I.AddCallback A({},M.MC_POST_GAME_END,function(_,f)if not f then DEMEC()CLM()end end)A({},M.MC_POST_RENDER,function(p)p=T()for i=1,Game():GetNumPlayers()do if Input.IsActionPressed(ButtonAction.ACTION_RESTART,I.GetPlayer(i).ControllerIndex)then if p-F>=1e4 then DEMEC()CLM()Game():FinishChallenge()Game():Fadeout(1,2)end return end end F=p end)

--[[
模板: lock-achievements
]]

--===--

--[[
模板: room-wind
说明: |-
  房间中吹起微风，可在控制台输入lua Windy = 数值 来调整风力系数(默认25)。
  屏幕上方会显示当前房间的风力大小，风力大小和楼层数、房间难度和风力系数有关。
  风会从进入房间的门吹向其他门，实体会被风吹动。
参数:
  P1: 25
]]

--[[
模板: entity-inertia
说明: |-
  实体的加速度变小，可在控制台输入lua Inertia = 数值 来调整系数(默认30)。
  加速度变动为原先的Inertia%，Inertia取值范围0~100。
参数:
  P1: 30
]]

--[[
模板: thunder-flash
说明: |-
  屏幕变黑，周期性被照明，可在控制台输入lua Thunder = 数值 来调整照明时间(默认2秒)。
参数:
  P1: 2
]]

--[[
说明: |-
  播放雷声，房间中有雷声和雨滴效果，房间地面有积水效果。
]]
l local I,F,M,D,O,P,T,A=Isaac,'Flags',ModCallbacks,{'THUNDER'},RoomDescriptor,{'HAS_WATER','FLOODED'},{}A=I.AddCallback A(T,M.MC_POST_UPDATE,function()local S=SFXManager()for k,v in pairs(D)do local s=SoundEffect['SOUND_'..v]if not S:IsPlaying(s)then S:Play(s,1,0,false)end end for i=1,3 do I.Spawn(EntityType.ENTITY_EFFECT,EffectVariant.RAIN_DROP,0,I.GetRandomPosition(),Vector.Zero,nil):AddEntityFlags(EntityFlag.FLAG_PERSISTENT)end end)A(T,ModCallbacks.MC_POST_NEW_ROOM,function()local L,R=Game():GetLevel()R=L:GetRooms()for i=1,#R do local r=L:GetRoomByIdx(R:Get(i-1).SafeGridIndex)for k,v in pairs(P)do r[F]=O['FLAG_'..v]|r[F]end end end)

--===--
--[[
模板: restart-game
说明: |-
  重开一局新游戏。
]]
