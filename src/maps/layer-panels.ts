/* 地图内嵌图层管理器(v2 抽屉版) + 双洲村缓冲区分析 —— 由 legacy-ports/app.ts 同名小节分解。
 * v2(八期,方案 C):右上「图层」按钮 → 右侧滑出抽屉,五组要素分组呈现
 * (迁徙主脉/史料路线/历史疆域/星野氛围/辅助标注——③号图为点位/工具两组),
 * ①号图配三个预设(叙事/考据/氛围),预设=按序设置既有 chk 系 勾选并触发
 * change(复用既有 handler 链,零新显隐逻辑);默认应用「叙事」预设。
 * 兼容:addBox 保留为工厂;chk 系/bufRow 的 id 与 .switchline 结构不变
 * (macro-layers/macro-timeline/basemap 的 getElementById 契约零破坏)。
 * 顺序锚点:必须在所有 chk 系 处理器注册、notableLbl 与 chkNight 创建之后调用。 */
import { R } from './runtime';
import type { LLayer, LMap } from './types';

interface GroupSpec {
  name: string;
  note?: string;                      /* 组说明(无开关的提示行) */
  items: Array<HTMLElement | null>;
}
interface DrawerSpec {
  title: string;
  groups: GroupSpec[];
  presets?: Array<{ name: string; apply: () => void }>;
}

