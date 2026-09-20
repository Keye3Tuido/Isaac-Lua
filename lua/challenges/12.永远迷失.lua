--永远迷失（原-天眼地图）
--禁用Goodtrip
--禁止贪婪模式、禁止回溯路线


---- 代码效果 ----

--===--

--[[
模板: open-map-red-rooms
]]

--[[
说明: "每进入新的一层，传送角色至随机房间。"
]]
l local I,G,S,L,D,A,R,F=Isaac,Game(),'StartRoomTransition','GetLevel','Data'A,R=I.AddCallback,function()return G[L](G):GetRandomRoomIndex(false,I.GetTime())end A({},1,function(l)l=G[L](G)if l:GetCurrentRoomIndex()==l:GetStartingRoomIndex()and l:GetCurrentRoom():IsFirstVisit()then G[S](G,R(),-1)F=1 end end)A({},19,function(l,s,r)l=G[L](G)if F==2 then s=l:GetRooms()for i=1,#s do r=l:GetRoomByIdx(s:Get(i-1).SafeGridIndex)if r[D]and r[D].Type~=5 then r.DisplayFlags=0 end end l:UpdateVisibility()F=0 elseif F==1 then G[S](G,R(),-1)F=2 end end)

--[[
说明: "每进入一次错误房，生成一只黑暗以扫追杀玩家(这部分指令兼容发光沙漏，不兼容rewind指令)。"
]]
l local function C(s,c)if type(s)=='table'then c={}for k,v in pairs(s)do c[k]=C(v)end return c end return s end local J,K,G,I,N,D,E,Y,H,Z,A,B,T,L,R,S,X=true,false,Game(),Isaac,'InitSeed',{},'GetEffects','Entity','HasNullEffect',{}A,D.T=I.AddCallback,{}T=function(e,k)D.T=D.T or{}k=e[N]D.T[k]=D.T[k]or{}return D.T[k]end A(Z,3,function()D=C(B)R,S=J,K end,422)A(Z,11,function(_,p,d,e,s,c)p=p:ToPlayer()d=T(p)e=p[E](p)if not d.s and s[Y]and Z.B and Z.B[s[Y][N]]and not e[H](e,112)then d.s=1 SFXManager():Play(43)p:SetMinDamageCooldown(c)return false end end,1)A(Z,15,function(_,c)R,S=K,K if c then D=C(B)else D,B,Z.B={},{},{}end I.RunCallback(19)end)A(Z,17,function(_,s)if s then B=C(D)else D={}B={}end R,S,X,D=K,K,K,{}end)A(Z,18,function(p,e,d)for i=1,G:GetNumPlayers()do p=I.GetPlayer(i-1)e=p[E](p)d=T(p)if d.s then d.s=L e:RemoveNullEffect(112,e:GetNullEffectNum(112))end end for k,z in pairs(Z.B)do z:Remove()Z.B[k]=L end end)A(Z,19,function(c,e)if not X then X=J return end c,D.A,Z.B=1,D.A or 0,Z.B or{}if R then if S then R=K end S=not S end if not R then B=C(D)if G:GetLevel():GetCurrentRoomIndex()==-2 then D.A=D.A+1 end end for k,v in pairs(Z.B)do if not v:Exists()or c>D.A then v:Remove()Z.B[k]=L else c=c+1 end end for _=c,D.A do e=I.Spawn(866,0,0,I.GetRandomPosition(),Vector.Zero,L)Z.B[e[N]]=e end end)A(Z,30,function(_,n,c)c=c:ToPlayer()if c and Z.B and Z.B[n[N]]then c:TakeDamage(1,0,EntityRef(n),60)end end,866)A(Z,31,function(_,p,e)if T(p).s then e=p[E](p)if not e[H](e,112)then e:AddNullEffect(112)end if not p:HasCollectible(313,true)then e:RemoveCollectibleEffect(313,e:GetCollectibleEffectNum(313))end end end)A(Z,67,function(_,e)if not e:ToPlayer()and D.T then D.T[e[N]]=L end end)

--[[
模板: force-give-items
参数:
  P1: "'c91','c588','c589'"
  P2: "道具91(探窟帽)、588(太阳)、589(月亮)"
]]

--[[
模板: curse-immune
]]

--[[
模板: remove-collectibles
参数:
  P1: "21,54,76,158,246,287,333,580"
  P2: "道具21(指南针)、道具54(藏宝图)、道具76(X光透视)、道具158(水晶球)、道具246(蓝地图)、道具287(秘密之书)、道具333(思想)和道具580(红钥匙)。"
]]

--[[
模板: remove-trinkets
参数:
  P1: "170"
  P2: "170(水晶钥匙)"
]]

--[[
模板: remove-cards
参数:
  P1: "1,5,10,18,19,20,22,36,74,78"
  P2: "卡牌1(愚者)、卡牌5(皇帝)、卡牌10(隐者)、卡牌18(星星)、卡牌19(月亮)、卡牌20(太阳)、卡牌22(世界)、符文36(诸神)、卡牌74(月亮?)和卡牌78(红钥匙碎片)。"
]]

--===--
--[[
模板: restart-game
]]

