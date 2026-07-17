import os
import json
import html

# ========== 配置 ==========
SUBDIR = "pages"  # 子页输出目录
TITLE = "以撒代码挑战 - Keye3Tuido"

# ========== 文本清理 ==========
def clean_code(s):
    return "\n".join(
        l[2:] if l.startswith("l ") else l
        for l in s.splitlines()
    )

# ========== 收集并排序 Lua 文件 ==========
files = {
    f: {"raw": r, "cleaned": clean_code(r)}
    for f in sorted(
        (x for x in os.listdir('.') if x.endswith('.lua') and not x.startswith('$')),
        key=lambda x: (0, int(x.split('.')[0])) if x.split('.')[0].lstrip('-').isdigit() else (1, x)
    )
    for r in [open(f, encoding="utf-8").read()]
}

# ========== 主页条目 ==========
def file_num(f):
    """取文件编号（'.' 前的部分）。"""
    return f[:-4].split('.', 1)[0]

def is_challenge(f):
    """编号为非负整数的条目视为挑战。"""
    return file_num(f).isdigit()

def item(f):
    base = f[:-4]
    num, title = (base.split('.', 1) + [""])[:2]
    safe_title = html.escape(title, quote=True)
    return (
        f"<div class='file-row' data-search='{num} {safe_title}'>"
        f"<span class='file-num{' long' if len(num) > 2 else ''}'>{num}</span>"
        f"<a href='{SUBDIR}/file_{num}.html' class='file-title'>{safe_title}</a>"
        f"</div>"
    )

# 分栏：挑战（编号为非负整数） / 其他
challenge_files = [f for f in files if is_challenge(f)]
other_files = [f for f in files if not is_challenge(f)]

challenge_links = "\n".join(item(f) for f in challenge_files)
other_links = "\n".join(item(f) for f in other_files)
challenge_count = len(challenge_files)
other_count = len(other_files)

# 其他栏：仅在存在条目时渲染（数目不硬编码）
other_section = (
    f"""
        <div class="list-section">
            <div class="list-label"><span>其他</span><span class="line"></span><span class="list-count">{other_count}</span></div>
            <div id="otherList" class="file-list">{other_links}</div>
        </div>"""
    if other_files else ""
)

