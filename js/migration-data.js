/* ============================================================
 * js/migration-data.js —— 迁徙图谱数据整形层（S2）
 * 依赖顺序：必须在 js/data.js（window.MIGR）与 data/china_provinces.js 之后、
 *           js/migration-charts.js 之前加载。
 * 只做数据整形，不碰 DOM；坐标一律 [经度, 纬度]。
 * ============================================================ */
window.MIG = (function () {
  'use strict';
  var M = window.MIGR;
  if (!M || !window.CHINA_PROV) return null;

  /* 八阶段暗底配色（比页面浅色版提亮，保证深色背景可读） */
  var HUE = { 1: '#ff7b8a', 2: '#ffb454', 3: '#59b8ff', 4: '#46d6a8',
              5: '#9c8bff', 6: '#ff7ab0', 7: '#ff8a5c', 8: '#ffd27a' };

  /* 清江·双洲（族人实测坐标） */
  var DEST = [115.405510, 27.925320];

  function isBranch(p) { return /本支/.test(p.note || ''); }

  function flow(f) {
    var p = f.properties, cs = f.geometry.coordinates;
    return {
      from: p.from, to: p.to,
      fromCoord: cs[0], toCoord: cs[cs.length - 1],
      coords: cs, stage: p.stage, year: p.year,
      event: p.event || '', note: p.note || '',
      isBranch: isBranch(p),
      group: p.stage >= 7 ? 'overseas' : (isBranch(p) ? 'branch' : 'national')
    };
  }

  var all = M.nationalRoutes.features.map(flow);

  /* Ⅱ 图：按首坐标去重（0.1° 网格），去掉本身就在双洲的零长度弧 */
  function convergence() {
    var seen = {}, out = [];
    all.forEach(function (r) {
      var c = r.fromCoord;
      if (Math.abs(c[0] - DEST[0]) < .05 && Math.abs(c[1] - DEST[1]) < .05) return;
      var k = c[0].toFixed(1) + ',' + c[1].toFixed(1);
      if (seen[k]) return;
      seen[k] = 1;
      out.push({ from: r.from, fromCoord: c, toCoord: DEST,
                 stage: r.stage, year: r.year, group: r.group });
    });
    return out;
  }
  var conv = convergence();

  return {
    DEST: DEST, HUE: HUE,
    flows: all,
    convergence: conv,
    byStage: function (s) {
      return s ? all.filter(function (r) { return r.stage === s; }) : all;
    },
    heat: function (pid) {
      return (M.heatData[pid] || []).map(function (d) {
        return { name: d.p, value: d.v, note: d.note };
      });
    },
    stats: { routes: all.length, starts: conv.length,
             provinces: window.CHINA_PROV.features.length }
  };
})();
