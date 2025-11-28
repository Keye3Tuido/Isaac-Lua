import os
import re

def get_files():
    files = [f for f in os.listdir('.') if f.endswith('.lua') and not f.startswith('$')]
    def extract_number(filename):
        match = re.match(r'^(\d+)\.', filename)
        return int(match.group(1)) if match else float('inf')
    files.sort(key=extract_number)
    return files

def clean_code(content):
    # 去掉每行开头的 "l "
    lines = content.splitlines()
    cleaned = [line[2:] if line.startswith("l ") else line for line in lines]
    return "\n".join(cleaned)

def generate_index(files):
    html_content = """<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>以撒代码挑战 - Keye3Tuido</title>
<link rel="stylesheet"
      href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css">
<script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/languages/lua.min.js"></script>
<style>
body { font-family: 'Segoe UI', sans-serif; background:#f5f7fa; margin:20px; }
.container { max-width:1000px; margin:auto; background:white; padding:20px; border-radius:10px; box-shadow:0 0 10px rgba(0,0,0,0.1); }
h1 { text-align:center; color:#2c3e50; }
.file-list a { display:block; padding:10px; margin:5px 0; background:#ecf0f1; border-radius:5px; text-decoration:none; color:#2c3e50; }
.file-list a:hover { background:#3498db; color:white; }
.hidden { display:none; }
pre { background:#f8f9fa; padding:15px; border:1px solid #ddd; border-radius:5px; white-space:pre-wrap; overflow-x:auto; }
.button-group { margin-top:20px; }
button { padding:10px 15px; margin-right:10px; border:none; border-radius:5px; cursor:pointer; }
.copy-btn { background:#3498db; color:white; }
.download-btn { background:#2ecc71; color:white; }
.back-btn { background:#95a5a6; color:white; }
.search-box { margin:20px 0; text-align:center; }
.search-box input { padding:8px; width:70%; border:1px solid #ccc; border-radius:5px; }
.search-box button { padding:8px 15px; border:none; border-radius:5px; background:#2ecc71; color:white; cursor:pointer; }
.search-box button:hover { background:#27ae60; }
</style>
</head>
<body>
<div class="container">
<h1>以撒代码挑战 - Keye3Tuido</h1>
<div id="home">
<div class="search-box">
<input type="text" id="searchInput" placeholder="搜索Lua文件..." oninput="handleSearch()">
</div>
<div id="fileList" class="file-list">
"""

    for f in files:
        html_content += f'<a href="#" onclick="showFile(\'{f}\')">{f}</a>\n'

    html_content += """
</div>
</div>
<div id="detail" class="hidden">
<h2 id="fileTitle"></h2>
<pre><code class="language-lua" id="fileContent"></code></pre>
<div class="button-group">
<button class="copy-btn" onclick="copyToClipboard()">复制到剪贴板</button>
<button class="download-btn" onclick="downloadLua()">下载可执行lua文件</button>
<button class="back-btn" onclick="showHome()">返回主页</button>
</div>
</div>
</div>
<script>
const files = {
"""

    for f in files:
        with open(f, "r", encoding="utf-8") as file:
            raw = file.read()
        cleaned = clean_code(raw)
        # 注意：这里不做 html.escape，直接保留原始字符
        html_content += f'"{f}": {{raw:{repr(raw)}, cleaned:{repr(cleaned)}}},\n'

    html_content += """};

let currentFile = null;

function showFile(name){
    document.getElementById('home').style.display='none';
    document.getElementById('detail').style.display='block';
    document.getElementById('fileTitle').textContent = name;

    const codeBlock = document.getElementById('fileContent');
    codeBlock.textContent = files[name].raw;   // 显示原始内容（包含 l 和单引号）
    hljs.highlightElement(codeBlock);

    currentFile = name;
}
function showHome(){
    document.getElementById('detail').style.display='none';
    document.getElementById('home').style.display='block';
    currentFile = null;
}
function copyToClipboard(){
    if(currentFile){
        navigator.clipboard.writeText(files[currentFile].raw).then(()=>{
            alert("已复制到剪贴板！");
        }).catch(err=>{
            alert("复制失败: " + err);
        });
    }
}
function downloadLua(){
    if(currentFile){
        let num = currentFile.split('.')[0];
        let filename = "code" + num + ".lua";
        let content = files[currentFile].cleaned;

        const blob = new Blob([content], {type: "text/plain"});
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
        URL.revokeObjectURL(link.href);
    }
}
function handleSearch(){
    const term = document.getElementById('searchInput').value.toLowerCase();
    const list = document.getElementById('fileList').children;
    for(let link of list){
        if(link.textContent.toLowerCase().includes(term)){
            link.style.display='block';
        } else {
            link.style.display='none';
        }
    }
}
</script>
</body>
</html>
"""
    with open("index.html", "w", encoding="utf-8") as out:
        out.write(html_content)

def main():
    files = get_files()
    generate_index(files)
    print("✅ 已生成单页静态网页：index.html")

if __name__ == "__main__":
    main()
