/* 精装立轴卷轴驱动(多卷) —— 第三阶段 PR-4:由 js/scroll-reel.js 移植退役。
 * 每个 .reel-zone 独立计算滚动进度 p,写入其 .reel-stage 的 --p;
 * --reelp(在 stage 作用域)驱动画纸 clip 展开、地杆下行、绸带解开(p>0.15)。
 * 纪律:只写 CSS 变量与类名;reduced-motion 与打印由 CSS 整段跳过。
 * 编排:main.ts 在 runLegacy() 之后调用 initScrollReel()。 */

export function initScrollReel(): void {
  const zones = document.querySelectorAll<HTMLElement>('.reel-zone');
  if (!zones.length) return;
  const cue = document.getElementById('reelCue');
  if (cue) cue.addEventListener('click', () => {
    window.scrollBy({ top: window.innerHeight * 0.8, behavior: 'smooth' });
  });
  let ticking = false;
  const tick = (): void => {
    ticking = false;
    const vh = window.innerHeight;
    zones.forEach(zone => {
      const stage = zone.querySelector<HTMLElement>('.reel-stage');
      if (!stage) return;
      const r = zone.getBoundingClientRect();
      const total = r.height - vh;
      const p = total > 0 ? Math.min(1, Math.max(0, -r.top / total)) : 1;
      stage.style.setProperty('--p', p.toFixed(4));
      if (p > 0.15) stage.classList.add('unfurled');
      else stage.classList.remove('unfurled');
    });
    if (cue) {
      const zr = zones[0].getBoundingClientRect();
      const p0 = zr.height - vh > 0 ? Math.min(1, Math.max(0, -zr.top / (zr.height - vh))) : 1;
      const show = p0 < 0.03 && zr.top <= 0 && zr.bottom >= 0;
      cue.style.opacity = show ? '1' : '0';
      cue.style.pointerEvents = show ? 'auto' : 'none';
    }
  };
  window.addEventListener('scroll', () => {
    if (!ticking) { ticking = true; requestAnimationFrame(tick); }
  }, { passive: true });
  window.addEventListener('resize', tick);
  tick();
}
