--苍蝇大王
--限定角色：堕化亚玻伦

--[[
模板: blind-permanent
]]

--[[
模板: force-give-items
参数:
  P1: "'t25','t29','t86','t93','t94','t126',{'t169',3},'t185','t186'"
  P2: "饰品25(神秘糖果)、饰品29(鱼头)、饰品86(小幼虫)、饰品93(用过的尿布)、饰品94(鱼尾)、饰品126(腐烂硬币)、3x饰品169(儿童涂鸦)、饰品185(蟋蟀腿)、饰品186(亚玻伦的挚友)"
]]

--[[
模板: force-character
说明: 强制角色为堕化亚玻伦。
参数: {P1: "PlayerType.PLAYER_APOLLYON_B"}
]]

--[[
说明: 玩家的伤害值最终倍率减半。
]]
l Isaac.AddCallback({},ModCallbacks.MC_EVALUATE_CACHE,function(_,p)p.Damage=p.Damage/2 end,CacheFlag.CACHE_DAMAGE)

--[[
模板: restart-as-character
说明: 以堕化亚玻伦重开一局新游戏。
参数: {P1: "PlayerType.PLAYER_APOLLYON_B"}
]]