# ========== 公共样式（The Binding of Isaac 地下室风格） ==========
COMMON_CSS = """
@font-face { font-family:'IsaacCode'; src:url('__ASSET__/inconsolata-bold.ttf') format('truetype'); font-display:swap; }
@font-face { font-family:'IsaacPixel'; src:url('__ASSET__/isaac-pixel-subset.woff2') format('woff2'); font-display:swap; }
* { box-sizing:border-box; }
:root {
  --ink:#302628; --ink-soft:#66575a; --paper:#e2d4d8; --blood:#782033; --cream:#eadbc4;
  --panel:#17110f; --panel-2:#211713; --line:#5b3d32;
  --display:'IsaacPixel','Microsoft YaHei UI','Microsoft YaHei',sans-serif;
  --hud:'IsaacCode',Consolas,monospace; --mono:'IsaacCode','Cascadia Code',Consolas,monospace;
  --sans:'IsaacPixel','Microsoft YaHei UI','Microsoft YaHei',sans-serif;
}
html { min-height:100%; background:#160a07; }
body { min-height:100%; margin:0; -webkit-font-smoothing:none; font-family:var(--sans); }
body::before { content:''; position:fixed; inset:0; z-index:0; pointer-events:none; }
body.home-page {
  padding:22px 18px 54px; color:var(--cream);
  background:#4b281f url('__ASSET__/basement-room.webp') center center/cover scroll no-repeat;
}
body.home-page::before { background:radial-gradient(ellipse at 50% 35%,transparent 28%,rgba(15,5,3,.24) 76%),linear-gradient(rgba(18,6,4,.04),rgba(18,6,4,.3)); }
body.challenge-page {
  padding:26px 18px 46px; color:var(--ink);
  background:#ddd0d3 url('__ASSET__/paper-surface.webp') center top/cover scroll no-repeat;
}
body.challenge-page::before {
  background-image:linear-gradient(rgba(255,255,255,.035),rgba(91,68,72,.045)),url('__ASSET__/challenge-page-background.webp');
  background-position:center,center center; background-size:cover,cover; background-repeat:no-repeat;
}
@keyframes appear { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:none} }
.container { position:relative; z-index:1; margin:auto; animation:appear .22s ease-out; }
.home-page .container { max-width:1040px; }
.challenge-page .container { max-width:1080px; }
.game-logo { display:block; width:min(330px,68vw); height:auto; margin:0 auto 3px; filter:drop-shadow(0 11px 4px rgba(0,0,0,.66)); }
.home-hero { margin:0 auto 25px; text-align:center; }
.home-title { max-width:680px; margin:0 auto; padding:8px 16px 15px; text-shadow:0 3px 2px #140806; }
.home-title h1 { margin:8px 0 7px; color:#f0dfc7; font:400 clamp(2rem,5vw,3.25rem)/1.1 var(--display); letter-spacing:.04em; }
.home-title .subtitle { color:#cbb99e; font:400 clamp(.86rem,1.8vw,1.08rem)/1.45 var(--display); }
.home-meta { display:flex; justify-content:center; flex-wrap:wrap; gap:8px 22px; margin-top:12px; color:#b9a184; font:700 .78rem/1.2 var(--hud); }
.home-meta span+span::before { content:'/'; margin-right:22px; color:#79594b; }
.control-row { display:grid; grid-template-columns:220px minmax(300px,1fr); gap:10px; margin:0 0 14px; }
.search-wrap,.tool-link { min-height:52px; border:14px solid transparent; border-image:url('__ASSET__/basement-panel.webp') 112 fill stretch; background:#1b1210; box-shadow:0 5px 10px rgba(0,0,0,.28); }
.search-wrap { position:relative; padding:0 16px; }
.search-wrap::before { content:'>'; position:absolute; left:16px; top:14px; color:#9d7767; font:700 1rem/1 var(--hud); }
#searchInput { width:100%; height:48px; padding:0 8px 0 25px; border:0; outline:0; color:#eadbc4; background:transparent; font:400 1rem/1 var(--display); }
#searchInput::placeholder { color:#8e796d; }
#searchInput:focus { box-shadow:inset 0 -2px #8f3241; }
.tools { display:flex; }
.tool-link { width:100%; display:flex; align-items:center; justify-content:center; padding:8px 16px; color:#d8c3a5; text-decoration:none; font:400 .96rem/1.3 var(--display); cursor:url('__ASSET__/menu-cursor.png') 5 1,pointer; transition:.12s; }
.tool-link:hover { color:#fff0d3; border-color:#875243; background:#261713; transform:translateY(-1px); }
.list-section { margin:0 0 15px; padding:6px 10px 10px; border:30px solid transparent; border-image:url('__ASSET__/basement-panel.webp') 112 fill stretch; background:#1b1210; box-shadow:0 10px 20px rgba(0,0,0,.3); }
.list-label { display:flex; align-items:baseline; gap:10px; margin:0 0 8px; padding:0 4px 8px; border-bottom:2px solid #5b3c32; color:#d8c4a7; font:400 1.08rem/1.2 var(--display); }
.list-label .line { flex:1; border-bottom:1px dotted #5f493e; }.list-count { color:#9e806c; font:700 .78rem/1 var(--hud); }
.file-list { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); column-gap:28px; }
.file-row { position:relative; min-height:42px; display:grid; grid-template-columns:44px 1fr; align-items:center; border-bottom:1px solid rgba(111,77,64,.48); transition:.1s; }
.file-row:hover { background:linear-gradient(90deg,rgba(120,32,51,.28),transparent); }
.file-num { color:#9e7968; font:700 .78rem/1 var(--hud); text-align:right; padding-right:12px; }
.file-num::after { content:'.'; }.file-num.long { font-size:.62rem; }
.file-title { position:relative; padding:9px 4px; color:#dfcfb4; text-decoration:none; font:400 .98rem/1.28 var(--display); }
.file-title::after { content:''; position:absolute; inset:0 -4px; }.file-row:nth-child(odd) .file-title{color:#ead8bc}.file-row:hover .file-title { color:#fff0d2; transform:translateX(3px); }.file-row:hover .file-num{color:#bd4b5e}
.no-result { padding:28px; color:#d4c2a6; text-align:center; font:400 1rem/1.3 var(--display); }
.contact { position:relative; z-index:1; margin-top:15px; color:#9d8874; text-align:center; font:700 .74rem/1.3 var(--hud); text-shadow:0 2px 2px #000; }.contact a{margin-left:7px;color:#d2b77d;text-decoration:none}.contact a:hover{color:#e17a78}.challenge-page .contact{text-shadow:none;color:#7d696d}.challenge-page .contact a{color:#704c54}
.challenge-sheet {
  position:relative; min-height:680px; padding:44px 48px 38px; border:42px solid transparent;
  border-image:url('__ASSET__/challenge-sheet.webp') 86 58 110 58 fill stretch;
}
.detail-hero { text-align:center; margin-bottom:7px; }
.detail-paper { padding:0 12px; }
.detail-paper h1 { margin:9px 0 7px; color:var(--ink); font:400 clamp(1.7rem,4vw,2.75rem)/1.15 var(--display); letter-spacing:.03em; }
.button-group { display:flex; justify-content:center; flex-wrap:wrap; gap:8px 24px; margin:15px 0 24px; padding:9px 0; border-top:1px solid rgba(84,64,68,.28); border-bottom:1px solid rgba(84,64,68,.28); }
.button-group button,.back-btn { position:relative; min-height:36px; padding:4px 9px 4px 20px; border:0; border-bottom:2px solid transparent; color:#5d4b4f; background:transparent; text-align:center; text-decoration:none; cursor:url('__ASSET__/menu-cursor.png') 5 1,pointer; font:400 .9rem/1.3 var(--display); transition:.1s; }
.button-group button::before,.back-btn::before{content:'>';position:absolute;left:4px;top:6px;color:#8c2639;opacity:.35;font:700 .78rem/1 var(--hud);transition:.1s}.button-group button:hover,.back-btn:hover { color:#7c2033; border-bottom-color:#7c2033; transform:translateX(2px); }.button-group button:hover::before,.back-btn:hover::before{opacity:1;left:7px}.copy-btn{color:#6d2737!important}.download-btn{color:#466b61!important}
.code-area { display:flex; flex-direction:column; gap:18px; }
.section { overflow:hidden; border-top:2px solid #6f5b5e; content-visibility:auto; contain-intrinsic-size:180px; }
.section-header { display:flex; align-items:flex-start; gap:9px; padding:11px 4px 8px; color:#4a393d; cursor:url('__ASSET__/menu-cursor.png') 5 1,pointer; user-select:none; white-space:pre-wrap; font:400 .88rem/1.5 var(--display); }
.section-header.no-code { cursor:default; opacity:.65; }.section .arrow{flex:0 0 auto;color:#7c2033;font:700 .75rem/1.4 var(--hud);transition:transform .14s}.section.collapsed .arrow{transform:rotate(-90deg)}.section.collapsed .code-box{display:none}
.code-box { display:grid; grid-template-columns:max-content 1fr; overflow:auto; padding:7px 0 13px; border-bottom:1px solid rgba(89,67,71,.34); background:rgba(255,255,255,.12); font:13px/1.62 var(--mono); }
.cell-ln { min-height:1.62em; padding:0 10px; border-right:1px solid rgba(93,71,74,.28); color:#a48e91; text-align:right; user-select:none; }
.cell-code { min-height:1.62em; padding:0 13px; color:#3f3235; white-space:pre-wrap; overflow-wrap:anywhere; }.code-box:hover .cell-code{background:rgba(255,255,255,.12);cursor:url('__ASSET__/menu-cursor.png') 5 1,pointer}
.legend { margin-top:13px; color:#8a7477; text-align:right; font:700 .72rem/1.3 var(--hud); }.sheet-footer{display:flex;justify-content:center;margin-top:19px}
#toast { position:fixed; z-index:60; display:none; padding:8px 12px; pointer-events:none; opacity:0; transition:.2s; border:2px solid #6b5250; color:#2b2020; background:#d9caca; box-shadow:0 10px 25px rgba(0,0,0,.3); font:400 .86rem/1.3 var(--display); }.tooltip{position:fixed;z-index:60;display:none;padding:5px 9px;pointer-events:none;opacity:0;border:1px solid #6b5250;color:#2b2020;background:#d9caca;font:700 12px/1.3 var(--hud)}
.tool-link:focus-visible,#searchInput:focus-visible,.file-title:focus-visible,.button-group button:focus-visible,.back-btn:focus-visible{outline:2px solid #9b4553;outline-offset:3px}::-webkit-scrollbar{width:11px;height:11px}::-webkit-scrollbar-track{background:#ded0d4}::-webkit-scrollbar-thumb{border:3px solid #ded0d4;background:#80666a}
@media(max-width:760px){body.home-page{padding:16px 9px 40px;background-attachment:scroll}body.challenge-page{padding:10px 4px 28px;background-attachment:scroll}.control-row{grid-template-columns:1fr}.file-list{grid-template-columns:1fr}.challenge-sheet{padding:38px 21px 28px;border-width:24px}.home-meta span+span::before{display:none}.home-meta{gap:7px 16px}}
@media(max-width:480px){.game-logo{width:min(285px,76vw)}.home-title h1{font-size:1.85rem}.list-section{padding:13px 12px 16px}.file-row{grid-template-columns:39px 1fr}.file-title{font-size:.9rem}.challenge-sheet{padding:31px 7px 22px;border-width:18px}.detail-paper h1{font-size:1.65rem}.button-group{gap:6px 15px}.section-header{font-size:.8rem}.code-box{font-size:12px}.cell-ln{padding:0 6px}.cell-code{padding:0 8px}}
@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important}}
"""
INDEX_CSS = COMMON_CSS.replace("__ASSET__", "assets")

