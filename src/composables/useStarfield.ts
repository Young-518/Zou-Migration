/* ============================================================
 * 迁徙星图 —— 改造探索·收束幕
 * ============================================================
 * canvas 星图(react-bits Particles/Galaxy 手法移植为原生实现):
 *   - 七颗主星按七站**实测经纬等比**布列(数据同 static-migr chainPlaces);
 *   - 六段星轨逐段点亮(入幕 stagger),微星背景缓漂+闪烁;
 *   - CountUp 数字滚动(.sf-n[data-count]);
 *   - IntersectionObserver 入幕才启动 rAF,离幕即停;
 *   - reduced-motion:静置一帧(主星+星轨全亮)+数字直显。
 * ============================================================ */

/* 七站实测经纬(与 sections/05-journey.html 档案同源,《雙洲鄒氏族譜注》) */
const STARS: Array<{ name: string; lng: number; lat: number }> = [
  { name: '萊州·東魯', lng: 119.9414, lat: 37.1789 },
  { name: '范陽', lng: 115.9806, lat: 39.4862 },
  { name: '光州', lng: 115.051, lat: 32.1347 },
  { name: '宜黃', lng: 116.284, lat: 27.5546 },
  { name: '埮坪', lng: 115.9, lat: 27.6 },
  { name: '湖邊', lng: 115.3948, lat: 27.7404 },
  { name: '雙洲', lng: 115.40551, lat: 27.92532 },
];
const LINES: Array<[number, number]> = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6]];
const LNG_MIN = 114.8, LNG_MAX = 120.4, LAT_MIN = 27.2, LAT_MAX = 40.2;

const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

interface Dot { x: number; y: number; r: number; ph: number; sp: number }

