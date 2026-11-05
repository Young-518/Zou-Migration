/* 迁徙图谱数据整形层(S2) —— 第三阶段 PR-1:由 js/migration-data.js 移植退役。
 *
 * 注入方式:build-prepare 经 esbuild(loader:ts)把本文件编译后,替换 legacy-bundle 中
 * 原模块体,注入 runLegacy() 同一函数作用域——与原文件语义逐行等价:
 *   · 只做数据整形,不碰 DOM;坐标一律 [经度, 纬度];
 *   · 依赖 window.MIGR(js/data.js 抽取产物)与 window.CHINA_PROV 已就绪;
 *   · 产物挂 window.MIG,消费方为 migration-charts(下一批退役)与 tests/test_migration.js。
 * PR-9 起:本文件已是正式 ES 模块,由 main.ts 按(原)模块序调用。
 */

interface MigRouteProps {
  from?: unknown;
  to?: unknown;
  stage?: number;
  year?: number | null;
  event?: string;
  note?: string;
}

interface MigRouteFeature {
  properties: MigRouteProps;
  geometry: { coordinates: [number, number][] };
}

interface FlowRoute {
  from: unknown;
  to: unknown;
  fromCoord: [number, number];
  toCoord: [number, number];
  coords: [number, number][];
  stage: number;
  year: number | null;
  event: string;
  note: string;
  isBranch: boolean;
  group: 'overseas' | 'branch' | 'national';
}

interface ConvRoute {
  from: unknown;
  fromCoord: [number, number];
  toCoord: [number, number];
  stage: number;
  year: number | null;
  group: 'overseas' | 'branch' | 'national';
}

export function initMigrationData(): void {
const w = window as any;
const M = w.MIGR;
if (!M || !w.CHINA_PROV) {
  w.MIG = null;
} else {
  /* 八阶段暗底配色（比页面浅色版提亮，保证深色背景可读） */
  const HUE: Record<number, string> = { 1: '#ff7b8a', 2: '#ffb454', 3: '#59b8ff', 4: '#46d6a8',
                                       5: '#9c8bff', 6: '#ff7ab0', 7: '#ff8a5c', 8: '#ffd27a' };

  /* 清江·双洲（族人实测坐标） */
  const DEST: [number, number] = [115.405510, 27.925320];

  const isBranch = (p: MigRouteProps): boolean => /本支/.test(p.note || '');

  const flow = (f: MigRouteFeature): FlowRoute => {
    const p = f.properties, cs = f.geometry.coordinates;
    return {
      from: p.from, to: p.to,
      fromCoord: cs[0], toCoord: cs[cs.length - 1],
      coords: cs, stage: p.stage as number, year: p.year as number | null,
      event: p.event || '', note: p.note || '',
      isBranch: isBranch(p),
      group: (p.stage as number) >= 7 ? 'overseas' : (isBranch(p) ? 'branch' : 'national'),
    };
  };

  const all: FlowRoute[] = M.nationalRoutes.features.map(flow);

  /* Ⅱ 图：按首坐标去重（0.1° 网格），去掉本身就在双洲的零长度弧 */
  const convergence = (): ConvRoute[] => {
    const seen: Record<string, number> = {};
    const out: ConvRoute[] = [];
    all.forEach(r => {
      const c = r.fromCoord;
      if (Math.abs(c[0] - DEST[0]) < .05 && Math.abs(c[1] - DEST[1]) < .05) return;
      const k = c[0].toFixed(1) + ',' + c[1].toFixed(1);
      if (seen[k]) return;
      seen[k] = 1;
      out.push({ from: r.from, fromCoord: c, toCoord: DEST,
                 stage: r.stage, year: r.year, group: r.group });
    });
    return out;
  };
  const conv = convergence();

  w.MIG = {
    DEST: DEST, HUE: HUE,
    flows: all,
    convergence: conv,
    byStage(s?: number): FlowRoute[] {
      return s ? all.filter(r => r.stage === s) : all;
    },
    heat(pid: string | number): Array<{ name: unknown; value: unknown; note: unknown }> {
      return (M.heatData[pid] || []).map((d: { p: unknown; v: unknown; note: unknown }) => {
        return { name: d.p, value: d.v, note: d.note };
      });
    },
    stats: { routes: all.length, starts: conv.length,
             provinces: w.CHINA_PROV.features.length },
  };
}
}
