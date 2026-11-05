/* Atlas 状态仓 —— 第四阶段(地图组件分解):原 app.ts 单 IIFE 闭包里的共享视图状态
 * 收敛为 Pinia 单一事实来源。
 *
 * 两条纪律(与 stores/data.ts 的「状态持有,不重复实现逻辑」原则一致):
 *  1) 纯 JS 状态(branchSel/visibleStages/macroMode/chainOverlayOn/dataView)——
 *     本仓即唯一事实来源,地图组件直接读写,行为与原闭包变量逐行等价;
 *  2) 有 DOM 输入介质的状态(stage/heatPeriod,介质为 #stageRange/#heatRange)——
 *     DOM 输入仍是交互契约(跨模块经 input 事件复用,与原站语义一致),
 *     本仓做写穿镜像,供 Vue 侧观测与未来组件消费,不反向驱动 DOM。
 * 分支选择(heat-map)、显隐集合与显示模式(macro-timeline)的"应用"逻辑
 * 仍在各地图组件内,本仓不碰 DOM、不碰 Leaflet。 */
import { defineStore } from 'pinia';

export type MacroMode = 'focus' | 'solo';
export type BranchKey = 'cao' | 'zi' | 'yao' | 'si';
export type DataView = 'macro' | 'chain' | 'micro';

export const useAtlasStore = defineStore('zou-atlas', {
  state: () => ({
    /** 当前阶段(1-8;镜像 #stageRange,初始 8 与原站 showStage(8) 对齐) */
    stage: 8,
    /** 序章热区时期(1-8;镜像 #heatRange) */
    heatPeriod: 1,
    /** ①号图显示模式:focus 全景 / solo 独占(原闭包 macroMode) */
    macroMode: 'focus' as MacroMode,
    /** ①号图金色本支链叠加开关(原闭包 chainOverlayOn,#chkChain) */
    chainOverlayOn: true,
    /** 序章四支系勾选(原闭包 branchSel;_zou.branchSel 注册本对象) */
    branchSel: { cao: true, zi: true, yao: true, si: true } as Record<BranchKey, boolean>,
    /** 八阶段显隐集合(原闭包 visibleStages;图例单击显隐 / showStage 重写) */
    visibleStages: {} as Record<number, boolean>,
    /** 当前聚焦窗口(原 body[data-view];三窗定位按钮写入) */
    dataView: null as DataView | null,
  }),

  actions: {
    setStage(id: number): void {
      this.stage = id;
    },
    setHeatPeriod(pid: number): void {
      this.heatPeriod = pid;
    },
    setMacroMode(mode: MacroMode): void {
      this.macroMode = mode;
    },
    setChainOverlay(on: boolean): void {
      this.chainOverlayOn = on;
    },
    setBranch(key: BranchKey, on: boolean): void {
      this.branchSel[key] = on;
    },
    setVisibleStage(id: number, on: boolean): void {
      this.visibleStages[id] = on;
    },
    setVisibleAll(map: Record<number, boolean>): void {
      this.visibleStages = map;
    },
    setDataView(v: DataView | null): void {
      this.dataView = v;
    },
  },
});
