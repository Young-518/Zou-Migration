/* 地图运行时类型 —— 第四阶段(地图组件分解)的类型基建。
 *
 * 形状以「运行时实际数据」为基准:window.MIGR 两态同形(API 载荷经 data-layer.ts
 * 补回 dist/chainLength;file:///static 态为 data.js 静态产物),app 消费侧一律按
 * GeoJSON FeatureCollection 的 features/geometry.coordinates 读写。
 * 宽松处([k: string]: unknown 索引签名)与原站的宽松消费一一对应,不做过度收窄。
 * Leaflet/D3 等 classic UMD 全局无类型,统一以 any 承接(有意宽松;
 * 类型声明见 types/legacy-globals.d.ts,运行时仍走 window 全局,与已验收版本逐行等价)。 */

/* ---------- GeoJSON 运行时形状 ---------- */

export interface RouteProps {
  from?: string;
  to?: string;
  stage?: number;
  year?: number | null;
  event?: string;
  note?: string;
  [k: string]: unknown;
}

export interface PlaceProps {
  name?: string;
  oldName?: string;
  stage?: number;
  year?: number | null;
  event?: string;
  figure?: string;
  note?: string;
  /** 省会标注坐标(China Prov GeoJSON) */
  cx?: number;
  cy?: number;
  [k: string]: unknown;
}

export interface JwhdProps {
  name?: string;
  kind?: string;
  note?: string;
  [k: string]: unknown;
}

export interface GeoFeature<P> {
  type: 'Feature';
  properties: P;
  geometry: { type: string; coordinates: unknown };
}

/** 路线要素:coordinates 为 [lng,lat] 折线 */
export interface RouteFeature extends GeoFeature<RouteProps> {
  geometry: { type: string; coordinates: [number, number][] };
}

/** 地点要素:coordinates 为 [lng,lat] 单点 */
export interface PlaceFeature extends GeoFeature<PlaceProps> {
  geometry: { type: string; coordinates: [number, number] };
}

/** 郡望·堂号源地要素:coordinates 为 [lng,lat] 单点 */
export interface JwhdFeature extends GeoFeature<JwhdProps> {
  geometry: { type: string; coordinates: [number, number] };
}

export interface GeoFC<F> {
  type: 'FeatureCollection';
  features: F[];
}

export type RouteFC = GeoFC<RouteFeature>;
export type PlaceFC = GeoFC<PlaceFeature>;
export type JwhdFC = GeoFC<JwhdFeature>;

/* ---------- 阶段 / 热区 / 名人 / 世系 ---------- */

export interface StageLike {
  id: number;
  name: string;
  era: string;
  desc: string;
  color: string;
  [k: string]: unknown;
}

export interface HeatEntry {
  p: string;
  v: number;
  /** 参与支系:cao/zi/yao/si */
  b: string[];
  note?: string;
  [k: string]: unknown;
}

export interface HeatPeriod {
  name: string;
  span: string;
  desc: string;
  [k: string]: unknown;
}

export interface NotableEntry {
  name: string;
  era: string;
  dyn: string;
  title: string;
  bio: string;
  allusion: string;
  stage?: number;
  /** [lat, lng](与 GeoJSON 的 [lng,lat] 相反,历史原因) */
  latlng: [number, number];
  [k: string]: unknown;
}

export interface LineagePerson {
  name?: string;
  gen?: number;
  year?: string;
  place?: string;
  alias?: string;
  note?: string;
  stage?: number;
  placeholder?: boolean;
  /** [lat, lng](与 GeoJSON 相反) */
  latlng?: [number, number];
  children?: LineagePerson[];
  [k: string]: unknown;
}

/* ---------- window.MIGR 运行时总形(两态同形,消费侧以此为准) ---------- */

export interface MigrRuntime {
  stages: StageLike[];
  stageColor: { [k: number]: string };
  nationalRoutes: RouteFC;
  nationalPlaces: PlaceFC;
  chain: RouteFC;
  chainPlaces: PlaceFC;
  villagePlaces: PlaceFC;
  villageRoutes: RouteFC;
  jwhd: JwhdFC;
  notable: NotableEntry[];
  heatPeriods: HeatPeriod[];
  /** 键为字符串 "1".."8" */
  heatData: Record<string, HeatEntry[]>;
  lineage: LineagePerson;
  dist(a: [number, number], b: [number, number]): number;
  chainLength(fc: unknown): number;
  [k: string]: unknown;
}

/* ---------- 诗句场景(八景诗点用) ---------- */

export interface PoemScene {
  id: string;
  name?: string;
  displayName?: string;
  alias?: string;
  coords?: [number, number];
  [k: string]: unknown;
}

export interface PoemsRuntime {
  scenes?: PoemScene[];
  [k: string]: unknown;
}

/* ---------- Leaflet/D3 classic 全局的占位别名(有意 any) ---------- */

export type LMap = any;
export type LLayer = any;
export type LLatLngBounds = any;

/** 滚动叙事场景使用的最小地图句柄形状(window._zou 桥读出的实例) */
export interface StoryMapHandle {
  invalidateSize(): void;
  fitBounds(bounds: unknown, opts?: unknown): void;
  flyTo(ll: [number, number], zoom: number, opts?: unknown): void;
}

/** 地图内 checkbox 开关的受管键(与 layer-panel 岛屿五开关 + 名人星标对应) */
export type LayerCheckKey =
  | 'chain' | 'hist' | 'jwhd' | 'notable' | 'persons' | 'poemPts';
