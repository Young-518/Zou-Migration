/* 微观图组件(③号窗:双洲 · 邹游村) —— 第四阶段:由 legacy-ports/app.ts「微观视图」分解。
 * 职责:mapMicro 创建(高德街道底图)、初始视野(村落建筑群+八景诗点)、
 *       村路/点位、先祖名签(世系树所有可定位先祖)、chkPersons/chkPoemPts 开关、
 *       八景诗点(点击开诗卷)、revealMicroMap 回视口握手、fitPoemPts、
 *       window.__ZOU_POEMS_MAP 桥、btnPoemFit、微观里程量算。
 * 顺序锚点:在时间轴组件之后、世系树/外壳组件之前调用(原文本序)。 */
import { useLeafletMap } from '../composables/useLeafletMap';
import { GAODE_URL, R, addPlaces, addRoutes, esc, migr, showToast } from './runtime';
import type { LLayer } from './types';

function personPopHTML(d: Record<string, unknown>): string {
  const M = migr();
  const st = M.stages[((d.stage as number) || 6) - 1] || {};
  let html = '<div class="pop">'
    + '<span class="badge" style="background:' + st.color + '">' + esc(st.name) + '</span>'
    + '<div class="pt">' + esc(d.name) + '（第' + d.gen + '世）</div>';
  if (d.year) html += '<div class="pk"><b>纪年</b>：' + esc(d.year) + '</div>';
  if (d.place) html += '<div class="pk"><b>迁居地</b>：' + esc(d.place) + '</div>';
  if (d.alias) html += '<div class="pk"><b>字号</b>：' + esc(d.alias) + '</div>';
  if (d.note) html += '<div class="pn">' + esc(d.note) + '</div>';
  return html + '</div>';
}

/* v2.7：把 ③ 号图带回视口并短暂描边——凡是"让地图动作"的入口都要调它，
   否则用户站在下方面板，只看见地图在屏幕外变化，等同没反应 */
export function revealMicroMap(after?: () => void): void {
  const card = document.querySelector('.card-micro');
  const row = document.getElementById('secMicro');
  if (row) row.scrollIntoView({ behavior: 'smooth', block: 'center' });
  if (card) {
    card.classList.add('is-locate');
    setTimeout(() => { card.classList.remove('is-locate'); }, 2000);
  }
  /* 滚动会触发下潜场景按步骤重新取景，先等它落定再做 fit/flyTo，
     否则刚设好的视野会被覆盖（诗点又挤成一团） */
  if (after) {
    /* 平滑滚动 + 下潜步骤取景合计约 1 秒，1200ms 后再设视野才不被覆盖；
       再补一次 400ms 后的校正，防止最后一段惯性滚动又改回步骤取景 */
    setTimeout(after, 1200);
    setTimeout(after, 1650);
  }
}

