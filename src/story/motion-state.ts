/* 动效状态原语 —— 第四阶段:由 useScrollStory.ts 头部 helpers(原 17/28-30 行)分解。
 * reading():速览模式判定(body.is-reading,调用时读取);
 * motionOff():速览 或 系统减少动效。
 * 注意:REDUCE 的 MediaQueryList 在模块加载期创建是安全的(浏览器原生 API,
 * 与 classic 数据层的运行期注入不同类),.matches 每次动态读取。 */

export const REDUCE: MediaQueryList | null =
  window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

export function reading(): boolean {
  return document.body.classList.contains('is-reading');
}

export function motionOff(): boolean {
  return reading() || !!(REDUCE && REDUCE.matches);
}

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export function $id(id: string): HTMLElement | null {
  return document.getElementById(id);
}
