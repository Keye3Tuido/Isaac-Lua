#!/usr/bin/env python
"""T6 全量扫描：挑战块中两类参数化遗漏候选。

a类：说明含可配置表述（默认X / X秒 / X% / X帧 / 道具N 等），但块没有任何参数（面板改不了）。
b类：代码中有独立可调字面量且在说明中有呼应，但未参数化。
附带 a2 观察：块有参数但说明为整段覆盖字面量（面板改参后说明不跟随，仅统计）。

只读分析，不改文件。
"""
import os
import re
import sys

REPO = r"D:\HuaweiMoveData\Users\Soar\Desktop\游戏\ISAAC\Isaac-Lua"
sys.path.insert(0, REPO)
import GenerateHtml as G

# 说明中的可配置表述
PAT_DEFAULT = re.compile(r"默认[：:]?[\w.~+-]+")                       # 默认X / （默认50）
PAT_UNIT = re.compile(r"\d+(?:\.\d+)?(?:e-?\d+)?\s*(?:秒|帧|%|毫秒|格|倍)")  # X秒/X帧/X%/X毫秒/X格/X倍
PAT_ITEM = re.compile(r"(?:道具|饰品|卡牌|符文|魂石|药丸)\d+")          # 道具N 等

# 代码字面量（粗略）：>=2 位的数字、或带小数点的数、或科学计数法；跳过字符串/注释内容
NUM_RE = re.compile(r"(?<![A-Za-z0-9_.])(\d+\.\d+|\d+e-?\d+|\d{2,})(?![A-Za-z0-9_])")


def strip_strings_comments(code):
    """去掉 '...' "..." 与行注释，避免把字符串内容当字面量。"""
    out = []
    i, n = 0, len(code)
    while i < n:
        c = code[i]
        if c in "'\"":
            j = i + 1
            while j < n:
                if code[j] == "\\":
                    j += 2
                    continue
                if code[j] == c:
                    break
                j += 1
            out.append(" ")
            i = j + 1
        elif c == "-" and code[i:i + 2] == "--":
            j = code.find("\n", i)
            j = n if j < 0 else j
            out.append(" ")
            i = j
        else:
            out.append(c)
            i += 1
    return "".join(out)


def main():
    entries, registry = G.build(os.path.join(REPO, "lua"))
    a_cand, b_cand, a2_obs = [], [], []
    for e in entries:
        if not e["isChallenge"]:
            continue
        for b in e["blocks"]:
            comment = str(b["comment"])
            code = b["final_code"]
            tpl_params = registry[b["tpl"]]["params"] if b.get("tpl") else {}
            has_params = bool(tpl_params) or bool(b.get("params_def"))
            overridden = bool(b.get("tpl")) and ("说明" in b["meta"])
            exprs = set()
            for pat in (PAT_DEFAULT, PAT_UNIT, PAT_ITEM):
                exprs.update(pat.findall(comment))
            if exprs and not has_params:
                a_cand.append((e["fname"], b["num"], sorted(exprs), comment.split("\n")[0][:70]))
            elif exprs and has_params and overridden:
                a2_obs.append((e["fname"], b["num"], b.get("tpl"), sorted(exprs)))
            # b 类：代码字面量在说明中有呼应、块无参数
            if not has_params:
                plain = strip_strings_comments(code)
                lits = {}
                for m in NUM_RE.finditer(plain):
                    lit = m.group(1)
                    lits[lit] = lits.get(lit, 0) + 1
                echoed = [lit for lit in lits
                          if lit in comment or lit.lstrip("0") in comment
                          or (lit.startswith("0.") and lit[1:] in comment)]
                if echoed:
                    b_cand.append((e["fname"], b["num"], sorted(echoed), comment.split("\n")[0][:70]))

    print("== a类候选（说明含可配置表述，块无参数）==", len(a_cand))
    for f, n, ex, head in a_cand:
        print(f"  {f} 块{n}: {ex}  | {head}")
    print()
    print("== b类候选（代码字面量与说明呼应，未参数化）==", len(b_cand))
    for f, n, lits, head in b_cand:
        print(f"  {f} 块{n}: {lits}  | {head}")
    print()
    print("== a2观察（块有参数但说明为整段覆盖字面量）==", len(a2_obs))
    for f, n, t, ex in a2_obs:
        print(f"  {f} 块{n} (tpl={t}): {ex}")


if __name__ == "__main__":
    main()
