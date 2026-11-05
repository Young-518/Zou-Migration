/* 05 双洲八景「古今对读」交互 —— 第三阶段 PR-7:由 js/poem-ui.js 移植退役。
 * 职责:景名切换预览、诗卷抽屉(清/今咏 tab)、深链 #poem-<id>、焦点管理。
 * 依赖:window.ZOU_POEMS(static-poems/API 注入);不依赖任何库。
 * 抽屉骨架为 Vue 交互岛(poem-drawer),本组合式函数按 id 取用并填充动态区。
 * 编排:main.ts 在 runLegacy() 之后调用 initPoemUi()(原模块序第 5 位)。 */

export function initPoemUi(): void {
  const w = window as any;
  const DATA = w.ZOU_POEMS;
  const grid = document.getElementById('poemGrid');
  const drawer = document.getElementById('poemDrawer');
  const body = document.getElementById('poemBody');
  const foot = document.getElementById('poemFoot');
  const titleEl = document.getElementById('poemDrawerTitle');
  const subEl = document.getElementById('poemDrawerSub');
  const preview = document.getElementById('poemPreview');
  const btnOpen = document.getElementById('btnPoemOpen') as HTMLButtonElement | null;
  const btnClose = document.getElementById('poemClose');
  let lastFocus: Element | null = null;
  let currentScene: string | null = null;
  let currentSet = 'qing';

  function esc(s: unknown): string {
    return String(s == null ? '' : s).replace(/[&<>"]/g, (c: string) => {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' } as Record<string, string>)[c];
    });
  }
  function sceneById(id: string): any {
    if (!DATA || !DATA.scenes) return null;
    for (let i = 0; i < DATA.scenes.length; i++) {
      if (DATA.scenes[i].id === id) return DATA.scenes[i];
    }
    return null;
  }
  function poemsOf(id: string, dynasty: string): any[] {
    if (!DATA || !DATA.poems) return [];
    return DATA.poems.filter((p: any) => p.sceneId === id && p.dynasty === dynasty);
  }
  function authorList(id: string): string {
    const qing = poemsOf(id, '清').map((p: any) => '清·' + p.author);
    const jin = poemsOf(id, '今').map((p: any) => '今·' + p.author);
    const q = qing.filter((v, i) => qing.indexOf(v) === i);
    const j = jin.filter((v, i) => jin.indexOf(v) === i);
    return q.concat(j).join(' / ');
  }

  /* ---------- 预览 ---------- */
  function renderPreview(id: string): void {
    currentScene = id;
    const scene = sceneById(id);
    const chip = grid ? grid.querySelector('.poem-chip[data-scene="' + id + '"]') : null;
    Array.prototype.forEach.call(grid ? grid.querySelectorAll('.poem-chip') : [], (b: HTMLElement) => {
      const on = b === chip;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    if (!preview) return;
    if (!scene) { preview.innerHTML = '<p class="pp-line">诗卷待补</p>'; return; }
    const p = poemsOf(id, '清')[0];
    const src = p
      ? '清·' + p.author + '《' + String(p.title).split('·')[0] + '》'
      : '清诗待补';
    const line = p && p.lines ? p.lines.slice(0, 2).join('') : '此景诗卷待与纸书复核。';
    preview.innerHTML = '<p class="pp-source">' + esc(src) + '</p>'
      + '<p class="pp-line">' + esc(line) + '</p>';
    if (btnOpen) {
      btnOpen.disabled = !scene;
      btnOpen.textContent = scene
        ? '打开《' + (scene.displayName || scene.name) + '》全文 →'
        : '展开诗卷 →';
    }
  }

  /* ---------- 抽屉 ---------- */
  function renderBody(id: string, set: string): void {
    if (!body || !foot) return;
    const scene = sceneById(id);
    if (!scene) {
      body.innerHTML = '<p class="pd-empty">诗卷待补:该景尚未录入诗作。</p>';
      foot.textContent = '';
      return;
    }
    const dynasty = set === 'jin' ? '今' : '清';
    const list = poemsOf(id, dynasty);
    if (!list.length) {
      body.innerHTML = '<p class="pd-empty">诗卷待补:' + (dynasty === '清' ? '清诗' : '今咏')
        + '尚未录入。</p>';
    } else {
      body.innerHTML = list.map((p: any) => {
        const notes = (p.notes && p.notes.length)
          ? '<dl class="pd-notes">' + p.notes.map((n: any) =>
              '<dt>' + esc(n.term) + '</dt><dd>' + esc(n.text) + '</dd>').join('') + '</dl>'
          : '';
        return '<section class="pd-poem">'
          + '<h4 class="pd-title">' + esc(p.title) + '</h4>'
          + '<p class="pd-author">' + esc(p.dynasty) + '·' + esc(p.author)
          + (p.full ? ' · 全篇 ' + p.excerptCount + ' 句' : (p.excerptCount ? ' · 录 ' + p.excerptCount + ' 句' : ''))
          + (p.excerptCount && p.excerptCount < 8 ? ' · 摘录本疑脱一句,待纸书核对' : '') + '</p>'
          + (p.lines || []).map((l: string) => '<p class="pd-line">' + esc(l) + '</p>').join('')
          + notes
          + (p.source && p.source.page ? '<p class="pd-page">谱注第 ' + p.source.page + ' 页</p>' : '')
          + '</section>';
      }).join('');
    }
    const pages = list.map((p: any) => p.source && p.source.page)
      .filter(Boolean).filter((v: unknown, i: number, a: unknown[]) => a.indexOf(v) === i);
    foot.textContent = pages.length ? '出处:' + pages.map((n: unknown) => '第 ' + n + ' 页').join('、')
      : '出处:谱注(页码待核)';
  }

  function setTab(set: string): void {
    currentSet = set;
    if (!drawer) return;
    Array.prototype.forEach.call(drawer.querySelectorAll('.pd-tab'), (b: HTMLElement) => {
      const on = b.getAttribute('data-set') === set;
      b.classList.toggle('on', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
  }

  let pushedForPoem = false;   /* 本次诗卷是否压入过历史记录 */

  function openPoem(id: string, set?: string, fromHistory?: boolean): void {
    if (!drawer || !titleEl || !subEl) return;
    const scene = sceneById(id);
    if (!scene) return;
    const wasHidden = drawer.hidden;
    if (wasHidden) lastFocus = document.activeElement;
    currentScene = id;
    set = set || 'qing';
    titleEl.textContent = scene.displayName || scene.name;
    subEl.textContent = authorList(id) || '诗卷待补';
    setTab(set);
    renderBody(id, set);
    /* v2.7.1:换一首诗要把面板卷回顶部——否则读完长诗滚到底,再开另一首
       会先看到中后段,像是"诗没开头" */
    const panel = drawer.querySelector('.poem-drawer-panel');
    if (panel) panel.scrollTop = 0;
    drawer.hidden = false;
    document.body.style.overflow = 'hidden';
    /* v2.7.1:首开压一条历史记录,"后退"才是关诗卷而不是离开页面;
       换一首 / 由 popstate 触发则只替换,避免把历史塞满 */
    const hash = '#poem-' + id;
    try {
      if (location.hash === hash || fromHistory) {
        history.replaceState({ poem: id }, '', hash);
      } else if (wasHidden && !pushedForPoem) {
        history.pushState({ poem: id }, '', hash);
        pushedForPoem = true;
      } else {
        history.replaceState({ poem: id }, '', hash);
      }
    } catch { /* file:// 下历史 API 可能受限,忽略 */ }
    if (btnClose) btnClose.focus();
  }

  function closePoem(fromPop?: boolean): void {
    if (!drawer || drawer.hidden) return;
    drawer.hidden = true;
    document.body.style.overflow = '';
    if (!fromPop && pushedForPoem) {
      /* 我们自己压的记录:回退一步,URL 与历史都回到开卷前 */
      pushedForPoem = false;
      try { history.back(); } catch { /* 同上 */ }
    } else {
      try {
        history.replaceState(null, '', location.pathname + location.search);
      } catch { /* 同上 */ }
    }
    if (lastFocus && (lastFocus as HTMLElement).focus) (lastFocus as HTMLElement).focus();
    else if (btnOpen) btnOpen.focus();
  }

  /* ---------- 事件 ---------- */
  /* v2.7:景名「单击即开卷」。预览改由 hover/键盘聚焦触发 */
  if (grid) {
    grid.addEventListener('click', (e: Event) => {
      const t = e.target as HTMLElement;
      const b = t.closest ? t.closest('.poem-chip') : null;
      if (!b) return;
      const id = b.getAttribute('data-scene') || '';
      renderPreview(id);
      openPoem(id, 'qing');
    });
    grid.addEventListener('mouseover', (e: Event) => {
      const t = e.target as HTMLElement;
      const b = t.closest ? t.closest('.poem-chip') : null;
      if (!b || b.getAttribute('data-scene') === currentScene) return;
      renderPreview(b.getAttribute('data-scene') || '');
    });
    grid.addEventListener('focusin', (e: FocusEvent) => {
      const t = e.target as HTMLElement;
      const b = t.closest ? t.closest('.poem-chip') : null;
      if (!b) return;
      renderPreview(b.getAttribute('data-scene') || '');
    });
  }
  if (btnOpen) {
    btnOpen.addEventListener('click', () => {
      openPoem(currentScene || (DATA && DATA.scenes && DATA.scenes[0].id) || '', 'qing');
    });
  }
  if (btnClose) btnClose.addEventListener('click', () => closePoem());
  if (drawer) {
    drawer.addEventListener('click', (e: Event) => {
      const t = e.target as HTMLElement;
      if (t.hasAttribute && t.hasAttribute('data-close-poem')) closePoem();
      const tab = t.closest ? t.closest('.pd-tab') : null;
      if (tab && currentScene) {
        const set = tab.getAttribute('data-set') || 'qing';
        setTab(set);
        renderBody(currentScene, set);
      }
    });
    /* 焦点不逃出面板 + Esc 关闭 */
    drawer.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); closePoem(); return; }
      if (e.key !== 'Tab') return;
      const panel = drawer.querySelector('.poem-drawer-panel');
      if (!panel) return;
      const focusables = panel.querySelectorAll('button, [href], input, [tabindex]:not([tabindex="-1"])');
      if (!focusables.length) return;
      const first = focusables[0], last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); (last as HTMLElement).focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); (first as HTMLElement).focus(); }
    });
  }

  /* 深链:#poem-<id> */
  function fromHash(): boolean {
    const m = /^#poem-([\w-]+)$/.exec(location.hash || '');
    if (!m) return false;
    const id = m[1];
    if (!sceneById(id)) return false;
    renderPreview(id);
    openPoem(id, 'qing');
    return true;
  }
  window.addEventListener('hashchange', () => {
    if (!fromHash() && drawer && !drawer.hidden) closePoem();
  });

  /* v2.7.1:popstate(浏览器后退/前进)——有 #poem- 就开卷,没有就收起 */
  window.addEventListener('popstate', () => {
    const m = /^#poem-([\w-]+)$/.exec(location.hash || '');
    if (m && sceneById(m[1])) {
      pushedForPoem = true;
      openPoem(m[1], 'qing', true);
    } else if (drawer && !drawer.hidden) {
      pushedForPoem = false;
      closePoem(true);
    }
  });

  /* ---------- 初始化 ---------- */
  if (DATA && DATA.scenes && DATA.scenes.length) {
    renderPreview(DATA.scenes[0].id);
  } else if (preview) {
    preview.innerHTML = '<p class="pp-line">诗卷待补</p>';
  }
  if (!fromHash() && btnOpen) btnOpen.disabled = false;

  /* 供验收/调试 */
  w.__POEM_UI = {
    open: openPoem, close: closePoem, preview: renderPreview,
    scene: () => currentScene,
  };
}
