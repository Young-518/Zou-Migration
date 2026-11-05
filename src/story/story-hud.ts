/* 章节高亮 + HUD + 手卷进度轴 —— 第四阶段:由 useScrollStory.ts 同名小节分解
 * (原 155-248 行:buildAxis / navHighlight / heroZoom)。
 * __zouHUD 契约冻结(场景 03/04/05 经它写年份与地点);当前章节镜像进 Pinia story 仓。 */
import { useStoryStore } from '../stores/story';
import { clamp01, motionOff } from './motion-state';

export const CHAPTERS: Array<{ id: string; no: string; name: string; year: string; place: string }> = [
  { id: 'secOrigin', no: '01', name: '姓源', year: '—', place: '齐鲁 · 邾国' },
  { id: 'secAtlas', no: '02', name: '图谱', year: '八期', place: '全国' },
  { id: 'secMacro', no: '03', name: '全国路线', year: '100', place: '范阳' },
  { id: 'sceneChain', no: '04', name: '本支七站', year: '1507', place: '双洲' },
  { id: 'sceneMicro', no: '05', name: '双洲微观', year: '1507', place: '清江 · 双洲' },
  { id: 'secAppendix', no: '06', name: '方法与附录', year: '—', place: '—' }
];

export function initStoryHud(): void {
  const store = useStoryStore();
  const CH = CHAPTERS;

  /* ---------- 手卷进度轴 + HUD ---------- */
  (function buildAxis(): void {
    const axis = document.createElement('nav');
    axis.className = 'story-axis';
    axis.setAttribute('aria-label', '章节进度轴');
    axis.innerHTML = CH.map((c, i) => {
      return '<a href="#' + c.id + '" data-i="' + i + '" title="' + c.no + ' ' + c.name + '">'
        + '<i></i></a>';
    }).join('');
    document.body.appendChild(axis);

    const hud = document.createElement('div');
    hud.className = 'story-hud';
    hud.setAttribute('aria-live', 'polite');
    hud.innerHTML = '<span class="hud-ch">姓源</span>'
      + '<b class="hud-year">—</b><span class="hud-place">齐鲁 · 邾国</span>';
    document.body.appendChild(hud);
    let last = -1, lastAt = 0, lastYear = '';
    /* chapterOnly=true 时只切章节与地点，不覆盖场景给出的年份 */
    window.__zouHUD = function (i: number, year?: string | null, place?: string | null, chapterOnly?: boolean): void {
      const now = Date.now();
      const y = chapterOnly ? lastYear : (year || CH[i].year);
      if (i === last && y === lastYear && now - lastAt < 500) return;
      last = i; lastAt = now; lastYear = y;
      store.setActiveChapter(i);
      hud.querySelector('.hud-ch')!.textContent = CH[i].name;
      hud.querySelector('.hud-year')!.textContent = y;
      hud.querySelector('.hud-place')!.textContent = place || CH[i].place;
      Array.prototype.forEach.call(axis.children, (a: HTMLElement, k: number) => {
        a.classList.toggle('on', k === i);
      });
    };
    window.__zouHUD(0);

    /* 页脚是满幅墨块：右侧手卷轴进去时收起来，避免压字 */
    const foot = document.getElementById('colophon');
    if (foot && 'IntersectionObserver' in window) {
      new IntersectionObserver((es) => {
        es.forEach((en) => { document.body.classList.toggle('at-end', en.isIntersecting); });
      }, { threshold: .12 }).observe(foot);
    }
  })();

  /* ---------- 章节高亮(可见集合驱动) ---------- */
  (function navHighlight(): void {
    const links: Record<string, HTMLElement> = {};
    Array.prototype.forEach.call(document.querySelectorAll('.chapnav .links a'), (a: HTMLAnchorElement) => {
      /* v2.7.1：href 指向 .sec-head（章节标题），高亮仍按 data-ch 对应的章节 id 匹配 */
      const key = a.getAttribute('data-ch') || (a.getAttribute('href') || '').replace('#', '');
      links[key] = a;
    });
    const secs = CH.map((c) => document.getElementById(c.id)).filter(Boolean) as HTMLElement[];
    if (!('IntersectionObserver' in window)) return;
    /* v3.6.6：改为「可见集合」驱动——印幕/卷轴/hero 区间内没有任何章节入带时,
       清空全部高亮,不再残留上一次的章节(修快速回滚到 hero 仍高亮 04 的问题) */
    const visible: Record<string, boolean> = {};
    const io = new IntersectionObserver((es) => {
      es.forEach((en) => { visible[en.target.id] = en.isIntersecting; });
      let activeId = '';
      CH.forEach((c) => { if (!activeId && visible[c.id]) activeId = c.id; });
      if (activeId) {
        Object.keys(links).forEach((k) => { links[k].classList.toggle('on', k === activeId); });
        const idx = CH.findIndex((c) => c.id === activeId);
        if (idx >= 0 && window.__zouHUD) window.__zouHUD(idx, null, null, true);
      } else {
        Object.keys(links).forEach((k) => { links[k].classList.remove('on'); });
      }
      const h = document.querySelector('.story-hud');
      if (h) h.classList.toggle('on', activeId === 'sceneMacro' || activeId === 'sceneChain');
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });
    secs.forEach((s) => { io.observe(s); });
  })();

  /* ---------- Hero 推近（仅前 100vh） ---------- */
  (function heroZoom(): void {
    const hero = document.querySelector('.hero-band');
    const band = document.getElementById('heroMap');
    const title = document.querySelector('.hero-title') as HTMLElement | null;
    if (!hero || !band) return;
    window.addEventListener('scroll', () => {
      if (motionOff()) { band!.style.transform = ''; return; }
      const p = clamp01(window.scrollY / (window.innerHeight || 800));
      if (p > 1) return;
      band!.style.transform = 'scale(' + (1 + 0.15 * p) + ')';
      if (title) title.style.letterSpacing = (0.22 - 0.06 * p).toFixed(3) + 'em';
    }, { passive: true });
  })();
}
