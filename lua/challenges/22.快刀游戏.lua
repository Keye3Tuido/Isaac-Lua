--快刀游戏
--限定角色：堕化犹大


---- 代码效果 ----

--===--

--[[
模板: blind-permanent
说明: |-
  所有玩家永久蒙眼（在矿洞逃亡中不生效）。
]]

--[[
模板: force-give-items
参数:
  P1: "'c251','c467','c534','t88'"
  P2: "道具251(新手牌组)、467(手指)、534(书包)、饰品88(不!)"
]]

--[[
模板: give-start-collectibles
参数:
  P1: "116,{311,9},356,468,619"
  P2: "道具116(9伏特)、9*311(犹大的影子)、356(车载电池)、468(阴影)、619(长子权)。"
]]

--[[
模板: force-character
说明: |-
  强制角色为堕化犹大。
参数:
  P1: "PlayerType.PLAYER_JUDAS_B"
]]

--[[
模板: force-slot-switch
参数:
  P1: 90
  P2: "3秒"
]]

--===--
--[[
模板: restart-as-character
说明: |-
  以堕化犹大重开一局新游戏。
参数:
  P1: "PlayerType.PLAYER_JUDAS_B"
]]

