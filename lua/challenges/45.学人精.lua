--学人精
--限定角色：雅各&以扫

--[[
说明: 限定主角色为雅各
]]
l Isaac.AddCallback({},ModCallbacks.MC_POST_UPDATE,function(p,t)t=PlayerType.PLAYER_JACOB p=Isaac.GetPlayer()if t~=p:GetPlayerType()then p:ChangePlayerType(t)end end)


--[[
说明: 主角色的操作经过 {P1} 帧作用于副角色
参数:
  P1:
    类型: "非负整数"
    默认: "15"
    性质: "局部"
    说明: "延迟的时间，每秒60帧"
]]
l local b,c,g,l,m,n,o,A,B,s,j,q=GetPtrHash,InputHook,ModCallbacks,Input,table,pairs,'ControllerIndex',{},{},Isaac.AddCallback,Isaac.GetFrameCount,'GetMainTwin's(B,g.MC_POST_PLAYER_RENDER,function(d,p,f)if b(p)==b(p[q](p))then f=j()for i=#A,1,-1 do if A[i].f<f then m.remove(A,i)end end d=p:GetOtherTwin()[o]m.insert(A,1,{f=f+P1,d=d,k={}})for _,v in n(ButtonAction)do A[1].k[v]={[c.IS_ACTION_PRESSED]=l.IsActionPressed(v,d),[c.IS_ACTION_TRIGGERED]=l.IsActionTriggered(v,d),[c.GET_ACTION_VALUE]=l.GetActionValue(v,d)}end end end,0)s(B,g.MC_INPUT_ACTION,function(f,e,h,a)e=e and e:ToPlayer()if e and b(e[q](e))~=b(e)then f=j()for _,O in n(A)do if O.f==f and O.d==e[o]then return O.k[a][h]end end end end)

--[[
模板: restart-as-character
参数:
  P1: PlayerType.PLAYER_JACOB
]]