function setChk(id: string, on: boolean): void {
  const el = document.getElementById(id) as HTMLInputElement | null;
  if (!el) return;
  if (el.checked !== on) {
    el.checked = on;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

function clickBtn(id: string): void {
  const el = document.getElementById(id) as HTMLButtonElement | null;
  if (el) el.click();
}

/* 抽屉面板:头部按钮为 Leaflet Control(右上角),抽屉本体挂 map 容器内右侧 */
function buildDrawer(map: LMap, spec: DrawerSpec): HTMLElement | null {
  /* --- 抽屉本体(先建,btn 事件同作用域引用) --- */
  const drawer = document.createElement('div');
  drawer.className = 'layer-drawer';
  const head = document.createElement('div');
  head.className = 'ld-head';
  head.innerHTML = '<span class="ld-title">' + spec.title + '</span>';
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'ld-close';
  close.innerHTML = '✕';
  close.addEventListener('click', () => { drawer.classList.remove('open'); });
  head.appendChild(close);
  drawer.appendChild(head);

  if (spec.presets && spec.presets.length) {
    const pr = document.createElement('div');
    pr.className = 'ld-presets';
    const pl = document.createElement('span');
    pl.className = 'ld-plabel';
    pl.textContent = '预设视图';
    pr.appendChild(pl);
    spec.presets.forEach((ps) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'ld-preset';
      b.textContent = ps.name;
      b.addEventListener('click', () => {
        pr.querySelectorAll('.ld-preset').forEach((x: Element) => x.classList.remove('on'));
        b.classList.add('on');
        ps.apply();
      });
      pr.appendChild(b);
    });
    drawer.appendChild(pr);
  }

  spec.groups.forEach((g) => {
    const sec = document.createElement('div');
    sec.className = 'ld-group';
    const gt = document.createElement('div');
    gt.className = 'ld-gtitle';
    gt.textContent = g.name;
    sec.appendChild(gt);
    if (g.note) {
      const nt = document.createElement('p');
      nt.className = 'ld-note';
      nt.textContent = g.note;
      sec.appendChild(nt);
    }
    g.items.forEach((n) => { if (n) sec.appendChild(n); });
    drawer.appendChild(sec);
  });

  const host = document.createElement('div');
  host.className = 'ld-host';
  host.appendChild(drawer);
  map.getContainer().appendChild(host);

  /* --- 头部按钮(Leaflet Control,右上角) --- */
  const Ctrl = L.Control.extend({
    options: { position: 'topright' },
    onAdd: () => {
      const wrap = L.DomUtil.create('div', 'layer-drawer-wrap leaflet-control');
      const btn = L.DomUtil.create('button', 'ld-btn', wrap);
      btn.type = 'button';
      btn.innerHTML = '<span class="ld-ico">☰</span> 图层';
      btn.addEventListener('click', () => {
        const open = drawer.classList.toggle('open');
        btn.classList.toggle('active', open);
      });
      L.DomEvent.disableClickPropagation(wrap);
      L.DomEvent.disableScrollPropagation(wrap);
      return wrap;
    }
  });
  map.addControl(new Ctrl());
  return drawer;
}

export function initLayerPanels(): void {
  const mapMacro = R.maps.macro as LMap;
  const mapMicro = R.maps.micro as LMap;
  const chainLbl = (document.getElementById('chkChain') as HTMLElement).closest('.switchline') as HTMLElement;
  const histLbl = (document.getElementById('chkHist') as HTMLElement).closest('.switchline') as HTMLElement;
  const jwhdLbl = (document.getElementById('chkJwhd') as HTMLElement).closest('.switchline') as HTMLElement;
  const nightLbl = (document.getElementById('chkNight') as HTMLElement | null)?.closest('.switchline') as HTMLElement | null;
  const persLbl = (document.getElementById('chkPersons') as HTMLElement).closest('.switchline') as HTMLElement;
  const poemLbl = (document.getElementById('chkPoemPts') as HTMLElement).closest('.switchline') as HTMLElement;
  const bufRow = document.createElement('div');
  bufRow.className = 'buf-row';
  bufRow.id = 'bufRow';

  /* ①号图:五组抽屉 + 三预设(叙事/考据/氛围),默认「叙事」 */
  buildDrawer(mapMacro, {
    title: '图层 · 路线考',
    groups: [
      { name: '迁徙主脉', items: [chainLbl] },
      { name: '史料路线', note: '33 段记载路线 · 显隐与聚焦由下方时间轴控制', items: [] },
      { name: '历史疆域', items: [histLbl] },
      { name: '星野氛围', items: [nightLbl] },
      { name: '辅助标注', items: [jwhdLbl, R.notableLbl] },
    ],
    presets: [
      { name: '叙事', apply: () => {
        setChk('chkChain', true); setChk('chkHist', false);
        setChk('chkJwhd', false); setChk('chkNotable', false);
        setChk('chkNight', true); clickBtn('btnSolo');
      } },
      { name: '考据', apply: () => {
        setChk('chkChain', true); setChk('chkHist', true);
        setChk('chkJwhd', true); setChk('chkNotable', false);
        setChk('chkNight', true); clickBtn('btnAll');
      } },
      { name: '氛围', apply: () => {
        setChk('chkChain', false); setChk('chkHist', false);
        setChk('chkJwhd', false); setChk('chkNotable', false);
        setChk('chkNight', true); clickBtn('btnAll');
      } },
    ],
  });
  /* ③号图:两组抽屉(无预设) */
  buildDrawer(mapMicro, {
    title: '图层 · 双洲村',
    groups: [
      { name: '点位与诗词', items: [persLbl, poemLbl] },
      { name: '分析工具', items: [bufRow] },
    ],
  });

  /* 缓冲区按钮行（③号窗,turf.js 按需懒加载,逻辑与 v3.1.0 一致） */
  const lab = document.createElement('span');
  lab.className = 'buf-lab'; lab.textContent = '双洲村缓冲区';
  bufRow.appendChild(lab);
  const bufLayer: LLayer = L.layerGroup();
  let activeBtn: HTMLElement | null = null;
  let turfLoading: Promise<void> | null = null, turfFailed = false;

  function turfError(msg: string): void {
    if (bufRow.querySelector('.buf-err')) return;
    const d = document.createElement('div');
    d.className = 'pn buf-err';
    d.style.color = '#a33';
    d.textContent = msg;
    bufRow.appendChild(d);
  }
  function ensureTurf(cb: () => void): void {
    if (window.turf) { cb(); return; }
    if (turfFailed) { turfError('缓冲区模块不可用，请刷新重试'); return; }
    if (!turfLoading) {
      turfLoading = new Promise<void>((res, rej) => {
        const s = document.createElement('script');
        s.src = 'js/vendor/turf.min.js';
        s.onload = () => {
          if (window.turf) res(); else rej(new Error('turf 未挂载'));
        };
        s.onerror = () => { rej(new Error('turf 加载失败')); };
        document.head.appendChild(s);
      });
    }
    turfLoading.then(cb).catch(() => {
      turfFailed = true;
      turfError('缓冲区模块加载失败，请刷新重试');
    });
  }
  function setBuf(km: number | null, btn: HTMLElement | null): void {
    bufLayer.clearLayers(); mapMicro.removeLayer(bufLayer);
    if (activeBtn) activeBtn.classList.remove('on');
    activeBtn = null;
    if (!km) return;
    if (!window.turf) {
      ensureTurf(() => { setBuf(km, btn); });
      return;
    }
    const b = turf.buffer(turf.point([115.405510, 27.925320]), km, { units: 'kilometers' });
    const areaKm = turf.area(b) / 1e6;
    const bufGeo = L.geoJSON(b, { style: { color: '#2E6FA8', weight: 1.5,
        fillColor: '#4A90C4', fillOpacity: .12 } })
      .bindPopup('<div class="pop"><div class="pt">双洲村 ' + km
        + ' km 缓冲区</div><div class="pk">面积约 <b>' + areaKm.toFixed(0)
        + ' km²</b></div><div class="pn">turf.js 缓冲区分析（教学示意）</div></div>')
      .addTo(bufLayer);
    bufLayer.addTo(mapMicro);
    activeBtn = btn; btn!.classList.add('on');
    mapMicro.fitBounds(bufGeo.getBounds().pad(0.12), { maxZoom: 11 });
  }
  [5, 10, 15].forEach((km) => {
    const b = document.createElement('button');
    b.className = 'buf-btn'; b.textContent = km + 'km';
    b.onclick = () => { setBuf(km, b); };
    bufRow.appendChild(b);
  });
  const off = document.createElement('button');
  off.className = 'buf-btn'; off.textContent = '关';
  off.onclick = () => { setBuf(null, null); };
  bufRow.appendChild(off);

  /* 默认应用「叙事」预设:延迟到全部 init(btnSolo.onclick 等绑定)完成后触发 */
  setTimeout(() => {
    const first = document.querySelector('.ld-preset');
    if (first) (first as HTMLButtonElement).click();
  }, 120);
}
