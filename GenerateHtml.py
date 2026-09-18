import os
import re
import json

try:
    import yaml
except ImportError:  # pragma: no cover
    raise SystemExit("错误：需要 pyyaml（pip install pyyaml）以解析代码块 YAML 头。")

# ========== 配置 ==========
LUA_DIR = "lua"
TITLE = "以撒代码挑战 - Keye3Tuido"

# 百度统计站点 ID：按访问域名选择，各域名数据进各自报表（后台分开）。
# 留空字典则生成的页面不含统计脚本，本地/未配置时完全无影响。
BAIDU_TJ_IDS = {
    "rep.keye3tuido.site": "fd1c95208e5bac55d3f660fca016d48d",
    "isaac.keye3tuido.site": "e6ad5c0ca12c28654a8fcc3f6f4dc9dd",
    "isaaclua.keye3tuido.site": "4f04defafe97ea3b8a9997d1152002a1",
}

# 目录即分类：lua/challenges → 挑战，lua/utils → 其他
CATEGORY_DIRS = [("challenges", True), ("utils", False)]

# 挑战文件分隔线：固定字面量，全文件恰好一次
SEPARATOR = "--===--"

# YAML 头允许出现的键（未知键仅警告，便于发现笔误）
KNOWN_HEAD_KEYS = {"模板", "说明", "参数", "作为模板", "名称", "依赖", "模板id", "参数定义"}

# 参数占位符名：P1、P2 … Pn
PARAM_NAME_RE = re.compile(r"^P\d+$")
# 替换后残留的占位符（token 边界）
LEFTOVER_PARAM_RE = re.compile(r"(?<![A-Za-z0-9_])P\d+(?![A-Za-z0-9_])")
# 说明插值槽 {P1}
SLOT_RE = re.compile(r"\{[^{}]*\}")


def _token_re(name):
    """参数名 token 边界匹配：仅当两侧不是 [A-Za-z0-9_] 时匹配。"""
    return re.compile(r"(?<![A-Za-z0-9_])" + re.escape(name) + r"(?![A-Za-z0-9_])")


_ROMAN_TABLE = [(1000, "M"), (900, "CM"), (500, "D"), (400, "CD"),
                (100, "C"), (90, "XC"), (50, "L"), (40, "XL"),
                (10, "X"), (9, "IX"), (5, "V"), (4, "IV"), (1, "I")]


def _roman(n):
    """正整数 → 罗马数字（大写）。"""
    out = []
    for v, s in _ROMAN_TABLE:
        while n >= v:
            out.append(s)
            n -= v
    return "".join(out)


def _lua_value(v):
    """参数值进代码：列表用 ',' 连接；布尔/空值转为 Lua 字面量。"""
    if isinstance(v, bool):
        return "true" if v else "false"
    if v is None:
        return ""
    if isinstance(v, (list, tuple)):
        return ",".join(_lua_value(x) for x in v)
    return str(v)


def _text_value(v):
    """参数值进文本（说明插值）：列表用 '、' 连接。"""
    if isinstance(v, bool):
        return "true" if v else "false"
    if v is None:
        return ""
    if isinstance(v, (list, tuple)):
        return "、".join(_text_value(x) for x in v)
    return str(v)


# ========== 读取外部资源 ==========
def _read_asset(path):
    try:
        with open(path, encoding="utf-8") as f:
            return f.read()
    except FileNotFoundError:
        raise SystemExit(f"错误：缺少必要文件 {path}，请确保 style.css 和 page.js 存在于项目根目录。")


# ========== 文本清理 ==========
def clean_code(s):
    return "\n".join(
        l[2:] if l.startswith("l ") else l
        for l in s.splitlines()
    )


# ========== 代码块解析 ==========
def _split_lines(text):
    return text.replace("\r\n", "\n").replace("\r", "\n").split("\n")


def _read_yaml_head(lines, i, fname, line_offset=0):
    """lines[i] 为 '--[[' 起始行，返回 (meta, next_i)。
    meta 为 dict 时是 YAML 头；为 None 时是普通 --[[ ]] 注释块。
    next_i 为 ']]' 之后的一行下标。"""
    j = i + 1
    while j < len(lines) and lines[j].strip() != "]]":
        j += 1
    if j >= len(lines):
        raise SystemExit(f"错误：{fname} 第 {line_offset + i + 1} 行的 '--[[' 块未闭合（缺少 ']]' 行）。")
    inner = "\n".join(lines[i + 1:j])
    try:
        parsed = yaml.safe_load(inner)
    except yaml.YAMLError:
        parsed = None
    meta = parsed if isinstance(parsed, dict) else None
    return meta, j + 1


