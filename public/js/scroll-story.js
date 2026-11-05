/* ============================================================
 * js/scroll-story.js —— 滚动叙事层（v2.0）
 * 零依赖：自写单例 rAF + IntersectionObserver；不劫持滚轮。
 * 提供：ZouScroll.add(el, cb) 0–1 进度；HUD / 手卷进度轴 /
 *       动效开关 / 章节高亮 / 场景 03 钉住 + 年表尺 / 场景 04 横向路引。
 * 尊重 prefers-reduced-motion 与 body.is-reading（速览模式）。
 * ============================================================ */
(function () {
  'use strict';

  var REDUCE = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
  var items = [];
  var raf = null;

  /* 真实用户手势标记：首屏 / 深链恢复的位置不被滚动叙事覆盖 */
  var MOVED = false;
  ['wheel', 'touchstart', 'keydown', 'pointerdown'].forEach(function (ev) {
    window.addEventListener(ev, function () { MOVED = true; }, { passive: true });
  });
  window.__zouMoved = function () { return MOVED; };

  function reading() { return document.body.classList.contains('is-reading'); }
  function motionOff() { return reading() || (REDUCE && REDUCE.matches); }
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function $id(id) { return document.getElementById(id); }

  /* ---------- 核心：单例 rAF，进度只在变化时回调 ---------- */
  function measure(it) {
    var r = it.el.getBoundingClientRect();
    it.top = r.top + window.scrollY;
    it.height = it.el.offsetHeight;
    it.vh = window.innerHeight;
    it.range = Math.max(1, it.height - it.vh);
  }
  function run() {
    raf = null;
    if (motionOff()) return;
    var y = window.scrollY;
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (!it.active) continue;
      var p = clamp01((y - it.top) / it.range);
      if (Math.abs(p - it.last) < 0.001) continue;
      it.last = p;
      try { it.cb(p, it); } catch (e) { /* 单个场景异常不阻塞其它 */ }
    }
  }
  function schedule() { if (!raf) raf = requestAnimationFrame(run); }

  window.ZouScroll = {
    add: function (el, cb) {
      if (!el || typeof cb !== 'function') return null;
      var it = { el: el, cb: cb, last: -1, active: false };
      measure(it);
      items.push(it);
      if ('IntersectionObserver' in window) {
        var io = new IntersectionObserver(function (es) {
          es.forEach(function (en) { it.active = en.isIntersecting; });
          schedule();
        }, { rootMargin: '200px 0px 200px 0px' });
        io.observe(el);
        it.io = io;
      } else { it.active = true; }
      return it;
    },
    refresh: function () { items.forEach(measure); schedule(); },
    enabled: function () { return !motionOff(); }
  };

  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', function () {
    items.forEach(measure);
    schedule();
  }, { passive: true });
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { items.forEach(measure); schedule(); });
  }
  if (REDUCE && REDUCE.addEventListener) {
    REDUCE.addEventListener('change', function () { items.forEach(measure); schedule(); });
  }
  setTimeout(function () { items.forEach(measure); schedule(); }, 600);

  /* ---------- 动效开关（v3.6 修复：统一收敛 is-reading / no-veil / force-motion 三态） ---------- */
  (function () {
    var root = document.documentElement;
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    var q = new URLSearchParams(location.search);
    var saved = null;
    try { saved = localStorage.getItem('zou-motion'); } catch (e) {}
    /* 优先级：?motion=0 > ?motion=1 > localStorage > 系统减少动效 */
    var off = q.get('motion') === '0' ? true
            : (q.get('motion') === '1' ? false
            : (saved ? saved === 'off' : reduce));

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'motion-toggle';
    btn.id = 'motionToggle';
    var nav = document.querySelector('.chapnav .inner');
    if (nav) nav.appendChild(btn); else document.body.appendChild(btn);

    /* 关闭动效时若正停在某个卷轴段内部，把滚动位置落到该段之后的章节头，
       避免 reel-zone 高度骤失导致页面跳底 */
    var zoneLanding = {
      scrollReel: '#heroBoard', reelOrigin: '#secOriginHead',
      reelAtlas: '#secAtlasHead', reelMacro: '#secMacroHead',
      reelChain: '#secChainHead', reelMicro: '#secMicroHead',
      reelMethod: '#secAppendix'
    };
    function rescueScroll() {
      var sy = window.scrollY;
      var zones = document.querySelectorAll('.reel-zone');
      for (var i = 0; i < zones.length; i++) {
        var z = zones[i];
        var r = z.getBoundingClientRect();
        if (r.top <= 0 && r.bottom >= 0) {
          var sel = zoneLanding[z.id];
          var head = sel && document.querySelector(sel);
          if (head) window.scrollTo(0, head.getBoundingClientRect().top + window.scrollY - 76);
          return;
        }
      }
      void sy;
    }

    function applyMotion(on) {
      var offNow = !on;
      document.body.classList.toggle('is-reading', offNow);
      root.classList.toggle('no-veil', offNow);
      root.classList.toggle('force-motion', on && reduce);
      btn.textContent = offNow ? '动效：关' : '动效：开';
      btn.setAttribute('aria-pressed', String(!offNow));
      btn.title = offNow ? '当前为速览模式，点击恢复滚动动效' : '点击进入速览模式（关闭滚动动效）';
      try { localStorage.setItem('zou-motion', on ? 'on' : 'off'); } catch (e) {}
      document.dispatchEvent(new CustomEvent('zou:motion', { detail: { off: offNow } }));
      items.forEach(measure); schedule();
    }

    btn.addEventListener('click', function () {
      var turningOff = !reading();
      if (turningOff) rescueScroll();
      document.body.classList.toggle('is-reading');
      applyMotion(!reading());
    });

    applyMotion(!off);
  })();

  /* ---------- 章节高亮 + HUD + 手卷进度轴 ---------- */
  var CH = [
    { id: 'secOrigin', no: '01', name: '姓源', year: '—', place: '齐鲁 · 邾国' },
    { id: 'secAtlas', no: '02', name: '图谱', year: '八期', place: '全国' },
    { id: 'secMacro', no: '03', name: '全国路线', year: '100', place: '范阳' },
    { id: 'sceneChain', no: '04', name: '本支七站', year: '1507', place: '双洲' },
    { id: 'sceneMicro', no: '05', name: '双洲微观', year: '1507', place: '清江 · 双洲' },
    { id: 'secAppendix', no: '06', name: '方法与附录', year: '—', place: '—' }
  ];

  (function buildAxis() {
    var axis = document.createElement('nav');
    axis.className = 'story-axis';
    axis.setAttribute('aria-label', '章节进度轴');
    axis.innerHTML = CH.map(function (c, i) {
      return '<a href="#' + c.id + '" data-i="' + i + '" title="' + c.no + ' ' + c.name + '">'
        + '<i></i></a>';
    }).join('');
    document.body.appendChild(axis);

    var hud = document.createElement('div');
    hud.className = 'story-hud';
    hud.setAttribute('aria-live', 'polite');
    hud.innerHTML = '<span class="hud-ch">姓源</span>'
      + '<b class="hud-year">—</b><span class="hud-place">齐鲁 · 邾国</span>';
    document.body.appendChild(hud);
    var last = -1, lastAt = 0, lastYear = '';
    /* chapterOnly=true 时只切章节与地点，不覆盖场景给出的年份 */
    window.__zouHUD = function (i, year, place, chapterOnly) {
      var now = Date.now();
      var y = chapterOnly ? lastYear : (year || CH[i].year);
      if (i === last && y === lastYear && now - lastAt < 500) return;
      last = i; lastAt = now; lastYear = y;
      hud.querySelector('.hud-ch').textContent = CH[i].name;
      hud.querySelector('.hud-year').textContent = y;
      hud.querySelector('.hud-place').textContent = place || CH[i].place;
      Array.prototype.forEach.call(axis.children, function (a, k) {
        a.classList.toggle('on', k === i);
      });
    };
    window.__zouHUD(0);

    /* 页脚是满幅墨块：右侧手卷轴进去时收起来，避免压字 */
    var foot = document.getElementById('colophon');
    if (foot && 'IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        es.forEach(function (en) { document.body.classList.toggle('at-end', en.isIntersecting); });
      }, { threshold: .12 }).observe(foot);
    }
  })();

  (function navHighlight() {
    var links = {};
    Array.prototype.forEach.call(document.querySelectorAll('.chapnav .links a'), function (a) {
      /* v2.7.1：href 指向 .sec-head（章节标题），高亮仍按 data-ch 对应的章节 id 匹配 */
      var key = a.getAttribute('data-ch') || a.getAttribute('href').replace('#', '');
      links[key] = a;
    });
    var secs = CH.map(function (c) { return document.getElementById(c.id); }).filter(Boolean);
    if (!('IntersectionObserver' in window)) return;
    /* v3.6.6：改为「可见集合」驱动——印幕/卷轴/hero 区间内没有任何章节入带时,
       清空全部高亮,不再残留上一次的章节(修快速回滚到 hero 仍高亮 04 的问题) */
    var visible = {};
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (en) { visible[en.target.id] = en.isIntersecting; });
      var activeId = '';
      CH.forEach(function (c) { if (!activeId && visible[c.id]) activeId = c.id; });
      if (activeId) {
        Object.keys(links).forEach(function (k) { links[k].classList.toggle('on', k === activeId); });
        var idx = CH.findIndex(function (c) { return c.id === activeId; });
        if (idx >= 0 && window.__zouHUD) window.__zouHUD(idx, null, null, true);
      } else {
        Object.keys(links).forEach(function (k) { links[k].classList.remove('on'); });
      }
      var h = document.querySelector('.story-hud');
      if (h) h.classList.toggle('on', activeId === 'sceneMacro' || activeId === 'sceneChain');
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });
    secs.forEach(function (s) { io.observe(s); });
  })();

  /* ---------- Hero 推近（仅前 100vh） ---------- */
  (function heroZoom() {
    var hero = document.querySelector('.hero-band');
    var band = document.getElementById('heroMap');
    var title = document.querySelector('.hero-title');
    if (!hero || !band) return;
    window.addEventListener('scroll', function () {
      if (motionOff()) { band.style.transform = ''; return; }
      var p = clamp01(window.scrollY / (window.innerHeight || 800));
      if (p > 1) return;
      band.style.transform = 'scale(' + (1 + 0.15 * p) + ')';
      if (title) title.style.letterSpacing = (0.22 - 0.06 * p).toFixed(3) + 'em';
    }, { passive: true });
  })();
})();

