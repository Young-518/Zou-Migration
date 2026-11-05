/* Story 状态仓 —— 第四阶段(滚动叙事分解):原 useScrollStory.ts 单 IIFE 闭包里的
 * 跨场景共享状态收敛为 Pinia。
 *
 * 纪律:动效开关的真实介质仍是 body.is-reading 等类名与 zou:motion 事件
 * (跨模块契约,与原站逐字一致),本仓做写穿镜像;手势标记 moved 的读取契约
 * 仍是 window.__zouMoved()(window 桥不动,内部改读本仓)。
 * 本仓不碰 DOM、不碰滚动引擎。 */
import { defineStore } from 'pinia';

export const useStoryStore = defineStore('zou-story', {
  state: () => ({
    /** 动效开(true)/速览关(false);镜像 body.is-reading */
    motionOn: true,
    /** 已发生真实用户手势(滚轮/触摸/按键/按下) */
    moved: false,
    /** 当前高亮章节下标(0-5,CH 数组;__zouHUD 写入) */
    activeChapter: 0,
  }),

  actions: {
    setMotionOn(on: boolean): void {
      this.motionOn = on;
    },
    markMoved(): void {
      this.moved = true;
    },
    setActiveChapter(i: number): void {
      this.activeChapter = i;
    },
  },
});
