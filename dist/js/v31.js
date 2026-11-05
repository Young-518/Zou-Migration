/* ============================================================
 * js/v31.js —— v3.1 增补（2026-10-28）
 *  1) 底图切换（高德 / OSM / 无）+ 高德瓦片连续失败自动兜底（六-6）
 *  2) 数据导出：GeoJSON（全国路线 + 本支链）/ 分段里程 CSV / 图版 PNG（2.6）
 * 一切以"不报错、有回执"为准：任何一步失败都写到对应提示行，不静默。
 * ============================================================ */
(function () {
  'use strict';

  var OSM_T = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  var ATTR = '© OpenStreetMap';
  var store = [];
  var mode = 'gaode';

  function maps() {
    var z = window._zou || {};
    return ['mapHeat', 'mapMacro', 'mapChain', 'mapMicro']
      .map(function (k) { return z[k]; })
      .filter(Boolean);
  }
  function state(map) {
    for (var i = 0; i < store.length; i++) if (store[i].map === map) return store[i];
    var st = { map: map, gaode: null, osm: null };
    map.eachLayer(function (l) {
      if (window.L && l instanceof L.TileLayer && !st.gaode) st.gaode = l;
    });
    store.push(st);
    return st;
  }
  function osmLayer(map) {
    var st = state(map);
    if (!st.osm) st.osm = L.tileLayer(OSM_T, { maxZoom: 18, attribution: ATTR });
    return st.osm;
  }
  function note(t) {
    var n = document.getElementById('basemapNote');
    if (n) n.textContent = t;
  }
  function apply(next) {
    if (!window.L || !maps().length) return;
    mode = next;
    maps().forEach(function (map) {
      var st = state(map);
      if (next === 'gaode') {
        if (st.gaode && !map.hasLayer(st.gaode)) st.gaode.addTo(map);
        if (st.osm && map.hasLayer(st.osm)) map.removeLayer(st.osm);
      } else if (next === 'osm') {
        if (st.gaode && map.hasLayer(st.gaode)) map.removeLayer(st.gaode);
        osmLayer(map).addTo(map);
      } else {
        if (st.gaode && map.hasLayer(st.gaode)) map.removeLayer(st.gaode);
        if (st.osm && map.hasLayer(st.osm)) map.removeLayer(st.osm);
      }
    });
    var seg = document.getElementById('basemapSeg');
    if (seg) [].forEach.call(seg.querySelectorAll('.seg-btn'), function (b) {
      var on = b.getAttribute('data-base') === next;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }
  /* 高德瓦片偶发 404：同一张图累计 6 次失败就切 OSM，并说明原因 */
  function watchFallback() {
    maps().forEach(function (map) {
      var st = state(map);
      if (!st.gaode || st.gaode.__zouWatch) return;
      st.gaode.__zouWatch = true;
      var fails = 0;
      st.gaode.on('tileerror', function () {
        fails++;
        if (fails >= 6 && mode === 'gaode') {
          apply('osm');
          note('高德瓦片连续请求失败，已自动切到 OSM 底图（上方可再切回）。');
        }
      });
    });
  }

  /* ---------------- 导出 ---------------- */
  function download(name, text, mime) {
    var blob = new Blob([text], { type: mime || 'application/json;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 900);
  }
  function say(t) {
    var m = document.getElementById('exportMsg');
    if (m) m.textContent = t;
  }
  function stamp() {
    var d = new Date();
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate());
  }

  function expGeo() {
    var M = window.MIGR;
    if (!M) { say('数据未就绪，稍后再试。'); return; }
    var feats = []
      .concat((M.nationalRoutes && M.nationalRoutes.features) || [])
      .concat((M.chain && M.chain.features) || []);
    if (!feats.length) { say('没有可导出的路线要素。'); return; }
    var fc = {
      type: 'FeatureCollection',
      name: 'zou_migration_routes',
      crs: { type: 'name', properties: { name: 'urn:ogc:def:crs:OGC:1.3:CRS84' } },
      metadata: {
        title: '邹氏迁徙路线（示意）',
        source: '《全国邹氏历史迁徙调查报告》《雙洲鄒氏族譜注》',
        note: '直线/弧线为示意表达，非实际行走路径；坐标为今地代指。',
        exported: new Date().toISOString()
      },
      features: feats
    };
    download('zou-routes-' + stamp() + '.geojson', JSON.stringify(fc, null, 1));
    say('已导出 ' + feats.length + ' 条路线要素（GeoJSON，WGS84）。');
  }

  function expCsv() {
    var table = document.getElementById('segTable');
    if (!table) { say('分段表未就绪。'); return; }
    var rows = [].map.call(table.querySelectorAll('tr'), function (tr) {
      return [].map.call(tr.children, function (td) {
        return '"' + (td.textContent || '').replace(/\s+/g, ' ').trim().replace(/"/g, '""') + '"';
      }).join(',');
    }).filter(function (r) { return r.replace(/"/g, '').trim(); });
    if (rows.length < 2) { say('分段表为空。'); return; }
    download('zou-segments-' + stamp() + '.csv', '\ufeff' + rows.join('\r\n'), 'text/csv;charset=utf-8');
    say('已导出分段里程 ' + (rows.length - 1) + ' 行（CSV，含 BOM 以便 Excel 直接打开）。');
  }

  function expPng() {
    if (!window.echarts) { say('图表库未就绪。'); return; }
    var box = null;
    [].some.call(document.querySelectorAll('.mig-chart'), function (el) {
      if (el.offsetParent && echarts.getInstanceByDom(el)) { box = el; return true; }
      return false;
    });
    if (!box) { say('没有可见的图版可导出（可先滚到 02 迁徙图谱）。'); return; }
    var inst = echarts.getInstanceByDom(box);
    var url = inst.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#0d1b2a' });
    var a = document.createElement('a');
    a.href = url;
    a.download = 'zou-chart-' + box.id + '-' + stamp() + '.png';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { a.remove(); }, 600);
    say('已导出当前可见图版 ' + box.id + '（PNG，2 倍像素）。');
  }

  function init() {
    var seg = document.getElementById('basemapSeg');
    if (seg) {
      seg.addEventListener('click', function (e) {
        var b = e.target.closest && e.target.closest('.seg-btn');
        if (!b) return;
        apply(b.getAttribute('data-base'));
        if (b.getAttribute('data-base') === 'gaode') note('高德瓦片偶发 404 时会自动切到 OSM；天地图需自备 key，未接入。');
        if (b.getAttribute('data-base') === 'osm') note('已切到 OSM：境外服务，国内访问可能较慢，作兜底用。');
        if (b.getAttribute('data-base') === 'none') note('已关闭底图，只留矢量路线与节点。');
      });
      watchFallback();
    }
    var g = document.getElementById('btnExpGeo');
    var c = document.getElementById('btnExpCsv');
    var p = document.getElementById('btnExpPng');
    if (g) g.addEventListener('click', expGeo);
    if (c) c.addEventListener('click', expCsv);
    if (p) p.addEventListener('click', expPng);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  window.addEventListener('load', function () { watchFallback(); }, { once: true });
})();
