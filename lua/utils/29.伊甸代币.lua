--伊甸代币。

--[[
作为模板: true
模板id: gain-eden-tokens
说明: 在不锁定成就的游戏中输入这串代码，可获得{P2}个伊甸代币。
参数:
  P1: {类型: "数值", 默认: "1e3", 性质: "局部", 说明: "触发房间清空的次数（即获得的伊甸代币数量），1000=1e3"}
  P2: {类型: "描述", 默认: "1000", 性质: "局部", 说明: "说明文本中的伊甸代币数量显示值（1000=1e3）"}
]]
l local c,A,B,T,M,Y,W=Game,Isaac,ModCallbacks.MC_POST_UPDATE,{}Y=function()M.state=M.map[M.state]()or M.state end W=A.ExecuteCommand M={state=0,map={[0]=function()W'challenge 0'return 1 end,[1]=function()W'restart 0'return 2 end,[2]=function()W'stage 8'return 3 end,[3]=function(l)l=c():GetLevel()l:ChangeRoom(l:GetRooms():Get(l:GetLastBossRoomListIndex()).SafeGridIndex)return 4 end,[4]=function(a,b)A.RemoveCallback(T,B,Y)for _=1,P1 do c():GetRoom():TriggerClear()end c():FinishChallenge()c():Fadeout(9,2)return 5 end}}A.AddCallback(T,B,Y)
