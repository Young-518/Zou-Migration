/* 真实用户手势标记 —— 第四阶段:由 useScrollStory.ts 原头部分解(原 21-26 行)。
 * 首屏/深链恢复的位置不被滚动叙事覆盖:wheel/touchstart/keydown/pointerdown
 * 任一真实手势即置位;window.__zouMoved() 契约保持(场景与测试经它读取)。 */
import { useStoryStore } from '../stores/story';

export function initInputState(): void {
  const store = useStoryStore();
  ['wheel', 'touchstart', 'keydown', 'pointerdown'].forEach((ev) => {
    window.addEventListener(ev, () => { store.markMoved(); }, { passive: true });
  });
  window.__zouMoved = () => store.moved;
}
