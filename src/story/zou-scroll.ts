/* 滚动叙事引擎 —— 第四阶段:由 useScrollStory.ts「核心:单例 rAF」分解(原 33-87 行)。
 * 零依赖:自写单例 rAF + IntersectionObserver;不劫持滚轮。
 * ZouScroll.add(el, cb) 提供 0–1 进度,进度只在变化(≥0.001)时回调;
 * window.ZouScroll 桥形状冻结(外部/测试经它读取,内部组件直接 import 本模块)。 */
import { REDUCE, motionOff } from './motion-state';

export interface ScrollItem {
  el: Element;
  cb: (p: number, it?: ScrollItem) => void;
  last: number;
  active: boolean;
  top?: number;
  height?: number;
  vh?: number;
  range?: number;
  io?: IntersectionObserver;
}

const items: ScrollItem[] = [];
let raf: number | null = null;

export function measure(it: ScrollItem): void {
  const r = it.el.getBoundingClientRect();
  const h = (it.el as HTMLElement).offsetHeight;
  it.top = r.top + window.scrollY;
  it.height = h;
  it.vh = window.innerHeight;
  it.range = Math.max(1, h - window.innerHeight);
}

function run(): void {
  raf = null;
  if (motionOff()) return;
  const y = window.scrollY;
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (!it.active) continue;
    const p = Math.min(1, Math.max(0, (y - (it.top as number)) / (it.range as number)));
    if (Math.abs(p - it.last) < 0.001) continue;
    it.last = p;
    try { it.cb(p, it); } catch (e) { /* 单个场景异常不阻塞其它 */ }
  }
}

export function schedule(): void {
  if (!raf) raf = requestAnimationFrame(run);
}

export function zouScrollAdd(el: Element | null, cb: (p: number, it?: ScrollItem) => void): ScrollItem | null {
  if (!el || typeof cb !== 'function') return null;
  const it: ScrollItem = { el: el, cb: cb, last: -1, active: false };
  measure(it);
  items.push(it);
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((es) => {
      es.forEach((en) => { it.active = en.isIntersecting; });
      schedule();
    }, { rootMargin: '200px 0px 200px 0px' });
    io.observe(el);
    it.io = io;
  } else { it.active = true; }
  return it;
}

export function zouScrollRefresh(): void {
  items.forEach(measure);
  schedule();
}

export function zouScrollEnabled(): boolean {
  return !motionOff();
}

export function initZouScroll(): void {
  window.ZouScroll = {
    add: zouScrollAdd,
    refresh: zouScrollRefresh,
    enabled: zouScrollEnabled,
  };

  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', () => {
    items.forEach(measure);
    schedule();
  }, { passive: true });
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => { items.forEach(measure); schedule(); });
  }
  if (REDUCE && REDUCE.addEventListener) {
    REDUCE.addEventListener('change', () => { items.forEach(measure); schedule(); });
  }
  setTimeout(() => { items.forEach(measure); schedule(); }, 600);
}

/** 动效开关切换后重测全部卷区(原 applyMotion 内的 items.forEach(measure)) */
export function remeasureAll(): void {
  items.forEach(measure);
  schedule();
}
