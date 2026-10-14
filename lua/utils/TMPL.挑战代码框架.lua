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
模板: lock-achievements
]]

--[[
说明: |-
  在第12层的初始房间右下角，生成一个传送至Delirium房间的传送门
  传送门贴图 by bilibili@迷鼠zas, uid:19166843
依赖: [整图绘制, Base92编解码]
]]
l local a,b,c,g,h,j=Isaac,ModCallbacks,Game,Vector.One,GetPtrHash,'SafeGridIndex'local m,n,o,q,S,A,B,C,D=EffectVariant.WISP,EntityType.ENTITY_EFFECT,a.AddCallback,a.FindByType,DecBase92"%!!x1n^ig^.8*al&)$J<rI7w+NZ1Kh1GM;]{!7Si*1&=G&!!!!!!!!!7]>tI2]i;J?Q+R#:WCC'tW{LbzZy'GY^@NSE6n%%CA-#}u90wyL14a]%PogPzBr&jg];7Ii@(87(=N0dVLr1+zDQ?}+[bYZI5fDT+:ym)}/L<{eSGUpZL/aBBMzVZf23-tt;jo2ePbs_p9m&S5L8_S9,Bl<DE_QRY!xW88D8p%vF]OTPXLJ1{3wZ'~39TXO(h;Yr!Odb--r<EU=jg.&P[$,a)t(q4U{=*q>jw?`;HY:b1?*}h;pmHU3Kt^ZZu2bt>f{iKVP=yQYcR}!W7:@|McqZ_%gUg;;9KOQ%3n-pY#Tv~Ix{L7(edcHZIn7]X;#'G!gWS[Q-;L[^:S`d$^Pi;?R&.6;VW|*C5/^%1%7&P#CVJ>VuQ<R'++<eA1FN*SO;>'&qJ$c<1j)TSZ)8E5+AyjPRRjQ(8wP&.~$IuYN*ii:|z{vC?xHaA.Ifu<8]KO=cN!W9.Lf!CBY;5M~qyv+/k5>^[|9O2JTwHSEusw+ei]y1!XLM.cox'1&m|0]<jrBCD,AITx|)N^G.3jTy@K+Hv)H)3/@8KZAkhm(e9~mHg*BP,u-E-@o$XGAWPEe?kL5429h|9P'Env&l`X'PPM0+N%s[WFq|B#6>!Yv)m3pH58km`TnX4xB!*W+L}bll1K1W#>yM*z$dSw`P;;d}'?V%R&$b)r2l<&i#rT[hY^`#U/laSN7*+`_<@`2,?w2(QL}BK0B<EV&PDW-m%~<e%X!'qK.^*tCQj;ks"o({},b.MC_POST_NEW_ROOM,function(l,s)l=c():GetLevel()s=l:GetCurrentRoomDesc()[j]if LevelStage.STAGE7==l:GetStage()and s~=B then A=s==l:GetStartingRoomIndex()if A then a.Spawn(n,m,0,g,g,nil)end if not B then s=l:GetRooms()for i=1,#s do l=s:Get(i-1)if l.Data.Name=='Delirium'then B=l[j]break end end end if not C then s=c():GetRoom()for i=0,s:GetGridSize()-1 do l=s:GetGridEntity(i)if not l then C=i end end C=s:GetGridPosition(C)end else A,B,C,D=nil end end)o({},b.MC_POST_PLAYER_UPDATE,function(_,p)if A and p.Position:Distance(C)<20 then D=p end end)o({},b.MC_POST_EFFECT_RENDER,function(_,e)if A and h(e)==h(q(n,m)[1])then e.DepthOffset=-1e3 DrawImage(S,a.WorldToScreen(C),2/3)end end,m)o({},b.MC_POST_UPDATE,function()if D and c():GetFrameCount()&15>14 then c():StartRoomTransition(B,Direction.NO_DIRECTION)end end)


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