def _scan_blocks(lines, fname, strict, line_offset=0):
    """扫描一段行，返回代码块列表 [{num, meta, code, line}]（line 为全文件 1 起始行号）。
    strict=True（挑战骨架区）：除空行与代码块外不允许任何内容。
    strict=False（工具文件）：普通注释忽略，裸代码行警告并忽略。"""
    blocks = []
    i = 0
    while i < len(lines):
        line = lines[i]
        s = line.strip()
        ln = line_offset + i + 1
        if not s:
            i += 1
            continue
        if s == "--[[":
            meta, nxt = _read_yaml_head(lines, i, fname, line_offset)
            if meta is None:
                if strict:
                    raise SystemExit(
                        f"错误：{fname} 第 {ln} 行的 '--[[ ]]' 块不是合法的 YAML 头"
                        "（挑战文件骨架区内只允许代码块）。"
                    )
                i = nxt
                continue
            unknown = [k for k in meta if k not in KNOWN_HEAD_KEYS]
            if unknown:
                print(f"警告：{fname} 第 {ln} 行的 YAML 头含未知键 {unknown}，将被忽略。")
            # 代码行：紧邻 ']]' 的下一行，非空且不是注释
            code = None
            k = nxt
            if k < len(lines):
                nl = lines[k]
                if nl.strip() and not nl.lstrip().startswith("--"):
                    code = nl[2:] if nl.startswith("l ") else nl
                    k += 1
            blocks.append({"num": len(blocks), "meta": meta, "code": code, "line": ln})
            i = k
            continue
        if s.startswith("--[["):
            # 普通多行注释块（非 YAML 头，如注释化的可读源码）：跳到 ']]' 行整体忽略
            if "]]" not in s:
                j = i + 1
                while j < len(lines) and lines[j].strip() != "]]":
                    j += 1
                if j >= len(lines):
                    raise SystemExit(f"错误：{fname} 第 {ln} 行的 '--[[' 注释块未闭合（缺少 ']]' 行）。")
                i = j + 1
            else:
                i += 1
            continue
        if s.startswith("--"):
            if strict:
                raise SystemExit(
                    f"错误：{fname} 第 {ln} 行出现游离注释 {s!r}，"
                    "挑战文件骨架区内只允许代码块（说明请写进 YAML 头）。"
                )
            i += 1
            continue
        # 裸代码行
        if strict:
            raise SystemExit(
                f"错误：{fname} 第 {ln} 行出现不带 YAML 头的代码行，挑战文件骨架区内只允许代码块。"
            )
        print(f"警告：{fname} 第 {ln} 行存在不属于任何代码块的内容，已忽略：{s[:60]}")
        i += 1
    return blocks


def _parse_challenge(text, fname):
    """挑战文件固定骨架：元信息 + 分隔线 + 前置块 + 分隔线 + 正文块 + 分隔线 + 后置块。"""
    lines = _split_lines(text)
    sep_at = [i for i, l in enumerate(lines) if l.strip() == SEPARATOR]
    if len(sep_at) != 3:
        raise SystemExit(
            f"错误：挑战文件 {fname} 的分隔线 '{SEPARATOR}' 必须恰好出现三次"
            f"（元信息/前置/正文/后置两两之间，实际 {len(sep_at)} 次）。"
        )
    s1, s2, s3 = sep_at

    # 元信息：第一个分隔线之前的连续普通注释，原样直通
    header = []
    i = 0
    while i < s1:
        s = lines[i].strip()
        if s == "--[[":
            raise SystemExit(f"错误：挑战文件 {fname} 的元信息区不得包含代码块（第 {i + 1} 行）。")
        if s and not s.startswith("--"):
            raise SystemExit(
                f"错误：挑战文件 {fname} 第 {i + 1} 行的元信息必须是普通注释：{s[:60]!r}"
            )
        header.append(lines[i])
        i += 1

    pre = _scan_blocks(lines[s1 + 1:s2], fname, strict=True, line_offset=s1 + 1)
    body = _scan_blocks(lines[s2 + 1:s3], fname, strict=True, line_offset=s2 + 1)
    post = _scan_blocks(lines[s3 + 1:], fname, strict=True, line_offset=s3 + 1)
    if not pre:
        raise SystemExit(f"错误：挑战文件 {fname} 缺少前置代码块。")
    if not body:
        raise SystemExit(f"错误：挑战文件 {fname} 缺少正文代码块。")
    if not post:
        raise SystemExit(f"错误：挑战文件 {fname} 缺少后置代码块。")
    for b in pre:
        b["region"] = "pre"
    for b in body:
        b["region"] = "body"
    for b in post:
        b["region"] = "post"

    # 编号（字符串）：前置 0、I、II、III…（0 之后从 I 起），正文 1、2、3…，后置继前置继续取罗马数字
    for i, b in enumerate(pre):
        b["num"] = "0" if i == 0 else _roman(i)
    for i, b in enumerate(body):
        b["num"] = str(i + 1)
    for i, b in enumerate(post):
        b["num"] = _roman(len(pre) + i)
    blocks = pre + body + post
    return header, blocks


