/* ============================================================
 * 暗夜星图飞线 nightfly —— 参考高德/百度「迁徙图」样式复刻
 * ============================================================
 * 用户参考图要素拆解(力求一致):
 *   ① 纯黑夜幕底 + 青蓝色发光省界线(CHINA_PROV DataV 省界);
 *   ② 金橙色粒子流彗尾弧线:沿线粒子群(金→橙→暗红渐变,发光,
 *      尾迹渐隐),起点爆发大光团、终点红光点;
 *   ③ 全域城市星野(青/红小点铺满,如星空)。
 * 技术:路线考(宏观图)专属「暗夜星图」模式——tile 底图隐去,独立
 * 双层 canvas(静态层:省界/星野/光团;粒子层:每帧重绘的光流),
 * 视野同步用 map.latLngToContainerPoint 每帧重投影。Leaflet 交互
 * (隐形路线弹窗/点位)全保留;时间轴按 visibleStages 过滤粒子。
 * reduced-motion:粒子静止为静态光流图。
 * ============================================================ */
import { arcPoints } from './runtime';
import { R, migr } from './runtime';
import { useAtlasStore } from '../stores/atlas';
import type { LLayer } from './types';

const NIGHT_BG = '#04060c';
const BORDER_COLOR = 'rgba(64, 148, 202, .55)';     /* 青蓝省界 */
const STAR_CYAN = 'rgba(94, 200, 230, .8)';
const STAR_RED = 'rgba(219, 78, 58, .85)';

interface NightRoute { pts: Array<[number, number]>; stage: number }
interface Particle { t: number; sp: number; sz: number }

let raf = 0;
let running = false;
let on = false;
let canvas: HTMLCanvasElement | null = null;
let ctx2d: CanvasRenderingContext2D | null = null;
let staticLayer: HTMLCanvasElement | null = null;   /* 静态层:省界+星野+光团 */
let staticCtx: CanvasRenderingContext2D | null = null;
let nightRoutes: NightRoute[] = [];
let starPts: Array<{ latlng: [number, number]; red: boolean }> = [];
let provinceLayer: LLayer | null = null;
let started = false;

/* 路线弧缓存与粒子群 */
const flows: Array<{ pts: Array<Array<[number, number]>>; stage: number; parts: Particle[]; hueShift: number }> = [];

function dprSize(cv: HTMLCanvasElement, w: number, h: number): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = Math.round(w * dpr);
  cv.height = Math.round(h * dpr);
  cv.style.width = w + 'px';
  cv.style.height = h + 'px';
  const c = cv.getContext('2d');
  if (c) c.setTransform(dpr, 0, 0, dpr, 0, 0);
}

/* ---------- 静态层:黑幕上的省界与星野、起点光团 ---------- */
function paintStatic(): void {
  if (!staticCtx || !canvas) return;
  const w = parseFloat(canvas.style.width), h = parseFloat(canvas.style.height);
  const map = R.maps.macro!;
  staticCtx.clearRect(0, 0, w, h);
  /* 省界:青蓝发光细线 */
  staticCtx.lineWidth = 1;
  staticCtx.strokeStyle = BORDER_COLOR;
  staticCtx.shadowColor = 'rgba(64, 148, 202, .8)';
  staticCtx.shadowBlur = 5;
  const prov = (window as unknown as { CHINA_PROV?: { features: Array<{ geometry: { type: string; coordinates: number[][][][] | number[][][] } }> } }).CHINA_PROV;
  if (prov) {
    for (const f of prov.features) {
      const g = f.geometry;
      const polys = (g.type === 'MultiPolygon' ? g.coordinates : [g.coordinates]) as number[][][][];
      for (const poly of polys) for (const ring of poly) {
        staticCtx.beginPath();
        for (let i = 0; i < ring.length; i++) {
          const pt = ring[i];
          const p = map.latLngToContainerPoint([pt[1], pt[0]]);
          if (i === 0) staticCtx!.moveTo(p.x, p.y);
          else staticCtx!.lineTo(p.x, p.y);
        }
        staticCtx.stroke();
      }
    }
  }
  staticCtx.shadowBlur = 0;
  /* 城市星野 */
  for (const s of starPts) {
    const p = map.latLngToContainerPoint(s.latlng);
    staticCtx.fillStyle = s.red ? STAR_RED : STAR_CYAN;
    staticCtx.globalAlpha = s.red ? .85 : .55;
    staticCtx.beginPath();
    staticCtx.arc(p.x, p.y, s.red ? 2.2 : 1.4, 0, Math.PI * 2);
    staticCtx.fill();
  }
  staticCtx.globalAlpha = 1;
  /* 起点爆发光团(每条弧的起点):径向金橙辉光 */
  for (const fl of flows) {
    if (!visible(fl.stage)) continue;
    const a = fl.pts[0][0];
    const p = map.latLngToContainerPoint([a[0], a[1]]);
    const g = staticCtx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 26);
    g.addColorStop(0, 'rgba(255, 240, 190, .95)');
    g.addColorStop(0.35, 'rgba(255, 186, 84, .55)');
    g.addColorStop(1, 'rgba(255, 140, 40, 0)');
    staticCtx.fillStyle = g;
    staticCtx.beginPath();
    staticCtx.arc(p.x, p.y, 26, 0, Math.PI * 2);
    staticCtx.fill();
    /* 终点红光点 */
    const b = fl.pts[0][fl.pts[0].length - 1];
    const pe = map.latLngToContainerPoint([b[0], b[1]]);
    staticCtx.fillStyle = 'rgba(232, 74, 52, .95)';
    staticCtx.shadowColor = 'rgba(232, 74, 52, .8)';
    staticCtx.shadowBlur = 7;
    staticCtx.beginPath();
    staticCtx.arc(pe.x, pe.y, 3, 0, Math.PI * 2);
    staticCtx.fill();
    staticCtx.shadowBlur = 0;
  }
}

