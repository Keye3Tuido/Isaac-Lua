--属性轮换。

--[[
作为模板: true
模板id: stats-switch
名称: 属性轮换
说明: |-
  角色的面板属性发生轮换：
  控制台输入lua STATS_SWITCH='123456'可以指定轮换次序，输入lua STATS_SWITCH=nil 可以取消轮换次序
  {P2}
参数:
  P1: {类型: "排列串", 默认: "'341265'", 性质: "全局", 说明: "行首全局变量STATS_SWITCH，6位排列串，nil=取消轮换"}
  P2: {类型: "描述", 默认: "如：STATS_SWITCH='341265' 表示将属性面板从上到下，依次替换为第3、4、1、2、6、5个属性，即：\n移速(1) <-> 攻击(3)\n射程(4) <-> 射速(2)\n弹速(5) <-> 幸运(6)", 性质: "局部", 说明: "说明文本中的排列串示例与含义描述，与P1排列串联动"}
]]
l STATS_SWITCH=P1 local A,B,C,D,E,F,G,H,I,J,Z,Y,X,W,V=Isaac,ModCallbacks.MC_EVALUATE_CACHE,CacheFlag,'MoveSpeed','MaxFireDelay','Damage','TearRange','ShotSpeed','Luck',ipairs Z=A.AddCallback Y=A.RemoveCallback X=function(p)p:AddCacheFlags(C.CACHE_ALL)p:EvaluateItems()end W={{k=D,f=C.CACHE_SPEED,b=-1,i=function(p,i)p[D]=i end,o=function(p)return p[D]end},{k=E,f=C.CACHE_FIREDELAY,b=0,i=function(p,i)p[E]=30/i-1 end,o=function(p)return 30/(p[E]+1)end},{k=F,f=C.CACHE_DAMAGE,b=0,i=function(p,i)p[F]=i end,o=function(p)return p[F]end},{k=G,f=C.CACHE_RANGE,b=0,i=function(p,i)p[G]=40*i end,o=function(p)return p[G]/40 end},{k=H,f=C.CACHE_SHOTSPEED,b=0,i=function(p,i)p[H]=i end,o=function(p)return p[H]end},{k=I,f=C.CACHE_LUCK,b=-1/0,i=function(p,i)p[I]=i end,o=function(p)return p[I]end}}Z({},B,function(a,p,t,f)t=STATS_SWITCH if t and not V then V=p a={}f=function(_,e,h)for _,v in J(W)do if h==v.f then a[v.k]=v.o(e)v.i(e,v.b)end end end Z(a,B,f)X(p)Y(a,B,f)f=function(_,e,h)for k,v in J(W)do if h==v.f then v.i(e,a[W[tonumber(string.sub(t,k,k))].k])end end end Z(a,B,f)X(p)Y(a,B,f)V=nil end end)
