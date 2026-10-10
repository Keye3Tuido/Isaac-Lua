"""enc92_tool：交互式 base-92 编码器。

运行后输入任意文本（可含中文），回车即输出 base-92 字面量；
空输入或 Ctrl+Z/Ctrl+D 退出。与 codec-base92 模板共用同一字母表与补齐约定。
"""
import sys

# 92 个可打印安全字符（33-126，去掉 " 和 \），与模板内 A 完全一致
A = ''.join(chr(c) for c in range(33, 127) if c not in (34, 92))


def enc92(data: bytes) -> str:
    """二进制串 -> base-92 字面量（首字符编码补齐位数 0-3）"""
    pad = (4 - len(data) % 4) % 4
    data = data + b'\0' * pad
    out = [A[pad]]
    for i in range(0, len(data), 4):
        a = int.from_bytes(data[i:i + 4], 'big')
        grp = []
        for _ in range(5):
            grp.append(A[a % 92])
            a //= 92
        out.append(''.join(reversed(grp)))
    return '"' + ''.join(out) + '"'


def dec92(lit: str) -> bytes:
    """base-92 字面量 -> 二进制串（与模板 d92 同逻辑）"""
    s = lit[1:-1] if lit[:1] in '"\'' else lit
    D = {c: i for i, c in enumerate(A)}
    pad = D[s[0]]
    assert pad <= 3, 'bad padding char'
    out = bytearray()
    for i in range(1, len(s), 5):
        a = 0
        for c in s[i:i + 5]:
            a = a * 92 + D[c]
        out += a.to_bytes(5, 'big')[1:]
    return bytes(out[:len(out) - pad]) if pad else bytes(out)


def main():
    while True:
        try:
            s = input('输入文本（空输入退出）：')
        except EOFError:
            break
        if not s:
            break
        print(enc92(s.encode('utf-8')))
        print()


if __name__ == '__main__':
    main()
