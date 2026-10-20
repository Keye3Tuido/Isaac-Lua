--移除卡牌。

--[[
作为模板: true
模板id: remove-cards
说明: |-
  从游戏中移除{P2}
参数:
  P1: {类型: "卡牌符文id列表", 默认: "41,74,83", 性质: "局部", 说明: "要移除的卡牌/符文/魂石id列表"}
  P2: {类型: "描述", 默认: "符文41(黑符文)、卡牌74(月亮?)和魂石83(该隐的魂石)。", 性质: "局部", 说明: "说明文本中的被移除卡牌/符文/魂石描述"}
]]
l local b,Y,F,G={P1},true,Isaac.AddCallback,Game()F({},31,function(_,p)for _,i in pairs(b)do for s=0,3 do if p:GetCard(s)==i then p:SetCard(s,0)end end end end,0)F({},37,function(r,f,v,s)if v==300 then repeat f=Y for _,i in pairs(b)do if i==s then f,r=false,G:GetRandomPlayer(Vector.Zero,0):GetCardRNG(REPENTANCE_PLUS and-1 or 0)s=G:GetItemPool():GetCard(r:GetSeed(),22<s and s<32,Y,31<s and s<42 or 55==s or 80<s)r:Next()break end end until f return{v,s}end end)