function visible(stage: number): boolean {
  const store = useAtlasStore();
  return !!(store.visibleStages && store.visibleStages[stage]);
}

/* ---------- 粒子层:金橙光流 ---------- */
function paintParticles(now: number, dt: number): void {
  if (!ctx2d || !canvas) return;
  const w = parseFloat(canvas.style.width), h = parseFloat(canvas.style.height);
  ctx2d.clearRect(0, 0, w, h);
  const map = R.maps.macro!;
  ctx2d.globalCompositeOperation = 'lighter';
  for (const fl of flows) {
    if (!visible(fl.stage)) continue;
    const curve = fl.pts[0];
    /* 粒子推进 */
    for (const pt of fl.parts) pt.t = (pt.t + dt * pt.sp) % 1;
    /* 弧线本体光晕(三层:外晕/中晕/亮芯) */
    ctx2d.lineCap = 'round';
    const drawLine = (width: number, alpha: number, blur: number, color: string): void => {
      ctx2d!.lineWidth = width;
      ctx2d!.strokeStyle = color;
      ctx2d!.globalAlpha = alpha;
      ctx2d!.shadowColor = 'rgba(255, 170, 60, ' + alpha + ')';
      ctx2d!.shadowBlur = blur;
      ctx2d!.beginPath();
      curve.forEach((pt, i) => {
        const p = map.latLngToContainerPoint([pt[0], pt[1]]);
        if (i === 0) ctx2d!.moveTo(p.x, p.y);
        else ctx2d!.lineTo(p.x, p.y);
      });
      ctx2d!.stroke();
      ctx2d!.shadowBlur = 0;
    };
    drawLine(6.5, .1, 18, 'rgba(255, 150, 40, 1)');
    drawLine(3.2, .3, 10, 'rgba(255, 176, 70, 1)');
    drawLine(1.4, .8, 4, 'rgba(255, 226, 150, 1)');
    /* 粒子群:沿弧流动的光点,带渐隐尾迹 */
    for (const pt of fl.parts) {
      const t0 = pt.t;
      for (let k = 0; k < 5; k++) {
        const tk = t0 - k * 0.012 * pt.sp;
        if (tk < 0) continue;
        const pos = curveAt(curve, tk);
        const p = map.latLngToContainerPoint([pos[0], pos[1]]);
        const fade = (1 - k / 5) * (0.35 + 0.65 * Math.min(1, tk * 6));
        ctx2d!.globalAlpha = fade;
        ctx2d!.fillStyle = k === 0 ? 'rgba(255, 244, 200, 1)' : 'rgba(255, ' + Math.round(190 - k * 24) + ', 90, 1)';
        ctx2d!.shadowColor = 'rgba(255, 170, 60, .9)';
        ctx2d!.shadowBlur = k === 0 ? 9 : 4;
        ctx2d!.beginPath();
        ctx2d!.arc(p.x, p.y, pt.sz * (1 - k * 0.18), 0, Math.PI * 2);
        ctx2d!.fill();
      }
    }
    ctx2d!.globalAlpha = 1;
    ctx2d!.globalCompositeOperation = 'source-over';
  }
}

function curveAt(curve: Array<[number, number]>, t: number): [number, number] {
  const clamped = Math.min(0.9999, Math.max(0, t));
  const f = clamped * (curve.length - 1);
  const i = Math.floor(f), frac = f - i;
  const a = curve[i], b = curve[Math.min(curve.length - 1, i + 1)];
  return [a[0] + (b[0] - a[0]) * frac, a[1] + (b[1] - a[1]) * frac];
}

/* ---------- 帧循环与同步 ---------- */
let lastFrame = 0;
function frame(now: number): void {
  if (!running || !on) return;
  const dt = Math.min(0.05, (now - lastFrame) / 1000 || 0.016);
  lastFrame = now;
  paintParticles(now, dt);
  raf = requestAnimationFrame(frame);
}

function start(): void {
  if (running || !on) return;
  running = true;
  lastFrame = performance.now();
  raf = requestAnimationFrame(frame);
}
function stop(): void {
  running = false;
  cancelAnimationFrame(raf);
}

