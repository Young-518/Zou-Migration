/* 应用层编排入口(Vue 3 重构 · 第三阶段完成:legacy 九模块全部退役)。
 * 执行顺序(与原站"18 个 script 顺序执行"逐项等价):
 *   1. head 行内脚本(motion/no-veil 门控)在 HTML 里最先执行;
 *   2. Vue 先行:外壳(#app:守卫+?debug=1 徽标)与交互岛(data-vue-island,DOM 与
 *      分章原字节语义等价)挂载——后续 init* 按 id 绑定时 DOM 已就位;
 *   3. classic 资产层(vendor×3、hist×3、china_provinces)按原 CHAIN 顺序执行;
 *   4. Pinia 数据仓装载数据(API → 静态兜底)→ 数据写回 window 全局;
 *   5. 退役模块按原模块序由本文件编排:
 *      legacy-ports(migration-data/migration-charts/app,Typed 移植,四图经 useLeafletMap)
 *      + composables(scroll-story/poem-ui/motion/v31 底图/typo-motion/scroll-reel)。
 * 顶层 await 保持:推迟 DOMContentLoaded,v31 的 readyState 守卫语义与原站一致。
 * 启动全程 try/catch:任一环节失败由 BootGuard(已挂载)即时显示错误卡。 */
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { useDataStore } from './stores/data';
import { installBootErrorCapture, recordBootFailure } from './legacy/errors';
import { mountIslands } from './islands';
import { initMigrationData } from './legacy-ports/migration-data';
import { initMigrationCharts } from './legacy-ports/migration-charts';
import { initAppMaps } from './legacy-ports/app';
import { initScrollStory } from './composables/useScrollStory';
import { initPoemUi } from './composables/usePoemUi';
import { initMotionReveal } from './composables/useMotionReveal';
import { initBasemapSwitcher } from './composables/useBasemapSwitcher';
import { initTypoMotion } from './composables/useTypoMotion';
import { initScrollReel } from './composables/useScrollReel';
import { initOpeningAe } from './composables/useOpeningAe';
import { initJourneyScroll } from './composables/useJourneyScroll';
import { initStarfield } from './composables/useStarfield';
import { initInkFlow } from './composables/useInkFlow';
import './styles/opening-ae.css';
import './styles/transformation.css';

/* classic 资产层:vendor×3 + 大地理数据×4,按原 CHAIN 顺序在构建期读入源码、
 * 运行期以全局脚本语义执行(等价原 <script src> 顺序加载;UMD 的 this 绑 window)。
 * 注意保持静态 import:动态 import 会切出独立 chunk,与单文件内联策略冲突。 */
import leafletCode from '../public/js/vendor/leaflet.js?raw';
import d3Code from '../public/js/vendor/d3.min.js?raw';
import echartsCode from '../public/js/vendor/echarts.min.js?raw';
import histJiangshanCode from '../public/data/hist_jiangshan.js?raw';
import chinaProvCode from '../public/data/china_provinces.js?raw';

/* 错误捕获最先安装:classic 阶段的失败也要能被 BootGuard 接住 */
installBootErrorCapture();

/* Vue 外壳与交互岛先挂载:init* 按 id 绑定时岛屿 DOM 已就位 */
const app = createApp(App);
app.use(createPinia());
const store = useDataStore();
app.mount('#app');
mountIslands();

try {
  const CLASSIC: Array<[string, string]> = [
    ['js/vendor/leaflet.js', leafletCode],
    ['js/vendor/d3.min.js', d3Code],
    ['js/vendor/echarts.min.js', echartsCode],
    ['data/hist_jiangshan.js', histJiangshanCode],
    ['data/china_provinces.js', chinaProvCode],
  ];
  for (const [name, code] of CLASSIC) {
    try {
      new Function(code).call(window);
    } catch (e: any) {
      throw new Error('[classic] ' + name + ' 执行失败:' + (e && e.message));
    }
  }

  const data = await store.load();
  const w = window as any;
  w.MIGR = data.migr;
  w.ZOU_POEMS = data.poems;
  if (data.meta) w.ZOU_META = data.meta;
  document.documentElement.setAttribute('data-data-source', data.source);

  /* 第三阶段终点:九个退役模块按原模块序由 Vue 编排 */
  initMigrationData();      /* window.MIG 数据整形(原 migration-data.js) */
  initMigrationCharts();    /* 四幅 ECharts 图(原 migration-charts.js,useECharts) */
  initAppMaps();            /* 四张 Leaflet 图+时轴/检索/分享(原 app.js,useLeafletMap) */
  initScrollStory();        /* 滚动叙事引擎(原 scroll-story.js) */
  initPoemUi();             /* 诗卷抽屉行为(原 poem-ui.js) */
  initMotionReveal();       /* 进场动效(原 motion.js) */
  initBasemapSwitcher();    /* 底图切换/导出(原 v31.js) */
  initTypoMotion();         /* 文字动效(原 typo-motion.js) */
  initOpeningAe();          /* 开场印幕 AE 升级层(逐字揭示+光斑拖尾;叠加层,无动效/回访路径零改动) */
  initScrollReel();         /* 卷轴驱动(原 scroll-reel.js) */
  /* ===== 改造探索新增(详见 改造方案.md) ===== */
  initJourneyScroll();      /* 迁路长卷:ScrollTrigger pin+scrub 驱动七站六段(reduced-motion 降级) */
  initStarfield();          /* 迁徙星图:七曜星轨 canvas + CountUp(入幕才启动 rAF) */
  initInkFlow();            /* 全页墨晕层:指针交互水墨流体(multiply 叠加,reduced-motion 禁用) */
  /* 二期撤项:文字部分按用户指令恢复原版(inkReveal/vScroll 已移除);控件重皮见 transformation.css */
} catch (e: unknown) {
  /* 启动失败:记录给 BootGuard(已挂载,经 zou-boot-error 事件即时显示错误卡) */
  recordBootFailure(e);
  console.error('[boot] 启动失败:' + (e instanceof Error ? e.message : String(e)));
}
