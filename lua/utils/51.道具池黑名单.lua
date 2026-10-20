--道具池黑名单。

--[[
作为模板: true
模板id: pool-blacklist
说明: 抽取道具时不再抽取{P2}
参数:
  P1: {类型: 道具id列表, 默认: "360,698", 性质: 局部, 说明: 不再抽取的道具id列表（加入房间黑名单）}
  P2: {类型: 描述, 默认: "淫魔和作孽双子", 性质: 局部, 说明: 说明文本中的道具描述}
]]
l Isaac.AddCallback({},ModCallbacks.MC_PRE_GET_COLLECTIBLE,function()for _,c in pairs{P1}do Game():GetItemPool():AddRoomBlacklist(c)end end)
