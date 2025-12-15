--世界是最强的替身
--输入下面的代码后，开始一局新游戏

---- 代码效果(不用管中文，全选复制即可) ----

--0. 删除匿名模组的回调。游戏胜利后自动清理代码效果。
--控制台输入 lua CLM() 可删除所有匿名模组的回调，用于预防重复输入代码和清理代码效果。
--重复输入此代码不额外生效。
l local A,I,M,t,m=ModCallbacks,Isaac,'Mod'function CLM()for i,j in pairs(A)do t=I.GetCallbacks(j)for x=#t,1,-1 do m=t[x][M]if not(m and m.Name)then I.RemoveCallback(m,j,t[x].Function)end end end end CLM()I.AddCallback({},A.MC_POST_GAME_END,function(_,f)if not f then CLM()end end)

--1. 当游戏暂停时，玩家可以正常行动。
l I,Y,U,P,T=Isaac,true,'Update','ToPlayer'T={['Trapdoor']=Y,['MinecartEnter']=Y,['FallIn']=Y,['LeapUp']=Y,['SuperLeapUp']=Y,['LeapDown']=Y,['SuperLeapDown']=Y}I.AddCallback({},ModCallbacks.MC_POST_RENDER,function()if Game():IsPaused()then for _,e in pairs(I.GetRoomEntities())do local p,r,l,k=e[P](e),e.Parent,e:ToLaser(),e:ToKnife()if p and not T[p:GetSprite():GetAnimation()]then p[U](p)elseif r and r[P](r)then if l then l.DisableFollowParent=Y elseif k and not k:IsFlying()then k[U](k)end end end end end)
--.