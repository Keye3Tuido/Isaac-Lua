--洒洒水啦~

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
模板: blind-permanent
]]

--[[
模板: multi-choice-spawn
参数:
  P1: "87,229,233"
  P2: "(87-洛基的角,229-萌死戳的肺,233-小小星球)"
]]

--[[
模板: remove-collectibles
参数:
  P1: "329,579"
  P2: "道具329(鲁多维科科技)和579(英灵剑)"
]]

--[[
说明: "所有玩家攻击方式变更为自动攻击"
]]
l local F,T,S,D=Isaac.AddCallback,{},'InitSeed'D=function(e)local k=e[S]T[k]=T[k]or{}return T[k]end F({},8,function(d,p)d=D(p)if d.s then d.s:Remove()d.s=nil end end,1<<8)F({},18,function(t)t={}for k,v in pairs(T)do if v then t[k]=v end end T=t end)F({},31,function(d,p)d=D(p)if d.s and d.s:Exists()then d.s.TargetPosition=p.Position d.s.Visible=false else if d.s then d.s:Remove()end d.s=Isaac.Spawn(3,120,1,p.Position,Vector.Zero,p)d.s:AddEntityFlags(1<<37)end end)F(T,67,function(_,e)T[e[S]]=nil end)

--===--
--[[
模板: restart-game
]]
