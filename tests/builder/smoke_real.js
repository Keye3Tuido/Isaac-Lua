// 临时冒烟：用真实构建产物 index.html 内嵌的 page.js + 真实数据跑最小 DOM 渲染
// 详情数据走 kb/<key>.json 分片懒加载：vm 沙盒没有 fetch，注入读仓库 kb/ 目录的 mock
// 用法：node smoke_real.js <repoRoot>
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const REPO = process.argv[2];

const html = fs.readFileSync(path.join(REPO, 'index.html'), 'utf8');
// index.html 以 CRLF 写出；页面含多个 <script>（百度统计在前），取含 ALL_FILES 的主脚本块
const blocks = [...html.matchAll(/<script>\r?\n([\s\S]*?)\r?\n\s*<\/script>/g)].map(x => x[1]);
const src = blocks.find(s => s.includes('const ALL_FILES'));
if (!src) { console.error('FAIL 未能从 index.html 提取主脚本'); process.exit(1); }

function makeEl(tag) {
    const el = {
        tagName: (tag || 'div').toUpperCase(), children: [], parentNode: null,
        style: {}, attributes: {}, listeners: {}, textContent: '', value: '',
        _classes: new Set(),
    };
    Object.defineProperty(el, 'className', {
        get() { return [...el._classes].join(' '); },
        set(v) { el._classes = new Set(String(v).split(/\s+/).filter(Boolean)); },
    });
    Object.defineProperty(el, 'innerHTML', {
        get() { return el._html || ''; },
        set(v) { el._html = v; if (v === '') el.children = []; },
    });
    el.classList = {
        add: (...cs) => cs.forEach(c => el._classes.add(c)),
        remove: (...cs) => cs.forEach(c => el._classes.delete(c)),
        contains: c => el._classes.has(c),
        toggle: (c, force) => {
            const want = force === undefined ? !el._classes.has(c) : !!force;
            want ? el._classes.add(c) : el._classes.delete(c);
            return want;
        },
    };
    el.appendChild = child => { child.parentNode = el; el.children.push(child); return child; };
    el.setAttribute = (k, v) => { el.attributes[k] = String(v); };
    el.getAttribute = k => (k in el.attributes ? el.attributes[k] : null);
    el.addEventListener = (ev, fn) => { (el.listeners[ev] = el.listeners[ev] || []).push(fn); };
    el.dispatch = (ev, arg) => (el.listeners[ev] || []).forEach(fn => fn(arg));
    el.closest = sel => {
        const cls = sel.replace(/^\./, '');
        let p = el.parentNode;
        while (p) { if (p._classes && p._classes.has(cls)) return p; p = p.parentNode; }
        return null;
    };
    el.getBoundingClientRect = () => ({ left: 0, top: 0, width: 10, height: 10 });
    el.scrollIntoView = () => {};
    return el;
}
function walk(el, out) {
    out = out || [];
    for (const c of el.children) { out.push(c); walk(c, out); }
    return out;
}

const named = {};
for (const id of ['listView', 'detailView', 'detailTitle', 'subLegend', 'codeArea', 'toast', 'hoverTip',
    'copyCodeBtn', 'downloadBtn', 'buttonGroup', 'challengeCount', 'otherCount',
    'totalChallenges', 'totalOthers', 'challengeList', 'otherList', 'otherSection',
    'noResult', 'searchInput']) {
    named[id] = makeEl('div');
    named[id].id = id;
}
const bodyEl = makeEl('body');
bodyEl.appendChild(named.listView);
bodyEl.appendChild(named.detailView);
named.detailView.appendChild(named.codeArea);

