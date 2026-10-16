--事件触发：倒带、长按重复与状态机等时机钩子。

--[[
作为模板: true
模板id: on-rewind-action
说明: 检测到控制台输入rewind后，执行OnRewind函数。
参数:
  P1: {类型: 函数体, 性质: 局部, 默认: '', 说明: 函数体内容，默认空（空占位）}
]]
l local function OnRewind()P1 end;local I,M,A,E,T=Isaac,ModCallbacks A,T=I.AddCallback,I.GetFrameCount;A({},M.MC_PRE_GAME_EXIT,function(_,s)E=s and T()end)A({},M.MC_POST_GAME_STARTED,function()if E==T()then OnRewind()end end)

--[[
作为模板: true
模板id: long-press-repeat
说明: |-
  长按道具键/副手键{P2}以上=连续多次按键。
参数:
  P1: {类型: 毫秒, 默认: '1e3', 性质: 局部, 说明: "长按判定时长(毫秒)，1秒=1e3"}
  P2: {类型: 描述, 默认: "1s", 性质: 局部, 说明: "说明文本中的长按时长显示值（1s=1e3毫秒）"}
]]
l local A,M,H,B,K,G=Isaac.AddCallback,ModCallbacks,GetPtrHash,ButtonAction,{'ACTION_ITEM','ACTION_PILLCARD'},{M={}}A(G.M,M.MC_POST_PLAYER_RENDER,function(_,p)local k,n,a=H(p)G[k]=G[k]or{}n=G[k]for _,b in pairs(K)do a=B[b]if Input.IsActionPressed(a,p.ControllerIndex)then n[a]=n[a]or Isaac.GetTime()else n[a]=nil end end end,0)A(G.M,M.MC_INPUT_ACTION,function(_,e,_,a)e=e and e:ToPlayer()if e then local k,t,s=H(e),Isaac.GetTime()s=G[k]and G[k][a]if s and s<t then return t>P1+s end end end,InputHook.IS_ACTION_TRIGGERED)A(G.M,M.MC_POST_ENTITY_REMOVE,function(_,e)G[H(e)]=nil end,EntityType.ENTITY_PLAYER)

--[[
作为模板: true
模板id: state-machine
说明: |-
  代码状态机，每秒30帧。初态为state=0，map中的key为状态值(非nil、非false)；value是一个函数，表示当前状态下执行的行为。返回值为下一个状态值，若返回nil或false则保持当前状态不变。
参数:
  P1: {类型: 状态表, 性质: 局部, 默认: '[0]=function()end', 说明: "map 表内容：key=状态值，value=该状态执行的行为函数"}
]]
l local M={state=0,map={P1}}Isaac.AddCallback({},ModCallbacks.MC_POST_UPDATE,function()M.state=M.map[M.state]()or M.state end)
