--炸膛大炮
--禁用Goodtrip等传送类模组

--[[
说明: |-
 玩家受伤（检测无敌帧重置，不检测实际受伤）时，执行OnHit函数(参数：玩家实体)。
 不兼容拉撒路的绷带、拉撒路的魂石
名称: 命中检测
模板: on-hit-detect
]]

--[[
说明: |-
  有Fatal(默认{P1})%概率的房间，玩家受伤（无敌帧被重置）即死。这些房间内玩家攻击力翻倍。
依赖: [命中检测]
参数定义:
  P1: {类型: 数值, 默认: 50, 性质: 全局, 说明: 即死房间概率百分数}
]]
l Fatal=P1;local B,C,I,M,S,G,R,L,D,K,A=Sprite(),CacheFlag.CACHE_DAMAGE,Isaac,ModCallbacks,'!!!'B:Load('gfx/ui/loading.anm2',true)B:Play('1',true)B.Scale=Vector.One*9 B.Color=Color(0,0,0,.3,.5)A=I.AddCallback;A({},M.MC_POST_RENDER,function(d,e,f)G=Game()L=G:GetLevel()e=DoorVariant D=function(i)return L:GetRoomByIdx(i).DecorationSeed%100<Fatal end K=D(L:GetCurrentRoomIndex())R=G:GetRoom()for i=0,7 do d=R:GetDoor(i)f=d and d:GetVariant()if d and e.DOOR_HIDDEN~=f and e.DOOR_UNSPECIFIED~=f and D(d.TargetRoomIndex)then d=I.WorldToRenderPosition(d.Position)+R:GetRenderScrollOffset()d.X=R:IsMirrorWorld()and I.GetScreenWidth()-d.X or d.X I.RenderText(S,d.X-I.GetTextWidth(S)/2,d.Y-5,1,0,0,1)end end if K then B:RenderLayer(0,Vector.Zero)end end)A({},M.MC_EVALUATE_CACHE,function(_,p)if K then p.Damage=p.Damage*2 end end,C)A({},M.MC_POST_PLAYER_UPDATE,function(_,p)p:AddCacheFlags(C)p:EvaluateItems()end)OnHit=function(p)if K then p:Die()end end

--[[
说明: 免疫混乱诅咒。
]]
l local F=Isaac.AddCallback F({},10,function()Game():GetLevel():RemoveCurses(32)end,31)F({},12,function(_,c)return~32&c end)

--[[
模板: blind-permanent
]]

--[[
模板: force-give-items
参数:
  P1: "'c63','c116','c352'"
  P2: "道具63(蓄电池)、116(9伏特)、352(玻璃大炮)"
]]

--[[
说明: 玩家主手持有的道具为破碎的玻璃大炮时，自动充能。
]]
l Isaac.AddCallback({},ModCallbacks.MC_POST_PLAYER_UPDATE,function(s,p)s=ActiveSlot.SLOT_PRIMARY if CollectibleType.COLLECTIBLE_BROKEN_GLASS_CANNON==p:GetActiveItem(s)then p:FullCharge(s)end end)

--[[
模板: give-start-collectibles
参数:
  P1: "352"
  P2: "道具352(玻璃大炮)。"
]]

--[[
模板: teleport-pill-reveal
]]

--[[
模板: restart-game
]]
