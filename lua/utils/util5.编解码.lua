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
l local a,b,k,l,m=Vector,Color,'Rotation','Scale','Color'function MakePixel()local d,f,g,h,i=Sprite(),a(1/784,1/448),a(1,1),b(1,1,1),{}d:Load'gfx/ui/stage/nightmare_bg.anm2'd:SetFrame('Intro',0)d.Offset=a(0,-15/448)d[l]=f d[m]=b(1,1,1,1,1,1,1)setmetatable(i,{__index=function(_,c)if c==l then return g elseif c==m then return h elseif c==k then return d[k]elseif c=='Render'then return function(_,e)if 0<h.A then d:RenderLayer(0,e)end end end end,__newindex=function(_,e,c)if e==l then g=c d[l]=c*f elseif e==m then h=c d[m]=b(1,1,1,c.A,c.R+c.RO,c.G+c.GO,c.B+c.BO)elseif e==k then d[k]=c d.Offset=a.FromAngle(d[k]-90)*15*d[l].Y end end})return i end

--[==[ 源代码
function MakePixel()
    local _sprite, _size, _scale, _color, pixel = Sprite(), Vector(1/784, 1/448), Vector(1, 1), Color(1,1,1), {}
    _sprite:Load('gfx/ui/stage/nightmare_bg.anm2', true)
    _sprite:SetFrame('Intro', 0)
    _sprite.Offset = Vector(0,-15/448)
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
                -- Color.A<=0 时直接跳过不渲染（透明像素免付渲染开销）
                return function(_, position)
                    if _color.A > 0 then
                        _sprite:RenderLayer(0, position)
                    end
                end
            end
        end,
        __newindex = function(self, key, value)
			if key == 'Scale' then
				_scale = value
				_sprite.Scale = value * _size
			elseif key == 'Color' then
				_color = value
				_sprite.Color = Color(1, 1, 1, value.A, value.R+value.RO, value.G+value.GO, value.B+value.BO)
            elseif key == 'Rotation' then
				_sprite.Rotation = value
                _sprite.Offset = Vector.FromAngle(_sprite.Rotation - 90) * (15 * _sprite.Scale.Y)
			end
		end
    })
    return pixel
end
]==]

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
模板id: color-codec
名称: 彩色图像素迭代器
内嵌脚本: [png2base92]
说明: |-
  PixelMap(s): 把彩色图编码串解码为像素迭代器，每次返回 ox, oy, Color(r,g,b,a)。
  输入 s：彩色图编码串
  输出：ox/oy 为 0 起 x/y 偏移，按行优先顺序迭代；c 为 Color 克隆对象（r/g/b/a 均 0~1）。
]]
l local d,J,j,o,K,L=string.byte,2^32-1,2^31,2^30,3*2^30 L=function(s)local n,q,M,v,b,A,c,e,g=#s if n<5 then return nil,'ds'end q,M=0<d(s,1),d(s,2)if not M or M<1 or n<3+M*3 then return nil,'pal'end v={}for i=1,M do v[i]={d(s,3*i),d(s,3*i+1),d(s,3*i+2)}end b=3+M*3 A=d(s,b)b=b+1 local w,h if A==255 then if n<b+3 then return nil,'ds'end w=d(s,b)*256+d(s,b+1)h=d(s,b+2)*256+d(s,b+3)b=b+4 else w=A h=d(s,b)if not h then return nil,'ds'end b=b+1 end if not h or w<1 or h<1 then return nil,'dim'end A=nil if q then if n<b+w*h-1 then return nil,'alpha'end A=string.sub(s,b,b+w*h-1)b=b+w*h end local k,p,C,l,D=M+1,b,d(s,b),0 D=function()l=l+1 if l>8 then l=1 p=p+1 C=p<=n and d(s,p)or 0 end return(C>>(8-l))&1 end c,e,g=.0,J,.0 for _=1,32 do g=g*2+D()end local E,N={}N=function(f)local z=E[f]if not z then local t={}for a=1,k do t[a]=1 end z={t,k}E[f]=z end return z end M={}for a=1,w do M[a]={}end for y=1,h do local F=k for x=1,w do local z=N(F)local f,t,G,i,r=z[1],z[2],c,0,0 for a=1,k do local P=f[a]r=r+P P=c+math.floor((e-c+1)*r/t)-1 if g<=P then i=a-1 e=P break end G=P+1 end c=G f[i+1]=f[i+1]+1 t=t+1 if t>=32768 then local u=0 for a=1,k do t[a]=(t[a]+1)//2 u=u+t[a]end z[2]=u else z[2]=t end M[x][y]={c=i,a=q and 0 or(i==0 and 0 or 255)}F=i while 1 do if e<j then elseif c>=j then c=c-j e=e-j g=g-j elseif c>=o and e<K then c=c-o e=e-o g=g-o else break end c=c*2 e=e*2+1 g=g*2+D()end end end if q then local a=1 for y=1,h do for x=1,w do M[x][y].a=d(A,a)a=a+1 end end end return M,v end function PixelMap(s)local m,a=L(s)if not m then return nil,a end local w,h,e,i=#m,#m[1],{},0 for y=1,h do for x=1,w do local p,r,g,b=m[x][y],0,0,0 if p.c>0 then local t=a[p.c]r=t[1]g=t[2]b=t[3]end i=i+1 e[i]=Color(r/255,g/255,b/255,p.a/255)end end local k=0 return function()k=k+1 if k>w*h then return nil end local c=e[k]return(k-1)%w,(k-1)//w,Color(c.R,c.G,c.B,c.A)end end

