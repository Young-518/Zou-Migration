/* 页尾组件集 —— 第四阶段:由 legacy-ports/app.ts 四个独立小节合并分解
 * (①号图初始视野/章节导航/Hero 数据条/首屏入口与工具浮层)。
 * 顺序锚点:在 a11y 组件之后、window._zou 桥安装之前调用(原文本序)。 */
import { R, migr } from './runtime';
import type { LMap } from './types';

/* P1-6 ① 初始视野：贴合全国迁徙节点；用户已操作或深链已定位则不打扰 */
function initInitialFit(): void {
  const M = migr();
  const mapMacro = R.maps.macro as LMap;
  let touched = false;
  const mark = (): void => { touched = true; };
  mapMacro.on('dragstart', mark);
  mapMacro.on('zoomstart', mark);
  setTimeout(() => {
    if (touched) return;
    if (mapMacro.getZoom() !== 5) return;   /* 深链 ?v=macro 已定位 */
    mapMacro.fitBounds(L.latLngBounds(
      M.nationalPlaces.features.filter((f) => {
        return f.geometry.coordinates[1] >= 18;
      }).map((f): [number, number] => {
        const c = f.geometry.coordinates; return [c[1], c[0]];
      })).pad(0.05));
  }, 400);
}

/* ---------------- 章节导航：折叠 / 进度 / 平滑滚动 ---------------- */
function initChapnav(): void {
  const nav = document.getElementById('chapnav');
  if (!nav) return;
  const bar = document.getElementById('chapProgress');
  const toggle = document.getElementById('chapToggle');
  if (toggle) {
    toggle.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }
  Array.prototype.forEach.call(nav.querySelectorAll('.links a'), (a: HTMLElement) => {
    a.addEventListener('click', () => { nav.classList.remove('open'); });
  });
  let ticking = false;
  function upd(): void {
    const h = document.documentElement;
    const p = h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight);
    if (bar) bar.style.width = (p * 100).toFixed(2) + '%';
    ticking = false;
  }
  window.addEventListener('scroll', () => {
    if (!ticking) { ticking = true; requestAnimationFrame(upd); }
  }, { passive: true });
  upd();
}

/* ---------------- Hero 数据条：进入视口 0→目标值（一次） ---------------- */
function initHeroStats(): void {
  const wrap = document.getElementById('heroStats');
  if (!wrap) return;
  const reduced = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let done = false;
  function run(): void {
    if (done) return;
    done = true;
    Array.prototype.forEach.call(wrap!.querySelectorAll('b[data-to]'), (el: HTMLElement) => {
      const to = +el.getAttribute('data-to')!;
      if (reduced) { el.textContent = String(to); return; }
      const t0 = performance.now(), dur = 1100;
      function step(t: number): void {
        const k = Math.min(1, (t - t0) / dur);
        const e = 1 - Math.pow(1 - k, 3);
        el.textContent = String(Math.round(to * e));
        if (k < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    });
  }
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((es) => {
      es.forEach((en) => { if (en.isIntersecting) { run(); io.disconnect(); } });
    }, { threshold: .35 });
    io.observe(wrap);
  } else { run(); }

  const scroll = document.getElementById('heroScroll');
  if (scroll) {
    scroll.addEventListener('click', () => {
      const t = document.getElementById('secAtlas') || document.getElementById('migrationAtlas');
      if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }
}

/* ---------------- v2.7 首屏入口：一主一次 + 工具浮层 ---------------- */
function initStartPanel(): void {
  function goTo(id: string): void {
    const t = document.getElementById(id);
    if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  const btnStart = document.getElementById('btnStart');
  if (btnStart) {
    btnStart.addEventListener('click', () => {
      /* 主按钮＝真正开始：滚到 01 姓源的开头（.sec-head 与 #secOrigin 相邻） */
      const sec = document.getElementById('secOrigin');
      const head = sec && sec.previousElementSibling;
      (head && head.classList.contains('sec-head') ? head : sec || document.body)
        .scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }
  /* 速览：只留 01 姓源 / 03 全国路线 / 05 双洲 */
  const btnQuick = document.getElementById('btnQuick');
  if (btnQuick) {
    btnQuick.addEventListener('click', () => {
      const on = document.body.classList.toggle('quick');
      btnQuick.setAttribute('aria-pressed', on ? 'true' : 'false');
      btnQuick.textContent = on ? '速览 · 开' : '速览';
      if (on) window.scrollTo({ top: 0, behavior: 'smooth' });
      setTimeout(() => { window.dispatchEvent(new Event('resize')); }, 120);
    });
  }

  const btnJump = document.getElementById('btnJumpMacro');
  if (btnJump) btnJump.addEventListener('click', () => { goTo('secMacroHead'); });

  const btnTools = document.getElementById('btnTools');
  const panel = document.getElementById('startPanel');
  if (btnTools && panel) {
    const setOpen = (open: boolean): void => {
      if (open) panel.removeAttribute('hidden'); else panel.setAttribute('hidden', '');
      btnTools.setAttribute('aria-expanded', open ? 'true' : 'false');
      btnTools.textContent = open ? '收起搜索与三窗联动 ▴' : '搜索与三窗联动 ▾';
    };
    /* v2.7.1：浮层能开就得能关——补 Esc 与点外关闭，并在关闭时把焦点还给按钮 */
    const onDocDown = (e: Event): void => {
      if (panel.hasAttribute('hidden')) return;
      if (panel.contains(e.target as Node) || btnTools.contains(e.target as Node)) return;
      setOpen(false);
      cleanup();
    };
    const onKey = (e: Event): void => {
      if ((e as KeyboardEvent).key !== 'Escape' || panel.hasAttribute('hidden')) return;
      e.preventDefault();
      setOpen(false);
      cleanup();
      btnTools.focus({ preventScroll: true });
    };
    function cleanup(): void {
      document.removeEventListener('pointerdown', onDocDown, true);
      document.removeEventListener('keydown', onKey, true);
    }
    btnTools.addEventListener('click', () => {
      const open = panel.hasAttribute('hidden');
      setOpen(open);
      if (open) {
        const box = document.getElementById('searchBox');
        if (box) box.focus({ preventScroll: true });
        document.addEventListener('pointerdown', onDocDown, true);
        document.addEventListener('keydown', onKey, true);
      } else {
        cleanup();
      }
    });
  }
}

export function initPageTail(): void {
  initInitialFit();
  initChapnav();
  initHeroStats();
  initStartPanel();
}
