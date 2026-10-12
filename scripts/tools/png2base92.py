#!/usr/bin/env python3
# --[[ 工具规格
# id: png2base92
# title: 图片转 Base92
# desc: 图片缩至 128x128 内、量化后编码为 Base92 彩色图编码（预算内取最大色数，内置自检，输出带引号字面量）
# inputs: [{name: img, type: file, label: 图片文件, accept: "image/png,image/jpeg"}, {name: budget, type: number, label: 字符预算, default: 3000}, {name: max-size, type: number, label: 尺寸上限, default: 128}]
# ]]
"""png2base92.py — PNG -> 彩色图编码 -> Base92 文本 (游戏内 PixelMap 用)

输出文本最后一行即编码; 自行解出编码串后交给 PixelMap 迭代:
每次返回 ox, oy (0 起像素偏移) 与 Color(r,g,b,a) 克隆。

特性:
  * 输入不限尺寸: 大于 --max-size 的图先按比例 LANCZOS 缩至适配 (默认 128)
  * 调色板自动搜索: 从 256 色起逐档降色, 取 Base92 长度 <= --budget(默认 3000) 的最大色数
  * 索引面三选一 (位打包/字节RLE/WNC算术位图平面), alpha 面三选一 (原始/RLE/位平面)
    与 util5 彩色图编解码块字节级一致, 编码后内置自检

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

# ---------------- WNC 位图算术编解码 (与 util5 BinMatrixCodec 同格式/同算法) ----------------

FULL, HALF, Q1, Q3 = 2.0 ** 32 - 1, 2.0 ** 31, 2.0 ** 30, 3.0 * 2.0 ** 30


def b2i(v):
    return 1 if (type(v) in (int, float)) and v > 0 else 0


def bm_enc(bits, w, h):
    """bits: 行优先 0/1 列表 -> BinMatrixCodec 格式 bytes"""
    out = bytearray()
    if w <= 254 and h <= 254:
        out += bytes([w, h])
    else:
        out += bytes([255, w >> 8, w & 255, h >> 8, h & 255])
    low, high, pend = 0.0, FULL, 0
    acc, nbits = 0, 0
    probs = [32768] * 8

    def putbit(bit):
        nonlocal acc, nbits
        acc = acc * 2 + bit
        nbits += 1
        if nbits == 8:
            out.append(acc)
            acc, nbits = 0, 0

    def putbits(bit):
        nonlocal pend
        putbit(bit)
        while pend > 0:
            putbit(1 - bit)
            pend -= 1

    for y in range(1, h + 1):
        for x in range(1, w + 1):
            L = bits[(y - 1) * w + (x - 2)] if x > 1 else 0
            U = bits[(y - 2) * w + (x - 1)] if y > 1 else 0
            UL = bits[(y - 2) * w + (x - 2)] if x > 1 and y > 1 else 0
            ctx = b2i(L) * 4 + b2i(U) * 2 + b2i(UL)
            bit = b2i(bits[(y - 1) * w + (x - 1)])
            p0 = probs[ctx]
            split = low + math.floor((high - low + 1.0) * p0 / 65536.0)
            if bit == 0:
                high = split - 1.0
                p0 = p0 + ((65536 - p0) >> 5)
            else:
                low = split
                p0 = p0 - (p0 >> 5)
            probs[ctx] = p0
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
                low *= 2.0
                high = high * 2.0 + 1.0
    pend += 1
    if low < Q1:
        putbits(0)
    else:
        putbits(1)
    if nbits > 0:
        out.append(acc << (8 - nbits))
    return bytes(out)


def bm_dec(data, pos=0):
    """返回 (bits 行优先列表, w, h, 下一位置)"""
    n = len(data)
    wb = data[pos]; pos += 1
    if wb == 255:
        w = data[pos] * 256 + data[pos + 1]
        h = data[pos + 2] * 256 + data[pos + 3]
        pos += 4
    else:
        w, h = wb, data[pos]
        pos += 1
    if w == 0 or h == 0:
        return [0] * (w * h), w, h, pos
    bp, bb, bn = pos, data[pos], 0

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
        code = code * 2.0 + getbit()
    probs = [32768] * 8
    bits = [0] * (w * h)
    for y in range(1, h + 1):
        for x in range(1, w + 1):
            L = bits[(y - 1) * w + (x - 2)] if x > 1 else 0
            U = bits[(y - 2) * w + (x - 1)] if y > 1 else 0
            UL = bits[(y - 2) * w + (x - 2)] if x > 1 and y > 1 else 0
            ctx = b2i(L) * 4 + b2i(U) * 2 + b2i(UL)
            p0 = probs[ctx]
            split = low + math.floor((high - low + 1.0) * p0 / 65536.0)
            if code < split:
                bit = 0
                high = split - 1.0
                p0 = p0 + ((65536 - p0) >> 5)
            else:
                bit = 1
                low = split
                p0 = p0 - (p0 >> 5)
            probs[ctx] = p0
            bits[(y - 1) * w + (x - 1)] = bit
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
                low *= 2.0
                high = high * 2.0 + 1.0
                code = code * 2.0 + getbit()
    return bits, w, h, bp + 1


# ---------------- 彩色图编码器 ----------------

def _mode_of(pixels):
    partial = any(a not in (0, 255) for _, a in pixels)
    trans = any(a == 0 for _, a in pixels)
    return 2 if partial else (1 if trans else 0)


def _bit_width(count):
    bits = 1
    while (1 << bits) < count:
        bits += 1
    return bits


def _pack_bits(values, bits):
    out = bytearray()
    acc = acnt = 0
    mask = (1 << bits) - 1
    for v in values:
        acc = ((acc << bits) | (v & mask))
        acnt += bits
        while acnt >= 8:
            acnt -= 8
            out.append((acc >> acnt) & 255)
            acc &= (1 << acnt) - 1
    if acnt > 0:
        out.append((acc << (8 - acnt)) & 255)
    return bytes(out)


def _rle(values, es):
    out = bytearray()
    i, n = 0, len(values)
    while i < n:
        v = values[i]
        j = i + 1
        while j < n and values[j] == v and j - i < 255:
            j += 1
        out.append(j - i)
        out.append(v & 255)
        if es == 2:
            out.append((v >> 8) & 255)
        i = j
    return bytes(out)


def encode_color_codec(w, h, pixels, palette, wnc=True):
    """palette: ('custom', [(r,g,b),...]); pixels: [(c,a)...] 行优先"""
    rgb = palette[1]
    N = len(rgb)
    pal_desc = bytes([0xFF, N]) + bytes(v for c in rgb for v in c)
    mode = _mode_of(pixels)
    n = w * h

    def stored(i):
        c, a = pixels[i]
        if mode == 0:
            return c - 1
        if mode == 1:
            return 0 if a == 0 else c
        return c

    bits = _bit_width(N if mode == 0 else N + 1)
    es = 1 if bits <= 8 else 2
    values = [stored(i) for i in range(n)]

    out = bytearray([0xCC, mode])
    out += pal_desc
    if w <= 254 and h <= 254:
        out += bytes([w, h])
    else:
        out += bytes([0xFF, w >> 8, w & 255, h >> 8, h & 255])

    # 索引面三选一
    packed = _pack_bits(values, bits)
    rleb = _rle(values, es)
    best, flag = packed, 0
    if len(rleb) < len(best):
        best, flag = rleb, 4
    if wnc:
        used = sorted({c for c, _a in pixels if c >= 1})
        planes = bytearray([len(used)])
        planes += bytes(used)
        for uc in used:
            bm = [1 if c == uc else 0 for c, _a in pixels]
            st = bm_enc(bm, w, h)
            planes += len(st).to_bytes(2, "big")
            planes += st
        if len(planes) < len(best):
            best, flag = bytes(planes), 8
    flagpos = len(out)
    out.append(flag)
    out += best

    if mode == 2:
        alphas = [a for _, a in pixels]
        rawb = bytes(alphas)
        arle = _rle(alphas, 1)
        abest, abf = rawb, 2
        if 2 * len(arle) < n and len(arle) * 2 < len(abest):
            abest, abf = arle, 1
        if wnc:
            aplanes = bytearray()
            for b in range(8):
                bm = [(a >> b) & 1 for a in alphas]
                st = bm_enc(bm, w, h)
                aplanes += len(st).to_bytes(2, "big")
                aplanes += st
            if len(aplanes) < len(abest):
                abest, abf = bytes(aplanes), 16
        out[flagpos] = flag | abf
        out += abest
    return bytes(out)


def decode_color_codec(data):
    """自检用解码器: 返回 (w, h, pixels[(c,a)...], pal_color 函数)"""
    p = 0
    assert data[p] == 0xCC, "bad magic"
    mode = data[p + 1]
    p += 2
    pb = data[p]; p += 1
    assert pb == 0xFF, "only custom palette supported"
    pal_rgb = None
    sz = data[p]; p += 1
    pal_rgb = [tuple(data[p + 3 * i:p + 3 * i + 3]) for i in range(sz)]
    p += 3 * sz
    N = sz
    wb = data[p]; p += 1
    if wb == 0xFF:
        w = data[p] * 256 + data[p + 1]
        h = data[p + 2] * 256 + data[p + 3]
        p += 4
    else:
        w, h = wb, data[p]
        p += 1
    bits = _bit_width(N if mode == 0 else N + 1)
    es = 1 if bits <= 8 else 2
    flag = data[p]; p += 1
    total = w * h

    if flag & 8:
        M = data[p]; p += 1
        used = list(data[p:p + M]); p += M
        flat = [0] * total
        for uc in used:
            ln = int.from_bytes(data[p:p + 2], "big"); p += 2
            bm, bw, bh, _ = bm_dec(data[p:p + ln], 0)
            assert (bw, bh) == (w, h)
            p += ln
            for k in range(total):
                if bm[k]:
                    flat[k] = uc
        # 注意: 平面分支磁盘上存的是真实 c (1 基), 不再 +1
    elif flag & 4:
        flat = []
        while len(flat) < total:
            run = data[p]
            if es == 1:
                v = data[p + 1]; p += 2
            else:
                v = data[p + 1] | (data[p + 2] << 8); p += 3
            assert 1 <= run and len(flat) + run <= total, "bad index rle"
            flat.extend([v] * run)
        if mode == 0:
            flat = [v + 1 for v in flat]
    else:
        acc = acnt = 0
        flat = []
        for _ in range(total):
            while acnt < bits:
                acc = (acc << 8) | data[p]
                p += 1
                acnt += 8
            acnt -= bits
            flat.append((acc >> acnt) & ((1 << bits) - 1))
            acc &= (1 << acnt) - 1
        if mode == 0:
            flat = [v + 1 for v in flat]

    pixels = [[c, 0 if (mode == 2 or c == 0) else 255] for c in flat]
    if mode == 2:
        if flag & 16:
            for b in range(8):
                ln = int.from_bytes(data[p:p + 2], "big"); p += 2
                bm, bw, bh, _ = bm_dec(data[p:p + ln], 0)
                assert (bw, bh) == (w, h)
                p += ln
                for k in range(total):
                    if bm[k]:
                        pixels[k][1] |= (1 << b)
        elif (flag & 3) == 2:
            for k in range(total):
                pixels[k][1] = data[p]; p += 1
        elif (flag & 3) == 1:
            got = 0
            while got < total:
                run, a = data[p], data[p + 1]; p += 2
                assert 1 <= run and got + run <= total, "bad alpha rle"
                for k in range(got, got + run):
                    pixels[k][1] = a
                got += run
        else:
            raise ValueError("bad alpha flag")

    def pal_color(i):
        return pal_rgb[i - 1] if i >= 1 else (0, 0, 0)

    return w, h, [tuple(px) for px in pixels], pal_color


# ---------------- Base92 ----------------

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
        return data, enc_raw(data), pixels

    chosen = None
    if not 1 <= args.colors <= 255:
        sys.exit("--colors 需为 1..255")
    steps = [c for c in COLOR_STEPS if c <= args.colors]
    if steps[0] != args.colors:
        steps.insert(0, args.colors)
    for n in steps:
        data, encoded, pixels = attempt(n)
        if len(encoded) <= args.budget:
            chosen = (f"自适应 {n} 色", n, data, encoded, pixels)
            break
    if chosen is None:
        n = steps[-1]
        print(f"警告: 即使 {n} 色也超出预算 ({len(encoded)} > {args.budget} 字符), 已用最小色数输出",
              file=sys.stderr)
        chosen = (f"自适应 {n} 色", n, data, encoded, pixels)

    desc, ncolors, data, encoded, pixels = chosen

    # 自检: 解码回读比对
    _, _, dec_pixels, _ = decode_color_codec(data)
    mode = _mode_of(pixels)
    for i, (c, a) in enumerate(pixels):
        dc, da = dec_pixels[i]
        if mode != 2 and (c == 0 or a == 0) and (dc == 0 or da == 0):
            continue
        assert (dc, da) == (c, a), f"自检失败 at pixel {i}"

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
