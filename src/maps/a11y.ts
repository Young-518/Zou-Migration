/* 键盘与屏幕阅读器支持组件 —— 第四阶段:由 legacy-ports/app.ts 同名小节分解。
 * 职责:图例/迁徙链清单/名人卡可聚焦(Enter/空格触发)、图例 aria-checked 同步、
 *       时间轴 aria-valuetext、Esc 关闭搜索结果与灯箱、Shift+←/→ 切换①号阶段。
 * 顺序锚点:在 URL 状态组件之后、页尾组件之前调用(原文本序)。 */
import { R, migr } from './runtime';
import { showStage, stageLegendEl, stageRangeEl, stopPlay } from './macro-timeline';
import type { LMap } from './types';

export function initA11y(): void {
  const M = migr();
  /* 图例 / 迁徙链清单 / 名人卡：可聚焦 + 回车空格触发 */
  function keyable(el: HTMLElement | null, role?: string): void {
    if (!el || el.getAttribute('data-keyable')) return;
    el.setAttribute('data-keyable', '1');
    el.setAttribute('tabindex', '0');
    el.setAttribute('role', role || 'button');
    el.addEventListener('keydown', (ev: KeyboardEvent) => {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        el.click();
      }
    });
  }
  Array.prototype.forEach.call(stageLegendEl().children, (li: HTMLElement) => { keyable(li, 'checkbox'); });
  Array.prototype.forEach.call(document.querySelectorAll('#chainList li'), (li: HTMLElement) => {
    keyable(li);
  });
  Array.prototype.forEach.call(document.querySelectorAll('.notable-card'), (c: HTMLElement) => {
    keyable(c);
  });
  /* 图例状态同步 aria-checked */
  function syncLegendAria(): void {
    Array.prototype.forEach.call(stageLegendEl().children, (li: HTMLElement) => {
      li.setAttribute('aria-checked', li.classList.contains('off') ? 'false' : 'true');
    });
  }
  stageLegendEl().addEventListener('click', () => { setTimeout(syncLegendAria, 0); });
  syncLegendAria();
  /* 时间轴：aria-valuetext 说明当前阶段 */
  function syncRangeAria(): void {
    const range = stageRangeEl();
    const st = M.stages[+range.value - 1];
    if (st) range.setAttribute('aria-valuetext',
      '第' + st.id + '阶段 ' + st.name + '（' + st.era + '）');
  }
  const range = stageRangeEl();
  range.addEventListener('change', syncRangeAria);
  range.addEventListener('input', syncRangeAria);
  syncRangeAria();
  /* Esc：关闭搜索结果与统计图灯箱 */
  document.addEventListener('keydown', (ev: KeyboardEvent) => {
    if (ev.key !== 'Escape') return;
    const res = document.getElementById('searchResults');
    if (res) res.hidden = true;
    const lb = document.querySelector('.lightbox');
    if (lb) lb.classList.remove('on');
  });
  /* Shift + ←/→：地图获得焦点后切换①号阶段（不干扰 Leaflet 默认的平移键） */
  ([R.maps.macro, R.maps.chain, R.maps.micro] as LMap[]).forEach((m) => {
    const el = m.getContainer();
    el.setAttribute('tabindex', '0');
    el.addEventListener('keydown', (ev: KeyboardEvent) => {
      if (!ev.shiftKey) return;
      if (ev.key !== 'ArrowLeft' && ev.key !== 'ArrowRight') return;
      const cur = +stageRangeEl().value;
      const next = ev.key === 'ArrowRight' ? Math.min(8, cur + 1) : Math.max(1, cur - 1);
      if (next === cur) return;
      ev.preventDefault();
      ev.stopPropagation();
      stopPlay();
      showStage(next);
      syncRangeAria();
    }, true);
  });
}
