--强制副手道具。

--[[
作为模板: true
模板id: force-pocket-active
说明: 强制角色副手道具为道具{P2}。
参数:
  P1: {类型: "道具id", 默认: "485", 性质: "全局", 说明: "行首全局变量POCKET，副手主动道具id"}
  P2: {类型: "描述", 默认: "485（掰弯的硬币）", 性质: "局部", 说明: "说明文本中的副手道具描述"}
]]
l POCKET=P1;Isaac.AddCallback({},ModCallbacks.MC_POST_PLAYER_UPDATE,function(c,p,s)c=POCKET s=ActiveSlot.SLOT_POCKET if c~=p:GetActiveItem(s)then p:SetPocketActiveItem(c,s)end end,0)