def _parse_utils(text, fname):
    """工具文件自由格式：收集其中的代码块，普通注释忽略。"""
    blocks = _scan_blocks(_split_lines(text), fname, strict=False)
    for n, b in enumerate(blocks):
        b["num"] = n
    return blocks


# ========== 收集 Lua 文件 ==========
def collect_lua_entries(lua_dir=LUA_DIR):
    lua_entries = []
    for subdir, is_challenge in CATEGORY_DIRS:
        dir_path = os.path.join(lua_dir, subdir)
        if not os.path.isdir(dir_path):
            continue
        for fname in sorted(os.listdir(dir_path)):
            if not fname.endswith('.lua') or fname.startswith('$'):
                continue
            num = fname[:-4].split('.', 1)[0]
            if re.search(r'(s-?\d+|l\d+|s[IVXLCDM]+)$', num):
                raise SystemExit(
                    f"错误：文件名 {fname} 的编号 {num!r} 与条目锚点格式（s/l+数字或罗马数字）冲突，请改名。"
                )
            title = (fname[:-4].split('.', 1) + [""])[1]
            if not title:
                print(f"警告：文件名 {fname} 缺少标题部分（形如 编号.标题.lua），将以空标题收录。")
            with open(os.path.join(dir_path, fname), encoding="utf-8") as f:
                raw = f.read()
            if is_challenge:
                header, blocks = _parse_challenge(raw, fname)
            else:
                header, blocks = [], _parse_utils(raw, fname)
            lua_entries.append({
                "id": num,
                "title": title,
                "fname": fname,
                "isChallenge": is_challenge,
                "header": header,
                "blocks": blocks,
            })

    # lua/ 根目录直接放置的文件不归属任何分类，提醒以免漏移
    if os.path.isdir(lua_dir):
        stray = [f for f in os.listdir(lua_dir)
                 if f.endswith('.lua') and os.path.isfile(os.path.join(lua_dir, f))]
        if stray:
            print("警告：以下文件直接位于 lua/ 根目录，不会被收录：" + ", ".join(stray))

    # 挑战在前、非挑战在后；挑战按数值排序，非挑战按字符串排序
    def _sort_key(e):
        try:
            return (not e["isChallenge"], 0, int(e["id"]))
        except ValueError:
            return (not e["isChallenge"], 1, e["id"])

    lua_entries.sort(key=_sort_key)
    return lua_entries


# ========== 模板注册表 ==========
def _validate_params_def(params_def, where):
    """参数定义 校验：必须是映射（Pn → 映射），参数名必须是 P1、P2 … Pn 形式。"""
    if not isinstance(params_def, dict):
        raise SystemExit(f"错误：{where} 的 参数定义 必须是映射（Pn → 定义）。")
    for pn, pd in params_def.items():
        if not PARAM_NAME_RE.match(str(pn)):
            raise SystemExit(f"错误：{where} 的参数名 {pn!r} 不合法，必须是 P1、P2 … Pn 形式。")
        if not isinstance(pd, dict):
            raise SystemExit(f"错误：{where} 的参数 {pn} 定义必须是映射（默认/性质/说明/类型）。")


def _params_json(params_def):
    """参数定义 → 输出契约形态：{Pn: {说明, 性质, 默认, 类型?}}（build_all_files 与 build_templates_json 共用）。"""
    params = {}
    for pn, pd in params_def.items():
        params[pn] = {"说明": pd.get("说明"), "性质": pd.get("性质"), "默认": pd.get("默认")}
        if "类型" in pd:
            params[pn]["类型"] = pd["类型"]
    return params


