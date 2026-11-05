/* Ⅰ 千年长卷:八阶段飞线 —— 第四阶段:由 legacy-ports/migration-charts.ts 分解。
 * 境内段飞线(海外段在 18°N 裁切外剔除)+ 阶段芯片 + 八阶段播放器。 */
import type { MigrRuntime } from '../maps/types';
import { C, TT, bindGeoFocus, box, geoBase, labels, lineData, merge, reduce, ripple } from './shared';

export function buildA(chart: any): void {
  const MIGR = window.MIGR as MigrRuntime;
  const MIG = window.MIG as { HUE: Record<number, string> };
  /* 海外段在 18°N 裁切外,剔除避免线穿出图框;海外播迁见Ⅱ图与页底声明 */
  const feats = MIGR.nationalRoutes.features.filter((f: any) =>
    !f.geometry.coordinates.some((c: number[]) => c[1] < 18));
  let stage = 0;
  const keyNodes = ['邹城', '涿州', '南阳', '宜黄', '泰宁', '成都', '樟树·双洲'];
  const nodes = MIGR.nationalPlaces.features.filter((f: any) =>
    keyNodes.indexOf(f.properties.name) >= 0).map((f: any) =>
    ({ name: f.properties.name,
       value: f.geometry.coordinates.concat([f.properties.stage]) }));

  const fxData = () => lineData(stage ? feats.filter((f: any) => f.properties.stage === stage) : feats,
    { width: 1.05, opacity: .6, curveness: .28 });

  chart.setOption({
    backgroundColor: 'transparent',
    tooltip: merge({
      trigger: 'item', confine: true,
      formatter: (p: any) => {
        const d = p.data || {};
        if (!d.from) return p.name;
        return '<b style="color:#ffd27a">' + d.from + ' → ' + d.to + '</b><br>'
          + '第 ' + d.stage + ' 阶段 · ' + (d.year == null ? '年代无考' : d.year + ' 年') + '<br>'
          + (d.event || '')
          + (d.note ? '<br><span style="color:#7f97b3">' + d.note + '</span>' : '');
      }
    }, TT),
    geo: geoBase(),
    series: [
      { id: 'baseA', type: 'lines', coordinateSystem: 'geo', zlevel: 1,
        silent: true, effect: { show: false },
        lineStyle: { opacity: .16, width: .8, curveness: .28 },
        data: lineData(feats, { width: .8, opacity: .16, curveness: .28 }) },
      { id: 'fxA', type: 'lines', coordinateSystem: 'geo', zlevel: 2,
        effect: { show: !reduce(), period: 4.4, trailLength: .55,
                  symbol: 'arrow', symbolSize: 6.5, color: '#ffe6b8' },
        lineStyle: { width: 1, opacity: .55, curveness: .28 },
        data: fxData() },
      ripple(nodes, C.gold, 6, true),
      { id: 'labelsA', type: 'scatter', coordinateSystem: 'geo', zlevel: 6,
        symbolSize: 3, silent: true, itemStyle: { color: C.gold },
        labelLayout: { hideOverlap: true, moveOverlap: 'shiftY' },
        label: {
          show: true, formatter: '{b}', color: '#ffe9c4', fontSize: 11,
          fontWeight: 600, textBorderColor: '#02060c', textBorderWidth: 3
        },
        data: nodes.filter((n: any) => ['邹城', '宜黄', '樟树·双洲'].indexOf(n.name) >= 0).map((n: any) => {
          const POS: Record<string, [string, number]> =
            { '邹城': ['right', 8], '宜黄': ['bottom', 9], '樟树·双洲': ['top', 9] };
          const cfg = POS[n.name] || ['right', 7];
          return { name: n.name, value: n.value,
                   label: { position: cfg[0], distance: cfg[1] } };
        }) },
      /* 其余节点:hover 才显示地名 */
      { id: 'labelsHoverA', type: 'scatter', coordinateSystem: 'geo', zlevel: 5,
        symbolSize: 6, itemStyle: { color: 'transparent' },
        label: { show: false },
        emphasis: { label: { show: true, formatter: '{b}', color: '#ffe9c4',
          fontSize: 11, fontWeight: 600, position: 'right', distance: 6,
          textBorderColor: '#02060c', textBorderWidth: 3 } },
        data: nodes }
    ]
  }, true);
  bindGeoFocus(chart);

  /* 阶段芯片 */
  const chipsA = box('migChipsA');
  const names = ['先秦', '秦汉', '魏晋', '隋唐', '两宋', '元明', '清代', '近现代'];
  if (chipsA) {
    chipsA.innerHTML = '<button class="mig-chip is-on" data-s="0" aria-pressed="true">全部</button>'
      + names.map((n, i) =>
        '<button class="mig-chip" data-s="' + (i + 1) + '" aria-pressed="false">'
        + '<i class="mig-chip-dot" style="background:' + MIG.HUE[i + 1] + '"></i>'
        + n + '</button>').join('');
    chipsA.addEventListener('click', (e: Event) => {
      const b = (e.target as Element).closest ? (e.target as Element).closest('.mig-chip') : null;
      if (!b) return;
      stage = +(b.getAttribute('data-s') || 0);
      Array.prototype.forEach.call(chipsA.querySelectorAll('.mig-chip'), (x: HTMLElement) => {
        const on = x === b;
        x.classList.toggle('is-on', on);
        x.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      chart.setOption({ series: [{ id: 'fxA', data: fxData() }] });
    });
  }
  const subA = box('migSubA');
  if (subA) subA.textContent = feats.length + ' 段境内路线 · 按阶段点亮 · 箭头指向迁入地';

  /* S3.6 八阶段播放 */
  const playA = box('migPlayA');
  if (playA) {
    let timer: ReturnType<typeof setInterval> | null = null, i = 1;
    playA.addEventListener('click', () => {
      if (timer) {   /* 停止:清除并回到"全部" */
        clearInterval(timer); timer = null;
        playA.textContent = '▶'; playA.classList.remove('is-on');
        const all = chipsA && chipsA.querySelector('.mig-chip[data-s="0"]');
        if (all) (all as HTMLElement).click();
        return;
      }
      playA.textContent = '⏸'; playA.classList.add('is-on');
      i = 1;
      const tick = () => {
        const chip = chipsA && chipsA.querySelector('.mig-chip[data-s="' + i + '"]');
        if (chip) (chip as HTMLElement).click();
        i = i % 8 + 1;
      };
      tick();
      timer = setInterval(tick, 1400);
    });
  }
}