/* ============================================================
 * 场景 03：全国路线 —— 钉住 + 年表尺（240vh）
 * 只在阶段变化时调用既有 showStage（经 #stageRange 的 input 事件复用）
 * ============================================================ */
(function sceneMacro() {
  var scene = document.getElementById('sceneMacro');
  if (!scene) return;
  var steps = Array.prototype.slice.call(scene.querySelectorAll('.macro-step'));
  var range = document.getElementById('stageRange');
  var yr = document.getElementById('yearRuler');
  var yrNow = document.getElementById('yrNow');
  var big = document.querySelector('#macroYear b');
  var lastStage = 0, syncUntil = 0;
  var t0 = Date.now(), initialY = window.scrollY;   /* 首屏/深链位置不被滚动覆盖 */

  /* 各阶段代表年（用于 HUD 与年表尺） */
  var YEAR = { 1: -500, 2: 100, 3: 400, 4: 800, 5: 1100, 6: 1450, 7: 1750, 8: 2000 };
  var PLACE = { 1: '邹城 · 商丘', 2: '范阳 · 涿州', 3: '江南 · 赣北', 4: '光州 · 宜黄',
                5: '宜黄 · 泰宁', 6: '湘鄂 · 麻城', 7: '川渝 · 台湾', 8: '赣鄂湘' };
  function fmtY(y) { return y < 0 ? '前' + Math.abs(y) : String(y); }

  function setStage(st, fromScroll) {
    st = Math.max(1, Math.min(8, st | 0));
    if (st === lastStage) return;
    lastStage = st;
    if (range && +range.value !== st) {
      range.value = st;
      range.dispatchEvent(new Event('input', { bubbles: true }));
      /* 滚动叙事需要'全路线 + 当前阶段高亮'，避免被切成独占只剩几条线 */
      var all = document.getElementById('btnAll');
      if (all && !all.classList.contains('on')) all.click();
    }
    steps.forEach(function (s) {
      s.classList.toggle('on', +s.getAttribute('data-stage') === st);
    });
    if (big) big.textContent = fmtY(YEAR[st]);
    if (yr && !fromScroll) yr.value = YEAR[st];
    if (yrNow) yrNow.textContent = '公元 ' + fmtY(YEAR[st]);
    if (window.__zouHUD) window.__zouHUD(2, fmtY(YEAR[st]), PLACE[st]);
  }

  ZouScroll.add(scene, function (p) {
    if (document.body.classList.contains('is-reading')) return;
    if (Date.now() < syncUntil) return;         /* 年表尺拖动后 400ms 内不反向覆盖 */
    if (!window.__zouMoved || !window.__zouMoved()) return;
    setStage(Math.floor(p * 8) + 1);
  });

  if (yr) {
    yr.addEventListener('input', function () {
      var y = +yr.value, st = 1;
      if (y >= 1912) st = 8; else if (y >= 1636) st = 7; else if (y >= 1271) st = 6;
      else if (y >= 960) st = 5; else if (y >= 581) st = 4; else if (y >= 220) st = 3;
      else if (y >= -221) st = 2;
      syncUntil = Date.now() + 400;
      setStage(st, true);
      var it = null;
      for (var i = 0; i < 1; i++) it = null;
      var top = scene.getBoundingClientRect().top + window.scrollY;
      var span = Math.max(1, scene.offsetHeight - window.innerHeight);
      window.scrollTo({ top: top + span * (st - 0.5) / 8, behavior: 'instant' });
    });
  }
  /* 初始化只同步 UI，不改写深链带来的阶段（?s=） */
  (function initFromRange() {
    var st = +(range && range.value) || 8;
    lastStage = st;
    steps.forEach(function (s) { s.classList.toggle('on', +s.getAttribute('data-stage') === st); });
    if (big) big.textContent = fmtY(YEAR[st]);
    if (yr) yr.value = YEAR[st];
    if (yrNow) yrNow.textContent = '公元 ' + fmtY(YEAR[st]);
  })();
})();

