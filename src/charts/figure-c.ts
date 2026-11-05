/* Ⅲ 省域热度:八期演变 —— 第四阶段:由 legacy-ports/migration-charts.ts 分解。
 * visualMap 分级配色 + 图例 + 八期芯片切换。 */
import { C, TT, box, merge } from './shared';
import type { MigrRuntime } from '../maps/types';

export function buildC(chart: any): void {
  const MIGR = window.MIGR as MigrRuntime;
  const heat = MIGR.heatData;

  function mapData(pid: string | number) {
    return (heat[String(pid)] || []).map((d) => ({
      name: d.p, value: d.v, note: d.note,
      label: d.v >= 2
        ? { show: true, color: '#1b1206', fontSize: 10, fontWeight: 700 }
        : { show: false }
    }));
  }
  function render(pid: string | number) {
    chart.setOption({
      backgroundColor: 'transparent',
      tooltip: merge({
        trigger: 'item', confine: true,
        formatter: (p: any) => {
          if (p.value == null || isNaN(p.value)) {
            return p.name + '<br><span style="color:#7f97b3">暂无记载</span>';
          }
          const lv = ['', '初步分布', '聚居发展', '核心聚集'][p.value] || '';
          return '<b style="color:#ffd27a">' + p.name + '</b> · ' + lv
            + '<br>' + ((p.data && p.data.note) || '');
        }
      }, TT),
      visualMap: {
        type: 'piecewise', show: false, left: 12, bottom: 12,
        itemWidth: 12, itemHeight: 10, itemGap: 8,
        textStyle: { color: C.muted, fontSize: 10.5 },
        pieces: [
          { min: 3, max: 3, label: '核心聚集', color: '#ffd27a' },
          { min: 2, max: 2, label: '聚居发展', color: '#c9823c' },
          { min: 1, max: 1, label: '初步分布', color: '#2f6f9e' }
        ],
        outOfRange: { color: '#0d1b2b' }
      },
      series: [{
        id: 'heat', type: 'map', map: 'zou-china', roam: false,
        boundingCoords: [[73, 18], [135, 54]],
        zoom: 1, center: null,
        itemStyle: { areaColor: '#0d1b2b', borderColor: C.border, borderWidth: .7 },
        emphasis: {
          itemStyle: { areaColor: '#1b3d59' },
          label: { show: true, color: '#fff', fontSize: 10 }
        },
        select: { disabled: true },
        data: mapData(pid)
      }]
    }, true);
  }
  render(1);

  const legendC = box('migLegendC');
  if (legendC) {
    ([['#ffd27a', '核心聚集'], ['#c9823c', '聚居发展'],
      ['#2f6f9e', '初步分布'], ['#0d1b2b', '暂无记载']] as [string, string][]).forEach((p) => {
      legendC.insertAdjacentHTML('beforeend',
        '<span class="mig-lg"><i style="background:' + p[0] + '"></i>' + p[1] + '</span>');
    });
  }

  const chipsC = box('migChipsC');
  const names = ['先秦', '秦汉', '魏晋', '隋唐', '宋元', '明', '清', '当代'];
  if (chipsC) {
    chipsC.innerHTML = names.map((n, i) =>
      '<button class="mig-chip' + (i === 0 ? ' is-on' : '')
      + '" data-p="' + (i + 1) + '" aria-pressed="' + (i === 0 ? 'true' : 'false') + '">'
      + n + '</button>').join('');
    chipsC.addEventListener('click', (e: Event) => {
      const b = (e.target as Element).closest ? (e.target as Element).closest('.mig-chip') : null;
      if (!b) return;
      Array.prototype.forEach.call(chipsC.querySelectorAll('.mig-chip'), (x: HTMLElement) => {
        const on = x === b;
        x.classList.toggle('is-on', on);
        x.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      render(+(b.getAttribute('data-p') || 1));
    });
  }
}
