#!/usr/bin/env python
"""注释还原验收门：新版管线渲染注释 vs 旧版（git 621858d）原始注释逐块比较。

口径（任务「最高准则」）：
  旧文件第一个含代码的块为段 0（对应新版前置区），不参与比较；
  段 0 之后各效果块与新版 region≠pre 的块（正文+后置）按序 1:1 对齐；
  旧文件末尾 '--.' 终止块忽略；
  旧注释逐行剥离 '--'、'--N.' 前缀（前缀后单个空格一并剥离）后与新版渲染注释逐字比较。
  比较前对两侧做全角花括号归一（｛｝→{}）：说明中的描述性花括号在新管线必须用全角
  以避免被插值槽 SLOT_RE 误判（任务明确规定「全角｛｝保持防槽误判」），旧版为半角。

白名单：
  1.御灵术.lua 的 wisp-soul-system 块可豁免（.37/0.37 前导零与 1e-3/0.1% 显示差异）；
  1.御灵术.lua 的 multi-choice-spawn 块（正文块2）可豁免（用户指定的注释形态：
  「每开启新游戏时，在初始房间根据玩家人数n，生成n组多选一道具（道具653-驱魔护符）」，与原注释不同）；
  15.勇往直前.lua 的 door-id-map 块（正文块2）可豁免（用户指定的模板说明
  「提供全局接口用于获取门的唯一编号。」，原注释为「2. 用于获取门的编号，无实际效果」）。
手工序号前缀豁免（T9）：
  说明中的手工数字编号已物理删除，页面显示恢复一律自动编号；旧注释首行允许比新说明
  多出「N. 」或「N.」手工前缀，剥去后其余内容必须逐字一致，否则按差异处理。
依赖行豁免：
  下列 7 块的说明中原有的「依赖代码N」说明行已删除（依赖关系改由 YAML 依赖 字段与
  前端依赖标记表达）。这些块的旧注释允许去掉末尾连续的「依赖代码N」行后与新注释比较；
  若旧注释末尾没有依赖行，说明豁免条目已失效，按差异处理以防白名单腐化。
  （14 块6、15 块4、15 块11、19 块2、23 块3、24 块2、28 块2）

用法：
  python scripts/verify_comments.py                 # 默认旧目录 /tmp/old6218/lua
  python scripts/verify_comments.py --old-dir <dir> --new-dir lua

退出码：0 = 除白名单外零差异；1 = 存在差异或结构错位。
"""
import argparse
import difflib
import os
import re
import sys

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, REPO_ROOT)

import GenerateHtml as G

# 白名单：(文件名, 模板id)——该块的渲染注释允许与旧注释不同
# 键 = (文件名, 模板id, 块编号)，逐位置精确匹配，None 不允许通配
WHITELIST = {("39.跳跳乐.lua", None, "2"),  # 用户自定内容（结尾无问号）
             ("1.御灵术.lua", "wisp-soul-system", "2"),
             ("1.御灵术.lua", "multi-choice-spawn", "3"),
             # 15号门编号块改用 door-id-map 模板，说明为用户指定的模板说明
             ("15.勇往直前.lua", "door-id-map", "2"),
             # 15号开图块为自定义变体（保留 VisitedCount），说明按用户要求与模板区分
             ("15.勇往直前.lua", None, "3")}

# 依赖行豁免：(文件名, 块编号)——旧注释去掉末尾连续「依赖代码N」行后再比较（见模块 docstring）
DEP_LINE_BLOCKS = {
    ("14.突击考试.lua", "6"),
    ("15.勇往直前.lua", "4"),
    ("15.勇往直前.lua", "11"),
    ("19.网络延迟.lua", "2"),
    ("23.子弹时间.lua", "3"),
    ("24.拖家带口.lua", "2"),
    ("28.炸膛大炮.lua", "2"),
}
_DEP_LINE_RE = re.compile(r"^依赖代码\d+\.?$")
_MANUAL_PREFIX_RE = re.compile(r"^\d+\.\s?")   # 手工序号前缀：「N. 」或「N.」（T9 豁免）

_FIRST_PREFIX_RE = re.compile(r"^--(\d+\.)?\s?")   # '--N. xxx' / '--N.xxx' / '-- xxx' / '--xxx'
_CONT_PREFIX_RE = re.compile(r"^--\s?")            # 续行：'-- xxx' / '--xxx'
_BRACE_TABLE = str.maketrans("｛｝", "{}")          # 全角花括号 → 半角（防槽误判约定，见模块 docstring）


def _manual_prefix_only(old_c, new_c):
    """T9 手工序号前缀豁免：旧注释首行仅比新说明多「N. 」/「N.」前缀时视为一致。"""
    o, n = old_c.split("\n"), new_c.split("\n")
    if len(o) != len(n):
        return False
    m = _MANUAL_PREFIX_RE.match(o[0])
    if not m:
        return False
    return o[0][m.end():] == n[0] and o[1:] == n[1:]


