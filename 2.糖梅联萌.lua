--糖梅联萌
--禁用角色：Lilith, Lilith(Tainted)
--除非重新加载了模组，否则不要重复输入代码！

---- 代码效果(不用管中文，全选复制即可) ----

--0. 删除匿名模组的回调。游戏胜利后自动清理代码效果。
--控制台输入 lua CLM() 可删除所有匿名模组的回调，用于预防重复输入代码和清理代码效果。
--重复输入此代码不额外生效。
l local A,I,M,t,m=ModCallbacks,Isaac,'Mod'function CLM()for i,j in pairs(A)do t=I.GetCallbacks(j)for x=#t,1,-1 do m=t[x][M]if not(m and m.Name)then I.RemoveCallback(m,j,t[x].Function)end end end end CLM()I.AddCallback({},A.MC_POST_GAME_END,function(_,f)if not f then CLM()end end)

--1. 所有玩家永久蒙眼（在矿洞逃亡中不生效）。
l Isaac.AddCallback({},31,function(s,p,g,c,f)f,s,g=1,'Challenge',Game()c=g[s]if p:HasCurseMistEffect()then g[s],f=0 p:TryRemoveNullCostume(14)elseif p:CanShoot()then g[s],f=6 p:AddNullCostume(14)end if not f then p:UpdateCanShoot()end g[s]=c end)
 
--2. 进入房间时，如果玩家没有糖梅溜溜笛（道具650），则获得一支，使用后可召唤强化糖梅宝宝跟班作战。每造成一定伤害时，随机玩家附近会生成一支糖梅溜溜笛。
l local I,F,G,A,S,Y,C,K,P,W,U,T,E,M,X,D,N=Isaac,Isaac.AddCallback,GetPtrHash,0,0,true,Vector,350,224,649,650,{},Game(),Sprite(),'Position','State'M:Load('gfx/908.000_baby plum.anm2',Y)M:Play('Idle',Y)M.Color=Color(1,1,1,3)M.Scale=.3*C.One F(T,1,function()M:Update()end)F(T,6,function(_,f)if f[D]>=6 then f[D]=3 end end,P)F(T,11,function(_,e,a)if e:IsVulnerableEnemy()then A=A+a if A>=100+80*E:GetLevel():GetStage()then A=0 local t=I.Spawn(5,K,1,E:GetRandomPlayer(C.One,1)[X],3*C.FromAngle(Random()%360),N):ToPickup()T[G(t)]=1 t.Timeout=90 end end end)F(T,15,function(_,c)if not c then A=0 S=0 end end)F(T,19,function()S=S+1 end)F(T,31,function(_,p)if p:GetActiveItem(3)~=U and S>0 then p:SetPocketActiveItem(U,3,Y)S=S-1 end end)F(T,32,function(_,p,o)local V=I.WorldToRenderPosition(p[X])+o M:Render(V)E:GetFont():DrawStringScaled(S,V.X-4,V.Y-12,.5,.5,KColor.Cyan,8,Y)end)F(T,36,function(_,t)if T[G(t)]then local s=t:GetSprite()s:ReplaceSpritesheet(0,'gfx/items/collectibles/collectibles_650_plumflute.png')s:LoadGraphics()end end,K)F(T,38,function(_,t,p)p=p:ToPlayer()if p and T[G(t)]then t:Remove()p:AnimateCollectible(U)S=S+1 return Y end end,K)F(T,67,function(_,e)T[G(e)]=N end,5)

--3. 强制给予玩家道具590(水星)、3x道具649(甜甜糖梅宝)。
l Isaac.AddCallback({},31,function(c,p,n)if 40~=p:GetPlayerType()and not p:HasCurseMistEffect()then for _,i in pairs({590,{649,3}})do c,n=table.unpack(type(i)=='table'and i or{i,1})while n>p:GetCollectibleNum(c)do p:AddCollectible(c,Isaac.GetItemConfig():GetCollectible(c).InitCharge)end Game():GetItemPool():RemoveCollectible(c)end end end)
--.