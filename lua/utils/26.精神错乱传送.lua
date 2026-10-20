--精神错乱传送。

--[[
作为模板: true
模板id: delirium-teleport
说明: 如果本层存在，则传送玩家到精神错乱房间
]]
l local s,r=Game():GetLevel():GetRooms()for i=1,#s do r=s:Get(i-1)if r.Data.Name=='Delirium'then Game():StartRoomTransition(r.SafeGridIndex,Direction.NO_DIRECTION)break end end
