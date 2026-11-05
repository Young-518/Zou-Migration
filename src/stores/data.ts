/* Pinia 数据仓 —— Vue 3 重构(第一阶段)的数据总线。
 * 职责:持有数据交换层(data-layer.ts)的加载结果,向 Vue 组件暴露响应式状态。
 * 数据获取、API 优先/静态兜底、协议守卫等语义仍在 data-layer.ts(与已验收版本逐字一致),
 * store 只做状态持有,不重复实现取数逻辑——单一事实来源原则。 */
import { defineStore } from 'pinia';
import type { LoadedData, MetaData, MigrData, PoemsData } from '../contract';
import { loadData } from '../data-layer';

export type DataSource = 'api' | 'static';

export const useDataStore = defineStore('zou-data', {
  state: () => ({
    /** 数据来源:api(后端在线)/ static(内联快照);null = 尚未装载完成 */
    source: null as DataSource | null,
    migr: null as MigrData | null,
    poems: null as PoemsData | null,
    meta: null as MetaData | null,
    /** load() 已成功返回 */
    loaded: false,
  }),

  getters: {
    /** /healthz 同源的规模计数:地点/路线/诗(API 态有值,静态态为空对象) */
    counts(state): { places?: number; routes?: number; poems?: number } {
      return (state.meta && state.meta.counts) || {};
    },
    version(state): string {
      return (state.meta && state.meta.version) || '-';
    },
  },

  actions: {
    /** 装载数据并落入状态;返回值与 data-layer.loadData() 相同,供 main.ts 写回 window */
    async load(): Promise<LoadedData> {
      const data = await loadData();
      this.source = data.source;
      this.migr = data.migr;
      this.poems = data.poems;
      this.meta = data.meta ?? null;
      this.loaded = true;
      return data;
    },
  },
});