export function initStarfield(): void {
  const sec = document.getElementById('starfield');
  if (!sec) return;
  const canvas = sec.querySelector<HTMLCanvasElement>('.sf-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const labels = sec.querySelector<HTMLElement>('.sf-labels');
  const nums = Array.from(sec.querySelectorAll<HTMLElement>('.sf-n'));
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  let w = 0, h = 0, dpr = 1;
  let dots: Dot[] = [];
  let raf = 0;
  let running = false;
  let t0 = 0;
  /* 星轨点亮进度:0-1(入幕时由时间驱动) */
  let linesProgress = reduce.matches ? 1 : 0;

  function layout(): void {
    const rect = sec!.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = Math.max(rect.width, 320);
    h = Math.max(rect.height, 480);
    canvas!.width = Math.round(w * dpr);
    canvas!.height = Math.round(h * dpr);
    canvas!.style.width = w + 'px';
    canvas!.style.height = h + 'px';
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    /* 微星 */
    const n = Math.round((w * h) / 16000);
    dots = Array.from({ length: n }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: 0.4 + Math.random() * 1.1,
      ph: Math.random() * Math.PI * 2,
      sp: 0.2 + Math.random() * 0.8,
    }));
    placeLabels();
  }

  /* 经纬 → 画布坐标(等比,留边) */
  function proj(lng: number, lat: number): [number, number] {
    const padX = Math.max(56, w * 0.09);
    const padY = Math.max(64, h * 0.13);
    const x = padX + ((lng - LNG_MIN) / (LNG_MAX - LNG_MIN)) * (w - padX * 2);
    const y = padY + ((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * (h - padY * 2);
    return [x, y];
  }

  function placeLabels(): void {
    if (!labels) return;
    labels.innerHTML = '';
    /* 湖邊/雙洲实测距离近,湖邊标签放星点左侧防重叠,其余右侧 */
    for (let i = 0; i < STARS.length; i++) {
      const s = STARS[i];
      const [x, y] = proj(s.lng, s.lat);
      const el = document.createElement('span');
      el.className = 'sf-star-name';
      el.textContent = s.name;
      if (i === 5) el.dataset.side = 'left';
      el.style.left = x + 'px';
      el.style.top = y + 'px';
      labels.appendChild(el);
    }
  }

  function draw(now: number): void {
    const t = (now - t0) / 1000;
    if (!reduce.matches) linesProgress = Math.min(1, linesProgress + 0.008);
    ctx!.clearRect(0, 0, w, h);

    /* 微星 */
    for (const d of dots) {
      const tw = reduce.matches ? 0.6 : 0.45 + 0.4 * Math.sin(t * d.sp + d.ph);
      ctx!.globalAlpha = 0.32 * tw;
      ctx!.fillStyle = '#e9e2d0';
      ctx!.beginPath();
      ctx!.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx!.fill();
    }
    ctx!.globalAlpha = 1;

    /* 星轨(六段,朱砂渐亮) */
    for (let i = 0; i < LINES.length; i++) {
      const seg = Math.min(1, Math.max(0, linesProgress * LINES.length - i));
      if (seg <= 0) break;
      const [a, b] = LINES[i];
      const [x1, y1] = proj(STARS[a].lng, STARS[a].lat);
      const [x2, y2] = proj(STARS[b].lng, STARS[b].lat);
      ctx!.strokeStyle = 'rgba(157, 47, 34, ' + (0.26 + 0.4 * seg) + ')';
      ctx!.lineWidth = 1.4;
      ctx!.setLineDash([5, 6]);
      ctx!.lineDashOffset = -((t * 14) % 22);
      ctx!.beginPath();
      ctx!.moveTo(x1, y1);
      ctx!.lineTo(x1 + (x2 - x1) * easeOutCubic(seg), y1 + (y2 - y1) * easeOutCubic(seg));
      ctx!.stroke();
      ctx!.setLineDash([]);
    }

    /* 主星(七曜) */
    STARS.forEach((s, i) => {
      const [x, y] = proj(s.lng, s.lat);
      const showAt = i / STARS.length;
      const born = Math.min(1, Math.max(0, linesProgress * (STARS.length + 1) - showAt * STARS.length));
      if (born <= 0) return;
      const pulse = reduce.matches ? 1 : 1 + 0.08 * Math.sin(t * 1.3 + i * 1.7);
      const r = (4.6 + (i === STARS.length - 1 ? 2.2 : 0)) * pulse * easeOutCubic(born);
      const g = ctx!.createRadialGradient(x, y, 0, x, y, r * 3.4);
      g.addColorStop(0, 'rgba(157, 47, 34, .5)');
      g.addColorStop(1, 'rgba(157, 47, 34, 0)');
      ctx!.fillStyle = g;
      ctx!.beginPath();
      ctx!.arc(x, y, r * 3.4, 0, Math.PI * 2);
      ctx!.fill();
      ctx!.fillStyle = '#8f2618';
      ctx!.beginPath();
      ctx!.arc(x, y, r, 0, Math.PI * 2);
      ctx!.fill();
      ctx!.fillStyle = '#f4f2ec';
      ctx!.beginPath();
      ctx!.arc(x - r * 0.22, y - r * 0.24, r * 0.3, 0, Math.PI * 2);
      ctx!.fill();
    });
  }

  function loop(now: number): void {
    draw(now);
    if (running) raf = requestAnimationFrame(loop);
  }
  function start(): void {
    if (running) return;
    running = true;
    t0 = performance.now();
    raf = requestAnimationFrame(loop);
  }
  function stop(): void {
    running = false;
    cancelAnimationFrame(raf);
  }

  /* CountUp */
  function runCounts(): void {
    for (const el of nums) {
      const target = Number(el.dataset.count || '0');
      if (reduce.matches) { el.textContent = String(target); continue; }
      const dur = 1500;
      const s = performance.now();
      const tick = (now: number): void => {
        const p = Math.min(1, (now - s) / dur);
        el.textContent = String(Math.round(target * easeOutCubic(p)));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
  }

  /* 入幕启动 / 离幕即停(一次性触发数字与星轨) */
  let fired = false;
  const io = new IntersectionObserver((ents) => {
    for (const en of ents) {
      if (en.isIntersecting) {
        start();
        if (!fired) { fired = true; linesProgress = reduce.matches ? 1 : 0.001; runCounts(); }
      } else {
        stop();
      }
    }
  }, { threshold: 0.25 });
  io.observe(sec);

  window.addEventListener('resize', () => { layout(); draw(performance.now()); });
  layout();
  if (reduce.matches) draw(performance.now());
}