# ========== 主页 HTML ==========
html_index = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{TITLE}</title>
    <link rel="icon" type="image/svg+xml" href="favicon.svg">
    <link rel="prefetch" href="assets/challenge-sheet.webp" as="image">
    <link rel="prefetch" href="assets/challenge-page-background.webp" as="image">
    <style>{INDEX_CSS}</style>
</head>
<body class="home-page">
    <div class="container">
        <header class="home-hero">
            <img class="game-logo" src="assets/repentance-logo.png" alt="The Binding of Isaac: Repentance+">
            <div class="home-title"><h1>以撒代码挑战</h1><div class="subtitle">自定义挑战代码合辑</div><div class="home-meta"><span>{challenge_count:02d} CHALLENGES</span><span>{other_count:02d} FILES</span><span>LUA</span></div></div>
        </header>
        <div class="control-row">
            <div class="tools"><a href="compressor/index.html" class="tool-link">Lua 代码压缩器</a></div>
            <div class="search-wrap"><input id="searchInput" placeholder="输入编号或挑战名称…" aria-label="搜索挑战文件" oninput="handleSearch()"></div>
        </div>
        <div class="list-section">
            <div class="list-label"><span>挑战</span><span class="line"></span><span class="list-count">{challenge_count}</span></div>
            <div id="challengeList" class="file-list">{challenge_links}</div>
        </div>{other_section}
        <div id="noResult" class="no-result" style="display:none">没有匹配的文件</div>
    </div>
    <div class="contact">联系我<a href="https://k3t.site/?mail">@Keye3Tuido</a></div>
    <script>
        const prefetched = new Set();
        function prefetchChallenge(e) {{
            const link = e.target.closest && e.target.closest('.file-title');
            if (!link || prefetched.has(link.href)) return;
            prefetched.add(link.href);
            const hint = document.createElement('link');
            hint.rel = 'prefetch';
            hint.href = link.href;
            document.head.appendChild(hint);
        }}
        document.addEventListener('pointerover', prefetchChallenge, {{passive:true}});
        document.addEventListener('touchstart', prefetchChallenge, {{passive:true}});

        function handleSearch() {{
            const t = searchInput.value.toLowerCase();
            let shown = 0;
            document.querySelectorAll('.file-list').forEach(list => {{
                let listShown = 0;
                for (const item of list.children) {{
                    const match = item.getAttribute('data-search').toLowerCase().includes(t);
                    item.style.display = match ? '' : 'none';
                    if (match) listShown++;
                }}
                // 整栏（含标题）在无匹配时隐藏
                const section = list.closest('.list-section');
                if (section) section.style.display = listShown ? '' : 'none';
                shown += listShown;
            }});
            document.getElementById('noResult').style.display = shown ? 'none' : 'block';
        }}
    </script>
