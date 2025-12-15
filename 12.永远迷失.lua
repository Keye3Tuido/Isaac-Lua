--永远迷失（原-天眼地图）
--禁用Goodtrip
--禁止贪婪模式、禁止回溯路线
--输入下面的代码后，重新开始一局新游戏
--除非重新加载了模组，否则不要重复输入代码！

---- 代码效果(不用管中文，全选复制即可) ----

--0. 删除匿名模组的回调。游戏胜利后自动清理代码效果。
--控制台输入 lua CLM() 可删除所有匿名模组的回调，用于预防重复输入代码和清理代码效果。
--重复输入此代码不额外生效。
l local A,I,M,t,m=ModCallbacks,Isaac,'Mod'function CLM()for i,j in pairs(A)do t=I.GetCallbacks(j)for x=#t,1,-1 do m=t[x][M]if not(m and m.Name)then I.RemoveCallback(m,j,t[x].Function)end end end end CLM()I.AddCallback({},A.MC_POST_GAME_END,function(_,f)if not f then CLM()end end)

--1. 进入新房间时，自动开启地图全部房间和红房间，并移除所有房间的红色标签。
l Isaac.AddCallback({},19,function()local l,r,s,t,f,g,x,e,o,n,a,m=Game():GetLevel(),{},'SafeGridIndex','Data','Flags','GetRooms','GetRoomByIdx'l:SetCanSeeEverything(true)e,o=function(c,k,d)c[f],d,k=~(1<<10)&c[f],c[t]and c[t].Doors,c[s]if k<0 then return end for j=0,7 do if not d or d&1>0 then l:MakeRedRoomDoor(k,j)l:UncoverHiddenDoor(k,j)end d=d and d>>1 end r[k]=1 end,l[g](l)n=#o e(l[x](l,l:GetCurrentRoomDesc()[s]))while a~=n do a=n for j=1,n do m=l[x](l,o:Get(j-1)[s])if not r[m[s]]then e(m)end end o=l[g](l)n=#o end end)

--2. 每进入新的一层，传送角色至随机房间。
l local I,G,S,L,D,A,R,F=Isaac,Game(),'StartRoomTransition','GetLevel','Data'A,R=I.AddCallback,function()return G[L](G):GetRandomRoomIndex(false,I.GetTime())end A({},1,function(l)l=G[L](G)if l:GetCurrentRoomIndex()==l:GetStartingRoomIndex()and l:GetCurrentRoom():IsFirstVisit()then G[S](G,R(),-1)F=1 end end)A({},19,function(l,s,r)l=G[L](G)if F==2 then s=l:GetRooms()for i=1,#s do r=l:GetRoomByIdx(s:Get(i-1).SafeGridIndex)if r[D]and r[D].Type~=5 then r.DisplayFlags=0 end end l:UpdateVisibility()F=0 elseif F==1 then G[S](G,R(),-1)F=2 end end)

--3. 每进入一次错误房，生成一只黑暗以扫追杀玩家(这部分指令兼容发光沙漏，不兼容rewind指令)。
l local function C(s,c)if type(s)=='table'then c={}for k,v in pairs(s)do c[k]=C(v)end return c end return s end local J,K,G,I,N,D,E,Y,H,Z,A,B,T,L,R,S,X=true,false,Game(),Isaac,'InitSeed',{},'GetEffects','Entity','HasNullEffect',{}A,D.T=I.AddCallback,{}T=function(e,k)D.T=D.T or{}k=e[N]D.T[k]=D.T[k]or{}return D.T[k]end A(Z,3,function()D=C(B)R,S=J,K end,422)A(Z,11,function(_,p,d,e,s,c)p=p:ToPlayer()d,e=T(p),p[E](p)if not d.s and s[Y]and Z.B and Z.B[s[Y][N]]and not e[H](e,112)then d.s=1 SFXManager():Play(43)p:SetMinDamageCooldown(c)return false end end,1)A(Z,15,function(_,c)R,S=K,K if c then D=C(B)else D,B,Z.B={},{},{}end I.RunCallback(19)end)A(Z,17,function(_,s)if s then B=C(D)else D,B={},{}end R,S,X,D=K,K,K,{}end)A(Z,18,function(p,e,d)for i=1,G:GetNumPlayers()do p=I.GetPlayer(i-1)e,d=p[E](p),T(p)if d.s then d.s=L e:RemoveNullEffect(112,e:GetNullEffectNum(112))end end for k,z in pairs(Z.B)do z:Remove()Z.B[k]=L end end)A(Z,19,function(c,e)if not X then X=J return end c,D.A,Z.B=1,D.A or 0,Z.B or{}if R then if S then R=K end S=not S end if not R then B=C(D)if G:GetLevel():GetCurrentRoomIndex()==-2 then D.A=D.A+1 end end for k,v in pairs(Z.B)do if not v:Exists()or c>D.A then v:Remove()Z.B[k]=L else c=c+1 end end for _=c,D.A do e=I.Spawn(866,0,0,I.GetRandomPosition(),Vector.Zero,L)Z.B[e[N]]=e end end)A(Z,30,function(_,n,c)c=c:ToPlayer()if c and Z.B and Z.B[n[N]]then c:TakeDamage(1,0,EntityRef(n),60)end end,866)A(Z,31,function(_,p,e)if T(p).s then e=p[E](p)if not e[H](e,112)then e:AddNullEffect(112)end if not p:HasCollectible(313,true)then e:RemoveCollectibleEffect(313,e:GetCollectibleEffectNum(313))end end end)A(Z,67,function(_,e)if not e:ToPlayer()and D.T then D.T[e[N]]=L end end)

--4. 强制给予玩家道具91(探窟帽)、道具588(太阳)和道具589(月亮)。
l Isaac.AddCallback({},31,function(c,p,n)if 40~=p:GetPlayerType()and not p:HasCurseMistEffect()then for _,i in pairs({91,588,589})do c,n=table.unpack(type(i)=='table'and i or{i,1})while n>p:GetCollectibleNum(c)do p:AddCollectible(c,Isaac.GetItemConfig():GetCollectible(c).InitCharge)end Game():GetItemPool():RemoveCollectible(c)end end end)

--5. 免疫失忆症、免疫迷途诅咒。
l local F=Isaac.AddCallback F({},10,function()Game():GetLevel():RemoveCurses(4)end,25)F({},12,function(_,c)return ~4&c end)

--6. 从游戏中移除道具21(指南针)、道具54(藏宝图)、道具76(X光透视)、道具158(水晶球)、道具246(蓝地图)、道具287(秘密之书)、道具333(思想)和道具580(红钥匙)。
l local I,C,Y,T,A=Isaac,{21,54,76,158,246,287,333,580},true,{}A=I.AddCallback A(T,23,function(_,c)for _,v in pairs(C)do if c==v then return Y end end end)A(T,31,function(_,p)for _,i in pairs(C)do for _=1,p:GetCollectibleNum(i)do p:RemoveCollectible(i)end end end)A(T,37,function(p,f,v,s)if v==100 then repeat p,f=Game():GetItemPool()for _,i in pairs(C)do if i==s then f,s=1,p:GetCollectible(p:GetLastPool(),Y)break end end until not f return{v,s}end end)

--7. 从游戏中移除饰品170(水晶钥匙)。
l local G,F,b=32768,Isaac.AddCallback,{170}F({},31,function(_,p)for _,i in pairs(b)do if p:HasTrinket(i)then p:TryRemoveTrinket(i)end end end)F({},37,function(_,f,v,s)if v==350 then repeat f=1 for _,i in pairs(b)do if i|G==s|G then f,s=0,s&G|Game():GetItemPool():GetTrinket()break end end until f>0 return{v,s}end end)

--8. 从游戏中移除卡牌1(愚者)、卡牌5(皇帝)、卡牌10(隐者)、卡牌18(星星)、卡牌19(月亮)、卡牌20(太阳)、卡牌22(世界)、符文36(诸神)、卡牌74(月亮?)和卡牌78(红钥匙碎片)。
l local b,Y,F,G={1,5,10,18,19,20,22,36,74,78},true,Isaac.AddCallback,Game()F({},31,function(_,p)for _,i in pairs(b)do for s=0,3 do if p:GetCard(s)==i then p:SetCard(s,0)end end end end)F({},37,function(r,f,v,s)if v==300 then repeat f=Y for _,i in pairs(b)do if i==s then f,r=false,G:GetRandomPlayer(Vector.Zero,0):GetCardRNG(REPENTANCE_PLUS and -1 or 0)s=G:GetItemPool():GetCard(r:GetSeed(),22<s and s<32,Y,31<s and s<42 or 55==s or 80<s)r:Next()break end end until f return{v,s}end end)
--.