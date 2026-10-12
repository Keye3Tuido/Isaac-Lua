#!/usr/bin/env python3
# --[[ 工具规格
# id: png2base92
# title: 图片转 Base92
# desc: 图片缩至 128x128 内、量化后编码为 Base92 彩色图编码 v3（预算内取最大色数，内置自检，输出带引号字面量）
# inputs: [{name: img, type: file, label: 图片文件, accept: "image/png,image/jpeg"}, {name: budget, type: number, label: 字符预算, default: 3000}, {name: max-size, type: number, label: 尺寸上限, default: 128}]
# ]]
"""png2base92.py — PNG -> 彩色图编码 -> Base92 文本 (游戏内 PixelMap 用)

输出文本最后一行即编码; 自行解出编码串后交给 PixelMap 迭代:
每次返回 ox, oy (0 起像素偏移) 与 Color(r,g,b,a) 克隆。

特性:
  * 输入不限尺寸: 大于 --max-size 的图先按比例 LANCZOS 缩至适配 (默认 128)
  * 调色板自动搜索: 从 256 色起逐档降色, 取 Base92 长度 <= --budget(默认 3000) 的最大色数
  * 索引面为左邻上下文自适应算术码流 (v3 格式: 无 magic/无调色板哨兵/两态 alpha 标志, 调色板按频率降序), alpha 原始字节
    与 util5 彩色图编解码块 v3 字节级一致, 编码后内置自检; 不支持旧版编码串

用法:
  python3 png2base92.py 图.png [-o 输出.txt] [--colors 64] [--budget 3000] [--max-size 128]

依赖: Pillow
"""
import argparse
import math
import sys

try:
    from PIL import Image
except ImportError:
    sys.exit("缺少 Pillow: pip install pillow")

B92 = "!#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[]^_`abcdefghijklmnopqrstuvwxyz{|}~"
assert len(B92) == 92

# ---------------- 彩色图编码器 v2（索引流：左邻上下文自适应算术码流） ----------------

FULL, HALF, Q1, Q3 = 2.0 ** 32 - 1, 2.0 ** 31, 2.0 ** 30, 3.0 * 2.0 ** 30


# ---------------- 彩色图编码器 ----------------

def _mode_of(pixels):
    partial = any(a not in (0, 255) for _, a in pixels)
    trans = any(a == 0 for _, a in pixels)
    return 2 if partial else (1 if trans else 0)


def _enc_index_stream(syms, M, w):
    """左邻上下文自适应算术码流（与 util5 Lua 解码逐位等价，WNC 32 位定点 E1/E2/E3）"""
    NSYM = M + 1
    out = bytearray()
    low, high, pend = 0.0, FULL, 0
    acc = nbits = 0
    ctxs = {}

    def putbit(b):
        nonlocal acc, nbits
        acc = acc * 2 + b
        nbits += 1
        if nbits == 8:
            out.append(acc)
            acc = nbits = 0

    def putbits(b):
        nonlocal pend
        putbit(b)
        while pend > 0:
            putbit(1 - b)
            pend -= 1

    left = NSYM
    for k, sym in enumerate(syms):
        z = ctxs.get(left)
        if z is None:
            z = [[1] * NSYM, NSYM]
            ctxs[left] = z
        f, t = z
        cum = 0
        for i in range(sym):
            cum += f[i]
        rng = high - low + 1
        high = low + math.floor(rng * (cum + f[sym]) / t) - 1
        low = low + math.floor(rng * cum / t)
        f[sym] += 1
        t += 1
        if t >= 32768:
            nt = 0
            for i in range(NSYM):
                f[i] = (f[i] + 1) // 2
                nt += f[i]
            z[1] = nt
        else:
            z[1] = t
        left = sym
        if k % w == w - 1:
            left = NSYM
        while True:
            if high < HALF:
                putbits(0)
            elif low >= HALF:
                putbits(1)
                low -= HALF
                high -= HALF
            elif low >= Q1 and high < Q3:
                pend += 1
                low -= Q1
                high -= Q1
            else:
                break
            low *= 2
            high = high * 2 + 1
    pend += 1
    if low < Q1:
        putbits(0)
    else:
        putbits(1)
    if nbits > 0:
        out.append(acc << (8 - nbits))
    return bytes(out)