/* ============================================================
 * 场景 04：本支七站 —— 书脊折叠 + 盖章（260vh，v3.0/v3.1 重建版）
 * 就地折窄、折叠本身推进；宽度按 p 连续写进行内 flex-basis，
 * 轨道位移恒 0（窄屏才整架左移 over×f/6），p=1 时整架在框内。
 * ============================================================ */
(function sceneChain() {
  var scene = document.getElementById('sceneChain');
  if (!scene || !window.MIGR) return;
  var track = document.getElementById('chainTrack');
  var wrap = scene.querySelector('.chain-track-wrap');
  var map = window._zou && window._zou.mapChain;
  var box = document.getElementById('stampCount');
  var seal = document.getElementById('stampSeal');
  var reset = document.getElementById('stampReset');
  if (!track) return;

  var places = MIGR.chainPlaces.features;
  /* 中间纪年只有"某某之后/北宋年间"，此处统一加"约"并保留异说 */
  var YEAR_TEXT = { '莱州': '620', '涿州': '620', '潢川': '约 780',
    '宜黄': '约 800', '埮坪': '965', '湖边': '约 1080', '双洲': '1507' };
  var segs = MIGR.chain.features;
  function km(a, b) {
    var R = 6371, dLat = (b[1] - a[1]) * Math.PI / 180,
      dLng = (b[0] - a[0]) * Math.PI / 180;
    var s = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(a[1] * Math.PI / 180) * Math.cos(b[1] * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return Math.round(2 * R * Math.asin(Math.sqrt(s)));
  }

  var stamped = {};
  track.innerHTML = places.map(function (f, i) {
    var p = f.properties, c = f.geometry.coordinates;
    var ev = i > 0 && segs[i - 1] ? segs[i - 1].properties : null;
    var note = ev ? ev.event : '全哲公原籍莱州（东鲁），唐武德三年封范阳侯前的起点。';
    var d = i > 0 ? km(places[i - 1].geometry.coordinates, c) : null;
    return '<article class="track-card" data-i="' + i + '">'
      + '<span class="tc-no">站 ' + (i + 1) + ' / 7</span>'
      + '<h4>' + p.name + '</h4>'
      + '<span class="tc-year">' + (YEAR_TEXT[p.name] || p.year || '—') + ' 年</span>'
      + '<p class="tc-note">' + note + '</p>'
      + (d != null ? '<span class="tc-dist">距上一站约 ' + d + ' km（直线）</span>' : '<span class="tc-dist">起点 · 渤海之滨</span>')
      + '<button class="tc-stamp" type="button" aria-pressed="false" data-i="' + i + '">盖章</button>'
      + '</article>';
  }).join('');

  var cards = Array.prototype.slice.call(track.querySelectorAll('.track-card'));
  var lastIdx = -1;

  var reward = document.getElementById('stampReward');
  function setStampCount() {
    var n = Object.keys(stamped).length;
    if (box) box.textContent = n;
    if (seal) seal.classList.toggle('on', n === 7);
    /* v3.0：盖满七站时把轨道高度让出一段，奖励卡压在盖章条上不遮卡片 */
    wrap.classList.toggle('has-reward', n === 7);
    if (reward) {
      if (n === 7 && reward.hidden) {
        reward.hidden = false;
        requestAnimationFrame(function () { reward.classList.add('in'); });
      } else if (n !== 7 && !reward.hidden) {
        reward.hidden = true;
        reward.classList.remove('in');
      }
    }
  }
  track.addEventListener('click', function (e) {
    if (!e.target.closest) return;
    if (e.target.closest('.tc-stamp')) return;   /* 折起的卡里点章不算回站 */
    var sp = e.target.closest('.track-card.is-spine');
    if (!sp) return;
    goStation(+sp.getAttribute('data-i'));
  });
  track.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var c = e.target.closest ? e.target.closest('.track-card.is-spine') : null;
    if (!c) return;
    e.preventDefault(); e.stopPropagation();
    goStation(+c.getAttribute('data-i'));
  });
  /* 盖章（独立监听：折起的卡里点章不触发回站） */
  track.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('.tc-stamp') : null;
    if (!b) return;
    var i = b.getAttribute('data-i');
    if (stamped[i]) delete stamped[i]; else stamped[i] = 1;
    b.setAttribute('aria-pressed', stamped[i] ? 'true' : 'false');
    setStampCount();
  });
  /* 键盘：←/→ 逐站切换（原先只能拖拽或滚轮） */
  track.setAttribute('tabindex', '0');
  track.setAttribute('role', 'list');
  track.addEventListener('keydown', function (e) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    var n = cards.length;
    var next = lastIdx < 0 ? 0 : lastIdx + (e.key === 'ArrowRight' ? 1 : -1);
    next = Math.max(0, Math.min(n - 1, next));
    activate(next);
    var top = scene.getBoundingClientRect().top + window.scrollY;
    var span = Math.max(1, scene.offsetHeight - window.innerHeight);
    window.scrollTo({ top: top + span * (next / Math.max(1, n - 1)), behavior: 'smooth' });
  });
  if (reset) reset.addEventListener('click', function () {
    stamped = {};
    Array.prototype.forEach.call(track.querySelectorAll('.tc-stamp'), function (b) {
      b.setAttribute('aria-pressed', 'false');
    });
    setStampCount();
  });

  function activate(i) {
    if (i === lastIdx) return;
    lastIdx = i;
    cards.forEach(function (c, k) { c.classList.toggle('on', k === i); });
    if (map && places[i]) {
      var c = places[i].geometry.coordinates;
      map.flyTo([c[1], c[0]], 7.2, { duration: .8 });
    }
    if (window.__zouHUD) window.__zouHUD(3,
      (YEAR_TEXT[places[i].properties.name] || places[i].properties.year || '') + '',
      places[i].properties.name);
    var hint = document.getElementById('stampHint');
    if (hint) hint.textContent = '第 ' + (i + 1) + ' / 7 站 · ' + (i < 6 ? '继续右滑 →' : '已到末站');
  }

  /* ---------- v3.0 第 12 项：路引折成书脊 ----------
     走过的站就地折成 46px 朱砂书脊，后面的站顺势顶上来。
     宽度逐帧按 p 连续写成行内 flex-basis；轨道不位移，
     p=1 时六枚书脊 + 第七站必然整架在框内。
     宽度只在 pinned() 为真时写；≤900px / 速览 / 打印一律清掉。 */
  var FOLD_AT = 0.5;         /* 过了半站开始折 */
  var FOLD_SPAN = 0.3;       /* 再用 0.3 站折完（f∈[k+.5,k+.8]） */
  var SPINE_W = 46;          /* 与 CSS 的 .is-spine flex-basis 一致 */
  var N = cards.length;
  var lastP = -1;
  /* 与 .chain-track 的 padding / gap 对齐（改 CSS 时这里自动跟随） */
  var PAD = (function () {
    var v = parseFloat(getComputedStyle(track).paddingLeft);
    return isNaN(v) ? 18 : v;
  })();
  var GAP = (function () {
    var cs = getComputedStyle(track);
    var v = parseFloat(cs.columnGap || cs.gap);
    return isNaN(v) ? 14 : v;
  })();

  function pinned() {
    return !document.body.classList.contains('is-reading') &&
      window.innerWidth > 900 &&
      !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }
  /* 与 CSS clamp(230px,26vw,320px) 同式：不读被折叠后的宽度 */
  function cardW() { return Math.min(320, Math.max(230, window.innerWidth * 0.26)); }

  function setFold(i, on) {
    var c = cards[i];
    if (!c || c.classList.contains('is-spine') === on) return;
    c.classList.toggle('is-spine', on);
    if (on) {
      c.setAttribute('role', 'button');
      c.setAttribute('tabindex', '0');
      c.title = '第 ' + (i + 1) + ' 站 ' +
        (places[i] ? places[i].properties.name : '') + ' · 点击回到该站';
    } else {
      c.removeAttribute('role');
      c.removeAttribute('tabindex');
      c.removeAttribute('title');
    }
  }

  /* 七张卡取齐高度：书脊与摊开的卡同高才像同一排书 */
  function measureShelf() {
    wrap.style.removeProperty('--shelf-h');   /* 先归零，让卡片按内容撑高再量 */
    var h = 0;
    for (var i = 0; i < N; i++) {
      if (cards[i].classList.contains('is-spine')) continue;
      h = Math.max(h, cards[i].offsetHeight);
    }
    if (h) wrap.style.setProperty('--shelf-h', h + 'px');
  }
  function unfoldAll() {
    for (var i = 0; i < N; i++) {
      setFold(i, false);
      cards[i].style.flexBasis = '';
    }
    if (track.style.transform) track.style.transform = '';
  }
  function goStation(i) {
    var top = scene.getBoundingClientRect().top + window.scrollY;
    var span = Math.max(1, scene.offsetHeight - window.innerHeight);
    window.scrollTo({ top: top + span * (i / Math.max(1, N - 1)), behavior: 'smooth' });
  }

  function paint(p) {
    var f = p * (N - 1);
    var cw = cardW();
    for (var i = 0; i < N; i++) {
      var u = i < N - 1 ? Math.min(1, Math.max(0, (f - i - FOLD_AT) / FOLD_SPAN)) : 0;
      var w = cw + (SPINE_W - cw) * u;
      cards[i].style.flexBasis = w.toFixed(1) + 'px';
      setFold(i, u > 0.5);
    }
    /* 窄屏（≈1200 以下）整架比右栏宽：按进度把整架缓缓左移一点，
       到末站刚好把第七站收回框内（1400 下 over=0，完全不位移） */
    var endTotal = PAD * 2 + (N - 1) * SPINE_W + cw + GAP * (N - 1);
    var over = Math.max(0, endTotal - wrap.clientWidth);
    var shift = over * (f / Math.max(1, N - 1));
    track.style.transform = shift > 0.5 ? 'translate3d(' + (-shift).toFixed(1) + 'px,0,0)' : '';
    activate(Math.round(f));
  }

  ZouScroll.add(scene, function (p) {
    if (!pinned()) { unfoldAll(); return; }
    lastP = p;
    paint(p);
  });
  /* 尺寸/字体变化后 p 不变、回调不会再来，这里补一次重排 */
  window.addEventListener('resize', function () {
    if (lastP >= 0 && pinned()) paint(lastP);
  }, { passive: true });

  /* 退场：速览模式 / 缩到 901px 以下 / 打印，一律摊平还原 */
  document.addEventListener('zou:motion', function (e) {
    if (e.detail && e.detail.off) unfoldAll();
    else if (lastP >= 0) paint(lastP);
  });
  if (window.matchMedia) {
    var mqNm = window.matchMedia('(max-width:900px)');
    var onMq = function () {
      if (mqNm.matches) unfoldAll(); else if (lastP >= 0) paint(lastP);
    };
    if (mqNm.addEventListener) mqNm.addEventListener('change', onMq);
    else if (mqNm.addListener) mqNm.addListener(onMq);
  }
  window.addEventListener('beforeprint', unfoldAll);

  /* 键盘：←/→ 切站，Esc 跳到段末 */
  scene.addEventListener('keydown', function (e) {
    if (e.defaultPrevented) return;            /* 轨道内的 ←/→ 已处理，避免连跳两站 */
    if (document.body.classList.contains('is-reading')) return;
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Escape') return;
    var top = scene.getBoundingClientRect().top + window.scrollY;
    var span = Math.max(1, scene.offsetHeight - window.innerHeight);
    if (e.key === 'Escape') {
      window.scrollTo({ top: top + span + 8, behavior: 'smooth' }); e.preventDefault(); return;
    }
    var i = Math.max(0, Math.min(6, lastIdx + (e.key === 'ArrowRight' ? 1 : -1)));
    window.scrollTo({ top: top + span * (i + .5) / 7, behavior: 'smooth' });
    e.preventDefault();
  });
  scene.setAttribute('tabindex', '0');
  setStampCount();

  /* 卡高量测：首帧、字体就绪、尺寸变化各一次 */
  requestAnimationFrame(measureShelf);
  setTimeout(measureShelf, 400);
  window.addEventListener('resize', function () { setTimeout(measureShelf, 120); }, { passive: true });

  /* chainSizeFix：Pin 场景里地图容器高度依赖布局，进场景后补一次尺寸重算 */
  function chainSizeFix() {
    if (map) map.invalidateSize();
  }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) {
      es.forEach(function (en) {
        if (!en.isIntersecting) return;
        setTimeout(chainSizeFix, 80);
      });
    }, { threshold: .12 }).observe(scene);
  }
  window.addEventListener('load', function () { setTimeout(chainSizeFix, 80); });
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () {
      setTimeout(chainSizeFix, 60);
      setTimeout(measureShelf, 80);
    });
  }

  /* 进入横向场景时隐藏右侧进度轴，避免压住路引卡 */
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) {
      es.forEach(function (en) {
        document.body.classList.toggle('no-axis', en.isIntersecting);
      });
    }, { threshold: .35 }).observe(scene);
  }
})();

