/* 序章热区图组件 —— 第四阶段:由 legacy-ports/app.ts「序章:邹氏全国分布热区 · 时空动图」分解。
 * 职责:mapHeat 创建、省份热区面(paint-order SVG 标注)、四支系开关(写入 Pinia
 *       atlas.branchSel,即 window._zou.branchSel 注册的同一对象)、时期滑杆/前后切换/
 *       播放器、applyHeat 应用逻辑。
 * 顺序锚点:由编排器在 startArrowLoop() 之后、宏观图之前调用(原文本序)。
 * Leaflet 自定义 pane 类名纪律:chainPane = leaflet-chain-pane(本组件无自定义 pane)。 */
import { useLeafletMap } from '../composables/useLeafletMap';
import { useAtlasStore, type BranchKey } from '../stores/atlas';
import { R, esc, migr } from './runtime';
import type { HeatEntry, LLayer, LMap } from './types';

/** 支系名映射(数据侧 b 为 'cao'/'zi'/'yao'/'si' 字符串) */
const BRANCH_NAMES: Record<string, string> = { cao: '曹姓邾国系', zi: '子姓宋国系', yao: '姚姓邹屠系', si: '姒姓越国系' };

const HEAT_COLORS: Record<number, string> = { 0: '#f5efdf', 1: '#e8cfa8', 2: '#cf9d62', 3: '#a55f2b' };
const HEAT_TEXT: Record<number, string> = { 0: '暂无记载', 1: '初步分布', 2: '聚居发展', 3: '核心聚集区' };

const BK_MAP: Record<string, BranchKey> = { bkCao: 'cao', bkZi: 'zi', bkYao: 'yao', bkSi: 'si' };

let mapHeat: LMap;
let heatTimer: ReturnType<typeof setInterval> | null = null;
let heatNameLayer: LLayer;
let heatRangeEl: HTMLInputElement;
const heatByName: Record<string, LLayer> = {};
const heatNameMarkers: Record<string, LLayer> = {};

/* SVG 标注（paint-order：描边在填充之下 → 墨字完整锐利） */
function labelText(txt: string, size: number, color: string): string {
  const w = txt.length * size + 14, h = size + 12;
  return '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h
    + '" style="position:absolute;left:0;top:0;overflow:visible;display:block">'
    + '<text x="' + (w / 2) + '" y="' + (h / 2) + '" text-anchor="middle" dominant-baseline="central" '
    + 'font-family="serif" font-weight="700" font-size="' + size + '" fill="' + color + '" '
    + 'stroke="#ffffff" stroke-width="3.5" paint-order="stroke" stroke-linejoin="round">'
    + txt + '</text></svg>';
}

function heatColor(v: number): string { return HEAT_COLORS[v] || HEAT_COLORS[0]; }

export function applyHeat(): void {
  const M = migr();
  const store = useAtlasStore();
  const pid = +(document.getElementById('heatRange') as HTMLInputElement).value;
  const entries: HeatEntry[] = M.heatData[pid] || [];
  Object.keys(heatByName).forEach((n) => {
    heatByName[n].setStyle({ fillColor: HEAT_COLORS[0], fillOpacity: .55,
      color: '#c9bda3', weight: .7 });
  });
  heatNameLayer.clearLayers();
  entries.forEach((e) => {
    const l = heatByName[e.p];
    if (!l) return;
    const on = e.b.some((b) => store.branchSel[b as BranchKey]);
    l.setStyle(on
      ? { fillColor: heatColor(e.v), fillOpacity: .95, color: '#8a5a2b', weight: .9 }
      : { fillColor: '#f5efdf', fillOpacity: .3, color: '#c9bda3', weight: .7 });
    l.setTooltipContent('<b>' + e.p + '</b>（' + M.heatPeriods[pid - 1].name + '）<br>'
      + '热度：' + HEAT_TEXT[e.v]
      + '<br>支系：' + e.b.map((b) => BRANCH_NAMES[b] || b).join('、')
      + (e.note ? '<br>' + esc(e.note) : ''));
    /* 有热度且支系勾选的省份：常显省名 */
    if (on && heatNameMarkers[e.p]) heatNameLayer.addLayer(heatNameMarkers[e.p]);
  });
  const per = M.heatPeriods[pid - 1];
  document.getElementById('heatNow')!.textContent = per.name + '（' + per.span + '）';
  document.getElementById('heatDesc')!.textContent = per.desc;
}