--[==[ 源代码
-- 彩色图像素迭代器（自包含，不依赖其他代码块）
-- 格式 v3：alpha 标志(0/1) | N | N×3 调色板(按频率降序) | 宽高(短式2B，255 转 5B) | [alpha: w×h 原始字节] | 索引面（至串尾）
-- 索引面：左邻上下文自适应多符号算术码流（WNC 32 位定点，E1/E2/E3 重整，频率表 ≥32768 折半）。
-- 符号集 0..N：0=全透明，1..N=调色板项；上下文 = 左邻符号（行首用特殊上下文 N+1）。
-- 索引面置于串尾：解码器尾部超读由零填充兜底，不影响已解码符号，故无需长度前缀。
local byte, sub = string.byte, string.sub
local floor = math.floor
local FULL, HALF, Q1, Q3 = 2^32-1, 2^31, 2^30, 3*2^30

local function cc_dec(s)
    local n = #s
    if n < 5 then return nil, 'ds' end
    local hasalpha = byte(s, 1) > 0
    local M = byte(s, 2)
    if not M or M < 1 or n < 3 + M*3 then return nil, 'pal' end
    local pal = {}
    for i = 1, M do
        pal[i] = {byte(s, 3*i), byte(s, 3*i+1), byte(s, 3*i+2)}
    end
    local pos = 3 + M*3
    local wb = byte(s, pos); pos = pos + 1
    local w, h
    if wb == 255 then
        if n < pos + 3 then return nil, 'ds' end
        w = byte(s, pos)*256 + byte(s, pos+1)
        h = byte(s, pos+2)*256 + byte(s, pos+3)
        pos = pos + 4
    else
        w = wb
        h = byte(s, pos)
        if not h then return nil, 'ds' end
        pos = pos + 1
    end
    if not h or w < 1 or h < 1 then return nil, 'dim' end
    local alpha = nil
    if hasalpha then
        if n < pos + w*h - 1 then return nil, 'alpha' end
        alpha = sub(s, pos, pos + w*h - 1)
        pos = pos + w*h
    end
    local NSYM = M + 1
    local bp, bb, bn = pos, byte(s, pos), 0
    local function getbit()
        bn = bn + 1
        if bn > 8 then
            bn = 1
            bp = bp + 1
            bb = bp <= n and byte(s, bp) or 0
        end
        return (bb >> (8 - bn)) & 1
    end
    local low, high = 0.0, FULL
    local code = 0.0
    for _ = 1, 32 do code = code*2 + getbit() end
    local ctxs = {}
    local function getctx(key)
        local z = ctxs[key]
        if not z then
            local t = {}
            for a = 1, NSYM do t[a] = 1 end
            z = {t, NSYM}
            ctxs[key] = z
        end
        return z
    end
    local m = {}
    for a = 1, w do m[a] = {} end
    for y = 1, h do
        local left = NSYM
        for x = 1, w do
            local z = getctx(left)
            local f, t = z[1], z[2]
            local range = high - low + 1
            local ls, sym = low, 0
            local cc = 0
            for a = 1, NSYM do
                local fs = f[a]
                cc = cc + fs
                local nhs = low + floor(range*cc/t) - 1
                if code <= nhs then
                    sym = a - 1
                    high = nhs
                    break
                end
                ls = nhs + 1
            end
            low = ls
            f[sym+1] = f[sym+1] + 1
            t = t + 1
            if t >= 32768 then
                local nt = 0
                for a = 1, NSYM do t[a] = (t[a]+1) // 2; nt = nt + t[a] end
                z[2] = nt
            else
                z[2] = t
            end
            m[x][y] = {c = sym, a = hasalpha and 0 or (sym == 0 and 0 or 255)}
            left = sym
            while true do
                if high < HALF then
                elseif low >= HALF then
                    low = low - HALF; high = high - HALF; code = code - HALF
                elseif low >= Q1 and high < Q3 then
                    low = low - Q1; high = high - Q1; code = code - Q1
                else break end
                low = low*2; high = high*2 + 1; code = code*2 + getbit()
            end
        end
    end
    if hasalpha then
        local ap = 1
        for y = 1, h do
            for x = 1, w do
                m[x][y].a = byte(alpha, ap)
                ap = ap + 1
            end
        end
    end
    return m, pal
end

function PixelMap(s)
    local m, pal = cc_dec(s)
    if not m then return nil, pal end
    local w, h = #m, #m[1]
    local px = {}
    local i = 0
    for y = 1, h do
        for x = 1, w do
            local p = m[x][y]
            local r, g, b = 0, 0, 0
            if p.c > 0 then
                local t = pal[p.c]
                r, g, b = t[1], t[2], t[3]
            end
            i = i + 1
            px[i] = Color(r/255, g/255, b/255, p.a/255)
        end
    end
    local k = 0
    return function()
        k = k + 1
        if k > w*h then return nil end
        local c = px[k]
        return (k-1) % w, (k-1) // w, Color(c.R, c.G, c.B, c.A)
    end
end
]==]

