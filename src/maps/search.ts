/* 地点/先祖搜索组件 —— 第四阶段:由 legacy-ports/app.ts「地点/先祖搜索」分解。
 * 职责:四类索引(宏观节点/迁徙链/双洲点位/先祖)+ 八景诗、模糊匹配排序、
 *       键盘操作(v2.7.1)、结果点击定位与诗卷直开。
 * 顺序锚点:在面板组件之后调用(与统计图表注册顺序互换无可观测差异,见编排器注释)。 */
import { R, esc } from './runtime';
import type { LLayer, LMap, PoemScene } from './types';

interface SearchEntry {
  title: string;
  sub: string;
  kind: string;
  marker?: LLayer;
  map?: LMap;
  zoom?: number;
  sceneId?: string;
  latlng?: [number, number];
}

export function initSearch(): void {
  const mapMacro = R.maps.macro as LMap;
  const mapChain = R.maps.chain as LMap;
  const mapMicro = R.maps.micro as LMap;
  const box = document.getElementById('searchBox') as HTMLInputElement;
  const res = document.getElementById('searchResults')!;
  const index: SearchEntry[] = [];

  function addEntry(marker: LLayer, map: LMap, kind: string, zoom?: number): void {
    const p = (marker._props || marker._person || {}) as Record<string, unknown>;
    index.push({ title: (p.name as string) || '',
      sub: ((p.oldName || p.place) as string) || '',
      kind: kind, marker: marker, map: map, zoom: zoom || 12 });
  }
  Object.keys(R.macroKeys).forEach((k) => { addEntry(R.macroKeys[k], mapMacro, '① 宏观节点', 6); });
  Object.keys(R.chainKeys2).forEach((k) => { addEntry(R.chainKeys2[k], mapChain, '② 迁徙链', 9); });
  Object.keys(R.microKeys).forEach((k) => { addEntry(R.microKeys[k], mapMicro, '③ 双洲点位', 14); });
  Object.keys(R.personByKey).forEach((k) => { addEntry(R.personByKey[k], mapMicro, '③ 先祖', 13); });
  /* v2.7：八景诗也进索引——陌生人通常是先在 05 看到景名，再回头搜它 */
  const scenes: PoemScene[] = (window.ZOU_POEMS && window.ZOU_POEMS.scenes) || [];
  scenes.forEach((sc) => {
    if (!sc.coords || sc.coords.length !== 2) return;
    index.push({ title: sc.displayName || (sc.name as string), sub: sc.alias || '',
      kind: '八景诗', sceneId: sc.id, latlng: [sc.coords[1], sc.coords[0]], zoom: 16 });
  });

  let activeIdx = -1;
  function items(): HTMLElement[] {
    return Array.prototype.slice.call(res.querySelectorAll('.sr-item[data-i]')) as HTMLElement[];
  }
  function setActive(n: number): void {
    const its = items();
    if (!its.length) return;
    activeIdx = (n + its.length) % its.length;
    its.forEach((el, i) => { el.classList.toggle('on', i === activeIdx); });
    its[activeIdx].scrollIntoView({ block: 'nearest' });
  }

  function render(q: string): void {
    q = q.trim();
    activeIdx = -1;
    if (!q) { (res as HTMLElement).hidden = true; res.innerHTML = ''; return; }
    const hits = index.filter((e) => {
      let hay = e.title + ' ' + e.sub;
      if (e.marker) {
        hay += ' ' + (e.marker._props ? e.marker._props.note || '' : '')
             + ' ' + (e.marker._person ? e.marker._person.note || '' : '');
      } else if (e.sceneId) {
        hay += ' 双洲八景 诗 ' + e.sceneId;   /* 搜「八景」「诗」也能命中 */
      }
      return hay.indexOf(q) >= 0;
    }).sort((a, b) => {
      const sa = a.title.indexOf(q) >= 0 ? 0 : (a.sub && a.sub.indexOf(q) >= 0 ? 1 : 2);
      const sb = b.title.indexOf(q) >= 0 ? 0 : (b.sub && b.sub.indexOf(q) >= 0 ? 1 : 2);
      return sa - sb;
    }).slice(0, 8);
    if (!hits.length) {
      res.innerHTML = '<div class="sr-item sr-empty">无匹配结果 —— 可试「宜黄」「有宗公」「三江远渡」</div>';
      (res as HTMLElement).hidden = false; return;
    }
    res.innerHTML = hits.map((e, i) => {
      return '<div class="sr-item" data-i="' + index.indexOf(e) + '"><b>' + esc(e.title) + '</b>'
        + '<span class="sr-kind">' + esc(e.kind) + '</span>'
        + (e.sub ? '<span class="sr-sub">' + esc(e.sub) + '</span>' : '') + '</div>';
    }).join('');
    (res as HTMLElement).hidden = false;
    Array.prototype.forEach.call(res.querySelectorAll('.sr-item'), (el: HTMLElement) => {
      el.onclick = () => {
        const e = index[+el.getAttribute('data-i')!];
        (res as HTMLElement).hidden = true; box.value = e.title;
        if (e.sceneId) {
          /* 八景：先把 ③ 号图视野对到该点，再直接开诗卷（抽屉会锁滚动） */
          mapMicro.setView(e.latlng!, e.zoom);
          if (window.__POEM_UI) window.__POEM_UI.open(e.sceneId, 'qing');
          return;
        }
        document.querySelector('.map-grid .map-card, .map-row')!.scrollIntoView({ block: 'start' });
        if (e.map === mapMacro) document.querySelector('.card-macro')!.scrollIntoView({ behavior: 'smooth', block: 'start' });
        if (e.map === mapChain) document.querySelector('.card-chain')!.scrollIntoView({ behavior: 'smooth', block: 'start' });
        if (e.map === mapMicro) document.querySelector('.card-micro')!.scrollIntoView({ behavior: 'smooth', block: 'start' });
        e.map!.flyTo(e.marker!.getLatLng(), e.zoom, { duration: .8 });
        setTimeout(() => { e.marker!.openPopup(); }, 900);
      };
    });
  }
  box.addEventListener('input', () => { render(box.value); });
  box.addEventListener('focus', () => { if (box.value) render(box.value); });
  /* v2.7.1：补键盘操作——原来只绑 input/focus，输完按 Enter 毫无反应 */
  box.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(activeIdx + 1); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive(activeIdx - 1); return; }
    if (e.key === 'Escape') { (res as HTMLElement).hidden = true; return; }
    if (e.key === 'Enter') {
      const its = items();
      if (!its.length) return;
      e.preventDefault();
      (its[activeIdx] || its[0]).click();
    }
  });
  document.addEventListener('click', (ev: MouseEvent) => {
    const t = ev.target as Element;
    if (!t.closest || !t.closest('.search-wrap')) (res as HTMLElement).hidden = true;
  });
}
