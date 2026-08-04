// ========== DATA（由 Python 构建时注入） ==========
const ALL_FILES = __ALL_FILES__;

// ========== DOM 引用 ==========
const listView = document.getElementById('listView');
const detailView = document.getElementById('detailView');
const detailTitle = document.getElementById('detailTitle');
const subLegend = document.getElementById('subLegend');
const codeArea = document.getElementById('codeArea');
const toast = document.getElementById('toast');
const hoverTip = document.getElementById('hoverTip');

// ========== 状态 ==========
let currentFileId = null;

// ========== 路由 ==========
function route() {
    const hash = location.hash;
    if (!hash || hash === '#') { showListView(); return; }
    const m = hash.match(/^#c(.+?)(?:s(\d+))?$/);
    if (!m || !ALL_FILES[m[1]]) { showListView(); return; }
    const fileId = m[1], entryId = m[2] || null;
    // 同文件只滚动，不同文件完整渲染
    if (fileId === currentFileId) {
        if (entryId) scrollToSection(entryId);
    } else {
        showDetailView(fileId, entryId);
    }
}

window.addEventListener('hashchange', route);
window.addEventListener('DOMContentLoaded', function() {
    buildListUI();
    route();
});

// ========== 列表视图 ==========
function buildListUI() {
    const challengeIds = [], otherIds = [];
    for (const id in ALL_FILES) {
        (ALL_FILES[id].isChallenge ? challengeIds : otherIds).push(id);
    }
    challengeIds.sort((a, b) => (a | 0) - (b | 0));
    otherIds.sort();

    document.getElementById('challengeCount').textContent = challengeIds.length;
    document.getElementById('otherCount').textContent = otherIds.length;
    document.getElementById('totalChallenges').textContent =
        String(challengeIds.length).padStart(2, '0') + ' CHALLENGES';
    document.getElementById('totalOthers').textContent =
        String(otherIds.length).padStart(2, '0') + ' FILES';

    document.getElementById('challengeList').innerHTML = challengeIds.map(buildFileRow).join('');

    const otherSection = document.getElementById('otherSection');
    const otherList = document.getElementById('otherList');
    if (otherIds.length) {
        otherSection.style.display = '';
        otherList.innerHTML = otherIds.map(buildFileRow).join('');
    } else {
        otherSection.style.display = 'none';
    }
}

function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildFileRow(id) {
    const f = ALL_FILES[id];
    var title = escapeHtml(f.title);
    return '<div class="file-row" data-search="' + id + ' ' + title + '">'
        + '<span class="file-num' + (id.length > 2 ? ' long' : '') + '">' + id + '</span>'
        + '<a href="#c' + id + '" class="file-title">' + title + '</a>'
        + '</div>';
}

function showListView() {
    detailView.style.display = 'none';
    listView.style.display = '';
    document.body.className = 'home-page';
    currentFileId = null;
    document.title = '以撒代码挑战 - Keye3Tuido';
    window.scrollTo(0, 0);
}

// ========== 详情视图 ==========
function showDetailView(fileId, entryId) {
    listView.style.display = 'none';
    detailView.style.display = '';
    document.body.className = 'challenge-page';
    currentFileId = fileId;

    const f = ALL_FILES[fileId];
    detailTitle.textContent = f.title;
    subLegend.textContent = f.fname + ' - @Keye3Tuido';
    document.title = f.title + ' - 以撒代码挑战';

    renderSections(f);
    if (entryId) scrollToSection(entryId);
    else window.scrollTo(0, 0);
}

// 在当前页面内滚动到指定条目（不重建 DOM）
function scrollToSection(entryId) {
    const target = document.getElementById('s' + entryId);
    if (!target) return;
    target.classList.remove('collapsed');
    requestAnimationFrame(() => {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
}

function renderSections(f) {
    codeArea.innerHTML = '';
    const lines = f.raw.split('\n');
    const n = lines.length;
    let i = 0, secIdx = 0;

    while (i < n) {
        while (i < n && isBlank(lines[i])) i++;
        if (i >= n) break;

        const header = [];
        while (i < n && isComment(lines[i])) { header.push(lines[i]); i++; }

        const codeLines = [];
        while (i < n && !isComment(lines[i])) {
            if (!isBlank(lines[i])) codeLines.push({ no: i + 1, text: lines[i] });
            i++;
        }

        secIdx++;
        const section = document.createElement('div');
        section.className = 'section';

        let entryNum = null;
        if (header.length) {
            const m = header[0].match(/^--(\d+)\./);
            if (m) entryNum = m[1];
        }
        section.id = 's' + (entryNum || secIdx);

        const head = document.createElement('div');
        head.className = 'section-header';

        if (codeLines.length) {
            const arrow = document.createElement('span');
            arrow.className = 'arrow';
            arrow.textContent = '\u25BC';
            head.appendChild(arrow);
        }

        const text = document.createElement('span');
        text.className = 'header-text';
        if (header.length) {
            header.forEach((c, k) => {
                const span = document.createElement('span');
                span.textContent = c;
                text.appendChild(span);
                if (k < header.length - 1) text.appendChild(document.createTextNode('\n'));
            });
        } else {
            text.textContent = '\u4ee3\u7801';
        }
        head.appendChild(text);
        section.appendChild(head);

        if (codeLines.length) {
            section.classList.add('collapsed');
            head.onclick = () => {
                section.classList.toggle('collapsed');
                history.replaceState(null, null, '#c' + currentFileId + 's' + (entryNum || secIdx));
            };
            section.appendChild(buildCodeBox(codeLines));
        } else {
            head.classList.add('no-code');
        }

        codeArea.appendChild(section);
    }
}

// ========== 代码渲染 ==========
function isComment(l) {
    return l.replace(/^l /, '').trim().startsWith('--');
}
function isBlank(l) { return l.trim() === ''; }

function buildCodeBox(codeLines) {
    const box = document.createElement('div');
    box.className = 'code-box';
    const blockText = codeLines.map(it => it.text).join('\n');
    box.onclick = e => copyBlock(blockText, codeLines.length, e);
    box.oncontextmenu = e => { e.preventDefault(); navigator.clipboard.writeText(location.href).then(() => showToastAt('\u5df2\u590d\u5236\u94fe\u63a5\u5230\u526a\u8d34\u677f', e.clientX, e.clientY)).catch(() => showToastAt('\u590d\u5236\u5931\u8d25', e.clientX, e.clientY)); };
    bindHover(box, blockText.length);

    codeLines.forEach(item => {
        const ln = document.createElement('div');
        ln.className = 'cell-ln';
        ln.textContent = item.no;
        box.appendChild(ln);
        const code = document.createElement('div');
        code.className = 'cell-code';
        code.textContent = item.text;
        box.appendChild(code);
    });
    return box;
}

function bindHover(el, charCount) {
    el.onmouseenter = e => showHoverTip(e.clientX, e.clientY, charCount);
    el.onmousemove = e => showHoverTip(e.clientX, e.clientY, charCount);
    el.onmouseleave = hideHoverTip;
}

// ========== 复制 ==========
function copyBlock(text, count, e) {
    if (!text) return;
    navigator.clipboard.writeText(text)
        .then(() => showToastAt('\u5df2\u590d\u5236\u8be5\u4ee3\u7801\u5757\uff08' + count + ' \u884c\uff0c' + text.length + ' \u5b57\u7b26\uff09', e.clientX, e.clientY))
        .catch(err => showToastAt('\u590d\u5236\u5931\u8d25: ' + err, e.clientX, e.clientY));
}

function copyAllCode(e) {
    const f = ALL_FILES[currentFileId];
    if (!f) return;
    navigator.clipboard.writeText(f.raw)
        .then(() => showToastAt('\u5df2\u590d\u5236\u4ee3\u7801\u5230\u526a\u8d34\u677f', e.clientX, e.clientY))
        .catch(() => showToastAt('\u590d\u5236\u5931\u8d25', e.clientX, e.clientY));
}

function copyLink(e) {
    var url = location.origin + location.pathname + '#c' + currentFileId;
    navigator.clipboard.writeText(url)
        .then(() => showToastAt('\u5df2\u590d\u5236\u94fe\u63a5\u5230\u526a\u8d34\u677f', e.clientX, e.clientY))
        .catch(() => showToastAt('\u590d\u5236\u5931\u8d25', e.clientX, e.clientY));
}

// ========== 下载 ZIP ==========
let jsZipPromise;
function ensureJsZip() {
    if (window.JSZip) return Promise.resolve(window.JSZip);
    if (!jsZipPromise) {
        jsZipPromise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
            script.async = true;
            script.onload = () => resolve(window.JSZip);
            script.onerror = () => reject(new Error('JSZip load failed'));
            document.head.appendChild(script);
        });
    }
    return jsZipPromise;
}

function escapeXml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function downloadZip(e) {
    const f = ALL_FILES[currentFileId];
    if (!f) return;
    await ensureJsZip();
    try {
        const filename = 'code' + currentFileId + '.zip';
        const zip = new JSZip();
        zip.file('main.lua', f.cleaned);
        var safeTitle = escapeXml(f.title);
        var safeId = escapeXml(currentFileId);
        const metadata = '\n            <metadata>\n                <name>code' + safeId + '-' + safeTitle + '</name>\n                <directory>code' + safeId + '</directory>\n                <description/>\n                <version>1.0</version>\n                <visibility/>\n            </metadata>';
        zip.file('metadata.xml', metadata.trim());
        const blob = await zip.generateAsync({ type: 'blob' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
        URL.revokeObjectURL(a.href);
        showToastAt('\u5df2\u4e0b\u8f7d\u6a21\u7ec4\u6587\u4ef6; \u5c06\u6587\u4ef6\u89e3\u538b\u81f3\u6e38\u620fmods\u76ee\u5f55\u4e0b\u5373\u53ef\u8fdb\u884c\u6e38\u620f', e.clientX, e.clientY);
    } catch (err) {
        showToastAt('\u4e0b\u8f7d\u5931\u8d25: ' + err, e.clientX, e.clientY);
    }
}

// ========== Toast / Tooltip ==========
let toastTimer;
function showToastAt(m, x, y) {
    clearTimeout(toastTimer);
    if (toast.parentNode !== document.body) document.body.appendChild(toast);
    toast.textContent = m;
    toast.style.display = 'block';
    toast.style.visibility = 'hidden';
    toast.style.opacity = 0;
    const offset = 14, pad = 8;
    const rect = toast.getBoundingClientRect();
    let left = x + offset, top = y + offset;
    if (left + rect.width > innerWidth - pad) left = x - rect.width - offset;
    if (top + rect.height > innerHeight - pad) top = y - rect.height - offset;
    left = Math.max(pad, Math.min(left, innerWidth - rect.width - pad));
    top = Math.max(pad, Math.min(top, innerHeight - rect.height - pad));
    toast.style.left = left + 'px';
    toast.style.top = top + 'px';
    toast.style.visibility = 'visible';
    toast.style.opacity = 1;
    toastTimer = setTimeout(() => { toast.style.opacity = 0; toast.style.display = 'none'; }, 2200);
}

function showHoverTip(x, y, charCount) {
    if (hoverTip.parentNode !== document.body) document.body.appendChild(hoverTip);
    hoverTip.textContent = '\u5de6\u952e\u590d\u5236\u4ee3\u7801\uff0c\u53f3\u952e\u590d\u5236\u94fe\u63a5';
    hoverTip.style.display = 'block';
    hoverTip.style.visibility = 'hidden';
    const rect = hoverTip.getBoundingClientRect();
    const offset = 12, pad = 6;
    let left = x + offset, top = y + offset;
    if (left + rect.width > innerWidth - pad) left = x - rect.width - offset;
    if (top + rect.height > innerHeight - pad) top = y - rect.height - offset;
    hoverTip.style.left = Math.max(pad, left) + 'px';
    hoverTip.style.top = Math.max(pad, top) + 'px';
    hoverTip.style.visibility = 'visible';
    hoverTip.style.opacity = 1;
}

function hideHoverTip() {
    hoverTip.style.opacity = 0;
    hoverTip.style.display = 'none';
}

// ========== 返回列表 ==========
function goBackToList(e) {
    e.preventDefault();
    history.replaceState(null, null, location.pathname);
    route();
}

// ========== 列表搜索 ==========
function handleSearch() {
    const t = searchInput.value.toLowerCase();
    let shown = 0;
    document.querySelectorAll('.file-list').forEach(list => {
        let listShown = 0;
        for (const item of list.children) {
            const match = item.getAttribute('data-search').toLowerCase().indexOf(t) !== -1;
            item.style.display = match ? '' : 'none';
            if (match) listShown++;
        }
        const section = list.closest('.list-section');
        if (section) section.style.display = listShown ? '' : 'none';
        shown += listShown;
    });
    document.getElementById('noResult').style.display = shown ? 'none' : 'block';
}