/* v3.6.6:四支开关即时反馈——徽章实时显示当前参与热区的支数 */
function syncBkCount(): void {
  const cnt = document.getElementById('bkCount'); if (!cnt) return;
  let n = 0;
  ['bkCao', 'bkZi', 'bkYao', 'bkSi'].forEach((id) => {
    const c = document.getElementById(id) as HTMLInputElement | null; if (c && c.checked) n++;
  });
  cnt.textContent = String(n);
  const live = document.getElementById('bkLive');
  if (live) live.classList.toggle('zero', n === 0);
}

function stopHeatPlay(): void {
  if (heatTimer) {
    clearInterval(heatTimer); heatTimer = null;
    document.getElementById('btnHeatPlay')!.textContent = '▶';
    document.getElementById('btnHeatPlay')!.classList.remove('on');
  }
}

export function initHeatMap(): void {
  const store = useAtlasStore();
  mapHeat = useLeafletMap('mapHeat', { center: [32.5, 112.5], zoom: 4, zoomSnap: 0.25,
    zoomControl: true, attributionControl: false });
  R.maps.heat = mapHeat;

  heatNameLayer = L.layerGroup().addTo(mapHeat);

  const heatProv = L.geoJSON(window.CHINA_PROV, {
    style: () => {
      return { color: '#b8a888', weight: .8, fillColor: '#f5efdf', fillOpacity: .95 };
    },
    onEachFeature: (f: any, l: any) => {
      heatByName[f.properties.name] = l;
      const p = f.properties;
      heatNameMarkers[p.name] = L.marker([p.cy, p.cx], { interactive: false,
        icon: L.divIcon({ className: '', iconSize: [0, 0], iconAnchor: [0, 0],
          html: '<div style="position:absolute;transform:translate(-50%,-50%)">'
            + labelText(p.name, 11, '#4a4130') + '</div>' }) });
      l.bindTooltip(f.properties.name, { sticky: true });
    }
  }).addTo(mapHeat);
  void heatProv;

  /* v3.6.6:四支开关 → Pinia branchSel(与 _zou 桥注册同一对象)+ 即时回执 */
  (['bkCao', 'bkZi', 'bkYao', 'bkSi'] as const).forEach((id) => {
    const el = document.getElementById(id) as HTMLInputElement;
    el.onchange = () => {
      store.setBranch(BK_MAP[id], el.checked);
      syncBkCount();
      applyHeat();
    };
  });
  syncBkCount();

  heatRangeEl = document.getElementById('heatRange') as HTMLInputElement;
  heatRangeEl.oninput = () => { stopHeatPlay(); applyHeat(); };
  document.getElementById('btnHeatPrev')!.onclick = () => {
    stopHeatPlay();
    heatRangeEl.value = String(+heatRangeEl.value > 1 ? +heatRangeEl.value - 1 : 8);
    applyHeat();
  };
  document.getElementById('btnHeatNext')!.onclick = () => {
    stopHeatPlay();
    heatRangeEl.value = String(+heatRangeEl.value < 8 ? +heatRangeEl.value + 1 : 1);
    applyHeat();
  };
  document.getElementById('btnHeatPlay')!.onclick = () => {
    if (heatTimer) { stopHeatPlay(); return; }
    const btn = document.getElementById('btnHeatPlay')!;
    btn.textContent = '⏸'; btn.classList.add('on');
    heatTimer = setInterval(() => {
      heatRangeEl.value = String(+heatRangeEl.value < 8 ? +heatRangeEl.value + 1 : 1);
      applyHeat();
    }, 2600);
  };
  applyHeat();
}

/** Hero 首屏 CTA 判断播放器是否在跑(原闭包 heatTimer) */
export function heatTimerActive(): boolean {
  return heatTimer !== null;
}
