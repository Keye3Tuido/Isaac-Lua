--挑战名称
--禁用角色：
--限定角色：
--禁止难度：
--限定难度：

--===--
--[[
模板: safe-wrap-mec
]]

--[[
说明: "启用安全包装。"
依赖: [安全包装]
]]
l MEC()

--[[
模板: clean-anon-callbacks
]]

--[[
模板: get-zh-font
]]

--[[
模板: codec-base92
]]

--[[
模板: pixel-factory
]]

--[[
模板: color-codec
]]

--[[
模板: draw-image
]]

--[[
说明: |-
  游戏胜利后自动清除代码效果; 长按重开键10秒自动清空代码效果。
  提供一个全局表_CodeEnding, 清理代码后会置表内的全局元素为nil，并释放该当前表。
  例: _CodeEnding = {"func1", "var1", "table1"}
  会在清理代码时置空_G["func1"], _G["var1"], _G["table1"]，并释放_CodeEnding表。
名称: 清理代码
依赖: [安全包装, 清理回调]
]]
l CLM()_CodeEnding={}local I,M,A,T,F,C=Isaac,ModCallbacks T=I.GetTime F=T()A=I.AddCallback C=function()DEMEC()CLM()for _,v in ipairs(_CodeEnding)do _G[v]=nil end _CodeEnding=nil end A({},M.MC_POST_GAME_END,function(_,f)if not f then C()end end)A({},M.MC_POST_RENDER,function(p)p=T()for i=1,Game():GetNumPlayers()do if Input.IsActionPressed(ButtonAction.ACTION_RESTART,I.GetPlayer(i).ControllerIndex)then if p-F>=1e4 then C()Game():FinishChallenge()Game():Fadeout(1,2)end return end end F=p end)

--[[
说明: 在第12层的初始房间右下角，生成一个传送至Delirium房间的传送门
依赖: [整图绘制, Base92编解码]
]]
l local a,c,b=Isaac,ModCallbacks,Game local e,S,P=a.AddCallback,DecBase92"%QjK8v^y<M~Ti}z`K]h{=<%c*J(CcLa);xy;#s{&7#2NZB!'GNJ$AS_E!yY]b#t-M>&%a]*!!!OB:#88$WIe@T'W6;>1&=G&!#Xc29>zP1QrLC:DTNK)%6Bek!'0:!!!!!5*Xn-a<o$Wb9|[5p(rop^0V5CsKm5*ZLY]]~.xh#mNO|R^#|gV{2rwvZK(76E$w~;N8C;1o+I6u*!!!hZSfC{F-5Onq[%pp$(nV-=V)9dlJyEj!?!uYTXtAWt?|oSF0}vqk&<f^?8zoff<A*)(0X,,D:TP(0(:AL81&=G&!#@DSH/X1QM72wT>Xbi9@>kT#Kewb|!ohS]1&=G&!#P4n1&5R4[64YY$ly6U:~e*<<Ti$9BBu9Q7j:xA3W9kx1&=G&!$$;NUJ%$PY?ukyV0nTLYt1'?-7F7T6Wd*oJWje0*)#B|<n+#2S6ZnUCl@mD7$ZCs$emlZ:XZf>^UDfYJ(KT'MlJ751wHi7*$J5+/<bqFRme|sCf/p`:Z]GWVL4760}vqk%W2kuAk~`GS`MdPUKX%hG+3i*$rzcs!!!Hw(3:|(1x*X{"e({},c.MC_POST_NEW_ROOM,function(l)l=b():GetLevel()P=LevelStage.STAGE7==l:GetStage()and l:GetCurrentRoomIndex()==l:GetStartingRoomIndex()if P then l=b():GetRoom()for i=0,l:GetGridSize()-1 do if not l:GetGridEntity(i)then P=l:GetGridPosition(i)end end end end)e({},c.MC_POST_RENDER,function()if P then DrawImage(S,a.WorldToScreen(P))end end)e({},c.MC_POST_PLAYER_UPDATE,function(r,p,s)if P and 20>p.Position:Distance(P)then s=b():GetLevel():GetRooms()for i=1,#s do r=s:Get(i-1)if r.Data.Name=='Delirium'then b():StartRoomTransition(r.SafeGridIndex,Direction.NO_DIRECTION)break end end P=nil end end,0)

--[[
模板: lock-achievements
]]

--===--

--[[
说明: |-
  代码模板(总字数指排除XXX,func,arg外的总字数)
  回调数N=1 | 总字数=35
]]
l Isaac.AddCallback({},ModCallbacks.XXX,func,arg)

--[[
说明: 2<=回调数N<=4 | 总字数=41+8N
]]
l local A,M=Isaac.AddCallback,ModCallbacks;A({},M.XXX,func,arg)

--[[
说明: 4<=回调数N<=10 | 总字数=45+7N
]]
l local A,M,T=Isaac.AddCallback,ModCallbacks,{}A(T,M.XXX,func,arg)

--[[
说明: 10<=回调数N | 总字数=65+5N
]]
l local M,A=ModCallbacks,function(...)Isaac.AddCallback({},...)end;A(M.XXX,func,arg)

--===--
--[[
模板: restart-game
]]

--[[
作为模板: true
模板id: clean-globals
说明: 清理代码时释放全局变量：{P1}
依赖: 清理代码
参数定义:
  P1: {类型: "全局名列表", 默认: "", 性质: 局部, 说明: "形如 'a', 'b' 的 Lua 字符串字面量序列"}
]]
l _CodeEnding={P1}

--[[
说明: 展示清理代码的提示文字
依赖: [清理代码, 获取中文字体, Base92编解码]
]]
l local a,T,F,S=Isaac,0,GetZhFont(),DecBase92"%XK]&7B!N`.@37lx)cqxL)d,U-W~<kD@-$`^C78z>XcZG8@-&p&X9,;gWi)e_MylgB@HyBmWhX&xHVIq?Aq33w"a.AddCallback({},ModCallbacks.MC_POST_RENDER,function(t)t=a.GetFrameCount()if Game():IsPaused()then if t-T>59 then F:DrawStringUTF8(S,a.GetScreenWidth()/2-F:GetStringWidthUTF8(S)/2,a.GetScreenHeight()/8,KColor.Cyan)end else T=t end end)

--[[
模板: random-string-output
]]

--.
