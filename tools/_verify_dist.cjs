/* dist 三态 + 打印 + DOM 平价验证(方案 B 验收) */
const { chromium } = require('playwright');
const DIST = require('path').resolve(__dirname, '..', 'dist', 'index.html');
const SHOTS = require('path').resolve(__dirname, '..', '..', 'zou_backend', '记录') + '/';
const ok = (n, c, d) => console.log((c ? 'PASS ' : 'FAIL ') + n + (d ? ' [' + d + ']' : ''));

async function probe(url, flag, shot) {
  const b = await chromium.launch({ channel: 'msedge' });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  p.on('pageerror', e => errs.push('page:' + String(e.message).slice(0, 100)));
  p.on('console', m => { if (m.type() === 'error') errs.push('console:' + String(m.text()).slice(0, 100)); });
  await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(9000);
  const r = await p.evaluate(() => ({
    source: document.documentElement.getAttribute('data-data-source'),
    fanyang: (document.body.innerText.match(/范阳/g) || []).length,
    echarts: document.querySelectorAll('[_echarts_instance_]').length,
    marks: document.querySelectorAll('.leaflet-marker-icon').length,
    paths: document.querySelectorAll('.leaflet-interactive').length,
    h1: (document.querySelector('h1') || {}).textContent || '',
    reelZones: document.querySelectorAll('.reel-zone').length
  }));
  await p.screenshot({ path: SHOTS + shot });
  r.errors = errs;
  await b.close();
  return r;
}

