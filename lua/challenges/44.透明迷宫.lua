--透明迷宫

--[[
说明: |-
  角色看不见除了 红色大便、地刺、炸药桶和刺石头 以外的所有障碍物
]]
l local A,B,C=Isaac.AddCallback,ModCallbacks,function(r,g,t)r=Game():GetRoom()for i=1,r:GetGridSize()do g=r:GetGridEntity(i-1)if g then t=g:GetType()if t==14 and 1==g:GetVariant()then g=nil else for _,v in pairs{8,9,12,25}do if v==g:GetType()then g=nil break end end end if g then g:GetSprite().Scale=Vector(0,0)end end end end A({},B.MC_POST_NEW_ROOM,C)A({},B.MC_POST_UPDATE,C)

--[[
说明: 角色无法飞行
]]
l Isaac.AddCallback({},ModCallbacks.MC_EVALUATE_CACHE,function(_,p)p.CanFly=false end,CacheFlag.CACHE_FLYING)

--[[
模板: remove-collectibles
参数:
  P1: '302,314'
  P2: '道具302(狮子座)和道具314(霹雳大腿)'
]]

--[[
模板: remove-cards
参数: 
  P1: "10"
  P2: "卡牌10(倒吊人)"
]]

--[[
模板: seed-fixed
说明: 彩蛋种子: 无尽混乱、摆脱迷途
参数: 
  P1: 'SeedEffect.SEED_PERMANENT_CURSE_MAZE,SeedEffect.SEED_PREVENT_CURSE_UNKNOWN'
]]

--[[
说明: 玩家无法记忆地图
]]
l local A,B,C=Isaac.AddCallback,ModCallbacks,function(l,s,r)l=Game():GetLevel()s=l:GetRooms()for i=1,#s do r=l:GetRoomByIdx(s:Get(i-1).SafeGridIndex)r.DisplayFlags=RoomDescriptor.DISPLAY_NONE end l:UpdateVisibility()end A({},B.MC_POST_NEW_ROOM,C)A({},B.MC_POST_UPDATE,C)

--[[
模板: restart-game
]]