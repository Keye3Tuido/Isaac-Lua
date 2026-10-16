--角色与玩家属性：角色锁定、面板属性与角色状态。

--[[
作为模板: true
模板id: lock-achievements
说明: |-
  游戏锁定成就。
]]
l Isaac.AddPriorityCallback({},ModCallbacks.MC_POST_GAME_STARTED,CallbackPriority.IMPORTANT,function(_,c)if not c then Isaac.ExecuteCommand('seed '..Seeds.Seed2String(Game():GetSeeds():GetNextSeed()))end end)

--[[
作为模板: true
模板id: blind-permanent
说明: |-
  所有玩家永久蒙眼（在矿洞逃亡中不生效）。
]]
l Isaac.AddCallback({},31,function(s,p,g,c,f)f=1 s='Challenge'g=Game()c=g[s]if p:HasCurseMistEffect()then g[s],f=0 p:TryRemoveNullCostume(14)elseif p:CanShoot()then g[s],f=6 p:AddNullCostume(14)end if not f then p:UpdateCanShoot()end g[s]=c end,0)

--[[
作为模板: true
模板id: force-character
名称: 锁定玩家类型
说明: |-
  强制角色为指定PlayerType。
参数:
  P1: {类型: "角色枚举", 默认: "PlayerType.PLAYER_THELOST", 性质: "局部", 说明: "PlayerType枚举值"}
]]
l Isaac.AddCallback({},ModCallbacks.MC_POST_PLAYER_UPDATE,function(_,p)local t=P1 if t~=p:GetPlayerType()then p:ChangePlayerType(t)end end,0)

--[[
作为模板: true
模板id: stat-cap
说明: |-
  角色的下列属性不会超出限定的值（nil表示不做限制）。
参数:
  P1: {类型: "属性限值表", 默认: "['MoveSpeed']={min=nil,max=2.00,F='SPEED'},['MaxFireDelay']={min=nil,max=nil,F='FIREDELAY'},['Damage']={min=nil,max=nil,F='DAMAGE'},['TearRange']={min=nil,max=nil,F='RANGE'},['ShotSpeed']={min=nil,max=3.00,F='SHOTSPEED'},['Luck']={min=nil,max=nil,F='LUCK'},['SpriteScale']={min=nil,max=nil,F='SIZE'}", 性质: "局部", 说明: "7个属性键的min/max限值表，nil=不限"}
]]
l local A,M,V,T,E=Isaac.AddCallback,ModCallbacks,{P1},{}E=function(p,k,v)local l,r=v.min,v.max if l and l>p[k]then p[k]=l end if r and r<p[k]then p[k]=r end end A(T,M.MC_EVALUATE_CACHE,function(_,p,f)for k,v in pairs(V)do if f==CacheFlag['CACHE_'..v.F]then return E(p,k,v)end end end)A(T,M.MC_POST_PEFFECT_UPDATE,function(_,p)for k,v in pairs(V)do E(p,k,v)end end)

--[[
作为模板: true
模板id: fly-permanent
说明: |-
  玩家永久飞行(矿洞逃亡中不生效)。
]]
l Isaac.AddCallback({},ModCallbacks.MC_EVALUATE_CACHE,function(e,p)if not p:HasCurseMistEffect()then p.CanFly=true e=CollectibleType.COLLECTIBLE_BIBLE p=p:GetEffects()if not p:HasCollectibleEffect(e)then p:AddCollectibleEffect(e)end end end,CacheFlag.CACHE_FLYING)

--[[
作为模板: true
模板id: gain-eden-tokens
说明: 在不锁定成就的游戏中输入这串代码，可获得{P2}个伊甸代币。
参数:
  P1: {类型: "数值", 默认: "1e3", 性质: "局部", 说明: "触发房间清空的次数（即获得的伊甸代币数量），1000=1e3"}
  P2: {类型: "描述", 默认: "1000", 性质: "局部", 说明: "说明文本中的伊甸代币数量显示值（1000=1e3）"}
]]
l local c,A,B,T,M,Y,W=Game,Isaac,ModCallbacks.MC_POST_UPDATE,{}Y=function()M.state=M.map[M.state]()or M.state end W=A.ExecuteCommand M={state=0,map={[0]=function()W'challenge 0'return 1 end,[1]=function()W'restart 0'return 2 end,[2]=function()W'stage 8'return 3 end,[3]=function(l)l=c():GetLevel()l:ChangeRoom(l:GetRooms():Get(l:GetLastBossRoomListIndex()).SafeGridIndex)return 4 end,[4]=function(a,b)A.RemoveCallback(T,B,Y)for _=1,P1 do c():GetRoom():TriggerClear()end c():FinishChallenge()c():Fadeout(9,2)return 5 end}}A.AddCallback(T,B,Y)

--[[
作为模板: true
模板id: no-hallucination-stack
说明: 保持致幻层数为0。
]]
l Isaac.AddCallback({},ModCallbacks.MC_POST_PLAYER_UPDATE,function(a,p,b)a=CollectibleType.COLLECTIBLE_WAVY_CAP b=NullItemID.ID_WAVY_CAP_1 p=p:GetEffects()p:RemoveCollectibleEffect(a,p:GetCollectibleEffectNum(a))p:RemoveNullEffect(b,p:GetNullEffectNum(b))end,0)

--[[
作为模板: true
模板id: angel-devil-convert
说明: |-
  所有天使/恶魔房都转化为指定类型房间。P1=true、P2=false转化为天使房；P1=false、P2=true转化为恶魔房。
参数:
  P1: {类型: "布尔", 默认: "true", 性质: "局部", 说明: "InitializeDevilAngelRoom第1参"}
  P2: {类型: "布尔", 默认: "false", 性质: "局部", 说明: "InitializeDevilAngelRoom第2参"}
]]
l Isaac.AddCallback({},ModCallbacks.MC_POST_NEW_LEVEL,function()Game():GetLevel():InitializeDevilAngelRoom(P1,P2)end)

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

--[[
作为模板: true
模板id: lazarus-no-revive
说明: 当角色为拉撒路时，转换角色为死亡的拉撒路。
]]
l Isaac.AddCallback({},ModCallbacks.MC_POST_PLAYER_UPDATE,function(_,p)if PlayerType.PLAYER_LAZARUS==p:GetPlayerType()then p:ChangePlayerType(PlayerType.PLAYER_LAZARUS2)end end,0)
