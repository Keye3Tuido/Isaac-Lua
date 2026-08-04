import os
import json
import re

# ========== 配置 ==========
LUA_DIR = "lua"
TITLE = "以撒代码挑战 - Keye3Tuido"

# ========== 读取外部资源 ==========
def _read_asset(path):
    try:
        with open(path, encoding="utf-8") as f:
            return f.read()
    except FileNotFoundError:
        raise SystemExit(f"错误：缺少必要文件 {path}，请确保 style.css 和 page.js 存在于项目根目录。")

STYLE_CSS = _read_asset("style.css").replace("__ASSET__", "assets")
PAGE_JS = _read_asset("page.js")

# ========== 文本清理 ==========
def clean_code(s):
    return "\n".join(
        l[2:] if l.startswith("l ") else l
        for l in s.splitlines()
    )

# ========== 收集 Lua 文件元数据 ==========
def is_challenge_id(num_str):
    return bool(re.match(r'^\d+$', num_str))

lua_entries = []
for fname in sorted(os.listdir(LUA_DIR)):
    if not fname.endswith('.lua') or fname.startswith('$'):
        continue
    num = fname[:-4].split('.', 1)[0]
    title = (fname[:-4].split('.', 1) + [""])[1]
    raw = open(os.path.join(LUA_DIR, fname), encoding="utf-8").read()
    lua_entries.append({
        "id": num,
        "title": title,
        "fname": fname,
        "isChallenge": is_challenge_id(num),
        "raw": raw,
        "cleaned": clean_code(raw),
    })

# 挑战在前、非挑战在后；挑战按数值排序，非挑战按字符串排序
def _sort_key(e):
    try:
        return (not e["isChallenge"], 0, int(e["id"]))
    except ValueError:
        return (not e["isChallenge"], 1, e["id"])

lua_entries.sort(key=_sort_key)

# ========== 构建 ALL_FILES ==========
all_files = {}
for e in lua_entries:
    all_files[e["id"]] = {
        "title": e["title"],
        "fname": e["fname"],
        "isChallenge": e["isChallenge"],
        "raw": e["raw"],
        "cleaned": e["cleaned"],
    }

all_files_json = json.dumps(all_files, ensure_ascii=False)
js = PAGE_JS.replace("__ALL_FILES__", all_files_json)

# ========== 统计 ==========
challenge_count = sum(1 for e in lua_entries if e["isChallenge"])
other_count = len(lua_entries) - challenge_count

# ========== 生成 index.html ==========
html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{TITLE}</title>
    <link rel="icon" type="image/svg+xml" href="favicon.svg">
    <link rel="prefetch" href="assets/challenge-sheet.webp" as="image">
    <link rel="prefetch" href="assets/challenge-page-background.webp" as="image">
    <style>{STYLE_CSS}</style>
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
        <div class="contact">联系我<a href="https://k3t.site/?mail">@Keye3Tuido</a></div>
    </div>

    <!-- ====== 详情视图 ====== -->
    <div id="detailView" style="display:none">
        <div class="container">
            <main class="challenge-sheet">
            <header class="detail-hero">
                <div class="detail-paper"><h1 id="detailTitle"></h1></div>
            </header>
            <div class="button-group">
                <button onclick="copyAllCode(event)" class="copy-btn">复制代码</button>
                <button onclick="copyLink(event)" class="copy-btn">复制链接</button>
                <button onclick="downloadZip(event)" class="download-btn">下载模组文件</button>
                <a href="#" onclick="goBackToList(event)" class="back-btn">返回挑战列表</a>
            </div>
            <div class="code-area" id="codeArea"></div>
            <div class="legend"><span id="subLegend"></span></div>
            </main>
            <div id="toast"></div>
            <div id="hoverTip" class="tooltip"></div>
        </div>
        <div class="contact">联系我<a href="https://k3t.site/?mail">@Keye3Tuido</a></div>
    </div>

    <script>
{js}
    </script>
</body>
</html>
"""

# ========== 输出 ==========
if __name__ == "__main__":
    with open("index.html", "w", encoding="utf-8") as f:
        f.write(html)

    size_kb = len(html.encode("utf-8")) / 1024
    print(f"已生成 index.html ({size_kb:.1f} KB)")
    print(f"  嵌入 {len(lua_entries)} 个文件数据")
