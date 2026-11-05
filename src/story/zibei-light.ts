/* 06 字辈点灯 —— 第四阶段:由 useScrollStory.ts 同名 IIFE 分解(原 656-667 行)。
 * 进入视口后逐格点亮(一次);--zb-delay 逐格延迟。 */
export function initZibeiLight(): void {
  const bar = document.getElementById('zibeiBar');
  if (!bar) return;
  const cells = Array.prototype.slice.call(bar.querySelectorAll('.zb-cell')) as HTMLElement[];
  cells.forEach((c, i) => { c.style.setProperty('--zb-delay', (i * 0.06).toFixed(2) + 's'); });
  function light(): void { bar!.classList.add('lit'); }
  if (!('IntersectionObserver' in window)) { light(); return; }
  const io = new IntersectionObserver((es) => {
    es.forEach((en) => { if (en.isIntersecting) { light(); io.disconnect(); } });
  }, { threshold: .25 });
  io.observe(bar);
}
