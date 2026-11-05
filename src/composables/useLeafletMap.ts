/* Leaflet 地图生命周期组合式函数 —— 第三阶段 PR-9。
 *
 * classic 全局 Leaflet(window.L,UMD,与原站同源)之上的创建工厂:
 * 容器校验 + 就绪校验 + 实例创建。三/四张地图(序图/①宏观/②本支链/③微观)
 * 全部经此工厂创建,后续的图层/交互/销毁策略随第四阶段分解进各地图组件。
 */

export function useLeafletMap(elId: string, opts: unknown): any {
  const el = document.getElementById(elId);
  if (!el) throw new Error('[useLeafletMap] 容器不存在:' + elId);
  const L = (window as unknown as { L?: { map(el: HTMLElement, o: unknown): any } }).L;
  if (!L) throw new Error('[useLeafletMap] window.L 未就绪(classic 资产层未加载?)');
  return L.map(el, opts);
}
