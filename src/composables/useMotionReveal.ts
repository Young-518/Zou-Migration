/* 进场动效层 —— 第三阶段 PR-3:由 js/motion.js 移植退役。
 * 规则:只动 transform/opacity;分级错峰;reduced-motion 与阅读模式直接跳过;
 *       2.5s 后强制兜底显示,绝不让内容因为脚本没跑到而消失。
 * 编排:main.ts 在 runLegacy() 之后调用 initMotionReveal()(与原模块序等价)。 */

export function initMotionReveal(): void {
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
  if (reduce && reduce.matches) return;

  /* 首屏开镜("Shutter image"):从右缘揭开一次,图片由 1.12 落回 1。
     先挂 .js-shutter 才有初始裁切,脚本没跑到时图片照常显示。 */
  (function shutter() {
    const fig = document.querySelector('.hb-photo');
    if (!fig) return;
    fig.classList.add('js-shutter');
    setTimeout(() => fig.classList.add('is-shutter'), 140);
  })();

  const SEL = '.sec-head, .intro-band, .stat-band, .mig-card, .text-card, .poem-grid, .panel';
  const nodes = [].filter.call(document.querySelectorAll(SEL), (el: Element) => {
    return !el.closest('.scene');   /* 钉住场景里的面板不参与,避免与滚动叙事抢 transform */
  });
  if (!nodes.length) return;

  nodes.forEach((el: HTMLElement, i: number) => {
    el.setAttribute('data-rise', '');
    el.style.transitionDelay = ((i % 4) * 70) + 'ms';
  });

  const reveal = (el: Element): void => el.classList.add('in');

  if (!('IntersectionObserver' in window)) {
    nodes.forEach(reveal);
    return;
  }
  const io = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (!en.isIntersecting) return;
      reveal(en.target);
      io.unobserve(en.target);
    });
  }, { rootMargin: '-8% 0px -12% 0px', threshold: 0.08 });
  nodes.forEach(el => io.observe(el));

  /* 折叠区(details)里的面板在关闭时没有盒子,IO 不会触发,
     打开后若不在视口内就会一直 opacity:0 —— 展开即视为进场 */
  document.addEventListener('toggle', (e: Event) => {
    const d = e.target as HTMLElement;
    if (!d || d.tagName !== 'DETAILS' || !(d as HTMLDetailsElement).open) return;
    [].forEach.call(d.querySelectorAll('[data-rise]'), (el: Element) => el.classList.add('in'));
  }, true);

  /* 兜底:3 秒后仍在视口内却没触发的,一律显示 */
  setTimeout(() => {
    nodes.forEach((el: HTMLElement) => {
      if (el.classList.contains('in')) return;
      const r = el.getBoundingClientRect();
      if (r.top < window.innerHeight && r.bottom > 0) reveal(el);
    });
  }, 2500);

  /* 进入阅读模式(长页)时全部显示 */
  document.addEventListener('click', (e: Event) => {
    const t = e.target as HTMLElement;
    if (t.closest && t.closest('#motionToggle,.motion-toggle')) {
      setTimeout(() => nodes.forEach(reveal), 50);
    }
  }, true);
}
