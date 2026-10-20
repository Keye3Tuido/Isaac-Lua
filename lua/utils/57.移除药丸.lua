--移除药丸。

--[[
作为模板: true
模板id: remove-pills
说明: |-
  从游戏中移除药丸{P2}。
参数:
  P1: {类型: "药丸id列表", 默认: "23", 性质: "局部", 说明: "要移除的药丸id列表"}
  P2: {类型: "描述", 默认: "23(我能永远看清)", 性质: "局部", 说明: "说明文本中的被移除药丸描述"}
]]
l local b,Y,N,F,G,P,E,L,T={P1},true,false,Isaac.AddCallback,Game(),'GetItemPool','GetPillEffect','GetPill',{}F(T,31,function(_,p,o)o=G[P](G)for _,i in pairs(b)do for s=0,3 do if o[E](o,p[L](p,s),p)==i then p:SetPill(s,0)end end end end)F(T,37,function(p,f,v,s,r)p=G[P](G)if v==70 then repeat f=Y for _,i in pairs(b)do if i==p[E](p,s)then f,r=N,G:GetRandomPlayer(Vector.Zero,0):GetPillRNG(REPENTANCE_PLUS and-1 or 0)s=p[L](p,r:GetSeed())r:Next()break end end until f return{v,s}end end)
