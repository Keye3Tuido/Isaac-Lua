// mock 渲染验证：用最小 DOM 桩在 Node 中跑真实 page.js，验证
//   ① 依赖标记（.dep-note）的渲染位置与文本
//   ② 块内参数块的参数面板（标题「自定义参数」、无模板徽标、输入即时重渲染）
//   ③ 模板引用块面板与徽标不回归
//   ④ 罗马数字锚点路由（#c1sII 滚动命中，非法锚点回列表）
//   ⑤ 显示格式：注释头无 -- 前缀（N. 说明）；说明自带数字编号时不叠加块编号
//   ⑥ 名称标签（.name-badge）：有 name 的块渲染、无 name 的块不渲染
//   ⑦ 复制全部组装文本保持 --N. 与 l 前缀（控制台粘贴格式不随页面显示改动）
//   ⑧ 列表搜索：文件/模板id/注释/名称的块级命中，两栏结果（文件标题 + 关键字匹配），清空恢复
// 运行：node tests/builder/mock_render.js
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

// ---------- 最小 DOM 桩 ----------
function makeEl(tag) {
    const el = {
        tagName: (tag || 'div').toUpperCase(),
        children: [],
        parentNode: null,
        style: {},
        attributes: {},
        listeners: {},
        textContent: '',
        value: '',
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
    'challengeSection', 'searchSection', 'searchList', 'searchCount',
    'noResult', 'searchInput']) {
    named[id] = makeEl('div');
    named[id].id = id;
}
const bodyEl = makeEl('body');
bodyEl.appendChild(named.listView);
bodyEl.appendChild(named.detailView);
named.detailView.appendChild(named.codeArea);

const documentStub = {
    body: bodyEl,
    createElement: tag => makeEl(tag),
    getElementById: id => {
        if (named[id]) return named[id];
        return walk(bodyEl).find(e => e.id === id) || null;
    },
    querySelectorAll: () => [],
    addEventListener: () => {},
};

// ---------- 载入真实 page.js（注入 mock 数据） ----------
// 键 = 文件键：挑战 c1、工具 u1（与挑战同号，验证两类目录独立编号）
const ALL_FILES = {
    'c1': {
        id: '1', key: 'c1', title: '样例挑战', fname: '1.样例.lua', isChallenge: true,
        header: ['--样例'],
        blocks: [
            { num: '0', comment: '前置安全包装。', code: 'MEC()', region: 'pre', name: '安全包装' },
            { num: 'I', comment: '前置清理。', code: 'CLM()', region: 'pre', deps: ['安全包装', '清理回调'] },
            { num: '1', comment: '生成道具700。', code: 'Isaac.Spawn(5,100,700)', tpl: 'tpl-x', values: { P1: 700 } },
            {
                num: '2', comment: '块内生成道具653。', code: 'Spawn(653)',
                params: { P1: { '说明': '道具编号', '性质': '局部', '默认': 653 } },
                values: { P1: 653 }, body: 'Spawn(P1)', commentTpl: '块内生成道具{P1}。',
            },
            { num: '3', comment: '数据保存：门编号持久化。', code: 'Save(1)', name: '数据保存' },
            { num: 'II', comment: '后置重开。', code: 'Isaac.Restart()', region: 'post' },
        ],
    },
    'u1': {
        id: '1', key: 'u1', title: '工具包', fname: '1.工具包.lua', isChallenge: false,
        header: [],
        blocks: [
            { num: 0, comment: '通用工具片段。', code: 'Tool(1)' },
            { num: 1, comment: '工具第二段。', code: 'Tool(2)' },
        ],
    },
};
const TEMPLATES = {
    'tpl-x': {
        body: 'Isaac.Spawn(5,100,P1)', '说明': '生成道具{P1}。',
        params: { P1: { '说明': '道具编号', '性质': '局部', '默认': 653 } },
    },
};

let src = fs.readFileSync(path.join(REPO_ROOT, 'page.js'), 'utf8');
src = src.replace('__ALL_FILES__', JSON.stringify(ALL_FILES))
         .replace('__ALL_TEMPLATES__', JSON.stringify(TEMPLATES));

