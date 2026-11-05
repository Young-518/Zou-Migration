/* ============================================================
 * 迁路长卷 —— 改造探索·第二幕
 * ============================================================
 * ScrollTrigger(pin+scrub) 驱动七站六段长卷:
 *   - .jr-route 朱砂路线随滚动逐段描画(strokeDashoffset);
 *   - 七站 dot/站名依进度点亮,档案卡交叉淡入;
 *   - 站点数据与 sections/05-journey.html 卡片一一对应,文案
 *     转录自 src/static-migr.ts chainPlaces/chain(族谱注,零编造);
 *   - reduced-motion:加 .jr-static,长卷完整静置,卡片纵向流式。
 * GSAP 用法依 greensock/gsap-skills:transform/autoAlias、timeline
 * 位置参数、scrub 捕捉、布局后 refresh。
 * ============================================================ */
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/* 七站在路线(6 段贝塞尔)上的进度位:起点 0,终点 1 */
const STATION_T = [0, 1 / 6, 2 / 6, 3 / 6, 4 / 6, 5 / 6, 1];

export function initJourneyScroll(): void {
  const sec = document.getElementById('journey');
  if (!sec) return;
  const route = sec.querySelector<SVGPathElement>('.jr-route');
  const stations = Array.from(sec.querySelectorAll<SVGGElement>('.jr-station'));
  const cards = Array.from(sec.querySelectorAll<HTMLElement>('.jr-card'));
  const hint = sec.querySelector<HTMLElement>('.jr-hint');

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (reduce.matches || !route) {
    sec.classList.add('jr-static');
    return;
  }

  /* 路线初始隐藏(描画由 scrub 驱动) */
  const len = route.getTotalLength();
  route.style.strokeDasharray = String(len);
  route.style.strokeDashoffset = String(len);
  gsap.set(stations, { opacity: 0, scale: 0.4, transformOrigin: 'center' });
  gsap.set(cards, { autoAlpha: 0, y: 26 });
  if (hint) gsap.set(hint, { autoAlpha: 0.55 });

  /* 总时长 8 单位 ≈ 6 段路线 + 首尾呼吸;scrub 直接映射滚动进度 */
  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: sec.querySelector('.jr-stage'),
      start: 'top top',
      end: '+=3400',
      scrub: 0.7,
      pin: true,
      anticipatePin: 1,
    },
  });

  tl.to(route, { strokeDashoffset: 0, duration: 8 }, 0);
  if (hint) tl.to(hint, { autoAlpha: 0, duration: 0.5 }, 0.2);

  stations.forEach((st, i) => {
    /* 站点在其路线进度位点亮(首站开场即亮) */
    const at = 0.25 + STATION_T[i] * 7.4;
    tl.to(st, { opacity: 1, scale: 1, duration: 0.45 }, at);
  });

  cards.forEach((card, i) => {
    const at = STATION_T[i] * 7.4 + 0.35;
    const isLast = i === cards.length - 1;
    const hold = isLast ? 1.6 : 0.85;            /* 停留时长 */
    tl.to(card, { autoAlpha: 1, y: 0, duration: 0.4 }, at);
    if (!isLast) {
      tl.to(card, { autoAlpha: 0, y: -18, duration: 0.35 }, at + hold);
    } else {
      tl.to(card, { y: 0, duration: 1.2 }, at);  /* 末卡稳驻至释出 */
    }
  });

  /* 布局/字体就绪后再校准一次 scrub 量程 */
  ScrollTrigger.refresh();
}
