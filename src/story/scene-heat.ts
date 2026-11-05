/* 场景 01:姓源三步卡 —— 滚动切换热区时期(200vh)
 * 第四阶段:由 useScrollStory.ts 同名 IIFE 分解(原 619-651 行)。
 * 三卡同屏高亮(每卡不再独占 60vh);切换仍走 #heatRange 的 input 事件,
 * 复用序章热区图组件的既有 applyHeat()。 */
import { zouScrollAdd } from './zou-scroll';

export function initSceneHeat(): void {
  const scene = document.getElementById('sceneHeat');
  if (!scene) return;
  const steps = Array.prototype.slice.call(scene.querySelectorAll('.heat-step')) as HTMLElement[];
  const range = document.getElementById('heatRange') as HTMLInputElement;
  if (!range || !steps.length) return;
  let last = -1;
  function setPeriod(per: number): void {
    if (per === last) return;
    last = per;
    if (+range.value !== per) {
      range.value = String(per);
      range.dispatchEvent(new Event('input', { bubbles: true }));
    }
    steps.forEach((s) => {
      s.classList.toggle('on', +(s.getAttribute('data-period') || 0) === per);
    });
  }
  steps.forEach((s) => {
    s.addEventListener('click', () => { setPeriod(+(s.getAttribute('data-period') || 0)); });
  });
  zouScrollAdd(scene, (p) => {
    if (document.body.classList.contains('is-reading')) return;
    if (!window.__zouMoved || !window.__zouMoved()) return;
    setPeriod(p < 0.34 ? 1 : (p < 0.67 ? 4 : 8));
  });
  /* 初始化只同步高亮，不改写深链带来的 heatRange */
  (function initHeat(): void {
    const cur = +range.value || 1;
    last = cur;
    steps.forEach((s) => { s.classList.toggle('on', +(s.getAttribute('data-period') || 0) === cur); });
  })();
}
