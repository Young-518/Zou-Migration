/* ============================================================
 * js/typo-motion.js —— v3.4 文字动效层
 * 三件事:标题逐字上浮 / 并列文字依次渐现 / 统计句数字滚动。
 * 规则(与 motion.js 同源):
 *   - 只动 transform / opacity / clip-path;
 *   - 隐藏态一律由 JS 挂类才出现,无脚本时一切可见;
 *   - reduced-motion / ?motion=0 / body.is-reading 直接跳过;
 *   - beforeprint 全部置终态,打印分页(11 页)不受影响。
 * ============================================================ */
(function () {
  'use strict';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
  if (reduce && reduce.matches) return;
  if (/[?&]motion=0/.test(location.search)) return;

  /* ---------- 工具 ---------- */
  function onSee(el, opts, cb) {
    if (!('IntersectionObserver' in window)) { cb(); return; }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (en) {
        if (!en.isIntersecting) return;
        requestAnimationFrame(cb);
        io.disconnect();
      });
    }, opts || { threshold: .25 });
    io.observe(el);
  }

  /* 逐字拆分:只拆纯文本、不超过 12 字的标题(中文逐字才有节奏,长句拆了拖沓) */
  function splitChars(el) {
    if (!el || el.dataset.tmSplit) return false;
    if (el.children.length) return false;
    var text = el.textContent;
    if (!text || text.length > 12) return false;
    el.setAttribute('aria-label', text);            /* 读屏读整句 */
    el.textContent = '';
    var frag = document.createDocumentFragment();
    for (var i = 0; i < text.length; i++) {
      var s = document.createElement('span');
      s.className = 'tm-ch';
      s.setAttribute('aria-hidden', 'true');
      s.textContent = text.charAt(i);
      s.style.transitionDelay = (i * 55) + 'ms';
      frag.appendChild(s);
    }
    el.appendChild(frag);
    el.dataset.tmSplit = '1';
    return true;
  }

  /* ---------- 1) 标题逐字上浮 ---------- */
  (function titles() {
    var h1 = document.querySelector('.hb-title');
    if (h1 && splitChars(h1)) {
      h1.classList.add('tm-split');
      setTimeout(function () { h1.classList.add('tm-in'); }, 160);  /* 与首屏开镜同步 */
    }
    Array.prototype.forEach.call(
      document.querySelectorAll('.sec-head h2, .pl-head h2, .text-band > .wrap > h2, .scroll-head h2'),
      function (h) {
        if (h.closest('.scene')) return;            /* 钉住场景不参与 */
        if (!splitChars(h)) return;
        h.classList.add('tm-split');
        onSee(h, { threshold: .6 }, function () { h.classList.add('tm-in'); });
      });
  })();

  /* hero 副题:右缘擦除一次(与名号错峰) */
  (function stand() {
    var st = document.querySelector('.hb-stand');
    if (!st) return;
    st.classList.add('tm-wipe');
    setTimeout(function () { st.classList.add('tm-in'); }, 520);
  })();

  /* ---------- 2) 并列文字依次渐现 ---------- */
  /* ---------- 印幕跳过与回访记忆(v3.6 修复 P0-2/P2-8) ---------- */
  (function () {
    var veil = document.getElementById('veil');
    if (!veil) return;
    function kill(remember) {
      if (veil.parentNode) veil.parentNode.removeChild(veil);
      try { if (remember) sessionStorage.setItem('zou-veil-seen', '1'); } catch (e) {}
    }
    var skip = document.getElementById('veilSkip');
    if (skip) skip.addEventListener('click', function () { kill(true); });
    veil.addEventListener('animationend', function (e) {
      if (e.animationName === 'veilOut') kill(true);   /* 自动揭幕也算已看过 */
    });
    window.addEventListener('keydown', function (e) {
      if ((e.key === 'Escape' || e.key === ' ') && document.getElementById('veil')) kill(true);
    });
    setTimeout(function () { kill(true); }, 3200);       /* CSS 动画兜底 */
    try { if (sessionStorage.getItem('zou-veil-seen') === '1') kill(false); } catch (e) {}
  })();

  var STAG = '.il-cols, .bf-list, .mig-teaser, .pl-sheet, .hb-dark, .hb-accent, .fb-meta, .mf-core';
  Array.prototype.forEach.call(document.querySelectorAll(STAG), function (box) {
    if (box.closest('.scene')) return;
    var kids = box.children;
    if (!kids.length || kids.length > 14) return;
    box.classList.add('tm-stagger');
    Array.prototype.forEach.call(kids, function (k, i) {
      k.style.transitionDelay = Math.min(i * 70, 560) + 'ms';
    });
    if (box.closest('details')) {
      /* 折叠区关闭时没有盒子,IO 量不到 —— 展开即进场(同 motion.js 防线) */
      document.addEventListener('toggle', function (e) {
        if (e.target.contains && e.target.contains(box)) box.classList.add('tm-in');
      }, true);
    }
    onSee(box, { threshold: .15 }, function () { box.classList.add('tm-in'); });
  });

  /* ---------- 3) 统计句数字滚动(只用页面上已有的真数字) ---------- */
  var statFinish = function () {};
  (function statCount() {
    var line = document.querySelector('.stat-line');
    if (!line) return;
    var nums = [].filter.call(line.querySelectorAll('b'), function (b) {
      return /^\d+$/.test(b.textContent.trim());
    });
    if (!nums.length) return;
    var original = nums.map(function (b) { return b.textContent.trim(); });
    statFinish = function () {
      nums.forEach(function (b, i) { b.textContent = original[i]; });
    };
    var played = false;
    onSee(line, { threshold: .5 }, function () {
      if (played) return;
      played = true;
      nums.forEach(function (b, i) {
        var to = +original[i], t0 = performance.now(), dur = 950;
        (function step(t) {
          var k = Math.min(1, (t - t0) / dur);
          var e = 1 - Math.pow(1 - k, 3);
          b.textContent = String(Math.round(to * e));
          if (k < 1) requestAnimationFrame(step);
          else b.textContent = original[i];          /* 落回原文,一个字都不差 */
        })(t0);
      });
    });
  })();

  /* ---------- 终态保障 ---------- */
  function allIn() {
    [].forEach.call(document.querySelectorAll('.tm-split,.tm-stagger,.tm-wipe'), function (el) {
      el.classList.add('tm-in');
    });
    statFinish();
    var veil = document.getElementById('veil');   /* 印幕兜底:任何终态路径都立即揭幕 */
    if (veil && veil.parentNode) veil.parentNode.removeChild(veil);
  }
  window.addEventListener('beforeprint', allIn);
  /* 进入阅读模式(长页)时全部显示 —— 监听与 motion.js 同一开关 */
  document.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('#motionToggle,.motion-toggle')) {
      setTimeout(allIn, 50);
    }
  }, true);
})();