def encode_color_codec(w, h, pixels, palette):
    """palette: ('custom', [(r,g,b),...]); pixels: [(c,a)...] 行优先，c 为 1 基调色板索引（a=0 的像素 c 为占位）"""
    from collections import Counter
    rgb = palette[1]
    mode = _mode_of(pixels)
    freq = Counter(c for c, a in pixels if a > 0)
    order = sorted(freq, key=lambda c: (-freq[c], c))
    remap = {c: i + 1 for i, c in enumerate(order)}
    M = len(order)
    syms = [0 if a == 0 else remap[c] for c, a in pixels]
    out = bytearray([1 if mode == 2 else 0, M])
    for c in order:
        out += bytes(rgb[c - 1])
    if w <= 254 and h <= 254:
        out += bytes([w, h])
    else:
        out += bytes([0xFF, w >> 8, w & 255, h >> 8, h & 255])
    if mode == 2:
        out += bytes(a for _, a in pixels)
    out += _enc_index_stream(syms, M, w)
    return bytes(out)


def decode_color_codec(data):
    """自检用解码器: 返回 (w, h, pixels[(c,a)...], pal_color 函数)，c 为重映射后 1 基索引，0=透明"""
    p = 0
    has_alpha = data[p] == 1
    M = data[p + 1]
    p += 2
    pal_rgb = [tuple(data[p + 3 * i:p + 3 * i + 3]) for i in range(M)]
    p += 3 * M
    wb = data[p]
    p += 1
    if wb == 0xFF:
        w = data[p] * 256 + data[p + 1]
        h = data[p + 2] * 256 + data[p + 3]
        p += 4
    else:
        w, h = wb, data[p]
        p += 1
    assert w >= 1 and h >= 1, "bad dims"
    n = len(data)
    if has_alpha:
        assert p + w * h <= n, "alpha truncated"
        alpha = data[p:p + w * h]
        p += w * h
    else:
        alpha = None
    NSYM = M + 1
    bp, bb, bn = p, data[p], 0

    def getbit():
        nonlocal bp, bb, bn
        bn += 1
        if bn > 8:
            bn = 1
            bp += 1
            bb = data[bp] if bp < n else 0
        return (bb >> (8 - bn)) & 1

    low, high = 0.0, FULL
    code = 0.0
    for _ in range(32):
        code = code * 2 + getbit()
    ctxs = {}
    flat = []
    for _y in range(h):
        left = NSYM
        for _x in range(w):
            z = ctxs.get(left)
            if z is None:
                z = [[1] * NSYM, NSYM]
                ctxs[left] = z
            f, t = z
            rng = high - low + 1
            ls = low
            cc = 0
            for si in range(NSYM):
                fs = f[si]
                cc += fs
                nhs = low + math.floor(rng * cc / t) - 1
                if code <= nhs:
                    sym = si
                    high = nhs
                    break
                ls = nhs + 1
            low = ls
            f[sym] += 1
            t += 1
            if t >= 32768:
                nt = 0
                for i in range(NSYM):
                    f[i] = (f[i] + 1) // 2
                    nt += f[i]
                z[1] = nt
            else:
                z[1] = t
            flat.append(sym)
            left = sym
            while True:
                if high < HALF:
                    pass
                elif low >= HALF:
                    low -= HALF
                    high -= HALF
                    code -= HALF
                elif low >= Q1 and high < Q3:
                    low -= Q1
                    high -= Q1
                    code -= Q1
                else:
                    break
                low *= 2
                high = high * 2 + 1
                code = code * 2 + getbit()
    pixels = [[sym, 0 if (has_alpha or sym == 0) else 255] for sym in flat]
    if has_alpha:
        for k in range(w * h):
            pixels[k][1] = alpha[k]

    def pal_color(i):
        return pal_rgb[i - 1] if i >= 1 else (0, 0, 0)

    return w, h, [tuple(px) for px in pixels], pal_color


def enc_raw(data: bytes) -> str:
    pad = (4 - len(data) % 4) % 4
    data += b"\0" * pad
    out = [B92[pad]]
    for i in range(0, len(data), 4):
        v = int.from_bytes(data[i:i + 4], "big")
        chars = []
        for _ in range(5):
            chars.append(B92[v % 92])
            v //= 92
        out.append("".join(reversed(chars)))
    return "".join(out)


# ---------------- 调色 ----------------

