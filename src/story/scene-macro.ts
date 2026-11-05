/* 场景 03:全国路线 —— 钉住 + 年表尺(240vh)
 * 第四阶段:由 useScrollStory.ts 同名 IIFE 分解(原 255-323 行)。
 * 只在阶段变化时调用既有 showStage(经 #stageRange 的 input 事件复用——
 * 与宏观图组件的既有 DOM 事件契约,冻结不改)。 */
import { zouScrollAdd } from './zou-scroll';

export function initSceneMacro(): void {
  const scene = document.getElementById('sceneMacro');
  if (!scene) return;
  const steps = Array.prototype.slice.call(scene.querySelectorAll('.macro-step')) as HTMLElement[];
  const range = document.getElementById('stageRange') as HTMLInputElement;
  const yr = document.getElementById('yearRuler') as HTMLInputElement;
  const yrNow = document.getElementById('yrNow');
  const big = document.querySelector('#macroYear b');
  let lastStage = 0, syncUntil = 0;

  /* 各阶段代表年（用于 HUD 与年表尺） */
  const YEAR: Record<number, number> = { 1: -500, 2: 100, 3: 400, 4: 800, 5: 1100, 6: 1450, 7: 1750, 8: 2000 };
  const PLACE: Record<number, string> = { 1: '邹城 · 商丘', 2: '范阳 · 涿州', 3: '江南 · 赣北', 4: '光州 · 宜黄',
    5: '宜黄 · 泰宁', 6: '湘鄂 · 麻城', 7: '川渝 · 台湾', 8: '赣鄂湘' };
  function fmtY(y: number): string { return y < 0 ? '前' + Math.abs(y) : String(y); }

  function setStage(st: number, fromScroll?: boolean): void {
    st = Math.max(1, Math.min(8, st | 0));
    if (st === lastStage) return;
    lastStage = st;
    if (range && +range.value !== st) {
      range.value = String(st);
      range.dispatchEvent(new Event('input', { bubbles: true }));
      /* 滚动叙事需要'全路线 + 当前阶段高亮'，避免被切成独占只剩几条线 */
      const all = document.getElementById('btnAll');
      if (all && !all.classList.contains('on')) all.click();
    }
    steps.forEach((s) => {
      s.classList.toggle('on', +(s.getAttribute('data-stage') || 0) === st);
    });
    if (big) big.textContent = fmtY(YEAR[st]);
    if (yr && !fromScroll) yr.value = String(YEAR[st]);
    if (yrNow) yrNow.textContent = '公元 ' + fmtY(YEAR[st]);
    if (window.__zouHUD) window.__zouHUD(2, fmtY(YEAR[st]), PLACE[st]);
  }

  zouScrollAdd(scene, (p) => {
    if (document.body.classList.contains('is-reading')) return;
    if (Date.now() < syncUntil) return;         /* 年表尺拖动后 400ms 内不反向覆盖 */
    if (!window.__zouMoved || !window.__zouMoved()) return;
    setStage(Math.floor(p * 8) + 1);
  });

  if (yr) {
    yr.addEventListener('input', () => {
      const y = +yr.value;
      let st = 1;
      if (y >= 1912) st = 8; else if (y >= 1636) st = 7; else if (y >= 1271) st = 6;
      else if (y >= 960) st = 5; else if (y >= 581) st = 4; else if (y >= 220) st = 3;
      else if (y >= -221) st = 2;
      syncUntil = Date.now() + 400;
      setStage(st, true);
      const top = scene.getBoundingClientRect().top + window.scrollY;
      const span = Math.max(1, scene.offsetHeight - window.innerHeight);
      window.scrollTo({ top: top + span * (st - 0.5) / 8, behavior: 'instant' as ScrollBehavior });
    });
  }
  /* 初始化只同步 UI，不改写深链带来的阶段（?s=） */
  (function initFromRange(): void {
    const st = +(range && range.value) || 8;
    lastStage = st;
    steps.forEach((s) => { s.classList.toggle('on', +(s.getAttribute('data-stage') || 0) === st); });
    if (big) big.textContent = fmtY(YEAR[st]);
    if (yr) yr.value = String(YEAR[st]);
    if (yrNow) yrNow.textContent = '公元 ' + fmtY(YEAR[st]);
  })();
}
