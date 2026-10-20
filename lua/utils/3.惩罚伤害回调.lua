--惩罚伤害回调。

--[[
作为模板: true
模板id: punish-damage-action
说明: |-
  角色受到惩罚伤害时，执行Action函数（参数：玩家实体，伤害数值，伤害标签，伤害来源，受伤冷却）。Action为空占位，由使用方改写函数体。
参数:
  P1: {类型: 函数体, 性质: 局部, 默认: '', 说明: 函数体内容，默认空（空占位）}
]]
l local function Action(p,a,f,s,c)P1 end;local D,E=DamageFlag,EntityType Isaac.AddCallback({},ModCallbacks.MC_ENTITY_TAKE_DMG,function(_,e,a,f,s,c)e=e:ToPlayer()if e:GetPlayerType()==PlayerType.PLAYER_JACOB_B and s.Type==E.ENTITY_DARK_ESAU or 0<f&(D.DAMAGE_RED_HEARTS|D.DAMAGE_IV_BAG|D.DAMAGE_FAKE|D.DAMAGE_NO_PENALTIES)then return end Action(e,a,f,s,c)end,E.ENTITY_PLAYER)
