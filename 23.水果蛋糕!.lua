--水果蛋糕!
--不建议使用眼泪以外的攻击方式
--输入下面的代码后，重新开始一局新游戏
--除非重新加载了模组，否则不要重复输入代码！

---- 代码效果(不用管中文，全选复制即可) ----

--1. 强制非精英敌人变为精英怪(仅包括10粉色变种，“0”和“1”可替换为非负整数表示权重)。
l local A,C={[0]=0,[1]=0,[2]=0,[3]=0,[4]=0,[5]=0,[6]=0,[7]=0,[8]=0,[9]=0,[10]=1,[11]=0,[12]=0,[13]=0,[14]=0,[15]=0,[16]=0,[17]=0,[18]=0,[19]=0,[20]=0,[21]=0,[22]=0,[23]=0,[24]=0,[25]=0},{}for k,v in pairs(A)do for _=1,v do C[#C+1]=k end end Isaac.AddCallback({}, ModCallbacks.MC_NPC_UPDATE, function(_,e)if e:IsVulnerableEnemy()and e:IsActiveEnemy(false)and not e:IsBoss()and not e:IsInvincible()and not e:IsChampion()then e:MakeChampion(e.InitSeed,C[e.InitSeed%#C+1])end end)

--2. 角色受到惩罚伤害时,会清除所有投射物。
l local function Action(p,a,f,s,c)for k,v in pairs(Isaac.FindByType(EntityType.ENTITY_PROJECTILE))do v:Remove()end end;local D,E=DamageFlag,EntityType Isaac.AddCallback({},ModCallbacks.MC_ENTITY_TAKE_DMG,function(_,e,a,f,s,c)e=e:ToPlayer()if e:GetPlayerType()==PlayerType.PLAYER_JACOB_B and s.Type==E.ENTITY_DARK_ESAU or 0<f&(D.DAMAGE_RED_HEARTS|D.DAMAGE_IV_BAG|D.DAMAGE_FAKE|D.DAMAGE_NO_PENALTIES)then return end Action(e,a,f,s,c)end,E.ENTITY_PLAYER)

--3. 眼泪实体有固定概率替换为混沌卡/橡皮擦。投射物更加危险。
l local A,B,C,D,E,F,G,M,T=Isaac.AddCallback,{'CHAOS_CARD','ERASER'},ProjectileFlags,{'CHANGE_FLAGS_AFTER_TIMEOUT','C.CHANGE_VELOCITY_AFTER_TIMEOUT'},table,{},'InitSeed',ModCallbacks,{}for k,v in pairs(C)do E.insert(F,v)for i,j in pairs(D)do if k==j then E.remove(F,#F)end end end A(T,M.MC_POST_TEAR_INIT,function(_,t)local f=t[G]&15 if f<2 then t:ChangeVariant(TearVariant[B[f+1]])end end)A(T,M.MC_POST_PROJECTILE_INIT,function(_,p)for i=1,2 do p:AddProjectileFlags(F[p[G]*i%#F+1])end end)
--.