</body>
</html>
"""

# ========== 子页生成函数（下载模组文件：codeXX.zip，内含 main.lua） ==========
def generate_file_page(fname, raw, cleaned):
    num, title = (fname[:-4].split('.', 1) + [""])[:2]
    safe_title = html.escape(title, quote=True)
    safe_fname = html.escape(fname, quote=True)
    page_css = COMMON_CSS.replace("__ASSET__", "../assets")

    return f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{safe_title} - 以撒代码挑战</title>
    <link rel="icon" type="image/svg+xml" href="../favicon.svg">
    <style>{page_css}</style>
</head>
<body class="challenge-page">
    <div class="container">
        <main class="challenge-sheet">
        <header class="detail-hero">
            <div class="detail-paper"><h1>{safe_title}</h1></div>
        </header>
        <div class="button-group">
            <button onclick="copyAll(event)" class="copy-btn">复制到剪贴板</button>
            <button onclick="downloadZip(event)" class="download-btn">下载模组文件</button>
            <a href="../index.html" class="back-btn">\u8fd4\u56de\u6311\u6218\u5217\u8868</a>
        </div>
        <div class="code-area" id="codeArea"></div>
        <div class="legend"><span id="subLegend">{safe_fname} - @Keye3Tuido</span></div>
        </main>
        <div id="toast"></div>
        <div id="hoverTip" class="tooltip"></div>
    </div>
    <script>
        const FILE = {json.dumps({"raw": raw, "cleaned": cleaned}, ensure_ascii=False)};
        const NUM = "{num}";  // 文件编号用于命名 zip
        const TITLE_NAME = "{safe_title}";  // 用于 metadata.xml
        const codeArea = document.getElementById('codeArea');
        const toast = document.getElementById('toast');
        const hoverTip = document.getElementById('hoverTip');

        function isComment(l) {{
            if (l.startsWith("l ")) l = l.slice(2);
            return l.trim().startsWith("--");
        }}
        function isBlank(l) {{ return l.trim() === ""; }}

        function bindHover(el, charCount) {{
            el.onmouseenter = (e) => showHoverTip(e.clientX, e.clientY, charCount);
            el.onmousemove = (e) => showHoverTip(e.clientX, e.clientY, charCount);
            el.onmouseleave = hideHoverTip;
        }}

        // 构建代码框（行号 + 代码，单一网格保证换行后对齐），点击复制整块代码
        function buildCodeBox(codeLines) {{
            const box = document.createElement('div');
            box.className = 'code-box';

            const blockText = codeLines.map(it => it.text).join('\\n');
            box.onclick = (e) => copyBlock(blockText, codeLines.length, e);
            bindHover(box, blockText.length);

            codeLines.forEach(item => {{
                const ln = document.createElement('div');
                ln.className = 'cell-ln';
                ln.textContent = item.no;
                box.appendChild(ln);

                const code = document.createElement('div');
                code.className = 'cell-code';
                code.textContent = item.text;
                box.appendChild(code);
            }});

            return box;
        }}

        function render() {{
            codeArea.innerHTML = "";
            const lines = FILE.raw.split('\\n');
            const n = lines.length;
            let i = 0;

            while (i < n) {{
                while (i < n && isBlank(lines[i])) i++;   // 跳过段间空行
                if (i >= n) break;

                const header = [];
                while (i < n && isComment(lines[i])) {{ header.push(lines[i]); i++; }}

                const codeLines = [];
                while (i < n && !isComment(lines[i])) {{
                    if (!isBlank(lines[i])) codeLines.push({{ no: i + 1, text: lines[i] }});
                    i++;
                }}

                const section = document.createElement('div');
                section.className = 'section';

                const head = document.createElement('div');
                head.className = 'section-header';

                if (codeLines.length) {{
                    const arrow = document.createElement('span');
                    arrow.className = 'arrow';
                    arrow.textContent = '▼';
                    head.appendChild(arrow);
                }}

                const text = document.createElement('span');
                text.className = 'header-text';
                if (header.length) {{
                    header.forEach((c, k) => {{
                        const span = document.createElement('span');
                        span.textContent = c;
                        text.appendChild(span);
                        if (k < header.length - 1) text.appendChild(document.createTextNode('\\n'));
                    }});
                }} else {{
                    text.textContent = '代码';
                }}
                head.appendChild(text);
                section.appendChild(head);

                if (codeLines.length) {{
                    section.classList.add('collapsed');          // 默认折叠
                    head.onclick = () => section.classList.toggle('collapsed');
                    section.appendChild(buildCodeBox(codeLines));
                }} else {{
                    head.classList.add('no-code');
                }}

                codeArea.appendChild(section);
            }}
        }}

        let toastTimer;
        function showToastAt(m, x, y) {{
            clearTimeout(toastTimer);
            if (toast.parentNode !== document.body) document.body.appendChild(toast);
            toast.textContent = m;
            toast.style.display = 'block';
            toast.style.visibility = 'hidden';
            toast.style.opacity = 0;
            const offset = 14, pad = 8;
            const rect = toast.getBoundingClientRect();
            let left = x + offset;
            let top = y + offset;
            if (left + rect.width > innerWidth - pad) left = x - rect.width - offset;
            if (top + rect.height > innerHeight - pad) top = y - rect.height - offset;
            left = Math.max(pad, Math.min(left, innerWidth - rect.width - pad));
            top = Math.max(pad, Math.min(top, innerHeight - rect.height - pad));
            toast.style.left = left + 'px';
            toast.style.top = top + 'px';
            toast.style.visibility = 'visible';
            toast.style.opacity = 1;
            toastTimer = setTimeout(() => {{ toast.style.opacity = 0; toast.style.display = 'none'; }}, 2200);
        }}

        function copyBlock(text, count, e) {{
            if (!text) return;
            navigator.clipboard.writeText(text)
                .then(() => showToastAt("已复制该代码块（" + count + " 行，" + text.length + " 字符）", e.clientX, e.clientY))
                .catch(err => showToastAt("复制失败: " + err, e.clientX, e.clientY));
        }}

        function copyAll(e) {{
            navigator.clipboard.writeText(FILE.raw)
                .then(() => showToastAt("已复制代码到剪贴板", e.clientX, e.clientY))
                .catch(() => showToastAt("复制失败", e.clientX, e.clientY));
        }}

        // 下载模组文件：生成 codeXX.zip，内含 main.lua 和 metadata.xml
        let jsZipPromise;
        function ensureJsZip() {{
            if (window.JSZip) return Promise.resolve(window.JSZip);
            if (!jsZipPromise) {{
                jsZipPromise = new Promise((resolve, reject) => {{
                    const script = document.createElement('script');
                    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
                    script.async = true;
                    script.onload = () => resolve(window.JSZip);
                    script.onerror = () => reject(new Error('JSZip load failed'));
                    document.head.appendChild(script);
                }});
            }}
            return jsZipPromise;
        }}

        async function downloadZip(e) {{
            await ensureJsZip();
            try {{
                const filename = "code" + NUM + ".zip";
                const zip = new JSZip();

                // 添加 main.lua
                zip.file("main.lua", FILE.cleaned);

                // 添加 metadata.xml
                const metadata = `
                    <metadata>
                        <name>code${{NUM}}-${{TITLE_NAME}}</name>
                        <directory>code${{NUM}}</directory>
                        <description/>
                        <version>1.0</version>
                        <visibility/>
                    </metadata>`;
                zip.file("metadata.xml", metadata.trim());

                // 生成并下载 zip
                const blob = await zip.generateAsync({{ type: "blob" }});
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = filename;
                a.click();
                URL.revokeObjectURL(a.href);

                showToastAt("已下载模组文件; 将文件解压至游戏mods目录下即可进行游戏", e.clientX, e.clientY);
            }} catch (err) {{
                showToastAt("下载失败: " + err, e.clientX, e.clientY);
            }}
        }}

        function showHoverTip(x, y, charCount) {{
            if (hoverTip.parentNode !== document.body) document.body.appendChild(hoverTip);
            hoverTip.textContent = "\u70b9\u51fb\u4ee5\u590d\u5236\u8be5\u4ee3\u7801\u5757\uff08" + charCount + " \u5b57\u7b26\uff09";
            hoverTip.style.display = "block";
            hoverTip.style.visibility = "hidden";
            const rect = hoverTip.getBoundingClientRect();
            const offset = 12, pad = 6;
            let left = x + offset, top = y + offset;
            if (left + rect.width > innerWidth - pad) left = x - rect.width - offset;
            if (top + rect.height > innerHeight - pad) top = y - rect.height - offset;
            hoverTip.style.left = Math.max(pad, left) + "px";
            hoverTip.style.top = Math.max(pad, top) + "px";
            hoverTip.style.visibility = "visible";
            hoverTip.style.opacity = 1;
        }}

        function hideHoverTip() {{
            hoverTip.style.opacity = 0;
            hoverTip.style.display = 'none';
        }}

        render();
    </script>
    <div class="contact">联系我<a href="https://k3t.site/?mail">@Keye3Tuido</a></div>
</body>
</html>
"""

# ========== 主程序：输出主页与子页到目录 ==========
if __name__ == "__main__":
    # 生成主页
    with open("index.html", "w", encoding="utf-8") as f:
        f.write(html_index)
    print("已生成 index.html")

    # 创建子页目录
    os.makedirs(SUBDIR, exist_ok=True)

    # 生成子页
    for fname, content in files.items():
        num = fname.split('.')[0]
        page_html = generate_file_page(fname, content["raw"], content["cleaned"])
        out_path = os.path.join(SUBDIR, f"file_{num}.html")
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(page_html)
        print(f"已生成子页面 {out_path}")
