/* 数据契约 —— 以后端 /api/v1/bootstrap 实测载荷为基准(43 项自检锚定的规模字段)。
 * 本文件是前后端之间的"类型协议":后端投影层改动导致形状变化时,这里应当同步更新,
 * `npm run typecheck` 会强制数据交换层与契约一致。 */

export interface StageT {
  id: number;
  era: string;
  heatSpan?: string;
  name?: string;
  color?: string;
  [k: string]: unknown;
}

export interface PlaceT {
  name: string;
  oldName?: string;
  stage: number;
  /** 「新化」一条为 null,是有语义的(不能被当空值过滤) */
  year?: number | null;
  lng: number;
  lat: number;
  event?: string;
  figure?: string;
  note?: string;
  [k: string]: unknown;
}

export interface RouteT {
  from?: string;
  to?: string;
  coords: Array<[number, number]>;
  lengthKm?: number;
  [k: string]: unknown;
}

export interface LineageNode {
  name: string;
  gen?: number;
  year?: string;
  place?: string;
  alias?: string;
  /** 历史原因:[lat, lng](与 GeoJSON 的 [lng, lat] 相反) */
  latlng?: [number, number];
  /** 末端两种写法之一:leaf:true 且无 children */
  leaf?: boolean;
  children?: LineageNode[];
  [k: string]: unknown;
}

export interface HeatItem { p: string; v: number }

export interface GeoFeatureFC {
  type: 'FeatureCollection';
  features: Array<{ geometry?: { coordinates?: Array<[number, number]> } } & Record<string, unknown>>;
}

export interface MigrData {
  stages: StageT[];
  nationalPlaces: PlaceT[];
  nationalRoutes: RouteT[];
  chain: RouteT[];
  chainPlaces: PlaceT[];
  villagePlaces: PlaceT[];
  villageRoutes: RouteT[];
  jwhd: unknown[];
  notable: unknown[];
  heatPeriods: unknown[];
  /** 键是字符串 "1".."8"(不是数组) */
  heatData: Record<string, HeatItem[]>;
  stageColor: string[];
  lineage: LineageNode;
  /* 原为 data.js 内函数;API 模式由数据交换层补回 */
  dist(a: [number, number], b: [number, number]): number;
  chainLength(fc: GeoFeatureFC): number;
  [k: string]: unknown;
}

export interface PoemT {
  title: string;
  author?: string;
  dynasty?: string;
  lines: string[];
  /** 布尔假值也是数据:16 首中 1 首节选,full 必须输出 false */
  full: boolean;
  [k: string]: unknown;
}

export interface PoemsData {
  scenes: unknown[];
  poems: PoemT[];
  prose: unknown[];
  hushan?: unknown[];
  [k: string]: unknown;
}

export interface MetaData {
  version?: string;
  counts?: { places?: number; routes?: number; poems?: number; [k: string]: unknown };
  [k: string]: unknown;
}

/** 数据交换层的返回:来源 + 三份载荷(静态路径下 meta 缺省) */
export interface LoadedData {
  source: 'api' | 'static';
  migr: MigrData;
  poems: PoemsData;
  meta?: MetaData;
}
