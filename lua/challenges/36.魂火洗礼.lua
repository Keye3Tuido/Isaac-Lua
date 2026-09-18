--魂火洗礼
--限定角色：伯大尼


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
]]

--[[
模板: force-character
说明: 强制角色为伯大尼。
参数: {P1: "PlayerType.PLAYER_BETHANY"}
]]

--[[
模板: force-give-items
参数:
  P1: "'c223','c640'"
  P2: "道具223(纵火狂)、道具640(灵魂之瓮)"
]]

--[[
说明: 在未清理的房间，每{P2}为灵魂之瓮充能。
参数定义:
  P1: {类型: 帧, 默认: 150, 性质: 局部, 说明: 充能间隔(帧)，5秒=150帧}
  P2: {类型: 描述, 默认: "5秒", 性质: 局部, 说明: "说明文本中的充能间隔显示值（5秒=150帧）"}
]]
l Isaac.AddCallback({},ModCallbacks.MC_POST_UPDATE,function(a,b,c)b=Game()c=Isaac if not    b:GetRoom():IsClear()and b:GetFrameCount()%P1<1 then for i=1,b:GetNumPlayers()do a=Vector.Zero a=c.Spawn(EntityType.ENTITY_EFFECT,EffectVariant.ENEMY_SOUL,0,a,a,nil)a.Target=c.GetPlayer(i)a:Remove()end end end)

--[[
说明: 将灵魂之瓮的魂火替换为炼狱恶鬼。
]]
l Isaac.AddCallback({},ModCallbacks.MC_POST_TEAR_INIT,function(_,t)Isaac.Spawn(EntityType.ENTITY_EFFECT,EffectVariant.PURGATORY,1,t.Position,t.Velocity,t.SpawnerEntity):GetSprite():Play('Charge')t:Remove()end,TearVariant.FIRE)

--[[
说明: 在炼狱恶鬼被移除的位置，触发爆炸效果。
]]
l Isaac.AddCallback({},ModCallbacks.MC_POST_ENTITY_REMOVE,function(p,e)p=e.Variant==EffectVariant.PURGATORY and e.SubType==1 and e.SpawnerEntity p=p and p:ToPlayer()if p then e=p:FireTear(e.Position,e.Velocity,false,true):ToTear()e:AddTearFlags(TearFlags.TEAR_EXPLOSIVE)e:Die()end end,EntityType.ENTITY_EFFECT)

--[[
模板: sfx-volume-adjust
参数:
  P1: [182, 477]
  P2: ".3"
  P3: "30%"
]]

--===--
--[[
模板: restart-as-character
说明: 以伯大尼重开一局新游戏。
参数: {P1: "PlayerType.PLAYER_BETHANY"}
]]
