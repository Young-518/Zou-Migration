/* 面板组件集 —— 第四阶段:由 legacy-ports/app.ts 五个独立小节合并分解
 * (名人堂卡片/时空路径剖面/统计灯箱/世代统计图表/重走迁徙路)。
 * 各小节内部逻辑与原文本逐行等价;五个小节彼此零耦合(均为独立事件绑定),
 * 与搜索组件的注册顺序互换无可观测差异(不同目标元素,不共享状态)。
 * 顺序锚点:整体在外壳组件之后、搜索组件之前调用(原文本序近似,见编排器注释)。 */
import { R, esc, migr } from './runtime';
import type { LMap } from './types';

/* ---------------- 名人堂卡片（B方案，与①号星标互通） ---------------- */
function initNotableCards(): void {
  const M = migr();
  const mapMacro = R.maps.macro as LMap;
  const wrap = document.getElementById('notableCards');
  if (!wrap) return;
  M.notable.forEach((d) => {
    const card = document.createElement('div');
    card.className = 'notable-card';
    card.innerHTML = '<div class="nc-head"><span class="nc-star">★</span><b>' + esc(d.name)
      + '</b><span class="nc-era">' + esc(d.era) + ' · ' + esc(d.dyn) + '</span></div>'
      + '<div class="nc-title">' + esc(d.title) + '</div>'
      + '<div class="nc-bio">' + esc(d.bio) + '</div>'
      + '<div class="nc-allu">典故：' + esc(d.allusion) + '</div>';
    card.onclick = () => {
      const details = document.getElementById('notableDetails') as HTMLDetailsElement | null;
      if (details && !details.open) details.open = true;
      const chk = document.getElementById('chkNotable') as HTMLInputElement;
      if (!chk.checked) {
        chk.checked = true;
        R.notableLayer!.addTo(mapMacro);
      }
      document.querySelector('.card-macro')!.scrollIntoView({ behavior: 'smooth', block: 'start' });
      mapMacro.flyTo(d.latlng, 7, { duration: .8 });
      const mk = R.notableByKey[d.name];
      if (mk) setTimeout(() => { mk.openPopup(); }, 900);
    };
    wrap.appendChild(card);
  });
}

/* ---------------- 时空路径剖面图（纬度 × 年代） ---------------- */
function renderSpaceTime(): void {
  const el = document.getElementById('stChart');
  if (!el || !window.d3) return;
  const stops = [
    { n: '① 莱州', yr: 620, lat: 37.1789 },
    { n: '② 范阳', yr: 620, lat: 39.4862 },
    { n: '③ 光州', yr: 760, lat: 32.1347 },
    { n: '④ 宜黄', yr: 800, lat: 27.5546 },
    { n: '⑤ 埮坪', yr: 965, lat: 27.60 },
    { n: '⑥ 湖边', yr: 1080, lat: 27.7404 },
    { n: '⑦ 双洲', yr: 1507, lat: 27.9253 }
  ];
  const W = 800, H = 250, m = { t: 26, r: 26, b: 32, l: 52 };
  const x = d3.scaleLinear().domain([560, 1560]).range([m.l, W - m.r]);
  const y = d3.scaleLinear().domain([25, 41]).range([H - m.b, m.t]);
  const svg = d3.select(el).append('svg')
    .attr('viewBox', '0 0 ' + W + ' ' + H).style('width', '100%')
    .style('display', 'block');
  svg.append('g').attr('transform', 'translate(0,' + (H - m.b) + ')')
    .call(d3.axisBottom(x).ticks(7).tickFormat(d3.format('d')));
  svg.append('g').attr('transform', 'translate(' + m.l + ',0)')
    .call(d3.axisLeft(y).ticks(6).tickFormat((v: any) => v + '°N'));
  svg.append('path').datum(stops)
    .attr('d', d3.line().x((d: any) => x(d.yr))
      .y((d: any) => y(d.lat)))
    .attr('fill', 'none').attr('stroke', '#8a5a2b').attr('stroke-width', 2.5);
  svg.selectAll('circle.stop').data(stops).join('circle')
    .attr('class', 'stop')
    .attr('cx', (d: any) => x(d.yr))
    .attr('cy', (d: any) => y(d.lat))
    .attr('r', 5).attr('fill', '#8a5a2b').attr('stroke', '#fff').attr('stroke-width', 2);
  svg.selectAll('text.lbl').data(stops).join('text')
    .attr('class', 'lbl')
    .attr('x', (d: any) => x(d.yr))
    .attr('y', (d: any) => y(d.lat) - 11)
    .attr('text-anchor', 'middle').attr('font-size', 10.5)
    .attr('fill', '#241f18').text((d: any) => d.n);
  svg.append('text').attr('x', W / 2).attr('y', 14)
    .attr('text-anchor', 'middle').attr('font-size', 11)
    .attr('fill', '#7b7366')
    .text('纬度剖面：由北向南的长线播迁（39.5°N → 28°N）—— 620 年出镇范阳，约 800 年（贞元）入赣，1507 年落籍双洲');
}

/* ---------------- 统计图点击放大（灯箱）—— v3.6.6:图片改为打开时才创建,页面不再带空 src 的 img ---------------- */
function initLightbox(): void {
  const lb = document.createElement('div');
  lb.className = 'lightbox';
  document.body.appendChild(lb);
  let lbImg: HTMLImageElement | null = null;
  lb.addEventListener('click', () => { lb.classList.remove('on'); });
  Array.prototype.forEach.call(
    document.querySelectorAll('.stats-details img'),
    (img: HTMLImageElement) => {
      img.title = '点击查看大图';
      img.addEventListener('click', () => {
        if (!lbImg) {
          lbImg = document.createElement('img');
          lbImg.alt = '统计大图（点击关闭）';
          lb.appendChild(lbImg);
        }
        lbImg.src = img.src;
        lb.classList.add('on');
      });
    });
}

