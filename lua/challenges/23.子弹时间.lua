--子弹时间
--推荐攻击方式：眼泪攻击


---- 代码效果 ----

--===--

--[[
模板: force-give-items
参数:
  P1: "'c48','c221','c282','t149'"
  P2: "道具48(丘比特之箭)、221(橡胶胶水)、282(跳跃教程)、饰品149(紧急按钮)"
]]

--[[
模板: time-scale-monitor
说明: |-
  实时监测游戏帧率，可使用指令：lua SetTimeScale(数值) 来设置游戏速率(默认1，最小0)。
  GetTimeScale()可获取{[1]=当前渲染帧倍率,[2]=当前逻辑帧倍率}。
  由于监测数据和调控速率之间存在延迟，实际效果与预期效果会有一定偏差。
名称: 时间倍率监控
]]

--[[
说明: |-
  游戏{P2}倍速运行。
  可通过指令 lua TimeScale = 数值 来调整默认游戏速率(默认{P2}倍)。
  紧急按钮触发主动道具时，将会进入子弹时间状态 {P1} 秒。
  可通过指令 lua BulletTime = 数值 来调整子弹时间的持续时间(默认{P1}秒)。
依赖: [时间倍率监控]
参数定义:
  P1: {类型: 数值, 默认: 5, 性质: 全局, 说明: "全局变量BulletTime，子弹时间持续秒数（默认5）"}
  P2: {类型: 数值, 默认: '1.5', 性质: 全局, 说明: "全局变量TimeScale，默认游戏速率倍率（默认1.5）"}
]]
l BulletTime=P1;TimeScale=P2;local A,B,C,I,M,T=Isaac.AddCallback,TimeScale,ButtonAction,Input.IsActionTriggered,ModCallbacks,{}A(T,M.MC_PRE_USE_ITEM,function(_,_,_,p)local x=p.ControllerIndex if not(I(C.ACTION_ITEM,x)or I(C.ACTION_PILLCARD,x))then B=.1 end end)A(T,M.MC_POST_UPDATE,function()local t=TimeScale SetTimeScale(B<t and B or t)if B<t then B=B+.03/BulletTime end end)

--[[
模板: champion-force
说明: |-
  强制非精英敌人变为精英怪(仅包括10粉色变种，“0”和“1”可替换为非负整数表示权重)。
参数:
  P0: "0"
  P1: "0"
  P2: "0"
  P3: "0"
  P4: "0"
  P5: "0"
  P6: "0"
  P7: "0"
  P8: "0"
  P9: "0"
  P10: "1"
  P11: "0"
  P12: "0"
  P13: "0"
  P14: "0"
  P15: "0"
  P16: "0"
  P17: "0"
  P18: "0"
  P19: "0"
  P20: "0"
  P21: "0"
  P22: "0"
  P23: "0"
  P24: "0"
  P25: "0"
  P26: "按权重表强制非精英敌人变为指定类型精英怪（表中0和1可替换为非负整数表示权重，0=排除）。"
]]

--[[
说明: |-
  角色受到惩罚伤害时,会清除所有投射物。
]]
l local function Action(p,a,f,s,c)for k,v in pairs(Isaac.FindByType(EntityType.ENTITY_PROJECTILE))do v:Remove()end end;local D,E=DamageFlag,EntityType Isaac.AddCallback({},ModCallbacks.MC_ENTITY_TAKE_DMG,function(_,e,a,f,s,c)e=e:ToPlayer()if e:GetPlayerType()==PlayerType.PLAYER_JACOB_B and s.Type==E.ENTITY_DARK_ESAU or 0<f&(D.DAMAGE_RED_HEARTS|D.DAMAGE_IV_BAG|D.DAMAGE_FAKE|D.DAMAGE_NO_PENALTIES)then return end Action(e,a,f,s,c)end,E.ENTITY_PLAYER)

--[[
说明: |-
  泪弹尺寸固定为{P1}。投射物更加危险。
参数定义:
  P1: {类型: 数值, 默认: "1", 性质: 局部, 说明: "泪弹尺寸缩放（t.Scale）"}
]]
l local A,C,D,E,F,G,M,T=Isaac.AddCallback,ProjectileFlags,{'CHANGE_FLAGS_AFTER_TIMEOUT','CHANGE_VELOCITY_AFTER_TIMEOUT'},table,{},'InitSeed',ModCallbacks,{}for k,v in pairs(C)do E.insert(F,v)for i,j in pairs(D)do if k==j then E.remove(F,#F)end end end A(T,M.MC_POST_FIRE_TEAR,function(_,t)t.Scale=P1 end)A(T,M.MC_POST_PROJECTILE_INIT,function(_,p)for i=1,2 do p:AddProjectileFlags(F[p[G]*i%#F+1])end end)

--[[
模板: stat-cap
说明: |-
  角色的下列属性不会超出限定的值（nil表示不做限制）：射击延迟(nil~0.1)；攻击力(100~nil)
参数:
  P1: "['MoveSpeed']={min=nil,max=nil,F='SPEED'},['MaxFireDelay']={min=299,max=nil,F='FIREDELAY'},['Damage']={min=100,max=nil,F='DAMAGE'},['TearRange']={min=nil,max=nil,F='RANGE'},['ShotSpeed']={min=nil,max=nil,F='SHOTSPEED'},['Luck']={min=nil,max=nil,F='LUCK'},['SpriteScale']={min=nil,max=nil,F='SIZE'}"
]]

--[[
模板: tear-variant-force
说明: |-
  玩家的泪弹强制变为橡皮擦
参数:
  P1: "TearVariant.ERASER"
]]

--===--
--[[
模板: restart-game
说明: |-
  重开一局新游戏。
]]

