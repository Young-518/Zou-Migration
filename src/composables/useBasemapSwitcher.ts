/* v3.1 增补层 —— 第三阶段 PR-6:由 js/v31.js 移植退役。
 *  1) 底图切换(高德/OSM/无)+ 高德瓦片连续失败自动兜底(六-6);
 *  2) 数据导出:GeoJSON(全国路线+本支链)/ 分段里程 CSV / 图版 PNG(2.6)。
 * 一切以"不报错、有回执"为准:任何一步失败都写到对应提示行,不静默。
 * 地图实例经 window._zou 读取(app.js 注册;其退役后由注册表模块提供同形状对象)。
 * 编排:main.ts 在 runLegacy() 之后调用 initBasemapSwitcher()。 */

export function initBasemapSwitcher(): void {
  const OSM_T = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  const ATTR = '© OpenStreetMap';
  const store: Array<{ map: any; gaode: any; osm: any }> = [];
  let mode = 'gaode';

  const w = window as any;

  function maps(): any[] {
    const z = w._zou || {};
    return (['mapHeat', 'mapMacro', 'mapChain', 'mapMicro'] as const)
      .map(k => z[k])
      .filter(Boolean);
  }
  function state(map: any) {
    for (let i = 0; i < store.length; i++) if (store[i].map === map) return store[i];
    const st = { map: map, gaode: null as any, osm: null as any };
    map.eachLayer((l: any) => {
      if (w.L && l instanceof w.L.TileLayer && !st.gaode) st.gaode = l;
    });
    store.push(st);
    return st;
  }
  function osmLayer(map: any) {
    const st = state(map);
    if (!st.osm) st.osm = w.L.tileLayer(OSM_T, { maxZoom: 18, attribution: ATTR });
    return st.osm;
  }
  function note(t: string): void {
    const n = document.getElementById('basemapNote');
    if (n) n.textContent = t;
  }
  function apply(next: string): void {
    if (!w.L || !maps().length) return;
    mode = next;
    maps().forEach(map => {
      const st = state(map);
      if (next === 'gaode') {
        if (st.gaode && !map.hasLayer(st.gaode)) st.gaode.addTo(map);
        if (st.osm && map.hasLayer(st.osm)) map.removeLayer(st.osm);
      } else if (next === 'osm') {
        if (st.gaode && map.hasLayer(st.gaode)) map.removeLayer(st.gaode);
        osmLayer(map).addTo(map);
      } else {
        if (st.gaode && map.hasLayer(st.gaode)) map.removeLayer(st.gaode);
        if (st.osm && map.hasLayer(st.osm)) map.removeLayer(st.osm);
      }
    });
    const seg = document.getElementById('basemapSeg');
    if (seg) [].forEach.call(seg.querySelectorAll('.seg-btn'), (b: HTMLElement) => {
      const on = b.getAttribute('data-base') === next;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }
  /* 高德瓦片偶发 404:同一张图累计 6 次失败就切 OSM,并说明原因 */
  function watchFallback(): void {
    maps().forEach(map => {
      const st = state(map);
      if (!st.gaode || st.gaode.__zouWatch) return;
      st.gaode.__zouWatch = true;
      let fails = 0;
      st.gaode.on('tileerror', () => {
        fails++;
        if (fails >= 6 && mode === 'gaode') {
          apply('osm');
          note('高德瓦片连续请求失败,已自动切到 OSM 底图(上方可再切回)。');
        }
      });
    });
  }

  /* ---------------- 导出 ---------------- */
  function download(name: string, text: string, mime?: string): void {
    const blob = new Blob([text], { type: mime || 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 900);
  }
  function say(t: string): void {
    const m = document.getElementById('exportMsg');
    if (m) m.textContent = t;
  }
  function stamp(): string {
    const d = new Date();
    const p = (n: number) => (n < 10 ? '0' : '') + n;
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate());
  }

  function expGeo(): void {
    const M = w.MIGR;
    if (!M) { say('数据未就绪,稍后再试。'); return; }
    const feats = []
      .concat((M.nationalRoutes && M.nationalRoutes.features) || [])
      .concat((M.chain && M.chain.features) || []);
    if (!feats.length) { say('没有可导出的路线要素。'); return; }
    const fc = {
      type: 'FeatureCollection',
      name: 'zou_migration_routes',
      crs: { type: 'name', properties: { name: 'urn:ogc:def:crs:OGC:1.3:CRS84' } },
      metadata: {
        title: '邹氏迁徙路线(示意)',
        source: '《全国邹氏历史迁徙调查报告》《雙洲鄒氏族譜注》',
        note: '直线/弧线为示意表达,非实际行走路径;坐标为今地代指。',
        exported: new Date().toISOString()
      },
      features: feats
    };
    download('zou-routes-' + stamp() + '.geojson', JSON.stringify(fc, null, 1));
    say('已导出 ' + feats.length + ' 条路线要素(GeoJSON,WGS84)。');
  }

  function expCsv(): void {
    const table = document.getElementById('segTable');
    if (!table) { say('分段表未就绪。'); return; }
    const rows: string[] = [];
    table.querySelectorAll('tr').forEach(tr => {
      const cells: string[] = [];
      Array.from(tr.children).forEach(td => {
        const el = td as HTMLElement;
        cells.push('"' + (el.textContent || '').replace(/\s+/g, ' ').trim().replace(/"/g, '""') + '"');
      });
      const r = cells.join(',');
      if (r.replace(/"/g, '').trim()) rows.push(r);
    });
    if (rows.length < 2) { say('分段表为空。'); return; }
    download('zou-segments-' + stamp() + '.csv', '\ufeff' + rows.join('\r\n'), 'text/csv;charset=utf-8');
    say('已导出分段里程 ' + (rows.length - 1) + ' 行(CSV,含 BOM 以便 Excel 直接打开)。');
  }

  function expPng(): void {
    const ec = w.echarts;
    if (!ec) { say('图表库未就绪。'); return; }
    let box: HTMLElement | null = null;
    ([] as HTMLElement[]).some.call(document.querySelectorAll('.mig-chart'), (el: HTMLElement) => {
      if (el.offsetParent && ec.getInstanceByDom(el)) { box = el; return true; }
      return false;
    });
    if (!box) { say('没有可见的图版可导出(可先滚到 02 迁徙图谱)。'); return; }
    const inst = ec.getInstanceByDom(box);
    const url = inst.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#0d1b2a' });
    const a = document.createElement('a');
    a.href = url;
    a.download = 'zou-chart-' + (box as HTMLElement).id + '-' + stamp() + '.png';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { a.remove(); }, 600);
    say('已导出当前可见图版 ' + (box as HTMLElement).id + '(PNG,2 倍像素)。');
  }

  function init(): void {
    const seg = document.getElementById('basemapSeg');
    if (seg) {
      seg.addEventListener('click', (e: Event) => {
        const t = e.target as HTMLElement;
        const b = t.closest && t.closest('.seg-btn');
        if (!b) return;
        apply(b.getAttribute('data-base') || 'gaode');
        if (b.getAttribute('data-base') === 'gaode') note('高德瓦片偶发 404 时会自动切到 OSM;天地图需自备 key,未接入。');
        if (b.getAttribute('data-base') === 'osm') note('已切到 OSM:境外服务,国内访问可能较慢,作兜底用。');
        if (b.getAttribute('data-base') === 'none') note('已关闭底图,只留矢量路线与节点。');
      });
      watchFallback();
    }
    const g = document.getElementById('btnExpGeo');
    const c = document.getElementById('btnExpCsv');
    const p = document.getElementById('btnExpPng');
    if (g) g.addEventListener('click', expGeo);
    if (c) c.addEventListener('click', expCsv);
    if (p) p.addEventListener('click', expPng);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  window.addEventListener('load', () => { watchFallback(); }, { once: true });
}
