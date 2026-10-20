--问号道具初始化。

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
