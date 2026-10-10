"""enc92_tool：base-92 编码器。

无参数运行：进入交互模式，逐行输入任意文本（可含中文），回车即输出 base-92 字面量；
空输入、Ctrl+D（部分终端需再按回车）或 Ctrl+Z 退出。
带参数运行：把参数（空格连接）编码为 base-92 字面量输出一次后退出。
与 codec-base92 模板共用同一字母表与补齐约定。
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
    # 带参数：参数空格连接后编码一次即退出（供命令行/管道直接取用）
    if len(sys.argv) > 1:
        print(enc92(' '.join(sys.argv[1:]).encode('utf-8')))
        return
    # 无参数：交互模式。不用 input() 读行——部分终端（如 Git Bash）里 Ctrl+D
    # 不会触发 EOFError，而是把 EOT(0x04) 当普通字节传入，因此按行读并显式判 EOT。
    while True:
        try:
            sys.stdout.write('输入文本（空输入或 Ctrl+D 退出）：')
            sys.stdout.flush()
            line = sys.stdin.readline()
        except KeyboardInterrupt:
            print()
            break
        if line == '':                      # EOF：Ctrl+D / Ctrl+Z+Enter / 管道关闭
            break
        line = line.rstrip('\r\n')
        if not line or '\x04' in line:      # 空输入退出；EOT 字节（Ctrl+D）也退出
            break
        print(enc92(line.encode('utf-8')))
        print()


if __name__ == '__main__':
    main()
