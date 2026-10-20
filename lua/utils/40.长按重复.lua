--长按重复。

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