--[[
作为模板: true
模板id: draw-image
名称: 整图绘制
依赖: [彩色图像素迭代器, 像素工厂]
说明: |-
  DrawImage(s, position, scale ?= 1, rotation ?= 0)：把彩色图编码串整图绘制到屏幕。
  输入 s：彩色图编码串（头部自带调色板与宽高）。
  输入 position：图像中心屏幕坐标 Vector2D；scale：单个图像像素的屏幕边长，可省略缺省 1。
  输入 rotation：整图绕 position 的旋转角度（度，顺时针为正，可省略缺省 0 即不旋转）；
  非 90 倍数角度时合并矩形的接缝处可能有轻微重叠或缝隙（像素画风格）。
  绘制前把同色相邻像素合并为若干矩形再渲染，渲染次数远低于逐像素绘制；全透明像素直接跳过。
  合并结果按编码串内容缓存，同一串重复绘制不重复解码分解。
  解码失败返回 nil 与错误信息。
]]
l local d,w,P,l,f,t=Vector,math.floor,MakePixel()t=function(s)local m,u=PixelMap(s)if not m then return nil,u end local n,W,o,p,q,r=0,0,{},{},{},{}while 1 do local a,j,c=m()if a==nil then break end n=n+1 o[n]=w(c.R*255+.5)p[n]=w(c.G*255+.5)q[n]=w(c.B*255+.5)r[n]=w(c.A*255+.5)if a+1>W then W=a+1 end end local H,e,g,h,i=n//W,{},{},{},{}for k=0,n-1 do local a=r[k+1]e[k]=a==0 and 0 or((o[k+1]*256+p[k+1])*256+q[k+1])*256+a end for x=0,W-1 do local a=0 for y=H-1,0,-1 do local k=y*W+x if 0~=e[k]then if y<H-1 and e[k]==e[k+W]then a=a+1 else a=1 end g[k]=a else a=0 g[k]=0 end end end for y=0,H-1 do for x=0,W-1 do local k,c=y*W+x c=g[k]if c>0 and not h[k]then local a=1 while x+a<W do local j=k+a if h[j]or c>g[j]or e[j]~=e[k]then break end a=a+1 end for j=x,x+a-1 do for v=y,y+c-1 do h[v*W+j]=true end end i[#i+1]={x,y,a,c,e[k]}end end end return i,W,H end function DrawImage(s,h,a,c)a=a or 1 c=c or 0 if s~=l then local e,W,H=t(s)if not e then return nil,W end l,f=s,{e,W,H}end local g=f[1]P.Rotation=c for i=1,#g do local r=g[i]i=r[5]P.Color=Color(i//16777216/255,i//65536%256/255,i//256%256/255,i%256/255)P.Scale=d(r[3]*a,r[4]*a)P:Render(h+d((r[1]+(r[3]-1)/2-((f[2])-1)/2)*a,(r[2]+(r[4]-1)/2-((f[3])-1)/2)*a):Rotated(c))end end