def _deps_list(meta, fname, num):
    """meta 的 依赖 归一为名称列表；无依赖返回 []，类型非法报错。"""
    deps = meta.get("依赖")
    if deps is None:
        return []
    if isinstance(deps, str):
        return [d.strip() for d in deps.split("、") if d.strip()]
    if isinstance(deps, list):
        return [str(d).strip() for d in deps if str(d).strip()]
    raise SystemExit(f"错误：{fname} 块{num} 的 依赖 必须是名称字符串或列表。")


def _register_templates(lua_entries):
    """收集 utils 中「作为模板: true」的块；模板id 全局查重，重复即报错。"""
    registry = {}
    for e in lua_entries:
        if e["isChallenge"]:
            continue
        for b in e["blocks"]:
            m = b["meta"]
            if not m.get("作为模板"):
                continue
            where = f"{e['fname']} 块{b['num']}"
            tid = m.get("模板id")
            if not tid:
                raise SystemExit(f"错误：{where} 声明「作为模板」但缺少 模板id。")
            tid = str(tid)
            if tid in registry:
                raise SystemExit(
                    f"错误：模板id 重复 {tid!r}（{registry[tid]['fname']} 块{registry[tid]['num']} "
                    f"与 {where}），模板id 必须全局唯一。"
                )
            if b["code"] is None:
                raise SystemExit(f"错误：{where} 是模板定义块，必须带一条代码行作为模板体。")
            if "说明" not in m:
                raise SystemExit(f"错误：{where} 是模板定义块，必须填写 说明（供引用方复用插值）。")
            params_def = m.get("参数定义") or {}
            _validate_params_def(params_def, where)
            registry[tid] = {
                "body": b["code"],
                "params": params_def,
                "说明": str(m["说明"]),
                "fname": e["fname"],
                "num": b["num"],
            }
    return registry


