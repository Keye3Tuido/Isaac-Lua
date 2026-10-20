--拾取触发主动道具。

--[[
作为模板: true
模板id: pickup-trigger-active
说明: 玩家拾取非任务道具时，自动触发道具{P2}效果。
参数:
  P1: {类型: "道具id", 默认: "706", 性质: "局部", 说明: "拾取非任务道具时触发使用的主动道具id"}
  P2: {类型: "描述", 默认: "706-无底坑", 性质: "局部", 说明: "说明文本中的触发道具描述"}
]]
l Isaac.AddCallback({},ModCallbacks.MC_POST_PLAYER_UPDATE,function(i,p)i=p.QueuedItem.Item if not p:IsItemQueueEmpty()and i:IsCollectible()and not i:HasTags(ItemConfig.TAG_QUEST)then p:UseActiveItem(P1)end end,0)
