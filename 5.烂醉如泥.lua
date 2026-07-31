--烂醉如泥（注意！很晕！！！）
--输入下面的代码后，开始一局新游戏


---- 代码效果(不用管中文，全选复制即可) ----

--0. 前置功能性代码：避免代码污染和重复输入问题;
--默认锁定游戏成就;
--游戏胜利后自动清除代码效果; 长按重开键10秒自动清空代码效果;
--提供接口: CLM()删除匿名回调。
l function CLM(t,m)for i,j in pairs(ModCallbacks)do t=Isaac.GetCallbacks(j)for x=#t,1,-1 do m=t[x].Mod if not(m and m.Name)then Isaac.RemoveCallback(m,j,t[x].Function)end end end end --[[ 清理匿名模组回调,预防代码污染 ]]CLM()local I,M,A,T,F=Isaac,ModCallbacks T=I.GetTime F=T()A=I.AddCallback A({},M.MC_POST_GAME_END,function(_,f)if not f then CLM()end end)A({},M.MC_POST_RENDER,function(p)p=T()for i=1,Game():GetNumPlayers()do if Input.IsActionPressed(ButtonAction.ACTION_RESTART,I.GetPlayer(i).ControllerIndex)then if p-F>=1e4 then CLM()end return end end F=p end) --[[ 自动清理回调 ]] Isaac.AddPriorityCallback({},ModCallbacks.MC_POST_GAME_STARTED,CallbackPriority.IMPORTANT,function(_,c)if not c then Isaac.ExecuteCommand('seed '..Seeds.Seed2String(Game():GetSeeds():GetNextSeed()))end end) --[[ 游戏锁定成就 ]]

--1. 所有实体贴图会旋转、变大或变小；游戏会不时变慢和变快（损坏的怀表效果）
l local I,M,V,R,S=Isaac,math,Vector,'SpriteRotation','SpriteScale'I.AddCallback({},1,function()local t,r,a,b,d,g,s=I.GetTime()/1e3,Game():GetRoom()a,b=M.sin(t),M.cos(t)for _,e in pairs(I.GetRoomEntities())do if e.Type~=1 or e.Parent then d=e.InitSeed if d&1==0 then d=1 else d=-1 end e[R]=(e[R]+d)%360 e[S]=V(1.5*a,1+.5*b)e.SizeMulti=e[S]else e[R]=20*a end r:SetBrokenWatchState(t//1%3)end for i=0,r:GetGridSize()-1 do g=r:GetGridEntity(i)if g then s=g:GetSprite()d=i if d&1==0 then d=1 else d=-1 end s.Rotation=(s.Rotation+d)%360 s.Scale=V(1+.5*a,1.5*b)end end end)

--2. 玩家眼泪获得追踪、幽灵和穿刺效果；每进入新楼层，都会在初始房间生成一个死亡证明
l local A=Isaac.AddCallback A({},8,function(_,p)p.TearFlags=p.TearFlags|7 end,32)A({},18,function()Isaac.ExecuteCommand('spawn 5.100.628')end)

--.
