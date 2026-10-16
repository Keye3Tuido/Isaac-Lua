--时间与画面效果：时间倍率、卡顿与屏幕晃动。

--[[
作为模板: true
模板id: no-screen-shake
说明: |-
  取消屏幕晃动。
]]
l Isaac.AddCallback({},ModCallbacks.MC_POST_UPDATE,function()Game():ShakeScreen(0)end)

--[[
作为模板: true
模板id: time-scale-monitor
名称: 时间倍率
说明: |-
  实时监测游戏帧率，可使用指令：lua SetTimeScale(数值) 来设置游戏速率(默认1，最小0)。GetTimeScale()可获取{[1]=当前渲染帧倍率,[2]=当前逻辑帧倍率}。由于监测数据和调控速率之间存在延迟，实际效果与预期效果会有一定偏差。
]]
l local H,I,J,K,M,N,O,P,U,V,X,T,A,B,C,D,E,F,G,L,Q='GetFrameCount',Isaac,1,Game,ModCallbacks,math.max,1,1,1,1,true,{}A=I.AddCallback D=I.GetTime L=K().IsPaused B=I[H]C=K()[H]Q=X E=B()F=C(K())G=D()A(T,M.MC_POST_RENDER,function()local c,r,g,d=D(),B(),C(K())d=c-G G,E,O=c,r,50/d/3*(r-E)if r&1<1 then F,P=g,50/d/3*(g-F)end if J<1 and not L(K())then if J<O then U=U*1.2 elseif J>O then U=N(U/2,.5)end for i=1,U do I.GetRoomEntities()end end end)A(T,M.MC_POST_UPDATE,function()if Q and J>1 and not L(K())then if J>P then V=V*1.2 elseif J<P then V=N(V/2,.5)end Q=false for i=1,V do K():Update()end Q=X end end)function SetTimeScale(v)J=N(tonumber(v)or 1,0)end function GetTimeScale()return{O,P}end

--[[
作为模板: true
模板id: freeze-game
说明: 游戏卡顿{P2}。
参数:
  P1: {类型: "毫秒", 默认: "3e3", 性质: "局部", 说明: "卡顿时长（毫秒），3秒=3e3"}
  P2: {类型: "描述", 默认: "3秒", 性质: "局部", 说明: "说明文本中的卡顿时长显示值（3秒=3e3毫秒）"}
]]
l local A,B=Isaac.GetTime B=A()repeat until A()-B>P1
