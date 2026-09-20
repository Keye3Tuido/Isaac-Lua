#!/usr/bin/env python
"""一次性迁移（验收参考同步）：给旧格式参考目录里的每个挑战文件在重开行之后、
`--.` 终止行之前追加 random-string 输出块（用户指定的新增行为），
使 verify_equivalence / verify_comments 与「后置追加 random-string 块」的新管线对齐。

用法：python scripts/append_random_to_old_refs.py <旧lua目录> [<旧lua目录> ...]
"""
import os
import sys

COMMENT = "--输出随机字符串。"
CODE = "l Isaac.ConsoleOutput(tostring({}):match('%w%w%w%w$'))"


def update_dir(lua_dir):
    ch = os.path.join(lua_dir, "challenges")
    if not os.path.isdir(ch):
        print(f"SKIP  {lua_dir}（无 challenges 目录）")
        return
    done = 0
    for fname in sorted(os.listdir(ch)):
        if not fname.endswith(".lua"):
            continue
        path = os.path.join(ch, fname)
        with open(path, encoding="utf-8") as f:
            raw = f.read()
        if CODE in raw:
            print(f"SKIP  {fname}（已含 random-string 行）")
            continue
        lines = raw.split("\n")
        try:
            t = next(i for i in range(len(lines) - 1, -1, -1) if lines[i].strip() == "--.")
        except StopIteration:
            raise SystemExit(f"错误：{fname} 缺少 '--.' 终止行，未追加。")
        new = lines[:t] + [COMMENT, CODE] + lines[t:]
        with open(path, "w", encoding="utf-8", newline="") as f:
            f.write("\n".join(new))
        done += 1
    print(f"{lua_dir}：追加 {done} 个文件")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        raise SystemExit("用法：python scripts/append_random_to_old_refs.py <旧lua目录> [...]")
    for d in sys.argv[1:]:
        update_dir(d)