function setNight(on_: boolean): void {
  on = on_;
  const mapEl = document.getElementById('mapMacro');
  if (!mapEl || !canvas || !staticLayer) return;
  mapEl.classList.toggle('nightfly', on_);
  /* 场景级联动:路线考整章随暗夜模式转暗卡(排版重构后的 HUD/叙事卡) */
  const scene = document.getElementById('sceneMacro');
  if (scene) scene.classList.toggle('nightfly-scene', on_);
  staticLayer.style.display = on_ ? '' : 'none';
  canvas.style.display = on_ ? '' : 'none';
  if (on_) {
    resize();
    paintStatic();
    start();
  } else {
    stop();
  }
}

function resize(): void {
  const mapEl = document.getElementById('mapMacro');
  if (!mapEl || !canvas || !staticLayer) return;
  const r = mapEl.getBoundingClientRect();
  dprSize(canvas, r.width, r.height);
  dprSize(staticLayer, r.width, r.height);
  paintStatic();
}

export function initNightFly(): void {
  const map = R.maps.macro;
  if (!map || started) return;
  started = true;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const M = migr();
  const store = useAtlasStore();

  /* 弧数据:33 段路线 → 贝塞尔凸弧(与 Leaflet 层同款形态) */
  const macroFc = R.macroLayers.routes;
  nightRoutes = [];
  let fi = 0;
  if (macroFc) {
    macroFc.eachLayer((l: LLayer) => {
      const pts = l.getLatLngs ? l.getLatLngs() : null;
      if (pts && pts.length > 2 && l.options && l.options.className === 'comet-int') {
        nightRoutes.push({ pts: pts.map((ll: { lat: number; lng: number }) => [ll.lat, ll.lng]), stage: l._stage });
      }
    });
  }
  if (!nightRoutes.length) return;

  /* 双层 canvas:静态层(省界/星野/光团)在粒子层之下 */
  const mapEl = document.getElementById('mapMacro')!;
  staticLayer = document.createElement('canvas');
  staticLayer.className = 'nightfly-static';
  staticLayer.setAttribute('aria-hidden', 'true');
  canvas = document.createElement('canvas');
  canvas.className = 'nightfly-particles';
  canvas.setAttribute('aria-hidden', 'true');
  mapEl.appendChild(staticLayer);
  mapEl.appendChild(canvas);
  staticCtx = staticLayer.getContext('2d');
  ctx2d = canvas.getContext('2d');

  /* 星野:全国点位(青=一般,红=本支迁居地) */
  starPts = M.nationalPlaces.features.map((f) => ({
    latlng: [f.geometry.coordinates[1], f.geometry.coordinates[0]] as [number, number],
    red: f.properties.stage != null && f.properties.stage >= 4,
  }));

  /* 粒子群:每弧 ~18 粒,速度/大小随机 */
  flows.length = 0;
  nightRoutes.forEach((r, i) => {
    const parts: Particle[] = [];
    const n = 14 + Math.round(Math.random() * 8);
    for (let j = 0; j < n; j++) {
      parts.push({ t: Math.random(), sp: 0.05 + Math.random() * 0.09, sz: 1.4 + Math.random() * 1.8 });
    }
    flows.push({ pts: [r.pts], stage: r.stage, parts: parts, hueShift: i });
  });

  /* 省界青线:Leaflet geoJSON 层(暗夜模式显示) */
  const prov = (window as unknown as { CHINA_PROV?: unknown; L?: unknown }).CHINA_PROV;
  if (prov) {
    provinceLayer = (window as unknown as { L: { geoJSON: (d: unknown, o?: unknown) => LLayer } }).L.geoJSON(prov, {
      style: () => ({ color: BORDER_COLOR, weight: 1, opacity: .8, fill: false, interactive: false })
    });
  }

  /* 视野同步:每帧粒子重投影已覆盖;静态层在 move/zoom 后重绘 */
  map.on('moveend zoomend resize', () => { if (on) { resize(); } });
  map.on('move zoom', () => { if (on) paintStatic(); });

  window.addEventListener('resize', () => { if (on) resize(); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else if (on) start();
  });

  /* 默认开启(路线考专属氛围);图层管理区加开关 */
  const lbl = document.createElement('label');
  lbl.className = 'switchline';
  lbl.style.marginTop = '6px';
  lbl.innerHTML = '<input type="checkbox" id="chkNight" checked>暗夜星图（迁徙飞线氛围）';
  const chk = lbl.querySelector('#chkNight') as HTMLInputElement;
  chk.onchange = () => { setNight(chk.checked); };
  /* 开关塞进①号图图层盒(与 chkJwhd 等同列,若存在) */
  const box = document.querySelector('.switchline') && (document.querySelector('.switchline') as HTMLElement).parentElement;
  if (box) box.appendChild(lbl);
  else document.body.appendChild(lbl);

  setNight(true);
  if (reduce.matches) {
    /* 静态:粒子推一帧定格,不循环 */
    stop();
    paintParticles(performance.now(), 0);
  }
}
