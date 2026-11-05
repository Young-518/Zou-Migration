/* 数据交换层 —— 取代原 js/boot.js 的职责。
 * 语义与 boot.js 逐条对应:
 *   ① 后端在线(同源 /api/v1/bootstrap)→ 用 API 数据,并补回 dist/chainLength 两个函数;
 *   ② ?static=1 / file://(不可探测)/ 探测失败 → 用打包内联的静态数据(data.js/poems.js 产物);
 * 差异:静态数据不再经 document.write 注入 18 个脚本,而是随应用层 bundle 内联,
 *       由 main.ts 在数据就绪后按原顺序调用 runLegacy()。 */
import type { GeoFeatureFC, LoadedData, MetaData, MigrData, PoemsData } from './contract';
import { MIGR_STATIC } from './static-migr';
import { POEMS_STATIC } from './static-poems';

export type { LoadedData };

function asMigr(m: unknown): MigrData {
  return m as MigrData;
}

/* 与 data.js 完全同算法的两个函数(API JSON 里没有函数,必须补回) */
function dist(a: [number, number], b: [number, number]): number {
  const rad = Math.PI / 180;
  const R = 6371;
  const dLat = (b[1] - a[1]) * rad;
  const dLng = (b[0] - a[0]) * rad;
  const h = Math.sin(dLat / 2) ** 2 +
            Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function chainLength(fc: GeoFeatureFC): number {
  let total = 0;
  (fc.features || []).forEach((f) => {
    const c = (f.geometry && f.geometry.coordinates) || [];
    for (let i = 1; i < c.length; i++) total += dist(c[i - 1], c[i]);
  });
  return total;
}

export async function loadData(): Promise<LoadedData> {
  const forceStatic = (window as any).ZOU_FORCE_STATIC === true ||
                      /[?&]static=1\b/.test(location.search);
  /* file:// 下不发探测请求(协议守卫,消除 CORS 噪声) */
  const canProbe = /^https?:$/.test(location.protocol);

  if (!forceStatic && canProbe) {
    try {
      const r = await fetch('/api/v1/bootstrap', { headers: { Accept: 'application/json' } });
      if (r.ok) {
        const payload = (await r.json()) as { migr?: unknown; poems?: PoemsData; meta?: MetaData };
        const migrRaw = payload && (payload.migr as MigrData | undefined);
        if (migrRaw && Array.isArray(migrRaw.stages) && migrRaw.stages.length > 0) {
          const m = asMigr(migrRaw);
          m.dist = dist;
          m.chainLength = chainLength;
          const meta = payload.meta || {};
          const counts = meta.counts || {};
          console.info('[data] 已从后端加载数据:' + (counts.places ?? '?') + ' 个地点 / ' +
                       (counts.routes ?? '?') + ' 条路线 / ' + (counts.poems ?? '?') + ' 首诗;版本 ' +
                       (meta.version ?? '?'));
          return { source: 'api', migr: m, poems: payload.poems as PoemsData, meta };
        }
      } else {
        console.warn('[data] 后端返回 ' + r.status + ',改用静态数据');
      }
    } catch (e: any) {
      console.warn('[data] 后端不可用,改用静态数据:' + (e && e.message));
    }
  }
  console.info('[data] 使用静态数据(后端未接入)');
  return { source: 'static', migr: MIGR_STATIC as unknown as MigrData, poems: POEMS_STATIC as unknown as PoemsData };
}
