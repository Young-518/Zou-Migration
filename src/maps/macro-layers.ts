/* ①号图叠加图层组件 —— 第四阶段:由 legacy-ports/app.ts 分解。
 * 职责:历史政区图层(CHGIS,histPane=leaflet-hist-pane,350 < overlayPane 400,
 *       随时间轴阶段自动切换朝代)、郡望·堂号源地 diamond 图层、
 *       历史名人金色星标图层(开关 label 动态创建,后由图层管理器搬进地图盒)。
 * 顺序锚点:在宏观图之后、②号支链窗之前调用(原文本序)。 */
import { R, esc, migr } from './runtime';
import type { LLayer } from './types';

const STAGE_HIST: Record<number, string | null> = { 1: null, 2: 'qinhan_bc200', 3: 'weijin_400', 4: 'tang800',
  5: 'tang800', 6: 'ming1530', 7: '1911', 8: '1911' };
/* 历史底图 v4:源自「江山时序 Jiangshan Atlas」(github.com/DeanChensj/jiangshan-map,
 * GPL-3.0;政权轮廓层源自 historical-basemaps;近似示意,非测绘边界) */
const HIST_LABEL: Record<string, string> = { '1911': '清末 1911 年疆域（江山时序）',
  'tang800': '唐代（约 800 年）疆域轮廓（江山时序）',
  'ming1530': '明代（约 1530 年）疆域轮廓（江山时序）',
  'qinhan_bc200': '秦汉之际（约前 200 年）疆域轮廓（江山时序）',
  'weijin_400': '魏晋南北朝（约 400 年，东晋—北魏对峙）疆域轮廓（江山时序）' };

/* CHGIS 历史政区原始图层:classic 资产层(hist1911/hist_outline/hist_extra)在
 * main.ts 运行期才挂 window.HIST_LAYERS —— 必须在 init 运行时读取,
 * 严禁提升为模块顶层 const(import 时刻求值会缓存空对象,第四阶段实测教训)。 */
function histReady(): Record<string, unknown> {
  return (window.HIST_LAYERS || {}) as Record<string, unknown>;
}

const histLayers: Record<string, LLayer> = {};
let histLayerCurrent: LLayer | null = null;

export function updateHistLayer(): void {
  const mapMacro = R.maps.macro;
  if (!mapMacro) return;
  const stage = +(document.getElementById('stageRange') as HTMLInputElement).value;
  const key = STAGE_HIST[stage] || null;
  const want = (document.getElementById('chkHist') as HTMLInputElement).checked && key && histLayers[key];
  const statusEl = document.getElementById('histStatus')!;
  /* 取消勾选或阶段切换时立即移除当前图层 */
  if (histLayerCurrent && (!want || histLayerCurrent !== histLayers[key as string])) {
    mapMacro.removeLayer(histLayerCurrent);
    histLayerCurrent = null;
  }
  if (want && !histLayerCurrent) {
    histLayers[key as string].addTo(mapMacro);
    histLayerCurrent = histLayers[key as string];
  }
  if (!(document.getElementById('chkHist') as HTMLInputElement).checked) {
    statusEl.innerHTML = '历史政区：<b>已隐藏</b>（勾选以显示当前朝代图层）';
    return;
  }
  if (!key) {
    statusEl.innerHTML = '历史政区：本阶段（先秦）暂无对应疆域图层（约前1000年世界底图未标注中国区域政权）';
  } else if (histReady()[key]) {
    statusEl.innerHTML = '历史政区：<b>' + HIST_LABEL[key] + '</b>（已加载，'
      + (histReady()[key] as { features: unknown[] }).features.length + ' 个政区面）';
  } else {
    statusEl.innerHTML = '历史政区：' + HIST_LABEL[key] + '（<b>数据待补</b>，加载后自动生效）';
  }
}