def quantize_adaptive(img_rgba, colors):
    """中位切分自适应调色板 (关闭抖动, 更利压缩); 返回 (去重后的实际色板, 重映射索引)"""
    q = img_rgba.convert("RGB").quantize(colors=colors, method=Image.Quantize.MEDIANCUT,
                                         dither=Image.Dither.NONE)
    flat = q.getpalette() or []
    idx = list(q.getdata())
    used = sorted(set(idx))
    palette, remap = [], {}
    for k, ci in enumerate(used):
        remap[ci] = k
        palette.append(tuple(flat[3 * ci + ch] if 3 * ci + ch < len(flat) else 0
                             for ch in range(3)))
    return palette, [remap[i] for i in idx]


# ---------------- 主流程 ----------------

COLOR_STEPS = [255, 224, 192, 160, 128, 112, 96, 80, 64, 56, 48, 40, 32,
               28, 24, 20, 16, 14, 12, 10, 8, 7, 6, 5, 4, 3, 2]


def build_pixels(img, ncolors):
    ncolors = min(max(1, ncolors), 255)  # 色板数以 1 字节存储，上限 255
    palette_rgb, idx = quantize_adaptive(img, ncolors)
    pal = ('custom', palette_rgb)
    px = list(img.getdata())
    pixels = [(idx[i] + 1, px[i][3]) for i in range(img.size[0] * img.size[1])]
    return pixels, pal


def main():
    ap = argparse.ArgumentParser(description="PNG -> Base92(彩色图编码), 供 PixelMap 使用")
    ap.add_argument("png", help="输入 PNG 路径")
    ap.add_argument("-o", "--output", help="输出文件 (默认 stdout)")
    ap.add_argument("--colors", type=int, default=64, help="自定义调色板色数 1..255 (默认 64)")
    ap.add_argument("--budget", type=int, default=3000, help="Base92 字符预算 (默认 3000)")
    ap.add_argument("--max-size", type=int, default=128, help="尺寸上限 (默认 128)")
    args = ap.parse_args()

    img = Image.open(args.png).convert("RGBA")
    ow, oh = img.size
    if ow > args.max_size or oh > args.max_size:
        img.thumbnail((args.max_size, args.max_size), Image.Resampling.LANCZOS)
    w, h = img.size

    def attempt(n):
        pixels, pal = build_pixels(img, n)
        data = encode_color_codec(w, h, pixels, pal)
        return data, enc_raw(data), pixels, pal[1]

    chosen = None
    if not 1 <= args.colors <= 255:
        sys.exit("--colors 需为 1..255")
    steps = [c for c in COLOR_STEPS if c <= args.colors]
    if steps[0] != args.colors:
        steps.insert(0, args.colors)
    for n in steps:
        data, encoded, pixels, pal_rgb = attempt(n)
        if len(encoded) <= args.budget:
            chosen = (f"自适应 {n} 色", n, data, encoded, pixels, pal_rgb)
            break
    if chosen is None:
        n = steps[-1]
        print(f"警告: 即使 {n} 色也超出预算 ({len(encoded)} > {args.budget} 字符), 已用最小色数输出",
              file=sys.stderr)
        chosen = (f"自适应 {n} 色", n, data, encoded, pixels, pal_rgb)

    desc, ncolors, data, encoded, pixels, pal_rgb = chosen

    # 自检: 解码回读比对（索引已按频率重映射，按 RGBA 比对）
    _, _, dec_pixels, pal_color = decode_color_codec(data)
    mode = _mode_of(pixels)
    for i, (c, a) in enumerate(pixels):
        dc, da = dec_pixels[i]
        if a == 0:
            assert dc == 0 and da == 0, f"自检失败 at pixel {i}"
        else:
            assert da == (a if mode == 2 else 255), f"自检失败 at pixel {i}"
            assert pal_color(dc) == tuple(pal_rgb[c - 1]), f"自检失败 at pixel {i}"

    resize_note = f", 原图 {ow}x{oh} 已缩放" if (ow, oh) != (w, h) else ""
    note = (f"-- {w}x{h}{resize_note} | {desc} | 模式{mode} | 编码 {len(data)}B -> base92 {len(encoded)} 字符"
            f" | 预算 {args.budget} | 自检通过\n")
    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(note + encoded + "\n")
        print(f"已写出 {args.output}: {w}x{h}, {desc}, 模式{mode}, {len(data)}B -> {len(encoded)} 字符, 自检通过",
              file=sys.stderr)
    else:
        # 浏览器/管道模式: 只输出带双引号的 Lua 字面量（编码 alphabet 不含 " 与 \，安全）
        sys.stdout.write('"' + encoded + '"\n')


if __name__ == "__main__":
    main()
