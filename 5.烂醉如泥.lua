--烂醉如泥（注意！很晕！！！）
--输入下面的代码后，开始一局新游戏
--除非重新加载了模组，否则不要重复输入代码

---- 代码效果(不用管中文，全选复制即可) ----

--0. 删除匿名模组的回调。游戏胜利后自动清理代码效果。
--控制台输入 lua CLM() 可删除所有匿名模组的回调，用于预防重复输入代码和清理代码效果。
--重复输入此代码不额外生效。
l local A,I,M,t,m=ModCallbacks,Isaac,'Mod'function CLM()for i,j in pairs(A)do t=I.GetCallbacks(j)for x=#t,1,-1 do m=t[x][M]if not(m and m.Name)then I.RemoveCallback(m,j,t[x].Function)end end end end CLM()I.AddCallback({},A.MC_POST_GAME_END,function(_,f)if not f then CLM()end end)

--1. 所有实体贴图会旋转、变大或变小；游戏会不时变慢和变快（损坏的怀表效果）
l local I,M,V,R,S=Isaac,math,Vector,'SpriteRotation','SpriteScale'I.AddCallback({},1,function()local t,r,a,b,d,g,s=I.GetTime()/1e3,Game():GetRoom()a,b=M.sin(t),M.cos(t)for _,e in pairs(I.GetRoomEntities())do if e.Type~=1 or e.Parent then d=e.InitSeed if d&1==0 then d=1 else d=-1 end e[R]=(e[R]+d)%360 e[S]=V(1.5*a,1+.5*b)e.SizeMulti=e[S]else e[R]=20*a end r:SetBrokenWatchState(t//1%3)end for i=0,r:GetGridSize()-1 do g=r:GetGridEntity(i)if g then s=g:GetSprite()d=i if d&1==0 then d=1 else d=-1 end s.Rotation=(s.Rotation+d)%360 s.Scale=V(1+.5*a,1.5*b)end end end)

--2. 玩家眼泪获得追踪、幽灵和穿刺效果；每进入新楼层，都会在初始房间生成一个死亡证明
l local A=Isaac.AddCallback A({},8,function(_,p)p.TearFlags=p.TearFlags|7 end,32)A({},18,function()Isaac.ExecuteCommand('spawn 5.100.628')end)
--.