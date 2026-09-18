--烤山芋烫烫烫


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
模板: blind-permanent
说明: 所有玩家永久蒙眼（在矿洞逃亡中不生效）。
]]

--[[
模板: remove-trinkets
参数: {P1: "63", P2: "63(安全剪刀)"}
]]

--[[
说明: 每个房间至少生成三个金色即爆炸弹，金色即爆炸弹兼容所有玩家的炸弹特效。
]]
l local f,g,k,a,b,c,h,j=Isaac,ModCallbacks,pairs,Vector.Zero,EntityType.ENTITY_BOMB,BombVariant.BOMB_GOLDENTROLL h=f.AddCallback j=f.FindByType h({},g.MC_POST_UPDATE,function(e,t,p)if Game():GetFrameCount()%30<1 then for _,v in k(j(b,c))do v:ToBomb().Flags=TearFlags.TEAR_NORMAL end end for i=1,Game():GetNumPlayers()do p=f.GetPlayer(i)e=p:FireBomb(a,a)t=(t or e.Flags)|e.Flags e:Remove()end while 3>#j(b,c)do f.Spawn(b,c,0,f.GetRandomPosition(),a,p)end for _,v in k(j(b,c))do v:ToBomb():AddTearFlags(t)end end)h({},g.MC_PRE_BOMB_COLLISION,function(_,_,t)if t.FrameCount<1 then return true end end,c)

--[[
说明: 玩家会自动举起接触到的金色即爆炸弹。
]]
l local d,e,f,c=Isaac,ModCallbacks,'AddCallback','HoldingItem'd[f]({},e.MC_PRE_BOMB_COLLISION,function(a,b,p)p=p:ToPlayer()a=p and p:GetData()[c]if a and a<0 and p:AreControlsEnabled()then p:TryHoldEntity(b)end end,BombVariant.BOMB_GOLDENTROLL)d[f]({},e.MC_POST_PLAYER_UPDATE,function(a,p)a=p:GetData()if p:IsHoldingItem()then a[c]=30 else a[c]=(a[c]or 0)-1 end end)

--[[
模板: force-give-items
参数:
  P1: "'c108','c220'"
  P2: "道具108(圣饼)、道具220(悲伤炸弹)"
]]

--[[
模板: fly-permanent
说明: 玩家永久飞行。
]]

--[[
模板: remove-collectibles
参数:
  P1: "223,375"
  P2: "道具223(纵火狂)和375(寄居骷髅帽)"
]]

--===--
--[[
模板: restart-game
说明: 重开一局新游戏。
]]
