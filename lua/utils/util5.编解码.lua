--[[
作为模板: true
模板id: qrcode
名称: 二维码编码
说明: |
  QRE(str, ec_level) 生成 QR 码矩阵，返回 (ok, matrix)。
  输入 str：要编码的文本，模式自动判定（纯数字 / 字母数字 / 字节，含中文）。
  输入 ec_level：1-4 对应 L/M/Q/H，可省略，缺省按 L 处理。
  输出 ok：成功为 true；数据超出容量时为 false，第二个返回值为错误信息，
  内含该模式与纠错等级下的精确容量上限（字符数）。
  输出 matrix：z×z 表（z=版本×4+17，v1=21 到 v40=177），索引为 m[x][y]；
  元素 +2/-2 为功能图案、+1/-1 为数据，>0 为黑、<0 为白。
  容量上限（字节模式）：L 2,953 / M 2,331 / Q 1,663 / H 1,273；
  字母数字与纯数字模式上限更高，报错信息会给出精确值。
  参考开源项目：
  来源：speedata/luaqrcode（https://github.com/speedata/luaqrcode），
  作者 Patrick Gundlach 及贡献者，版权 2012-2020，三条款 BSD 许可证。
]]
l local a,G='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',{}QRE={}local T={}for i=1,64 do T[a:byte(i)]=i-1 end local function D(s)local n,t=#s,{}for i=1,n,4 do local p,q,r,w=s:byte(i,i+3)local x=(T[p]<<18)|(T[q]<<12)|((T[r]or 0)<<6)|(T[w]or 0)t[#t+1]=(x>>16)&255 if T[r]then t[#t+1]=(x>>8)&255 end if T[w]then t[#t+1]=x&255 end end return t end local h,R,S=D"BwEKAQ0BEQEKARABFgEcAQ8BGgESAhYCFAESAhoCEAQaARgCEgQWBBICEAQYBBwEFAISBBIGGgUYAhYEFgYaBh4CFgUUCBgIEgQaBRgIHAgUBB4FHAgYCxgEFggaChwLGgQWCRgMFhAeBBgJFBAYEBYGGAoeDBgSGAYcChgRHhAcBhwLHBAcEx4GGg0cEhwVHAcaDhoVGhkcCBoQHhQcGRwIGhEcFx4ZHAkcER4XGCIeCRwSHhkeHh4KHBQeGx4gGgwcFR4dHiMcDBwXHCIeJR4MHBkeIh4oHg0cGh4jHioeDhwcHiYeLR4PHB0eKB4wHhAcHx4rHjMeERwhHi0eNh4SHCMeMB45HhMcJR4zHjweExwmHjUePx4UHCgeOB5CHhUcKx47HkYeFhwtHj4eSh4YHC8eQR5NHhkcMR5EHlE=",D"AAcHBwcHAAAAAAAAAAMDAwMDAwMEBAQEBAQEAwMDAwMDAwAAAAAAAA==",D"f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f6R/f3+lpn9/f3+nqH+pqquAgYKDhIWGh4iJrH9/f39/f4qLjI2Oj5CRkpOUlZaXmJmam5ydnp+goaKjf39/f38="QRE.R,QRE.S=R,S local b,k={[0]=1},{[0]=256}for i=1,254 do local x=b[i-1]*2 if x>=256 then x=(x~0x11d)end b[i]=x k[x]=i end b[255]=1 k[1]=255 local function A(x,y)if x==0 or y==0 then return 0 end return b[(k[x]+k[y])%255]end QRE.m=A for n=7,30 do local g={1}for i=0,n-1 do local m,c=b[i],{0}for j=1,#g do c[j]=c[j]~A(g[j],m)c[j+1]=g[j]end g=c end G[n]=g end QRE.G=G local function u(x,d)local r=""for i=d-1,0,-1 do r=r..((x>>i)&1)end return r end QRE.b=u local function F(x,n)local r=0 for i=1,n do r=(r<<1)|(x&1)x=x>>1 end return r end local H,I={1,0,3,2}I=function(l,m)local d,r=(H[l]<<3)|m r=d<<10 for i=14,10,-1 do if(r>>i)&1==1 then r=r~(0x537<<(i-10))end end return u((d<<10|r)~0x5412,15)end QRE.t=I local function J(v)local q,r=v<<12 r=q for i=17,12,-1 do if(r>>i)&1==1 then r=r~(0x1F25<<(i-12))end end return u(F(q|r,18),18)end QRE.v=J local function B(v)if v==1 then return{}end local d,n=v*4+10,v//7+2 if n==2 then return{6,d}end local c=math.floor((d-6)/(n-1)+.5)if c%2==1 then c=c+1 end local t={[n]=d,[1]=6}for i=n-1,2,-1 do t[i]=t[i+1]-c end return t end QRE.a=B local C,E={}E=function(v)local t,z,c,f=C[v]if t then return t end z,c=4*v+17,#B(v)f=160+2*z if c>0 then f=f+25*(c*c-3)-(c-2)*10 end t=(z*z-f-(v>6 and 67 or 31))//8 C[v]=t return t end local function K(v,e)local o,f,c,g,d,l,m,n,j=((v-1)*4+e-1)*2+1 f=h[o]c=h[o+1]g=E(v)-f*c d=g//c l,m,n,j=g-d*c,d+f,d+1+f,{}for i=1,c do j[i]=i<=c-l and{m,d}or{n,d+1}end return j end QRE.e=K local function L(v,e)local o=((v-1)*4+e-1)*2+1 return E(v)-h[o]*h[o+1]end QRE.c=L
l local f,h,k,o,C,D,E,F,J,K,L=QRE,math,tonumber,string local c,b,A,m,G,S,a,B=f.c,f.b,f.e,f.m,f.G,f.S,f.a,function(s)return s:match"^[0-9]+$"and 1 or s:match"^[0-9A-Z $%%*./:+-]+$"and 2 or 4 end f.d=B C=function(n,v,e)local i,t,d=n==4 and 3 or(n==8 and 4 or n),{{10,9,8,8},{12,11,16,10},{14,13,16,12}}d=v<10 and t[1][i]or v<27 and t[2][i]or t[3][i]return b(e,d)end f.l=C D=function(n,l,g)local i,t,s,u=n==4 and 3 or(n==8 and 4 or n),{{10,9,8,8},{12,11,16,10},{14,13,16,12}},1,4 if g and g>=1 and g<=4 then s,u=g,g end local j,w,p for e=s,u do for v=1,40 do local x,d=c(v,e)*8-4,v<10 and t[1][i]or v<27 and t[2][i]or t[3][i]local q=x-d local r=i==1 and h.floor(q*3/10)or i==2 and h.floor(q*2/11)or h.floor(q/8)if v==40 and r>(p or 0)then p=r end if r>=l then if not j or v<j then j,w=v,e end break end end end return j,w,p end f.r=D E=function(s,n)if n==1 then return(s:gsub("..?.?",function(x)return b(k(x),#x==3 and 10 or#x==2 and 7 or 4)end))elseif n==2 then return(s:gsub("..?",function(x)if#x==2 then return b(S[x:byte(1)]*45+S[x:byte(2)]-5888,11)else return b(S[x:byte(1)]-128,6)end end))else return(s:gsub(".",function(x)return b(x:byte(1),8)end))end end f.n=E F=function(v,e,d)local g,p=c(v,e)*8 p=h.min(4,g-#d)if p>0 then d=d..o.rep("0",p)end if#d%8~=0 then d=d..o.rep("0",8-#d%8)end while#d<g do d=d.."11101100"if#d<g then d=d.."00010001"end end return d end f.p=F local H,I=function(d,n)local g,r=G[n],{}for i=1,n do r[i]=0 end for p=1,#d,8 do local e=k(d:sub(p,p+7),2)~r[1]for i=1,n-1 do r[i]=r[i+1]end r[n]=0 if e~=0 then for i=1,n do r[i]=r[i]~m(g[n+1-i],e)end end end return r end I=function(v,e,d)local r,l,n,s,g,p,q=A(v,e),{},{},0,0 for i=1,#r do local y,t=r[i][1],r[i][2]local u=y-t s=s+u*8 l[#l+1]=d:sub(g*8+1,(g+t)*8)local w,x=H(l[#l],u),{}for j=1,#w do x[j]=b(w[j],8)end n[#n+1]=table.concat(x)g=g+t end p=""g=1 repeat for i=1,#l do if g<#l[i]then p=p..l[i]:sub(g,g+7)end end g=g+8 until#p==#d q=""g=1 repeat for i=1,#n do if g<#n[i]then q=q..n[i]:sub(g,g+7)end end g=g+8 until#q==s return p..q end f.x=I J=function(t)local z=#t for c=0,2 do local e,g,l,n=c==1 and z-8 or 0,c==2 and z-8 or 0,c==1 and 5 or 4,c==2 and 5 or 4 for i=1,8 do for j=1,8 do local d=h.max(h.abs(i-l),h.abs(j-n))t[e+i][g+j]=(d>3 or d==2)and-2 or 2 end end end end f.f=J K=function(t)local z=#t for i=9,z-8 do t[i][7]=i%2==1 and 2 or-2 t[7][i]=i%2==1 and 2 or-2 end end f.h=K L=function(t)local v,p=(#t-17)/4 p=a(v)for x=1,#p do for y=1,#p do if not(x==1 and y==1 or x==#p and y==1 or x==1 and y==#p)then local i,j=p[x]+1,p[y]+1 for e=-2,2 do for g=-2,2 do local d=h.max(h.abs(e),h.abs(g))t[i+e][j+g]=d%2==0 and 2 or-2 end end end end end end f.k=L
l local X,f,h,k,Y=false,math,string,table,'0000'local B,C,D,E,F,G,H,I,J,K,M,N,R,u,O=QRE.f,QRE.h,QRE.k,QRE.t,QRE.v,QRE.d,QRE.r,QRE.b,QRE.l,QRE.n,QRE.p,QRE.x,QRE.R,function(t,b,x,y)t[x][y]=b=="1"and 2 or-2 end O=function(t,l,m)local s,z=E(l,m),#t for i=1,15 do local b=s:sub(i,i)u(t,b,9,i<8 and z-i+1 or i<10 and 17-i or 16-i)u(t,b,i<7 and i or i<8 and 8 or z-15+i,9)end end local function P(t,v)if not(v<7)then local z,s=#t,F(v)for i=1,18 do local x,y=z-10+(i-1)%3,1+f.floor((i-1)/3)u(t,s:sub(i,i),x,y)x=1+f.floor((i-1)/3)y=z-10+(i-1)%3 u(t,s:sub(i,i),x,y)end end end local function Q(v,l,m)local z,t=v*4+17,{}for i=1,z do t[i]={}for j=1,z do t[i][j]=0 end end B(t)C(t)P(t,v)t[9][z-7]=2 D(t)O(t,l,m)return t end local function S(m,x,y,v)x=x-1 y=y-1 local i=m==0 and(x+y)%2==0 or m==1 and y%2==0 or m==2 and x%3==0 or m==3 and(x+y)%3==0 or m==4 and(y//2+x//3)%2==0 or m==5 and(x*y)%2+(x*y)%3==0 or m==6 and((x*y)%2+(x*y)%3)%2==0 or m==7 and((x*y)%3+(x+y)%2)%2==0 return i and 1-2*v or-1+2*v end local function T(t,x,y,o,a,z)local r,c,L={},1,X while c<=#a do if not L and 0==t[x][y]then r[#r+1]={x,y}L=true c=c+1 elseif L and 0==t[x-1][y]then r[#r+1]={x-1,y}L=X c=c+1 y=y+o elseif not L and 0==t[x-1][y]then r[#r+1]={x-1,y}c=c+1 y=y+o else y=y+o end if y<1 or y>z then x=x-2 if x==7 then x=6 end if o<0 then o,y=1,1 else o,y=-1,z end end end return r,x,y,o end local function U(t,d,m)local z=#t local x,y,o,p=z,z,-1 for i=1,#d,8 do local b=d:sub(i,i+7)p,x,y,o=T(t,x,y,o,b,z)for j=1,#b do local a,c=p[j][1],p[j][2]t[a][c]=S(m,a,c,b:byte(j)-48)end end end local function V(t)local z,r,c,e,d,j,m,o=#t,{},{},0 for x=1,z do local a={}for y=1,z do local v=0<t[x][y]if v then e=e+1 end a[y]=v and 49 or 48 end r[x]=h.char(k.unpack(a))end for y=1,z do local a={}for x=1,z do a[x]=0<t[x][y]and 49 or 48 end c[y]=h.char(k.unpack(a))end d,j,m=0,0,0 for x=1,z do local s=r[x]for w in s:gmatch"1+"do local l=#w if l>=5 then d=d+l-2 end end for w in s:gmatch"0+"do local l=#w if l>=5 then d=d+l-2 end end s=c[x]for w in s:gmatch"1+"do local l=#w if l>=5 then d=d+l-2 end end for w in s:gmatch"0+"do local l=#w if l>=5 then d=d+l-2 end end end for x=1,z-2 do local s,a=r[x],r[x+1]for i=1,z-2 do local b=s:byte(i)if b==s:byte(i+1)and b==a:byte(i)and b==a:byte(i+1)then j=j+3 end end end local function q(s,g)local n=0 for i=1,#s-(g and 7 or 6)do if s:sub(i,i+6)=="1011101"and((i+10<#s+(g and 0 or 1)and Y==s:sub(i+7,i+10))or(i>=5 and Y==s:sub(i-4,i-1)))then n=n+40 end end return n end for x=1,z do m=m+q(r[x],1)+q(c[x])end o=f.floor(f.abs(e/(z*z)*100-50))*2 return d+j+m+o end local function A(v,e,d,m)local t=Q(v,e,m)U(t,d,m)return t,V(t)end local function W(v,e,d)local t,p=A(v,e,d,0)for i=1,7 do local b,a=A(v,e,d,i)if a<p then t,p=b,a end end return t end QRE=function(s,e)local n,g,c,a=G(s)local v,b,d=H(n,#s,e)if not v then return X,"data too long: max "..d.." chars"end g=I(n,4)..J(n,v,#s)c=g..K(s,n)c=M(v,b,c)a=N(v,b,c)if#a%8~=0 then return X,"ad%8="..#a%8 end a=a..h.rep("0",R[v])return true,W(v,b,a)end


--[[
作为模板: true
模板id: pixel-factory
名称: 像素工厂
说明: |-
  提供全局接口MakePixel()
  返回一个像素对象，像素对象有以下属性和方法：
  Scale: Vector2D - 像素缩放比例
  Color: Color - 像素颜色
  Rotation: number - 像素旋转角度
  Render(Vector2D:position) - 在指定位置渲染像素
]]
l local a,b,k,l,m=Vector,Color,'Rotation','Scale','Color'function MakePixel()local d,f,g,h,i=Sprite(),a(1/784,1/448),a(1,1),b(1,1,1),{}d:Load('gfx/ui/stage/nightmare_bg.anm2',true)d:SetFrame('Intro',0)d.Offset=a(0,-15/448)d[l]=f d[m]=b(1,1,1,1,1,1,1)setmetatable(i,{__index=function(j,c)if c==l then return g elseif c==m then return h elseif c==k then return d[k]elseif c=='Render'then return function(_,e)d:RenderLayer(0,e)end end end,__newindex=function(_,e,c)if e==l then g=c d[l]=c*f d.Offset=a(0,-15/448)*c elseif e==m then h=c d[m]=b(1,1,1,c.A,c.R+c.RO,c.G+c.GO,c.B+c.BO)elseif e==k then d[k]=c end end})return i end

--[==[ 源代码
function MakePixel()
    local _sprite, _size, _scale, _color, pixel = Sprite(), Vector(1/784, 1/448), Vector(1, 1), Color(1,1,1), {}
    _sprite:Load('gfx/ui/stage/nightmare_bg.anm2', true)
    _sprite:SetFrame('Intro', 0)
    _sprite.Offset = Vector(0, -15/448)
    _sprite.Scale = _size
    _sprite.Color = Color(1,1,1,1,1,1,1)
    
    setmetatable(pixel, {
        __index = function(self, key)
            if key == 'Scale' then
                return _scale
            elseif key == 'Color' then
                return _color
			elseif key == 'Rotation' then
				return _sprite.Rotation
            elseif key == 'Render' then
                return function(_, position)
                    _sprite:RenderLayer(0, position)
                end
            end
        end,
        __newindex = function(self, key, value)
			if key == 'Scale' then
				_scale = value
				_sprite.Scale = value * _size
				_sprite.Offset = Vector(0, -15/448) * value
			elseif key == 'Color' then
				_color = value
				_sprite.Color = Color(1, 1, 1, value.A, value.R+value.RO, value.G+value.GO, value.B+value.BO)
			elseif key == 'Rotation' then
				_sprite.Rotation = value
			end
		end
    })
    return pixel
end
]==]

--[[
作为模板: true
模板id: draw-qrcode
依赖: [二维码编码, 像素工厂]
说明: |-
  DrawQR(qrcode, position, scale ?= 1)：根据二维码点阵绘制图形。
  输入 qrcode：点阵（m[x][y]，>0 为黑）；position：绘制中心 Vector2D；scale：模块边长，可省略缺省 1。
  绘制前把黑点合并为若干不含白点的全黑矩形再渲染，调用次数约为逐点的 40%；分块按矩阵引用缓存，矩阵生成后请勿原地改动。
]]
l local a,P,Q,R=Vector,MakePixel()function DrawQR(q,p,s)s=s or 1 local n,z=#q,R if q~=Q then z={}local c,d={},{}for x=1,n do c[x]={}d[x]={}local v=0 for y=n,1,-1 do if 0<q[x][y]then v=v+1 else v=0 end d[x][y]=v end end for y=1,n do for x=1,n do local v=d[x][y]if v>0 and not c[x][y]then local w=1 while x+w<=n and v<=d[x+w][y]and not c[x+w][y]do w=w+1 end for b=x,x+w-1 do for e=y,y+v-1 do c[b][e]=1 end end z[#z+1]={x,y,w,v}end end end Q,R=q,z end P.Color=Color(1,1,1)P.Scale=n*s*a(1,1)P:Render(p)P.Color=Color(0,0,0)p=p-(n+1)/2*a(s,s)for i=1,#z do local r=z[i]P.Scale=a(r[3],r[4])*s P:Render(p+a(r[1]+(r[3]-1)/2,r[2]+(r[4]-1)/2)*s)end end

--[[
作为模板: true
模板id: bitmap-codec
名称: 位图压缩
说明: |-
  BitmapCodec(x) 位图压缩编解码：0/1 二维矩阵与压缩字符串无损互转。
  输入 table：m[x][y] 二维矩阵（1 起始），元素 >0 按 1、≤0 按 0 编码。
  输入 string：压缩字符串（本接口编码产物，头部含宽高）。
  输出：table 入返回 string，string 入返回同尺寸 0/1 矩阵；非法类型返回 nil 与错误信息。
]]
l local a,u,F,H,g,q,B=type,'data too short',2^32-1,2^31,2^30,3*2^30 B=function(v)return a(v)=="number"and v>0 and 1 or 0 end function BitmapCodec(x)if a(x)=="table"then local w,h=#x,#(x[1]or{})if w>65535 or h>65535 then return nil,"matrix too large"end local o={}if w<=254 and h<=254 then o[1],o[2]=w,h else o[1]=255 o[2]=w>>8 o[3]=w&255 o[4]=h>>8 o[5]=h&255 end local d,e,j,l,k,p=.0,F,0,0,0,{}for i=0,7 do p[i]=32768 end local function r(b)l=l*2+b k=k+1 if k==8 then o[#o+1]=l l,k=0,0 end end local function n(b)r(b)while j>0 do r(1-b)j=j-1 end end for m=1,h do for t=1,w do local L,U,C=t>1 and x[t-1][m]or 0,m>1 and x[t][m-1]or 0,t>1 and m>1 and x[t-1][m-1]or 0 local c,b=B(L)*4+B(U)*2+B(C),B(x[t][m])C=p[c]L=d+math.floor((e-d+1.0)*C/2^16)if b==0 then e=L-1.0 C=C+((65536-C)>>5)else d=L C=C-(C>>5)end p[c]=C while 1 do if e<H then n(0)elseif d>=H then n(1)d=d-H e=e-H elseif d>=g and e<q then j=j+1 d=d-g e=e-g else break end d=d*2.0 e=e*2.0+1.0 end end end j=j+1 if d<g then n(0)else n(1)end if k>0 then o[#o+1]=l<<(8-k)end return string.char(table.unpack(o))end if a(x)~="string"then return nil,"BitmapCodec expects a matrix table or compressed string"end local n=#x if n<2 then return nil,u end local w,h,j if 255==x:byte(1)then if n<5 then return nil,u end w=x:byte(2)*256+x:byte(3)h=x:byte(4)*256+x:byte(5)j=6 else w=x:byte(1)h=x:byte(2)j=3 end local m={}for x=1,w do m[x]={}end if w==0 or h==0 then return m end if j>n then return nil,"missing payload"end local l,r,k,t=j,x:byte(j),0 t=function()k=k+1 if k>8 then k=1 l=l+1 r=l<=n and x:byte(l)or 0 end return(r>>(8-k))&1 end local d,e,f=.0,F,.0 for i=1,32 do f=f*2.0+t()end j={}for i=0,7 do j[i]=32768 end for y=1,h do for x=1,w do local L,U,C=x>1 and m[x-1][y]or 0,y>1 and m[x][y-1]or 0,x>1 and y>1 and m[x-1][y-1]or 0 local c=B(L)*4+B(U)*2+B(C)L=j[c]local p,b=d+math.floor((e-d+1.0)*L/2^16)if f<p then b=0 e=p-1.0 L=L+((65536-L)>>5)else b=1 d=p L=L-(L>>5)end j[c]=L m[x][y]=b while 1 do if e<H then elseif d>=H then d=d-H e=e-H f=f-H elseif d>=g and e<q then d=d-g e=e-g f=f-g else break end d=d*2.0 e=e*2.0+1.0 f=f*2.0+t()end end end return m end

--[==[ 源代码
-- BitmapCodec: lossless two-way codec between a 0/1 2D matrix (m[x][y], 1-based)
-- and a compressed string. Adaptive binary arithmetic coding (WNC 32-bit fixed point,
-- E1/E2/E3 renormalization, no carry propagation); context = left / up / up-left pixels
-- (8 adaptive probability models, update rate 1/32). Large constants are powers of two;
-- fixed-point interval values are held in floats (all values < 2^48, exact in doubles),
-- so behavior is identical on 32/64-bit Lua. The executable l line minifies names further.

local FULL, HALF, Q1, Q3 = 2^32 - 1, 2^31, 2^30, 3 * 2^30

-- map to bit: number > 0 -> 1, anything else (<= 0, nil, boolean) -> 0
local function b(v)
    return type(v) == "number" and v > 0 and 1 or 0
end

function BitmapCodec(x)
    if type(x) == "table" then
        -- encode: matrix -> string
        local m = x
        local w, h = #m, #(m[1] or {})
        if w > 65535 or h > 65535 then
            return nil, "matrix too large"
        end
        local out = {}
        -- header: width/height as 2 bytes when both <= 254, else 255 marker + 2 bytes big-endian each
        if w <= 254 and h <= 254 then
            out[1], out[2] = w, h
        else
            out[1] = 255
            out[2], out[3] = w >> 8, w & 255
            out[4], out[5] = h >> 8, h & 255
        end
        -- encoder state
        local low, high, pend = 0.0, FULL, 0
        local acc, nbits = 0, 0
        local probs = {}
        for i = 0, 7 do probs[i] = 32768 end
        local function putbit(bit)
            acc = acc * 2 + bit
            nbits = nbits + 1
            if nbits == 8 then
                out[#out + 1] = acc
                acc, nbits = 0, 0
            end
        end
        local function putbits(bit)
            putbit(bit)
            while pend > 0 do
                putbit(1 - bit)
                pend = pend - 1
            end
        end
        for y = 1, h do
            for x = 1, w do
                local L  = x > 1 and m[x - 1][y] or 0
                local U  = y > 1 and m[x][y - 1] or 0
                local UL = x > 1 and y > 1 and m[x - 1][y - 1] or 0
                local ctx = b(L) * 4 + b(U) * 2 + b(UL)
                local bit = b(m[x][y])
                local p0 = probs[ctx]
                local split = low + math.floor((high - low + 1.0) * p0 / 2^16)
                if bit == 0 then
                    high = split - 1.0
                    p0 = p0 + ((65536 - p0) >> 5)
                else
                    low = split
                    p0 = p0 - (p0 >> 5)
                end
                probs[ctx] = p0
                -- renormalization (E1/E2/E3)
                while true do
                    if high < HALF then
                        putbits(0)
                    elseif low >= HALF then
                        putbits(1)
                        low = low - HALF
                        high = high - HALF
                    elseif low >= Q1 and high < Q3 then
                        pend = pend + 1
                        low = low - Q1
                        high = high - Q1
                    else
                        break
                    end
                    low = low * 2.0
                    high = high * 2.0 + 1.0
                end
            end
        end
        -- flush: one more significant bit uniquely determines the interval
        pend = pend + 1
        if low < Q1 then
            putbits(0)
        else
            putbits(1)
        end
        if nbits > 0 then
            out[#out + 1] = acc << (8 - nbits) -- zero-pad to a whole byte
        end
        return string.char(table.unpack(out))
    end
    if type(x) ~= "string" then
        return nil, "BitmapCodec expects a matrix table or compressed string"
    end
    -- decode: string -> matrix
    local s = x
    local n = #s
    if n < 2 then
        return nil, "data too short"
    end
    local w, h, pos
    if s:byte(1) == 255 then
        if n < 5 then
            return nil, "data too short"
        end
        w = s:byte(2) * 256 + s:byte(3)
        h = s:byte(4) * 256 + s:byte(5)
        pos = 6
    else
        w = s:byte(1)
        h = s:byte(2)
        pos = 3
    end
    local m = {}
    for x = 1, w do
        m[x] = {}
    end
    if w == 0 or h == 0 then
        return m
    end
    if pos > n then
        return nil, "missing payload"
    end
    -- bit reader (MSB first, zero-padded past the end)
    local bp, bb, bn = pos, s:byte(pos), 0
    local function getbit()
        bn = bn + 1
        if bn > 8 then
            bn = 1
            bp = bp + 1
            bb = bp <= n and s:byte(bp) or 0
        end
        return (bb >> (8 - bn)) & 1
    end
    -- decoder state
    local low, high = 0.0, FULL
    local code = 0.0
    for i = 1, 32 do
        code = code * 2.0 + getbit()
    end
    local probs = {}
    for i = 0, 7 do probs[i] = 32768 end
    for y = 1, h do
        for x = 1, w do
            local L  = x > 1 and m[x - 1][y] or 0
            local U  = y > 1 and m[x][y - 1] or 0
            local UL = x > 1 and y > 1 and m[x - 1][y - 1] or 0
            local ctx = b(L) * 4 + b(U) * 2 + b(UL)
            local p0 = probs[ctx]
            local split = low + math.floor((high - low + 1.0) * p0 / 2^16)
            local bit
            if code < split then
                bit = 0
                high = split - 1.0
                p0 = p0 + ((65536 - p0) >> 5)
            else
                bit = 1
                low = split
                p0 = p0 - (p0 >> 5)
            end
            probs[ctx] = p0
            m[x][y] = bit
            -- renormalization (mirror of the encoder)
            while true do
                if high < HALF then
                    -- no shift needed
                elseif low >= HALF then
                    low = low - HALF
                    high = high - HALF
                    code = code - HALF
                elseif low >= Q1 and high < Q3 then
                    low = low - Q1
                    high = high - Q1
                    code = code - Q1
                else
                    break
                end
                low = low * 2.0
                high = high * 2.0 + 1.0
                code = code * 2.0 + getbit()
            end
        end
    end
    return m
end
]==]

--[[
作为模板: true
模板id: codec-base92
名称: Base92 编解码
说明: |-
  EncRaw(s)/DecBase92(s)：任意字符串与 base-92 可见字符串互转。
  输入 string：EncRaw 吃任意字符串（含中文，按字节处理），返回 base-92 可见字符串；
  DecBase92 吃 base-92 字符串（EncRaw 编码产物），返回原始字符串；坏输入返回 nil 与错误信息。
  字面量由 92 个可打印安全字符组成，纯 ASCII 单行免转义（1.25 字符/字节）。
]]
l local A="!#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[]^_`abcdefghijklmnopqrstuvwxyz{|}~"local D={}for i=1,#A do D[A:sub(i,i)]=i-1 end local function d92(s)local p=D[s:sub(1,1)]if not p or p>3 then return nil end local o={}for i=2,#s,5 do local a=0.0 for j=i,i+4 do local d=D[s:sub(j,j)]if not d then return nil end a=a*92+d end o[#o+1]=string.char(a//16777216%256,a//65536%256,a//256%256,a%256)end if p>0 then local e=o[#o]o[#o]=e:sub(1,#e-p)end return table.concat(o)end local function e92(s)local r=(4-#s%4)%4 s=s..string.rep('\0',r)local t={A:sub(r+1,r+1)}for i=1,#s,4 do local a=0.0 for j=i,i+3 do a=a*256+s:byte(j)end local g={}for k=5,1,-1 do local d=a%92 g[k]=A:sub(d+1,d+1)a=(a-d)/92 end t[#t+1]=table.concat(g)end return table.concat(t)end function EncRaw(x)if type(x)~="string"then return nil,"EncRaw expects a string"end return e92(x)end function DecBase92(x)if type(x)~="string"then return nil,"DecBase92 expects a base-92 string"end local r=d92(x)if not r then return nil,"invalid base-92 string"end return r end
