--Base92编解码。

--[[
作为模板: true
模板id: codec-base92
名称: Base92编解码
内嵌脚本: [enc92_tool]
说明: |-
  EncRaw(s)/DecBase92(s)：任意字符串与 base-92 可见字符串互转。
  输入 string：EncRaw 吃任意字符串（含中文，按字节处理），返回 base-92 可见字符串；
  DecBase92 吃 base-92 字符串（EncRaw 编码产物），返回原始字符串；坏输入返回 nil 与错误信息。
  字面量由 92 个可打印安全字符组成，纯 ASCII 单行免转义（1.25 字符/字节）。
]]
l local c,l,A,b,D,z,f,h=string,table.concat,"!#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[]^_`abcdefghijklmnopqrstuvwxyz{|}~",'string',{}z=' base92 '..b for i=1,#A do D[A:sub(i,i)]=i-1 end f=function(s)local p,o=D[s:sub(1,1)]if not p or p>3 then return nil end o={}for i=2,#s,5 do local a=.0 for j=i,i+4 do local d=D[s:sub(j,j)]if not d then return nil end a=a*92+d end o[#o+1]=c.char(a//16777216%256,a//65536%256,a//256%256,a%256)end if p>0 then local e=o[#o]o[#o]=e:sub(1,#e-p)end return l(o)end h=function(s)local r,t=(4-#s%4)%4 s=s..c.rep('\0',r)t={A:sub(r+1,r+1)}for i=1,#s,4 do local a=.0 for j=i,i+3 do a=a*256+s:byte(j)end i={}for k=5,1,-1 do local d=a%92 i[k]=A:sub(d+1,d+1)a=(a-d)/92 end t[#t+1]=l(i)end return l(t)end function EncRaw(x)if b~=type(x)then return nil,"EncRaw expects a "..b end return h(x)end function DecBase92(x)if b~=type(x)then return nil,"DecBase92 expects a"..z end local r=f(x)if not r then return nil,"invalid"..z end return r end
