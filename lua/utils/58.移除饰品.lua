--移除饰品。

--[[
作为模板: true
模板id: remove-trinkets
名称: 移除饰品
说明: |-
  从游戏中移除饰品{P2}。
参数:
  P1: {类型: "饰品id列表", 默认: "85", 性质: "局部", 说明: "要移除的饰品id列表"}
  P2: {类型: "描述", 默认: "85(业报)", 性质: "局部", 说明: "说明文本中的被移除饰品描述"}
]]
l local G,F,b=32768,Isaac.AddCallback,{P1}F({},31,function(_,p)for _,i in pairs(b)do if p:HasTrinket(i)then p:TryRemoveTrinket(i)end end end,0)F({},37,function(_,f,v,s)if v==350 then repeat f=1 for _,i in pairs(b)do if i|G==s|G then f,s=0,Game():GetItemPool():GetTrinket()break end end until f>0 return{v,s}end end)