# ========== 展开与校验 ==========
def _expand_block(e, b, registry):
    """生成块的最终 comment/final_code；模板引用块补充 tpl/values。"""
    m = b["meta"]
    where = f"{e['fname']} 块{b['num']}"
    tid = m.get("模板")

    if tid is None:
        # 自定义代码块
        if b["code"] is None:
            raise SystemExit(f"错误：{where} 是自定义代码块，缺少代码行。")
        if "说明" not in m:
            raise SystemExit(f"错误：{where} 是自定义代码块，说明 必填。")
        if "参数" in m:
            print(f"警告：{where} 未使用模板却声明了 参数，已忽略。")
        params_def = m.get("参数定义")
        if params_def is None:
            # 普通自定义块与无参模板定义块原样直通
            b["comment"] = str(m["说明"])
            b["final_code"] = b["code"]
            return
        # 块内参数 与 带参数的模板定义块：构建期按默认值展开，输出始终是替换后内容；
        # 面板数据（body/comment_tpl 原文）供前端改参后重替换
        _validate_params_def(params_def, where)
        is_tpl_def = bool(m.get("作为模板"))
        values = {}
        for pn, pd in params_def.items():
            if "默认" in pd:
                values[pn] = pd["默认"]
            elif is_tpl_def:
                values[pn] = ""   # 模板定义的必填参数：显示为空，面板中由用户填写
            else:
                raise SystemExit(f"错误：{where} 的参数 {pn} 未定义默认值（块内参数必须全部带 默认）。")
        code = b["code"]
        for pn, v in values.items():
            code = _token_re(pn).sub(lambda _m, s=_lua_value(v): s, code)
        leftover = LEFTOVER_PARAM_RE.search(code)
        if leftover:
            raise SystemExit(
                f"错误：{where} 展开块内参数后占位符 {leftover.group(0)} 未替换完全。"
            )
        comment = str(m["说明"])
        for pn, v in values.items():
            comment = comment.replace("{" + pn + "}", _text_value(v))
        slot = SLOT_RE.search(comment)
        if slot:
            raise SystemExit(
                f"错误：{where} 展开块内参数的说明后插值槽 {slot.group(0)} 未替换。"
            )
        b["comment"] = comment
        b["final_code"] = code
        b["params_def"] = params_def
        b["values"] = values
        b["body"] = b["code"]            # 带占位符的原始代码（前端参数面板重展开用）
        b["comment_tpl"] = str(m["说明"])  # 含 {Pn} 插值槽的说明原文（前端改参后重插值用）
        return

    # 模板引用块
    tid = str(tid)
    if m.get("作为模板"):
        raise SystemExit(f"错误：{where} 不能同时声明「作为模板」与「模板」。")
    if b["code"] is not None:
        raise SystemExit(f"错误：{where} 是模板引用块，不应自带代码行（代码由模板展开）。")
    if tid not in registry:
        raise SystemExit(f"错误：{where} 引用了未定义的模板 {tid!r}。")
    t = registry[tid]

    given = m.get("参数") or {}
    if not isinstance(given, dict):
        raise SystemExit(f"错误：{where} 的 参数 必须是映射（Pn → 值）。")
    for pn in given:
        if pn not in t["params"]:
            raise SystemExit(f"错误：{where} 的参数 {pn!r} 未在模板 {tid!r} 中定义。")

    # 合并：引用方指定值优先，未指定取模板默认值
    # 清单#6：引用块必须显式指定全部参数（即使与默认值一致），缺项即报错
    missing = [pn for pn in t["params"] if pn not in given]
    if missing:
        raise SystemExit(
            f"错误：{where} 引用模板 {tid!r} 时缺少参数 {missing}（必须显式指定全部参数）。"
        )
    values = {}
    for pn, pd in t["params"].items():
        if pn in given:
            values[pn] = given[pn]
        elif "默认" in pd:
            values[pn] = pd["默认"]
        else:
            raise SystemExit(f"错误：{where} 的参数 {pn} 未提供且模板 {tid!r} 未定义默认值。")

    # 代码替换（token 边界）
    code = t["body"]
    for pn, v in values.items():
        code = _token_re(pn).sub(lambda _m, s=_lua_value(v): s, code)
    leftover = LEFTOVER_PARAM_RE.search(code)
    if leftover:
        raise SystemExit(
            f"错误：{where} 展开模板 {tid!r} 后占位符 {leftover.group(0)} 未替换完全。"
        )

    # 说明：引用方整段覆盖，或模板说明 {Pn} 插值
    if "说明" in m:
        comment = str(m["说明"])
    else:
        comment = t["说明"]
        for pn, v in values.items():
            comment = comment.replace("{" + pn + "}", _text_value(v))
        slot = SLOT_RE.search(comment)
        if slot:
            raise SystemExit(
                f"错误：{where} 展开模板 {tid!r} 的说明后插值槽 {slot.group(0)} 未替换。"
            )

    b["comment"] = comment
    b["final_code"] = code
    b["tpl"] = tid
    b["values"] = values


def _validate_deps(e):
    """依赖校验：依赖的名称必须存在于同文件，且对应块在当前块之前（按文件顺序，与编号无关）。"""
    names = {}
    for idx, b in enumerate(e["blocks"]):
        nm = b["meta"].get("名称")
        if nm is None:
            continue
        nm = str(nm)
        if nm in names:
            print(f"警告：{e['fname']} 中 名称 {nm!r} 重复声明（块{names[nm][1]} 与 块{b['num']}）。")
        names[nm] = (idx, b["num"])
    for idx, b in enumerate(e["blocks"]):
        deps = _deps_list(b["meta"], e["fname"], b["num"])
        for d in deps:
            if d not in names:
                raise SystemExit(f"错误：{e['fname']} 块{b['num']} 依赖的名称 {d!r} 在同文件中不存在。")
            if names[d][0] >= idx:
                raise SystemExit(
                    f"错误：{e['fname']} 块{b['num']} 依赖的 {d!r}（块{names[d][1]}）必须排在当前块之前。"
                )


def build(lua_dir=LUA_DIR):
    """完整构建管线：解析 → 模板注册 → 展开 → 校验。返回 (entries, registry)。"""
    entries = collect_lua_entries(lua_dir)
    registry = _register_templates(entries)
    for e in entries:
        for b in e["blocks"]:
            if b["meta"].get("作为模板") and e["isChallenge"]:
                print(f"警告：{e['fname']} 块{b['num']} 在 challenges 中声明「作为模板」，已忽略（仅 utils 有效）。")
            _expand_block(e, b, registry)
        _validate_deps(e)
    return entries, registry