def parse_old_blocks(text):
    """旧格式 → (段0之后的效果块注释列表)。每块 = 'l '代码行正上方连续注释行。"""
    lines = text.replace("\r\n", "\n").replace("\r", "\n").split("\n")
    blocks = []          # 全部含代码块（含段0），元素为注释字符串
    i = 0
    while i < len(lines):
        if lines[i].startswith("l "):
            # 向上收集连续注释行
            j = i - 1
            clines = []
            while j >= 0 and lines[j].startswith("--") and lines[j].strip() != "--.":
                clines.append(lines[j])
                j -= 1
            clines.reverse()
            if clines:
                first = _FIRST_PREFIX_RE.sub("", clines[0])
                rest = [_CONT_PREFIX_RE.sub("", c) for c in clines[1:]]
                blocks.append("\n".join([first] + rest))
            else:
                blocks.append("")
        i += 1
    if not blocks:
        return []
    return blocks[1:]     # 段 0 弃去


def main():
    ap = argparse.ArgumentParser(description="注释还原逐块验收")
    ap.add_argument("--old-dir", default="/tmp/old6218/lua",
                    help="旧版 lua 目录（git 621858d 展开）")
    ap.add_argument("--new-dir", default=os.path.join(REPO_ROOT, "lua"),
                    help="新格式 lua 目录（默认仓库 lua/）")
    ap.add_argument("--verbose", action="store_true", help="同时输出白名单豁免块")
    args = ap.parse_args()

    try:
        entries, _registry = G.build(args.new_dir)
    except SystemExit as exc:
        print(f"FAIL  新管线构建失败：{exc}")
        return 1

    n_diff = n_white = n_ok = n_dep = n_man = 0
    details = []
    for e in entries:
        if not e["isChallenge"]:
            continue
        fname = e["fname"]
        old_path = os.path.join(args.old_dir, "challenges", fname)
        if not os.path.isfile(old_path):
            print(f"SKIP  {fname}（旧目录无此文件）")
            continue
        with open(old_path, encoding="utf-8") as f:
            old_blocks = parse_old_blocks(f.read())

        new_blocks = [b for b in e["blocks"] if b.get("region") != "pre"]
        if len(old_blocks) != len(new_blocks):
            n_diff += 1
            details.append(
                f"DIFF  {fname}：块数不一致（旧段0后 {len(old_blocks)} 块 / 新正文+后置 {len(new_blocks)} 块）")
            continue

        for old_c, b in zip(old_blocks, new_blocks):
            old_c = old_c.translate(_BRACE_TABLE)
            new_c = str(b["comment"]).translate(_BRACE_TABLE)
            if (fname, str(b["num"])) in DEP_LINE_BLOCKS:
                # 依赖行豁免：旧注释去掉末尾连续「依赖代码N」行后比较；未剥到行则条目失效按差异处理
                kept = old_c.split("\n")
                while kept and _DEP_LINE_RE.match(kept[-1]):
                    kept.pop()
                if len(kept) == len(old_c.split("\n")):
                    n_diff += 1
                    details.append(
                        f"DIFF  {fname} 块{b['num']}：依赖行豁免条目失效（旧注释末尾无「依赖代码N」行）")
                    continue
                old_c = "\n".join(kept)
                if old_c == new_c:
                    n_dep += 1
                    if args.verbose:
                        details.append(f"DEP   {fname} 块{b['num']}：依赖行豁免（旧注释去掉末尾依赖行后一致）")
                    continue
            elif old_c == new_c:
                n_ok += 1
                continue
            else:
                tag = (fname, b.get("tpl"), str(b["num"]))
                if tag in WHITELIST:
                    n_white += 1
                    if args.verbose:
                        details.append(f"WHITE {fname} 块{b['num']}（{b.get('tpl')}）：白名单豁免")
                    continue
            if _manual_prefix_only(old_c, new_c):
                n_man += 1
                if args.verbose:
                    details.append(f"MAN   {fname} 块{b['num']}：手工序号前缀豁免（旧注释首行多「N. 」前缀）")
                continue
            n_diff += 1
            diff = "\n".join(difflib.unified_diff(
                old_c.split("\n"), new_c.split("\n"),
                fromfile=f"旧 {fname} 块{b['num']}", tofile=f"新 {fname} 块{b['num']}",
                lineterm=""))
            details.append(f"DIFF  {fname} 块{b['num']}" +
                           (f"（模板 {b['tpl']}）" if b.get("tpl") else "") + "\n" + diff)

    for d in details:
        print(d)
        print()
    print(f"合计：一致 {n_ok} / 差异 {n_diff} / 白名单豁免 {n_white} / 依赖行豁免 {n_dep} / 手工序号前缀豁免 {n_man}")
    return 1 if n_diff else 0


if __name__ == "__main__":
    sys.exit(main())
