--失灵按键。

--[[
作为模板: true
模板id: broken-keys
名称: 失灵按键
说明: |-
  每WaitFrames(默认{P2})帧随机BrokenKeys(默认{P1},最多12)个按键失灵。
  可在控制台输入lua BrokenKeys = 数值 来调整失灵按键数量。
  可在控制台输入lua WaitFrames = 数值 来调整失灵按键刷新间隔的帧数。
  GetBrokenKeys()可获取顺序表格，包含当前失灵的按键名称字符串。
参数:
  P1: {类型: "整数", 默认: "3", 性质: "全局", 说明: "行首全局变量BrokenKeys，失灵按键数量(最多12)"}
  P2: {类型: "整数", 默认: "90", 性质: "全局", 说明: "行首全局变量WaitFrames，失灵刷新间隔帧数"}
]]
l BrokenKeys=P1;WaitFrames=P2;local A,C,D,M,N,T=Isaac.AddCallback,0,'GetFrameCount',ModCallbacks,{'LEFT','RIGHT','UP','DOWN','SHOOTLEFT','SHOOTRIGHT','SHOOTUP','SHOOTDOWN','BOMB','ITEM','PILLCARD','DROP'},{}A(T,M.MC_POST_UPDATE,function()local g,t,p=Game()t=g[D](g)if t<C or t>=C+WaitFrames then for i=#N,1,-1 do p=Random()%i+1 N[i],N[p]=N[p],N[i]end C=t end end)A(T,M.MC_INPUT_ACTION,function(_,e,h,a)for i=1,BrokenKeys do if a==ButtonAction['ACTION_'..N[i]]then return h==InputHook.GET_ACTION_VALUE and 0 end end end)function GetBrokenKeys()return table.move(N,1,BrokenKeys,1,{})end
