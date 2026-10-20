--初始道具给予。

--[[
作为模板: true
模板id: give-start-collectibles
说明: |-
  初始给予玩家{P2}
参数:
  P1: {类型: "道具列表", 默认: "116,{311,9},356,468,619", 性质: "局部", 说明: "道具id或{id,数量}的列表"}
  P2: {类型: "物品描述", 默认: "道具116(9伏特)、9*311(犹大的影子)、356(车载电池)、468(阴影)、619(长子权)。", 性质: "局部", 说明: "说明文本中的物品描述部分"}
]]
l local I,G=Isaac,Game()I.AddCallback({},15,function(p,c,t,n)if not c then for _,i in pairs{P1}do for k=1,G:GetNumPlayers()do p,t,n=I.GetPlayer(k-1),table.unpack(type(i)=='table'and i or{i,1})for _=1,n do p:AddCollectible(t,I.GetItemConfig():GetCollectible(t).InitCharge)end end G:GetItemPool():RemoveCollectible(t)end end end)
