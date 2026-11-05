/* Ⅳ 一村千年:赣中链条 —— 第四阶段:由 legacy-ports/migration-charts.ts 分解。
 * 袁水河道虚线 + 本支链飞线 + 站点/村落参照点(方位逐个指定避免重叠)。 */
import { C, TT, geoBase, lineData, merge, reduce, ripple } from './shared';
import type { MigrRuntime } from '../maps/types';

export function buildD(chart: any): void {
  const MIGR = window.MIGR as MigrRuntime;
  const chain = MIGR.chain.features.filter((f) => ((f.properties.year as number) ?? 0) >= 900);
  const stops: any[] = [];
  chain.forEach((f) => {
    stops.push({ name: (f.properties.from as string).replace(/^[①-⑦]\s*/, ''),
      value: f.geometry.coordinates[0].concat([f.properties.year as number]) });
  });
  const last = chain[chain.length - 1];
  if (last) {
    stops.push({ name: '双洲',
      value: last.geometry.coordinates.slice(-1)[0].concat([1507]) });
  }
  const road = MIGR.villageRoutes.features[1].geometry.coordinates;

  chart.setOption({
    backgroundColor: 'transparent',
    tooltip: merge({
      trigger: 'item', confine: true,
      formatter: (p: any) => {
        const d = p.data || {};
        if (d.event) {
          return '<b style="color:#ffd27a">' + d.from + ' → ' + d.to + '</b><br>'
            + (d.year + ' 年') + '<br>' + d.event;
        }
        return '<b>' + p.name + '</b>';
      }
    }, TT),
    geo: geoBase({
      boundingCoords: [[115.25, 27.40], [116.50, 28.08]],
      zoom: 1, center: null,
      itemStyle: { areaColor: '#081827', borderColor: '#24506f', borderWidth: .8 }
    }),
    series: [
      { id: 'riverD', type: 'lines', coordinateSystem: 'geo', zlevel: 1,
        silent: true,
        lineStyle: { color: '#2f7fa8', width: 2.2, opacity: .55,
          curveness: .12, type: 'dashed' },
        data: [{ coords: road }] },
      { id: 'baseD', type: 'lines', coordinateSystem: 'geo', zlevel: 2,
        silent: true, effect: { show: false },
        lineStyle: { color: C.gold, width: 1.2, opacity: .22, curveness: .18 },
        data: lineData(chain, { color: C.gold, opacity: .22, curveness: .18 }) },
      { id: 'fxD', type: 'lines', coordinateSystem: 'geo', zlevel: 3,
        effect: { show: !reduce(), period: 3.6, trailLength: .7,
                  symbol: 'arrow', symbolSize: 8, color: '#ffe6b8' },
        lineStyle: { color: C.gold, width: 1.6, opacity: .65, curveness: .18 },
        data: lineData(chain, { color: C.gold, opacity: .65, curveness: .18 }) },
      ripple(stops, C.gold, 7, true),
      /* 站点地名:逐个指定方位,避免"湖边/双洲"近距重叠 */
      { id: 'labelsD', type: 'scatter', coordinateSystem: 'geo', zlevel: 6,
        symbolSize: 3, silent: true, itemStyle: { color: C.gold },
        label: {
          show: true, formatter: '{b}', color: '#ffe9c4', fontSize: 11,
          fontWeight: 600, textBorderColor: '#02060c', textBorderWidth: 3
        },
        data: stops.map((s, i) => {
          const POSD: Record<string, [string, number]> =
            { '宜黄': ['right', 8], '埮坪': ['top', 6],
              '湖边': ['bottom', 9], '双洲': ['left', 10] };
          const cfg = POSD[s.name] || ['right', 7];
          return { name: s.name, value: s.value,
                   label: { position: cfg[0], distance: cfg[1] } };
        }) },
      /* 村落/府城参照点:方位错开 */
      { id: 'labelsE', type: 'scatter', coordinateSystem: 'geo', zlevel: 6,
        symbolSize: 3, silent: true, itemStyle: { color: '#cfe3f7' },
        labelLayout: { hideOverlap: true, moveOverlap: 'shiftY' },
        label: {
          show: true, formatter: '{b}', color: '#cfe3f7', fontSize: 10.5,
          textBorderColor: '#02060c', textBorderWidth: 2.5
        },
        data: [
          { name: '临江府城', value: [115.404888, 28.005563],
            label: { position: 'top', distance: 16 } },
          { name: '游家洲', value: [115.402094, 27.914986],
            label: { show: false } }
        ] }
    ]
  }, true);
}
