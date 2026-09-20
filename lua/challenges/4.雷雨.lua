--雷雨

---- 代码效果 ----

--===--

--[[
模板: blind-permanent
]]

--[[
说明: "每秒随机天降火箭,落地处生成可投掷的手雷。火箭数量为每个玩家的运气的绝对值+1的总和，每位玩家运气触发上限为{P1}"
参数定义:
  P1: {类型: 整数, 默认: "30", 性质: 局部, 说明: "每位玩家的运气触发上限（仅 math.min 处；代码中其余 30 为效果变种与超时帧数，语义不同，保持字面量）"}
]]
l local I,F,G,Z,M,N=Isaac,Isaac.AddCallback,GetPtrHash,Vector.Zero,{}F({},31,function(_,s)local t,r,p=math.abs(s.Luck)if(I.GetFrameCount()%60<=math.min(t,P1))then p=I.GetRandomPosition()I.Spawn(1e3,30,0,p,Z,s):ToEffect().Timeout=30 r=I.Spawn(1e3,31,0,p,Z,s)r:ToEffect().Timeout=30 M[G(r)]=1 end end)F({},67,function(_,e)if(M[G(e)])then M[G(e)]=N I.Spawn(5,41,0,e.Position,Z,N):ToPickup().Timeout=90 end end,1e3)

--[[
模板: remove-donation-machine
]]

--===--
--[[
模板: restart-game
]]

