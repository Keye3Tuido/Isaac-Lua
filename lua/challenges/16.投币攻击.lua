--投币攻击
--角色限定：堕化店主


---- 代码效果 ----

--===--

--[[
模板: champion-force
说明: |-
  强制敌人变为精英怪(不包括6无敌变种和25彩虹变种)。
参数:
  P0: "1"
  P1: "1"
  P2: "1"
  P3: "1"
  P4: "1"
  P5: "1"
  P7: "1"
  P8: "1"
  P9: "1"
  P10: "1"
  P11: "1"
  P12: "1"
  P13: "1"
  P14: "1"
  P15: "1"
  P16: "1"
  P17: "1"
  P18: "1"
  P19: "1"
  P20: "1"
  P21: "1"
  P22: "1"
  P23: "1"
  P24: "1"
]]

--[[
模板: force-give-items
参数:
  P1: "'c202','c227','c295','c304','c416','c501','c590'"
  P2: "道具202(弥达斯之触)、227(小猪存钱罐)、295(魔术手指)、304(天秤座)、416(深口袋)、501(贪婪的胃袋)、590(水星)"
]]

--[[
说明: |-
  强制玩家变为{P3}，给予副手道具{P4}，移动速度变为金钱数量*0.003
参数定义:
  P1: {类型: 角色枚举, 默认: "PlayerType.PLAYER_KEEPER_B", 性质: 局部, 说明: "强制变更的角色（PlayerType枚举，堕化店主=PLAYER_KEEPER_B）"}
  P2: {类型: 道具枚举, 默认: "CollectibleType.COLLECTIBLE_GOLDEN_RAZOR", 性质: 局部, 说明: "给予的副手道具（CollectibleType枚举，金剃刀片=COLLECTIBLE_GOLDEN_RAZOR）"}
  P3: {类型: 描述, 默认: "堕化店主", 性质: 局部, 说明: "说明文本中的角色描述（对应P1）"}
  P4: {类型: 描述, 默认: "金剃刀片", 性质: 局部, 说明: "说明文本中的副手道具描述（对应P2）"}
]]
l local A,M,T=Isaac.AddCallback,ModCallbacks,{}A(T,M.MC_POST_PEFFECT_UPDATE,function(_,p)p.MoveSpeed=3e-3+3e-3*p:GetNumCoins()end)A(T,M.MC_POST_PLAYER_UPDATE,function(_,p)local k,c,s=P1,P2,ActiveSlot.SLOT_POCKET if k~=p:GetPlayerType()then p:ChangePlayerType(k)end if c~=p:GetActiveItem(s)then p:SetPocketActiveItem(c,s,true)end end)

--[[
模板: sticky-to-nickel
说明: |-
  黏币变为镍币
]]

--[[
模板: attract-coins
说明: |-
  角色吸引硬币
]]

--[[
说明: |-
  角色使用道具魔术手指的同时，在原地生成三滴眼泪；眼泪会追踪敌人，命中敌人后生成硬币
]]
l local A,M,T=Isaac.AddCallback,ModCallbacks,{T={}}A(T,M.MC_USE_ITEM,function(_,_,_,p)for _=1,3 do local t=p:FireTear(p.Position,Vector.Zero)t.TearFlags=t.TearFlags|TearFlags.TEAR_HOMING end end,CollectibleType.COLLECTIBLE_MAGIC_FINGERS)A(T,M.MC_POST_NEW_ROOM,function()T.T={}end)A(T,M.MC_PRE_TEAR_COLLISION,function(_,t,c)if c:IsVulnerableEnemy()and c:IsActiveEnemy(false)then T.T[t.InitSeed]=true end end)A(T,M.MC_POST_ENTITY_REMOVE,function(_,e)if T.T[e.InitSeed]then Isaac.Spawn(EntityType.ENTITY_PICKUP,PickupVariant.PICKUP_COIN,CoinSubType.COIN_PENNY,e.Position,Vector.Zero,nil)T.T[e.InitSeed]=nil end end,EntityType.ENTITY_TEAR)

--[[
模板: long-press-repeat
说明: |-
  长按道具键/副手键1s以上=连续多次按键
]]

--[[
模板: replace-collectibles
]]

--[[
说明: |-
  非主角色透明度降低为{P1}
参数定义:
  P1: {类型: 数值, 默认: "0.3", 性质: 局部, 说明: "非主角色的透明度（0~1）"}
]]
l Isaac.AddCallback({},ModCallbacks.MC_POST_PLAYER_RENDER,function(_,p)if p.Parent then local c=p.Color p.Color=Color(c.R,c.G,c.B,P1,c.RO,c.GO,c.BO)end end)

--===--
--[[
模板: restart-as-character
说明: |-
  以堕化店主重开一局新游戏。
参数:
  P1: "PlayerType.PLAYER_KEEPER_B"
]]

