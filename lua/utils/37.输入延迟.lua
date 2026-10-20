--输入延迟。

--[[
作为模板: true
模板id: input-lag
名称: 输入延迟
说明: |-
  将玩家的输入延迟{P1}帧（约{P2}秒）
参数:
  P1: {类型: "整数", 默认: "15", 性质: "局部", 说明: "延迟帧数"}
  P2: {类型: "描述", 默认: "0.25", 性质: "局部", 说明: "说明文本中的延迟秒数显示值（15帧÷60fps=0.25秒）"}
]]
l local b,c,j,l,m,n,A,B,r,g=InputHook,ModCallbacks,Input,table,pairs,'ControllerIndex',{},{},Isaac.AddCallback,Isaac.GetFrameCount r(B,c.MC_POST_PLAYER_RENDER,function(d,p,f)f=g()for i=#A,1,-1 do if A[i].f<f then l.remove(A,i)end end d=p[n]l.insert(A,1,{f=f+P1,d=d,k={}})for _,v in m(ButtonAction)do A[1].k[v]={[b.IS_ACTION_PRESSED]=j.IsActionPressed(v,d),[b.IS_ACTION_TRIGGERED]=j.IsActionTriggered(v,d),[b.GET_ACTION_VALUE]=j.GetActionValue(v,d)}end end,0)r(B,c.MC_INPUT_ACTION,function(f,e,h,a)e=e and e:ToPlayer()if e then f=g()for _,O in m(A)do if O.f==f and O.d==e[n]then return O.k[a][h]end end end end)
