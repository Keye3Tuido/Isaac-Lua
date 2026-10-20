--倒带触发。

--[[
作为模板: true
模板id: on-rewind-action
说明: 检测到控制台输入rewind后，执行OnRewind函数。
参数:
  P1: {类型: 函数体, 性质: 局部, 默认: '', 说明: 函数体内容，默认空（空占位）}
]]
l local function OnRewind()P1 end;local I,M,A,E,T=Isaac,ModCallbacks A,T=I.AddCallback,I.GetFrameCount;A({},M.MC_PRE_GAME_EXIT,function(_,s)E=s and T()end)A({},M.MC_POST_GAME_STARTED,function()if E==T()then OnRewind()end end)
