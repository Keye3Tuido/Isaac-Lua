--或许他真的能躲过那把达摩克里斯之剑
--推荐角色：堕化犹大


---- 代码效果 ----

--===--
--[[
模板: give-start-collectibles
参数:
  P1: "58"
  P2: "道具58(影之书)。"
]]

--[[
模板: force-give-items
参数:
  P1: "'c656'"
  P2: "道具656(达摩克里斯之剑-被动)"
]]

--[[
说明: |-
  随机{P5}内，达摩克里斯之剑会落下。
  落下前会提前{P6}播放警示音效、掉落动画开始播放{P6}后剑头落地。
  控制台输入：lua DAMOCLES_ALARM=true 开启预警(默认开启)
  控制台输入：lua DAMOCLES_ALARM=false 关闭预警
参数定义:
  P1: {类型: 布尔, 默认: 'true', 性质: 全局, 说明: "全局变量DAMOCLES_ALARM，剑落下前警示音效开关（true开/false关）"}
  P2: {类型: 整数, 默认: '5400', 性质: 局部, 说明: "剑落下时间的下限（帧），3分钟=5400帧"}
  P3: {类型: 整数, 默认: '18e3', 性质: 局部, 说明: "剑落下时间的上限（帧），10分钟=18e3帧"}
  P4: {类型: 整数, 默认: '16', 性质: 局部, 说明: "警示音效提前帧数与剑头落地延迟帧数（0.5秒=16帧，代码中出现两处需同步）"}
  P5: {类型: 描述, 默认: '3~10分钟', 性质: 局部, 说明: "说明文本中的落下时间范围显示值（3分钟=5400帧、10分钟=18e3帧）"}
  P6: {类型: 描述, 默认: '0.5秒', 性质: 局部, 说明: "说明文本中的提前/落地时长显示值（0.5秒=16帧，说明中出现两处）"}
]]
l DAMOCLES_ALARM=P1;local A,B,C,D,U,V,W,X,Y,Z=Isaac,ModCallbacks,'GetFrameCount',{}Z=A.AddCallback Y=function()W=Game()W=W[C](W)X,V=W+math.random(P2,P3)end Z(D,B.MC_POST_UPDATE,function(g)g=Game()if U and W>g[C](g)then X=U.x W=U.w V=U.v end end)Z(D,B.MC_POST_GAME_STARTED,function(_,c)if not c then U=Y()end end)Z(D,B.MC_FAMILIAR_UPDATE,function(g,e,s)g=Game()s='State'g=g[C](g)if X then if g<X then if g-W>P4 then e[s]=1 end else e[s]=2 U={v=V,w=W,x=X}Y()end if X-g<P4 and not V then V=X if DAMOCLES_ALARM then SFXManager():Play(SoundEffect.SOUND_BERSERK_END,3)end end end end,FamiliarVariant.DAMOCLES)

--[[
模板: remove-collectibles
参数:
  P1: "81,210,577"
  P2: "道具81(嗝屁猫)、210(狸猫树叶)和577(达摩克里斯之剑)"
]]

--[[
说明: 当角色为拉撒路时，转换角色为死亡的拉撒路。
]]
l Isaac.AddCallback({},ModCallbacks.MC_POST_PLAYER_UPDATE,function(_,p)if PlayerType.PLAYER_LAZARUS==p:GetPlayerType()then p:ChangePlayerType(PlayerType.PLAYER_LAZARUS2)end end)

--===--
--[[
模板: restart-game
]]

