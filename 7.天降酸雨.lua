--天降酸雨
--角色限定：攻击方式为眼泪
--输入下面的代码后，开始一局新游戏


---- 代码效果(不用管中文，全选复制即可) ----

--0. 前置功能性代码：避免代码污染、重复输入和模组不兼容问题;
--游戏胜利后自动清除代码效果; 长按重开键10秒自动清空代码效果;
--挑战若卡顿可按下"-"键关闭兼容模式；按下"="键可重新开启兼容模式（可能卡顿）、兼容模式下代码和模组的兼容会更稳定；
--提供接口: CLM()删除匿名回调; Wrap()包装模组回调; Unwrap()取消包装。
l if not(REPENTOGON or _CBH)then local D,E,F,I,J,O,P,Y,W,A,B,C,G,H,K,L,Q,R=require'debug',{},'Function',Isaac,'Callback',{},pairs,true,{}_CBH,A,B,C,G,K,Q,R=Y,D.getlocal,D.setlocal,D.sethook,I.GetCallbacks,'Run'..J,function(i)for _,m in P(G(i))do local o=m[F]if not W[o]then m[F]=O[o]or R(o)end end end,function(f)local function r(...)local s={pcall(f,...)}if s[1]then return table.unpack(s,2)end end O[f],W[r]=r,f return r end L=function(i)_,i=A(3,i)if not E[i]then E[i]=Y Q(i)end end for _,i in P(ModCallbacks)do E[i]=Y end function Wrap()if not H then for i,_ in P(E)do Q(i)end C(function()local a=D.getinfo(2,'f').func if a==I['AddPriority'..J]then _,a=A(2,4)L(2)if not W[a]then B(2,4,O[a]or R(a))end elseif a==I['Remove'..J]then _,a=A(2,3)L(2)if not W[a]then B(2,3,O[a]or a)end elseif a==I[K]or a==I[K..'WithParam']or a==G then L(1)end end,'c')H=Y end end function Unwrap()if H then C()for i,_ in P(E)do for _,m in P(G(i))do m[F]=W[m[F]]or m[F]end end O,W,H={},{}end end end -- 安全包装,预防模组兼容问题
l local A,I=ModCallbacks,Isaac;function CLM(t,m)for i,j in pairs(A)do t=I.GetCallbacks(j)for x=#t,1,-1 do m=t[x].Mod if not(m and m.Name)then I.RemoveCallback(m,j,t[x].Function)end end end end -- 清理匿名模组回调,预防代码污染
l Wrap,Unwrap=Wrap or CLM,Unwrap or CLM Wrap()CLM()local E,I,K,M,N,A,B,T,F=error,Isaac,Keyboard,ModCallbacks,Input B=N.IsButtonTriggered T=I.GetTime F=T()A=I.AddCallback A({},M.MC_POST_GAME_END,function(_,f)if not f then Unwrap()CLM()end end)A({},M.MC_POST_RENDER,function(p,q)p=T()for i=1,Game():GetNumPlayers()do q=I.GetPlayer(i).ControllerIndex if B(K.KEY_MINUS,q)then Unwrap()E('CBWrapper Disabled',0)elseif B(K.KEY_EQUAL,q)then Wrap()E('CBWrapper Enabled',0)end if N.IsActionPressed(ButtonAction.ACTION_RESTART,q)then if p-F>=1e4 then Unwrap()CLM()end return end end F=p end) -- 对外提供接口、自动清理回调、按键包装回调

--1. 强制锁定所有玩家射程为100（受谷底石、天秤影响）；锁定弹速为0（无法更改）
l local f=Isaac.AddCallback f(_,4,function(_,p)p.ShotSpeed=0 end)f(_,8,function(_,p)p.TearRange=4e3 end,8)

--2. 强制给予：道具149(吐根酊)、315(怪异磁铁)、330(豆奶)、540(扁石)
-- 格式：c=道具,t/T=饰品(仅保证层数一致),单物品={类别,1}
l ITEMS={'c149','c315','c330','c540'}local C,D,E,F,H,I,L,M,T=CollectibleType,'OLLECTIBLE','GetPlayerType',PlayerType,'Get',Isaac,'Remove',ModCallbacks,{}local A,B,G,J,K,N,O=I.AddCallback D,B='C'..D,'C'..D:lower()J=H..B K=J..'Num'O=L..B N=function(i,a,b)a,i=table.unpack(type(i)=='table'and i or{i,1})a,b=a:match('(%a)(%d+)')return i,a,tonumber(b)end G=function(_,a,b,p)for _,i in pairs(ITEMS)do i,a,b=N(i)if a=='c'then while 0<p[K](p,b)do p[O](p,b)end end end end A(T,M.MC_POST_PLAYER_UPDATE,function(a,p,b,c,e,g,h,j,k,l)if F.PLAYER_THESOUL_B~=p[E](p)and not p:HasCurseMistEffect()then c=I.GetItemConfig()e='Trinket'h='Add'for _,i in pairs(ITEMS)do i,a,b=N(i)if a=='T'then a='t'i=i*2 end if a=='c'then g=Game():GetItemPool()g[O](g,b)while i>p[K](p,b)do p[h..B](p,b,c[J](c,b).InitCharge)end elseif a=='t'then g=H..e l=h..e while 1 do j=i-p[g..'Multiplier'](p,b)if j<=0 then break end k={}for s=0,1 do k[s]=p[g](p,s)p['Try'..L..e](p,k[s])p[l](p,b|((j>1 and s==0 or j>3)and TrinketType.TRINKET_GOLDEN_FLAG or 0))end p:UseActiveItem(C[D..'_SMELTER'],2315)for s=0,1 do p[l](p,k[s],false)end end end end end end)A(T,M.MC_PRE_USE_ITEM,G,C[D..'_D4'])A(T,M.MC_ENTITY_TAKE_DMG,function(d,e,u,f)d=DamageFlag u='DAMAGE_'e=e:ToPlayer()if F.PLAYER_EDEN_B==e[E](e)and 0==f&(d[u..'RED_HEARTS']|d[u..'IV_BAG']|d[u..'FAKE']|d[u..'NO_PENALTIES'])then G(e,e,e,e)end end,EntityType.ENTITY_PLAYER)
--.