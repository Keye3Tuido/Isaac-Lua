--现代战争


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
模板: seed-fixed
说明: |-
  固定开启下列彩蛋种子：G_FUEL。
参数:
  P1: "SeedEffect.SEED_G_FUEL"
]]

--[[
模板: stat-cap
说明: |-
  角色的下列属性不会超出限定的值（nil表示不做限制）：移速(nil~1.50)；弹速(nil~2.00)
参数:
  P1: "['MoveSpeed']={min=nil,max=1.50,F='SPEED'},['MaxFireDelay']={min=nil,max=nil,F='FIREDELAY'},['Damage']={min=nil,max=nil,F='DAMAGE'},['TearRange']={min=nil,max=nil,F='RANGE'},['ShotSpeed']={min=nil,max=2.00,F='SHOTSPEED'},['Luck']={min=nil,max=nil,F='LUCK'},['SpriteScale']={min=nil,max=nil,F='SIZE'}"
]]

--[[
模板: replace-collectibles
参数:
  P1: "-1"
  P2: "道具-1(-1号错误道具)"
]]

--[[
模板: give-start-collectibles
参数:
  P1: "20,48,96,98"
  P2: "道具20-超凡升天,48丘比特之箭,96-查德宝宝,98-圣遗物"
]]

--[[
模板: no-screen-shake
说明: |-
  取消屏幕晃动
]]

--===--
--[[
模板: restart-game
说明: |-
  重开一局新游戏。
]]
