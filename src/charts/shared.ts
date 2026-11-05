/* 迁徙图谱共享绘图基建 —— 第四阶段:由 legacy-ports/migration-charts.ts 头部分解。
 * 内容:暗色配色 C、tooltip 底座 TT、merge、容器/实例工具、geo 底座、
 *       关键节点压角地名 labels、涟漪 ripple、路线→飞线数据 lineData、
 *       省份点击→①号图定位 bindGeoFocus(zou:focus 事件契约,冻结)。
 * REDUCE 由编排器在 init 时经 setReduce 注入(prefers-reduced-motion 判定)。 */

export const C = {
  land: '#0a1a2b', landHi: '#12324d', border: '#2b5b86',
  gold: '#ffd27a', amber: '#ffae42', cyan: '#5ad1ff', red: '#ff7b8a',
  text: '#dbe7f3', muted: '#7f97b3'
};

export const TT = {
  backgroundColor: 'rgba(6,14,25,.94)',
  borderColor: 'rgba(255,210,122,.35)',
  borderWidth: 1,
  padding: [8, 12],
  textStyle: { color: C.text, fontSize: 12, lineHeight: 19 },
  extraCssText: 'box-shadow:0 8px 28px rgba(0,0,0,.55);border-radius:2px;'
};

let REDUCE_STATE = false;
export function setReduce(reduce: boolean): void {
  REDUCE_STATE = reduce;
}
export function reduce(): boolean {
  return REDUCE_STATE;
}

export function merge(a: Record<string, unknown>, b: Record<string, unknown>): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  let k: string;
  for (k in a) o[k] = a[k];
  for (k in b) o[k] = b[k];
  return o;
}

export function box(id: string): HTMLElement | null { return document.getElementById(id); }

export function geoBase(opt?: Record<string, unknown>): Record<string, unknown> {
  const base: Record<string, unknown> = {
    map: 'zou-china',
    roam: false,
    boundingCoords: [[73, 18], [135, 54]],
    zoom: 1,
    center: null,
    itemStyle: {
      areaColor: C.land,
      borderColor: C.border,
      borderWidth: .7,
      shadowColor: 'rgba(46,130,190,.55)',
      shadowBlur: 14
    },
    emphasis: {
      itemStyle: { areaColor: C.landHi },
      label: { show: true, color: '#eaf4ff', fontSize: 10 }
    },
    label: { show: false },
    select: { disabled: true }
  };
  for (const k in opt as Record<string, unknown>) base[k] = (opt as Record<string, unknown>)[k];
  return base;
}

/* 关键节点压角地名(scatter + label,避免地理名全部铺开) */
export function labels(list: unknown[], color?: string) {
  return {
    id: 'labels', type: 'scatter', coordinateSystem: 'geo', zlevel: 5,
    symbolSize: 3, silent: true,
    itemStyle: { color: color || C.gold },
    label: {
      show: true, position: 'right', distance: 4,
      formatter: '{b}', color: '#cfe3f7', fontSize: 10.5,
      textBorderColor: '#02060c', textBorderWidth: 2.5
    },
    data: list
  };
}

export function ripple(list: unknown[], color: string, size?: number, hideLabel?: boolean) {
  return {
    type: 'effectScatter', coordinateSystem: 'geo', zlevel: 4,
    rippleEffect: reduce()
      ? { show: false }
      : { brushType: 'stroke', scale: 3.4, period: 4.2, number: 2 },
    symbolSize: size || 6,
    itemStyle: { color: color, shadowBlur: 12, shadowColor: color, opacity: .95 },
    label: {
      show: !hideLabel, position: 'right', distance: 5, formatter: '{b}',
      color: '#ffe9c4', fontSize: 11, fontWeight: 600,
      textBorderColor: '#02060c', textBorderWidth: 3
    },
    data: list
  };
}

export function lineData(features: any[], opt?: Record<string, unknown>) {
  const o: Record<string, unknown> = opt || {};
  const MIG = window.MIG as { HUE: Record<number, string> } | undefined;
  return features.map((f: any) => {
    const p = f.properties;
    return {
      name: p.from + ' → ' + p.to,
      coords: f.geometry.coordinates,
      from: p.from, to: p.to, year: p.year,
      stage: p.stage, event: p.event, note: p.note,
      lineStyle: {
        color: o.color || (MIG ? MIG.HUE[p.stage] : undefined) || C.gold,
        width: o.width || 1,
        opacity: o.opacity == null ? .55 : o.opacity,
        curveness: o.curveness == null ? .25 : o.curveness
      }
    };
  });
}

/* 省份点击 → ①号图定位(事件解耦,不访问地图组件内部变量) */
export function bindGeoFocus(chart: any): void {
  chart.on('click', (p: any) => {
    if (p.componentType !== 'geo') return;
    const prov = window.CHINA_PROV as { features: any[] } | undefined;
    if (!prov) return;
    const f = prov.features.filter((x) => x.properties.name === p.name)[0];
    if (!f || !f.properties.cx) return;
    window.dispatchEvent(new CustomEvent('zou:focus', {
      detail: { lng: f.properties.cx, lat: f.properties.cy, zoom: 6 }
    }));
  });
}
