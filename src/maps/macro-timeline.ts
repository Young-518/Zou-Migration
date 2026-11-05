/* 时间轴/图例/显示模式组件 —— 第四阶段:由 legacy-ports/app.ts「时间轴、图例与聚焦层级」分解。
 * 职责:八阶段显隐集合与显示模式(进 Pinia atlas 仓:visibleStages/macroMode/
 *       chainOverlayOn)、①号图全国路线分层样式(styleNational/applyFilter)、
 *       阶段图例(单击显隐/双击聚焦)、时间轴滑杆/播放器、悬停聚焦、
 *       金色本支链 chkChain 开关、showStage 应用逻辑与初始进入全景模式。
 * 顺序锚点:在②号支链窗之后、③号微观图之前调用(原文本序)。
 * DOM 事件契约:#stageRange 的 input 事件是 scroll-story「场景 03」复用
 * showStage 的既有通道(冻结,不改为 store 直调)。 */
import { useAtlasStore } from '../stores/atlas';
import { R, migr, setLayerOpacity } from './runtime';
import { updateHistLayer } from './macro-layers';
import type { LLayer } from './types';

const MACRO_FADE = '#989082';

const nationalLines: LLayer[] = [];
const nationalBases: LLayer[] = [];
const nationalMarks: LLayer[] = [];
const nationalDots: LLayer[] = [];
const nationalComets: LLayer[] = [];   /* 彗尾飞线分段(四期,comet 模式) */

let mapMacro: LLayer;
let range: HTMLInputElement;
let legendEl: HTMLElement;
let playTimer: ReturnType<typeof setInterval> | null = null;
let playBtn: HTMLElement;

function isHeroStage(st: number): boolean {
  const store = useAtlasStore();
  if (!store.visibleStages[st]) return false;
  return store.macroMode === 'solo' || st === +range.value;
}

function setFlowAnim(l: LLayer, on: boolean): void {
  const el = l.getElement && l.getElement();
  if (el) {
    el.classList[on ? 'add' : 'remove']('flowline');
    el.classList[on ? 'remove' : 'add']('rt-dim');
  }
}

function styleNational(): void {
  const M = migr();
  const store = useAtlasStore();
  nationalLines.forEach((l: LLayer) => {
    /* 彗尾模式的隐形交互线:hero 态视觉让位彗尾(opacity 0),铺底态实线淡显 */
    if (l.options.className === 'comet-int') {
      if (isHeroStage(l._stage)) l.setStyle({ opacity: 0 });
      else if (store.visibleStages[l._stage]) l.setStyle({ color: MACRO_FADE, weight: 2, opacity: .55, dashArray: null });
      else l.setStyle({ opacity: 0 });
      return;
    }
    if (!l._dash0) l._dash0 = l.options.dashArray || '3 13';
    if (isHeroStage(l._stage)) {
      l.setStyle({ color: M.stageColor[l._stage], weight: 3, opacity: .9,
        dashArray: l._dash0 });
      setFlowAnim(l, true);
    } else if (store.visibleStages[l._stage]) {
      /* v2.7：全景铺底改实线——原来的 3/13 点线在浅色底图上几乎看不见，
         陌生人会以为"地图没加载" */
      l.setStyle({ color: MACRO_FADE, weight: 2, opacity: .72, dashArray: null });
      setFlowAnim(l, false);
    } else {
      l.setStyle({ opacity: 0 });
    }
  });
  /* 彗尾分段三态:hero 恢复各段渐变透明度/线宽并染阶段色;铺底弱化;隐藏归零 */
  nationalComets.forEach((l: LLayer) => {
    if (isHeroStage(l._stage)) {
      l.setStyle({ color: M.stageColor[l._stage], opacity: l._cometOp, weight: l._cometW });
      const el = l.getElement && l.getElement();
      if (el) el.classList.add('comet-on');
    } else if (store.visibleStages[l._stage]) {
      l.setStyle({ color: MACRO_FADE, opacity: (l._cometOp || 0.5) * 0.32, weight: l._cometW || 3 });
      const el = l.getElement && l.getElement();
      if (el) el.classList.remove('comet-on');
    } else {
      l.setStyle({ opacity: 0 });
      const el = l.getElement && l.getElement();
      if (el) el.classList.remove('comet-on');
    }
  });
  nationalBases.forEach((l: LLayer) => {
    l.setStyle({ opacity: isHeroStage(l._stage) ? .18
      : (store.visibleStages[l._stage] ? .04 : 0) });
  });
  nationalMarks.forEach((m: LLayer) => {
    const vis = isHeroStage(m._stage);
    if (m.getElement && m._icon) m.getElement().style.display = vis ? '' : 'none';
  });
  nationalDots.forEach((d: LLayer) => {
    const nm = d._props && d._props.name;
    if (store.chainOverlayOn && nm === '樟树·双洲') {
      d.setStyle({ fillOpacity: 0, opacity: 0 }); return;
    }
    if (isHeroStage(d._stage)) {
      d.setStyle({ radius: 7, fillColor: M.stageColor[d._stage],
        fillOpacity: .95, opacity: 1 });
    } else if (store.visibleStages[d._stage]) {
      d.setStyle({ radius: 3.5, fillColor: MACRO_FADE, fillOpacity: .8, opacity: 1 });
    } else {
      d.setStyle({ fillOpacity: 0, opacity: 0 });
    }
  });
}