/* ============================================================
 * 场景 01：姓源三步卡 —— 滚动切换热区时期（200vh）
 * 说明：三卡同屏高亮（每卡不再独占 60vh），以适配全页 240vh 的场景节奏；
 *       切换仍走 #heatRange 的 input 事件，复用既有 applyHeat()。
 * ============================================================ */
(function sceneHeat() {
  var scene = document.getElementById('sceneHeat');
  if (!scene) return;
  var steps = Array.prototype.slice.call(scene.querySelectorAll('.heat-step'));
  var range = document.getElementById('heatRange');
  if (!range || !steps.length) return;
  var last = -1;
  function setPeriod(per) {
    if (per === last) return;
    last = per;
    if (+range.value !== per) {
      range.value = per;
      range.dispatchEvent(new Event('input', { bubbles: true }));
    }
    steps.forEach(function (s) {
      s.classList.toggle('on', +s.getAttribute('data-period') === per);
    });
  }
  steps.forEach(function (s) {
    s.addEventListener('click', function () { setPeriod(+s.getAttribute('data-period')); });
  });
  ZouScroll.add(scene, function (p) {
    if (document.body.classList.contains('is-reading')) return;
    if (!window.__zouMoved || !window.__zouMoved()) return;
    setPeriod(p < 0.34 ? 1 : (p < 0.67 ? 4 : 8));
  });
  /* 初始化只同步高亮，不改写深链带来的 heatRange */
  (function initHeat() {
    var cur = +range.value || 1;
    last = cur;
    steps.forEach(function (s) { s.classList.toggle('on', +s.getAttribute('data-period') === cur); });
  })();
})();