const locationStub = { hash: '', hostname: 'localhost', protocol: 'http:', pathname: '/', search: '', origin: 'http://localhost' };
const sandbox = {
    console, document: documentStub, location: locationStub,
    history: { replaceState: () => {} },
    navigator: {},
    addEventListener: () => {},
    scrollTo: () => {},
    requestAnimationFrame: fn => fn(),
    innerWidth: 1024, innerHeight: 768,
    setTimeout, clearTimeout,
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(src, sandbox, { filename: 'page.js' });

// ---------- 断言工具 ----------
let failures = 0;
function check(label, cond) {
    if (cond) { console.log('PASS  ' + label); }
    else { failures++; console.log('FAIL  ' + label); }
}
function findById(id) { return walk(bodyEl).find(e => e.id === id) || null; }
function findByClass(root, cls) { return walk(root).filter(e => e._classes.has(cls)); }

// ---------- 渲染详情页 ----------
vm.runInContext("showDetailView('c1')", sandbox);
const codeArea = named.codeArea;

// ① 依赖标记：sI 块（pre 组内）dep-note 在 section-header 之后、code-box 之前
const secI = findById('sI');
check('罗马编号锚点 sI 存在', !!secI);
const depNotes = findByClass(secI, 'dep-note');
check('sI 渲染出一个 .dep-note', depNotes.length === 1);
if (depNotes.length) {
    check('dep-note 文本为「依赖：安全包装、清理回调」',
        depNotes[0].textContent === '依赖：安全包装、清理回调');
    const kinds = secI.children.map(c => c.className);
    check('dep-note 位于 section-header 之后、code-box 之前',
        kinds.indexOf('dep-note') > kinds.findIndex(k => k.startsWith('section-header')) &&
        kinds.indexOf('dep-note') < kinds.indexOf('code-box'));
}
check('s0 无 dep-note', findByClass(findById('s0'), 'dep-note').length === 0);

// ② 块内参数块（s2）：自定义参数面板、无徽标、输入即时生效
const sec2 = findById('s2');
const badges2 = findByClass(sec2, 'tpl-badge');
check('块内参数块不打模板徽标', badges2.length === 0);
const titles2 = findByClass(sec2, 'tpl-panel-title');
check('块内参数块渲染参数面板', titles2.length === 1);
if (titles2.length) check('面板标题为「自定义参数」', titles2[0].textContent === '自定义参数');
const inputs2 = findByClass(sec2, 'tpl-input');
check('面板输入框默认值为构建期默认值 653', inputs2.length === 1 && inputs2[0].value === '653');
if (inputs2.length) {
    inputs2[0].value = '700';
    inputs2[0].dispatch('input');
    const codeText = findByClass(sec2, 'cell-code').map(c => c.textContent).join('\n');
    check('改参后代码框重渲染为 Spawn(700)', codeText.includes('l Spawn(700)'));
    const headText = findByClass(sec2, 'header-text')[0].textContent;
    check('改参后说明重插值为「块内生成道具700。」', headText.includes('块内生成道具700。'));
    check('面板进入 modified 状态', findByClass(sec2, 'tpl-panel')[0]._classes.has('modified'));
}

// ③ 模板引用块（s1）不回归：徽标 + 标题
const sec1 = findById('s1');
const badges1 = findByClass(sec1, 'tpl-badge');
check('模板引用块带 tpl-ref 徽标', badges1.length === 1 && badges1[0]._classes.has('tpl-ref'));
const titles1 = findByClass(sec1, 'tpl-panel-title');
check('模板引用块面板标题为「模板参数 · tpl-x」',
    titles1.length === 1 && titles1[0].textContent === '模板参数 · tpl-x');

// ⑤ 显示格式：注释头不带 -- 前缀；说明自带数字编号时不叠加块编号、同样不带 -- 前缀
const head0 = findByClass(findById('s0'), 'header-text')[0].textContent;
check('s0 注释头显示「0. 前置安全包装。」（无 -- 前缀）', head0 === '0. 前置安全包装。');
const headI = findByClass(secI, 'header-text')[0].textContent;
check('罗马编号注释头显示「I. 前置清理。」（无 -- 前缀）', headI === 'I. 前置清理。');
const sec3 = findById('s3');
const head3 = findByClass(sec3, 'header-text')[0].textContent;
check('说明一律自动叠加块编号「3. 」（数据中无手工前缀，无 -- 前缀）',
    head3 === '3. 数据保存：门编号持久化。');

// ⑥ 名称标签：声明 name 的块渲染 .name-badge（模板徽标旁），未声明的不渲染
const nameBadges0 = findByClass(findById('s0'), 'name-badge');
check('s0 渲染名称标签「安全包装」',
    nameBadges0.length === 1 && nameBadges0[0].textContent === '安全包装');
const nameBadges3 = findByClass(sec3, 'name-badge');
check('s3 渲染名称标签「数据保存」',
    nameBadges3.length === 1 && nameBadges3[0].textContent === '数据保存');
check('s1（无 name）不渲染名称标签', findByClass(sec1, 'name-badge').length === 0);

// ⑦ 复制全部组装文本保持 --N. 与 l 前缀（说明自带编号也照常叠加，不随页面显示改动）
const rawText = vm.runInContext('currentRawText()', sandbox);
check('复制文本保留「--0. 前置安全包装。\\nl MEC()」',
    rawText.includes('--0. 前置安全包装。\nl MEC()'));
check('复制文本照常叠加「--3. 数据保存：门编号持久化。」',
    rawText.includes('--3. 数据保存：门编号持久化。\nl Save(1)'));

// ④ 罗马数字锚点路由：#c1sII 命中后置块；#c1sZ 非法回列表
locationStub.hash = '#c1sII';
vm.runInContext('route()', sandbox);
const secII = findById('sII');
check('路由 #c1sII 命中后置块并解除折叠', !!secII && !secII._classes.has('collapsed'));
locationStub.hash = '#c1sZ';
vm.runInContext('route()', sandbox);
check('非法锚点 #c1sZ 回退到列表视图', named.listView.style.display !== 'none');

// ④b 工具命名空间：同一编号的工具用 #u 前缀（与挑战 c1 并存不冲突）
locationStub.hash = '#u1s0';
vm.runInContext('route()', sandbox);
const utilSec0 = findById('s0');
check('路由 #u1s0 命中工具条目（与挑战同号不冲突）',
    !!utilSec0 && named.detailTitle.textContent === '工具包');
locationStub.hash = '#u1';
vm.runInContext('route()', sandbox);
check('路由 #u1 命中工具文件', named.detailTitle.textContent === '工具包');
locationStub.hash = '#c1';
vm.runInContext('route()', sandbox);
check('路由 #c1 仍命中挑战文件', named.detailTitle.textContent === '样例挑战');

// ⑧ 列表搜索：文件/模板id/注释/名称的块级命中，两栏（文件标题 + 关键字匹配）
vm.runInContext('buildListUI()', sandbox);
const searchHtml = () => named.searchList.innerHTML;
check('工具文件行链接为 #u1', named.otherList.innerHTML.indexOf('href="#u1"') !== -1);
check('挑战文件行链接为 #c1', named.challengeList.innerHTML.indexOf('href="#c1"') !== -1);

named.searchInput.value = 'tpl-x';
vm.runInContext('handleSearch()', sandbox);
check('搜索命中后显示搜索结果区', named.searchSection.style.display !== 'none');
check('模板id搜索命中 tpl-x 块（锚点 #c1s1）', searchHtml().indexOf('#c1s1') !== -1);
check('关键字匹配栏显示「模板·tpl-x」', searchHtml().indexOf('模板·') !== -1 && searchHtml().indexOf('tpl-x') !== -1);
check('搜索计数为 1', named.searchCount.textContent === 1);
check('搜索时隐藏原“挑战/库”分区', named.challengeSection.style.display === 'none');

named.searchInput.value = '生成道具700';
vm.runInContext('handleSearch()', sandbox);
check('注释搜索命中「生成道具700」块', searchHtml().indexOf('生成道具700') !== -1 && searchHtml().indexOf('#c1s1') !== -1);

named.searchInput.value = '安全包装';
vm.runInContext('handleSearch()', sandbox);
check('名称搜索命中「安全包装」块（锚点 #c1s0）', searchHtml().indexOf('安全包装') !== -1 && searchHtml().indexOf('#c1s0') !== -1);

named.searchInput.value = '工具第二段';
vm.runInContext('handleSearch()', sandbox);
check('工具条目注释搜索命中 #u1s1', searchHtml().indexOf('#u1s1') !== -1);

named.searchInput.value = '样例';
vm.runInContext('handleSearch()', sandbox);
check('标题搜索命中文件「样例挑战」', searchHtml().indexOf('样例') !== -1 && searchHtml().indexOf('#c1"') !== -1);

named.searchInput.value = '';
vm.runInContext('handleSearch()', sandbox);
check('清空搜索后恢复列表并隐藏搜索区',
    named.searchSection.style.display === 'none' && named.challengeSection.style.display !== 'none');

console.log(failures ? `\n合计 ${failures} 项失败` : '\n全部通过');
process.exit(failures ? 1 : 0);