/* ---------------- 世代人口统计交互图表（ECharts，展开时懒加载） ----------------
 * 注意：页内有多个 .stats-details（名人堂/世系统计），必须定位到包含
 * #chartGens 的那一个，否则 toggle 永远不触发、图表区一直空白 */
function initStatsCharts(): void {
  const gensBox = document.getElementById('chartGens');
  const details = gensBox ? gensBox.closest('.stats-details') as HTMLDetailsElement | null : null;
  if (!details || !window.echarts) return;
  const mapMicro = R.maps.micro as LMap;
  let done = false;
  function init(): void {
    if (done) { resize(); return; }
    done = true;
    const gens: string[] = [];
    const counts = [1, 1, 2, 3, 3, 5, 8, 15, 26, 57, 96, 84, 110, 111,
      105, 77, 68, 66, 92, 92, 47, 5];
    for (let g = 18; g <= 39; g++) gens.push(g + '世');
    /* 3.4 人口-世系双轴：柱=该世男丁数，线=累计占比（同一套数据，不另取数） */
    const total = counts.reduce((a, b) => a + b, 0);
    let run = 0;
    const cumPct = counts.map((v) => { run += v; return +(run / total * 100).toFixed(1); });
    echarts.init(document.getElementById('chartGens')).setOption({
      grid: { left: 44, right: 44, top: 34, bottom: 40 },
      tooltip: { trigger: 'axis' },
      legend: { top: 0, left: 40, itemWidth: 10, itemHeight: 8,
        textStyle: { fontSize: 11, color: '#5f5b52' }, data: ['该世男丁', '累计占比'] },
      xAxis: { type: 'category', data: gens,
        axisLabel: { fontSize: 10, interval: 0, rotate: 45 } },
      yAxis: [
        { type: 'value', name: '男丁数', nameTextStyle: { fontSize: 10 } },
        { type: 'value', name: '', max: 100, splitLine: { show: false },
          axisLabel: { fontSize: 10, formatter: '{value}%' } }
      ],
      series: [
        { name: '该世男丁', type: 'bar', data: counts, barWidth: '60%',
          itemStyle: { color: '#8a5a2b' },
          label: { show: true, position: 'top', fontSize: 9 } },
        { name: '累计占比', type: 'line', yAxisIndex: 1, data: cumPct,
          smooth: true, symbol: 'circle', symbolSize: 4,
          lineStyle: { width: 2, color: '#9d2f22' },
          itemStyle: { color: '#9d2f22' } }
      ]
    });
    const xi: Array<[string, number]> = [['禧时', 344], ['禧明', 178], ['禧选', 103], ['禧茂', 72], ['禧源', 42],
      ['禧景', 40], ['禧胜', 56], ['禧瑞', 66], ['禧曜', 18], ['禧照', 30],
      ['禧鼎', 20], ['禧旺', 8], ['禧春', 6], ['禧栟', 7], ['禧旭', 7], ['禧昶', 14]];
    xi.sort((a, b) => b[1] - a[1]);
    echarts.init(document.getElementById('chartXi')).setOption({
      grid: { left: 62, right: 46, top: 10, bottom: 22 },
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'value', name: '后裔人数', nameTextStyle: { fontSize: 10 } },
      yAxis: { type: 'category', data: xi.map((d) => d[0]),
        axisLabel: { fontSize: 10.5 } },
      series: [{ type: 'bar', data: xi.map((d) => d[1]),
        barWidth: '60%', itemStyle: { color: '#534AB7' },
        label: { show: true, position: 'right', fontSize: 9 } }]
    });
  }
  function resize(): void {
    [document.getElementById('chartGens'), document.getElementById('chartXi')]
      .forEach((el) => {
        const inst = el && echarts.getInstanceByDom(el);
        if (inst) inst.resize();
      });
  }
  details.addEventListener('toggle', () => {
    if (!details.open) return;
    setTimeout(() => {
      init();
      /* 展开使左栏变高、③号图容器随之变高，需重算瓦片 */
      mapMicro.invalidateSize();
    }, 60);
  });
}

/* ---------------- ②号窗：重走迁徙路 ---------------- */
function initJourney(): void {
  const mapChain = R.maps.chain as LMap;
  const btn = document.getElementById('btnJourney')!;
  let running = false, stop = false;
  btn.onclick = () => {
    if (running) { stop = true; return; }
    running = true; stop = false;
    btn.textContent = '⏹ 停止'; btn.classList.add('on');
    document.querySelector('.card-chain')!.scrollIntoView({ behavior: 'smooth', block: 'start' });
    let i = 0;
    (function next(): void {
      if (stop || i >= R.chainCoords.length) {
        running = false; stop = false;
        btn.textContent = '▶ 重走迁徙路（① → ⑦）'; btn.classList.remove('on');
        return;
      }
      const key = R.chainCoords[i][0] + ',' + R.chainCoords[i][1];
      const m = R.chainKeys2[key];
      mapChain.flyTo(R.chainCoords[i], i === 0 ? 7 : 8, { duration: 1.6 });
      if (m) setTimeout(() => { if (!stop) m.openPopup(); }, 1700);
      i++;
      setTimeout(next, 3200);
    })();
  };
}

export function initPanels(): void {
  initNotableCards();
  renderSpaceTime();
  initLightbox();
  initStatsCharts();
  initJourney();
}
