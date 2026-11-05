/* 地图组件共享基建 —— 第四阶段:由 legacy-ports/app.ts 头部公共区分解而来。
 *
 * 内容:①MIGR 数据访问;②toast 回执;③弹窗/标注 HTML 工厂(esc/yearText/
 *      popHTML/routePopHTML);④路线/点位图层工厂(addRoutes/addPlaces,
 *      含移动箭头单 rAF 循环与 startArrowLoop 启动钩);⑤图层显隐工具;
 *      ⑥句柄注册表 R 与 window._zou 桥安装。
 * 与原单 IIFE 逐行等价的两个顺序锚点:
 *  - startArrowLoop() 由编排器在创建任何地图之前调用(原 rAF 循环 IIFE 位置);
 *  - initToast() 由 share-url 组件在原 toast 创建位置调用(showToast 仅供
 *    事件处理器使用,首调只会发生在初始化完成后,懒建兜底不改变任何时序)。 */
import type { LLayer, LMap, MigrRuntime, PlaceFC, PlaceProps, RouteFC, RouteFeature } from './types';
import { useAtlasStore } from '../stores/atlas';

/* ---------- ① MIGR 数据访问(两态同形;main.ts 已在启动编排时写入) ---------- */

export function migr(): MigrRuntime {
  return window.MIGR as MigrRuntime;
}

/** 高德底图(三张业务图共用;天地图已整体移除,底图=高德/OSM/无) */
export const GAODE_URL = 'https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}';

/* ---------- ② 公共工具 ---------- */

