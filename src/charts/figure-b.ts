/* Ⅱ 万流归宗:汇聚到双洲 —— 第四阶段:由 legacy-ports/migration-charts.ts 分解。
 * 汇聚线为方向示意,非同时同批迁入;金色为本支。 */
import { C, TT, bindGeoFocus, box, geoBase, labels, merge, reduce, ripple } from './shared';

export function buildB(chart: any): void {
  const MIG = window.MIG as { convergence: Array<{ from: unknown; year: number | null; stage: number; group: string; fromCoord: [number, number] }>; DEST: [number, number] };
  const list = MIG.convergence;
  const data = list.map((r, i) => ({
    name: r.from + ' → 双洲',
    from: r.from, to: '清江·双洲', year: r.year, stage: r.stage,
    coords: [r.fromCoord, MIG.DEST],
    lineStyle: {
      color: r.group === 'branch' ? C.gold
           : (r.group === 'overseas' ? C.amber : C.cyan),
      width: r.group === 'branch' ? 1.4 : .9,
      opacity: .5, curveness: .3 + (i % 3) * .07
    }
  }));

  chart.setOption({
    backgroundColor: 'transparent',
    tooltip: merge({
      trigger: 'item', confine: true,
      formatter: (p: any) => {
        const d = p.data || {};
        if (!d.from) return p.name;
        return '<b style="color:#ffd27a">' + d.from + ' → 双洲</b><br>'
          + '第 ' + d.stage + ' 阶段 · ' + (d.year == null ? '年代无考' : d.year + ' 年')
          + '<br><span style="color:#7f97b3">汇聚线为方向示意,非同时同批迁入</span>';
      }
    }, TT),
    geo: geoBase(),
    series: [
      { id: 'baseB', type: 'lines', coordinateSystem: 'geo', zlevel: 1,
        silent: true, effect: { show: false },
        lineStyle: { opacity: .12, width: .7, curveness: .32 }, data: data },
      { id: 'fxB', type: 'lines', coordinateSystem: 'geo', zlevel: 2,
        effect: { show: !reduce(), period: 4.8, trailLength: .62,
                  symbol: 'arrow', symbolSize: 6, color: '#ffd27a' },
        lineStyle: { width: 1, opacity: .5, curveness: .32 }, data: data },
      ripple([{ name: '清江·双洲', value: MIG.DEST.concat([1]) }], C.gold, 9, true),
      labels([{ name: '双洲', value: MIG.DEST.concat([1]) }], C.gold)
    ]
  }, true);
  bindGeoFocus(chart);

  const subB = box('migSubB');
  if (subB) subB.textContent = list.length + ' 处记载起点 → 清江双洲 · 金色为本支';
}