export function initMicroMap(): void {
  const M = migr();
  const mapMicro = useLeafletMap('mapMicro', { zoomControl: true, scrollWheelZoom: false });
  R.maps.micro = mapMicro;
  /* ③号窗仅保留高德街道底图（地级市区划底图已按需取消） */
  L.tileLayer(GAODE_URL,
    { maxZoom: 18, subdomains: '1234', attribution: '© 高德地图' }).addTo(mapMicro);

  /* 初始视野：双洲/邹游村建筑群 + 八景诗点（概略坐标），保证 ①—⑧ 一屏可见 */
  (function () {
    const core = ['邹游村', '游家洲', '双洲村'];
    const pts: [number, number][] = M.villagePlaces.features.filter((f) => {
      return core.indexOf(f.properties.name as string) >= 0;
    }).map((f): [number, number] => {
      const c = f.geometry.coordinates; return [c[1], c[0]];
    });
    const PS = window.ZOU_POEMS;
    if (PS && PS.scenes) {
      PS.scenes.forEach((s) => {
        if (s.coords && s.coords.length === 2) pts.push([s.coords[1], s.coords[0]]);
      });
    }
    mapMicro.fitBounds(L.latLngBounds(pts).pad(0.12), { maxZoom: 15 });
  })();

  const microLayers = L.layerGroup().addTo(mapMicro);

  addRoutes(mapMicro, M.villageRoutes, microLayers);
  R.microKeys = addPlaces(mapMicro, M.villagePlaces, microLayers, { radius: 9 });

  /* ---------------- 先祖名签：世系树中所有可定位先祖标注于③号地图 ---------------- */
  const personLayers = L.layerGroup().addTo(mapMicro);
  const personByKey: Record<string, LLayer> = {};
  (function () {
    const persons: Record<string, unknown>[] = [];
    (function walk(n: Record<string, unknown>): void {
      const ll = n.latlng as [number, number] | undefined;
      if (ll && ll.length === 2) persons.push(n);
      ((n.children as Record<string, unknown>[]) || []).forEach(walk);
    })(M.lineage as unknown as Record<string, unknown>);
    persons.forEach((d) => {
      const color = M.stageColor[d.stage as number] || '#8a5a2b';
      const ll = d.latlng as [number, number];
      const m = L.marker(ll, {
        icon: L.divIcon({ className: '', iconSize: [0, 0], iconAnchor: [0, 0],
          html: '<div style="position:absolute;transform:translate(-50%,-150%)">'
            + '<div class="person-pill" style="border-color:' + color + ';color:' + color + '">'
            + d.gen + '世·' + esc(d.name) + '</div></div>'
            + '<div style="position:absolute;transform:translate(-50%,-50%);width:9px;height:9px;'
            + 'border-radius:50%;background:' + color + ';border:2px solid #fff;'
            + 'box-shadow:0 1px 3px rgba(0,0,0,.35)"></div>' })
      }).bindPopup(personPopHTML(d));
      m._person = d;
      m._key = ll[0] + ',' + ll[1];
      personLayers.addLayer(m);
      personByKey[m._key] = m;
    });
  })();
  R.personByKey = personByKey;

  const chkPersons = document.getElementById('chkPersons') as HTMLInputElement;
  chkPersons.onchange = () => {
    if (chkPersons.checked) { personLayers.addTo(mapMicro); }
    else { mapMicro.removeLayer(personLayers); }
  };

  /* ---------------- 八景诗点（诗路地图）：①—⑧ 与 05 八景卡同序 ----------------
     坐标为族人所给概略范围，仅作示意标注；点击诗点直接展开该景诗卷。
     序号取自 #poemGrid 中 chips 的先后，数据侧不再另存一份顺序。 */
  const poemPts = L.layerGroup().addTo(mapMicro);
  const poemPtsLL: [number, number][] = [];
  (function () {
    const P = window.ZOU_POEMS;
    if (!P || !P.scenes || !P.scenes.length) return;
    const grid = document.getElementById('poemGrid');
    let seq: string[] = [];
    Array.prototype.forEach.call(grid ? grid.querySelectorAll('.poem-chip') : [], (b: Element) => {
      seq.push(b.getAttribute('data-scene') || '');
    });
    if (!seq.length) seq = P.scenes.map((s) => s.id);
    const byId: Record<string, typeof P.scenes[number]> = {};
    P.scenes.forEach((s) => { byId[s.id] = s; });
    seq.forEach((id, i) => {
      const s = byId[id];
      if (!s || !s.coords || s.coords.length !== 2) return;
      const ll: [number, number] = [s.coords[1], s.coords[0]];
      poemPtsLL.push(ll);
      L.marker(ll, {
        zIndexOffset: 800,
        title: s.displayName + '（第 ' + (i + 1) + ' 景）',
        alt: s.displayName,
        icon: L.divIcon({
          className: 'poem-pin-ico', iconSize: [23, 23], iconAnchor: [11.5, 11.5],
          html: '<span class="poem-pin">' + (i + 1) + '</span>'
        })
      })
        .on('click', () => {
          if (window.__POEM_UI) window.__POEM_UI.open(s.id, 'qing');
        })
        .bindTooltip('（' + (i + 1) + '）' + esc(s.displayName) + ' · 概略位置 · 点击读诗',
          { direction: 'top', offset: [0, -8] })
        .addTo(poemPts);
    });
  })();

  const chkPoemPts = document.getElementById('chkPoemPts') as HTMLInputElement;
  chkPoemPts.onchange = () => {
    if (chkPoemPts.checked) poemPts.addTo(mapMicro);
    else mapMicro.removeLayer(poemPts);
  };

  function fitPoemPts(): boolean {
    if (!poemPtsLL.length) return false;
    mapMicro.fitBounds(L.latLngBounds(poemPtsLL).pad(0.25), { maxZoom: 16 });
    return true;
  }
  window.__ZOU_POEMS_MAP = { fit: fitPoemPts, points: poemPtsLL };

  (function () {
    const btn = document.getElementById('btnPoemFit');
    const msg = document.getElementById('poemMapMsg');
    if (!btn) return;
    btn.addEventListener('click', () => {
      if (!poemPtsLL.length) { if (msg) msg.textContent = '诗点数据未加载'; return; }
      /* v2.7.1：诗点层被关掉时不能"定位到看不见的点"——自动打开并说明 */
      const chk = document.getElementById('chkPoemPts') as HTMLInputElement;
      let turnedOn = false;
      if (chk && !chk.checked) {
        chk.checked = true;
        if (chk.onchange) (chk.onchange as () => void)();
        turnedOn = true;
      }
      revealMicroMap(() => { fitPoemPts(); });
      /* 八个诗点闪烁 2.4s，指出"就是这几个点" */
      const wrap = document.getElementById('mapMicro');
      if (wrap) {
        wrap.classList.add('poem-flash');
        setTimeout(() => { wrap.classList.remove('poem-flash'); }, 2400);
      }
      if (msg) msg.textContent = (turnedOn ? '诗点层原为关闭，已自动打开；' : '')
        + '已定位 ' + poemPtsLL.length + ' 个诗点（概略位置），上行 ③ 号图已描边闪烁';
      showToast(turnedOn ? '诗点层原为关闭，已自动打开并定位八景'
        : '已定位八景诗点，③ 号图在上方');
    });
  })();

  /* 微观里程 */
  (function () {
    const f = M.villageRoutes.features;
    let land = 0, water = 0;
    f.forEach((r) => {
      const c = r.geometry.coordinates;
      let d = 0;
      for (let i = 1; i < c.length; i++) d += M.dist(c[i - 1], c[i]);
      if (r.properties.from === '湖边（新淦）') land = d; else water = d;
    });
    document.getElementById('villageMetric')!.innerHTML =
      '量算：湖边 → 双洲直线约 <b>' + land.toFixed(0) + ' km</b>；'
      + '双洲 → 临江府城直线约 <b>' + water.toFixed(1) + ' km</b>'
      + '（谱载「二十四里许」按清代里制约合 12.7—14.4 km，为顺袁水河道距离；'
      + '双洲村、临江府城等坐标均为族人实测，直线量算供参考）';
  })();
}
