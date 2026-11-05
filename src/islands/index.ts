/* 交互岛注册表 —— Vue 化第二阶段(交互岛收编)。
 *
 * 每个岛屿的构成:
 *   1. tools/build-prepare.mjs 把分章内控制条的原字节抽到 src/islands/<name>.island.html,
 *      外壳元素保留在分章里并标记 data-vue-island="<name>";
 *   2. vite 的 islandCompile 插件把 .island.html 编译成 Vue render 函数(whitespace preserve);
 *   3. 本文件按名称注册组件;main.ts 在 runLegacy() **之前** mountIslands()——
 *      岛屿 DOM 就位后,legacy 照常按 id 绑定事件并接管运行时行为(textContent/classList/value)。
 *
 * 渲染权在 Vue,行为权暂由 legacy 承担(逐岛迁移,见 README 路线图);
 * 岛屿 DOM 与原字节的逐字节等价由 verify 的「交互岛等价门」把关。 */
import { createApp, type Component } from 'vue';
import EraTimelineRender from './heat-timeline.island.html?island';
import PoemDrawerRender from './poem-drawer.island.html?island';
import LayerPanelRender from './layer-panel.island.html?island';

/* 岛屿组件:render 由构建期从分章/生成壳的原字节编译而来(行为后续逐岛迁入) */
type IslandComponent = { name: string; render: (ctx?: unknown, cache?: unknown) => unknown };

const REGISTRY: Record<string, IslandComponent> = {
  'heat-timeline': { name: 'EraTimeline', render: EraTimelineRender },
  'poem-drawer': { name: 'PoemDrawer', render: PoemDrawerRender },
  'layer-panel': { name: 'LayerPanel', render: LayerPanelRender },
};

export function mountIslands(): void {
  const hosts = document.querySelectorAll<HTMLElement>('[data-vue-island]');
  hosts.forEach((el) => {
    const name = el.getAttribute('data-vue-island') || '';
    const comp = REGISTRY[name];
    if (!comp) {
      console.error('[islands] 未注册的交互岛:' + name);
      return;
    }
    createApp(comp as Component).mount(el);
  });
  const registered = Object.keys(REGISTRY).length;
  if (hosts.length !== registered) {
    console.warn(`[islands] 页面岛屿数(${hosts.length})与注册表(${registered})不一致`);
  }
}