# ========== 输出数据装配 ==========
def _assemble_raw(e):
    """把文件拼装成与现状相同的多行文本：文件头 + 分隔线 + （编号注释块 + `l `前缀代码行）× N。"""
    blocks_txt = []
    prev_region = None
    for b in e["blocks"]:
        if b.get("region") and b["region"] != prev_region:
            blocks_txt.append(SEPARATOR)
            prev_region = b["region"]
        clines = str(b["comment"]).split("\n")
        lines = ["--{}. {}".format(b["num"], clines[0]).rstrip()]
        lines.extend("--" + c if c else "--" for c in clines[1:])
        lines.append("l " + b["final_code"])
        blocks_txt.append("\n".join(lines))
    header_txt = "\n".join(e["header"]).strip("\n")
    parts = ([header_txt] if header_txt else []) + blocks_txt
    return "\n\n".join(parts) + "\n"


def build_all_files(lua_entries):
    all_files = {}
    for e in lua_entries:
        if e["id"] in all_files:
            # 重复 id 会导致静默覆盖（数据丢失），直接报错
            raise SystemExit(
                f"错误：重复的文件编号 id={e['id']}（{all_files[e['id']]['fname']} 与 {e['fname']}），"
                "请重命名其中一个文件。"
            )
        blocks = []
        for b in e["blocks"]:
            blk = {"num": b["num"], "comment": b["comment"], "code": b["final_code"]}
            if b.get("region"):
                blk["region"] = b["region"]
            meta = b.get("meta") or {}
            deps = _deps_list(meta, e["fname"], b["num"])
            if deps:
                blk["deps"] = deps
            # 代码名称：YAML 头声明了 名称 才输出 name 字段（前端据此显示名称标签）
            if meta.get("名称") is not None:
                blk["name"] = str(meta["名称"])
            if meta.get("作为模板") and meta.get("模板id"):
                blk["tplDef"] = meta["模板id"]
            if "tpl" in b:
                blk["tpl"] = b["tpl"]
                blk["values"] = b["values"]
            if "params_def" in b:
                # 块内参数（自定义参数块）：无 tpl/tplDef，前端据此构造参数面板
                blk["params"] = _params_json(b["params_def"])
                blk["values"] = b["values"]
                blk["body"] = b["body"]
                blk["commentTpl"] = b["comment_tpl"]
            blocks.append(blk)
        all_files[e["id"]] = {
            "id": e["id"],
            "title": e["title"],
            "fname": e["fname"],
            "isChallenge": e["isChallenge"],
            "header": e["header"],
            "blocks": blocks,
        }
    return all_files


def build_templates_json(registry):
    """page.js `__ALL_TEMPLATES__` 数据契约：{模板id: {body, params: {Pn: {说明, 性质, 默认, ...}}, 说明}}"""
    out = {}
    for tid, t in registry.items():
        out[tid] = {"body": t["body"], "params": _params_json(t["params"]), "说明": t["说明"]}
    return out


# ========== 生成 index.html ==========
def _baidu_tj_snippet():
    if not BAIDU_TJ_IDS:
        return ""
    # 按当前域名选择对应站点的统计 ID；本地文件/localhost 预览不加载，避免污染数据
    ids_json = json.dumps(BAIDU_TJ_IDS, ensure_ascii=False)
    return """    <script>
var _hmt = _hmt || [];
(function() {
    if (location.protocol === 'file:' || /^(localhost|127\\.0\\.0\\.1)$/.test(location.hostname)) return;
    var tjId = """ + ids_json + """[location.hostname];
    if (!tjId) return;
    var hm = document.createElement('script');
    hm.src = 'https://hm.baidu.com/hm.js?' + tjId;
    var s = document.getElementsByTagName('script')[0];
    s.parentNode.insertBefore(hm, s);
})();
</script>
"""


