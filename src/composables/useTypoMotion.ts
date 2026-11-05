/* 文字动效层 —— 第三阶段 PR-5:由 js/typo-motion.js 移植退役。
 * 三件事:标题逐字上浮 / 并列文字依次渐现 / 统计句数字滚动;印幕跳过与回访记忆。
 * 规则(与 motion.js 同源):只动 transform/opacity/clip-path;隐藏态一律由 JS 挂类才出现;
 * reduced-motion / ?motion=0 / body.is-reading 直接跳过;beforeprint 全部置终态。
 * 编排:main.ts 在 runLegacy() 之后调用 initTypoMotion()。 */

export function initTypoMotion(): void {
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
  if (reduce && reduce.matches) return;
  if (/[?&]motion=0/.test(location.search)) return;

  /* ---------- 工具 ---------- */
  function onSee(el: Element, opts: IntersectionObserverInit | undefined, cb: () => void): void {
    if (!('IntersectionObserver' in window)) { cb(); return; }
    const io = new IntersectionObserver(es => {
      es.forEach(en => {
        if (!en.isIntersecting) return;
        requestAnimationFrame(() => cb());
        io.disconnect();
      });
    }, opts || { threshold: .25 });
    io.observe(el);
  }

  /* 逐字拆分:只拆纯文本、不超过 12 字的标题(中文逐字才有节奏,长句拆了拖沓) */
  function splitChars(el: HTMLElement | null): boolean {
    if (!el || (el.dataset as { tmSplit?: string }).tmSplit) return false;
    if (el.children.length) return false;
    const text = el.textContent;
    if (!text || text.length > 12) return false;
    el.setAttribute('aria-label', text);            /* 读屏读整句 */
    el.textContent = '';
    const frag = document.createDocumentFragment();
    for (let i = 0; i < text.length; i++) {
      const s = document.createElement('span');
      s.className = 'tm-ch';
      s.setAttribute('aria-hidden', 'true');
      s.textContent = text.charAt(i);
      s.style.transitionDelay = (i * 55) + 'ms';
      frag.appendChild(s);
    }
    el.appendChild(frag);
    el.dataset.tmSplit = '1';
    return true;
  }

  /* ---------- 1) 标题逐字上浮 ---------- */
  (function titles() {
    const h1 = document.querySelector<HTMLElement>('.hb-title');
    if (h1 && splitChars(h1)) {
      h1.classList.add('tm-split');
      setTimeout(() => h1.classList.add('tm-in'), 160);  /* 与首屏开镜同步 */
    }
    Array.prototype.forEach.call(
      document.querySelectorAll('.sec-head h2, .pl-head h2, .text-band > .wrap > h2, .scroll-head h2'),
      (h: HTMLElement) => {
        if (h.closest('.scene')) return;            /* 钉住场景不参与 */
        if (!splitChars(h)) return;
        h.classList.add('tm-split');
        onSee(h, { threshold: .6 }, () => h.classList.add('tm-in'));
      });
  })();

  /* hero 副题:右缘擦除一次(与名号错峰) */
  (function stand() {
    const st = document.querySelector<HTMLElement>('.hb-stand');
    if (!st) return;
    st.classList.add('tm-wipe');
    setTimeout(() => st.classList.add('tm-in'), 520);
  })();

  /* ---------- 印幕跳过与回访记忆(v3.6 修复 P0-2/P2-8) ---------- */
  (function veilSkip() {
    const veil = document.getElementById('veil');
    if (!veil) return;
    const v: HTMLElement = veil;   /* 闭包内保持非空收窄 */
    function kill(remember: boolean): void {
      if (v.parentNode) v.parentNode.removeChild(v);
      try { if (remember) sessionStorage.setItem('zou-veil-seen', '1'); } catch { /* 隐私模式忽略 */ }
    }
    const skip = document.getElementById('veilSkip');
    if (skip) skip.addEventListener('click', () => kill(true));
    v.addEventListener('animationend', (e: AnimationEvent) => {
      if (e.animationName === 'veilOut') kill(true);   /* 自动揭幕也算已看过 */
    });
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      if ((e.key === 'Escape' || e.key === ' ') && document.getElementById('veil')) kill(true);
    });
    /* CSS 动画兜底 —— 第四阶段 AE 层可经 window.__ZOU_VEIL_HOLD_UNTIL 延长印幕寿命:
     * 到达原 3.2s 兜底点时若 AE 层登记了更晚的 hold 截止,则顺延至截止再收;
     * AE 层未激活(回访/降级)时行为与原版逐字节一致(3.2s 直接收)。 */
    setTimeout(function fallbackTick(): void {
      if (!document.getElementById('veil')) return;   /* 已离场 */
      const hold = (window as unknown as { __ZOU_VEIL_HOLD_UNTIL?: number }).__ZOU_VEIL_HOLD_UNTIL;
      const now = Date.now();
      if (hold && now < hold) {
        setTimeout(fallbackTick, Math.min(hold - now, 500));
        return;
      }
      kill(true);
    }, 3200);
    try { if (sessionStorage.getItem('zou-veil-seen') === '1') kill(false); } catch { /* 同上 */ }
  })();

  const STAG = '.il-cols, .bf-list, .mig-teaser, .pl-sheet, .hb-dark, .hb-accent, .fb-meta, .mf-core';
  Array.prototype.forEach.call(document.querySelectorAll(STAG), (box: HTMLElement) => {
    if (box.closest('.scene')) return;
    const kids = box.children;
    if (!kids.length || kids.length > 14) return;
    box.classList.add('tm-stagger');
    Array.prototype.forEach.call(kids, (k: HTMLElement, i: number) => {
      k.style.transitionDelay = Math.min(i * 70, 560) + 'ms';
    });
    if (box.closest('details')) {
      /* 折叠区关闭时没有盒子,IO 量不到 —— 展开即进场(同 motion.js 防线) */
      document.addEventListener('toggle', (e: Event) => {
        const t = e.target as HTMLElement;
        if (t.contains && t.contains(box)) box.classList.add('tm-in');
      }, true);
    }
    onSee(box, { threshold: .15 }, () => box.classList.add('tm-in'));
  });

  /* ---------- 3) 统计句数字滚动(只用页面上已有的真数字) ---------- */
  let statFinish = (): void => {};
  (function statCount() {
    const line = document.querySelector('.stat-line');
    if (!line) return;
    const nums = [].filter.call(line.querySelectorAll('b'), (b: HTMLElement) =>
      /^\d+$/.test(b.textContent!.trim())) as HTMLElement[];
    if (!nums.length) return;
    const original = nums.map(b => b.textContent!.trim());
    statFinish = () => {
      nums.forEach((b, i) => { b.textContent = original[i]; });
    };
    let played = false;
    onSee(line, { threshold: .5 }, () => {
      if (played) return;
      played = true;
      nums.forEach((b, i) => {
        const to = +original[i], t0 = performance.now(), dur = 950;
        (function step(t: number): void {
          const k = Math.min(1, (t - t0) / dur);
          const e = 1 - Math.pow(1 - k, 3);
          b.textContent = String(Math.round(to * e));
          if (k < 1) requestAnimationFrame(step);
          else b.textContent = original[i];          /* 落回原文,一个字都不差 */
        })(t0);
      });
    });
  })();

  /* ---------- 终态保障 ---------- */
  function allIn(): void {
    [].forEach.call(document.querySelectorAll('.tm-split,.tm-stagger,.tm-wipe'), (el: Element) => {
      el.classList.add('tm-in');
    });
    statFinish();
    const veil = document.getElementById('veil');   /* 印幕兜底:任何终态路径都立即揭幕 */
    if (veil && veil.parentNode) veil.parentNode.removeChild(veil);
  }
  window.addEventListener('beforeprint', allIn);
  /* 进入阅读模式(长页)时全部显示 —— 监听与 motion.js 同一开关 */
  document.addEventListener('click', (e: Event) => {
    const t = e.target as HTMLElement;
    if (t.closest && t.closest('#motionToggle,.motion-toggle')) {
      setTimeout(allIn, 50);
    }
  }, true);
}
