--属性上限。

--[[
作为模板: true
模板id: stat-cap
说明: |-
  角色的下列属性不会超出限定的值（nil表示不做限制）。
参数:
  P1: {类型: "属性限值表", 默认: "['MoveSpeed']={min=nil,max=2.00,F='SPEED'},['MaxFireDelay']={min=nil,max=nil,F='FIREDELAY'},['Damage']={min=nil,max=nil,F='DAMAGE'},['TearRange']={min=nil,max=nil,F='RANGE'},['ShotSpeed']={min=nil,max=3.00,F='SHOTSPEED'},['Luck']={min=nil,max=nil,F='LUCK'},['SpriteScale']={min=nil,max=nil,F='SIZE'}", 性质: "局部", 说明: "7个属性键的min/max限值表，nil=不限"}
]]
l local A,M,V,T,E=Isaac.AddCallback,ModCallbacks,{P1},{}E=function(p,k,v)local l,r=v.min,v.max if l and l>p[k]then p[k]=l end if r and r<p[k]then p[k]=r end end A(T,M.MC_EVALUATE_CACHE,function(_,p,f)for k,v in pairs(V)do if f==CacheFlag['CACHE_'..v.F]then return E(p,k,v)end end end)A(T,M.MC_POST_PEFFECT_UPDATE,function(_,p)for k,v in pairs(V)do E(p,k,v)end end)
