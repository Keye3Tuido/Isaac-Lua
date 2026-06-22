--炸膛大炮
--禁用Goodtrip等传送类模组
--输入下面的代码后，重新开始一局新游戏


---- 代码效果(不用管中文，全选复制即可) ----

--* 前置功能性代码（重复输入不额外生效）
l if not(REPENTOGON or _CBH)then local D,E,F,I,J,O,P,Y,W,A,B,C,G,H,K,L,Q,R=require'debug',{},'Function',Isaac,'Callback',{},pairs,true,{}_CBH,A,B,C,G,K,Q,R=Y,D.getlocal,D.setlocal,D.sethook,I.GetCallbacks,'Run'..J,function(i)for _,m in P(G(i))do local o=m[F]if not W[o]then m[F]=O[o]or R(o)end end end,function(f)local function r(...)local s={pcall(f,...)}if s[1]then return table.unpack(s,2)end end O[f],W[r]=r,f return r end L=function(i)_,i=A(3,i)if not E[i]then E[i]=Y Q(i)end end for _,i in P(ModCallbacks)do E[i]=Y end function Wrap()if not H then for i,_ in P(E)do Q(i)end C(function(e)local a=D.getinfo(2,'f').func if a==I['AddPriority'..J]then _,a=A(2,4)L(2)if not W[a]then B(2,4,O[a]or R(a))end elseif a==I['Remove'..J]then _,a=A(2,3)L(2)if not W[a]then B(2,3,O[a]or a)end elseif a==I[K]or a==I[K..'WithParam']or a==G then L(1)end end,'c')H=Y end end function Unwrap()if H then C()for i,_ in P(E)do for _,m in P(G(i))do m[F]=W[m[F]]or m[F]end end O,W,H={},{}end end end -- 安全包装,预防模组兼容问题
l local A,I=ModCallbacks,Isaac;function CLM(t,m)for i,j in pairs(A)do t=I.GetCallbacks(j)for x=#t,1,-1 do m=t[x].Mod if not(m and m.Name)then I.RemoveCallback(m,j,t[x].Function)end end end end -- 清理匿名模组回调,预防代码污染
--0. 避免代码污染、重复输入和模组不兼容问题;
--游戏胜利后自动清除代码效果; 长按重开键10秒自动清空代码效果;
--依赖代码* | 提供接口: CLM()删除匿名回调; Wrap()包装模组回调; Unwrap()取消包装。
l Wrap,Unwrap=Wrap or CLM,Unwrap or CLM Wrap()CLM()local I,M,A,T,F=Isaac,ModCallbacks T=I.GetTime F=T()A=I.AddCallback A({},M.MC_POST_GAME_END,function(_,f)if not f then Unwrap()CLM()end end)A({},M.MC_POST_RENDER,function(p)p=T()for i=1,Game():GetNumPlayers()do if Input.IsActionPressed(ButtonAction.ACTION_RESTART,I.GetPlayer(i).ControllerIndex)then if p-F>=1e4 then Unwrap()CLM()end return end end F=p end)

--1. 玩家受伤（检测无敌帧重置，不检测实际受伤）时，执行OnHit函数(参数：玩家实体)。
l function OnHit(p)end local B,H,I,M,T,A={},GetPtrHash,Isaac,ModCallbacks,{}A=I.AddCallback;A(T,M.MC_POST_PLAYER_UPDATE,function(t,p,h)t=p:GetDamageCooldown()h=H(p)if t>0 and not B[h]then B[h]=t OnHit(p)else B[h]=t>0 end end)A(T,M.MC_POST_ENTITY_REMOVE,function(_,e)e=e:ToPlayer()and H(e)if e then B[e]=nil end end,EntityType.ENTITY_PLAYER)

--2. 有Fatal(默认20)%概率的房间，玩家受伤（无敌帧被重置）即死。这些房间内玩家攻击力翻倍。
--依赖代码1.
l Fatal=20;local B,C,I,M,S,G,R,L,D,K,A=Sprite(),CacheFlag.CACHE_DAMAGE,Isaac,ModCallbacks,'!!!'B:Load('gfx/ui/loading.anm2',true)B:Play('1',true)B.Scale=Vector.One*9 B.Color=Color(0,0,0,.3,.5)A=I.AddCallback;A({},M.MC_POST_RENDER,function(d)G=Game()L=G:GetLevel()D=function(i)return L:GetRoomByIdx(i).SpawnSeed%100<Fatal end K=D(L:GetCurrentRoomIndex())R=G:GetRoom()for i=0,7 do d=R:GetDoor(i)if d and D(d.TargetRoomIndex)then d=I.WorldToRenderPosition(d.Position)+R:GetRenderScrollOffset()d.X=R:IsMirrorWorld()and I.GetScreenWidth()-d.X or d.X I.RenderText(S,d.X-I.GetTextWidth(S)/2,d.Y,1,0,0,1)end end if K then B:RenderLayer(0,Vector.Zero)end end)A({},M.MC_EVALUATE_CACHE,function(_,p)if K then p.Damage=p.Damage*2 end end,C)A({},M.MC_POST_PLAYER_UPDATE,function(_,p)p:AddCacheFlags(C)p:EvaluateItems()end)OnHit=function(p)if K then p:Die()end end

--3. 免疫混乱诅咒。
l local F=Isaac.AddCallback F({},10,function()Game():GetLevel():RemoveCurses(32)end,31)F({},12,function(_,c)return ~32&c end)

--.