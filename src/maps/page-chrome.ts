/* 页面部件组件 —— 第四阶段:由 legacy-ports/app.ts「字辈诗↔世代对照条」与
 *「地图全屏(三窗+序章图)」两小节分解。
 * 顺序锚点:在 Hero 首屏之后、URL 状态组件之前调用(原文本序)。 */
import { R, migr } from './runtime';
import type { LMap } from './types';

/* ============================================================
 * 字辈诗 ↔ 世代对照条（十八世 → 三十九世）
 * 依据《雙洲鄒氏族譜注》字辈诗 22 字，首字"宗"即十八世有宗公
 * ============================================================ */
function initZibeiBar(): void {
  const M = migr();
  const bar = document.getElementById('zibeiBar');
  if (!bar) return;
  const CHARS = '宗仁仝才应益名汝禧镇德绍瑞尚占茂亮生嘉永和焕'.split('');
  const START = 18;
  const ANCHOR: Record<number, string> = {
    18: '有宗公 1507 年开基双洲，字辈诗首字',
    22: '应明、应朋、应元三大支分派于此世',
    26: '禧字辈 16 支（禧时 344 人、禧明 178 人、禧选 103 人）',
    39: '谱注载传至三十九世，共 5 人'
  };
  const byGen: Record<number, Array<Record<string, unknown>>> = {};
  (function walk(n: Record<string, unknown>): void {
    if (n.gen) (byGen[n.gen as number] = byGen[n.gen as number] || []).push(n);
    ((n.children as Array<Record<string, unknown>>) || []).forEach(walk);
  })(M.lineage as unknown as Record<string, unknown>);
  const info = document.getElementById('zibeiInfo');
  const DEFAULT_INFO = info ? info.innerHTML : '';

  function clearHL(): void {
    Array.prototype.forEach.call(bar!.children, (c: HTMLElement) => { c.classList.remove('on'); });
    if (window.d3) d3.selectAll('#treeBox .tnode').classed('hl', false);
  }

  CHARS.forEach((ch, i) => {
    const g = START + i;
    const names = (byGen[g] || []).filter((d) => !d.placeholder)
      .map((d) => d.name as string);
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'zb-cell' + (ANCHOR[g] ? ' anchor' : '');
    b.title = '第' + g + '世 · 字辈“' + ch + '”'
      + (names.length ? '（' + names.join('、') + '）' : '')
      + (ANCHOR[g] ? ' — ' + ANCHOR[g] : '');
    b.setAttribute('aria-label', '第 ' + g + ' 世，字辈 ' + ch
      + (ANCHOR[g] ? '，' + ANCHOR[g] : ''));
    b.innerHTML = '<span class="zb-char">' + ch + '</span><span class="zb-gen">' + g + '</span>';
    b.onclick = () => {
      const on = b.classList.contains('on');
      clearHL();
      if (on) { if (info) info.innerHTML = DEFAULT_INFO; return; }
      b.classList.add('on');
      if (window.d3) {
        d3.selectAll('#treeBox .tnode').classed('hl', (d: any) => d.data.gen === g);
      }
      if (info) {
        info.innerHTML = '第 <b>' + g + '</b> 世 · 字辈“<b>' + ch + '</b>”：'
          + (names.length ? '世系树收录 ' + names.join('、') : '世系树暂未收录该世代人物')
          + (ANCHOR[g] ? '<br><span class="zb-anchor">' + ANCHOR[g] + '</span>' : '');
      }
    };
    bar.appendChild(b);
  });
}

/* ============================================================
 * 地图全屏（三窗 + 序章图）
 * ============================================================ */
function initFullscreen(): void {
  function toggleFS(map: LMap): void {
    const el = map.getContainer();
    const card = el.closest('.map-card') || el;
    if (document.fullscreenElement) { document.exitFullscreen(); return; }
    const req = card.requestFullscreen || (card as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> }).webkitRequestFullscreen;
    if (!req) return;
    const p = req.call(card);
    if (p && p.then) p.then(() => { setTimeout(() => { map.invalidateSize(); }, 120); }, () => { /* 拒绝全屏:静默 */ });
  }
  function addFS(map: LMap, label: string): void {
    const Ctrl = L.Control.extend({
      options: { position: 'topleft' },
      onAdd: () => {
        const div = L.DomUtil.create('div', 'fs-ctrl leaflet-control');
        const b = L.DomUtil.create('button', 'fs-btn', div);
        b.type = 'button';
        b.textContent = '全屏';
        b.title = '全屏显示「' + label + '」';
        b.setAttribute('aria-label', '全屏显示' + label);
        L.DomEvent.disableClickPropagation(div);
        L.DomEvent.on(b, 'click', () => { toggleFS(map); });
        return div;
      }
    });
    map.addControl(new Ctrl());
  }
  addFS(R.maps.heat, '序章分布热区');
  addFS(R.maps.macro, '一号 全国宏观');
  addFS(R.maps.chain, '二号 本支迁徙链');
  addFS(R.maps.micro, '三号 双洲微观');
  document.addEventListener('fullscreenchange', () => {
    [R.maps.heat, R.maps.macro, R.maps.chain, R.maps.micro].forEach((m) => {
      setTimeout(() => { (m as LMap).invalidateSize(); }, 150);
    });
    const on = !!document.fullscreenElement;
    Array.prototype.forEach.call(document.querySelectorAll('.fs-btn'), (b: HTMLElement) => {
      b.textContent = on ? '退出' : '全屏';
    });
  });
}

export function initPageChrome(): void {
  initZibeiBar();
  initFullscreen();
}
