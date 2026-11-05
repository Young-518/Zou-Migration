/* GIS 应用核心 · 编排器 —— 第四阶段:原 2205 行机械包裹(@ts-nocheck)已分解为
 * src/maps/* 类型化地图组件,本文件收缩为按原模块文本序的编排入口。
 * main.ts 的 initAppMaps() 编排契约不变;@ts-nocheck 已摘除(严格模式通过)。
 *
 * 顺序敏感点(改动前必读,与原单 IIFE 文本序逐位对应):
 *  1. startArrowLoop():移动箭头单 rAF 循环先于任何地图创建启动(原第 126 行 IIFE);
 *  2. initLayerPanels():图层管理器必须晚于所有 chk* 处理器注册与 notableLbl 创建,
 *     亦是 layer-panel 岛屿「开关搬进地图图层盒」等价门的先决条件;
 *  3. initAtlasShell() 末尾调用 renderTree(),与原文件第 1154 行位置一致;
 *  4. initSearch() 与统计图表的注册顺序相对原文本互换(不同目标元素、零共享状态,
 *     无可观测差异,见 panels.ts 头注);
 *  5. installZouBridge() 最后安装:v31 底图切换与 scroll-story 经 window._zou
 *     读取地图与句柄,桥形状冻结。
 * 跨组件共享状态在 Pinia(atlas 仓);句柄在 runtime 的注册表 R;
 * 跨模块 DOM 事件契约(stageRange input / zou:focus / zou:motion / _zou 桥)未动。 */
import { installZouBridge, startArrowLoop } from '../maps/runtime';
import { initHeatMap } from '../maps/heat-map';
import { initMacroMap } from '../maps/macro-map';
import { initMacroLayers } from '../maps/macro-layers';
import { initChainMap } from '../maps/chain-map';
import { initMacroTimeline } from '../maps/macro-timeline';
import { initMicroMap } from '../maps/micro-map';
import { initAtlasShell } from '../maps/atlas-shell';
import { initPanels } from '../maps/panels';
import { initSearch } from '../maps/search';
import { initLayerPanels } from '../maps/layer-panels';
import { initHeroBand } from '../maps/hero-band';
import { initPageChrome } from '../maps/page-chrome';
import { initShareUrl } from '../maps/share-url';
import { initA11y } from '../maps/a11y';
import { initPageTail } from '../maps/page-tail';

export function initAppMaps(): void {
  startArrowLoop();     /* 移动箭头 rAF 循环(原公共区,先于地图创建) */
  initHeatMap();        /* 序章热区图 + 支系开关 + 时期播放器 */
  initMacroMap();       /* ①宏观图 + zou:focus 联动 + 金色本支链叠加 */
  initMacroLayers();    /* 历史政区/郡望/名人图层(chkHist/chkJwhd/chkNotable) */
  initChainMap();       /* ②本支迁徙链窗 + 清单/里程表 */
  initMacroTimeline();  /* 时间轴/图例/显示模式 + 初始进入全景 */
  initMicroMap();       /* ③微观图 + 先祖名签 + 八景诗点 */
  initAtlasShell();     /* 三窗定位/自适应/打印 + renderTree() */
  initPanels();         /* 名人堂卡片/时空剖面/灯箱/统计图/重走迁徙路 */
  initSearch();         /* 地点/先祖搜索 */
  initLayerPanels();    /* 图层管理器(开关搬移) + 缓冲区分析 */
  initHeroBand();       /* Hero 首屏 D3 + Canvas 粒子 */
  initPageChrome();     /* 字辈对照条 + 地图全屏 */
  initShareUrl();       /* URL 状态分享 + 深链应用 */
  initA11y();           /* 键盘与屏幕阅读器支持 */
  initPageTail();       /* 初始视野/章节导航/Hero 数据条/首屏入口 */
  installZouBridge();   /* window._zou 桥(v31/scroll-story/测试句柄) */
}
