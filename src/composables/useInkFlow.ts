/* ============================================================
 * 墨晕层 useInkFlow —— 改造探索·全页氛围
 * ============================================================
 * 借鉴 PavelDoGreat/WebGL-Fluid-Simulation(MIT,鼠标流体交互)之
 * 「墨在水中晕开」概念,作轻量 2D 实现:
 *   - fixed 全页 canvas,mix-blend-mode:multiply 叠于内容之上
 *     (墨滴落在纸上压暗底下内容,即「宣纸晕墨」观感);
 *   - 指针移动依速度撒墨滴:预渲染墨晕 sprite 合成(半径缓扩、
 *     极慢漂移、alpha 衰减),上限 70 滴,墨色即页面墨色;
 *   - 空闲时低频「环境墨」(2.6-4.2s 一滴),页面常保持生命感;
 *   - reduced-motion:不建层;页签隐藏暂停;DPR 适配。
 * 对比度底线(craft-floor):墨滴 alpha ≤0.10,不伤正文可读。
 * ============================================================ */

const INK = '36, 31, 24';            /* 全站墨色 #241f18 */
const MAX_DROPS = 70;
const MAX_ALPHA = 0.1;

interface Drop {
  x: number; y: number;
  r0: number; r1: number;            /* 起始/目标半径 */
  a0: number;                        /* 起始 alpha */
  life: number;                      /* 已存活 ms */
  ttl: number;                       /* 总寿命 ms */
  vx: number; vy: number;            /* 极慢漂移 */
  seed: number;
}

export function initInkFlow(): void {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (reduce.matches) return;
  if (document.getElementById('inkFlow')) return;

  const canvas = document.createElement('canvas');
  canvas.id = 'inkFlow';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  let w = 0, h = 0, dpr = 1;
  let drops: Drop[] = [];
  let lastPointer = 0;
  let lastX = -1, lastY = -1;
  let lastEnv = 0;
  let nextEnvGap = 3000;
  let raf = 0;
  let running = false;

  /* 预渲染墨晕 sprite:三团不规则子圆叠加,一次成本,终身受益 */
  const SPRITE = 160;
  const sprite = document.createElement('canvas');
  sprite.width = SPRITE;
  sprite.height = SPRITE;
  (function paintSprite(): void {
    const sc = sprite.getContext('2d');
    if (!sc) return;
    const blob = (bx: number, by: number, br: number, ba: number): void => {
      const g = sc.createRadialGradient(bx, by, 0, bx, by, br);
      g.addColorStop(0, 'rgba(' + INK + ',' + ba + ')');
      g.addColorStop(0.55, 'rgba(' + INK + ',' + ba * 0.5 + ')');
      g.addColorStop(1, 'rgba(' + INK + ',0)');
      sc.fillStyle = g;
      sc.beginPath();
      sc.arc(bx, by, br, 0, Math.PI * 2);
      sc.fill();
    };
    blob(80, 80, 74, 0.5);
    blob(62, 70, 46, 0.34);
    blob(96, 94, 38, 0.28);
  })();

  function layout(): void {
    dpr = Math.min(window.devicePixelRatio || 1, 1.6);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas!.width = Math.round(w * dpr);
    canvas!.height = Math.round(h * dpr);
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function spawn(x: number, y: number, speed: number): void {
    if (drops.length >= MAX_DROPS) drops.shift();
    const big = Math.min(1, speed / 900);
    drops.push({
      x: x + (Math.random() - 0.5) * 18,
      y: y + (Math.random() - 0.5) * 18,
      r0: 26 + big * 30,
      r1: 64 + big * 120,
      a0: 0.05 + big * 0.05,
      life: 0,
      ttl: 2600 + Math.random() * 1800,
      vx: (Math.random() - 0.5) * 8,
      vy: -2 - Math.random() * 7,      /* 墨微向上洇,如纸上渗透 */
      seed: Math.random() * Math.PI * 2,
    });
  }

  function frame(now: number): void {
    if (!running) return;
    /* 环境墨:空闲越久越可能落一滴 */
    if (now - lastPointer > 2600 && now - lastEnv > nextEnvGap) {
      lastEnv = now;
      nextEnvGap = 2600 + Math.random() * 1600;
      spawn(w * (0.12 + Math.random() * 0.76), h * (0.14 + Math.random() * 0.7), 120);
    }
    ctx!.clearRect(0, 0, w, h);
    drops = drops.filter((d) => d.life < d.ttl);
    for (const d of drops) {
      d.life += 16.7;
      const p = d.life / d.ttl;
      const grow = 1 - Math.pow(1 - Math.min(1, p * 1.6), 3);   /* 前段快扩后段缓 */
      const r = d.r0 + (d.r1 - d.r0) * grow;
      const a = d.a0 * (1 - p) * (1 - p);
      if (a <= 0.002) continue;
      d.x += d.vx * 0.0167;
      d.y += d.vy * 0.0167;
      ctx!.globalAlpha = a;
      const wob = Math.sin(d.seed + d.life / 900) * r * 0.06;
      ctx!.drawImage(sprite, d.x - r + wob, d.y - r, r * 2, r * 2);
    }
    ctx!.globalAlpha = 1;
    raf = requestAnimationFrame(frame);
  }

  function start(): void {
    if (running) return;
    running = true;
    raf = requestAnimationFrame(frame);
  }
  function stop(): void {
    running = false;
    cancelAnimationFrame(raf);
  }

  function onPointer(e: PointerEvent): void {
    const now = performance.now();
    if (lastX >= 0) {
      const dt = Math.max(8, now - lastPointer);
      const speed = Math.hypot(e.clientX - lastX, e.clientY - lastY) / dt * 1000;
      /* 速度阈值:快扫多撒,慢移少撒 */
      if (speed > 60 && Math.random() < 0.55) spawn(e.clientX, e.clientY, speed);
    }
    lastX = e.clientX;
    lastY = e.clientY;
    lastPointer = now;
  }

  window.addEventListener('resize', layout);
  window.addEventListener('pointermove', onPointer, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else start();
  });
  layout();
  start();
}