function applyFilter(): void {
  const store = useAtlasStore();
  styleNational();
  /* 金色本支链同样分层：当前主角阶段的链段满权重流光，其余链段半隐为背景 */
  R.macroLayers.chainLines!.eachLayer((l: LLayer) => {
    const active = store.chainOverlayOn && (l._stage == null ? true : store.visibleStages[l._stage]);
    if (!active) {
      if (l instanceof L.Polyline) l.setStyle({ opacity: 0 });
      else setLayerOpacity(l, false);
      return;
    }
    if (l instanceof L.Polyline && l.options.className === 'chainline') {
      const hero = isHeroStage(l._stage);
      l.setStyle(hero ? { opacity: .95, weight: 5.5 } : { opacity: .28, weight: 3.5 });
      const el = l.getElement && l.getElement();
      if (el) el.classList[hero ? 'add' : 'remove']('chainline');
    } else if (l instanceof L.Polyline) {
      l.setStyle({ opacity: isHeroStage(l._stage) ? .18 : .06 });
    } else {
      setLayerOpacity(l, true);
    }
  });
  R.macroLayers.chainPoints!.eachLayer((l: LLayer) => {
    const active = store.chainOverlayOn && (l._stage == null ? true : store.visibleStages[l._stage]);
    if (!active) { setLayerOpacity(l, false); return; }
    /* 链上节点同样分层：主角阶段满尺寸，背景阶段缩小降透明（序号徽标保留） */
    if (l instanceof L.CircleMarker) {
      const hero = isHeroStage(l._stage);
      l.setStyle(hero ? { radius: 9, fillOpacity: .95, opacity: 1 }
        : { radius: 6, fillOpacity: .38, opacity: .5 });
    } else {
      setLayerOpacity(l, true);
    }
  });
}

function setCurLegend(id: number): void {
  const M = migr();
  M.stages.forEach((s) => {
    (legendEl.children[s.id - 1] as HTMLElement).classList.toggle('cur', s.id === id);
  });
}

/* v2.7：模式只在用户显式点「全景 / 只看本阶段」时切换；
   拖滑杆、滚到某步、深链、键盘切阶段都不再强制独占——否则主图会被切空 */
function applyModeUI(): void {
  const store = useAtlasStore();
  const all = document.getElementById('btnAll'), solo = document.getElementById('btnSolo');
  const cn = '一二三四五六七八'[Math.max(0, Math.min(7, +range.value - 1))];
  if (all) { all.classList.toggle('on', store.macroMode === 'focus'); all.setAttribute('aria-pressed', String(store.macroMode === 'focus')); }
  if (solo) { solo.classList.toggle('on', store.macroMode === 'solo'); solo.setAttribute('aria-pressed', String(store.macroMode === 'solo')); }
  const note = document.getElementById('macroModeNote');
  if (note) {
    note.textContent = store.macroMode === 'focus'
      ? '当前：全景 —— 33 段路线全部铺底，第' + cn + '阶段高亮'
      : '当前：只看本阶段 —— 仅显示第' + cn + '阶段（切回「全景」可看全部）';
  }
}

export function showStage(id: number, pan?: boolean): void {
  const M = migr();
  const store = useAtlasStore();
  M.stages.forEach((s) => {
    const vis = store.macroMode === 'solo' ? s.id === id : true;
    store.setVisibleStage(s.id, vis);
    (legendEl.children[s.id - 1] as HTMLElement).classList.toggle('off', !vis);
  });
  setCurLegend(id);
  const s = M.stages[id - 1];
  document.getElementById('stageNow')!.innerHTML = '<span class="dot" style="background:' + s.color + '"></span>'
    + '第' + '一二三四五六七八'[s.id - 1] + '阶段 · ' + (s.name as string)
    + '<span class="era">' + (s.era as string) + '</span>';
  document.getElementById('stageDesc')!.textContent = s.desc;
  range.value = String(id);
  store.setStage(id);
  applyFilter();
  updateHistLayer();
  applyModeUI();
  if (pan) {
    /* 播放时镜头跟随当前阶段的节点 */
    const pts = M.nationalPlaces.features.filter((f) => {
      return f.properties.stage === id;
    }).map((f): [number, number] => {
      const c = f.geometry.coordinates; return [c[1], c[0]];
    });
    if (pts.length) {
      mapMacro.flyToBounds(L.latLngBounds(pts).pad(0.35),
        { maxZoom: 5, duration: 1.2 });
    }
  }
}

