--快刀游戏
--限定角色：堕化犹大


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