const sandbox = {
    console,
    document: {
        body: bodyEl,
        head: makeEl('head'),   // 内嵌脚本工具（_toolbox.js）加载时向 head 注入样式
        createElement: tag => makeEl(tag),
        getElementById: id => named[id] || walk(bodyEl).find(e => e.id === id) || null,
        querySelectorAll: () => [],
        addEventListener: () => {},
    },
    location: { hash: '', hostname: 'localhost', protocol: 'http:', pathname: '/', search: '', origin: 'http://localhost' },
    history: { replaceState: () => {} },
    navigator: {},
    addEventListener: () => {},
    scrollTo: () => {},
    requestAnimationFrame: fn => fn(),
    innerWidth: 1024, innerHeight: 768,
    setTimeout, clearTimeout,
};
// page.js 的 loadDetail 走 fetch('kb/<key>.json?v=<BUILD_TS>')，用仓库 kb/ 的真实分片应答
sandbox.fetch = function(url) {
    const m = String(url).match(/^kb\/([^/?]+)\.json(?:\?.*)?$/);
    let data = null;
    if (m) {
        try { data = JSON.parse(fs.readFileSync(path.join(REPO, 'kb', m[1] + '.json'), 'utf8')); }
        catch (_) { data = null; }
    }
    return Promise.resolve(data
        ? { ok: true, status: 200, json: () => Promise.resolve(data) }
        : { ok: false, status: 404, json: () => Promise.resolve(null) });
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(src, sandbox, { filename: 'embedded-page.js' });

let failures = 0;
function check(label, cond) {
    if (cond) { console.log('PASS  ' + label); }
    else { failures++; console.log('FAIL  ' + label); }
}
function findById(id) { return walk(bodyEl).find(e => e.id === id) || null; }
function findByClass(root, cls) { return walk(root).filter(e => e._classes.has(cls)); }

// showDetailView 的详情分片加载是异步的（loadDetail Promise）：fetch mock 立即兑现，
// 等一轮 macrotask 即可排空整条微任务链（fetch → json → 渲染）
function flush() { return new Promise(r => setTimeout(r, 0)); }

(async () => {
// 全文件扫描统计（真实元数据契约：块仅 num/comment/name/tpl/tplDef/region，详情在分片）
const ALL_FILES = vm.runInContext('ALL_FILES', sandbox);
let namedBlocks = 0, totalBlocks = 0, codeBlocks = 0;
for (const id in ALL_FILES) for (const b of ALL_FILES[id].blocks) {
    totalBlocks++; if (b.name) namedBlocks++; if ('code' in b) codeBlocks++;
}
check('真实元数据含 name 字段的块（>0）', namedBlocks > 0);
check('元数据块不含 code 字段（详情走 kb/ 分片懒加载）', codeBlocks === 0);
console.log('      （共 ' + totalBlocks + ' 块，其中 ' + namedBlocks + ' 块带 name）');

// 列表分区排序（回归：工具分区曾按文件键字符串排，u10 被排到 u2 之前）：
// 数值编号升序；非数字编号（TMPL 框架文件）排在同分区末尾
vm.runInContext('buildListUI()', sandbox);
const listKeys = el => (el.innerHTML.match(/href="#[^"]+"/g) || []).map(s => s.slice(7, -1));
const numOf = k => (/^\d+$/.test(String(ALL_FILES[k].id)) ? Number(ALL_FILES[k].id) : Infinity);
const utilKeys = listKeys(named.otherList);
const challengeKeys = listKeys(named.challengeList);
check('库分区行数 = 工具文件数', utilKeys.length === Object.keys(ALL_FILES).filter(k => !ALL_FILES[k].isChallenge).length);
check('库分区按编号数值升序（非数字编号排末尾）',
    utilKeys.every((k, i) => i === 0 || numOf(utilKeys[i - 1]) <= numOf(k)) &&
    utilKeys.slice(0, -1).every(k => Number.isFinite(numOf(k))) &&
    !Number.isFinite(numOf(utilKeys[utilKeys.length - 1])));
check('库分区 u2 在 u10 之前（字符串序回归）',
    utilKeys.indexOf('u2') !== -1 && utilKeys.indexOf('u2') < utilKeys.indexOf('u10'));
check('挑战分区按编号数值升序',
    challengeKeys.every((k, i) => i === 0 || numOf(challengeKeys[i - 1]) <= numOf(k)));

// 挑一个带 名称 的挑战页渲染：12.永远迷失（前置块 名称: 安全包装/清理回调）
vm.runInContext("showDetailView('c12')", sandbox);
check('分片加载期间显示 loading 态', named.codeArea.innerHTML.indexOf('加载中') !== -1);
await flush();
const badges = findByClass(named.codeArea, 'name-badge');
check('详情页渲染出 name-badge（≥2）', badges.length >= 2);
if (badges.length) check('首个名称标签文本为「安全包装」', badges[0].textContent === '安全包装');
// 编号注释头 = 代码块的 section-header（排除 no-code 的元信息分段，元信息原样直通保留 --）
const heads = findByClass(named.codeArea, 'header-text')
    .filter(h => !(h.parentNode && h.parentNode._classes.has('no-code')));
check('编号注释头均无 -- 前缀', heads.length > 0 && heads.every(h => !h.textContent.startsWith('--')));
check('存在「N. 」编号注释头', heads.some(h => /^\d+\. /.test(h.textContent)));
check('存在罗马「I. 」编号注释头', heads.some(h => /^I\. /.test(h.textContent)));
const raw = vm.runInContext('currentRawText()', sandbox);
check('复制文本不含注释头与分隔线（--N. / --===-- 一律不携带）',
    !raw.includes('--0.') && !raw.includes('--==='));
check('复制文本保留 l 前缀代码行', /\nl \S/.test(raw));

console.log(failures ? `\n合计 ${failures} 项失败` : '\n真实数据冒烟全部通过');
process.exit(failures ? 1 : 0);
})().catch(err => { console.error(err); process.exit(1); });
