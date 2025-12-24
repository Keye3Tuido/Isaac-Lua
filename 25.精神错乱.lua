--精神错乱
--输入下面的代码后，重新开始一局新游戏
--除非重新加载了模组，否则不要重复输入代码！

---- 代码效果(不用管中文，全选复制即可) ----

--* 前置功能性代码（重复输入不额外生效）
l if not(REPENTOGON or _CBH)then local D,E,F,I,J,O,P,Y,W,A,B,C,G,H,K,L,Q,R=require'debug',{},'Function',Isaac,'Callback',{},pairs,true,{}_CBH,A,B,C,G,K,Q,R=Y,D.getlocal,D.setlocal,D.sethook,I.GetCallbacks,'Run'..J,function(i)for _,m in P(G(i))do local o=m[F]if not W[o]then m[F]=O[o]or R(o)end end end,function(f)local function r(...)local s={pcall(f,...)}if s[1]then return table.unpack(s,2)end end O[f],W[r]=r,f return r end L=function(i)_,i=A(3,i)if not E[i]then E[i]=Y Q(i)end end for _,i in P(ModCallbacks)do E[i]=Y end function Wrap()if not H then for i,_ in P(E)do Q(i)end C(function(e)local a=D.getinfo(2,'f').func if a==I['AddPriority'..J]then _,a=A(2,4)L(2)if not W[a]then B(2,4,O[a]or R(a))end elseif a==I['Remove'..J]then _,a=A(2,3)L(2)if not W[a]then B(2,3,O[a]or a)end elseif a==I[K]or a==I[K..'WithParam']or a==G then L(1)end end,'c')H=Y end end function Unwrap()if H then C()for i,_ in P(E)do for _,m in P(G(i))do m[F]=W[m[F]]or m[F]end end O,W,H={},{}end end end -- 安全包装,预防模组兼容问题
l local A,I,M=ModCallbacks,Isaac,'Mod'function CLM(t,m)for i,j in pairs(A)do t=I.GetCallbacks(j)for x=#t,1,-1 do m=t[x][M]if not(m and m.Name)then I.RemoveCallback(m,j,t[x].Function)end end end end -- 清理匿名模组回调,预防代码污染
--0. 避免代码污染和模组不兼容问题，游戏胜利后自动清除代码效果。
--依赖代码* | 提供接口: CLM()删除匿名回调; Wrap()包装模组回调; Unwrap()取消包装。
l Wrap,Unwrap=Wrap or CLM,Unwrap or CLM Wrap()CLM()Isaac.AddCallback({},ModCallbacks.MC_POST_GAME_END,function(_,f)if not f then Unwrap()CLM()end end)

--1. 函数 RandomItems([BlackList]) 返回一个表，包含两个子表：Active和Passive，分别存储随机排序的主动道具和被动道具的道具ID列表。BlackList为可选参数，是一个包含不希望被选择的道具ID的黑名单表。
--道具列表中包含本局已经存在的错误道具。
l function RandomItems(BlackList)local A,B,C,E,G,T,P,t,c,f,Q={},BlackList or{59},Isaac.GetItemConfig(),'Type','GetCollectible',ItemType,{},-1 while C[G](C,t)do t=t-1 end for i=t+1,#C[G..'s'](C)-1 do c=C[G](C,i)if c then f=true for j=1,#B do if B[j]==i then f=false break end end if f then Q=T.ITEM_ACTIVE==c[E]and A or T.ITEM_NULL~=c[E]and P or{}table.insert(Q,math.random(#Q+1),i)end end end return{Active=A,Passive=P}end

--2. 函数 D4(EntityPlayer[,BlackList]) 移除玩家身上的所有道具，并随机给予相同数量的随机道具(主动道具1个，其余为被动道具)。该函数依赖函数原型 RandomItems([BlackList:table]) -> {Active={},Passive={}}。
l function D4(EntityPlayer,BlackList)local B,C,N,T,p,m,t,G,H='Collectible',Isaac.GetItemConfig(),0,RandomItems(BlackList or{59,584}),EntityPlayer,0,-1 G,H='Get'..B,'Add'..B while C[G](C,t)do t=t-1 end for i=t+1,#C[G..'s'](C)-1 do while p['Has'..B](p,i,true)do N=N+1 p['Remove'..B](p,i,true)end end if N>0 then t=T.Active[1]p[H](p,t,C[G](C,t).InitCharge,false)t=T.Passive for i=2,N do m=m%#t+1 p[H](p,t[m],0,false)end end end

--3. 函数 RandomTrinkets([BlackList]) 返回一个表,存储随机排序的饰品ID列表。BlackList为可选参数，是一个包含不希望被选择的饰品ID的黑名单表。
l function RandomTrinkets(BlackList)local A,B,C,G,c,f={},BlackList or{},Isaac.GetItemConfig(),'GetTrinket',-1 for i=1,#C[G..'s'](C)-1 do c=C[G](C,i)if c then f=true for j=1,#B do if B[j]==i then f=false break end end if f then table.insert(A,math.random(#A+1),i)end end end return A end

--4. 函数 D4_1(EntityPlayer[,BlackList]) 移除玩家身上的所有饰品，并随机给予相同数量的随机饰品。该函数依赖函数原型 RandomTrinkets([BlackList:table]) -> {}。
l function D4_1(EntityPlayer,BlackList)local B,C,N,T,p,m,G='Trinket',Isaac.GetItemConfig(),0,RandomTrinkets(BlackList or{64,75,180}),EntityPlayer,0 G='Get'..B for i=1,#C[G..'s'](C)-1 do while p['Has'..B](p,i)do N=N+1 p['TryRemove'..B](p,i)end end for i=1,N do m=m%#T+1 p['Add'..B](p,T[m],false)p:UseActiveItem(CollectibleType.COLLECTIBLE_SMELTER,3339)end end

--5. 房间未清理时，玩家每帧触发可兼容错误道具的 D4 效果。
--不会随机到：道具59(被动形式彼列之书)、道具122(巴比伦大淫妇)、道具584(美德之书)、道具703(小以扫)。
--不会随机到：饰品64(彩虹蠕虫)、饰品75(错误)、饰品154(骰子袋)、饰品180(复得游魂)。
l Isaac.AddCallback({},ModCallbacks.MC_POST_PLAYER_UPDATE,function(_,p)if not(Game():GetRoom():IsClear()or p:HasCurseMistEffect())then D4(p,{59,122,584,703})D4_1(p,{64,75,154,180})end end)

--6. 从游戏中移除道具703(小以扫)。
l local I,C,Y,T,A=Isaac,{703},true,{}A=I.AddCallback A(T,23,function(_,c)for _,v in pairs(C)do if c==v then return Y end end end)A(T,31,function(_,p)for _,i in pairs(C)do for _=1,p:GetCollectibleNum(i)do p:RemoveCollectible(i)end end end)A(T,37,function(p,f,v,s)if v==100 then repeat p,f=Game():GetItemPool()for _,i in pairs(C)do if i==s then f,s=1,p:GetCollectible(p:GetLastPool(),Y)break end end until not f return{v,s}end end)
--.