/* "全景" = 全部阶段同屏（当前阶段高亮、其余降为灰线） */
function applyFocusAll(): void {
  useAtlasStore().setMacroMode('focus');
  showStage(+range.value);
}

export function stopPlay(): void {
  if (playTimer) {
    clearInterval(playTimer); playTimer = null;
    playBtn.textContent = '▶'; playBtn.classList.remove('on');
  }
}

/** a11y 组件(键盘支持)使用:图例与播放器句柄 */
export function stageLegendEl(): HTMLElement { return legendEl; }
export function stageRangeEl(): HTMLInputElement { return range; }
export function playBtnEl(): HTMLElement { return playBtn; }

export function initMacroTimeline(): void {
  const M = migr();
  const store = useAtlasStore();
  mapMacro = R.maps.macro!;
  const macroRoutes = R.macroLayers.routes!;
  const macroPlaces = R.macroLayers.places!;
  range = document.getElementById('stageRange') as HTMLInputElement;

  /* 收集①号图全国路线的各组成部分，按聚焦层级统一赋样式 */
  macroRoutes.eachLayer((l: LLayer) => {
    if (l instanceof L.Polyline) {
      if (l.options.className === 'routebase') nationalBases.push(l);
      else if (l.options.className === 'cometseg') nationalComets.push(l);
      else nationalLines.push(l);
    } else { nationalMarks.push(l); }
  });
  macroPlaces.eachLayer((l: LLayer) => { nationalDots.push(l); });

  M.stages.forEach((s) => store.setVisibleStage(s.id, true));
  store.setMacroMode('focus');
  store.setChainOverlay(true);

  const chkChain = document.getElementById('chkChain') as HTMLInputElement;
  chkChain.onchange = () => {
    store.setChainOverlay(chkChain.checked);
    applyFilter();
  };

  legendEl = document.getElementById('stageLegend')!;
  M.stages.forEach((s) => {
    const n = M.nationalPlaces.features.filter((f) => f.properties.stage === s.id).length;
    const short = (s.name as string).split('：')[0];
    const li = document.createElement('li');
    li.title = s.name + '（' + s.era + '）· 单击显隐，双击聚焦';
    li.innerHTML = '<span class="dot" style="background:' + s.color + '"></span>'
      + '<span class="nm">' + short + '</span><span class="cnt">' + n + ' 节点</span>';
    li.onclick = () => {
      const on = !store.visibleStages[s.id];
      store.setVisibleStage(s.id, on);
      li.classList.toggle('off', !on);
      applyFilter();
    };
    li.ondblclick = () => { showStage(s.id); };
    legendEl.appendChild(li);
  });

  /* 悬停聚焦：任意路线悬停即升为主角，其余退为背景（信息不减，注意力聚焦） */
  nationalLines.forEach((l: LLayer) => {
    l.on('mouseover', () => {
      const el = l.getElement && l.getElement();
      if (!el) return;
      mapMacro.getContainer().classList.add('route-hover');
      el.classList.add('hl-route');
      if (store.macroMode === 'focus' && l._stage !== +range.value) {
        l.setStyle({ color: M.stageColor[l._stage], weight: 3, opacity: .95 });
      }
    });
    l.on('mouseout', () => {
      mapMacro.getContainer().classList.remove('route-hover');
      const el = l.getElement && l.getElement();
      if (el) el.classList.remove('hl-route');
      styleNational();
    });
  });
  range.oninput = () => { stopPlay(); showStage(+range.value); };

  playBtn = document.getElementById('btnPlay')!;
  playBtn.onclick = () => {
    if (playTimer) { stopPlay(); return; }
    playBtn.textContent = '⏸'; playBtn.classList.add('on');
    let id = +range.value >= 8 ? 1 : +range.value;
    showStage(id, true);
    playTimer = setInterval(() => {
      id++;
      if (id > 8) { stopPlay(); return; }
      showStage(id, true);
    }, 2600);
  };
  /* 初始进入全景模式：全部阶段同屏、当前（第八阶段）高亮流光，其余退为灰线；
     拖动时间轴或"独占"按钮进入独占模式 */
  showStage(8);
  document.getElementById('btnAll')!.onclick = applyFocusAll;
  document.getElementById('btnSolo')!.onclick = () => {
    store.setMacroMode('solo');
    showStage(+range.value);
  };
  applyFocusAll();
  updateHistLayer();
}
