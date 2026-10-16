--每层给予与生成：每层给予、多选生成与底座问号揭露。

--[[
作为模板: true
模板id: on-question-init
说明: 提供全局接口OnQuestionInit(entityPickup)，将底座问号道具{P2}。
参数: 
  P1: 
    类型: 函数体
    默认: local s=p:GetSprite()s:ReplaceSpritesheet(1,Isaac.GetItemConfig():GetCollectible(p.SubType).GfxFileName)s:LoadGraphics()
    性质: 全局
    说明: 在问号道具初始化时执行的操作，参数p表示掉落物实体
  P2:
    类型: 描述
    默认: 揭露贴图
    性质: 局部
    说明: 说明文本中的功能描述
]]
l function OnQuestionInit(p)P1 end;local a,S=Vector,Sprite()S:Load'gfx/005.100_collectible.anm2'S:ReplaceSpritesheet(1,'gfx/items/collectibles/questionmark.png')S:LoadGraphics()Isaac.AddCallback({},ModCallbacks.MC_POST_PICKUP_UPDATE,function(s,p,x,y)if p.FrameCount==1 then s=p:GetSprite()S:SetFrame(s:GetAnimation(),s:GetFrame())for i=-16,16,4 do for j=-38,-6,4 do x=s:GetTexel(a(i,j),a.Zero,1,1)y=S:GetTexel(a(i,j),a.Zero,1,1)if x.Alpha~=y.Alpha or x.Red~=y.Red or x.Green~=y.Green or x.Blue~=y.Blue then return end end end OnQuestionInit(p)end end,PickupVariant.PICKUP_COLLECTIBLE)

--[[
作为模板: true
模板id: multi-choice-spawn
说明: |-
  每开启新游戏时，在初始房间根据玩家人数n，生成n组多选一道具{P2}
参数:
  P1: {类型: "道具id列表", 默认: "87,229,233", 性质: "局部", 说明: "每组多选一的候选道具id列表"}
  P2: {类型: "描述", 默认: "(87-洛基的角,229-萌死戳的肺,233-小小星球)", 性质: "局部", 说明: "说明文本中的候选道具描述"}
]]
l local V,g,N=Vector,{P1}Isaac.AddCallback({},15,function(_,c)local n,x,y=Game():GetNumPlayers()if not c then x,y=(720-#g*80)/2,(640-n*80)/2 for i=1,n do for j=1,#g do Isaac.Spawn(5,100,g[j],V(x+80*(j-1),y),V.Zero,N):ToPickup().OptionsPickupIndex=i end y=y+80 end end end)

--[[
作为模板: true
模板id: per-floor-spawn-collectibles
说明: |-
  每层在初始房间生成{P2}。
  离开房间后道具消失。
参数:
  P1: {类型: "道具列表", 默认: "247,{612,2}", 性质: "局部", 说明: "道具id或{id,数量}的列表"}
  P2: {类型: "描述", 默认: "1*道具247-好朋友一辈子!、2*道具612-迷失游魂", 性质: "局部", 说明: "说明文本中的生成道具描述"}
]]
l local Items={P1}local I=Isaac I.AddCallback({},ModCallbacks.MC_POST_NEW_LEVEL,function()for k,v in pairs(Items)do local c,n=table.unpack(type(v)=='table'and v or{v,1})for i=1,n*(0<LevelCurse.CURSE_OF_LABYRINTH&Game():GetLevel():GetCurses()and 2 or 1)do I.Spawn(EntityType.ENTITY_PICKUP,PickupVariant.PICKUP_COLLECTIBLE,c,I.GetFreeNearPosition(Game():GetRoom():GetCenterPos(),0),Vector.Zero,nil):ToPickup().Timeout=9e9 end end end)

--[[
作为模板: true
模板id: per-floor-give-collectibles
说明: |-
  每层给予所有玩家{P2}。
参数:
  P1: {类型: "道具列表", 默认: "247,{612,2}", 性质: "局部", 说明: "道具id或{id,数量}的列表"}
  P2: {类型: "描述", 默认: "1*道具247-好朋友一辈子!、2*道具612-迷失游魂", 性质: "局部", 说明: "说明文本中的给予道具描述"}
]]
l local Items={P1}local I=Isaac I.AddCallback({},ModCallbacks.MC_POST_NEW_LEVEL,function()for x=1,Game():GetNumPlayers()do local p,c,n=I.GetPlayer(x-1)for k,v in pairs(Items)do c,n=table.unpack(type(v)=='table'and v or{v,1})for i=1,n*(0<LevelCurse.CURSE_OF_LABYRINTH&Game():GetLevel():GetCurses()and 2 or 1)do p:AddCollectible(c,I.GetItemConfig():GetCollectible(c).InitCharge)end end end end)
