--御灵术

--简要介绍
--玩家蒙眼，身边会生成小精灵自动攻击敌人，可用鼠标左键指定小精灵的优先攻击位置。
--小精灵兼容角色属性和泪弹特效，不兼容弹道数量和攻击方式。
--击败敌人会释放灵魂，灵魂会给敌人施加负面增益，给玩家提供属性增益。

---- 代码效果 ----

--===--
--[[
模板: safe-wrap-mec
名称: 安全包装
]]

--[[
说明: "启用安全包装。"
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
]]

--[[
模板: wisp-soul-system
参数:
  P1: ".37"
  P2: ".57"
  P3: "1e-3"
  P4: 20
]]

--[[
模板: multi-choice-spawn
说明: 游戏开始时根据玩家数生成道具653-“驱魔护符”。
参数: {P1: "'c653'", P2: "(道具653-驱魔护符)"}
]]

--[[
模板: mouse-pos-show
]]

--===--
--[[
模板: restart-game
]]
