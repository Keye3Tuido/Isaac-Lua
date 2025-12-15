--现代战争
--输入下面的代码后，重新开始一局新游戏
--除非重新加载了模组，否则不要重复输入代码！

---- 代码效果(不用管中文，全选复制即可) ----

--0. 删除匿名模组的回调。游戏胜利后自动清理代码效果。
--控制台输入 lua CLM() 可删除所有匿名模组的回调，用于预防重复输入代码和清理代码效果。
--重复输入此代码不额外生效。
l local A,I,M,t,m=ModCallbacks,Isaac,'Mod'function CLM()for i,j in pairs(A)do t=I.GetCallbacks(j)for x=#t,1,-1 do m=t[x][M]if not(m and m.Name)then I.RemoveCallback(m,j,t[x].Function)end end end end CLM()I.AddCallback({},A.MC_POST_GAME_END,function(_,f)if not f then CLM()end end)

--1. 固定开启下列彩蛋种子：G_FUEL。
l local S={SeedEffect.SEED_G_FUEL}Isaac.AddCallback({},ModCallbacks.MC_POST_UPDATE,function()local D,f=Game():GetSeeds()for _,d in pairs(S)do if D:CanAddSeedEffect(d)then D:AddSeedEffect(d)f=true end end if f then Isaac.ExecuteCommand('restart')end end)

--2. 角色的下列属性不会超出限定的值（nil表示不做限制）：移速(nil~1.50)；弹速(nil~2.00)
l local A,M,V,T,E=Isaac.AddCallback,ModCallbacks,{['MoveSpeed']={min=nil,max=1.50,F='SPEED'},['MaxFireDelay']={min=nil,max=nil,F='FIREDELAY'},['Damage']={min=nil,max=nil,F='DAMAGE'},['TearRange']={min=nil,max=nil,F='RANGE'},['ShotSpeed']={min=nil,max=2.00,F='SHOTSPEED'},['Luck']={min=nil,max=nil,F='LUCK'},['SpriteScale']={min=nil,max=nil,F='SIZE'}},{}E=function(p,k,v)local l,r=v.min,v.max if l and l>p[k]then p[k]=l end if r and r<p[k]then p[k]=r end end A(T,M.MC_EVALUATE_CACHE,function(_,p,f)for k,v in pairs(V)do if f==CacheFlag['CACHE_'..v.F]then return E(p,k,v)end end end)A(T,M.MC_POST_PEFFECT_UPDATE,function(_,p)for k,v in pairs(V)do E(p,k,v)end end)

--3. 非任务道具替换为以下道具之一：道具-1(-1号错误道具)
l local I,C=Isaac,{-1}I.AddCallback({},ModCallbacks.MC_POST_PICKUP_INIT,function(_,p)local s=p.SubType if not I.GetItemConfig():GetCollectible(s):HasTags(ItemConfig.TAG_QUEST)then for _,v in pairs(C)do if v==s then return end end local r=RNG()r:SetSeed(p.InitSeed,35)p:Morph(p.Type,p.Variant,C[r:RandomInt(#C)+1],true,true)end end,PickupVariant.PICKUP_COLLECTIBLE)

--4. 初始给予玩家道具20-超凡升天,48丘比特之箭,96-查德宝宝,98-圣遗物
l local I,G=Isaac,Game()I.AddCallback({},15,function(p,c,t,n)if not c then for _,i in pairs({20,48,96,98})do for k=1,G:GetNumPlayers()do p,t,n=I.GetPlayer(k-1),table.unpack(type(i)=='table'and i or{i,1})while n>p:GetCollectibleNum(t)do p:AddCollectible(t,I.GetItemConfig():GetCollectible(t).InitCharge)end end G:GetItemPool():RemoveCollectible(t)end end end)

--5. 取消屏幕晃动
l Isaac.AddCallback({},ModCallbacks.MC_POST_UPDATE,function()Game():ShakeScreen(0)end)
--.