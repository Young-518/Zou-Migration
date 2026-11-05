/* ============================================================
 * js/poem-ui.js —— 05 双洲八景「古今对读」交互
 * 职责：景名切换预览、诗卷抽屉（清/今咏 tab）、深链 #poem-<id>、焦点管理
 * 依赖：window.ZOU_POEMS（js/poems.js）；不依赖任何库
 * ============================================================ */
(function () {
  'use strict';

  var DATA = window.ZOU_POEMS;
  var grid = document.getElementById('poemGrid');
  var drawer = document.getElementById('poemDrawer');
  var body = document.getElementById('poemBody');
  var foot = document.getElementById('poemFoot');
  var titleEl = document.getElementById('poemDrawerTitle');
  var subEl = document.getElementById('poemDrawerSub');
  var preview = document.getElementById('poemPreview');
  var btnOpen = document.getElementById('btnPoemOpen');
  var btnClose = document.getElementById('poemClose');
  var lastFocus = null;
  var currentScene = null;
  var currentSet = 'qing';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function sceneById(id) {
    if (!DATA || !DATA.scenes) return null;
    for (var i = 0; i < DATA.scenes.length; i++) {
      if (DATA.scenes[i].id === id) return DATA.scenes[i];
    }
    return null;
  }
  function poemsOf(id, dynasty) {
    if (!DATA || !DATA.poems) return [];
    return DATA.poems.filter(function (p) {
      return p.sceneId === id && p.dynasty === dynasty;
    });
  }
  function authorList(id) {
    var qing = poemsOf(id, '清').map(function (p) { return '清·' + p.author; });
    var jin = poemsOf(id, '今').map(function (p) { return '今·' + p.author; });
    var q = qing.filter(function (v, i) { return qing.indexOf(v) === i; });
    var j = jin.filter(function (v, i) { return jin.indexOf(v) === i; });
    return q.concat(j).join(' / ');
  }

  /* ---------- 预览 ---------- */
  function renderPreview(id) {
    currentScene = id;
    var scene = sceneById(id);
    var chip = grid ? grid.querySelector('.poem-chip[data-scene="' + id + '"]') : null;
    Array.prototype.forEach.call(grid ? grid.querySelectorAll('.poem-chip') : [], function (b) {
      var on = b === chip;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    if (!preview) return;
    if (!scene) { preview.innerHTML = '<p class="pp-line">诗卷待补</p>'; return; }
    var p = poemsOf(id, '清')[0];
    var src = p
      ? '清·' + p.author + '《' + String(p.title).split('·')[0] + '》'
      : '清诗待补';
    var line = p && p.lines ? p.lines.slice(0, 2).join('') : '此景诗卷待与纸书复核。';
    preview.innerHTML = '<p class="pp-source">' + esc(src) + '</p>'
      + '<p class="pp-line">' + esc(line) + '</p>';
    if (btnOpen) {
      btnOpen.disabled = !scene;
      btnOpen.textContent = scene
        ? '打开《' + (scene.displayName || scene.name) + '》全文 →'
        : '展开诗卷 →';
    }
  }

  /* ---------- 抽屉 ---------- */
  function renderBody(id, set) {
    var scene = sceneById(id);
    if (!scene) {
      body.innerHTML = '<p class="pd-empty">诗卷待补：该景尚未录入诗作。</p>';
      foot.textContent = '';
      return;
    }
    var dynasty = set === 'jin' ? '今' : '清';
    var list = poemsOf(id, dynasty);
    if (!list.length) {
      body.innerHTML = '<p class="pd-empty">诗卷待补：' + (dynasty === '清' ? '清诗' : '今咏')
        + '尚未录入。</p>';
    } else {
      body.innerHTML = list.map(function (p) {
        var notes = (p.notes && p.notes.length)
          ? '<dl class="pd-notes">' + p.notes.map(function (n) {
              return '<dt>' + esc(n.term) + '</dt><dd>' + esc(n.text) + '</dd>';
            }).join('') + '</dl>'
          : '';
        return '<section class="pd-poem">'
          + '<h4 class="pd-title">' + esc(p.title) + '</h4>'
          + '<p class="pd-author">' + esc(p.dynasty) + '·' + esc(p.author)
          + (p.full ? ' · 全篇 ' + p.excerptCount + ' 句' : (p.excerptCount ? ' · 录 ' + p.excerptCount + ' 句' : ''))
          + (p.excerptCount && p.excerptCount < 8 ? ' · 摘录本疑脱一句，待纸书核对' : '') + '</p>'
          + (p.lines || []).map(function (l) {
              return '<p class="pd-line">' + esc(l) + '</p>';
            }).join('')
          + notes
          + (p.source && p.source.page ? '<p class="pd-page">谱注第 ' + p.source.page + ' 页</p>' : '')
          + '</section>';
      }).join('');
    }
    var pages = list.map(function (p) { return p.source && p.source.page; })
      .filter(Boolean).filter(function (v, i, a) { return a.indexOf(v) === i; });
    foot.textContent = pages.length ? '出处：' + pages.map(function (n) { return '第 ' + n + ' 页'; }).join('、')
      : '出处：谱注（页码待核）';
  }

  function setTab(set) {
    currentSet = set;
    Array.prototype.forEach.call(drawer.querySelectorAll('.pd-tab'), function (b) {
      var on = b.getAttribute('data-set') === set;
      b.classList.toggle('on', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
  }

  var pushedForPoem = false;   /* 本次诗卷是否压入过历史记录 */

  function openPoem(id, set, fromHistory) {
    var scene = sceneById(id);
    if (!scene) return;
    var wasHidden = drawer.hidden;
    if (wasHidden) lastFocus = document.activeElement;
    currentScene = id;
    set = set || 'qing';
    titleEl.textContent = scene.displayName || scene.name;
    subEl.textContent = authorList(id) || '诗卷待补';
    setTab(set);
    renderBody(id, set);
    /* v2.7.1：换一首诗要把面板卷回顶部——否则读完长诗滚到底，再开另一首
       会先看到中后段，像是"诗没开头" */
    var panel = drawer.querySelector('.poem-drawer-panel');
    if (panel) panel.scrollTop = 0;
    drawer.hidden = false;
    document.body.style.overflow = 'hidden';
    /* v2.7.1：首开压一条历史记录，"后退"才是关诗卷而不是离开页面；
       换一首 / 由 popstate 触发则只替换，避免把历史塞满 */
    var hash = '#poem-' + id;
    try {
      if (location.hash === hash || fromHistory) {
        history.replaceState({ poem: id }, '', hash);
      } else if (wasHidden && !pushedForPoem) {
        history.pushState({ poem: id }, '', hash);
        pushedForPoem = true;
      } else {
        history.replaceState({ poem: id }, '', hash);
      }
    } catch (e) {}
    if (btnClose) btnClose.focus();
  }

  function closePoem(fromPop) {
    if (!drawer || drawer.hidden) return;
    drawer.hidden = true;
    document.body.style.overflow = '';
    if (!fromPop && pushedForPoem) {
      /* 我们自己压的记录：回退一步，URL 与历史都回到开卷前 */
      pushedForPoem = false;
      try { history.back(); } catch (e) {}
    } else {
      try {
        history.replaceState(null, '', location.pathname + location.search);
      } catch (e) {}
    }
    if (lastFocus && lastFocus.focus) lastFocus.focus();
    else if (btnOpen) btnOpen.focus();
  }

  /* ---------- 事件 ---------- */
  /* v2.7：景名「单击即开卷」。预览改由 hover / 键盘聚焦触发，
     不再要求用户先点一次看两行、再找按钮——原"单击预览、双击打开"没人猜得到 */
  if (grid) {
    grid.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('.poem-chip') : null;
      if (!b) return;
      var id = b.getAttribute('data-scene');
      renderPreview(id);
      openPoem(id, 'qing');
    });
    grid.addEventListener('mouseover', function (e) {
      var b = e.target.closest ? e.target.closest('.poem-chip') : null;
      if (!b || b.getAttribute('data-scene') === currentScene) return;
      renderPreview(b.getAttribute('data-scene'));
    });
    grid.addEventListener('focusin', function (e) {
      var b = e.target.closest ? e.target.closest('.poem-chip') : null;
      if (!b) return;
      renderPreview(b.getAttribute('data-scene'));
    });
  }
  if (btnOpen) {
    btnOpen.addEventListener('click', function () {
      openPoem(currentScene || (DATA && DATA.scenes && DATA.scenes[0].id) || '', 'qing');
    });
  }
  if (btnClose) btnClose.addEventListener('click', closePoem);
  if (drawer) {
    drawer.addEventListener('click', function (e) {
      if (e.target.hasAttribute && e.target.hasAttribute('data-close-poem')) closePoem();
      var tab = e.target.closest ? e.target.closest('.pd-tab') : null;
      if (tab && currentScene) {
        var set = tab.getAttribute('data-set');
        setTab(set);
        renderBody(currentScene, set);
      }
    });
    /* 焦点不逃出面板 + Esc 关闭 */
    drawer.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); closePoem(); return; }
      if (e.key !== 'Tab') return;
      var panel = drawer.querySelector('.poem-drawer-panel');
      var focusables = panel.querySelectorAll('button, [href], input, [tabindex]:not([tabindex="-1"])');
      if (!focusables.length) return;
      var first = focusables[0], last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
  }

  /* 深链：#poem-<id> */
  function fromHash() {
    var m = /^#poem-([\w-]+)$/.exec(location.hash || '');
    if (!m) return false;
    var id = m[1];
    if (!sceneById(id)) return false;
    renderPreview(id);
    openPoem(id, 'qing');
    return true;
  }
  window.addEventListener('hashchange', function () {
    if (!fromHash() && drawer && !drawer.hidden) closePoem();
  });

  /* v2.7.1：popstate（浏览器后退/前进）——有 #poem- 就开卷，没有就收起 */
  window.addEventListener('popstate', function () {
    var m = /^#poem-([\w-]+)$/.exec(location.hash || '');
    if (m && sceneById(m[1])) {
      pushedForPoem = true;
      openPoem(m[1], 'qing', true);
    } else if (drawer && !drawer.hidden) {
      pushedForPoem = false;
      closePoem(true);
    }
  });

  /* ---------- 初始化 ---------- */
  if (DATA && DATA.scenes && DATA.scenes.length) {
    renderPreview(DATA.scenes[0].id);
  } else if (preview) {
    preview.innerHTML = '<p class="pp-line">诗卷待补</p>';
  }
  if (!fromHash() && btnOpen) btnOpen.disabled = false;

  /* 供验收/调试 */
  window.__POEM_UI = {
    open: openPoem, close: closePoem, preview: renderPreview,
    scene: function () { return currentScene; }
  };
})();
