--精神错乱


---- 代码效果 ----

--===--

--[[
模板: random-items
说明: |-
  函数 RandomItems([BlackList]) 返回一个表，包含两个子表：Active和Passive，分别存储随机排序的主动道具和被动道具的道具ID列表。BlackList为可选参数，是一个包含不希望被选择的道具ID的黑名单表。
  道具列表中包含本局已经存在的错误道具。
名称: RandomItems
]]

--[[
模板: d4-reroll
说明: |-
  函数 D4(EntityPlayer[,BlackList]) 移除玩家身上的所有道具，并随机给予相同数量的随机道具(主动道具1个，其余为被动道具)。该函数依赖函数原型 RandomItems([BlackList:table]) -> {Active={},Passive={}}。
名称: D4
依赖: [RandomItems]
]]

--[[
模板: random-trinkets
说明: |-
  函数 RandomTrinkets([BlackList]) 返回一个表,存储随机排序的饰品ID列表。BlackList为可选参数，是一个包含不希望被选择的饰品ID的黑名单表。
名称: RandomTrinkets
]]

--[[
模板: d4-trinket-reroll
说明: |-
  函数 D4_1(EntityPlayer[,BlackList]) 移除玩家身上的所有饰品，并随机给予相同数量的随机饰品。该函数依赖函数原型 RandomTrinkets([BlackList:table]) -> {}。
名称: D4_1
依赖: [RandomTrinkets]
]]

--[[
说明: |-
  房间未清理时，玩家每帧触发可兼容错误道具的 D4 效果。
  不会随机到：{P3}。
  不会随机到：{P4}。
依赖: [D4, D4_1]
参数定义:
  P1: {类型: 道具id黑名单, 默认: "59,122,584,703", 性质: 局部, 说明: "D4 不重随的道具id列表"}
  P2: {类型: 饰品id黑名单, 默认: "64,75,154,180", 性质: 局部, 说明: "D4_1 不重随的饰品id列表"}
  P3: {类型: 描述, 默认: "道具59(被动形式彼列之书)、道具122(巴比伦大淫妇)、道具584(美德之书)、道具703(小以扫)", 性质: 局部, 说明: "说明文本中的道具黑名单描述（对应P1）"}
  P4: {类型: 描述, 默认: "饰品64(彩虹蠕虫)、饰品75(错误)、饰品154(骰子袋)、饰品180(复得游魂)", 性质: 局部, 说明: "说明文本中的饰品黑名单描述（对应P2）"}
]]
l Isaac.AddCallback({},ModCallbacks.MC_POST_PLAYER_UPDATE,function(_,p)if not(Game():GetRoom():IsClear()or p:HasCurseMistEffect())then D4(p,{P1})D4_1(p,{P2})end end)

--[[
模板: remove-collectibles
参数:
  P1: "703"
  P2: "道具703(小以扫)。"
]]

--===--
--[[
模板: restart-game
]]

