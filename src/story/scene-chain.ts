/* 场景 04:本支七站 —— 书脊折叠 + 盖章(260vh,v3.0/v3.1 重建版)
 * 第四阶段:由 useScrollStory.ts 同名 IIFE 分解(原 330-612 行)。
 * 就地折窄、折叠本身推进;宽度按 p 连续写进行内 flex-basis,
 * 轨道位移恒 0(窄屏才整架左移 over×f/6),p=1 时整架在框内。 */
import { zouScrollAdd } from './zou-scroll';
import type { MigrRuntime, StoryMapHandle } from '../maps/types';

export function initSceneChain(): void {
  const scene = document.getElementById('sceneChain');
  if (!scene || !window.MIGR) return;
  const M = window.MIGR as MigrRuntime;
  const track = document.getElementById('chainTrack');
  const wrap = scene.querySelector('.chain-track-wrap') as HTMLElement;
  const map = (window._zou && window._zou.mapChain) as StoryMapHandle | null;
  const box = document.getElementById('stampCount');
  const seal = document.getElementById('stampSeal');
  const reset = document.getElementById('stampReset');
  if (!track || !wrap) return;

  const places = M.chainPlaces.features;
  /* 中间纪年只有"某某之后/北宋年间"，此处统一加"约"并保留异说 */
  const YEAR_TEXT: Record<string, string> = { '莱州': '620', '涿州': '620', '潢川': '约 780',
    '宜黄': '约 800', '埮坪': '965', '湖边': '约 1080', '双洲': '1507' };
  const segs = M.chain.features;
  function km(a: [number, number], b: [number, number]): number {
    const R = 6371, dLat = (b[1] - a[1]) * Math.PI / 180;
    const dLng = (b[0] - a[0]) * Math.PI / 180;
    const s = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(a[1] * Math.PI / 180) * Math.cos(b[1] * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return Math.round(2 * R * Math.asin(Math.sqrt(s)));
  }

  let stamped: Record<string, number> = {};
  track.innerHTML = places.map((f, i) => {
    const p = f.properties, c = f.geometry.coordinates;
    const ev = i > 0 && segs[i - 1] ? segs[i - 1].properties : null;
    const note = ev ? (ev.event as string) : '全哲公原籍莱州（东鲁），唐武德三年封范阳侯前的起点。';
    const d = i > 0 ? km(places[i - 1].geometry.coordinates, c) : null;
    return '<article class="track-card" data-i="' + i + '">'
      + '<span class="tc-no">站 ' + (i + 1) + ' / 7</span>'
      + '<h4>' + p.name + '</h4>'
      + '<span class="tc-year">' + (YEAR_TEXT[p.name as string] || p.year || '—') + ' 年</span>'
      + '<p class="tc-note">' + note + '</p>'
      + (d != null ? '<span class="tc-dist">距上一站约 ' + d + ' km（直线）</span>' : '<span class="tc-dist">起点 · 渤海之滨</span>')
      + '<button class="tc-stamp" type="button" aria-pressed="false" data-i="' + i + '">盖章</button>'
      + '</article>';
  }).join('');

  const cards = Array.prototype.slice.call(track.querySelectorAll('.track-card')) as HTMLElement[];
  let lastIdx = -1;

  const reward = document.getElementById('stampReward');
  function setStampCount(): void {
    const n = Object.keys(stamped).length;
    if (box) box.textContent = String(n);
    if (seal) seal.classList.toggle('on', n === 7);
    /* v3.0：盖满七站时把轨道高度让出一段，奖励卡压在盖章条上不遮卡片 */
    wrap.classList.toggle('has-reward', n === 7);
    if (reward) {
      if (n === 7 && reward.hidden) {
        reward.hidden = false;
        requestAnimationFrame(() => { reward.classList.add('in'); });
      } else if (n !== 7 && !reward.hidden) {
        reward.hidden = true;
        reward.classList.remove('in');
      }
    }
  }
  track.addEventListener('click', (e: MouseEvent) => {
    const t = e.target as Element;
    if (!t.closest) return;
    if (t.closest('.tc-stamp')) return;   /* 折起的卡里点章不算回站 */
    const sp = t.closest('.track-card.is-spine');
    if (!sp) return;
    goStation(+(sp.getAttribute('data-i') || 0));
  });
  track.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const c = e.target instanceof Element ? e.target.closest('.track-card.is-spine') : null;
    if (!c) return;
    e.preventDefault(); e.stopPropagation();
    goStation(+(c.getAttribute('data-i') || 0));
  });
  /* 盖章（独立监听：折起的卡里点章不触发回站） */
  track.addEventListener('click', (e: MouseEvent) => {
    const t = e.target as Element;
    const b = t.closest ? t.closest('.tc-stamp') : null;
    if (!b) return;
    const i = b.getAttribute('data-i') || '';
    if (stamped[i]) delete stamped[i]; else stamped[i] = 1;
    b.setAttribute('aria-pressed', stamped[i] ? 'true' : 'false');
    setStampCount();
  });
  /* 键盘：←/→ 逐站切换（原先只能拖拽或滚轮） */
  track.setAttribute('tabindex', '0');
  track.setAttribute('role', 'list');
  track.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const n = cards.length;
    const next = lastIdx < 0 ? 0 : lastIdx + (e.key === 'ArrowRight' ? 1 : -1);
    activate(Math.max(0, Math.min(n - 1, next)));
    const top = scene!.getBoundingClientRect().top + window.scrollY;
    const span = Math.max(1, scene!.offsetHeight - window.innerHeight);
    window.scrollTo({ top: top + span * (next / Math.max(1, n - 1)), behavior: 'smooth' });
  });
  if (reset) reset.addEventListener('click', () => {
    stamped = {};
    Array.prototype.forEach.call(track!.querySelectorAll('.tc-stamp'), (b: HTMLElement) => {
      b.setAttribute('aria-pressed', 'false');
    });
    setStampCount();
  });

  function activate(i: number): void {
    if (i === lastIdx) return;
    lastIdx = i;
    cards.forEach((c, k) => { c.classList.toggle('on', k === i); });
    if (map && places[i]) {
      const c = places[i].geometry.coordinates;
      map.flyTo([c[1], c[0]], 7.2, { duration: .8 });
    }
    if (window.__zouHUD) window.__zouHUD(3,
      (YEAR_TEXT[places[i].properties.name as string] || places[i].properties.year || '') + '',
      places[i].properties.name as string);
    const hint = document.getElementById('stampHint');
    if (hint) hint.textContent = '第 ' + (i + 1) + ' / 7 站 · ' + (i < 6 ? '继续右滑 →' : '已到末站');
  }

  /* ---------- v3.0 第 12 项：路引折成书脊 ----------
     走过的站就地折成 46px 朱砂书脊，后面的站顺势顶上来。
     宽度逐帧按 p 连续写成行内 flex-basis；轨道不位移，
     p=1 时六枚书脊 + 第七站必然整架在框内。
     宽度只在 pinned() 为真时写；≤900px / 速览 / 打印一律清掉。 */
  const FOLD_AT = 0.5;         /* 过了半站开始折 */
  const FOLD_SPAN = 0.3;       /* 再用 0.3 站折完（f∈[k+.5,k+.8]） */
  const SPINE_W = 46;          /* 与 CSS 的 .is-spine flex-basis 一致 */
  const N = cards.length;
  let lastP = -1;
  /* 与 .chain-track 的 padding / gap 对齐（改 CSS 时这里自动跟随） */
  const PAD = ((): number => {
    const v = parseFloat(getComputedStyle(track).paddingLeft);
    return isNaN(v) ? 18 : v;
  })();
  const GAP = ((): number => {
    const cs = getComputedStyle(track);
    const v = parseFloat(cs.columnGap || cs.gap);
    return isNaN(v) ? 14 : v;
  })();

  function pinned(): boolean {
    return !document.body.classList.contains('is-reading') &&
      window.innerWidth > 900 &&
      !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }
  /* 与 CSS clamp(230px,26vw,320px) 同式：不读被折叠后的宽度 */
  function cardW(): number { return Math.min(320, Math.max(230, window.innerWidth * 0.26)); }

  function setFold(i: number, on: boolean): void {
    const c = cards[i];
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
  function measureShelf(): void {
    wrap.style.removeProperty('--shelf-h');   /* 先归零，让卡片按内容撑高再量 */
    let h = 0;
    for (let i = 0; i < N; i++) {
      if (cards[i].classList.contains('is-spine')) continue;
      h = Math.max(h, cards[i].offsetHeight);
    }
    if (h) wrap.style.setProperty('--shelf-h', h + 'px');
  }
  function unfoldAll(): void {
    for (let i = 0; i < N; i++) {
      setFold(i, false);
      cards[i].style.flexBasis = '';
    }
    if (track!.style.transform) track!.style.transform = '';
  }
  function goStation(i: number): void {
    const top = scene!.getBoundingClientRect().top + window.scrollY;
    const span = Math.max(1, scene!.offsetHeight - window.innerHeight);
    window.scrollTo({ top: top + span * (i / Math.max(1, N - 1)), behavior: 'smooth' });
  }

  function paint(p: number): void {
    const f = p * (N - 1);
    const cw = cardW();
    for (let i = 0; i < N; i++) {
      const u = i < N - 1 ? Math.min(1, Math.max(0, (f - i - FOLD_AT) / FOLD_SPAN)) : 0;
      const w = cw + (SPINE_W - cw) * u;
      cards[i].style.flexBasis = w.toFixed(1) + 'px';
      setFold(i, u > 0.5);
    }
    /* 窄屏（≈1200 以下）整架比右栏宽：按进度把整架缓缓左移一点，
       到末站刚好把第七站收回框内（1400 下 over=0，完全不位移） */
    const endTotal = PAD * 2 + (N - 1) * SPINE_W + cw + GAP * (N - 1);
    const over = Math.max(0, endTotal - wrap.clientWidth);
    const shift = over * (f / Math.max(1, N - 1));
    track!.style.transform = shift > 0.5 ? 'translate3d(' + (-shift).toFixed(1) + 'px,0,0)' : '';
    activate(Math.round(f));
  }

  zouScrollAdd(scene, (p) => {
    if (!pinned()) { unfoldAll(); return; }
    lastP = p;
    paint(p);
  });
  /* 尺寸/字体变化后 p 不变、回调不会再来，这里补一次重排 */
  window.addEventListener('resize', () => {
    if (lastP >= 0 && pinned()) paint(lastP);
  }, { passive: true });

  /* 退场：速览模式 / 缩到 901px 以下 / 打印，一律摊平还原 */
  document.addEventListener('zou:motion', ((e: Event) => {
    if ((e as CustomEvent).detail && (e as CustomEvent).detail.off) unfoldAll();
    else if (lastP >= 0) paint(lastP);
  }) as EventListener);
  if (window.matchMedia) {
    const mqNm = window.matchMedia('(max-width:900px)');
    const onMq = (): void => {
      if (mqNm.matches) unfoldAll(); else if (lastP >= 0) paint(lastP);
    };
    if (mqNm.addEventListener) mqNm.addEventListener('change', onMq);
    else if ((mqNm as unknown as { addListener(cb: () => void): void }).addListener) {
      (mqNm as unknown as { addListener(cb: () => void): void }).addListener(onMq);
    }
  }
  window.addEventListener('beforeprint', unfoldAll);

  /* 键盘：←/→ 切站，Esc 跳到段末 */
  scene.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.defaultPrevented) return;            /* 轨道内的 ←/→ 已处理，避免连跳两站 */
    if (document.body.classList.contains('is-reading')) return;
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Escape') return;
    const top = scene.getBoundingClientRect().top + window.scrollY;
    const span = Math.max(1, scene.offsetHeight - window.innerHeight);
    if (e.key === 'Escape') {
      window.scrollTo({ top: top + span + 8, behavior: 'smooth' }); e.preventDefault(); return;
    }
    const i = Math.max(0, Math.min(6, lastIdx + (e.key === 'ArrowRight' ? 1 : -1)));
    window.scrollTo({ top: top + span * (i + .5) / 7, behavior: 'smooth' });
    e.preventDefault();
  });
  scene.setAttribute('tabindex', '0');
  setStampCount();

  /* 卡高量测：首帧、字体就绪、尺寸变化各一次 */
  requestAnimationFrame(measureShelf);
  setTimeout(measureShelf, 400);
  window.addEventListener('resize', () => { setTimeout(measureShelf, 120); }, { passive: true });

  /* chainSizeFix：Pin 场景里地图容器高度依赖布局，进场景后补一次尺寸重算 */
  function chainSizeFix(): void {
    if (map) map.invalidateSize();
  }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((es) => {
      es.forEach((en) => {
        if (!en.isIntersecting) return;
        setTimeout(chainSizeFix, 80);
      });
    }, { threshold: .12 }).observe(scene);
  }
  window.addEventListener('load', () => { setTimeout(chainSizeFix, 80); });
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      setTimeout(chainSizeFix, 60);
      setTimeout(measureShelf, 80);
    });
  }

  /* 进入横向场景时隐藏右侧进度轴，避免压住路引卡 */
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((es) => {
      es.forEach((en) => {
        document.body.classList.toggle('no-axis', en.isIntersecting);
      });
    }, { threshold: .35 }).observe(scene);
  }
}
