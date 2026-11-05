/* ECharts 生命周期组合式函数 —— 第三阶段 PR-2。
 *
 * 定位:classic 全局 echarts(window.echarts,UMD,与原站同源、无 npm 依赖)之上的
 * 薄封装,收编原 migration-charts.js 中"实例获取/显隐暂停/批量 resize/dispose"
 * 等生命周期原语;业务 option 构建留在 legacy-ports/migration-charts.ts。
 *
 * 使用方:
 *   · legacy-ports(注入 runLegacy 同一函数作用域,经 legacy-bundle.ts 顶部
 *     import 缝合线以裸标识符引用);
 *   · 未来的 Vue 图表组件(onScopeDispose 场景可直接组合)。
 * 顶层 await 语义提示:调用方必须保证 window.echarts 已就绪(classic 资产层先行)。
 */

/* global echarts */

export interface EChartsLike {
  setOption(option: unknown, notMerge?: boolean): void;
  getOption(): { series?: Array<{ id?: string; effect?: { show?: boolean } }> };
  resize(): void;
  dispose(): void;
  isDisposed(): boolean;
  on(event: string, handler: (p: unknown) => void): void;
}

/** 幂等获取(或初始化)DOM 容器上的 ECharts 实例——与原 inst()/ensure() 同算法 */
export function getOrInitChart(el: HTMLElement): EChartsLike {
  const E = (window as unknown as { echarts?: {
    getInstanceByDom(el: HTMLElement): EChartsLike | undefined;
    init(el: HTMLElement, theme?: unknown, opts?: unknown): EChartsLike;
  } }).echarts;
  if (!E) throw new Error('[useECharts] window.echarts 未就绪(classic 资产层未加载?)');
  return (E.getInstanceByDom(el) ||
    E.init(el, null, {
      renderer: 'canvas',
      devicePixelRatio: Math.min(2, window.devicePixelRatio || 1),
    })) as EChartsLike;
}

/** 注册 mapGeoJSON(E.registerMap,重复注册安全) */
export function registerChartMap(name: string, geoJson: unknown): void {
  const E = (window as unknown as { echarts?: { registerMap(n: string, g: unknown): void } }).echarts;
  try { if (E) E.registerMap(name, geoJson); } catch { /* 已注册则忽略 */ }
}

/** 只切各系列的 effect.show,不动数据——离开视口/页面隐藏即省 CPU(与原 setEffect 同) */
export function setChartsEffect(
  charts: EChartsLike[],
  on: boolean,
  reduceMotion: boolean,
): void {
  charts.forEach(c => {
    if (!c || c.isDisposed()) return;
    const opt = c.getOption();
    const patches: Array<{ id?: string; effect: { show: boolean } }> = [];
    (opt.series || []).forEach(s => {
      if (s.effect) patches.push({ id: s.id, effect: { show: !!on && !reduceMotion } });
    });
    if (patches.length) c.setOption({ series: patches });
  });
}

/** 批量 resize(去抖由调用方决定) */
export function resizeAll(charts: EChartsLike[]): void {
  charts.forEach(c => { if (c && !c.isDisposed()) c.resize(); });
}

/** prefers-reduced-motion(与原 REDUCE 同口径) */
export function prefersReducedMotion(): boolean {
  return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}
