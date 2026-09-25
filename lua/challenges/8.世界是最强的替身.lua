--世界是最强的替身

--[[
说明: "当游戏暂停时，玩家可以正常行动。"
]]
l I,Y,U,P,T=Isaac,true,'Update','ToPlayer'T={['Trapdoor']=Y,['MinecartEnter']=Y,['FallIn']=Y,['LeapUp']=Y,['SuperLeapUp']=Y,['LeapDown']=Y,['SuperLeapDown']=Y}I.AddCallback({},ModCallbacks.MC_POST_RENDER,function()if Game():IsPaused()then for _,e in pairs(I.GetRoomEntities())do local p,r,l,k=e[P](e),e.Parent,e:ToLaser(),e:ToKnife()if p and not T[p:GetSprite():GetAnimation()]then p[U](p)elseif r and r[P](r)then if l then l.DisableFollowParent=Y elseif k and not k:IsFlying()then k[U](k)end end end end end)

--[[
模板: restart-game
]]
