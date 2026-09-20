--天堂制造
--禁用Goodtrip

---- 代码效果 ----

--===--

--[[
说明: "游戏会缓慢加速"
]]
l local a,s,I,u,i,f,Z,b,t,T,A,N=0,1,Isaac,0,0,0,{}T,A=I.GetFrameCount,I.AddCallback t=T()A(Z,1,function()u=T()if(u-t>59)then t=u s=s+.001 end if(b)then return end b=1 i=s//1 f=s-i a=a+f if(a>=1)then i=i+1 a=a-1 end for _=1,i-1 do Game():Update()end b=N end)A(Z,2,function()I.RenderText(string.format('%.3f',s),I.GetScreenWidth()/2,10,0,1,1,1)end)A(Z,15,function(_,c)if(not c)then s=1 end end)

--[[
模板: no-pause-no-console
]]

--===--
--[[
模板: restart-game
]]

