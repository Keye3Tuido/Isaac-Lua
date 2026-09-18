--天真的橡皮
--限定眼泪攻击


---- 代码效果 ----

--===--
--[[
模板: safe-wrap-mec
名称: 安全包装
]]

--[[
说明: 启用安全包装。
依赖: [安全包装]
]]
l MEC()

--[[
模板: clean-anon-callbacks
名称: 清理回调
]]

--[[
说明: 游戏胜利后自动清除代码效果; 长按重开键10秒自动清空代码效果。
依赖: [安全包装, 清理回调]
]]
l CLM()local I,M,A,T,F=Isaac,ModCallbacks T=I.GetTime F=T()A=I.AddCallback A({},M.MC_POST_GAME_END,function(_,f)if not f then DEMEC()CLM()end end)A({},M.MC_POST_RENDER,function(p)p=T()for i=1,Game():GetNumPlayers()do if Input.IsActionPressed(ButtonAction.ACTION_RESTART,I.GetPlayer(i).ControllerIndex)then if p-F>=1e4 then DEMEC()CLM()Game():FinishChallenge()Game():Fadeout(1,2)end return end end F=p end)

--[[
模板: lock-achievements
]]
--===--
--[[
模板: tear-variant-force
说明: 玩家的泪弹强制变为橡皮擦
参数: {P1: "TearVariant.ERASER"}
]]

--[[
模板: force-give-items
参数:
  P1: "'c329'"
  P2: "道具329(鲁多维科科技)"
]]

--[[
说明: 从游戏中移除{P2}
参数定义:
  P1: {类型: 道具id列表, 默认: "52,68,114,118,152,168,244,399,579,640,643,678,696", 性质: 局部, 说明: "要移除的道具id列表"}
  P2: {类型: 描述, 默认: "可绕过眼泪输出的道具(除去了329)", 性质: 局部, 说明: "说明文本中的被移除道具描述"}
]]
l local I,C,Y,T,A=Isaac,{P1},true,{}A=I.AddCallback A(T,23,function(_,c)for _,v in pairs(C)do if c==v then return Y end end end)A(T,31,function(_,p)for _,i in pairs(C)do while p:HasCollectible(i)do p:RemoveCollectible(i)end end end)A(T,37,function(p,f,v,s)if v==100 then repeat p,f=Game():GetItemPool()for _,i in pairs(C)do if i==s then f,s=1,p:GetCollectible(p:GetLastPool(),Y)break end end until not f return{v,s}end end)

--===--
--[[
模板: restart-game
说明: 重开一局新游戏。
]]