def build_html(style_css, js, challenge_count, other_count):
    return f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{TITLE}</title>
    <link rel="icon" type="image/svg+xml" href="favicon.svg">
    <link rel="prefetch" href="assets/challenge-sheet.webp" as="image">
    <link rel="prefetch" href="assets/challenge-page-background.webp" as="image">
{_baidu_tj_snippet()}    <style>{style_css}</style>
</head>
<body class="home-page">

    <!-- ====== 列表视图 ====== -->
    <div id="listView">
        <div class="container">
            <header class="home-hero">
                <img class="game-logo" src="assets/repentance-logo.png" alt="The Binding of Isaac: Repentance+">
                <div class="home-title">
                    <h1>以撒代码挑战</h1>
                    <div class="subtitle">自定义挑战代码合辑</div>
                    <div class="home-meta">
                        <span id="totalChallenges">{challenge_count:02d} CHALLENGES</span>
                        <span id="totalOthers">{other_count:02d} FILES</span>
                        <span>LUA</span>
                    </div>
                </div>
            </header>
            <div class="control-row">
                <div class="tools"><a href="compressor/index.html" class="tool-link">Lua 代码压缩器</a></div>
                <div class="search-wrap"><input id="searchInput" placeholder="输入编号或挑战名称…" aria-label="搜索挑战文件" oninput="handleSearch()"></div>
            </div>
            <div class="list-section">
                <div class="list-label"><span>挑战</span><span class="line"></span><span class="list-count" id="challengeCount">{challenge_count}</span></div>
                <div id="challengeList" class="file-list"></div>
            </div>
            <div class="list-section" id="otherSection">
                <div class="list-label"><span>其他</span><span class="line"></span><span class="list-count" id="otherCount">{other_count}</span></div>
                <div id="otherList" class="file-list"></div>
            </div>
            <div id="noResult" class="no-result" style="display:none">没有匹配的文件</div>
        </div>
        <div class="contact">联系我<a href="https://k3t.site/?mail">@Keye3Tuido</a><br><a href="https://space.bilibili.com/336467623">Bilibili主页</a></div>
    </div>

    <!-- ====== 详情视图 ====== -->
    <div id="detailView" style="display:none">
        <div class="container">
            <main class="challenge-sheet">
            <header class="detail-hero">
                <div class="detail-paper"><h1 id="detailTitle"></h1></div>
            </header>
            <div class="button-group" id="buttonGroup">
                <button onclick="copyAllCode(event)" class="copy-btn" id="copyCodeBtn">复制代码</button>
                <button onclick="copyLink(event)" class="copy-btn">复制链接</button>
                <button onclick="downloadZip(event)" class="download-btn" id="downloadBtn">下载模组文件</button>
                <a href="#" onclick="goBackToList(event)" class="back-btn">返回挑战列表</a>
            </div>
            <div class="code-area" id="codeArea"></div>
            <div class="legend"><span id="subLegend"></span></div>
            </main>
            <div id="toast"></div>
            <div id="hoverTip" class="tooltip"></div>
        </div>
        <div class="contact">联系我<a href="https://k3t.site/?mail">@Keye3Tuido</a><br><a href="https://space.bilibili.com/336467623">Bilibili主页</a></div>
    </div>

    <script>
{js}
    </script>
</body>
</html>
"""


# ========== 输出 ==========
def main():
    style_css = _read_asset("style.css").replace("__ASSET__", "assets")
    page_js = _read_asset("page.js")

    lua_entries, registry = build(LUA_DIR)
    all_files = build_all_files(lua_entries)

    all_files_json = json.dumps(all_files, ensure_ascii=False)
    js = page_js.replace("__ALL_FILES__", all_files_json)
    # 模板注册表占位符：前端并行开发中，page.js 尚未包含时跳过不报错
    if "__ALL_TEMPLATES__" in js:
        js = js.replace("__ALL_TEMPLATES__",
                        json.dumps(build_templates_json(registry), ensure_ascii=False))

    # 输出知识库 JSON（站点同目录发布 kb.json 即可被下载）
    kb_entries = []
    for e in lua_entries:
        raw = _assemble_raw(e)
        kb_entries.append({
            "id": e["id"],
            "title": e["title"],
            "tags": ["代码挑战"],
            "text": clean_code(raw),
            "code": raw,
            "source": "isaac_code",
        })
    with open("kb.json", "w", encoding="utf-8") as _f:
        json.dump(kb_entries, _f, ensure_ascii=False, indent=1)
    print(f"已生成 kb.json（{len(kb_entries)} 条代码知识库）")

    # ========== 统计 ==========
    challenge_count = sum(1 for e in lua_entries if e["isChallenge"])
    other_count = len(lua_entries) - challenge_count

    html = build_html(style_css, js, challenge_count, other_count)

    with open("index.html", "w", encoding="utf-8") as f:
        f.write(html)

    size_kb = len(html.encode("utf-8")) / 1024
    print(f"已生成 index.html ({size_kb:.1f} KB)")
    print(f"  嵌入 {len(lua_entries)} 个文件数据，{len(registry)} 个模板")


if __name__ == "__main__":
    main()
