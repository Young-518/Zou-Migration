/* legacy 全局桥的类型声明 —— 第四阶段(地图组件分解)扩展版。
 * 退役模块与原站共享的 window 全局(数据桥/测试钩子/地图注册表)与
 * classic 资产层的 UMD 裸全局(L/d3/echarts/turf)。
 * 形状按"运行时实际写入方"标注;any 为有意的宽松(Leaflet/D3 UMD 无类型,
 * 与已验收版本行为逐行等价——裸标识符在 ES 模块内运行时仍解析到 window 全局)。 */
import type { MigrRuntime, PoemsRuntime } from '../maps/types';

export {};

declare global {
  /* ---------- classic 资产层 UMD 裸全局(原站 <script src> 注入 window) ---------- */
  /** Leaflet UMD(app/micro/macro/chain 等模块内以裸 L 使用) */
  // eslint-disable-next-line no-var
  const L: any;
  /** D3 v7 UMD(世系树/Hero 首屏/时空剖面) */
  const d3: any;
  /** ECharts UMD(统计图懒加载;migration-charts 走 window.echarts) */
  const echarts: any;
  /** Turf.js(缓冲区分析,按需懒加载) */
  const turf: any;

  interface Window {
    /** js/data.js / 后端 API 注入的主数据(两态同形,main.ts 写入) */
    MIGR?: MigrRuntime;
    /** PR-1 legacy-ports/migration-data.ts 产物:整形后的图表数据 */
    MIG?: unknown;
    /** classic 资产层:省界 GeoJSON */
    CHINA_PROV?: unknown;
    /** classic 资产层:诗文数据 */
    ZOU_POEMS?: PoemsRuntime;
    /** 后端 meta(版本/规模计数) */
    ZOU_META?: unknown;
    /** Turf.js(缓冲区分析,按需懒加载;加载成功后挂 window) */
    turf?: unknown;
    /** classic 资产层:ECharts UMD */
    echarts?: unknown;
    /** classic 资产层:D3 UMD(Hero 首屏/世系树/时空剖面的存在性守卫用) */
    d3?: unknown;
    /** classic 资产层:Leaflet UMD */
    L?: unknown;
    /** classic 资产层:CHGIS 历史政区图层原始 GeoJSON(键见 app STAGE_HIST) */
    HIST_LAYERS?: Record<string, unknown>;
    /** app 移植文件注册的地图与句柄注册表(v31/scroll-story 桥;第四阶段由 maps/registry 安装) */
    _zou?: {
      mapHeat?: unknown;
      mapMacro?: unknown;
      mapChain?: unknown;
      mapMicro?: unknown;
      branchSel?: Record<'cao' | 'zi' | 'yao' | 'si', boolean>;
      chainKeys2?: Record<string, unknown>;
      microKeys?: Record<string, unknown>;
      [k: string]: unknown;
    };
    /** poem-ui 移植文件的验收/调试句柄 */
    __POEM_UI?: { open(id: string, set?: string, fromHistory?: boolean): void;
                  close(): void; preview(id: string): void; scene(): string | null };
    /** migration-charts 移植文件的验收钩子 */
    __MIG_READY__?: () => { routes: number; starts: number; provinces: number; charts: number };
    /** ③号图八景诗点句柄(poem-ui 使用) */
    __ZOU_POEMS_MAP?: { fit(): boolean; points: [number, number][] };
    /** scroll-story 的 HUD 句柄(year/place 省略时由章节默认值补齐) */
    __zouHUD?: (i: number, year?: string | null, place?: string | null, chapterOnly?: boolean) => void;
    /** 真实用户手势标记(首屏/深链位置不被滚动叙事覆盖) */
    __zouMoved?: () => boolean;
    /** 滚动叙事引擎(单例 rAF,进度只在变化时回调) */
    ZouScroll?: {
      add(el: Element, cb: (p: number, it?: unknown) => void): unknown;
      refresh(): void;
      enabled(): boolean;
    };
  }
}
