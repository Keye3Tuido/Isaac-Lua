--天降酸雨
--角色限定：攻击方式为眼泪

---- 代码效果 ----

--===--
--[[
模板: safe-wrap-mec
名称: 安全包装
]]

--[[
说明: "启用安全包装。"
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
说明: "强制锁定所有玩家射程为{P2}（受谷底石、天秤影响）；锁定弹速为0（无法更改）"
参数定义:
  P1: {类型: 数值, 默认: '4e3', 性质: 局部, 说明: "射程锁定值（TearRange单位，40=1格，100格=4e3）"}
  P2: {类型: 描述, 默认: "100", 性质: 局部, 说明: "说明文本中的射程格数显示值（100格=4e3）"}
]]
l local f=Isaac.AddCallback f(_,4,function(_,p)p.ShotSpeed=0 end)f(_,8,function(_,p)p.TearRange=P1 end,8)

--[[
模板: force-give-items
参数:
  P1: "'c149','c315','c330','c540'"
  P2: "道具149(吐根酊)、315(怪异磁铁)、330(豆奶)、540(扁石)"
]]

--[[
模板: remove-collectibles
参数:
  P1: "52,68,114,118,152,168,244,329,399,579,640,643,678,696"
  P2: "可绕过眼泪输出的道具"
]]

--===--
--[[
模板: restart-game
]]
