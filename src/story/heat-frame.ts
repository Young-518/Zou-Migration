/* 01 姓源序章图兜底 —— 第四阶段:由 useScrollStory.ts 同名 IIFE 分解(原 670-687 行)。
 * 容器变高后 Leaflet 仍按旧尺寸绘制,首帧补一次 invalidateSize + 贴合国界。 */
import type { StoryMapHandle } from '../maps/types';

export function initHeatFrame(): void {
  const card = document.querySelector('#sceneHeat .card-heat .map') as HTMLElement | null;
  const map = (window._zou && window._zou.mapHeat) as StoryMapHandle | null;
  if (!card || !map) return;
  let done = false;
  function fit(): void {
    if (done) return;
    if (!card!.offsetHeight) return;
    done = true;
    map!.invalidateSize();
    map!.fitBounds([[18, 73], [54, 135]], { padding: [12, 12], animate: false });
  }
  requestAnimationFrame(fit);
  setTimeout(fit, 600);
  window.addEventListener('resize', () => {
    map!.invalidateSize();
  }, { passive: true });
}
