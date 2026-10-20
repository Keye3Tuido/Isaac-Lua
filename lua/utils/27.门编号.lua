--门编号。

--[[
作为模板: true
模板id: door-id-map
名称: 门编号
说明: |-
  提供全局接口用于获取门的唯一编号：
  GetDoorId(GridIndex, RoomShape, DoorSlotId[, Dimension=0])->int 获取门编号；
  GetDim()->int 获取当前维度编号。
]]
l local a,S=GetPtrHash,{{0,1,2,28},{0,nil,2,nil},{nil,1,nil,28},{0,1,2,55,27,nil,29,nil},{nil,1,nil,55},{0,1,4,28,nil,3,nil,30},{0,nil,4,nil},{0,1,4,55,27,3,31,57},{2,28,4,55,27,3,31,57},{0,1,2,55,27,30,31,57},{0,1,4,28,29,3,31,57},{0,1,4,55,27,3,29,30}}function GetDoorId(i,s,r,d)if not d or d<0 then d=0 end return 2*(i%13)+27*(i//13)+S[s][r+1]+d*1e3 end function GetDim()local b=Game():GetLevel()local c=b:GetCurrentRoomIndex()for d=0,2 do if a(b:GetRoomByIdx(c,d))==a(b:GetRoomByIdx(c,-1))then return d end end end
