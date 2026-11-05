/* 滚动叙事引擎 · 编排器 —— 第四阶段:原 761 行机械包裹(@ts-nocheck)已分解为
 * src/story/* 类型化组件,本文件收缩为按原 IIFE 文本序的编排入口。
 * main.ts 的 initScrollStory() 编排契约不变;@ts-nocheck 已摘除(严格模式通过)。
 *
 * 顺序敏感点(与原文件文本序逐位对应):
 *  1. initInputState():手势标记最先注册(原 21-26 行);
 *  2. initZouScroll():引擎 + scroll/resize/fonts/REDUCE 监听 + 600ms 补测(原 33-87 行);
 *  3. initMotionToggle():动效按钮 + applyMotion 初始态(原 89-153 行,zou:motion 首发在此);
 *  4. initStoryHud():章节轴 + HUD + __zouHUD(0) + 页脚收起 + 章节高亮 + Hero 推近
 *     (原 155-248 行,三个子 IIFE 合并为一个 init,内部保持原文本序);
 *  5. 场景 03 → 04 → 01 → 06 字辈点灯 → 序章兜底 → 05 下潜(原 255-758 行)。
 * 跨组件契约冻结:ZouScroll / __zouHUD / __zouMoved / zou:motion / #stageRange 与
 * #heatRange 的 input 事件复用通道;共享状态在 Pinia(story 仓)。 */
import { initInputState } from '../story/input-state';
import { initZouScroll } from '../story/zou-scroll';
import { initMotionToggle } from '../story/motion-toggle';
import { initStoryHud } from '../story/story-hud';
import { initSceneMacro } from '../story/scene-macro';
import { initSceneChain } from '../story/scene-chain';
import { initSceneHeat } from '../story/scene-heat';
import { initZibeiLight } from '../story/zibei-light';
import { initHeatFrame } from '../story/heat-frame';
import { initSceneDive } from '../story/scene-dive';

export function initScrollStory(): void {
  initInputState();     /* 手势标记(首屏/深链位置保护) */
  initZouScroll();      /* 单例 rAF 滚动引擎 */
  initMotionToggle();   /* 动效开关(速览模式) */
  initStoryHud();       /* 章节高亮 + HUD + 手卷进度轴 + Hero 推近 */
  initSceneMacro();     /* 场景 03:全国路线钉住 + 年表尺 */
  initSceneChain();     /* 场景 04:本支七站书脊折叠 + 盖章 */
  initSceneHeat();      /* 场景 01:姓源三步卡 */
  initZibeiLight();     /* 06:字辈点灯 */
  initHeatFrame();      /* 01:序章图首帧兜底 */
  initSceneDive();      /* 场景 05:双洲下潜 */
}
