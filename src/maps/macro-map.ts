/* 宏观图组件 —— 第四阶段:由 legacy-ports/app.ts「宏观视图」分解。
 * 职责:mapMacro 创建(高德底图,滚轮留给页面滚动)、与「迁徙图谱」展区解耦联动
 *       (zou:focus 事件)、四个图层组、本支链专用高层级 pane(leaflet-chain-pane,
 *       405 > overlayPane 400)、相交路线微平行偏移、全国路线/地点渲染、
 *       金色本支链叠加与序号徽标。
 * 顺序锚点:在序章热区图之后、历史政区/郡望/名人图层之前调用(原文本序)。 */
import { useLeafletMap } from '../composables/useLeafletMap';
import { GAODE_URL, R, addPlaces, addRoutes, migr } from './runtime';
import { initNightFly } from './nightfly';
import type { RouteFC } from './types';

/* 相交路线的微平行偏移：仅移动中间拐点（±0.04°≈4px），端点仍精确落在城市节点，
   缓解赣中枢纽等多线同走廊的叠印 */
function offsetRouteCoords(coords: [number, number][], k: number): [number, number][] {
  if (coords.length < 3 || !k) return coords;
  return coords.map((c, i): [number, number] => {
    if (i === 0 || i === coords.length - 1) return c;
    const p = coords[i - 1], n = coords[Math.min(i + 1, coords.length - 1)];
    const dx = n[0] - p[0], dy = n[1] - p[1];
    const len = Math.hypot(dx, dy) || 1;
    return [c[0] - (dy / len) * k, c[1] + (dx / len) * k];
  });
}

export function initMacroMap(): void {
  const M = migr();
  const mapMacro = useLeafletMap('mapMacro', { center: [29.5, 112], zoom: 5, zoomControl: true,
    scrollWheelZoom: false });   /* 滚轮留给页面滚动（不劫持） */
  R.maps.macro = mapMacro;

  /* 与「迁徙图谱」展区解耦联动：点击 ECharts 省份 → ①号图定位 */
  window.addEventListener('zou:focus', (ev: Event) => {
    const d = (ev as CustomEvent).detail || {};
    if (!d.lng || !d.lat) return;
    const card = document.querySelector('.card-macro');
    if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    mapMacro.flyTo([d.lat, d.lng], d.zoom || 6, { duration: .9 });
  });
  L.tileLayer(GAODE_URL,
    { maxZoom: 18, subdomains: '1234', attribution: '© 高德地图' }).addTo(mapMacro);

  const macroRoutes = L.layerGroup().addTo(mapMacro);
  const macroPlaces = L.layerGroup().addTo(mapMacro);
  const chainLines = L.layerGroup().addTo(mapMacro);
  const chainPoints = L.layerGroup().addTo(mapMacro);
  R.macroLayers.routes = macroRoutes;
  R.macroLayers.places = macroPlaces;
  R.macroLayers.chainLines = chainLines;
  R.macroLayers.chainPoints = chainPoints;

  /* 本支链专用高层级 pane（405 > overlayPane 400）：金色链永远压在全国路线上 */
  if (!mapMacro.getPane('chainPane')) {
    mapMacro.createPane('chainPane');
    mapMacro.getPane('chainPane').style.zIndex = 405;
  }

  const macroFc: RouteFC = { type: 'FeatureCollection', features: M.nationalRoutes.features
    .map((f, i) => {
      return { type: 'Feature' as const, properties: f.properties,
        geometry: { type: 'LineString',
          coordinates: offsetRouteCoords(f.geometry.coordinates, ((i % 3) - 1) * 0.04) } };
    }) };
  /* 彗尾飞线模式(ECharts 迁徙图式,用户选定):分段渐变拖尾+发光行进光点 */
  addRoutes(mapMacro, macroFc, macroRoutes, { comet: true });
  R.macroKeys = addPlaces(mapMacro, M.nationalPlaces, macroPlaces);

  /* 本支迁徙链（①号窗口上的金色叠加层，随阶段动态显示） */
  addRoutes(mapMacro, M.chain, chainLines,
    { color: '#C8A165', weight: 5.5, opacity: .95, dash: '14 8',
      className: 'chainline', baseClass: 'routebase chainbase', pane: 'chainPane' });
  const chainKeys = addPlaces(mapMacro, M.chainPlaces, chainPoints, { radius: 9, pane: 'chainPane' });
  void chainKeys;
  /* 链上节点旁标注序号（继承所属阶段，随阶段显隐） */
  M.chainPlaces.features.forEach((f, i) => {
    const c = f.geometry.coordinates;
    const num = L.marker([c[1], c[0]], {
      interactive: false, icon: L.divIcon({ className: '', iconSize: [20, 20],
        iconAnchor: [-8, 22],
        html: '<div style="background:#8a5a2b;color:#fff;border-radius:50%;width:18px;height:18px;'
          + 'font-size:11px;line-height:18px;text-align:center;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4)">'
          + (i + 1) + '</div>' })
    });
    num._stage = f.properties.stage;
    num.addTo(chainPoints);
  });

  /* 暗夜星图飞线层(参考高德迁徙图,七期):黑幕+青界+星野+金橙粒子流,默认开启可关 */
  initNightFly();
}
