--受伤检测。

--[[
作为模板: true
模板id: on-hit-detect
名称: 命中检测
说明: |-
  玩家受伤（检测无敌帧重置，不检测实际受伤）时，执行OnHit函数（参数：玩家实体）。OnHit为空占位，由下游代码重定义。不兼容拉撒路的绷带、拉撒路的魂石。
参数:
  P1: {类型: 函数体, 性质: 局部, 默认: '', 说明: 函数体内容，默认空（空占位）}
]]
l function OnHit(p)P1 end local B,H,I,M,T,A={},GetPtrHash,Isaac,ModCallbacks,{}A=I.AddCallback;A(T,M.MC_POST_PLAYER_UPDATE,function(t,p,h)t=p:GetDamageCooldown()h=H(p)if t>0 and not B[h]then B[h]=t OnHit(p)else B[h]=t>0 end end,0)A(T,M.MC_POST_ENTITY_REMOVE,function(_,e)e=e:ToPlayer()and H(e)if e then B[e]=nil end end,EntityType.ENTITY_PLAYER)
