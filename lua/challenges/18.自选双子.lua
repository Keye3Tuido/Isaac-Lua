--自选双子
--输入下面的代码后，重新开始一局新游戏
--禁用角色：雅阁&以扫、堕化遗骸、堕化+长子权拉撒路

--[[
说明: |-
  每开始新游戏时，主角色P1为当前角色、副角色P2为上一轮游戏的P1，可通过连续开始两次新游戏实现自选双子进行游戏。
  仅支持单人角色的搭配，不支持雅各&以扫、(堕化)遗骸、(堕化、长子权)拉撒路。
  按住丢弃键切换两位玩家HUD显示，两位角色的复活道具分开计算，其余逻辑与雅各&以扫一致。
]]
l local B,F,G,H,I,K,M,O,T,U,W,X,Y,Z,Ad,Ca,In,Ma,Un,Et,Ev,Gp,A,C,D,E,J,L,N,P,R,S,V,Q,Pr,Up,Tr,Gv,P1,P2,Bb=ButtonAction,'Parent',function()return Game():GetNumPlayers()end,GetPtrHash,InputHook,Isaac,ModCallbacks,'Position',{},'Size','MoveSpeed','ControllerIndex','GetDamageCooldown','SetMinDamageCooldown','AddCacheFlags',CacheFlag,Input,math,table.unpack,EntityType,'EvaluateItems','GetPlayerType'Q,R,Tr,Gv,V,A,P,D,L,N,S=Ca.CACHE_SPEED,In.IsActionPressed,In.IsActionTriggered,In.GetActionValue,M.MC_POST_PLAYER_UPDATE,K.AddCallback,K.GetPlayer,B.ACTION_DROP,{B.ACTION_LEFT,B.ACTION_RIGHT,B.ACTION_UP,B.ACTION_DOWN},{B.ACTION_ITEM,B.ACTION_PILLCARD},{B.ACTION_SHOOTLEFT,B.ACTION_SHOOTRIGHT,B.ACTION_SHOOTUP,B.ACTION_SHOOTDOWN}A(T,M.MC_EVALUATE_CACHE,function(_,e)if J and 1<G()then local a,b,h,v=P(),P(1),H(e)if h==H(a)then C=a[W]elseif h==H(b)then E=b[W]end if C and E then v=(C+E)/2 a[W],b[W]=v,v elseif C then b[Ad](b,Q)b[Ev](b)elseif E then a[Ad](a,Q)a[Ev](a)end end end,Q)A(T,M.MC_POST_PEFFECT_UPDATE,function(_,p)p[W]=Ma.min(2,p[W])end)A(T,V,function(_,p)local e,f,h,r,x,y,z=P(),P(1),H(p)P1=P1 or e[Gp](e)if J then x=e[X]r=R(D,x)if P2 and 2>G()then K.ExecuteCommand('addplayer '..P2..' '..x)P(1)[F],Up=e,true return end y,z=H(e),H(f)if h==z then if Up or r and not Pr or not r and Pr then p[F],Up=not r and e or nil,false Game():GetHUD():AssignPlayerHUDs()end Pr,p[F]=r end if(p:IsDead()and not p:WillPlayerRevive()or p:IsCoopGhost())and(h==y or h==z)and y~=z then e:Kill()f:Kill()end end end)A(T,V,function(_,p)local a,b,h,e,v,s,t=P(),P(1),H(p)if 1<G()then s,t=a[Y](a),b[Y](b)if 1<Ma.abs(s-t)then a[Z](a,t)b[Z](b,s)end e=h==H(a)and b or h==H(b)and a if e then v=p[O]-e[O]if p[U]+e[U]>v:Length()then p:AddVelocity(.1*v:Normalized())end end end end)A(T,M.MC_POST_PLAYER_RENDER,function(_,p,o)local s,h,d,l=o+K.WorldToRenderPosition(p[O]),H(p)d=h==H(P())and'P1'or h==H(P(1))and'P2'l=K.GetTextWidth(d)K.RenderText(d,s.X-l/2,s.Y,1,1,1,1)end)A(T,M.MC_INPUT_ACTION,function(_,e,h,a)e=e and e:ToPlayer()if e then local d,q,s,p,x,r,f,z,j,k,l=P(),H(P(1)),H(e)p,x=H(d),d[X]r,j,k,l=R(D,x),R(a,x),Tr(a,x),Gv(a,x)if h==I.IS_ACTION_PRESSED then f,z=false,j elseif h==I.IS_ACTION_TRIGGERED then f,z=false,k elseif h==I.GET_ACTION_VALUE then f,z=0,l end for _,v in pairs(N)do if a==v then if s==p and not r or s==q and r then return z else return f end end end if a==B.ACTION_BOMB then if s==p then Bb=0<e:GetNumBombs()elseif s==q and k and Bb and not e:HasGoldenBomb()then e:AddBombs(1)end end if s==q then for _,v in pairs(L)do if a==v then return not r and z or f end end end if a==D then for _,v in pairs{Un(L),Un(S)}do if R(v,x)or Tr(v,x)or 0<Gv(v,x)then return f end end end end end)A(T,M.MC_POST_GAME_STARTED,function(_,c)J=true if not c then P1,P2=P()[Gp](P()),P1 end if 1<G()then for i=0,1 do local p=P(i)p[Ad](p,Ca.CACHE_ALL)p[Ev](p)end end end)A(T,M.MC_PRE_GAME_EXIT,function()if 1<G()then P(1)[F],C,E=P()end J=false end)A(T,M.MC_PRE_ENTITY_SPAWN,function(_,t,v)if t==Et.ENTITY_SLOT and v==19 then return{Et.ENTITY_EFFECT,EffectVariant.EFFECT_NULL}end end)

--[[
模板: remove-collectibles
参数:
  P1: "482"
  P2: "道具482(遥控器)"
]]

--[[
模板: restart-game
]]