/* ============================================================
 * 06 字辈点灯：进入视口后逐格点亮（一次）
 * ============================================================ */
(function zibeiLight() {
  var bar = document.getElementById('zibeiBar');
  if (!bar) return;
  var cells = Array.prototype.slice.call(bar.querySelectorAll('.zb-cell'));
  cells.forEach(function (c, i) { c.style.setProperty('--zb-delay', (i * 0.06).toFixed(2) + 's'); });
  function light() { bar.classList.add('lit'); }
  if (!('IntersectionObserver' in window)) { light(); return; }
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (en) { if (en.isIntersecting) { light(); io.disconnect(); } });
  }, { threshold: .25 });
  io.observe(bar);
})();

/* 01 姓源：容器变高后 Leaflet 仍按旧尺寸绘制，首帧补一次 invalidateSize + 贴合国界 */
(function heatFrame() {
  var card = document.querySelector('#sceneHeat .card-heat .map');
  var map = window._zou && window._zou.mapHeat;
  if (!card || !map) return;
  var done = false;
  function fit() {
    if (done) return;
    if (!card.offsetHeight) return;
    done = true;
    map.invalidateSize();
    map.fitBounds([[18, 73], [54, 135]], { padding: [12, 12], animate: false });
  }
  requestAnimationFrame(fit);
  setTimeout(fit, 600);
  window.addEventListener('resize', function () {
    map.invalidateSize();
  }, { passive: true });
})();

