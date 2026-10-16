--按键与输入：按键失灵、输入延迟与暂停/控制台控制。

--[[
作为模板: true
模板id: no-pause-no-console
说明: |-
  [不适配手柄]禁止玩家暂停游戏、禁止使用控制台(忏悔+不生效)；可使用Esc返回游戏菜单
]]
l local A,B,M,T,O,P=Isaac.AddCallback,ButtonAction,ModCallbacks,{},Options,'PauseOnFocusLost'A(T,M.MC_POST_RENDER,function()O[P]=false for i=1,Game():GetNumPlayers()do local c=Isaac.GetPlayer(i-1).ControllerIndex if Input.IsActionPressed(B.ACTION_MENUBACK,c)then Game():Fadeout(1,2)end end end)A(T,M.MC_INPUT_ACTION,function(_,_,h,b)if b==B.ACTION_CONSOLE or b==B.ACTION_PAUSE then return h==InputHook.GET_ACTION_VALUE and 0 or false end end)A(T,M.MC_PRE_MOD_UNLOAD,function()O[P]=true end)

--[[
作为模板: true
模板id: broken-keys
名称: 失灵按键
说明: |-
  每WaitFrames(默认{P2})帧随机BrokenKeys(默认{P1},最多12)个按键失灵。
  可在控制台输入lua BrokenKeys = 数值 来调整失灵按键数量。
  可在控制台输入lua WaitFrames = 数值 来调整失灵按键刷新间隔的帧数。
  GetBrokenKeys()可获取顺序表格，包含当前失灵的按键名称字符串。
参数:
  P1: {类型: "整数", 默认: "3", 性质: "全局", 说明: "行首全局变量BrokenKeys，失灵按键数量(最多12)"}
  P2: {类型: "整数", 默认: "90", 性质: "全局", 说明: "行首全局变量WaitFrames，失灵刷新间隔帧数"}
]]
l BrokenKeys=P1;WaitFrames=P2;local A,C,D,M,N,T=Isaac.AddCallback,0,'GetFrameCount',ModCallbacks,{'LEFT','RIGHT','UP','DOWN','SHOOTLEFT','SHOOTRIGHT','SHOOTUP','SHOOTDOWN','BOMB','ITEM','PILLCARD','DROP'},{}A(T,M.MC_POST_UPDATE,function()local g,t,p=Game()t=g[D](g)if t<C or t>=C+WaitFrames then for i=#N,1,-1 do p=Random()%i+1 N[i],N[p]=N[p],N[i]end C=t end end)A(T,M.MC_INPUT_ACTION,function(_,e,h,a)for i=1,BrokenKeys do if a==ButtonAction['ACTION_'..N[i]]then return h==InputHook.GET_ACTION_VALUE and 0 end end end)function GetBrokenKeys()return table.move(N,1,BrokenKeys,1,{})end

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

--[[
作为模板: true
模板id: pause-on-focus-lost
说明: |-
  {P2}失焦暂停功能
参数:
  P1: {类型: "布尔", 默认: "false", 性质: 局部, 说明: "false表示关闭失焦暂停，true表示打开"}
  P2: {类型: "描述", 默认: "关闭", 性质: 局部, 说明: "说明文本中开启/关闭的描述"}
]]
l Options.PauseOnFocusLost=P1