export function esc(s: unknown): string {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* 只有 620 封侯、1507 迁双洲为谱注明纪年；其余为阶段代表年，弹窗统一加"约" */
const YEAR_SPECIAL: Record<string, string> = { '宜黄': '约 800（贞元年间）' };

export function yearText(p: PlaceProps): string | number {
  if (p.name && YEAR_SPECIAL[p.name]) return YEAR_SPECIAL[p.name];
  /* 仅 620 封侯、1507 迁双洲为谱注明确纪年，其余按阶段代表年记'约' */
  if (p.year === 620 || p.year === 1507) return p.year as number;
  const y = p.year as number;
  return y < 0 ? '约前' + (-y) : '约 ' + y;
}

export function popHTML(p: PlaceProps): string {
  const M = migr();
  const st = M.stages[(p.stage as number) - 1] || {};  /* stage 编号从 1 起，数组下标需减一 */
  let html = '<div class="pop">'
    + '<span class="badge" style="background:' + st.color + '">' + esc(st.name) + '</span>'
    + '<div class="pt">' + esc(p.name) + '</div>'
    + '<div class="po">古称 / 记载：' + esc(p.oldName) + '</div>';
  if (p.event) html += '<div class="pk"><b>事件</b>：' + esc(p.event) + '</div>';
  if (p.figure) html += '<div class="pk"><b>相关人物</b>：' + esc(p.figure) + '</div>';
  if (p.year) html += '<div class="pk"><b>纪年</b>：' + esc(yearText(p)) + '</div>';
  if (p.note) html += '<div class="pn">' + esc(p.note) + '</div>';
  return html + '</div>';
}

export function routePopHTML(f: RouteFeature): string {
  const M = migr();
  const p = f.properties, st = M.stages[(p.stage as number) - 1] || {};  /* 同上，修正下标错位 */
  return '<div class="pop">'
    + '<span class="badge" style="background:' + st.color + '">' + esc(st.name) + '</span>'
    + '<div class="pt">' + esc(p.from) + ' → ' + esc(p.to) + '</div>'
    + (p.event ? '<div class="pk">' + esc(p.event) + '</div>' : '')
    + (p.note ? '<div class="pn">' + esc(p.note) + '</div>' : '')
    + '</div>';
}

export function bearing(c1: [number, number], c2: [number, number]): number {
  const dLng = (c2[0] - c1[0]) * Math.PI / 180;
  const y = Math.sin(dLng) * Math.cos(c2[1] * Math.PI / 180);
  const x = Math.cos(c1[1] * Math.PI / 180) * Math.sin(c2[1] * Math.PI / 180)
    - Math.sin(c1[1] * Math.PI / 180) * Math.cos(c2[1] * Math.PI / 180) * Math.cos(dLng);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

const arrowIcon = (deg: number, color: string): LLayer => {
  return L.divIcon({
    className: 'rt-arrow', iconSize: [14, 14],
    html: '<div class="tri-arrow" style="transform:rotate(' + deg + 'deg);color:' + color + '"></div>'
  });
};

/* ---------- ④ 路线/点位图层工厂 ---------- */

/* ---------- 弧线采样:两点 → 二次贝塞尔凸弧(大圆弧观感) ----------
 * 控制点 = 中点 + 法向偏移(偏移量 = 距离 × bend,bend 正负交替使相邻弧错落);
 * 采样 36 点折线近似,视觉平滑且完全兼容 L.Polyline 语义
 * (时间线显隐/popup/移动箭头全部契约零破坏——ant-path 库本身是
 *  FeatureGroup 封装,会绕过 macro-timeline 的 instanceof L.Polyline 判断)。
 * 五期起被 nightfly.ts 暗夜粒子流复用,故导出。 */
export function arcPoints(a: [number, number], b: [number, number], bend: number): Array<[number, number]> {
  const midLat = (a[0] + b[0]) / 2, midLng = (a[1] + b[1]) / 2;
  const dLat = b[0] - a[0], dLng = b[1] - a[1];
  const nLen = Math.hypot(dLat, dLng) || 1;
  const cLat = midLat + (-dLng / nLen) * nLen * bend;
  const cLng = midLng + (dLat / nLen) * nLen * bend;
  const pts: Array<[number, number]> = [];
  const N = 36;
  for (let i = 0; i <= N; i++) {
    const t = i / N, u = 1 - t;
    pts.push([u * u * a[0] + 2 * u * t * cLat + t * t * b[0],
              u * u * a[1] + 2 * u * t * cLng + t * t * b[1]]);
  }
  return pts;
}

export interface AddRoutesOpts {
  color?: string;
  weight?: number;
  opacity?: number;
  dash?: string;
  className?: string;
  baseClass?: string;
  pane?: string;
  noArrow?: boolean;
  movingArrow?: boolean;
  bend?: number;             /* 弧线凸度(相对距离比例,默认 0.16,正负交替) */
  comet?: boolean;           /* 彗尾飞线模式:分段透明度/线宽渐变 + 发光行进光点 */
}

export function addRoutes(map: LMap, fc: RouteFC, layerGroup: LLayer, opts?: AddRoutesOpts): void {
  const o: AddRoutesOpts = opts || {};
  fc.features.forEach((f, fi) => {
    const p = f.properties, color = o.color || migr().stageColor[p.stage as number] || '#888';
    /* 原始坐标 [lng,lat] → Leaflet [lat,lng];两点取凸弧(方向按段序交替),
     * 多点路径逐对取弧拼接(相邻弧反向,呈 S 形过渡) */
    const raw = f.geometry.coordinates.map((c): [number, number] => [c[1], c[0]]);
    const bend = (o.bend != null ? o.bend : 0.16) * (fi % 2 === 0 ? 1 : -1);
    let pts: Array<[number, number]>;
    if (raw.length === 2) {
      pts = arcPoints(raw[0], raw[1], bend);
    } else {
      pts = [];
      for (let i = 0; i < raw.length - 1; i++) {
        const seg = arcPoints(raw[i], raw[i + 1], bend * (i % 2 === 0 ? 1 : -1));
        if (i > 0) seg.shift();
        pts = pts.concat(seg);
      }
    }
    /* 彗尾飞线模式(comet):弧采样拆 12 段,透明度/线宽自起点向终点衰减(彗星拖尾);
     * 另出一条隐形交互线(可点击弹窗,三态由 macro-timeline 驱动)。
     * 非 comet:沿用底光晕+蚂蚁流虚线双层。 */
    if (o.comet) {
      const SEGS = 12, per = Math.ceil((pts.length - 1) / SEGS);
      for (let s = 0; s < SEGS; s++) {
        const from = s * per, to = Math.min(pts.length - 1, (s + 1) * per);
        if (from >= to) break;
        const k = s / (SEGS - 1 || 1);
        const seg = L.polyline(pts.slice(from, to + 1), {
          color: color,
          weight: Math.round(((o.weight || 3) + 1.6) * (1 - k * 0.55) * 10) / 10,
          opacity: 0.9 * (1 - k) + 0.06,
          className: 'cometseg', pane: o.pane
        });
        seg._stage = p.stage;
        seg._cometOp = 0.9 * (1 - k) + 0.06;
        seg._cometW = Math.round(((o.weight || 3) + 1.6) * (1 - k * 0.55) * 10) / 10;
        layerGroup.addLayer(seg);
      }
      /* 隐形交互线:可点击弹窗;视觉交给彗尾段 */
      const hit = L.polyline(pts, {
        color: color, weight: (o.weight || 3) + 4, opacity: 0,
        className: 'comet-int', pane: o.pane
      }).bindPopup(routePopHTML(f));
      hit._stage = p.stage;
      layerGroup.addLayer(hit);
      if (!o.noArrow) {
        const n = pts.length;
        if (n >= 2) {
          const deg = bearing(pts[n - 2], pts[n - 1]);
          const arrow = L.marker(pts[n - 1], { icon: arrowIcon(deg, color),
            interactive: false });
          arrow._stage = p.stage;
          arrow.addTo(layerGroup);
        }
      }
      if (o.movingArrow !== false) {
        addMovingArrow(layerGroup, pts, f, color);
      }
      return;
    }
    /* 底光晕线：粗、低透明度，衬托流光 */
    const base = L.polyline(pts, {
      color: color, weight: (o.weight || 3) + 3, opacity: .18,
      className: o.baseClass || 'routebase', pane: o.pane
    });
    base._stage = p.stage;
    layerGroup.addLayer(base);
    /* 蚂蚁流主线：短划沿弧流动(antflow 动画,flowline 类保留时间线契约) */
    const line = L.polyline(pts, {
      color: color, weight: o.weight || 3, opacity: o.opacity || .85,
      dashArray: o.dash || '10 9', className: (o.className || 'flowline') + ' antdash',
      pane: o.pane
    }).bindPopup(routePopHTML(f));
    line._stage = p.stage;
    layerGroup.addLayer(line);
    if (!o.noArrow) {
      const n = pts.length;
      if (n >= 2) {
        const deg = bearing(pts[n - 2], pts[n - 1]);
        const arrow = L.marker(pts[n - 1], { icon: arrowIcon(deg, color),
          interactive: false });
        arrow._stage = p.stage;
        arrow.addTo(layerGroup);
      }
    }
    /* 沿弧线随时间移动的箭头（出发地 → 目的地循环） */
    if (o.movingArrow !== false) {
      addMovingArrow(layerGroup, pts, f, color);
    }
  });
}

/* ---------- 移动箭头：单全局 rAF 循环驱动 ---------- */

interface MovingArrowRec {
  marker: LLayer;
  pts: [number, number][];
  segs: number[];
  total: number;
  duration: number;
  el: HTMLElement | null;
  lastSeg: number;
  bearings: number[];
}

const movingArrows: MovingArrowRec[] = [];

function addMovingArrow(layerGroup: LLayer, pts: Array<[number, number]>, feature: RouteFeature, color: string): void {
  if (pts.length < 2) return;
  const segs: number[] = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    /* M.dist 以 [lng,lat] 计；pts 为 Leaflet 的 [lat,lng]，须交换 */
    const d = migr().dist([pts[i - 1][1], pts[i - 1][0]], [pts[i][1], pts[i][0]]);
    segs.push(Math.max(d, 0.001)); total += d;
  }
  const marker = L.marker(pts[0], {
    interactive: false, zIndexOffset: 500,
    icon: L.divIcon({ className: '', iconSize: [16, 16], iconAnchor: [8, 8],
      html: '<div class="mv-arrow tri-arrow" style="color:' + color + '"></div>' })
  });
  marker._stage = feature.properties.stage;
  const rec: MovingArrowRec = { marker: marker, pts: pts, segs: segs, total: total,
    duration: Math.min(9, Math.max(3, total / 220)),
    el: null, lastSeg: -1, bearings: [] };
  for (let i = 1; i < pts.length; i++) rec.bearings.push(bearing(pts[i - 1], pts[i]));
  movingArrows.push(rec);
  layerGroup.addLayer(marker);
}

/** 原 IIFE 内联启动的 rAF 循环;编排器在创建任何地图之前调用(时序逐行等价) */
export function startArrowLoop(): void {
  function frame(now: number): void {
    for (let j = 0; j < movingArrows.length; j++) {
      const a = movingArrows[j];
      if (!a.el) {
        const el = a.marker.getElement();
        a.el = el ? el.querySelector('.mv-arrow') : null;
        if (!a.el) continue;
      }
      const dur = a.duration, t = ((now / 1000) % dur) / dur;
      const target = t * a.total;
      let acc = 0, i = 0;
      while (i < a.segs.length - 1 && acc + a.segs[i] < target) { acc += a.segs[i]; i++; }
      let f = (target - acc) / a.segs[i];
      if (f < 0) f = 0; if (f > 1) f = 1;
      const p0 = a.pts[i], p1 = a.pts[i + 1];
      a.marker.setLatLng([p0[0] + (p1[0] - p0[0]) * f, p0[1] + (p1[1] - p0[1]) * f]);
      if (i !== a.lastSeg) {
        a.el!.style.transform = 'rotate(' + Math.round(a.bearings[i]) + 'deg)';
        a.lastSeg = i;
      }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

export interface AddPlacesOpts {
  radius?: number;
  pane?: string;
}

export function addPlaces(map: LMap, fc: PlaceFC, layerGroup: LLayer, opts?: AddPlacesOpts): Record<string, LLayer> {
  const o: AddPlacesOpts = opts || {};
  const byKey: Record<string, LLayer> = {};
  fc.features.forEach((f) => {
    const p = f.properties, c = f.geometry.coordinates;
    const m = L.circleMarker([c[1], c[0]], {
      radius: o.radius || 7, color: '#fff', weight: 2,
      fillColor: migr().stageColor[p.stage as number] || '#555', fillOpacity: .95,
      pane: o.pane
    }).bindPopup(popHTML(p));
    m._stage = p.stage; m._key = c[1] + ',' + c[0]; m._props = p;
    layerGroup.addLayer(m);
    byKey[m._key] = m;
  });
  return byKey;
}

/* ---------- ⑤ 图层显隐工具 ---------- */

export function setLayerOpacity(l: LLayer, show: boolean, defOp?: number): void {
  if (typeof l.setStyle === 'function') {
    if (l.options.fillColor) {
      l.setStyle({ opacity: show ? 1 : 0, fillOpacity: show ? (l.options.fillOpacity || .95) : 0 });
    } else {
      l.setStyle({ opacity: show ? (l.options.opacity || defOp || .85) : 0 });
    }
  }
  if (l.getElement && l._icon) l.getElement().style.display = show ? '' : 'none';
}

/* ---------- ② toast 回执 ---------- */

let toastEl: HTMLDivElement | null = null;
let toastTimer: ReturnType<typeof setTimeout> | null = null;

/** 在原 toast 创建位置调用(share-url 组件);重复调用幂等 */
export function initToast(): void {
  if (toastEl) return;
  toastEl = document.createElement('div');
  toastEl.className = 'toast';
  toastEl.setAttribute('role', 'status');
  document.body.appendChild(toastEl);
}

export function showToast(msg: string): void {
  if (!toastEl) initToast();
  toastEl!.textContent = msg;
  toastEl!.classList.add('on');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl!.classList.remove('on'); }, 2400);
}

/* ---------- ⑥ 句柄注册表 + window._zou 桥 ---------- */

export interface AtlasRegistry {
  maps: { heat: LMap | null; macro: LMap | null; chain: LMap | null; micro: LMap | null };
  /** ①号宏观图四个图层组(全国路线/地点 + 金色本支链线/点) */
  macroLayers: {
    routes: LLayer | null;
    places: LLayer | null;
    chainLines: LLayer | null;
    chainPoints: LLayer | null;
  };
  macroKeys: Record<string, LLayer>;
  chainKeys2: Record<string, LLayer>;
  microKeys: Record<string, LLayer>;
  personByKey: Record<string, LLayer>;
  chainCoords: [number, number][];
  notableLayer: LLayer | null;
  notableByKey: Record<string, LLayer>;
  notableLbl: HTMLLabelElement | null;
}

/** 跨地图组件共享的句柄注册表(替代原单 IIFE 闭包变量) */
export const R: AtlasRegistry = {
  maps: { heat: null, macro: null, chain: null, micro: null },
  macroLayers: { routes: null, places: null, chainLines: null, chainPoints: null },
  macroKeys: {},
  chainKeys2: {},
  microKeys: {},
  personByKey: {},
  chainCoords: [],
  notableLayer: null,
  notableByKey: {},
  notableLbl: null,
};

/** 调试/测试句柄:v31 底图切换与 scroll-story 经 window._zou 读地图与句柄(桥形状不变) */
export function installZouBridge(): void {
  const store = useAtlasStore();
  window._zou = { mapMacro: R.maps.macro, mapChain: R.maps.chain, mapMicro: R.maps.micro,
    mapHeat: R.maps.heat, branchSel: store.branchSel, chainKeys2: R.chainKeys2, microKeys: R.microKeys };
}