export function initMacroLayers(): void {
  const M = migr();
  const mapMacro = R.maps.macro!;

  /* 历史政区专用低层级 pane（350 < overlayPane 400），
     保证迁徙点/路线的弹窗优先于政区面被命中 */
  if (!mapMacro.getPane('histPane')) {
    mapMacro.createPane('histPane');
    mapMacro.getPane('histPane').style.zIndex = 350;
  }

  Object.keys(histReady()).forEach((key) => {
    histLayers[key] = L.geoJSON(histReady()[key], {
      pane: 'histPane',
      /* 底图参照系：细化降透明，不与迁徙路线抢视觉 */
      style: (f?: any) => {
        /* 政权大轮廓:朱砂描边+宣纸淡填充(比旧 CHGIS 细政区更可见,仍不与路线抢视觉);
         * 政权面色取快照 tint(江山时序设色),无 tint 用宣纸赭 */
        const tint = (f && f.properties && f.properties.tint) || '#B48A4A';
        return { color: '#9d2f22', weight: 1.2, opacity: .55,
          fillColor: tint, fillOpacity: .16 };
      },
      onEachFeature: (f: any, layer: any) => {
        const p = f.properties || {};
        layer.bindTooltip((p.name || '') + '（' + p.year + ' 年 · 江山时序）', { sticky: true });
        layer.bindPopup('<div class="pop">'
          + '<span class="badge" style="background:#8a5a2b">' + esc(p.year) + ' 年</span>'
          + '<div class="pt">' + esc(p.name) + '</div>'
          + '<div class="pk"><b>数据源</b>：江山时序 Jiangshan Atlas'
          + '（github.com/DeanChensj/jiangshan-map；参考谭其骧《中国历史地图集》、CHGIS、Hartwell 简化示意，近似边界非测绘成果）</div>'
          + '</div>');
      }
    });
  });

  (document.getElementById('chkHist') as HTMLInputElement).onchange = updateHistLayer;

  /* ---------------- 郡望·堂号源地图层（①号窗，勾选显示） ---------------- */
  const jwhdLayer = L.layerGroup();
  M.jwhd.features.forEach((f) => {
    const p = f.properties, c = f.geometry.coordinates;
    const color = p.kind === '郡望' ? '#534AB7' : '#0F6E56';
    const m = L.marker([c[1], c[0]], {
      icon: L.divIcon({ className: '', iconSize: [14, 14], iconAnchor: [7, 7],
        html: '<div class="jwhd-diamond" style="background:' + color + '"></div>' })
    }).bindPopup('<div class="pop"><span class="badge" style="background:' + color + '">'
      + esc(p.kind) + '源地</span><div class="pt">' + esc(p.name) + '</div>'
      + '<div class="pk">' + esc(p.note) + '</div>'
      + '<div class="pn">郡望堂号体系据调查报告第二、三章</div></div>');
    jwhdLayer.addLayer(m);
  });
  const chkJwhd = document.getElementById('chkJwhd') as HTMLInputElement;
  chkJwhd.onchange = () => {
    if (chkJwhd.checked) { jwhdLayer.addTo(mapMacro); }
    else { mapMacro.removeLayer(jwhdLayer); }
  };

  /* ---------------- 历史名人星标图层（①号窗，勾选显示） ---------------- */
  const notableLayer = L.layerGroup();
  const notableByKey: Record<string, LLayer> = {};
  M.notable.forEach((d) => {
    const color = M.stageColor[d.stage as number] || '#B8912A';
    const m = L.marker(d.latlng, {
      icon: L.divIcon({ className: '', iconSize: [20, 20], iconAnchor: [10, 10],
        html: '<div class="notable-star" style="background:' + color + '">★</div>' })
    }).bindPopup('<div class="pop">'
      + '<span class="badge" style="background:' + color + '">' + esc(d.era) + ' · ' + esc(d.dyn) + '</span>'
      + '<div class="pt">' + esc(d.name) + '</div>'
      + '<div class="pk"><b>' + esc(d.title) + '</b></div>'
      + '<div class="pk">' + esc(d.bio) + '</div>'
      + '<div class="pn">典故：' + esc(d.allusion) + '</div>'
      + '<div class="pn">详见左栏"邹氏名人堂"</div></div>');
    notableByKey[d.name] = m;
    notableLayer.addLayer(m);
  });
  const notableLbl = document.createElement('label');
  notableLbl.className = 'switchline';
  notableLbl.innerHTML = '<input type="checkbox" id="chkNotable">邹氏历史名人（金色星标）';
  const chkNotable = notableLbl.querySelector('#chkNotable') as HTMLInputElement;
  chkNotable.onchange = () => {
    if (chkNotable.checked) { notableLayer.addTo(mapMacro); }
    else { mapMacro.removeLayer(notableLayer); }
  };

  R.notableLayer = notableLayer;
  R.notableByKey = notableByKey;
  R.notableLbl = notableLbl;
}
