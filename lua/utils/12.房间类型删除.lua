--房间类型删除。

--[[
作为模板: true
模板id: del-room-types
说明: |-
  删除每层的指定类型房间：{P2}。
参数:
  P1: {类型: "房间类型列表", 默认: "4,24", 性质: "局部", 说明: "RoomType枚举值列表"}
  P2: {类型: "描述", 默认: "宝箱房(类型为4)、星象房(类型为24)", 性质: "局部", 说明: "说明文本中的被删除房间类型描述"}
]]
l local Del={P1}local D,G,S,T='Data','GetRoomByIdx','SafeGridIndex','Type'Isaac.AddCallback({},ModCallbacks.MC_POST_NEW_LEVEL,function()local L,C,R,r=Game():GetLevel()C,R=L:GetCurrentRoomDesc(),L:GetRooms()for i=1,#R do r=R:Get(i-1)for k,v in pairs(Del)do if v==r[D][T]then L[G](L,r[S])[D]=C[D]break end end end L:UpdateVisibility()for i=0,8 do r=Game():GetRoom():GetDoor(i)if r then R=L[G](L,r.TargetRoomIndex)[D][T]if R~=r.TargetRoomType then r:SetRoomTypes(C[D][T],R)r:SetLocked(false)end end end end)
