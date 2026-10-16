--伤害与命中回调：受伤/命中/眼泪相关的事件钩子。

--[[
作为模板: true
模板id: punish-damage-action
说明: |-
  角色受到惩罚伤害时，执行Action函数（参数：玩家实体，伤害数值，伤害标签，伤害来源，受伤冷却）。Action为空占位，由使用方改写函数体。
参数定义:
  P1: {类型: 函数体, 性质: 局部, 默认: '', 说明: 函数体内容，默认空（空占位）}
]]
l local function Action(p,a,f,s,c)P1 end;local D,E=DamageFlag,EntityType Isaac.AddCallback({},ModCallbacks.MC_ENTITY_TAKE_DMG,function(_,e,a,f,s,c)e=e:ToPlayer()if e:GetPlayerType()==PlayerType.PLAYER_JACOB_B and s.Type==E.ENTITY_DARK_ESAU or 0<f&(D.DAMAGE_RED_HEARTS|D.DAMAGE_IV_BAG|D.DAMAGE_FAKE|D.DAMAGE_NO_PENALTIES)then return end Action(e,a,f,s,c)end,E.ENTITY_PLAYER)

--[[
作为模板: true
模板id: tear-miss-action
说明: |-
  玩家的眼泪未命中实体时，执行Action函数（参数：眼泪实体）。Action为空占位，由使用方改写函数体。
参数定义:
  P1: {类型: 函数体, 性质: 局部, 默认: '', 说明: 函数体内容，默认空（空占位）}
]]
l local function Action(t)P1 end;local A,B,E,H,M,T,N=Isaac.AddCallback,{},EntityType,GetPtrHash,ModCallbacks,{}A(T,M.MC_POST_FIRE_TEAR,function(_,e)B[H(e)]=e.SpawnerType==E.ENTITY_PLAYER end)A(T,M.MC_POST_TEAR_UPDATE,function(_,t)local h,m,r,a,b=H(t),math,Game():GetRoom()a=m.max b=m.abs if B[h]then for i=0,r:GetGridSize()-1 do local g,p=r:GetGridEntity(i),r:GetGridPosition(i)if g then local s,e,v=g.State,GridEntityType,g:GetType()if(v==e.GRID_POOP and s~=1e3 or v==e.GRID_TNT and s~=4)then s=t.Position e=a(0,b(s.X-p.X)-20)v=a(0,b(s.Y-p.Y)-20)if m.ceil(t.Size)>=m.sqrt(e*e+v*v)then B[h]=N break end end end end end end)A(T,M.MC_PRE_TEAR_COLLISION,function(_,e)B[H(e)]=N end)A(T,M.MC_POST_ENTITY_REMOVE,function(_,e)local h=H(e)e=e:ToTear()if B[h]then Action(e)end B[h]=N end,E.ENTITY_TEAR)A(T,M.MC_POST_NEW_ROOM,function(t)t={}for k,v in pairs(B)do if v then t[k]=v end end B=t end)

--[[
作为模板: true
模板id: tear-variant-force
说明: |-
  将眼泪强制替换为指定TearVariant。
参数定义:
  P1: {类型: "眼泪变种枚举", 默认: "TearVariant.CHAOS_CARD", 性质: "局部", 说明: "TearVariant枚举值"}
]]
l Isaac.AddCallback({},ModCallbacks.MC_POST_TEAR_UPDATE,function(v,t)v=P1 if t.Variant~=v and t.SpawnerType==EntityType.ENTITY_PLAYER then t:ChangeVariant(v)end end)

--[[
作为模板: true
模板id: on-hit-detect
名称: 命中检测
说明: |-
  玩家受伤（检测无敌帧重置，不检测实际受伤）时，执行OnHit函数（参数：玩家实体）。OnHit为空占位，由下游代码重定义。不兼容拉撒路的绷带、拉撒路的魂石。
参数定义:
  P1: {类型: 函数体, 性质: 局部, 默认: '', 说明: 函数体内容，默认空（空占位）}
]]
l function OnHit(p)P1 end local B,H,I,M,T,A={},GetPtrHash,Isaac,ModCallbacks,{}A=I.AddCallback;A(T,M.MC_POST_PLAYER_UPDATE,function(t,p,h)t=p:GetDamageCooldown()h=H(p)if t>0 and not B[h]then B[h]=t OnHit(p)else B[h]=t>0 end end,0)A(T,M.MC_POST_ENTITY_REMOVE,function(_,e)e=e:ToPlayer()and H(e)if e then B[e]=nil end end,EntityType.ENTITY_PLAYER)