--[==[ 源代码
-- 整图绘制（依赖 彩色图像素迭代器 的 PixelMap 与 像素工厂 的 MakePixel）
-- DrawImage(编码串, 图像中心屏幕坐标, scale ?= 1, rotation ?= 0)：同色像素合并为矩形再渲染
-- 像素对象在块加载时创建一次，逐次绘制只改 Color/Scale（与 draw-qrcode 同款用法）
local P = MakePixel()
local IMG_Q, IMG_R

local function build_runs(s)
    local it, err = PixelMap(s)
    if not it then return nil, err end
    -- 收集像素（迭代器按行优先吐出），颜色量回 0..255 整数
    local n, W, rr, gg, bb, aa = 0, 0, {}, {}, {}, {}
    while true do
        local ox, oy, c = it()
        if ox == nil then break end
        n = n + 1
        rr[n] = math.floor(c.R * 255 + .5)
        gg[n] = math.floor(c.G * 255 + .5)
        bb[n] = math.floor(c.B * 255 + .5)
        aa[n] = math.floor(c.A * 255 + .5)
        if ox + 1 > W then W = ox + 1 end
    end
    local H = n // W
    -- 合并键：0 表示全透明（不渲染），否则 rgbα 打包为一个整数
    local key, dn, cov, runs = {}, {}, {}, {}
    for k = 0, n - 1 do
        local a = aa[k + 1]
        key[k] = a == 0 and 0 or ((rr[k + 1] * 256 + gg[k + 1]) * 256 + bb[k + 1]) * 256 + a
    end
    -- dn[k]：从 k 向下连续同色的像素数（直方图法，与 draw-qrcode 同一策略的彩色版）
    for x = 0, W - 1 do
        local run = 0
        for y = H - 1, 0, -1 do
            local k = y * W + x
            if key[k] ~= 0 then
                if y < H - 1 and key[k] == key[k + W] then run = run + 1 else run = 1 end
                dn[k] = run
            else
                run = 0
                dn[k] = 0
            end
        end
    end
    -- 每行从左到右：以 (x,y) 为左上角，向右扩展出同色且下行连续高度足够的最大矩形
    for y = 0, H - 1 do
        for x = 0, W - 1 do
            local k = y * W + x
            local hv = dn[k]
            if hv > 0 and not cov[k] then
                local rw = 1
                while x + rw < W do
                    local kk = k + rw
                    if cov[kk] or dn[kk] < hv or key[kk] ~= key[k] then break end
                    rw = rw + 1
                end
                for xx = x, x + rw - 1 do
                    for yy = y, y + hv - 1 do
                        cov[yy * W + xx] = true
                    end
                end
                runs[#runs + 1] = {x, y, rw, hv, key[k]}
            end
        end
    end
    return runs, W, H
end

function DrawImage(s, position, scale, rotation)
    scale = scale or 1
    rotation = rotation or 0
    if s ~= IMG_Q then
        local runs, W, H = build_runs(s)
        if not runs then return nil, W end
        IMG_Q, IMG_R = s, {runs, W, H}
    end
    local runs, W, H = IMG_R[1], IMG_R[2], IMG_R[3]
    P.Rotation = rotation   -- P 为本块私有像素对象，循环内无其他写入，提到循环外
    for i = 1, #runs do
        local r = runs[i]
        local key = r[5]
        P.Color = Color(key // 16777216 / 255, key // 65536 % 256 / 255,
                        key // 256 % 256 / 255, key % 256 / 255)
        P.Scale = Vector(r[3] * scale, r[4] * scale)
        P:Render(position + Vector((r[1] + (r[3] - 1) / 2 - (W - 1) / 2) * scale,
                                   (r[2] + (r[4] - 1) / 2 - (H - 1) / 2) * scale):Rotated(rotation))
    end
end
]==]
