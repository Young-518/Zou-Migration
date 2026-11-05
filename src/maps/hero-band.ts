/* Hero 首屏组件 —— 第四阶段:由 legacy-ports/app.ts「Hero 首屏:暗色中国地图 + 金色迁徙主轴」分解。
 * 职责:heroMap 内 D3 SVG 省面(china-outline 线性投影)+ Canvas 粒子迁徙系统
 *       (路线晕线/光点拖尾/节点呼吸光晕)、IntersectionObserver 可见性停帧、
 *       heroPlay CTA(滚到热度区并联动热区播放器)。
 * 顺序锚点:在图层管理器之后、字辈条之前调用(原文本序)。 */
import { heatTimerActive } from './heat-map';

interface HeroNode {
  name: string;
  lng: number;
  lat: number;
  key?: boolean;
  vx?: number;
  vy?: number;
}

export function initHeroBand(): void {
  const el = document.getElementById('heroMap');
  if (!el || !window.d3 || !window.CHINA_PROV) return;
  /* 底图：china-outline.svg（DataV.GeoAtlas 官方国界精确轮廓，等比例线性映射
   * 73-135°E / 54-9.36°N → 1000×720，1°=1000/62px，两轴同比例无变形） */
  const VBW = 1000, VBH = 720, DPP = 1000 / 62; /* 每度像素（经纬同比例） */
  function hp(lng: number, lat: number): [number, number] {
    return [(lng - 73) * DPP, (54 - lat) * DPP];
  }
  const svg = d3.select(el).append('svg')
    .attr('viewBox', '0 0 ' + VBW + ' ' + VBH)
    .attr('preserveAspectRatio', 'xMidYMid meet')
    .style('width', '100%').style('height', '100%')
    .style('display', 'block');
  /* 省级区划面：与底图同一线性投影，半透明马赛克透出国界 */
  const hproj = d3.geoTransform({ point(x: number, y: number): void {
    this.stream.point((x - 73) * DPP, (54 - y) * DPP);
  }});
  const HERO_PALETTE = ['#42586f', '#3a4f68', '#40566d', '#3c5268', '#465d74',
    '#3e546a', '#485f76', '#3b5168', '#425a70', '#3d546b', '#415870', '#3d566c'];
  svg.selectAll('path.prov').data((window.CHINA_PROV as { features: unknown[] }).features).join('path')
    .attr('class', 'prov').attr('d', d3.geoPath(hproj))
    .attr('fill', (d: any) => {
      const p = d.properties;
      let i = 0;
      for (let k = 0; k < p.name.length; k++) i += p.name.charCodeAt(k) * 7;
      return HERO_PALETTE[i % HERO_PALETTE.length];
    })
    .attr('fill-opacity', .5)
    .attr('stroke', '#74889e').attr('stroke-width', .7).attr('stroke-opacity', .5);
  /* ---- Canvas 粒子迁徙系统（学习寻根路 MigrationParticles 的实现） ---- */
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;';
  el.appendChild(canvas);
  const cctx = canvas.getContext('2d')!;
  /* 迁徙节点（据调查报告整理；与主轴"邹城→范阳/豫鄂→苏浙皖赣→闽→粤桂→湘鄂→川渝台"对应） */
  const NODES: HeroNode[] = [
    { name: '邹城', lng: 116.9734, lat: 35.4047, key: true },
    { name: '范阳·涿州', lng: 115.9806, lat: 39.4862, key: true },
    { name: '商丘', lng: 115.6219, lat: 34.4101 },
    { name: '南阳', lng: 112.5283, lat: 32.9908 },
    { name: '光州·潢川', lng: 115.0500, lat: 32.1300 },
    { name: '常州', lng: 119.9500, lat: 31.7800 },
    { name: '宜黄', lng: 116.2840, lat: 27.5546 },
    { name: '泰宁', lng: 117.1780, lat: 26.8990 },
    { name: '平乐', lng: 110.6400, lat: 24.6300 },
    { name: '广州', lng: 113.2600, lat: 23.1300 },
    { name: '长沙', lng: 112.9400, lat: 28.2300 },
    { name: '成都', lng: 104.0657, lat: 30.6598 },
    { name: '台湾·台南', lng: 120.2100, lat: 23.0000 },
    { name: '双洲·樟树', lng: 115.4055, lat: 27.9253, key: true }
  ];
  const nodeByName: Record<string, HeroNode> = {};
  NODES.forEach((n) => { nodeByName[n.name] = n; });
  /* 迁徙路网（节点对）：方向依报告——姓源自商丘食采于邹；
   * 秦汉北出范阳、西入豫鄂；永嘉南渡（范阳→常州）与
   * 本支南迁（范阳→光州→宜黄→双洲，依族谱注）；两宋泰宁入粤入桂；
   * 明清江西填湖广、湖广填四川；清代渡台 */
  /* 元素为 [起点, 终点] 数组对,并挂 ax/ay/bx/by/len 投影字段(与原实现一致) */
  const ROUTES: any[] = [
    ['商丘', '邹城'], ['邹城', '范阳·涿州'], ['邹城', '南阳'],
    ['范阳·涿州', '常州'], ['范阳·涿州', '光州·潢川'], ['光州·潢川', '宜黄'],
    ['宜黄', '双洲·樟树'], ['宜黄', '泰宁'], ['泰宁', '广州'], ['泰宁', '平乐'],
    ['广州', '台湾·台南'], ['双洲·樟树', '长沙'], ['长沙', '成都']
  ].map((r: string[]) => [nodeByName[r[0]], nodeByName[r[1]]]);
  /* viewBox 坐标 → 画布坐标（与省面 SVG 同投影）；rect 每帧缓存一次 */
  let curRect = { width: 1200, height: 480 };
  /* v2.2：必须用布局尺寸——getBoundingClientRect() 会含 Hero 推近的 scale()，
     导致投影比例被放大、再被 CSS 二次缩放，标注与路线随滚动外漂 */
  function refreshRect(): void {
    curRect = { width: el!.offsetWidth, height: el!.offsetHeight };
  }
  function vb2canvas(x: number, y: number): [number, number] {
    const k = Math.min(curRect.width / 1000, curRect.height / 720);
    return [(curRect.width - 1000 * k) / 2 + x * k, (curRect.height - 720 * k) / 2 + y * k];
  }
  function sizeCanvas(): void {
    refreshRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = curRect.width * dpr;
    canvas.height = curRect.height * dpr;
    cctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  /* 预计算节点与路线的 viewBox 投影坐标 */
  NODES.forEach((n) => {
    const p = hp(n.lng, n.lat);
    n.vx = p[0]; n.vy = p[1];
  });
  ROUTES.forEach((r: any) => {
    r.ax = r[0].vx; r.ay = r[0].vy;
    r.bx = r[1].vx; r.by = r[1].vy;
    r.len = Math.hypot(r.bx - r.ax, r.by - r.ay);
  });
  /* 粒子：每条路线按长度分配，沿段匀速推进 */
  const PARTICLES: Array<{ route: any; p: number; speed: number }> = [];
  ROUTES.forEach((r: any) => {
    const n = Math.max(3, Math.round(r.len / 60));
    for (let i = 0; i < n; i++) {
      PARTICLES.push({ route: r, p: i / n, speed: 40 / r.len /* 40px/s */ });
    }
  });
  let lastT = Date.now(), heatVisible = true;
  if (window.IntersectionObserver) {
    new IntersectionObserver((es) => {
      es.forEach((e) => { heatVisible = e.isIntersecting; });
    }, { threshold: .05 }).observe(el);
  }
  window.addEventListener('resize', sizeCanvas);
  if (window.ResizeObserver) {
    new ResizeObserver(() => { sizeCanvas(); }).observe(el);
  } else {
    setInterval(sizeCanvas, 800);
  }
  function drawFrame(): void {
    const now = Date.now(), dt = Math.min(50, now - lastT) / 1000;
    lastT = now;
    if (heatVisible) {
      const rect = curRect;
      cctx.clearRect(0, 0, rect.width, rect.height);
      /* 1. 路线晕线 */
      cctx.strokeStyle = 'rgba(200,161,101,.13)';
      cctx.lineWidth = 1;
      ROUTES.forEach((r: any) => {
        const a = vb2canvas(r.ax, r.ay), b = vb2canvas(r.bx, r.by);
        cctx.beginPath(); cctx.moveTo(a[0], a[1]); cctx.lineTo(b[0], b[1]); cctx.stroke();
      });
      /* 2. 粒子（光点 + 渐隐拖尾） */
      PARTICLES.forEach((pt) => {
        pt.p += pt.speed * dt;
        if (pt.p > 1) pt.p -= 1;
        for (let s = 0; s < 4; s++) {
          const q = pt.p - s * .018;
          if (q < 0) continue;
          const ap = vb2canvas(pt.route.ax + (pt.route.bx - pt.route.ax) * q,
            pt.route.ay + (pt.route.by - pt.route.ay) * q);
          cctx.beginPath();
          cctx.arc(ap[0], ap[1], s === 0 ? 2.2 : 1.6 - s * .35, 0, Math.PI * 2);
          cctx.fillStyle = 'rgba(243,217,145,' + (s === 0 ? .95 : .5 - s * .12) + ')';
          cctx.fill();
        }
      });
      /* 3. 节点：呼吸光晕（v2.7 起 hero 内一律不出字——14 个地名会与标题、
            副标题、统计数字叠字；三处关键节点改由图例 .hero-legend 说明） */
      NODES.forEach((n) => {
        const c = vb2canvas(n.vx as number, n.vy as number);
        const o = Math.sin(now / 1500 + n.lng) * .3 + .7;
        cctx.beginPath();
        cctx.arc(c[0], c[1], 4 + o * 3, 0, Math.PI * 2);
        cctx.fillStyle = 'rgba(200,161,101,' + (.3 + o * .3) + ')';
        cctx.fill();
        cctx.beginPath();
        cctx.arc(c[0], c[1], 2.4, 0, Math.PI * 2);
        cctx.fillStyle = '#f3d991';
        cctx.fill();
      });
    }
    requestAnimationFrame(drawFrame);
  }
  sizeCanvas();
  requestAnimationFrame(drawFrame);
  /* CTA 行为 */
  document.getElementById('heroPlay')!.onclick = () => {
    document.querySelector('.row-heat')!.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => {
      const b = document.getElementById('btnHeatPlay');
      if (b && !heatTimerActive()) b.click();
    }, 900);
  };
}
