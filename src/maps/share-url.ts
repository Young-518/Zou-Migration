/* URL 状态分享组件 —— 第四阶段:由 legacy-ports/app.ts「URL 状态分享」分解。
 * 职责:toast 创建(原位置)、buildURL/syncURL(阶段/时期/支系/图层/显示模式/当前窗口)、
 *       复制本视图链接(file:// 态回退线上地址)、三窗按钮 data-view 记录、
 *       载入时应用 URL 参数(深链)。
 * 顺序锚点:在全屏组件之后、a11y 组件之前调用(原文本序)。
 * DOM 事件契约:syncURL 以 document 级 change/input/click 捕获监听实现,保持原样。 */
import { useAtlasStore, type DataView } from '../stores/atlas';
import { initToast, showToast } from './runtime';
import { applyHeat } from './heat-map';
import { showStage } from './macro-timeline';

export function initShareUrl(): void {
  const store = useAtlasStore();

  /* ---------- 复制本视图链接(含 toast;创建位置与原文件一致) ---------- */
  initToast();

  function copyText(txt: string, done: (ok: boolean) => void): void {
    function fallback(): boolean {
      try {
        const ta = document.createElement('textarea');
        ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta); return ok;
      } catch (e) { return false; }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(() => { done(true); },
        () => { done(fallback()); });
    } else { done(fallback()); }
  }

  /* ============================================================
   * URL 状态分享：阶段 / 时期 / 支系 / 图层 / 当前窗口
   * ?s=1-8 & h=1-8 & b=四位支系 & L=五位图层 & v=macro|chain|micro
   * ============================================================ */
  let urlReady = false;
  let urlTimer: ReturnType<typeof setTimeout> | null = null;

  function buildURL(): string {
    const u = new URL(window.location.href);
    u.searchParams.set('s', (document.getElementById('stageRange') as HTMLInputElement).value);
    u.searchParams.set('h', (document.getElementById('heatRange') as HTMLInputElement).value);
    u.searchParams.set('b', (['cao', 'zi', 'yao', 'si'] as const).map((k) => {
      return store.branchSel[k] ? 1 : 0;
    }).join(''));
    u.searchParams.set('L', ['chkChain', 'chkHist', 'chkJwhd', 'chkNotable',
      'chkPersons', 'chkPoemPts']
      .map((id) => {
        const el = document.getElementById(id) as HTMLInputElement;
        return el && el.checked ? 1 : 0;
      }).join(''));
    /* v2.7.1：显示模式也是视图状态，不带上就会出现"分享出去又变回全景" */
    u.searchParams.set('m', store.macroMode === 'solo' ? 'solo' : 'focus');
    const v = document.body.getAttribute('data-view');
    if (v) u.searchParams.set('v', v); else u.searchParams.delete('v');
    /* 保留诗卷深链 #poem-xxx：URL 状态同步不应把它清掉 */
    u.hash = /^#poem-[\w-]+$/.test(location.hash) ? location.hash : '';
    return u.toString();
  }
  function syncURL(): void {
    if (!urlReady) return;
    if (urlTimer) clearTimeout(urlTimer);
    urlTimer = setTimeout(() => {
      try { history.replaceState(null, '', buildURL()); } catch (e) { /* file:// 忽略 */ }
    }, 260);
  }
  ['change', 'input', 'click'].forEach((ev) => {
    document.addEventListener(ev, syncURL, true);
  });

  document.getElementById('btnShareLink')!.onclick = () => {
    try { history.replaceState(null, '', buildURL()); } catch (e) { /* 忽略 */ }
    /* v2.7：file:// 下复制的路径别人打不开——改为提示用线上地址，
       不再给一个"看起来能分享、实际打不开"的链接 */
    if (location.protocol === 'file:') {
      const live = 'https://zou-migration-webgis.app.workbuddy.host/' + buildURL().replace(/^[^?]*/, '');
      copyText(live, (ok) => {
        showToast(ok ? '已复制线上地址（本地 file:// 路径别人打不开）'
          : '当前在本地打开，分享请用：' + live);
      });
      return;
    }
    copyText(window.location.href, (ok) => {
      showToast(ok ? '已复制本视图链接（阶段、支系、图层与显示模式）'
        : '复制失败，请手动复制地址栏链接');
    });
  };

  /* 三窗按钮同步记录当前窗口，便于生成直达链接 */
  [['btnFocusMacro', 'macro'], ['btnFocusChain', 'chain'], ['btnFocusMicro', 'micro']]
    .forEach((pair) => {
      const el = document.getElementById(pair[0]);
      if (el) el.addEventListener('click', () => {
        document.body.setAttribute('data-view', pair[1]);
        store.setDataView(pair[1] as DataView);
      });
    });

  /* ---------- 载入时应用 URL 参数 ---------- */
  (function applyURLState(): void {
    let q: URLSearchParams;
    try { q = new URLSearchParams(window.location.search); } catch (e) { urlReady = true; return; }
    const s = parseInt(q.get('s') as string, 10);
    if (s >= 1 && s <= 8) {
      (document.getElementById('stageRange') as HTMLInputElement).value = String(s);
      showStage(s);
    }
    const h = parseInt(q.get('h') as string, 10);
    if (h >= 1 && h <= 8) {
      (document.getElementById('heatRange') as HTMLInputElement).value = String(h);
      applyHeat();
    }
    const b = q.get('b');
    if (b && b.length === 4) {
      ['bkCao', 'bkZi', 'bkYao', 'bkSi'].forEach((id, i) => {
        const el = document.getElementById(id) as HTMLInputElement | null;
        if (!el) return;
        el.checked = b.charAt(i) === '1';
        el.dispatchEvent(new Event('change'));
      });
    }
    const Ls = q.get('L');
    if (Ls && Ls.length >= 4) {
      ['chkChain', 'chkHist', 'chkJwhd', 'chkNotable', 'chkPersons', 'chkPoemPts']
        .forEach((id, i) => {
          const el = document.getElementById(id) as HTMLInputElement | null;
          if (!el || i >= Ls.length) return;
          el.checked = Ls.charAt(i) === '1';
          if (el.onchange) (el.onchange as () => void)();
        });
    }
    const m = q.get('m');
    if (m === 'solo') { (document.getElementById('btnSolo') as HTMLButtonElement).click(); }
    else if (m === 'focus') { (document.getElementById('btnAll') as HTMLButtonElement).click(); }

    const v = q.get('v');
    if (v) {
      document.body.setAttribute('data-view', v);
      store.setDataView(v as DataView);
      setTimeout(() => {
        const btn = ({ macro: 'btnFocusMacro', chain: 'btnFocusChain', micro: 'btnFocusMicro' } as Record<string, string>)[v];
        if (btn) document.getElementById(btn)!.click();
      }, 600);
    }
    urlReady = true;
    syncURL();
  })();
}
