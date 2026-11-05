/* ============================================================
 * 邹氏迁徙 WebGIS · 应用逻辑
 * 功能：三地图窗口（① 全国宏观 / ② 本支迁徙链 / ③ 双洲微观）、
 *       阶段时间轴、路线流动动画、世系树↔地图联动（D3 + Leaflet）
 * ============================================================ */
(function () {
  'use strict';
  var M = window.MIGR;

  /* ---------------- 公共工具 ---------------- */
  function esc(s) { return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  /* 只有 620 封侯、1507 迁双洲为谱注明纪年；其余为阶段代表年，弹窗统一加"约" */
  var YEAR_SPECIAL = { '宜黄': '约 800（贞元年间）' };
  function yearText(p) {
    if (YEAR_SPECIAL[p.name]) return YEAR_SPECIAL[p.name];
    /* 仅 620 封侯、1507 迁双洲为谱注明确纪年，其余按阶段代表年记'约' */
    if (p.year === 620 || p.year === 1507) return p.year;
    return p.year < 0 ? '约前' + (-p.year) : '约 ' + p.year;
  }
  function popHTML(p) {
    var st = M.stages[p.stage - 1] || {};  /* stage 编号从 1 起，数组下标需减一 */
    var html = '<div class="pop">'
      + '<span class="badge" style="background:' + st.color + '">' + esc(st.name) + '</span>'
      + '<div class="pt">' + esc(p.name) + '</div>'
      + '<div class="po">古称 / 记载：' + esc(p.oldName) + '</div>';
    if (p.event) html += '<div class="pk"><b>事件</b>：' + esc(p.event) + '</div>';
    if (p.figure) html += '<div class="pk"><b>相关人物</b>：' + esc(p.figure) + '</div>';
    if (p.year) html += '<div class="pk"><b>纪年</b>：' + esc(yearText(p)) + '</div>';
    if (p.note) html += '<div class="pn">' + esc(p.note) + '</div>';
    return html + '</div>';
  }
  function routePopHTML(f) {
    var p = f.properties, st = M.stages[p.stage - 1] || {};  /* 同上，修正下标错位 */
    return '<div class="pop">'
      + '<span class="badge" style="background:' + st.color + '">' + esc(st.name) + '</span>'
      + '<div class="pt">' + esc(p.from) + ' → ' + esc(p.to) + '</div>'
      + (p.event ? '<div class="pk">' + esc(p.event) + '</div>' : '')
      + (p.note ? '<div class="pn">' + esc(p.note) + '</div>' : '')
      + '</div>';
  }
  function bearing(c1, c2) {
    var dLng = (c2[0] - c1[0]) * Math.PI / 180,
        y = Math.sin(dLng) * Math.cos(c2[1] * Math.PI / 180),
        x = Math.cos(c1[1] * Math.PI / 180) * Math.sin(c2[1] * Math.PI / 180)
          - Math.sin(c1[1] * Math.PI / 180) * Math.cos(c2[1] * Math.PI / 180) * Math.cos(dLng);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  }
  var arrowIcon = function (deg, color) {
    return L.divIcon({
      className: 'rt-arrow', iconSize: [14, 14],
      html: '<div class="tri-arrow" style="transform:rotate(' + deg + 'deg);color:' + color + '"></div>'
    });
  };

  function addRoutes(map, fc, layerGroup, opts) {
    opts = opts || {};
    fc.features.forEach(function (f) {
      var p = f.properties, color = opts.color || M.stageColor[p.stage] || '#888';
      /* 底光晕线：粗、低透明度，衬托流光 */
      var base = L.polyline(f.geometry.coordinates.map(function (c) { return [c[1], c[0]]; }), {
        color: color, weight: (opts.weight || 3) + 3, opacity: .18,
        className: opts.baseClass || 'routebase', pane: opts.pane
      });
      base._stage = p.stage;
      layerGroup.addLayer(base);
      /* 主流光线：短亮划沿线跑动（ECharts 迁移图式） */
      var line = L.polyline(f.geometry.coordinates.map(function (c) { return [c[1], c[0]]; }), {
        color: color, weight: opts.weight || 3, opacity: opts.opacity || .85,
        dashArray: opts.dash || '3 13', className: opts.className || 'flowline',
        pane: opts.pane
      }).bindPopup(routePopHTML(f));
      line._stage = p.stage;
      layerGroup.addLayer(line);
      if (!opts.noArrow) {
        var c = f.geometry.coordinates, n = c.length;
        if (n >= 2) {
          var deg = bearing(c[n - 2], c[n - 1]);
          var arrow = L.marker([c[n - 1][1], c[n - 1][0]], { icon: arrowIcon(deg, color),
            interactive: false });
          arrow._stage = p.stage;
          arrow.addTo(layerGroup);
        }
      }
      /* 沿路线随时间移动的箭头（出发地 → 目的地循环） */
      if (opts.movingArrow !== false) {
        addMovingArrow(layerGroup, f, color);
      }
    });
  }

  /* ---------- 移动箭头：单全局 rAF 循环驱动 ---------- */
  var movingArrows = [];
  function addMovingArrow(layerGroup, feature, color) {
    var pts = feature.geometry.coordinates.map(function (c) { return [c[1], c[0]]; });
    if (pts.length < 2) return;
    var segs = [], total = 0, i;
    for (i = 1; i < pts.length; i++) {
      /* M.dist 以 [lng,lat] 计；pts 为 Leaflet 的 [lat,lng]，须交换 */
      var d = M.dist([pts[i - 1][1], pts[i - 1][0]], [pts[i][1], pts[i][0]]);
      segs.push(Math.max(d, 0.001)); total += d;
    }
    var marker = L.marker(pts[0], {
      interactive: false, zIndexOffset: 500,
      icon: L.divIcon({ className: '', iconSize: [16, 16], iconAnchor: [8, 8],
        html: '<div class="mv-arrow tri-arrow" style="color:' + color + '"></div>' })
    });
    marker._stage = feature.properties.stage;
    var rec = { marker: marker, pts: pts, segs: segs, total: total,
      duration: Math.min(9, Math.max(3, total / 220)),
      el: null, lastSeg: -1, bearings: [] };
    for (i = 1; i < pts.length; i++) rec.bearings.push(bearing(pts[i - 1], pts[i]));
    movingArrows.push(rec);
    layerGroup.addLayer(marker);
  }
  (function () {
    function frame(now) {
      for (var j = 0; j < movingArrows.length; j++) {
        var a = movingArrows[j];
        if (!a.el) {
          var el = a.marker.getElement();
          a.el = el ? el.querySelector('.mv-arrow') : null;
          if (!a.el) continue;
        }
        var dur = a.duration, t = ((now / 1000) % dur) / dur;
        var target = t * a.total, acc = 0, i = 0;
        while (i < a.segs.length - 1 && acc + a.segs[i] < target) { acc += a.segs[i]; i++; }
        var f = (target - acc) / a.segs[i];
        if (f < 0) f = 0; if (f > 1) f = 1;
        var p0 = a.pts[i], p1 = a.pts[i + 1];
        a.marker.setLatLng([p0[0] + (p1[0] - p0[0]) * f, p0[1] + (p1[1] - p0[1]) * f]);
        if (i !== a.lastSeg) {
          a.el.style.transform = 'rotate(' + Math.round(a.bearings[i]) + 'deg)';
          a.lastSeg = i;
        }
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  })();
  function addPlaces(map, fc, layerGroup, opts) {
    opts = opts || {};
    var byKey = {};
    fc.features.forEach(function (f) {
      var p = f.properties, c = f.geometry.coordinates;
      var m = L.circleMarker([c[1], c[0]], {
        radius: opts.radius || 7, color: '#fff', weight: 2,
        fillColor: M.stageColor[p.stage] || '#555', fillOpacity: .95,
        pane: opts.pane
      }).bindPopup(popHTML(p));
      m._stage = p.stage; m._key = c[1] + ',' + c[0]; m._props = p;
      layerGroup.addLayer(m);
      byKey[m._key] = m;
    });
    return byKey;
  }

  /* ============================================================
   * 序章：邹氏全国分布热区 · 时空动图
   * ============================================================ */
  var mapHeat = L.map('mapHeat', { center: [32.5, 112.5], zoom: 4, zoomSnap: 0.25,
    zoomControl: true, attributionControl: false });
  var HEAT_COLORS = { 0: '#f5efdf', 1: '#e8cfa8', 2: '#cf9d62', 3: '#a55f2b' };
  var HEAT_TEXT = { 0: '暂无记载', 1: '初步分布', 2: '聚居发展', 3: '核心聚集区' };
  /* SVG 标注（paint-order：描边在填充之下 → 墨字完整锐利） */
  function labelText(txt, size, color) {
    var w = txt.length * size + 14, h = size + 12;
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h
      + '" style="position:absolute;left:0;top:0;overflow:visible;display:block">'
      + '<text x="' + (w / 2) + '" y="' + (h / 2) + '" text-anchor="middle" dominant-baseline="central" '
      + 'font-family="serif" font-weight="700" font-size="' + size + '" fill="' + color + '" '
      + 'stroke="#ffffff" stroke-width="3.5" paint-order="stroke" stroke-linejoin="round">'
      + txt + '</text></svg>';
  }
  var branchSel = { cao: true, zi: true, yao: true, si: true };
  var heatByName = {};
  var heatNameLayer = L.layerGroup().addTo(mapHeat);
  var heatNameMarkers = {};

  var heatProv = L.geoJSON(window.CHINA_PROV, {
    style: function () {
      return { color: '#b8a888', weight: .8, fillColor: '#f5efdf', fillOpacity: .95 };
    },
    onEachFeature: function (f, l) {
      heatByName[f.properties.name] = l;
      var p = f.properties;
      heatNameMarkers[p.name] = L.marker([p.cy, p.cx], { interactive: false,
        icon: L.divIcon({ className: '', iconSize: [0, 0], iconAnchor: [0, 0],
          html: '<div style="position:absolute;transform:translate(-50%,-50%)">'
            + labelText(p.name, 11, '#4a4130') + '</div>' }) });
      l.bindTooltip(f.properties.name, { sticky: true });
    }
  }).addTo(mapHeat);

  function heatColor(v) { return HEAT_COLORS[v] || HEAT_COLORS[0]; }
  function applyHeat() {
    var pid = +document.getElementById('heatRange').value;
    var entries = M.heatData[pid] || [];
    Object.keys(heatByName).forEach(function (n) {
      heatByName[n].setStyle({ fillColor: HEAT_COLORS[0], fillOpacity: .55,
        color: '#c9bda3', weight: .7 });
    });
    heatNameLayer.clearLayers();
    entries.forEach(function (e) {
      var l = heatByName[e.p];
      if (!l) return;
      var on = e.b.some(function (b) { return branchSel[b]; });
      l.setStyle(on
        ? { fillColor: heatColor(e.v), fillOpacity: .95, color: '#8a5a2b', weight: .9 }
        : { fillColor: '#f5efdf', fillOpacity: .3, color: '#c9bda3', weight: .7 });
      l.setTooltipContent('<b>' + e.p + '</b>（' + M.heatPeriods[pid - 1].name + '）<br>'
        + '热度：' + HEAT_TEXT[e.v]
        + '<br>支系：' + e.b.map(function (b) {
            return { cao: '曹姓邾国系', zi: '子姓宋国系', yao: '姚姓邹屠系', si: '姒姓越国系' }[b];
          }).join('、')
        + (e.note ? '<br>' + esc(e.note) : ''));
      /* 有热度且支系勾选的省份：常显省名 */
      if (on && heatNameMarkers[e.p]) heatNameLayer.addLayer(heatNameMarkers[e.p]);
    });
    var per = M.heatPeriods[pid - 1];
    document.getElementById('heatNow').textContent = per.name + '（' + per.span + '）';
    document.getElementById('heatDesc').textContent = per.desc;
  }
  /* v3.6.6:四支开关即时反馈——徽章实时显示当前参与热区的支数 */
  function syncBkCount() {
    var cnt = document.getElementById('bkCount'); if (!cnt) return;
    var n = 0;
    ['bkCao', 'bkZi', 'bkYao', 'bkSi'].forEach(function (id) {
      var c = document.getElementById(id); if (c && c.checked) n++;
    });
    cnt.textContent = n;
    var live = document.getElementById('bkLive');
    if (live) live.classList.toggle('zero', n === 0);
  }
  ['bkCao', 'bkZi', 'bkYao', 'bkSi'].forEach(function (id) {
    document.getElementById(id).onchange = function () {
      branchSel[id === 'bkCao' ? 'cao' : id === 'bkZi' ? 'zi' : id === 'bkYao' ? 'yao' : 'si'] = this.checked;
      syncBkCount();
      applyHeat();
    };
  });
  syncBkCount();
  var heatRange = document.getElementById('heatRange');
  heatRange.oninput = function () { stopHeatPlay(); applyHeat(); };
  document.getElementById('btnHeatPrev').onclick = function () {
    stopHeatPlay();
    heatRange.value = +heatRange.value > 1 ? +heatRange.value - 1 : 8;
    applyHeat();
  };
  document.getElementById('btnHeatNext').onclick = function () {
    stopHeatPlay();
    heatRange.value = +heatRange.value < 8 ? +heatRange.value + 1 : 1;
    applyHeat();
  };
  var heatTimer = null;
  function stopHeatPlay() {
    if (heatTimer) { clearInterval(heatTimer); heatTimer = null;
      document.getElementById('btnHeatPlay').textContent = '▶';
      document.getElementById('btnHeatPlay').classList.remove('on'); }
  }
  document.getElementById('btnHeatPlay').onclick = function () {
    if (heatTimer) { stopHeatPlay(); return; }
    this.textContent = '⏸'; this.classList.add('on');
    heatTimer = setInterval(function () {
      heatRange.value = +heatRange.value < 8 ? +heatRange.value + 1 : 1;
      applyHeat();
    }, 2600);
  };
  applyHeat();

  /* ============================================================
   * 宏观视图
   * ============================================================ */
  var GAODE_URL = 'https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}';
  var mapMacro = L.map('mapMacro', { center: [29.5, 112], zoom: 5, zoomControl: true,
    scrollWheelZoom: false });   /* 滚轮留给页面滚动（不劫持） */
  /* 与「迁徙图谱」展区解耦联动：点击 ECharts 省份 → ①号图定位 */
  window.addEventListener('zou:focus', function (ev) {
    var d = ev.detail || {};
    if (!d.lng || !d.lat) return;
    var card = document.querySelector('.card-macro');
    if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    mapMacro.flyTo([d.lat, d.lng], d.zoom || 6, { duration: .9 });
  });
  L.tileLayer(GAODE_URL,
    { maxZoom: 18, subdomains: '1234', attribution: '© 高德地图' }).addTo(mapMacro);

  var macroRoutes = L.layerGroup().addTo(mapMacro);
  var macroPlaces = L.layerGroup().addTo(mapMacro);
  var chainLines = L.layerGroup().addTo(mapMacro);
  var chainPoints = L.layerGroup().addTo(mapMacro);
  /* 本支链专用高层级 pane（405 > overlayPane 400）：金色链永远压在全国路线上 */
  if (!mapMacro.getPane('chainPane')) {
    mapMacro.createPane('chainPane');
    mapMacro.getPane('chainPane').style.zIndex = 405;
  }
  /* 相交路线的微平行偏移：仅移动中间拐点（±0.04°≈4px），端点仍精确落在城市节点，
     缓解赣中枢纽等多线同走廊的叠印 */
  function offsetRouteCoords(coords, k) {
    if (coords.length < 3 || !k) return coords;
    return coords.map(function (c, i) {
      if (i === 0 || i === coords.length - 1) return c;
      var p = coords[i - 1], n = coords[Math.min(i + 1, coords.length - 1)];
      var dx = n[0] - p[0], dy = n[1] - p[1];
      var len = Math.hypot(dx, dy) || 1;
      return [c[0] - (dy / len) * k, c[1] + (dx / len) * k];
    });
  }
  var macroFc = { type: 'FeatureCollection', features: M.nationalRoutes.features
    .map(function (f, i) {
      return { type: 'Feature', properties: f.properties,
        geometry: { type: 'LineString',
          coordinates: offsetRouteCoords(f.geometry.coordinates, ((i % 3) - 1) * 0.04) } };
    }) };
  addRoutes(mapMacro, macroFc, macroRoutes);
  var macroKeys = addPlaces(mapMacro, M.nationalPlaces, macroPlaces);

  /* 本支迁徙链（①号窗口上的金色叠加层，随阶段动态显示） */
  addRoutes(mapMacro, M.chain, chainLines,
    { color: '#C8A165', weight: 5.5, opacity: .95, dash: '14 8',
      className: 'chainline', baseClass: 'routebase chainbase', pane: 'chainPane' });
  var chainKeys = addPlaces(mapMacro, M.chainPlaces, chainPoints, { radius: 9, pane: 'chainPane' });
  /* 链上节点旁标注序号（继承所属阶段，随阶段显隐） */
  M.chainPlaces.features.forEach(function (f, i) {
    var c = f.geometry.coordinates;
    var num = L.marker([c[1], c[0]], {
      interactive: false, icon: L.divIcon({ className: '', iconSize: [20, 20],
        iconAnchor: [-8, 22],
        html: '<div style="background:#8a5a2b;color:#fff;border-radius:50%;width:18px;height:18px;'
          + 'font-size:11px;line-height:18px;text-align:center;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4)">'
          + (i + 1) + '</div>' })
    });
    num._stage = f.properties.stage;
    num.addTo(chainPoints);
  });

  /* ============================================================
   * 历史政区图层（CHGIS）：随时间轴阶段自动切换朝代
   * ============================================================ */
  var STAGE_HIST = { 1: null, 2: 'qinhan_bc200', 3: 'weijin_400', 4: 'tang800',
    5: 'tang800', 6: 'ming1530', 7: '1911', 8: '1911' };
  var HIST_LABEL = { '1911': '清末 1911 年省级政区（CHGIS）',
    'tang800': '唐代（约 800 年）疆域轮廓',
    'ming1530': '明代（约 1530 年）疆域轮廓',
    'qinhan_bc200': '秦汉之际（约前 200 年）疆域轮廓',
    'weijin_400': '魏晋南北朝（约 400 年，东晋—北魏对峙）疆域轮廓' };
  var HIST_READY = window.HIST_LAYERS || {};
  var histLayerCurrent = null;
  var histLayers = {};
  /* 历史政区专用低层级 pane（350 < overlayPane 400），
     保证迁徙点/路线的弹窗优先于政区面被命中 */
  if (!mapMacro.getPane('histPane')) {
    mapMacro.createPane('histPane');
    mapMacro.getPane('histPane').style.zIndex = 350;
  }

  Object.keys(HIST_READY).forEach(function (key) {
    histLayers[key] = L.geoJSON(HIST_READY[key], {
      pane: 'histPane',
      /* 底图参照系：细化降透明，不与迁徙路线抢视觉 */
      style: { color: '#7a4f24', weight: 0.8, opacity: .5,
        fillColor: '#B48A4A', fillOpacity: .06 },
      onEachFeature: function (f, layer) {
        var p = f.properties || {};
        var isOutline = p.type === 'empire_outline';
        var src = isOutline
          ? 'timmdhayes/historical-basemaps（帝国疆域轮廓，非内部政区）'
          : 'CHGIS v5（Harvard，DOI:10.7910/DVN/M7WEFY）派生';
        layer.bindTooltip((p.name || '') + '（' + p.year + ' 年 · 据 ' +
          (isOutline ? 'historical-basemaps' : 'CHGIS') + '）', { sticky: true });
        layer.bindPopup('<div class="pop">'
          + '<span class="badge" style="background:#8a5a2b">' + esc(p.year) + ' 年</span>'
          + '<div class="pt">' + esc(p.name) + '</div>'
          + (p.name_py ? '<div class="pk"><b>拼音</b>：' + esc(p.name_py) + '</div>' : '')
          + '<div class="pk"><b>数据源</b>：' + esc(src) + '</div>'
          + '</div>');
      }
    });
  });

  function updateHistLayer() {
    var stage = +range.value;
    var key = STAGE_HIST[stage] || null;
    var want = document.getElementById('chkHist').checked && key && histLayers[key];
    var statusEl = document.getElementById('histStatus');
    /* 取消勾选或阶段切换时立即移除当前图层 */
    if (histLayerCurrent && (!want || histLayerCurrent !== histLayers[key])) {
      mapMacro.removeLayer(histLayerCurrent);
      histLayerCurrent = null;
    }
    if (want && !histLayerCurrent) {
      histLayers[key].addTo(mapMacro);
      histLayerCurrent = histLayers[key];
    }
    if (!document.getElementById('chkHist').checked) {
      statusEl.innerHTML = '历史政区：<b>已隐藏</b>（勾选以显示当前朝代图层）';
      return;
    }
    if (!key) {
      statusEl.innerHTML = '历史政区：本阶段（先秦）暂无对应疆域图层（约前1000年世界底图未标注中国区域政权）';
    } else if (HIST_READY[key]) {
      statusEl.innerHTML = '历史政区：<b>' + HIST_LABEL[key] + '</b>（已加载，'
        + HIST_READY[key].features.length + ' 个政区面）';
    } else {
      statusEl.innerHTML = '历史政区：' + HIST_LABEL[key] + '（<b>数据待补</b>，加载后自动生效）';
    }
  }
  document.getElementById('chkHist').onchange = updateHistLayer;

  /* ---------------- 郡望·堂号源地图层（①号窗，勾选显示） ---------------- */
  var jwhdLayer = L.layerGroup();
  M.jwhd.features.forEach(function (f) {
    var p = f.properties, c = f.geometry.coordinates;
    var color = p.kind === '郡望' ? '#534AB7' : '#0F6E56';
    var m = L.marker([c[1], c[0]], {
      icon: L.divIcon({ className: '', iconSize: [14, 14], iconAnchor: [7, 7],
        html: '<div class="jwhd-diamond" style="background:' + color + '"></div>' })
    }).bindPopup('<div class="pop"><span class="badge" style="background:' + color + '">'
      + esc(p.kind) + '源地</span><div class="pt">' + esc(p.name) + '</div>'
      + '<div class="pk">' + esc(p.note) + '</div>'
      + '<div class="pn">郡望堂号体系据调查报告第二、三章</div></div>');
    jwhdLayer.addLayer(m);
  });
  document.getElementById('chkJwhd').onchange = function () {
    if (this.checked) { jwhdLayer.addTo(mapMacro); }
    else { mapMacro.removeLayer(jwhdLayer); }
  };

  /* ---------------- 历史名人星标图层（①号窗，勾选显示） ---------------- */
  var notableLayer = L.layerGroup();
  var notableByKey = {};
  M.notable.forEach(function (d) {
    var color = M.stageColor[d.stage] || '#B8912A';
    var m = L.marker(d.latlng, {
      icon: L.divIcon({ className: '', iconSize: [20, 20], iconAnchor: [10, 10],
        html: '<div class="notable-star" style="background:' + color + '">★</div>' })
    }).bindPopup('<div class="pop">'
      + '<span class="badge" style="background:' + color + '">' + esc(d.era) + ' · ' + esc(d.dyn) + '</span>'
      + '<div class="pt">' + esc(d.name) + '</div>'
      + '<div class="pk"><b>' + esc(d.title) + '</b></div>'
      + '<div class="pk">' + esc(d.bio) + '</div>'
      + '<div class="pn">典故：' + esc(d.allusion) + '</div>'
      + '<div class="pn">详见左栏"邹氏名人堂"</div></div>');
    notableByKey[d.name] = m;
    notableLayer.addLayer(m);
  });
  var notableLbl = document.createElement('label');
  notableLbl.className = 'switchline';
  notableLbl.innerHTML = '<input type="checkbox" id="chkNotable">邹氏历史名人（金色星标）';
  notableLbl.querySelector('#chkNotable').onchange = function () {
    if (this.checked) { notableLayer.addTo(mapMacro); }
    else { mapMacro.removeLayer(notableLayer); }
  };

  /* ============================================================
   * ② 号窗口：双洲邹氏本支迁徙链（独立成窗，族谱注直接依据）
   * ============================================================ */
  var mapChain = L.map('mapChain', { zoomControl: true, scrollWheelZoom: false });
  L.tileLayer(GAODE_URL,
    { maxZoom: 18, subdomains: '1234', attribution: '© 高德地图' }).addTo(mapChain);
  /* 初始视野贴合七站迁徙链范围 */
  (function () {
    var pts = [];
    M.chainPlaces.features.forEach(function (f) {
      pts.push([f.geometry.coordinates[1], f.geometry.coordinates[0]]);
    });
    mapChain.fitBounds(L.latLngBounds(pts).pad(0.12));
    /* v3.6 修复 B6 取景兜底:限制最大视野,避免日本/朝鲜半岛抢主体。
       v3.6.5 修复:原写法 [[110,24],[126,42]] 是 [经度,纬度] 顺序,Leaflet 需要 [纬度,经度];
       纬度 110/126 超界被钳到 85.05,最大边界退化成「北极一条线」,视野被钉死在高纬,
       高德瓦片无覆盖 → 04 地图整片灰白,形同未加载 */
    mapChain.setMaxBounds([[24, 110], [42, 126]]);
  })();
  var chainLayers2 = L.layerGroup().addTo(mapChain);
  addRoutes(mapChain, M.chain, chainLayers2,
    { color: '#C8A165', weight: 5, opacity: .95, dash: '14 8' });
  var chainKeys2 = addPlaces(mapChain, M.chainPlaces, chainLayers2, { radius: 9 });
  var chainCoords = [];
  M.chainPlaces.features.forEach(function (f, i) {
    var c = f.geometry.coordinates;
    chainCoords.push([c[1], c[0]]);
    L.marker([c[1], c[0]], {
      interactive: false, icon: L.divIcon({ className: '', iconSize: [20, 20],
        iconAnchor: [-8, 22],
        html: '<div style="background:#8a5a2b;color:#fff;border-radius:50%;width:18px;height:18px;'
          + 'font-size:11px;line-height:18px;text-align:center;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4)">'
          + (i + 1) + '</div>' })
    }).addTo(chainLayers2);
  });
  mapChain.fitBounds(L.latLngBounds(chainCoords).pad(0.18));

  /* 侧栏迁徙链清单 → 点击在②号窗口定位 */
  var chainItems = [
    ['①', '山东莱州东鲁县', '唐武德三年（620）前，全哲公原籍'],
    ['②', '河北范阳（涿州）', '620 年出镇幽州、封范阳侯，立范阳堂'],
    ['③', '河南光州（潢川）', '安史之乱后（约 763 年后）南迁落籍'],
    ['④', '抚州宜黄石马廊下', '约 800 年（贞元年间）举族定居，二世昌宗公开基'],
    ['⑤', '崇仁乐安埮坪', '七世望龙公开基；965 年受旌（乾德三年诰命）'],
    ['⑥', '新淦安国乡湖边', '北宋年间九世德卿公卜居（约 1080），撰湖山八景诗'],
    ['⑦', '清江建安乡双洲', '1507 年十八世有宗公开基']
  ];
  (function () {
    var km = M.chainLength(M.chain);
    document.getElementById('chainMetric').innerHTML =
      '本支迁徙链 ①莱州 → ⑦双洲，六段直线里程合计约 <b>' + km.toFixed(0) + ' km</b>' +
      '（直线示意，非实际路径）';
    /* 分段里程表 */
    var segRows = '', segDist = [];
    M.chain.features.forEach(function (f, i) {
      var c = f.geometry.coordinates, d = 0;
      for (var j = 1; j < c.length; j++) d += M.dist(c[j - 1], c[j]);
      segDist.push(d);
      segRows += '<tr><td>' + chainItems[i][0] + ' → ' + chainItems[i + 1][0] + '</td>'
        + '<td>' + d.toFixed(0) + ' km</td></tr>';
    });
    document.getElementById('segTable').innerHTML =
      '<table><thead><tr><th>段</th><th>直线里程</th></tr></thead><tbody>' + segRows + '</tbody></table>';
    var ol = document.getElementById('chainList');
    ol.innerHTML = '';
    chainItems.forEach(function (it, i) {
      var li = document.createElement('li');
      li.innerHTML = '<b>' + it[0] + ' ' + esc(it[1]) + '</b> — ' + esc(it[2]);
      li.style.cursor = 'pointer';
      li.title = '点击在②号窗口定位';
      li.onclick = function () {
        mapChain.flyTo(chainCoords[i], 9, { duration: .8 });
        var key = chainCoords[i][0] + ',' + chainCoords[i][1];
        var m = chainKeys2[key];
        if (m) setTimeout(function () { m.openPopup(); }, 900);
      };
      ol.appendChild(li);
    });
  })();

  /* 时间轴、图例与聚焦层级 */
  var visibleStages = {};
  M.stages.forEach(function (s) { visibleStages[s.id] = true; });
  /* 显示模式：focus = 全景（全部阶段同屏，当前阶段高亮、其余降为灰线）；
     solo  = 独占（只看当前阶段，拖时间轴/播放时进入） */
  var macroMode = 'focus';
  var MACRO_FADE = '#989082';

  function setLayerOpacity(l, show, defOp) {
    if (typeof l.setStyle === 'function') {
      if (l.options.fillColor) {
        l.setStyle({ opacity: show ? 1 : 0, fillOpacity: show ? (l.options.fillOpacity || .95) : 0 });
      } else {
        l.setStyle({ opacity: show ? (l.options.opacity || defOp || .85) : 0 });
      }
    }
    if (l.getElement && l._icon) l.getElement().style.display = show ? '' : 'none';
  }

  /* 收集①号图全国路线的各组成部分，按聚焦层级统一赋样式 */
  var nationalLines = [], nationalBases = [], nationalMarks = [], nationalDots = [];
  macroRoutes.eachLayer(function (l) {
    if (l instanceof L.Polyline) {
      if (l.options.className === 'routebase') nationalBases.push(l);
      else nationalLines.push(l);
    } else { nationalMarks.push(l); }
  });
  macroPlaces.eachLayer(function (l) { nationalDots.push(l); });

  function isHeroStage(st) {
    if (!visibleStages[st]) return false;
    return macroMode === 'solo' || st === +range.value;
  }
  function setFlowAnim(l, on) {
    var el = l.getElement && l.getElement();
    if (el) {
      el.classList[on ? 'add' : 'remove']('flowline');
      el.classList[on ? 'remove' : 'add']('rt-dim');
    }
  }
  function styleNational() {
    nationalLines.forEach(function (l) {
      if (!l._dash0) l._dash0 = l.options.dashArray || '3 13';
      if (isHeroStage(l._stage)) {
        l.setStyle({ color: M.stageColor[l._stage], weight: 3, opacity: .9,
          dashArray: l._dash0 });
        setFlowAnim(l, true);
      } else if (visibleStages[l._stage]) {
        /* v2.7：全景铺底改实线——原来的 3/13 点线在浅色底图上几乎看不见，
           陌生人会以为"地图没加载" */
        l.setStyle({ color: MACRO_FADE, weight: 2, opacity: .72, dashArray: null });
        setFlowAnim(l, false);
      } else {
        l.setStyle({ opacity: 0 });
      }
    });
    nationalBases.forEach(function (l) {
      l.setStyle({ opacity: isHeroStage(l._stage) ? .18
        : (visibleStages[l._stage] ? .04 : 0) });
    });
    nationalMarks.forEach(function (m) {
      var vis = isHeroStage(m._stage);
      if (m.getElement && m._icon) m.getElement().style.display = vis ? '' : 'none';
    });
    nationalDots.forEach(function (d) {
      var nm = d._props && d._props.name;
      if (chainOverlayOn && nm === '樟树·双洲') {
        d.setStyle({ fillOpacity: 0, opacity: 0 }); return;
      }
      if (isHeroStage(d._stage)) {
        d.setStyle({ radius: 7, fillColor: M.stageColor[d._stage],
          fillOpacity: .95, opacity: 1 });
      } else if (visibleStages[d._stage]) {
        d.setStyle({ radius: 3.5, fillColor: MACRO_FADE, fillOpacity: .8, opacity: 1 });
      } else {
        d.setStyle({ fillOpacity: 0, opacity: 0 });
      }
    });
  }

  function applyFilter() {
    styleNational();
    /* 金色本支链同样分层：当前主角阶段的链段满权重流光，其余链段半隐为背景 */
    chainLines.eachLayer(function (l) {
      var active = chainOverlayOn && (l._stage == null ? true : visibleStages[l._stage]);
      if (!active) {
        if (l instanceof L.Polyline) l.setStyle({ opacity: 0 });
        else setLayerOpacity(l, false);
        return;
      }
      if (l instanceof L.Polyline && l.options.className === 'chainline') {
        var hero = isHeroStage(l._stage);
        l.setStyle(hero ? { opacity: .95, weight: 5.5 } : { opacity: .28, weight: 3.5 });
        var el = l.getElement && l.getElement();
        if (el) el.classList[hero ? 'add' : 'remove']('chainline');
      } else if (l instanceof L.Polyline) {
        l.setStyle({ opacity: isHeroStage(l._stage) ? .18 : .06 });
      } else {
        setLayerOpacity(l, true);
      }
    });
    chainPoints.eachLayer(function (l) {
      var active = chainOverlayOn && (l._stage == null ? true : visibleStages[l._stage]);
      if (!active) { setLayerOpacity(l, false); return; }
      /* 链上节点同样分层：主角阶段满尺寸，背景阶段缩小降透明（序号徽标保留） */
      if (l instanceof L.CircleMarker) {
        var hero = isHeroStage(l._stage);
        l.setStyle(hero ? { radius: 9, fillOpacity: .95, opacity: 1 }
          : { radius: 6, fillOpacity: .38, opacity: .5 });
      } else {
        setLayerOpacity(l, true);
      }
    });
  }

  var chainOverlayOn = true;
  document.getElementById('chkChain').onchange = function () {
    chainOverlayOn = this.checked;
    applyFilter();
  };

  var legendEl = document.getElementById('stageLegend');
  M.stages.forEach(function (s) {
    var n = M.nationalPlaces.features.filter(function (f) { return f.properties.stage === s.id; }).length;
    var short = s.name.split('：')[0];
    var li = document.createElement('li');
    li.title = s.name + '（' + s.era + '）· 单击显隐，双击聚焦';
    li.innerHTML = '<span class="dot" style="background:' + s.color + '"></span>'
      + '<span class="nm">' + short + '</span><span class="cnt">' + n + ' 节点</span>';
    li.onclick = function () {
      visibleStages[s.id] = !visibleStages[s.id];
      li.classList.toggle('off', !visibleStages[s.id]);
      applyFilter();
    };
    li.ondblclick = function () { showStage(s.id); };
    legendEl.appendChild(li);
  });
  function setCurLegend(id) {
    M.stages.forEach(function (s) {
      legendEl.children[s.id - 1].classList.toggle('cur', s.id === id);
    });
  }

  var range = document.getElementById('stageRange'),
      nowEl = document.getElementById('stageNow'),
      descEl = document.getElementById('stageDesc'),
      btnAllEl = document.getElementById('btnAll'),
      btnSoloEl = document.getElementById('btnSolo');

  /* v2.7：模式只在用户显式点「全景 / 只看本阶段」时切换；
     拖滑杆、滚到某步、深链、键盘切阶段都不再强制独占——否则主图会被切空 */
  function applyModeUI() {
    var all = document.getElementById('btnAll'), solo = document.getElementById('btnSolo');
    var cn = '一二三四五六七八'[Math.max(0, Math.min(7, +range.value - 1))];
    if (all) { all.classList.toggle('on', macroMode === 'focus'); all.setAttribute('aria-pressed', macroMode === 'focus'); }
    if (solo) { solo.classList.toggle('on', macroMode === 'solo'); solo.setAttribute('aria-pressed', macroMode === 'solo'); }
    var note = document.getElementById('macroModeNote');
    if (note) {
      note.textContent = macroMode === 'focus'
        ? '当前：全景 —— 33 段路线全部铺底，第' + cn + '阶段高亮'
        : '当前：只看本阶段 —— 仅显示第' + cn + '阶段（切回「全景」可看全部）';
    }
  }

  function showStage(id, pan) {
    M.stages.forEach(function (s) {
      visibleStages[s.id] = macroMode === 'solo' ? s.id === id : true;
      legendEl.children[s.id - 1].classList.toggle('off', !visibleStages[s.id]);
    });
    setCurLegend(id);
    var s = M.stages[id - 1];
    nowEl.innerHTML = '<span class="dot" style="background:' + s.color + '"></span>'
      + '第' + '一二三四五六七八'[s.id - 1] + '阶段 · ' + esc(s.name)
      + '<span class="era">' + esc(s.era) + '</span>';
    descEl.textContent = s.desc;
    range.value = id;
    applyFilter();
    updateHistLayer();
    applyModeUI();
    if (pan) {
      /* 播放时镜头跟随当前阶段的节点 */
      var pts = M.nationalPlaces.features.filter(function (f) {
        return f.properties.stage === id;
      }).map(function (f) {
        var c = f.geometry.coordinates; return [c[1], c[0]];
      });
      if (pts.length) {
        mapMacro.flyToBounds(L.latLngBounds(pts).pad(0.35),
          { maxZoom: 5, duration: 1.2 });
      }
    }
  }
  /* "全景" = 全部阶段同屏（当前阶段高亮、其余降为灰线） */
  btnAllEl.onclick = function () {
    macroMode = 'focus';
    showStage(+range.value);
  };
  /* "独占" = 只看当前阶段 */
  btnSoloEl.onclick = function () {
    macroMode = 'solo';
    showStage(+range.value);
  };
  /* 悬停聚焦：任意路线悬停即升为主角，其余退为背景（信息不减，注意力聚焦） */
  nationalLines.forEach(function (l) {
    l.on('mouseover', function () {
      var el = l.getElement && l.getElement();
      if (!el) return;
      mapMacro.getContainer().classList.add('route-hover');
      el.classList.add('hl-route');
      if (macroMode === 'focus' && l._stage !== +range.value) {
        l.setStyle({ color: M.stageColor[l._stage], weight: 3, opacity: .95 });
      }
    });
    l.on('mouseout', function () {
      mapMacro.getContainer().classList.remove('route-hover');
      var el = l.getElement && l.getElement();
      if (el) el.classList.remove('hl-route');
      styleNational();
    });
  });
  range.oninput = function () { stopPlay(); showStage(+range.value); };

  var playTimer = null, playBtn = document.getElementById('btnPlay');
  function stopPlay() {
    if (playTimer) { clearInterval(playTimer); playTimer = null; playBtn.textContent = '▶'; playBtn.classList.remove('on'); }
  }
  playBtn.onclick = function () {
    if (playTimer) { stopPlay(); return; }
    playBtn.textContent = '⏸'; playBtn.classList.add('on');
    var id = +range.value >= 8 ? 1 : +range.value;
    showStage(id, true);
    playTimer = setInterval(function () {
      id++;
      if (id > 8) { stopPlay(); return; }
      showStage(id, true);
    }, 2600);
  };
  /* 初始进入全景模式：全部阶段同屏、当前（第八阶段）高亮流光，其余退为灰线；
     拖动时间轴或"独占"按钮进入独占模式 */
  showStage(8);
  btnAllEl.onclick();
  updateHistLayer();

  /* ============================================================
   * 微观视图（双洲 · 邹游村）
   * ============================================================ */
  var mapMicro = L.map('mapMicro', { zoomControl: true, scrollWheelZoom: false });
  /* ③号窗仅保留高德街道底图（地级市区划底图已按需取消） */
  L.tileLayer(GAODE_URL,
    { maxZoom: 18, subdomains: '1234', attribution: '© 高德地图' }).addTo(mapMicro);

  /* 初始视野：双洲/邹游村建筑群 + 八景诗点（概略坐标），保证 ①—⑧ 一屏可见 */
  (function () {
    var core = ['邹游村', '游家洲', '双洲村'];
    var pts = M.villagePlaces.features.filter(function (f) {
      return core.indexOf(f.properties.name) >= 0;
    }).map(function (f) {
      var c = f.geometry.coordinates; return [c[1], c[0]];
    });
    var PS = window.ZOU_POEMS;
    if (PS && PS.scenes) {
      PS.scenes.forEach(function (s) {
        if (s.coords && s.coords.length === 2) pts.push([s.coords[1], s.coords[0]]);
      });
    }
    mapMicro.fitBounds(L.latLngBounds(pts).pad(0.12), { maxZoom: 15 });
  })();

  var microLayers = L.layerGroup().addTo(mapMicro);

  addRoutes(mapMicro, M.villageRoutes, microLayers);
  var microKeys = addPlaces(mapMicro, M.villagePlaces, microLayers, { radius: 9 });

  /* ---------------- 先祖名签：世系树中所有可定位先祖标注于③号地图 ---------------- */
  function personPopHTML(d) {
    var st = M.stages[(d.stage || 6) - 1] || {};
    var html = '<div class="pop">'
      + '<span class="badge" style="background:' + st.color + '">' + esc(st.name) + '</span>'
      + '<div class="pt">' + esc(d.name) + '（第' + d.gen + '世）</div>';
    if (d.year) html += '<div class="pk"><b>纪年</b>：' + esc(d.year) + '</div>';
    if (d.place) html += '<div class="pk"><b>迁居地</b>：' + esc(d.place) + '</div>';
    if (d.alias) html += '<div class="pk"><b>字号</b>：' + esc(d.alias) + '</div>';
    if (d.note) html += '<div class="pn">' + esc(d.note) + '</div>';
    return html + '</div>';
  }

  var personLayers = L.layerGroup().addTo(mapMicro);
  var personByKey = {};
  (function () {
    var persons = [];
    (function walk(n) {
      if (n.latlng && n.latlng.length === 2) persons.push(n);
      (n.children || []).forEach(walk);
    })(M.lineage);
    persons.forEach(function (d) {
      var color = M.stageColor[d.stage] || '#8a5a2b';
      var m = L.marker(d.latlng, {
        icon: L.divIcon({ className: '', iconSize: [0, 0], iconAnchor: [0, 0],
          html: '<div style="position:absolute;transform:translate(-50%,-150%)">'
            + '<div class="person-pill" style="border-color:' + color + ';color:' + color + '">'
            + d.gen + '世·' + esc(d.name) + '</div></div>'
            + '<div style="position:absolute;transform:translate(-50%,-50%);width:9px;height:9px;'
            + 'border-radius:50%;background:' + color + ';border:2px solid #fff;'
            + 'box-shadow:0 1px 3px rgba(0,0,0,.35)"></div>' })
      }).bindPopup(personPopHTML(d));
      m._person = d;
      m._key = d.latlng[0] + ',' + d.latlng[1];
      personLayers.addLayer(m);
      personByKey[m._key] = m;
    });
  })();

  document.getElementById('chkPersons').onchange = function () {
    if (this.checked) { personLayers.addTo(mapMicro); }
    else { mapMicro.removeLayer(personLayers); }
  };

  /* ---------------- 八景诗点（诗路地图）：①—⑧ 与 05 八景卡同序 ----------------
     坐标为族人所给概略范围，仅作示意标注；点击诗点直接展开该景诗卷。
     序号取自 #poemGrid 中 chips 的先后，数据侧不再另存一份顺序。 */
  var poemPts = L.layerGroup().addTo(mapMicro);
  var poemPtsLL = [];
  (function () {
    var P = window.ZOU_POEMS;
    if (!P || !P.scenes || !P.scenes.length) return;
    var grid = document.getElementById('poemGrid');
    var seq = [];
    Array.prototype.forEach.call(grid ? grid.querySelectorAll('.poem-chip') : [], function (b) {
      seq.push(b.getAttribute('data-scene'));
    });
    if (!seq.length) seq = P.scenes.map(function (s) { return s.id; });
    var byId = {};
    P.scenes.forEach(function (s) { byId[s.id] = s; });
    seq.forEach(function (id, i) {
      var s = byId[id];
      if (!s || !s.coords || s.coords.length !== 2) return;
      var ll = [s.coords[1], s.coords[0]];
      poemPtsLL.push(ll);
      L.marker(ll, {
        zIndexOffset: 800,
        title: s.displayName + '（第 ' + (i + 1) + ' 景）',
        alt: s.displayName,
        icon: L.divIcon({
          className: 'poem-pin-ico', iconSize: [23, 23], iconAnchor: [11.5, 11.5],
          html: '<span class="poem-pin">' + (i + 1) + '</span>'
        })
      })
        .on('click', function () {
          if (window.__POEM_UI) window.__POEM_UI.open(s.id, 'qing');
        })
        .bindTooltip('（' + (i + 1) + '）' + esc(s.displayName) + ' · 概略位置 · 点击读诗',
          { direction: 'top', offset: [0, -8] })
        .addTo(poemPts);
    });
  })();

  document.getElementById('chkPoemPts').onchange = function () {
    if (this.checked) poemPts.addTo(mapMicro);
    else mapMicro.removeLayer(poemPts);
  };

  /* v2.7：把 ③ 号图带回视口并短暂描边——凡是"让地图动作"的入口都要调它，
     否则用户站在下方面板，只看见地图在屏幕外变化，等同没反应 */
  function revealMicroMap(after) {
    var card = document.querySelector('.card-micro');
    var row = document.getElementById('secMicro');
    if (row) row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (card) {
      card.classList.add('is-locate');
      setTimeout(function () { card.classList.remove('is-locate'); }, 2000);
    }
    /* 滚动会触发下潜场景按步骤重新取景，先等它落定再做 fit/flyTo，
       否则刚设好的视野会被覆盖（诗点又挤成一团） */
    if (after) {
      /* 平滑滚动 + 下潜步骤取景合计约 1 秒，1200ms 后再设视野才不被覆盖；
         再补一次 400ms 后的校正，防止最后一段惯性滚动又改回步骤取景 */
      setTimeout(after, 1200);
      setTimeout(after, 1650);
    }
  }

  function fitPoemPts() {
    if (!poemPtsLL.length) return false;
    mapMicro.fitBounds(L.latLngBounds(poemPtsLL).pad(0.25), { maxZoom: 16 });
    return true;
  }
  window.__ZOU_POEMS_MAP = { fit: fitPoemPts, points: poemPtsLL };

  (function () {
    var btn = document.getElementById('btnPoemFit');
    var msg = document.getElementById('poemMapMsg');
    if (!btn) return;
    btn.addEventListener('click', function () {
      if (!poemPtsLL.length) { if (msg) msg.textContent = '诗点数据未加载'; return; }
      /* v2.7.1：诗点层被关掉时不能"定位到看不见的点"——自动打开并说明 */
      var chk = document.getElementById('chkPoemPts');
      var turnedOn = false;
      if (chk && !chk.checked) {
        chk.checked = true;
        if (chk.onchange) chk.onchange();
        turnedOn = true;
      }
      revealMicroMap(function () { fitPoemPts(); });
      /* 八个诗点闪烁 2.4s，指出"就是这几个点" */
      var wrap = document.getElementById('mapMicro');
      if (wrap) {
        wrap.classList.add('poem-flash');
        setTimeout(function () { wrap.classList.remove('poem-flash'); }, 2400);
      }
      if (msg) msg.textContent = (turnedOn ? '诗点层原为关闭，已自动打开；' : '')
        + '已定位 ' + poemPtsLL.length + ' 个诗点（概略位置），上行 ③ 号图已描边闪烁';
      showToast(turnedOn ? '诗点层原为关闭，已自动打开并定位八景'
        : '已定位八景诗点，③ 号图在上方');
    });
  })();

  /* 微观里程 */
  (function () {
    var f = M.villageRoutes.features;
    var land = 0, water = 0;
    f.forEach(function (r) {
      var c = r.geometry.coordinates, d = 0;
      for (var i = 1; i < c.length; i++) d += M.dist(c[i - 1], c[i]);
      if (r.properties.from === '湖边（新淦）') land = d; else water = d;
    });
    document.getElementById('villageMetric').innerHTML =
      '量算：湖边 → 双洲直线约 <b>' + land.toFixed(0) + ' km</b>；'
      + '双洲 → 临江府城直线约 <b>' + water.toFixed(1) + ' km</b>'
      + '（谱载「二十四里许」按清代里制约合 12.7—14.4 km，为顺袁水河道距离；'
      + '双洲村、临江府城等坐标均为族人实测，直线量算供参考）';
  })();

  /* ---------------- 世系树（D3，纵向布局适配侧栏） ---------------- */
  function renderTree() {
    var box = document.getElementById('treeBox');
    box.innerHTML = '';
    var BW = box.clientWidth || 360, colW = 96, rowH = 76;
    var root = d3.hierarchy(M.lineage);
    var treeLayout = d3.tree().nodeSize([colW, rowH]);
    treeLayout(root);

    var x0 = root.descendants().map(function (d) { return d.x; });
    var minX = Math.min.apply(null, x0) - 30, maxX = Math.max.apply(null, x0) + 30;
    var treeW = maxX - minX;
    var svgH = Math.max(500, (root.height + 1) * rowH + 80);
    var svg = d3.select(box).append('svg')
      .attr('width', BW).attr('height', svgH)
      .attr('viewBox', '0 0 ' + BW + ' ' + svgH);
    var g = svg.append('g');
    var initTx = d3.zoomIdentity.translate(BW / 2 - (minX + maxX) / 2, 26);
    var zoomBeh = d3.zoom().scaleExtent([0.5, 2.2])
      .on('zoom', function (event) { g.attr('transform', event.transform); });
    svg.call(zoomBeh);
    svg.call(zoomBeh.transform, initTx);
    svg.on('dblclick.zoom', null);

    g.selectAll('.tlink').data(root.links()).join('path')
      .attr('class', 'tlink')
      .attr('d', d3.linkVertical().x(function (d) { return d.x; })
        .y(function (d) { return d.y; }));

    var node = g.selectAll('.tnode').data(root.descendants()).join('g')
      .attr('class', function (d) {
        return 'tnode' + (d.data.placeholder ? ' placeholder' : '');
      })
      .attr('transform', function (d) { return 'translate(' + d.x + ',' + d.y + ')'; });

    node.append('circle')
      .attr('r', function (d) { return d.data.placeholder ? 5 : 9; })
      .attr('cy', 0)
      .attr('fill', function (d) { return d.data.latlng ? '#8a5a2b' : '#fff'; })
      .attr('stroke', function (d) { return d.data.latlng ? '#fff' : '#8a5a2b'; });

    node.append('text')
      .attr('x', 0).attr('y', -14).attr('text-anchor', 'middle')
      .text(function (d) { return d.data.name; });
    node.append('text').attr('class', 'gen')
      .attr('x', 0).attr('y', 24).attr('text-anchor', 'middle')
      .text(function (d) {
        var t = '第' + d.data.gen + '世';
        if (d.data.year) t += ' · ' + d.data.year;
        if (d.data.place) t += ' · ' + d.data.place;
        return t;
      });

    node.on('click', function (event, d) {
      event.stopPropagation();
      node.classed('hl', false);
      d3.select(this).classed('hl', true);
      if (d.data.latlng && d.data.latlng.length === 2) {
        /* v2.7：树在地图下方，只 flyTo 屏幕外的地图＝"点了没反应"。
           先把 ③ 号图带回视口，再飞行定位，并给一句回执 */
        var key = d.data.latlng[0] + ',' + d.data.latlng[1];
        var mk = personByKey[key] || microKeys[key];
        revealMicroMap(function () {
          mapMicro.flyTo(d.data.latlng, 13, { duration: .8 });
          if (mk) setTimeout(function () { mk.openPopup(); }, 900);
        });
        showToast('已在 ③ 号图定位：第' + d.data.gen + '世 · ' + d.data.name);
      } else {
        showToast('第' + d.data.gen + '世 · ' + d.data.name + ' 暂无坐标，③ 号图无法定位');
      }
    });

    /* 地图节点 → 树高亮（村落点位 + 先祖名签） */
    function bindHighlight(markerMap) {
      Object.keys(markerMap).forEach(function (k) {
        markerMap[k].on('click', function () {
          node.classed('hl', false);
          node.filter(function (d) {
            return d.data.latlng && (d.data.latlng[0] + ',' + d.data.latlng[1]) === k;
          }).classed('hl', true);
        });
      });
    }
    bindHighlight(microKeys);
    bindHighlight(personByKey);
  }

  /* ============================================================
   * 三窗定位按钮 / 自适应 / 世系树初始化
   * ============================================================ */
  document.getElementById('btnFocusMacro').onclick = function () {
    document.querySelector('.card-macro').scrollIntoView({ behavior: 'smooth', block: 'start' });
    mapMacro.fitBounds(L.latLngBounds(
      M.nationalPlaces.features.filter(function (f) {
        return f.geometry.coordinates[1] >= 18;   /* 排除新加坡/吉隆坡等海外节点 */
      }).map(function (f) {
        var c = f.geometry.coordinates; return [c[1], c[0]];
      })).pad(0.05));
  };
  document.getElementById('btnFocusChain').onclick = function () {
    document.querySelector('.card-chain').scrollIntoView({ behavior: 'smooth', block: 'start' });
    mapChain.fitBounds(L.latLngBounds(chainCoords).pad(0.18));
  };
  document.getElementById('btnFocusMicro').onclick = function () {
    document.querySelector('.card-micro').scrollIntoView({ behavior: 'smooth', block: 'start' });
    var core = ['邹游村', '游家洲', '双洲村'];
    var pts = M.villagePlaces.features.filter(function (f) {
      return core.indexOf(f.properties.name) >= 0;
    }).map(function (f) {
      var c = f.geometry.coordinates; return [c[1], c[0]];
    });
    mapMicro.flyToBounds(L.latLngBounds(pts).pad(0.12), { maxZoom: 15, duration: .8 });
  };

  window.addEventListener('resize', function () {
    mapMacro.invalidateSize();
    mapChain.invalidateSize();
    mapMicro.invalidateSize();
  });
  /* 容器尺寸变化（如展开统计面板拉高布局）时自动重算，防止灰白留白 */
  if (window.ResizeObserver) {
    var mapRO = new ResizeObserver(function () {
      mapHeat.invalidateSize();
      mapMacro.invalidateSize();
      mapChain.invalidateSize();
      mapMicro.invalidateSize();
    });
    ['mapMacro', 'mapChain', 'mapMicro'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) mapRO.observe(el);
    });
  }
  /* 字体/布局稳定后重算三窗尺寸，避免瓦片留白 */
  var bootAt = Date.now(), chainTouched = false, microTouched = false;
  mapChain.on('zoomstart dragstart', function () {
    if (Date.now() - bootAt > 1500) chainTouched = true;
  });
  mapMicro.on('zoomstart dragstart', function () {
    if (Date.now() - bootAt > 1500) microTouched = true;
  });
  function fitChainHome() {
    if (chainCoords.length) mapChain.fitBounds(L.latLngBounds(chainCoords).pad(0.18));
  }
  function fitMicroHome() {
    var core = ['邹游村', '游家洲', '双洲村'];
    var pts = M.villagePlaces.features.filter(function (f) {
      return core.indexOf(f.properties.name) >= 0;
    }).map(function (f) { var c = f.geometry.coordinates; return [c[1], c[0]]; });
    mapMicro.fitBounds(L.latLngBounds(pts).pad(0.12), { maxZoom: 15 });
  }
  window.addEventListener('load', function () {
    setTimeout(function () {
      mapHeat.invalidateSize();
      mapMacro.invalidateSize();
      mapChain.invalidateSize();
      mapMicro.invalidateSize();
      /* 初始 fitBounds 早于最终布局，按真实尺寸重新取景（用户已操作则不打扰） */
      if (!chainTouched) fitChainHome();
      if (!microTouched) fitMicroHome();
    }, 400);
  });
  /* 打印（含"另存为 PDF"）前重算尺寸，避免打印稿中地图空白 */
  window.addEventListener('beforeprint', function () {
    [mapHeat, mapMacro, mapChain, mapMicro].forEach(function (m) { m.invalidateSize(); });
    /* 统计图未展开/未初始化时，打印稿隐藏其空容器 */
    var gb = document.getElementById('chartGens');
    if (gb && !gb.querySelector('canvas')) {
      var boxEl = gb.closest('.chart-box') || gb;
      boxEl.classList.add('mig-nochart');
    }
  });
  window.addEventListener('afterprint', function () {
    var gb = document.getElementById('chartGens');
    if (gb) { var boxEl = gb.closest('.chart-box') || gb; boxEl.classList.remove('mig-nochart'); }
  });

  /* 面板常显，DOM 就绪后直接渲染世系树 */
  renderTree();

  /* ---------------- 名人堂卡片（B方案，与①号星标互通） ---------------- */
  (function () {
    var wrap = document.getElementById('notableCards');
    if (!wrap) return;
    M.notable.forEach(function (d) {
      var card = document.createElement('div');
      card.className = 'notable-card';
      card.innerHTML = '<div class="nc-head"><span class="nc-star">★</span><b>' + esc(d.name)
        + '</b><span class="nc-era">' + esc(d.era) + ' · ' + esc(d.dyn) + '</span></div>'
        + '<div class="nc-title">' + esc(d.title) + '</div>'
        + '<div class="nc-bio">' + esc(d.bio) + '</div>'
        + '<div class="nc-allu">典故：' + esc(d.allusion) + '</div>';
      card.onclick = function () {
        var details = document.getElementById('notableDetails');
        if (details && !details.open) details.open = true;
        if (!document.getElementById('chkNotable').checked) {
          document.getElementById('chkNotable').checked = true;
          notableLayer.addTo(mapMacro);
        }
        document.querySelector('.card-macro').scrollIntoView({ behavior: 'smooth', block: 'start' });
        mapMacro.flyTo(d.latlng, 7, { duration: .8 });
        var mk = notableByKey[d.name];
        if (mk) setTimeout(function () { mk.openPopup(); }, 900);
      };
      wrap.appendChild(card);
    });
  })();

  /* ---------------- 时空路径剖面图（纬度 × 年代） ---------------- */
  (function renderSpaceTime() {
    var el = document.getElementById('stChart');
    if (!el || !window.d3) return;
    var stops = [
      { n: '① 莱州', yr: 620, lat: 37.1789 },
      { n: '② 范阳', yr: 620, lat: 39.4862 },
      { n: '③ 光州', yr: 760, lat: 32.1347 },
      { n: '④ 宜黄', yr: 800, lat: 27.5546 },
      { n: '⑤ 埮坪', yr: 965, lat: 27.60 },
      { n: '⑥ 湖边', yr: 1080, lat: 27.7404 },
      { n: '⑦ 双洲', yr: 1507, lat: 27.9253 }
    ];
    var W = 800, H = 250, m = { t: 26, r: 26, b: 32, l: 52 };
    var x = d3.scaleLinear().domain([560, 1560]).range([m.l, W - m.r]);
    var y = d3.scaleLinear().domain([25, 41]).range([H - m.b, m.t]);
    var svg = d3.select(el).append('svg')
      .attr('viewBox', '0 0 ' + W + ' ' + H).style('width', '100%')
      .style('display', 'block');
    svg.append('g').attr('transform', 'translate(0,' + (H - m.b) + ')')
      .call(d3.axisBottom(x).ticks(7).tickFormat(d3.format('d')));
    svg.append('g').attr('transform', 'translate(' + m.l + ',0)')
      .call(d3.axisLeft(y).ticks(6).tickFormat(function (v) { return v + '°N'; }));
    svg.append('path').datum(stops)
      .attr('d', d3.line().x(function (d) { return x(d.yr); })
        .y(function (d) { return y(d.lat); }))
      .attr('fill', 'none').attr('stroke', '#8a5a2b').attr('stroke-width', 2.5);
    svg.selectAll('circle.stop').data(stops).join('circle')
      .attr('class', 'stop')
      .attr('cx', function (d) { return x(d.yr); })
      .attr('cy', function (d) { return y(d.lat); })
      .attr('r', 5).attr('fill', '#8a5a2b').attr('stroke', '#fff').attr('stroke-width', 2);
    svg.selectAll('text.lbl').data(stops).join('text')
      .attr('class', 'lbl')
      .attr('x', function (d) { return x(d.yr); })
      .attr('y', function (d) { return y(d.lat) - 11; })
      .attr('text-anchor', 'middle').attr('font-size', 10.5)
      .attr('fill', '#241f18').text(function (d) { return d.n; });
    svg.append('text').attr('x', W / 2).attr('y', 14)
      .attr('text-anchor', 'middle').attr('font-size', 11)
      .attr('fill', '#7b7366')
      .text('纬度剖面：由北向南的长线播迁（39.5°N → 28°N）—— 620 年出镇范阳，约 800 年（贞元）入赣，1507 年落籍双洲');
  })();

  /* 统计图点击放大（灯箱）—— v3.6.6:图片改为打开时才创建,页面不再带空 src 的 img */
  (function () {
    var lb = document.createElement('div');
    lb.className = 'lightbox';
    document.body.appendChild(lb);
    var lbImg = null;
    lb.addEventListener('click', function () { lb.classList.remove('on'); });
    Array.prototype.forEach.call(
      document.querySelectorAll('.stats-details img'),
      function (img) {
        img.title = '点击查看大图';
        img.addEventListener('click', function () {
          if (!lbImg) {
            lbImg = document.createElement('img');
            lbImg.alt = '统计大图（点击关闭）';
            lb.appendChild(lbImg);
          }
          lbImg.src = img.src;
          lb.classList.add('on');
        });
      });
  })();

  /* ---------------- 地点/先祖搜索 ---------------- */
  (function () {
    var box = document.getElementById('searchBox'),
        res = document.getElementById('searchResults');
    var index = [];
    function addEntry(marker, map, kind, zoom) {
      var p = marker._props || marker._person || {};
      index.push({ title: p.name || '', sub: p.oldName || p.place || '',
        kind: kind, marker: marker, map: map, zoom: zoom || 12 });
    }
    Object.keys(macroKeys).forEach(function (k) { addEntry(macroKeys[k], mapMacro, '① 宏观节点', 6); });
    Object.keys(chainKeys2).forEach(function (k) { addEntry(chainKeys2[k], mapChain, '② 迁徙链', 9); });
    Object.keys(microKeys).forEach(function (k) { addEntry(microKeys[k], mapMicro, '③ 双洲点位', 14); });
    Object.keys(personByKey).forEach(function (k) { addEntry(personByKey[k], mapMicro, '③ 先祖', 13); });
    /* v2.7：八景诗也进索引——陌生人通常是先在 05 看到景名，再回头搜它 */
    ((window.ZOU_POEMS && window.ZOU_POEMS.scenes) || []).forEach(function (sc) {
      if (!sc.coords || sc.coords.length !== 2) return;
      index.push({ title: sc.displayName || sc.name, sub: sc.alias || '',
        kind: '八景诗', sceneId: sc.id, latlng: [sc.coords[1], sc.coords[0]], zoom: 16 });
    });

    var activeIdx = -1;
    function items() {
      return Array.prototype.slice.call(res.querySelectorAll('.sr-item[data-i]'));
    }
    function setActive(n) {
      var its = items();
      if (!its.length) return;
      activeIdx = (n + its.length) % its.length;
      its.forEach(function (el, i) { el.classList.toggle('on', i === activeIdx); });
      if (its[activeIdx].scrollIntoView) its[activeIdx].scrollIntoView({ block: 'nearest' });
    }

    function render(q) {
      q = q.trim();
      activeIdx = -1;
      if (!q) { res.hidden = true; res.innerHTML = ''; return; }
      var hits = index.filter(function (e) {
        var hay = e.title + ' ' + e.sub;
        if (e.marker) {
          hay += ' ' + (e.marker._props ? e.marker._props.note || '' : '')
               + ' ' + (e.marker._person ? e.marker._person.note || '' : '');
        } else if (e.sceneId) {
          hay += ' 双洲八景 诗 ' + e.sceneId;   /* 搜「八景」「诗」也能命中 */
        }
        return hay.indexOf(q) >= 0;
      }).sort(function (a, b) {
        var sa = a.title.indexOf(q) >= 0 ? 0 : (a.sub && a.sub.indexOf(q) >= 0 ? 1 : 2);
        var sb = b.title.indexOf(q) >= 0 ? 0 : (b.sub && b.sub.indexOf(q) >= 0 ? 1 : 2);
        return sa - sb;
      }).slice(0, 8);
      if (!hits.length) {
        res.innerHTML = '<div class="sr-item sr-empty">无匹配结果 —— 可试「宜黄」「有宗公」「三江远渡」</div>';
        res.hidden = false; return;
      }
      res.innerHTML = hits.map(function (e, i) {
        return '<div class="sr-item" data-i="' + index.indexOf(e) + '"><b>' + esc(e.title) + '</b>'
          + '<span class="sr-kind">' + esc(e.kind) + '</span>'
          + (e.sub ? '<span class="sr-sub">' + esc(e.sub) + '</span>' : '') + '</div>';
      }).join('');
      res.hidden = false;
      Array.prototype.forEach.call(res.querySelectorAll('.sr-item'), function (el) {
        el.onclick = function () {
          var e = index[+el.getAttribute('data-i')];
          res.hidden = true; box.value = e.title;
          if (e.sceneId) {
            /* 八景：先把 ③ 号图视野对到该点，再直接开诗卷（抽屉会锁滚动） */
            mapMicro.setView(e.latlng, e.zoom);
            if (window.__POEM_UI) window.__POEM_UI.open(e.sceneId, 'qing');
            return;
          }
          document.querySelector('.map-grid .map-card, .map-row').scrollIntoView({ block: 'start' });
          if (e.map === mapMacro) document.querySelector('.card-macro').scrollIntoView({ behavior: 'smooth', block: 'start' });
          if (e.map === mapChain) document.querySelector('.card-chain').scrollIntoView({ behavior: 'smooth', block: 'start' });
          if (e.map === mapMicro) document.querySelector('.card-micro').scrollIntoView({ behavior: 'smooth', block: 'start' });
          e.map.flyTo(e.marker.getLatLng(), e.zoom, { duration: .8 });
          setTimeout(function () { e.marker.openPopup(); }, 900);
        };
      });
    }
    box.addEventListener('input', function () { render(box.value); });
    box.addEventListener('focus', function () { if (box.value) render(box.value); });
    /* v2.7.1：补键盘操作——原来只绑 input/focus，输完按 Enter 毫无反应 */
    box.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive(activeIdx + 1); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setActive(activeIdx - 1); return; }
      if (e.key === 'Escape') { res.hidden = true; return; }
      if (e.key === 'Enter') {
        var its = items();
        if (!its.length) return;
        e.preventDefault();
        (its[activeIdx] || its[0]).click();
      }
    });
    document.addEventListener('click', function (ev) {
      if (!ev.target.closest || !ev.target.closest('.search-wrap')) res.hidden = true;
    });
  })();

  /* ---------------- 世代人口统计交互图表（ECharts，展开时懒加载） ----------------
   * 注意：页内有多个 .stats-details（名人堂/世系统计），必须定位到包含
   * #chartGens 的那一个，否则 toggle 永远不触发、图表区一直空白 */
  (function () {
    var gensBox = document.getElementById('chartGens');
    var details = gensBox ? gensBox.closest('.stats-details') : null;
    if (!details || !window.echarts) return;
    var done = false;
    function init() {
      if (done) { resize(); return; }
      done = true;
      var gens = [], counts = [1, 1, 2, 3, 3, 5, 8, 15, 26, 57, 96, 84, 110, 111,
        105, 77, 68, 66, 92, 92, 47, 5];
      for (var g = 18; g <= 39; g++) gens.push(g + '世');
      /* 3.4 人口-世系双轴：柱=该世男丁数，线=累计占比（同一套数据，不另取数） */
      var total = counts.reduce(function (a, b) { return a + b; }, 0), run = 0;
      var cumPct = counts.map(function (v) { run += v; return +(run / total * 100).toFixed(1); });
      echarts.init(document.getElementById('chartGens')).setOption({
        grid: { left: 44, right: 44, top: 34, bottom: 40 },
        tooltip: { trigger: 'axis' },
        legend: { top: 0, left: 40, itemWidth: 10, itemHeight: 8,
          textStyle: { fontSize: 11, color: '#5f5b52' }, data: ['该世男丁', '累计占比'] },
        xAxis: { type: 'category', data: gens,
          axisLabel: { fontSize: 10, interval: 0, rotate: 45 } },
        yAxis: [
          { type: 'value', name: '男丁数', nameTextStyle: { fontSize: 10 } },
          { type: 'value', name: '', max: 100, splitLine: { show: false },
            axisLabel: { fontSize: 10, formatter: '{value}%' } }
        ],
        series: [
          { name: '该世男丁', type: 'bar', data: counts, barWidth: '60%',
            itemStyle: { color: '#8a5a2b' },
            label: { show: true, position: 'top', fontSize: 9 } },
          { name: '累计占比', type: 'line', yAxisIndex: 1, data: cumPct,
            smooth: true, symbol: 'circle', symbolSize: 4,
            lineStyle: { width: 2, color: '#9d2f22' },
            itemStyle: { color: '#9d2f22' } }
        ]
      });
      var xi = [['禧时', 344], ['禧明', 178], ['禧选', 103], ['禧茂', 72], ['禧源', 42],
        ['禧景', 40], ['禧胜', 56], ['禧瑞', 66], ['禧曜', 18], ['禧照', 30],
        ['禧鼎', 20], ['禧旺', 8], ['禧春', 6], ['禧栟', 7], ['禧旭', 7], ['禧昶', 14]];
      xi.sort(function (a, b) { return b[1] - a[1]; });
      echarts.init(document.getElementById('chartXi')).setOption({
        grid: { left: 62, right: 46, top: 10, bottom: 22 },
        tooltip: { trigger: 'axis' },
        xAxis: { type: 'value', name: '后裔人数', nameTextStyle: { fontSize: 10 } },
        yAxis: { type: 'category', data: xi.map(function (d) { return d[0]; }),
          axisLabel: { fontSize: 10.5 } },
        series: [{ type: 'bar', data: xi.map(function (d) { return d[1]; }),
          barWidth: '60%', itemStyle: { color: '#534AB7' },
          label: { show: true, position: 'right', fontSize: 9 } }]
      });
    }
    function resize() {
      [document.getElementById('chartGens'), document.getElementById('chartXi')]
        .forEach(function (el) {
          var inst = el && echarts.getInstanceByDom(el);
          if (inst) inst.resize();
        });
    }
    details.addEventListener('toggle', function () {
      if (!details.open) return;
      setTimeout(function () {
        init();
        /* 展开使左栏变高、③号图容器随之变高，需重算瓦片 */
        mapMicro.invalidateSize();
      }, 60);
    });
  })();

  /* ---------------- ②号窗：重走迁徙路 ---------------- */
  (function () {
    var btn = document.getElementById('btnJourney');
    var running = false, stop = false;
    btn.onclick = function () {
      if (running) { stop = true; return; }
      running = true; stop = false;
      btn.textContent = '⏹ 停止'; btn.classList.add('on');
      document.querySelector('.card-chain').scrollIntoView({ behavior: 'smooth', block: 'start' });
      var i = 0;
      (function next() {
        if (stop || i >= chainCoords.length) {
          running = false; stop = false;
          btn.textContent = '▶ 重走迁徙路（① → ⑦）'; btn.classList.remove('on');
          return;
        }
        var key = chainCoords[i][0] + ',' + chainCoords[i][1];
        var m = chainKeys2[key];
        mapChain.flyTo(chainCoords[i], i === 0 ? 7 : 8, { duration: 1.6 });
        if (m) setTimeout(function () { if (!stop) m.openPopup(); }, 1700);
        i++;
        setTimeout(next, 3200);
      })();
    };
  })();

  /* ---------------- 地图内嵌图层管理器 + 双洲村缓冲区分析 ---------------- */
  (function () {
    function addBox(map, title, nodes, opts) {
      opts = opts || {};
      var bodyRef = null;
      var Ctrl = L.Control.extend({
        options: { position: 'topright' },
        onAdd: function () {
          var div = L.DomUtil.create('div', 'map-layer-box leaflet-control');
          var h = L.DomUtil.create('div', 'mlb-title');
          h.innerHTML = '<span class="mlb-name">' + title + '</span>'
            + '<span class="mlb-toggle">▾</span>';
          var body = L.DomUtil.create('div', 'mlb-body');
          nodes.forEach(function (n) { if (n) body.appendChild(n); });
          div.appendChild(h);
          div.appendChild(body);
          bodyRef = body;
          h.addEventListener('click', function () {
            var collapsed = div.classList.toggle('collapsed');
            h.querySelector('.mlb-toggle').textContent = collapsed ? '▸' : '▾';
          });
          if (opts.collapsed) { div.classList.add('collapsed'); h.querySelector('.mlb-toggle').textContent = '▸'; }
          L.DomEvent.disableClickPropagation(div);
          L.DomEvent.disableScrollPropagation(div);
          return div;
        }
      });
      map.addControl(new Ctrl());
      return bodyRef;
    }
    var chainLbl = document.getElementById('chkChain').closest('.switchline');
    var histLbl = document.getElementById('chkHist').closest('.switchline');
    var jwhdLbl = document.getElementById('chkJwhd').closest('.switchline');
    var persLbl = document.getElementById('chkPersons').closest('.switchline');
    var poemLbl = document.getElementById('chkPoemPts').closest('.switchline');
    /* 缓冲区按钮行容器须先创建，否则 addBox 收到 undefined，按钮永不出现在面板中 */
    var bufRow = document.createElement('div');
    bufRow.className = 'buf-row';
    bufRow.id = 'bufRow';            /* v2.7.1：原先没给 id，出错提示那行永远找不到容器 */
    /* ①号图图层管理器默认折叠，减少右上角对地图的遮挡 */
    var macroBody = addBox(mapMacro, '图层管理', [chainLbl, histLbl, jwhdLbl, notableLbl],
      { collapsed: true });
    var microBody = addBox(mapMicro, '图层管理', [persLbl, poemLbl, bufRow]);

    /* 缓冲区按钮行（③号窗） */
    var lab = document.createElement('span');
    lab.className = 'buf-lab'; lab.textContent = '双洲村缓冲区';
    bufRow.appendChild(lab);
    var bufLayer = L.layerGroup(), activeBtn = null;
    var turfLoading = null, turfFailed = false;
    function turfError(msg) {
      if (bufRow.querySelector('.buf-err')) return;
      var d = document.createElement('div');
      d.className = 'pn buf-err';
      d.style.color = '#a33';
      d.textContent = msg;
      bufRow.appendChild(d);
    }
    function ensureTurf(cb) {
      if (window.turf) { cb(); return; }
      /* 已确认加载失败就不再重试，否则 Promise 已 fulfilled 会让回调立即重入、递归到栈溢出 */
      if (turfFailed) { turfError('缓冲区模块不可用，请刷新重试'); return; }
      if (!turfLoading) {
        turfLoading = new Promise(function (res, rej) {
          var s = document.createElement('script');
          s.src = 'js/vendor/turf.min.js';
          s.onload = function () {
            /* onload ≠ turf 已挂上：文件存在但内容不可执行时也要算失败 */
            if (window.turf) res(); else rej(new Error('turf 未挂载'));
          };
          s.onerror = function () { rej(new Error('turf 加载失败')); };
          document.head.appendChild(s);
        });
      }
      turfLoading.then(cb).catch(function () {
        turfFailed = true;
        turfError('缓冲区模块加载失败，请刷新重试');
      });
    }
    function setBuf(km, btn) {
      bufLayer.clearLayers(); mapMicro.removeLayer(bufLayer);
      if (activeBtn) activeBtn.classList.remove('on');
      activeBtn = null;
      if (!km) return;
      if (!window.turf) {
        ensureTurf(function () { setBuf(km, btn); });
        return;
      }
      var b = turf.buffer(turf.point([115.405510, 27.925320]), km, { units: 'kilometers' });
      var areaKm = turf.area(b) / 1e6;
      var bufGeo = L.geoJSON(b, { style: { color: '#2E6FA8', weight: 1.5,
          fillColor: '#4A90C4', fillOpacity: .12 } })
        .bindPopup('<div class="pop"><div class="pt">双洲村 ' + km
          + ' km 缓冲区</div><div class="pk">面积约 <b>' + areaKm.toFixed(0)
          + ' km²</b></div><div class="pn">turf.js 缓冲区分析（教学示意）</div></div>')
        .addTo(bufLayer);
      bufLayer.addTo(mapMicro);
      activeBtn = btn; btn.classList.add('on');
      /* 缓冲区半径常大于当前视野，缩放至缓冲区范围，避免"点了没反应" */
      mapMicro.fitBounds(bufGeo.getBounds().pad(0.12), { maxZoom: 11 });
    }
    [5, 10, 15].forEach(function (km) {
      var b = document.createElement('button');
      b.className = 'buf-btn'; b.textContent = km + 'km';
      b.onclick = function () { setBuf(km, b); };
      bufRow.appendChild(b);
    });
    var off = document.createElement('button');
    off.className = 'buf-btn'; off.textContent = '关';
    off.onclick = function () { setBuf(null, null); };
    bufRow.appendChild(off);

  })();


  /* ---------------- Hero 首屏：暗色中国地图 + 金色迁徙主轴 ---------------- */
  (function () {
    var el = document.getElementById('heroMap');
    if (!el || !window.d3 || !window.CHINA_PROV) return;
    /* 底图：china-outline.svg（DataV.GeoAtlas 官方国界精确轮廓，等比例线性映射
     * 73-135°E / 54-9.36°N → 1000×720，1°=1000/62px，两轴同比例无变形） */
    var VBW = 1000, VBH = 720, DPP = 1000 / 62; /* 每度像素（经纬同比例） */
    function hp(lng, lat) {
      return [(lng - 73) * DPP, (54 - lat) * DPP];
    }
    var svg = d3.select(el).append('svg')
      .attr('viewBox', '0 0 ' + VBW + ' ' + VBH)
      .attr('preserveAspectRatio', 'xMidYMid meet')
      .style('width', '100%').style('height', '100%')
      .style('display', 'block');
    /* 省级区划面：与底图同一线性投影，半透明马赛克透出国界 */
    var hproj = d3.geoTransform({ point: function (x, y) {
      this.stream.point((x - 73) * DPP, (54 - y) * DPP);
    }});
    var HERO_PALETTE = ['#42586f', '#3a4f68', '#40566d', '#3c5268', '#465d74',
      '#3e546a', '#485f76', '#3b5168', '#425a70', '#3d546b', '#415870', '#3d566c'];
    svg.selectAll('path.prov').data(window.CHINA_PROV.features).join('path')
      .attr('class', 'prov').attr('d', d3.geoPath(hproj))
      .attr('fill', function (d) {
        var p = d.properties, i = 0;
        for (var k = 0; k < p.name.length; k++) i += p.name.charCodeAt(k) * 7;
        return HERO_PALETTE[i % HERO_PALETTE.length];
      })
      .attr('fill-opacity', .5)
      .attr('stroke', '#74889e').attr('stroke-width', .7).attr('stroke-opacity', .5);
    /* ---- Canvas 粒子迁徙系统（学习寻根路 MigrationParticles 的实现） ---- */
    var canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;';
    el.appendChild(canvas);
    var cctx = canvas.getContext('2d');
    /* 迁徙节点（据调查报告整理；与主轴"邹城→范阳/豫鄂→苏浙皖赣→闽→粤桂→湘鄂→川渝台"对应） */
    var NODES = [
      { name: '邹城', lng: 116.9734, lat: 35.4047, key: true },
      { name: '范阳·涿州', lng: 115.9806, lat: 39.4862, key: true },
      { name: '商丘', lng: 115.6219, lat: 34.4101 },
      { name: '南阳', lng: 112.5283, lat: 32.9908 },
      { name: '光州·潢川', lng: 115.0500, lat: 32.1300 },
      { name: '常州', lng: 119.9500, lat: 31.7800 },
      { name: '宜黄', lng: 116.2840, lat: 27.5546 },
      { name: '泰宁', lng: 117.1780, lat: 26.8990 },
      { name: '平乐', lng: 110.6400, lat: 24.6300 },
      { name: '广州', lng: 113.2600, lat: 23.1300 },
      { name: '长沙', lng: 112.9400, lat: 28.2300 },
      { name: '成都', lng: 104.0657, lat: 30.6598 },
      { name: '台湾·台南', lng: 120.2100, lat: 23.0000 },
      { name: '双洲·樟树', lng: 115.4055, lat: 27.9253, key: true }
    ];
    var nodeByName = {};
    NODES.forEach(function (n) { nodeByName[n.name] = n; });
    /* 迁徙路网（节点对）：方向依报告——姓源自商丘食采于邹；
     * 秦汉北出范阳、西入豫鄂；永嘉南渡（范阳→常州）与
     * 本支南迁（范阳→光州→宜黄→双洲，依族谱注）；两宋泰宁入粤入桂；
     * 明清江西填湖广、湖广填四川；清代渡台 */
    var ROUTES = [
      ['商丘', '邹城'], ['邹城', '范阳·涿州'], ['邹城', '南阳'],
      ['范阳·涿州', '常州'], ['范阳·涿州', '光州·潢川'], ['光州·潢川', '宜黄'],
      ['宜黄', '双洲·樟树'], ['宜黄', '泰宁'], ['泰宁', '广州'], ['泰宁', '平乐'],
      ['广州', '台湾·台南'], ['双洲·樟树', '长沙'], ['长沙', '成都']
    ].map(function (r) { return [nodeByName[r[0]], nodeByName[r[1]]]; });
    /* viewBox 坐标 → 画布坐标（与省面 SVG 同投影）；rect 每帧缓存一次 */
    var curRect = { width: 1200, height: 480 };
    /* v2.2：必须用布局尺寸——getBoundingClientRect() 会含 Hero 推近的 scale()，
       导致投影比例被放大、再被 CSS 二次缩放，标注与路线随滚动外漂 */
    function refreshRect() {
      curRect = { width: el.offsetWidth, height: el.offsetHeight };
    }
    function vb2canvas(x, y) {
      var k = Math.min(curRect.width / 1000, curRect.height / 720);
      return [(curRect.width - 1000 * k) / 2 + x * k, (curRect.height - 720 * k) / 2 + y * k];
    }
    function sizeCanvas() {
      refreshRect();
      var dpr = window.devicePixelRatio || 1;
      canvas.width = curRect.width * dpr;
      canvas.height = curRect.height * dpr;
      cctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    /* 预计算节点与路线的 viewBox 投影坐标 */
    NODES.forEach(function (n) {
      var p = hp(n.lng, n.lat);
      n.vx = p[0]; n.vy = p[1];
    });
    ROUTES.forEach(function (r) {
      r.ax = r[0].vx; r.ay = r[0].vy;
      r.bx = r[1].vx; r.by = r[1].vy;
      r.len = Math.hypot(r.bx - r.ax, r.by - r.ay);
    });
    /* 粒子：每条路线按长度分配，沿段匀速推进 */
    var PARTICLES = [];
    ROUTES.forEach(function (r) {
      var n = Math.max(3, Math.round(r.len / 60));
      for (var i = 0; i < n; i++) {
        PARTICLES.push({ route: r, p: i / n, speed: 40 / r.len /* 40px/s */ });
      }
    });
    var lastT = Date.now(), heatVisible = true;
    if (window.IntersectionObserver) {
      new IntersectionObserver(function (es) {
        es.forEach(function (e) { heatVisible = e.isIntersecting; });
      }, { threshold: .05 }).observe(el);
    }
    window.addEventListener('resize', sizeCanvas);
    if (window.ResizeObserver) {
      new ResizeObserver(function () { sizeCanvas(); }).observe(el);
    } else {
      setInterval(sizeCanvas, 800);
    }
    function drawFrame() {
      var now = Date.now(), dt = Math.min(50, now - lastT) / 1000;
      lastT = now;
      if (heatVisible) {
        var rect = curRect;
        cctx.clearRect(0, 0, rect.width, rect.height);
        /* 1. 路线晕线 */
        cctx.strokeStyle = 'rgba(200,161,101,.13)';
        cctx.lineWidth = 1;
        ROUTES.forEach(function (r) {
          var a = vb2canvas(r.ax, r.ay), b = vb2canvas(r.bx, r.by);
          cctx.beginPath(); cctx.moveTo(a[0], a[1]); cctx.lineTo(b[0], b[1]); cctx.stroke();
        });
        /* 2. 粒子（光点 + 渐隐拖尾） */
        PARTICLES.forEach(function (pt) {
          pt.p += pt.speed * dt;
          if (pt.p > 1) pt.p -= 1;
          for (var s = 0; s < 4; s++) {
            var q = pt.p - s * .018;
            if (q < 0) continue;
            var ap = vb2canvas(pt.route.ax + (pt.route.bx - pt.route.ax) * q,
              pt.route.ay + (pt.route.by - pt.route.ay) * q);
            cctx.beginPath();
            cctx.arc(ap[0], ap[1], s === 0 ? 2.2 : 1.6 - s * .35, 0, Math.PI * 2);
            cctx.fillStyle = 'rgba(243,217,145,' + (s === 0 ? .95 : .5 - s * .12) + ')';
            cctx.fill();
          }
        });
        /* 3. 节点：呼吸光晕（v2.7 起 hero 内一律不出字——14 个地名会与标题、
              副标题、统计数字叠字；三处关键节点改由图例 .hero-legend 说明） */
        NODES.forEach(function (n) {
          var c = vb2canvas(n.vx, n.vy);
          var o = Math.sin(now / 1500 + n.lng) * .3 + .7;
          cctx.beginPath();
          cctx.arc(c[0], c[1], 4 + o * 3, 0, Math.PI * 2);
          cctx.fillStyle = 'rgba(200,161,101,' + (.3 + o * .3) + ')';
          cctx.fill();
          cctx.beginPath();
          cctx.arc(c[0], c[1], 2.4, 0, Math.PI * 2);
          cctx.fillStyle = '#f3d991';
          cctx.fill();
        });
      }
      requestAnimationFrame(drawFrame);
    }
    sizeCanvas();
    requestAnimationFrame(drawFrame);
    /* CTA 行为 */
    document.getElementById('heroPlay').onclick = function () {
      document.querySelector('.row-heat').scrollIntoView({ behavior: 'smooth', block: 'start' });
      setTimeout(function () {
        var b = document.getElementById('btnHeatPlay');
        if (b && !heatTimer) b.click();
      }, 900);
    };
  })();

  /* ============================================================
   * 字辈诗 ↔ 世代对照条（十八世 → 三十九世）
   * 依据《雙洲鄒氏族譜注》字辈诗 22 字，首字"宗"即十八世有宗公
   * ============================================================ */
  (function () {
    var bar = document.getElementById('zibeiBar');
    if (!bar) return;
    var CHARS = '宗仁仝才应益名汝禧镇德绍瑞尚占茂亮生嘉永和焕'.split('');
    var START = 18;
    var ANCHOR = {
      18: '有宗公 1507 年开基双洲，字辈诗首字',
      22: '应明、应朋、应元三大支分派于此世',
      26: '禧字辈 16 支（禧时 344 人、禧明 178 人、禧选 103 人）',
      39: '谱注载传至三十九世，共 5 人'
    };
    var byGen = {};
    (function walk(n) {
      if (n.gen) (byGen[n.gen] = byGen[n.gen] || []).push(n);
      (n.children || []).forEach(walk);
    })(M.lineage);
    var info = document.getElementById('zibeiInfo');
    var DEFAULT_INFO = info ? info.innerHTML : '';

    function clearHL() {
      Array.prototype.forEach.call(bar.children, function (c) { c.classList.remove('on'); });
      if (window.d3) d3.selectAll('#treeBox .tnode').classed('hl', false);
    }

    CHARS.forEach(function (ch, i) {
      var g = START + i;
      var names = (byGen[g] || []).filter(function (d) { return !d.placeholder; })
        .map(function (d) { return d.name; });
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'zb-cell' + (ANCHOR[g] ? ' anchor' : '');
      b.title = '第' + g + '世 · 字辈“' + ch + '”'
        + (names.length ? '（' + names.join('、') + '）' : '')
        + (ANCHOR[g] ? ' — ' + ANCHOR[g] : '');
      b.setAttribute('aria-label', '第 ' + g + ' 世，字辈 ' + ch
        + (ANCHOR[g] ? '，' + ANCHOR[g] : ''));
      b.innerHTML = '<span class="zb-char">' + ch + '</span><span class="zb-gen">' + g + '</span>';
      b.onclick = function () {
        var on = b.classList.contains('on');
        clearHL();
        if (on) { if (info) info.innerHTML = DEFAULT_INFO; return; }
        b.classList.add('on');
        if (window.d3) {
          d3.selectAll('#treeBox .tnode').classed('hl', function (d) {
            return d.data.gen === g;
          });
        }
        if (info) {
          info.innerHTML = '第 <b>' + g + '</b> 世 · 字辈“<b>' + ch + '</b>”：'
            + (names.length ? '世系树收录 ' + names.join('、') : '世系树暂未收录该世代人物')
            + (ANCHOR[g] ? '<br><span class="zb-anchor">' + ANCHOR[g] + '</span>' : '');
        }
      };
      bar.appendChild(b);
    });
  })();

  /* ============================================================
   * 地图全屏（三窗 + 序章图）
   * ============================================================ */
  (function () {
    function toggleFS(map) {
      var el = map.getContainer();
      var card = el.closest('.map-card') || el;
      if (document.fullscreenElement) { document.exitFullscreen(); return; }
      var req = card.requestFullscreen || card.webkitRequestFullscreen;
      if (!req) return;
      var p = req.call(card);
      if (p && p.then) p.then(function () { setTimeout(function () { map.invalidateSize(); }, 120); },
        function () {});
    }
    function addFS(map, label) {
      var Ctrl = L.Control.extend({
        options: { position: 'topleft' },
        onAdd: function () {
          var div = L.DomUtil.create('div', 'fs-ctrl leaflet-control');
          var b = L.DomUtil.create('button', 'fs-btn', div);
          b.type = 'button';
          b.textContent = '全屏';
          b.title = '全屏显示「' + label + '」';
          b.setAttribute('aria-label', '全屏显示' + label);
          L.DomEvent.disableClickPropagation(div);
          L.DomEvent.on(b, 'click', function () { toggleFS(map); });
          return div;
        }
      });
      map.addControl(new Ctrl());
    }
    addFS(mapHeat, '序章分布热区');
    addFS(mapMacro, '一号 全国宏观');
    addFS(mapChain, '二号 本支迁徙链');
    addFS(mapMicro, '三号 双洲微观');
    document.addEventListener('fullscreenchange', function () {
      [mapHeat, mapMacro, mapChain, mapMicro].forEach(function (m) {
        setTimeout(function () { m.invalidateSize(); }, 150);
      });
      var on = !!document.fullscreenElement;
      Array.prototype.forEach.call(document.querySelectorAll('.fs-btn'), function (b) {
        b.textContent = on ? '退出' : '全屏';
      });
    });
  })();

  /* ============================================================
   * URL 状态分享：阶段 / 时期 / 支系 / 图层 / 当前窗口
   * ?s=1-8 & h=1-8 & b=四位支系 & L=五位图层 & v=macro|chain|micro
   * ============================================================ */
  var urlReady = false, urlTimer = null;
  function buildURL() {
    var u = new URL(window.location.href);
    u.searchParams.set('s', range.value);
    u.searchParams.set('h', document.getElementById('heatRange').value);
    u.searchParams.set('b', ['cao', 'zi', 'yao', 'si'].map(function (k) {
      return branchSel[k] ? 1 : 0;
    }).join(''));
    u.searchParams.set('L', ['chkChain', 'chkHist', 'chkJwhd', 'chkNotable',
      'chkPersons', 'chkPoemPts']
      .map(function (id) {
        var el = document.getElementById(id);
        return el && el.checked ? 1 : 0;
      }).join(''));
    /* v2.7.1：显示模式也是视图状态，不带上就会出现"分享出去又变回全景" */
    u.searchParams.set('m', macroMode === 'solo' ? 'solo' : 'focus');
    var v = document.body.getAttribute('data-view');
    if (v) u.searchParams.set('v', v); else u.searchParams.delete('v');
    /* 保留诗卷深链 #poem-xxx：URL 状态同步不应把它清掉 */
    u.hash = /^#poem-[\w-]+$/.test(location.hash) ? location.hash : '';
    return u.toString();
  }
  function syncURL() {
    if (!urlReady) return;
    clearTimeout(urlTimer);
    urlTimer = setTimeout(function () {
      try { history.replaceState(null, '', buildURL()); } catch (e) { /* file:// 忽略 */ }
    }, 260);
  }
  ['change', 'input', 'click'].forEach(function (ev) {
    document.addEventListener(ev, syncURL, true);
  });

  /* 复制本视图链接 */
  var toastEl = document.createElement('div');
  toastEl.className = 'toast';
  toastEl.setAttribute('role', 'status');
  document.body.appendChild(toastEl);
  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('on');
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(function () { toastEl.classList.remove('on'); }, 2400);
  }
  function copyText(txt, done) {
    function fallback() {
      try {
        var ta = document.createElement('textarea');
        ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        var ok = document.execCommand('copy');
        document.body.removeChild(ta); return ok;
      } catch (e) { return false; }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(function () { done(true); },
        function () { done(fallback()); });
    } else { done(fallback()); }
  }
  document.getElementById('btnShareLink').onclick = function () {
    try { history.replaceState(null, '', buildURL()); } catch (e) {}
    /* v2.7：file:// 下复制的路径别人打不开——改为提示用线上地址，
       不再给一个"看起来能分享、实际打不开"的链接 */
    if (location.protocol === 'file:') {
      var live = 'https://zou-migration-webgis.app.workbuddy.host/' + buildURL().replace(/^[^?]*/, '');
      copyText(live, function (ok) {
        showToast(ok ? '已复制线上地址（本地 file:// 路径别人打不开）'
          : '当前在本地打开，分享请用：' + live);
      });
      return;
    }
    copyText(window.location.href, function (ok) {
      showToast(ok ? '已复制本视图链接（阶段、支系、图层与显示模式）'
        : '复制失败，请手动复制地址栏链接');
    });
  };

  /* 三窗按钮同步记录当前窗口，便于生成直达链接 */
  [['btnFocusMacro', 'macro'], ['btnFocusChain', 'chain'], ['btnFocusMicro', 'micro']]
    .forEach(function (pair) {
      var el = document.getElementById(pair[0]);
      if (el) el.addEventListener('click', function () {
        document.body.setAttribute('data-view', pair[1]);
      });
    });

  /* ---------- 载入时应用 URL 参数 ---------- */
  (function applyURLState() {
    var q;
    try { q = new URLSearchParams(window.location.search); } catch (e) { q = null; }
    if (!q) { urlReady = true; return; }
    var s = parseInt(q.get('s'), 10);
    if (s >= 1 && s <= 8) { range.value = s; showStage(s); }
    var h = parseInt(q.get('h'), 10);
    if (h >= 1 && h <= 8) {
      document.getElementById('heatRange').value = h;
      applyHeat();
    }
    var b = q.get('b');
    if (b && b.length === 4) {
      ['bkCao', 'bkZi', 'bkYao', 'bkSi'].forEach(function (id, i) {
        var el = document.getElementById(id);
        if (!el) return;
        el.checked = b.charAt(i) === '1';
        el.dispatchEvent(new Event('change'));
      });
    }
    var Ls = q.get('L');
    if (Ls && Ls.length >= 4) {
      ['chkChain', 'chkHist', 'chkJwhd', 'chkNotable', 'chkPersons', 'chkPoemPts']
        .forEach(function (id, i) {
          var el = document.getElementById(id);
          if (!el || i >= Ls.length) return;
          el.checked = Ls.charAt(i) === '1';
          if (el.onchange) el.onchange();
        });
    }
    var m = q.get('m');
    if (m === 'solo') { btnSoloEl.click(); }
    else if (m === 'focus') { btnAllEl.click(); }

    var v = q.get('v');
    if (v) {
      document.body.setAttribute('data-view', v);
      setTimeout(function () {
        var btn = { macro: 'btnFocusMacro', chain: 'btnFocusChain', micro: 'btnFocusMicro' }[v];
        if (btn) document.getElementById(btn).click();
      }, 600);
    }
    urlReady = true;
    syncURL();
  })();

  /* ============================================================
   * 键盘与屏幕阅读器支持
   * ============================================================ */
  (function () {
    /* 图例 / 迁徙链清单 / 名人卡：可聚焦 + 回车空格触发 */
    function keyable(el, role) {
      if (!el || el.getAttribute('data-keyable')) return;
      el.setAttribute('data-keyable', '1');
      el.setAttribute('tabindex', '0');
      el.setAttribute('role', role || 'button');
      el.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          el.click();
        }
      });
    }
    Array.prototype.forEach.call(legendEl.children, function (li) { keyable(li, 'checkbox'); });
    Array.prototype.forEach.call(document.querySelectorAll('#chainList li'), function (li) {
      keyable(li);
    });
    Array.prototype.forEach.call(document.querySelectorAll('.notable-card'), function (c) {
      keyable(c);
    });
    /* 图例状态同步 aria-checked */
    function syncLegendAria() {
      Array.prototype.forEach.call(legendEl.children, function (li) {
        li.setAttribute('aria-checked', li.classList.contains('off') ? 'false' : 'true');
      });
    }
    legendEl.addEventListener('click', function () { setTimeout(syncLegendAria, 0); });
    syncLegendAria();
    /* 时间轴：aria-valuetext 说明当前阶段 */
    function syncRangeAria() {
      var st = M.stages[+range.value - 1];
      if (st) range.setAttribute('aria-valuetext',
        '第' + st.id + '阶段 ' + st.name + '（' + st.era + '）');
    }
    range.addEventListener('change', syncRangeAria);
    range.addEventListener('input', syncRangeAria);
    syncRangeAria();
    /* Esc：关闭搜索结果与统计图灯箱 */
    document.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Escape') return;
      var res = document.getElementById('searchResults');
      if (res) res.hidden = true;
      var lb = document.querySelector('.lightbox');
      if (lb) lb.classList.remove('on');
    });
    /* Shift + ←/→：地图获得焦点后切换①号阶段（不干扰 Leaflet 默认的平移键） */
    [mapMacro, mapChain, mapMicro].forEach(function (m) {
      var el = m.getContainer();
      el.setAttribute('tabindex', '0');
      el.addEventListener('keydown', function (ev) {
        if (!ev.shiftKey) return;
        if (ev.key !== 'ArrowLeft' && ev.key !== 'ArrowRight') return;
        var cur = +range.value;
        var next = ev.key === 'ArrowRight' ? Math.min(8, cur + 1) : Math.max(1, cur - 1);
        if (next === cur) return;
        ev.preventDefault();
        ev.stopPropagation();
        stopPlay();
        showStage(next);
        syncRangeAria();
      }, true);
    });
  })();

  /* P1-6 ① 初始视野：贴合全国迁徙节点；用户已操作或深链已定位则不打扰 */
  (function () {
    var touched = false;
    var mark = function () { touched = true; };
    mapMacro.on('dragstart', mark);
    mapMacro.on('zoomstart', mark);
    setTimeout(function () {
      if (touched) return;
      if (mapMacro.getZoom() !== 5) return;   /* 深链 ?v=macro 已定位 */
      mapMacro.fitBounds(L.latLngBounds(
        M.nationalPlaces.features.filter(function (f) {
          return f.geometry.coordinates[1] >= 18;
        }).map(function (f) {
          var c = f.geometry.coordinates; return [c[1], c[0]];
        })).pad(0.05));
    }, 400);
  })();


  /* ---------------- 章节导航：折叠 / 进度 / 平滑滚动 ---------------- */
  (function () {
    var nav = document.getElementById('chapnav');
    if (!nav) return;
    var bar = document.getElementById('chapProgress');
    var toggle = document.getElementById('chapToggle');
    if (toggle) {
      toggle.addEventListener('click', function () {
        var open = nav.classList.toggle('open');
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
    }
    Array.prototype.forEach.call(nav.querySelectorAll('.links a'), function (a) {
      a.addEventListener('click', function () { nav.classList.remove('open'); });
    });
    var ticking = false;
    function upd() {
      var h = document.documentElement;
      var p = h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight);
      if (bar) bar.style.width = (p * 100).toFixed(2) + '%';
      ticking = false;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(upd); }
    }, { passive: true });
    upd();
  })();

  /* ---------------- Hero 数据条：进入视口 0→目标值（一次） ---------------- */
  (function () {
    var wrap = document.getElementById('heroStats');
    if (!wrap) return;
    var reduced = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var done = false;
    function run() {
      if (done) return;
      done = true;
      Array.prototype.forEach.call(wrap.querySelectorAll('b[data-to]'), function (el) {
        var to = +el.getAttribute('data-to');
        if (reduced) { el.textContent = to; return; }
        var t0 = performance.now(), dur = 1100;
        function step(t) {
          var k = Math.min(1, (t - t0) / dur);
          var e = 1 - Math.pow(1 - k, 3);
          el.textContent = Math.round(to * e);
          if (k < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
      });
    }
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (en) { if (en.isIntersecting) { run(); io.disconnect(); } });
      }, { threshold: .35 });
      io.observe(wrap);
    } else { run(); }

    var scroll = document.getElementById('heroScroll');
    if (scroll) {
      scroll.addEventListener('click', function () {
        var t = document.getElementById('secAtlas') || document.getElementById('migrationAtlas');
        if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  })();

  /* ---------------- v2.7 首屏入口：一主一次 + 工具浮层 ---------------- */
  (function () {
    function goTo(id) {
      var t = document.getElementById(id);
      if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    var btnStart = document.getElementById('btnStart');
    if (btnStart) {
      btnStart.addEventListener('click', function () {
        /* 主按钮＝真正开始：滚到 01 姓源的开头（.sec-head 与 #secOrigin 相邻） */
        var sec = document.getElementById('secOrigin');
        var head = sec && sec.previousElementSibling;
        (head && head.classList.contains('sec-head') ? head : sec || document.body)
          .scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
    /* 速览：只留 01 姓源 / 03 全国路线 / 05 双洲 */
    var btnQuick = document.getElementById('btnQuick');
    if (btnQuick) {
      btnQuick.addEventListener('click', function () {
        var on = document.body.classList.toggle('quick');
        btnQuick.setAttribute('aria-pressed', on ? 'true' : 'false');
        btnQuick.textContent = on ? '速览 · 开' : '速览';
        if (on) window.scrollTo({ top: 0, behavior: 'smooth' });
        setTimeout(function () { window.dispatchEvent(new Event('resize')); }, 120);
      });
    }

    var btnJump = document.getElementById('btnJumpMacro');
    if (btnJump) btnJump.addEventListener('click', function () { goTo('secMacroHead'); });

    var btnTools = document.getElementById('btnTools');
    var panel = document.getElementById('startPanel');
    if (btnTools && panel) {
      var setOpen = function (open) {
        if (open) panel.removeAttribute('hidden'); else panel.setAttribute('hidden', '');
        btnTools.setAttribute('aria-expanded', open ? 'true' : 'false');
        btnTools.textContent = open ? '收起搜索与三窗联动 ▴' : '搜索与三窗联动 ▾';
      };
      /* v2.7.1：浮层能开就得能关——补 Esc 与点外关闭，并在关闭时把焦点还给按钮 */
      var onDocDown = function (e) {
        if (panel.hasAttribute('hidden')) return;
        if (panel.contains(e.target) || btnTools.contains(e.target)) return;
        setOpen(false);
        cleanup();
      };
      var onKey = function (e) {
        if (e.key !== 'Escape' || panel.hasAttribute('hidden')) return;
        e.preventDefault();
        setOpen(false);
        cleanup();
        btnTools.focus({ preventScroll: true });
      };
      function cleanup() {
        document.removeEventListener('pointerdown', onDocDown, true);
        document.removeEventListener('keydown', onKey, true);
      }
      btnTools.addEventListener('click', function () {
        var open = panel.hasAttribute('hidden');
        setOpen(open);
        if (open) {
          var box = document.getElementById('searchBox');
          if (box) box.focus({ preventScroll: true });
          document.addEventListener('pointerdown', onDocDown, true);
          document.addEventListener('keydown', onKey, true);
        } else {
          cleanup();
        }
      });
    }
  })();

  /* 调试/测试句柄 */
  window._zou = { mapMacro: mapMacro, mapChain: mapChain, mapMicro: mapMicro,
    mapHeat: mapHeat, branchSel: branchSel, chainKeys2: chainKeys2, microKeys: microKeys };
})();
