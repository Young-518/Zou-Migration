/* 场景 05:双洲下潜 —— 纵向阶梯逐级放大 + 深度尺 + 光圈收束
 * 第四阶段:由 useScrollStory.ts 同名 IIFE 分解(原 693-758 行)。
 * 与 04(横向滑轨 + 盖章)刻意不同:不横移,只"越看越近"。 */
import { zouScrollAdd } from './zou-scroll';

export function initSceneDive(): void {
  const scene = document.getElementById('sceneMicro');
  if (!scene) return;
  const map = window._zou && window._zou.mapMicro;
  const steps = Array.prototype.slice.call(scene.querySelectorAll('.dive-step')) as HTMLElement[];
  const lens = document.getElementById('diveLens');
  const thumb = document.getElementById('diveThumb');
  const scaleEl = document.getElementById('diveScale');
  if (!steps.length) return;

  const STOPS: Array<{ c: [number, number]; z: number; s: string; n: string }> = [
    { c: [115.450, 27.865], z: 11.6, s: '1 : 250 000', n: '袁河 · 清江' },
    { c: [115.4055, 27.9253], z: 14.2, s: '1 : 50 000', n: '双洲村' },
    { c: [115.4025, 27.9134], z: 15.4, s: '1 : 20 000', n: '邹游村' },
    { c: [115.3985, 27.9115], z: 16.4, s: '1 : 8 000', n: '游家洲 · 丁家古渡' },
    { c: [115.4049, 28.0056], z: 14.6, s: '1 : 30 000', n: '临江府城' }
  ];
  let last = -1, curP = 0;

  /* v2.7.1：拆成"只画 UI"与"画 UI + 飞地图"两步——
     首屏/深链未发生手势时只允许前者，别把 app.js 设好的 ③ 号图视野顶掉 */
  function paintUI(i: number): void {
    const st = STOPS[i];
    steps.forEach((el, k) => { el.classList.toggle('on', k === i); });
    if (scaleEl) scaleEl.textContent = st.s;
    if (window.__zouHUD) window.__zouHUD(4, '1507', st.n);
  }

  function go(i: number, noFly?: boolean): void {
    paintUI(i);
    if (noFly) return;
    if (i === last) return;
    last = i;
    /* STOPS 用 [lng, lat]；Leaflet 需要 [lat, lng] */
    if (map) (map as { flyTo(ll: [number, number], z: number, o?: unknown): void })
      .flyTo([STOPS[i].c[1], STOPS[i].c[0]], STOPS[i].z, { duration: .95 });
  }

  zouScrollAdd(scene, (p) => {
    if (document.body.classList.contains('is-reading')) return;
    /* 未发生用户手势（含深链直接落在 05）不改图——原来这里是空 if，等于没拦住 */
    if (!window.__zouMoved || !window.__zouMoved()) return;
    curP = p;
    const i = Math.min(STOPS.length - 1, Math.max(0, Math.round(p * (STOPS.length - 1))));
    go(i);
    if (lens) lens.style.setProperty('--lens', (72 - 46 * p).toFixed(1) + '%');
    if (thumb) thumb.style.transform = 'translateY(' + (p * 100).toFixed(1) + '%)';
  });
  /* 初始化不 go(0)：第 0 站的飞行动作交给滚动叙事，初始视野由 app.js 决定 */

  /* 进场景补一次尺寸（与 04 同法） */
  if ('IntersectionObserver' in window) {
    let fixed = false;
    new IntersectionObserver((es) => {
      es.forEach((en) => {
        if (!en.isIntersecting || fixed) return;
        fixed = true;
        setTimeout(() => {
          if (map) (map as { invalidateSize(): void }).invalidateSize();
          if (!window.__zouMoved || !window.__zouMoved()) return;  /* 无手势：保留 app.js 的初始视野 */
          last = -1;   /* 有手势进场：重放当前站点，纠正被 fitBounds 覆盖的视野 */
          go(Math.round(curP * (STOPS.length - 1)));
        }, 80);
      });
    }, { threshold: .1 }).observe(scene);
  }
  window.addEventListener('load', () => {
    setTimeout(() => { if (map) (map as { invalidateSize(): void }).invalidateSize(); }, 120);
  });
}