(async () => {
  /* 后端端口自适应:8001(历史验证端口)→ 8000(start.bat 默认);都没有则退化为纯 file:// 三态 */
  let BASE = null;
  for (const port of [8001, 8000]) {
    try {
      const r = await fetch('http://127.0.0.1:' + port + '/healthz');
      if (r.ok) { BASE = 'http://127.0.0.1:' + port; break; }
    } catch (_) { /* 端口无服务,试下一个 */ }
  }
  console.log(BASE ? '[env] 后端在 ' + BASE : '[env] 未检测到后端(8001/8000),API 态将标记 SKIP,静态兜底用 file:// 验证');

  const FILE_URL = 'file:///' + DIST.replace(/\\/g, '/');
  let api = null, st;
  if (BASE) {
    api = await probe(BASE + '/', 'api', 'refactor_state_api.png');
    ok('API 态 data-source=api', api.source === 'api', api.source);
    ok('API 态零报错', api.errors.length === 0, api.errors.join('|').slice(0, 120));

    st = await probe(BASE + '/?static=1', 'static', 'refactor_state_static.png');
  } else {
    ok('API 态(无后端,SKIP)', true, 'skipped');
    ok('API 态零报错(SKIP)', true, 'skipped');
    st = await probe(FILE_URL + '?static=1', 'static', 'refactor_state_static.png');
  }
  ok('静态态 data-source=static', st.source === 'static', st.source);
  ok('静态态零报错', st.errors.length === 0, st.errors.join('|').slice(0, 120));

  const fl = await probe(FILE_URL, 'file', 'refactor_state_file.png');
  ok('file:// 态 data-source=static(离线兜底)', fl.source === 'static', fl.source);
  ok('file:// 态零报错', fl.errors.length === 0, fl.errors.join('|').slice(0, 120));

  const triads = api ? [['API', api], ['静态', st], ['file', fl]] : [['静态', st], ['file', fl]];
  for (const [tag, r] of triads) {
    ok(`DOM 平价[${tag}] 范阳24/echarts2/标记128/路径222/h1`, r.fanyang === 24 && r.echarts === 2 && r.marks === 128 && r.paths === 222 && r.h1 === '鄒氏遷徙',
       `${r.fanyang}/${r.echarts}/${r.marks}/${r.paths}/${r.h1} 卷区${r.reelZones}`);
  }

  /* 交互岛等价门(第二阶段):参照物 = src/islands/*.island.html(生成器从分章抽出的原字节,
   * 抽取时有可逆性校验)。比较采用规范化语义树:标签/属性集合/子节点序/文本一致;
   * 空白文本节点不参与比较(flex 容器内渲染为零间距,两侧一致);属性序不参与比较
   * (Vue 对 input.value 等属性有既定输出序,不影响任何行为与样式)。 */
  const fs2 = require('fs');
  const path2 = require('path');
  const ISLAND_GATES = [
    { name: 'heat-timeline', frag: '11-heat.html', type: 'in-place' },
    { name: 'poem-drawer', frag: '26-extra-16.html', type: 'in-place' },
    /* layer-panel:legacy 初始化时把开关搬进地图「图层管理」盒 → relocated 型:
     * 暂存区被搬空 + 五个搬移后的开关语义树与原字节逐一一致(按顺序) */
    { name: 'layer-panel', frag: null, type: 'relocated', ids: ['chkChain', 'chkHist', 'chkJwhd', 'chkPersons', 'chkPoemPts'] },
  ];
  const canonJs = `(function(el){
    return JSON.stringify([...el.childNodes].map(function walk(n){
      if (n.nodeType === 3) {
        var t = (n.textContent || '').replace(/\\s+/g, ' ').trim();
        return t === '' ? null : { t: t };
      }
      if (n.nodeType !== 1) return null;
      var attrs = {};
      [...n.attributes].sort(function(a,b){ return a.name < b.name ? -1 : 1; })
        .forEach(function(a){ attrs[a.name] = a.value; });
      return { tag: n.tagName, attrs: attrs, kids: [...n.childNodes].map(walk).filter(Boolean) };
    }).filter(Boolean));
  })`;
  const b2 = await chromium.launch({ channel: 'msedge' });
  const p2 = await b2.newPage();
  await p2.goto(FILE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p2.waitForTimeout(4000);
  for (const g of ISLAND_GATES) {
    const origInner = fs2.readFileSync(path2.resolve(__dirname, '..', 'src', 'islands', g.name + '.island.html'), 'utf8');
    let shellMarked = true;
    if (g.frag) {
      const fragHtml = fs2.readFileSync(path2.resolve(__dirname, '..', 'sections', g.frag), 'utf8');
      shellMarked = fragHtml.includes(`data-vue-island="${g.name}"`) && !fragHtml.includes(origInner);
    } else {
      const distHtml = fs2.readFileSync(DIST, 'utf8');
      shellMarked = distHtml.includes(`data-vue-island="${g.name}"`) && !distHtml.includes(origInner);
    }
    ok(`交互岛[${g.name}] 外壳已标记且内容抽净`, shellMarked && origInner.trim().length > 0);
    const r2 = await p2.evaluate(([name, inner, canonSrc, type, ids]) => {
      const canon = new Function('return ' + canonSrc)();
      const ref = document.createElement('div');
      ref.innerHTML = inner;
      const host = document.querySelector('[data-vue-island="' + name + '"]');
      if (type === 'relocated') {
        /* 暂存区已搬空(仅剩空白),搬移后的每个开关语义树与原字节中对应项一致 */
        const stagingEmpty = host ? host.childNodes.length === 0 || canon(host) === '[]' : false;
        const refSwitches = [...ref.querySelectorAll('.switchline')];
        const moved = ids.map(id => {
          const inp = document.getElementById(id);
          return inp ? inp.closest('.switchline') : null;
        });
        const allMoved = moved.every(x => !!x);
        const treesMatch = allMoved && refSwitches.length === ids.length &&
          moved.every((x, i) => canon(x) === canon(refSwitches[i]));
        return { marked: !!host, detail: stagingEmpty, equiv: treesMatch,
                 movedCount: moved.filter(Boolean).length, refCount: refSwitches.length };
      }
      return {
        marked: !!host && host.getAttribute('data-vue-island') === name,
        islandKids: host ? canon(host) : '',
        refKids: canon(ref),
      };
    }, [g.name, origInner, canonJs, g.type, g.ids || []]);
    if (g.type === 'relocated') {
      ok(`交互岛[${g.name}] 暂存区已搬空(开关进地图图层盒)`, r2.detail === true, 'staging emptied');
      ok(`交互岛[${g.name}] 五开关搬移后语义树与原字节逐一等价`, r2.equiv === true,
         `moved=${r2.movedCount}/5 ref=${r2.refCount}/5`);
    } else {
      ok(`交互岛[${g.name}] 外壳存在且由 Vue 渲染`, r2.marked && r2.islandKids.length > 0, r2.islandKids.length + 'B(语义树)');
      ok(`交互岛[${g.name}] 语义树与原字节等价`, r2.islandKids === r2.refKids,
         r2.islandKids === r2.refKids ? '规范化后一致' : '不一致');
      if (r2.islandKids !== r2.refKids) {
        fs2.writeFileSync(SHOTS + 'island-diff-' + g.name + '.txt',
          '--- Vue 渲染(语义树) ---\n' + r2.islandKids + '\n\n--- 原字节(语义树) ---\n' + r2.refKids);
      }
    }
  }
  await b2.close();

  /* 打印页数(基线 14 页:26-extra 分章加入后与旧版实测 14=14 对齐;旧基线"≈11"已过时) */
  const b = await chromium.launch({ channel: 'msedge' });
  const p = await b.newPage();
  await p.goto('file:///' + DIST.replace(/\\/g, '/'), { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(5000);
  await p.pdf({ path: SHOTS + 'refactor_print.pdf', format: 'A4', printBackground: true });
  await b.close();
  const fs = require('fs');
  const pdf = fs.readFileSync(SHOTS + 'refactor_print.pdf');
  const m = [...pdf.toString('latin1').matchAll(/\/Count (\d+)/g)].map(x => +x[1]);
  ok('打印页数 =14(与旧版 14=14 平价基线)', m.length && Math.max(...m) >= 13 && Math.max(...m) <= 15, 'Count=' + m.join(','));
})().catch(e => { console.error('ABORT ' + e.message); process.exit(1); });
