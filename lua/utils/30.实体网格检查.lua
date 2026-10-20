--实体网格检查。

--[[
作为模板: true
模板id: entity-grid-inspector
说明: 按下"="键，展示所有实体和障碍物信息。
]]
l local a,z,b,c,d,I,j,k,l=table.insert,string.format,pairs,KColor,Vector,Isaac,Font(),{}j:Load('font/terminus.fnt')I.AddCallback({},ModCallbacks.MC_POST_RENDER,function(f,g,h,y)f=Game()g=f:GetRoom()h=function(e)e=I.WorldToScreen(e)if g:IsMirrorWorld()then e.X=I.GetScreenWidth()-e.X end return e end for i=1,f:GetNumPlayers()do if not Game():IsPaused()and Input.IsButtonTriggered(Keyboard.KEY_EQUAL,I.GetPlayer(i-1).ControllerIndex)then l=not l break end end if l then for _,e in b(I.GetRoomEntities())do f=e.InitSeed y=e.SubType a(k,{s=z('%d.%d.%d',e.Type,e.Variant,y>1<<31 and y-(1<<32)or y),p=h(e.Position),c=c(((f>>16)&255)/255,((f>>8)&255)/255,(f&255)/255,1.5)})end for i=0,g:GetGridSize()-1 do f=g:GetGridEntity(i)if(f)then a(k,{s=z('%d.%d(%d)',f:GetType(),f:GetVariant(),f.State),p=h(g:GetGridPosition(i)),c=c(1,1,1,.3)})end end h={}for _,e in b(k)do f=(e.p.X//15)..','..(e.p.Y//15)h[f]=h[f]or{}a(h[f],e)end for _,e in b(h)do f=d.Zero for _,i in b(e)do f=f+i.p end f=f/#e g=1.25*(1-#e)for _,i in b(e)do y=d(f.X,f.Y+g)j:DrawStringScaled(i.s,y.X-j:GetStringWidth(i.s)/8,y.Y-j:GetBaselineHeight()/8,.25,.25,i.c)g=g+2.5 end end k={}end end)
