/* ============================================================
 * js/migration-charts.js —— 邹氏迁徙图谱（4 幅 ECharts 模拟迁徙图）
 * 依赖：echarts 5.5、window.CHINA_PROV（省界 GeoJSON）、window.MIGR、window.MIG
 * 加载顺序：data.js → migration-data.js → 本文件
 *
 * 生命周期：IntersectionObserver 懒加载（进入视口才 init）；
 *           离开视口暂停 effect；页面隐藏统一停；resize 自适应；
 *           系统 prefers-reduced-motion 时关闭全部动效。
 * 数据口径：弧线为方向示意，非实际行走路径；热度为定性分级，非人口普查数值。
 * ============================================================ */
(function () {
  'use strict';
  if (!window.echarts || !window.MIGR || !window.MIG) return;
  if (!window.CHINA_PROV) return;

  var E = window.echarts;
  try { E.registerMap('zou-china', window.CHINA_PROV); } catch (e) { /* 已注册则忽略 */ }

  var REDUCE = !!(window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  var C = {
    land: '#0a1a2b', landHi: '#12324d', border: '#2b5b86',
    gold: '#ffd27a', amber: '#ffae42', cyan: '#5ad1ff', red: '#ff7b8a',
    text: '#dbe7f3', muted: '#7f97b3'
  };

  var TT = {
    backgroundColor: 'rgba(6,14,25,.94)',
    borderColor: 'rgba(255,210,122,.35)',
    borderWidth: 1,
    padding: [8, 12],
    textStyle: { color: C.text, fontSize: 12, lineHeight: 19 },
    extraCssText: 'box-shadow:0 8px 28px rgba(0,0,0,.55);border-radius:2px;'
  };
  function merge(a, b) {
    var o = {}, k;
    for (k in a) o[k] = a[k];
    for (k in b) o[k] = b[k];
    return o;
  }

  function box(id) { return document.getElementById(id); }
  function inst(id) {
    var el = box(id);
    if (!el) return null;
    var chart = E.getInstanceByDom(el) || E.init(el, null, {
      renderer: 'canvas',
      devicePixelRatio: Math.min(2, window.devicePixelRatio || 1)
    });
    return chart;
  }
  function geoBase(opt) {
    var base = {
      map: 'zou-china',
      roam: false,
      boundingCoords: [[73, 18], [135, 54]],
      zoom: 1,
      center: null,
      itemStyle: {
        areaColor: C.land,
        borderColor: C.border,
        borderWidth: .7,
        shadowColor: 'rgba(46,130,190,.55)',
        shadowBlur: 14
      },
      emphasis: {
        itemStyle: { areaColor: C.landHi },
        label: { show: true, color: '#eaf4ff', fontSize: 10 }
      },
      label: { show: false },
      select: { disabled: true }
    };
    for (var k in opt) base[k] = opt[k];
    return base;
  }
  /* 关键节点压角地名（scatter + label，避免地理名全部铺开） */
  function labels(list, color) {
    return {
      id: 'labels', type: 'scatter', coordinateSystem: 'geo', zlevel: 5,
      symbolSize: 3, silent: true,
      itemStyle: { color: color || C.gold },
      label: {
        show: true, position: 'right', distance: 4,
        formatter: '{b}', color: '#cfe3f7', fontSize: 10.5,
        textBorderColor: '#02060c', textBorderWidth: 2.5
      },
      data: list
    };
  }
  function ripple(list, color, size, hideLabel) {
    return {
      type: 'effectScatter', coordinateSystem: 'geo', zlevel: 4,
      rippleEffect: REDUCE
        ? { show: false }
        : { brushType: 'stroke', scale: 3.4, period: 4.2, number: 2 },
      symbolSize: size || 6,
      itemStyle: { color: color, shadowBlur: 12, shadowColor: color, opacity: .95 },
      label: {
        show: !hideLabel, position: 'right', distance: 5, formatter: '{b}',
        color: '#ffe9c4', fontSize: 11, fontWeight: 600,
        textBorderColor: '#02060c', textBorderWidth: 3
      },
      data: list
    };
  }
  function lineData(features, opt) {
    opt = opt || {};
    return features.map(function (f) {
      var p = f.properties;
      return {
        name: p.from + ' → ' + p.to,
        coords: f.geometry.coordinates,
        from: p.from, to: p.to, year: p.year,
        stage: p.stage, event: p.event, note: p.note,
        lineStyle: {
          color: opt.color || MIG.HUE[p.stage] || C.gold,
          width: opt.width || 1,
          opacity: opt.opacity == null ? .55 : opt.opacity,
          curveness: opt.curveness == null ? .25 : opt.curveness
        }
      };
    });
  }
  /* 省份点击 → ①号 Leaflet 图定位（事件解耦，不访问 app.js 内部变量） */
  function bindGeoFocus(chart) {
    chart.on('click', function (p) {
      if (p.componentType !== 'geo') return;
      var f = window.CHINA_PROV.features.filter(function (x) {
        return x.properties.name === p.name;
      })[0];
      if (!f || !f.properties.cx) return;
      window.dispatchEvent(new CustomEvent('zou:focus', {
        detail: { lng: f.properties.cx, lat: f.properties.cy, zoom: 6 }
      }));
    });
  }

  /* ================= Ⅰ 千年长卷：八阶段飞线 ================= */
  function buildA(chart) {
    /* 海外段（如闽粤沿海→南洋，终点在新加坡/吉隆坡）在 18°N 裁切外，
       此处剔除，避免线穿出图框；海外播迁见Ⅱ图与页底声明 */
    var feats = MIGR.nationalRoutes.features.filter(function (f) {
      return !f.geometry.coordinates.some(function (c) { return c[1] < 18; });
    });
    var stage = 0;
    var keyNodes = ['邹城', '涿州', '南阳', '宜黄', '泰宁', '成都', '樟树·双洲'];
    var nodes = MIGR.nationalPlaces.features.filter(function (f) {
      return keyNodes.indexOf(f.properties.name) >= 0;
    }).map(function (f) {
      return { name: f.properties.name,
               value: f.geometry.coordinates.concat([f.properties.stage]) };
    });

    function fxData() {
      return lineData(stage ? feats.filter(function (f) {
        return f.properties.stage === stage;
      }) : feats, { width: 1.05, opacity: .6, curveness: .28 });
    }

    chart.setOption({
      backgroundColor: 'transparent',
      tooltip: merge({
        trigger: 'item', confine: true,
        formatter: function (p) {
          var d = p.data || {};
          if (!d.from) return p.name;
          return '<b style="color:#ffd27a">' + d.from + ' → ' + d.to + '</b><br>'
            + '第 ' + d.stage + ' 阶段 · ' + (d.year == null ? '年代无考' : d.year + ' 年') + '<br>'
            + (d.event || '')
            + (d.note ? '<br><span style="color:#7f97b3">' + d.note + '</span>' : '');
        }
      }, TT),
      geo: geoBase(),
      series: [
        { id: 'baseA', type: 'lines', coordinateSystem: 'geo', zlevel: 1,
          silent: true, effect: { show: false },
          lineStyle: { opacity: .16, width: .8, curveness: .28 },
          data: lineData(feats, { width: .8, opacity: .16, curveness: .28 }) },
        { id: 'fxA', type: 'lines', coordinateSystem: 'geo', zlevel: 2,
          effect: { show: !REDUCE, period: 4.4, trailLength: .55,
                    symbol: 'arrow', symbolSize: 6.5, color: '#ffe6b8' },
          lineStyle: { width: 1, opacity: .55, curveness: .28 },
          data: fxData() },
        ripple(nodes, C.gold, 6, true),
        { id: 'labelsA', type: 'scatter', coordinateSystem: 'geo', zlevel: 6,
          symbolSize: 3, silent: true, itemStyle: { color: C.gold },
          labelLayout: { hideOverlap: true, moveOverlap: 'shiftY' },
          label: {
            show: true, formatter: '{b}', color: '#ffe9c4', fontSize: 11,
            fontWeight: 600, textBorderColor: '#02060c', textBorderWidth: 3
          },
          data: nodes.filter(function (n) {
            return ['邹城', '宜黄', '樟树·双洲'].indexOf(n.name) >= 0;
          }).map(function (n) {
            var POS = { '邹城': ['right', 8], '宜黄': ['bottom', 9], '樟树·双洲': ['top', 9] };
            var cfg = POS[n.name] || ['right', 7];
            return { name: n.name, value: n.value,
                     label: { position: cfg[0], distance: cfg[1] } };
          }) },
        /* 其余节点：hover 才显示地名 */
        { id: 'labelsHoverA', type: 'scatter', coordinateSystem: 'geo', zlevel: 5,
          symbolSize: 6, itemStyle: { color: 'transparent' },
          label: { show: false },
          emphasis: { label: { show: true, formatter: '{b}', color: '#ffe9c4',
            fontSize: 11, fontWeight: 600, position: 'right', distance: 6,
            textBorderColor: '#02060c', textBorderWidth: 3 } },
          data: nodes }
      ]
    }, true);
    bindGeoFocus(chart);

    /* 阶段芯片 */
    var chipsA = box('migChipsA');
    var names = ['先秦', '秦汉', '魏晋', '隋唐', '两宋', '元明', '清代', '近现代'];
    if (chipsA) {
      chipsA.innerHTML = '<button class="mig-chip is-on" data-s="0" aria-pressed="true">全部</button>'
        + names.map(function (n, i) {
          return '<button class="mig-chip" data-s="' + (i + 1) + '" aria-pressed="false">'
            + '<i class="mig-chip-dot" style="background:' + MIG.HUE[i + 1] + '"></i>'
            + n + '</button>';
        }).join('');
      chipsA.addEventListener('click', function (e) {
        var b = e.target.closest ? e.target.closest('.mig-chip') : null;
        if (!b) return;
        stage = +b.getAttribute('data-s');
        Array.prototype.forEach.call(chipsA.querySelectorAll('.mig-chip'), function (x) {
          var on = x === b;
          x.classList.toggle('is-on', on);
          x.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
        chart.setOption({ series: [{ id: 'fxA', data: fxData() }] });
      });
    }
    var subA = box('migSubA');
    if (subA) subA.textContent = feats.length + ' 段境内路线 · 按阶段点亮 · 箭头指向迁入地';

    /* S3.6 八阶段播放 */
    var playA = box('migPlayA');
    if (playA) {
      var timer = null, i = 1;
      playA.addEventListener('click', function () {
        if (timer) {   /* 停止：清除并回到"全部" */
          clearInterval(timer); timer = null;
          playA.textContent = '▶'; playA.classList.remove('is-on');
          var all = chipsA && chipsA.querySelector('.mig-chip[data-s="0"]');
          if (all) all.click();
          return;
        }
        playA.textContent = '⏸'; playA.classList.add('is-on');
        i = 1;
        var tick = function () {
          var chip = chipsA && chipsA.querySelector('.mig-chip[data-s="' + i + '"]');
          if (chip) chip.click();
          i = i % 8 + 1;
        };
        tick();
        timer = setInterval(tick, 1400);
      });
    }
  }

  /* ================= Ⅱ 万流归宗：汇聚到双洲 ================= */
  function buildB(chart) {
    var list = MIG.convergence;
    var data = list.map(function (r, i) {
      return {
        name: r.from + ' → 双洲',
        from: r.from, to: '清江·双洲', year: r.year, stage: r.stage,
        coords: [r.fromCoord, MIG.DEST],
        lineStyle: {
          color: r.group === 'branch' ? C.gold
               : (r.group === 'overseas' ? C.amber : C.cyan),
          width: r.group === 'branch' ? 1.4 : .9,
          opacity: .5, curveness: .3 + (i % 3) * .07
        }
      };
    });

    chart.setOption({
      backgroundColor: 'transparent',
      tooltip: merge({
        trigger: 'item', confine: true,
        formatter: function (p) {
          var d = p.data || {};
          if (!d.from) return p.name;
          return '<b style="color:#ffd27a">' + d.from + ' → 双洲</b><br>'
            + '第 ' + d.stage + ' 阶段 · ' + (d.year == null ? '年代无考' : d.year + ' 年')
            + '<br><span style="color:#7f97b3">汇聚线为方向示意，非同时同批迁入</span>';
        }
      }, TT),
      geo: geoBase(),
      series: [
        { id: 'baseB', type: 'lines', coordinateSystem: 'geo', zlevel: 1,
          silent: true, effect: { show: false },
          lineStyle: { opacity: .12, width: .7, curveness: .32 }, data: data },
        { id: 'fxB', type: 'lines', coordinateSystem: 'geo', zlevel: 2,
          effect: { show: !REDUCE, period: 4.8, trailLength: .62,
                    symbol: 'arrow', symbolSize: 6, color: '#ffd27a' },
          lineStyle: { width: 1, opacity: .5, curveness: .32 }, data: data },
        ripple([{ name: '清江·双洲', value: MIG.DEST.concat([1]) }], C.gold, 9, true),
        labels([{ name: '双洲', value: MIG.DEST.concat([1]) }], C.gold)
      ]
    }, true);
    bindGeoFocus(chart);

    var subB = box('migSubB');
    if (subB) subB.textContent = list.length + ' 处记载起点 → 清江双洲 · 金色为本支';
  }

  /* ================= Ⅲ 省域热度：八期演变 ================= */
  function buildC(chart) {
    var heat = MIGR.heatData;

    function mapData(pid) {
      return (heat[pid] || []).map(function (d) {
        return {
          name: d.p, value: d.v, note: d.note,
          label: d.v >= 2
            ? { show: true, color: '#1b1206', fontSize: 10, fontWeight: 700 }
            : { show: false }
        };
      });
    }
    function render(pid) {
      chart.setOption({
        backgroundColor: 'transparent',
        tooltip: merge({
          trigger: 'item', confine: true,
          formatter: function (p) {
            if (p.value == null || isNaN(p.value)) {
              return p.name + '<br><span style="color:#7f97b3">暂无记载</span>';
            }
            var lv = ['', '初步分布', '聚居发展', '核心聚集'][p.value] || '';
            return '<b style="color:#ffd27a">' + p.name + '</b> · ' + lv
              + '<br>' + ((p.data && p.data.note) || '');
          }
        }, TT),
        visualMap: {
          type: 'piecewise', show: false, left: 12, bottom: 12,
          itemWidth: 12, itemHeight: 10, itemGap: 8,
          textStyle: { color: C.muted, fontSize: 10.5 },
          pieces: [
            { min: 3, max: 3, label: '核心聚集', color: '#ffd27a' },
            { min: 2, max: 2, label: '聚居发展', color: '#c9823c' },
            { min: 1, max: 1, label: '初步分布', color: '#2f6f9e' }
          ],
          outOfRange: { color: '#0d1b2b' }
        },
        series: [{
          id: 'heat', type: 'map', map: 'zou-china', roam: false,
          boundingCoords: [[73, 18], [135, 54]],
          zoom: 1, center: null,
          itemStyle: { areaColor: '#0d1b2b', borderColor: C.border, borderWidth: .7 },
          emphasis: {
            itemStyle: { areaColor: '#1b3d59' },
            label: { show: true, color: '#fff', fontSize: 10 }
          },
          select: { disabled: true },
          data: mapData(pid)
        }]
      }, true);
    }
    render(1);

    var legendC = box('migLegendC');
    if (legendC) {
      [['#ffd27a', '核心聚集'], ['#c9823c', '聚居发展'],
       ['#2f6f9e', '初步分布'], ['#0d1b2b', '暂无记载']].forEach(function (p) {
        legendC.insertAdjacentHTML('beforeend',
          '<span class="mig-lg"><i style="background:' + p[0] + '"></i>' + p[1] + '</span>');
      });
    }

    var chipsC = box('migChipsC');
    var names = ['先秦', '秦汉', '魏晋', '隋唐', '宋元', '明', '清', '当代'];
    if (chipsC) {
      chipsC.innerHTML = names.map(function (n, i) {
        return '<button class="mig-chip' + (i === 0 ? ' is-on' : '')
          + '" data-p="' + (i + 1) + '" aria-pressed="' + (i === 0 ? 'true' : 'false') + '">'
          + n + '</button>';
      }).join('');
      chipsC.addEventListener('click', function (e) {
        var b = e.target.closest ? e.target.closest('.mig-chip') : null;
        if (!b) return;
        Array.prototype.forEach.call(chipsC.querySelectorAll('.mig-chip'), function (x) {
          var on = x === b;
          x.classList.toggle('is-on', on);
          x.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
        render(+b.getAttribute('data-p'));
      });
    }
  }

  /* ================= Ⅳ 一村千年：赣中链条 ================= */
  function buildD(chart) {
    var chain = MIGR.chain.features.filter(function (f) {
      return f.properties.year >= 900;   /* 只留宜黄→埮坪→湖边→双洲，避免光州出画 */
    });
    var stops = [];
    chain.forEach(function (f) {
      stops.push({ name: f.properties.from.replace(/^[①-⑦]\s*/, ''),
        value: f.geometry.coordinates[0].concat([f.properties.year]) });
    });
    var last = chain[chain.length - 1];
    if (last) {
      stops.push({ name: '双洲',
        value: last.geometry.coordinates.slice(-1)[0].concat([1507]) });
    }
    var road = MIGR.villageRoutes.features[1].geometry.coordinates;
    var extra = [
      { name: '临江府城', value: [115.404888, 28.005563] },
      { name: '游家洲', value: [115.402094, 27.914986] }
    ];

    chart.setOption({
      backgroundColor: 'transparent',
      tooltip: merge({
        trigger: 'item', confine: true,
        formatter: function (p) {
          var d = p.data || {};
          if (d.event) {
            return '<b style="color:#ffd27a">' + d.from + ' → ' + d.to + '</b><br>'
              + (d.year + ' 年') + '<br>' + d.event;
          }
          return '<b>' + p.name + '</b>';
        }
      }, TT),
      geo: geoBase({
        boundingCoords: [[115.25, 27.40], [116.50, 28.08]],
        zoom: 1, center: null,
        itemStyle: { areaColor: '#081827', borderColor: '#24506f', borderWidth: .8 }
      }),
      series: [
        { id: 'riverD', type: 'lines', coordinateSystem: 'geo', zlevel: 1,
          silent: true,
          lineStyle: { color: '#2f7fa8', width: 2.2, opacity: .55,
            curveness: .12, type: 'dashed' },
          data: [{ coords: road }] },
        { id: 'baseD', type: 'lines', coordinateSystem: 'geo', zlevel: 2,
          silent: true, effect: { show: false },
          lineStyle: { color: C.gold, width: 1.2, opacity: .22, curveness: .18 },
          data: lineData(chain, { color: C.gold, opacity: .22, curveness: .18 }) },
        { id: 'fxD', type: 'lines', coordinateSystem: 'geo', zlevel: 3,
          effect: { show: !REDUCE, period: 3.6, trailLength: .7,
                    symbol: 'arrow', symbolSize: 8, color: '#ffe6b8' },
          lineStyle: { color: C.gold, width: 1.6, opacity: .65, curveness: .18 },
          data: lineData(chain, { color: C.gold, opacity: .65, curveness: .18 }) },
        ripple(stops, C.gold, 7, true),
        /* 站点地名：逐个指定方位，避免"湖边/双洲"近距重叠 */
        { id: 'labelsD', type: 'scatter', coordinateSystem: 'geo', zlevel: 6,
          symbolSize: 3, silent: true, itemStyle: { color: C.gold },
          label: {
            show: true, formatter: '{b}', color: '#ffe9c4', fontSize: 11,
            fontWeight: 600, textBorderColor: '#02060c', textBorderWidth: 3
          },
          data: stops.map(function (s, i) {
            var POSD = { '宜黄': ['right', 8], '埮坪': ['top', 6],
                         '湖边': ['bottom', 9], '双洲': ['left', 10] };
            var cfg = POSD[s.name] || ['right', 7];
            return { name: s.name, value: s.value,
                     label: { position: cfg[0], distance: cfg[1] } };
          }) },
        /* 村落/府城参照点：方位错开 */
        { id: 'labelsE', type: 'scatter', coordinateSystem: 'geo', zlevel: 6,
          symbolSize: 3, silent: true, itemStyle: { color: '#cfe3f7' },
          labelLayout: { hideOverlap: true, moveOverlap: 'shiftY' },
          label: {
            show: true, formatter: '{b}', color: '#cfe3f7', fontSize: 10.5,
            textBorderColor: '#02060c', textBorderWidth: 2.5
          },
          data: [
            { name: '临江府城', value: [115.404888, 28.005563],
              label: { position: 'top', distance: 16 } },
            { name: '游家洲', value: [115.402094, 27.914986],
              label: { show: false } }
          ] }
      ]
    }, true);
  }

  /* ================= 生命周期：懒加载 / 暂停 / 自适应 ================= */
  var built = {};
  var builders = { mapA: buildA, mapB: buildB, mapC: buildC, mapD: buildD };

  function ensure(id) {
    if (built[id]) return built[id];
    var el = box(id);
    if (!el) return null;
    /* v3.1：折叠中（如 Ⅱ/Ⅲ 收在 #migMore 里）容器是 0×0。
       0 面积目标也会被判为 intersecting，此时 init 会得到 0×0 画布，
       ECharts 每帧 drawImage 0×0 → 控制台刷屏。等展开（有尺寸）再建。 */
    if (el.offsetWidth < 20 || el.offsetHeight < 20) return null;
    var c = E.getInstanceByDom(el) || E.init(el, null, {
      renderer: 'canvas',
      devicePixelRatio: Math.min(2, window.devicePixelRatio || 1)
    });
    built[id] = c;
    builders[id](c);
    return c;
  }

  /* 只切 effect.show，不动数据 —— 离开视口即省 CPU */
  function setEffect(c, on) {
    if (!c || c.isDisposed()) return;
    var opt = c.getOption();
    var patches = [];
    (opt.series || []).forEach(function (s) {
      if (s.effect) patches.push({ id: s.id, effect: { show: !!on && !REDUCE } });
    });
    if (patches.length) c.setOption({ series: patches });
  }

  var io = ('IntersectionObserver' in window) ? new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      var id = en.target.id;
      var c = built[id];
      if (en.isIntersecting) {
        if (!c) ensure(id);
        else setEffect(c, true);
      } else if (c) {
        setEffect(c, false);
      }
    });
  }, { rootMargin: '240px 0px' }) : null;

  ['mapA', 'mapB', 'mapC', 'mapD'].forEach(function (id) {
    var el = box(id);
    if (!el) return;
    if (io) io.observe(el); else ensure(id);
  });

  document.addEventListener('visibilitychange', function () {
    Object.keys(built).forEach(function (id) {
      var c = built[id], el = box(id);
      if (!c || !el) return;
      if (document.hidden) { setEffect(c, false); return; }
      var r = el.getBoundingClientRect();
      if (r.bottom > 0 && r.top < window.innerHeight) setEffect(c, true);
    });
  });

  var t;
  window.addEventListener('resize', function () {
    clearTimeout(t);
    t = setTimeout(function () {
      Object.keys(built).forEach(function (id) {
        var c = built[id];
        if (c && !c.isDisposed()) c.resize();
      });
    }, 160);
  });

  /* P0-4：空闲预热（不阻塞首屏，保证打印/整页截图/快速跳转时已有内容） */
  function warmAll() {
    ['mapA', 'mapB', 'mapC', 'mapD'].forEach(ensure);
    Object.keys(built).forEach(function (id) {
      if (built[id] && !built[id].isDisposed()) built[id].resize();
    });
  }
  if ('requestIdleCallback' in window) {
    requestIdleCallback(warmAll, { timeout: 2500 });
  } else {
    setTimeout(warmAll, 1800);
  }

  /* P0-3：打印前确保四图已初始化并重绘（与上面的 CSS 440px 配合） */
  window.addEventListener('beforeprint', function () {
    warmAll();
  });

  /* v2.7：Ⅱ/Ⅲ 收进 <details>，折叠时容器尺寸为 0，展开后必须重算尺寸——
     否则图会停在 0×0 呈现空白 */
  var moreBox = document.getElementById('migMore');
  if (moreBox) {
    moreBox.addEventListener('toggle', function () {
      if (!moreBox.open) return;
      ['mapB', 'mapC'].forEach(function (id) {
        var el = box(id);
        if (!el) return;
        if (!built[id]) { ensure(id); return; }
        if (built[id] && !built[id].isDisposed()) built[id].resize();
      });
      /* 展开动画结束后再校一次，避免横向轨道/字体回流造成差几像素 */
      setTimeout(function () {
        ['mapB', 'mapC'].forEach(function (id) {
          var c = built[id];
          if (c && !c.isDisposed()) c.resize();
        });
      }, 220);
    });
  }

  /* 供 tests/test_migration.js 断言（函数形式，避免脚本先于图表执行） */
  window.__MIG_READY__ = function () {
    return { routes: MIG.stats.routes, starts: MIG.stats.starts,
             provinces: MIG.stats.provinces, charts: Object.keys(built).length };
  };
})();
