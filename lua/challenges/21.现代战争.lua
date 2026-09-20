--现代战争


---- 代码效果 ----

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