/* ============================================================
 * 场景 05：双洲下潜 —— 纵向阶梯逐级放大 + 深度尺 + 光圈收束
 * 与 04（横向滑轨 + 盖章）刻意不同：不横移，只"越看越近"
 * ============================================================ */
(function sceneDive() {
  var scene = document.getElementById('sceneMicro');
  if (!scene) return;
  var map = window._zou && window._zou.mapMicro;
  var steps = Array.prototype.slice.call(scene.querySelectorAll('.dive-step'));
  var lens = document.getElementById('diveLens');
  var thumb = document.getElementById('diveThumb');
  var scaleEl = document.getElementById('diveScale');
  if (!steps.length) return;

  var STOPS = [
    { c: [115.450, 27.865], z: 11.6, s: '1 : 250 000', n: '袁河 · 清江' },
    { c: [115.4055, 27.9253], z: 14.2, s: '1 : 50 000', n: '双洲村' },
    { c: [115.4025, 27.9134], z: 15.4, s: '1 : 20 000', n: '邹游村' },
    { c: [115.3985, 27.9115], z: 16.4, s: '1 : 8 000', n: '游家洲 · 丁家古渡' },
    { c: [115.4049, 28.0056], z: 14.6, s: '1 : 30 000', n: '临江府城' }
  ];
  var last = -1, curP = 0;

  /* v2.7.1：拆成"只画 UI"与"画 UI + 飞地图"两步——
     首屏/深链未发生手势时只允许前者，别把 app.js 设好的 ③ 号图视野顶掉 */
  function paintUI(i) {
    var st = STOPS[i];
    steps.forEach(function (el, k) { el.classList.toggle('on', k === i); });
    if (scaleEl) scaleEl.textContent = st.s;
    if (window.__zouHUD) window.__zouHUD(4, '1507', st.n);
  }

  function go(i, noFly) {
    paintUI(i);
    if (noFly) return;
    if (i === last) return;
    last = i;
    /* STOPS 用 [lng, lat]；Leaflet 需要 [lat, lng] */
    if (map) map.flyTo([STOPS[i].c[1], STOPS[i].c[0]], STOPS[i].z, { duration: .95 });
  }

  ZouScroll.add(scene, function (p) {
    if (document.body.classList.contains('is-reading')) return;
    /* 未发生用户手势（含深链直接落在 05）不改图——原来这里是空 if，等于没拦住 */
    if (!window.__zouMoved || !window.__zouMoved()) return;
    curP = p;
    var i = Math.min(STOPS.length - 1, Math.max(0, Math.round(p * (STOPS.length - 1))));
    go(i);
    if (lens) lens.style.setProperty('--lens', (72 - 46 * p).toFixed(1) + '%');
    if (thumb) thumb.style.transform = 'translateY(' + (p * 100).toFixed(1) + '%)';
  });
  /* 初始化不 go(0)：第 0 站的飞行动作交给滚动叙事，初始视野由 app.js 决定 */

  /* 进场景补一次尺寸（与 04 同法） */
  if ('IntersectionObserver' in window) {
    var fixed = false;
    new IntersectionObserver(function (es) {
      es.forEach(function (en) {
        if (!en.isIntersecting || fixed) return;
        fixed = true;
        setTimeout(function () {
          if (map) map.invalidateSize();
          if (!window.__zouMoved || !window.__zouMoved()) return;  /* 无手势：保留 app.js 的初始视野 */
          last = -1;   /* 有手势进场：重放当前站点，纠正被 fitBounds 覆盖的视野 */
          go(Math.round(curP * (STOPS.length - 1)));
        }, 80);
      });
    }, { threshold: .1 }).observe(scene);
  }
  window.addEventListener('load', function () { setTimeout(function () { if (map) map.invalidateSize(); }, 120); });
})();
