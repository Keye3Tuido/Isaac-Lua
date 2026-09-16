import os
import json

# ========== 配置 ==========
LUA_DIR = "lua"
TITLE = "以撒代码挑战 - Keye3Tuido"

# 目录即分类：lua/challenges → 挑战，lua/utils → 其他
CATEGORY_DIRS = [("challenges", True), ("utils", False)]


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


# ========== 收集 Lua 文件元数据 ==========
def collect_lua_entries():
    lua_entries = []
    for subdir, is_challenge in CATEGORY_DIRS:
        dir_path = os.path.join(LUA_DIR, subdir)
        if not os.path.isdir(dir_path):
            continue
        for fname in sorted(os.listdir(dir_path)):
            if not fname.endswith('.lua') or fname.startswith('$'):
                continue
            num = fname[:-4].split('.', 1)[0]
            title = (fname[:-4].split('.', 1) + [""])[1]
            if not title:
                print(f"警告：文件名 {fname} 缺少标题部分（形如 编号.标题.lua），将以空标题收录。")
            with open(os.path.join(dir_path, fname), encoding="utf-8") as f:
                raw = f.read()
            lua_entries.append({
                "id": num,
                "title": title,
                "fname": fname,
                "isChallenge": is_challenge,
                "raw": raw,
                "cleaned": clean_code(raw),
            })

    # lua/ 根目录直接放置的文件不归属任何分类，提醒以免漏移
    stray = [f for f in os.listdir(LUA_DIR)
             if f.endswith('.lua') and os.path.isfile(os.path.join(LUA_DIR, f))]
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


# ========== 构建 ALL_FILES ==========
def build_all_files(lua_entries):
    all_files = {}
    for e in lua_entries:
        if e["id"] in all_files:
            # 重复 id 会导致静默覆盖（数据丢失），直接报错
            raise SystemExit(
                f"错误：重复的文件编号 id={e['id']}（{all_files[e['id']]['fname']} 与 {e['fname']}），"
                "请重命名其中一个文件。"
            )
        all_files[e["id"]] = {
            "title": e["title"],
            "fname": e["fname"],
            "isChallenge": e["isChallenge"],
            "raw": e["raw"],
        }
    return all_files


# ========== 生成 index.html ==========
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
    <style>{style_css}</style>
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

    lua_entries = collect_lua_entries()
    all_files = build_all_files(lua_entries)

    all_files_json = json.dumps(all_files, ensure_ascii=False)
    js = page_js.replace("__ALL_FILES__", all_files_json)

    # 输出知识库 JSON（供 APIK 模组作为「代码知识库」接入；站点同目录发布 kb.json 即可被下载）
    kb_entries = []
    for e in lua_entries:
        kb_entries.append({
            "id": e["id"],
            "title": e["title"],
            "tags": ["代码挑战"],
            "text": e["cleaned"],
            "code": e["raw"],
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
    print(f"  嵌入 {len(lua_entries)} 个文件数据")


if __name__ == "__main__":
    main()
