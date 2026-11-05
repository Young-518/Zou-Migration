/* 动效开关组件 —— 第四阶段:由 useScrollStory.ts「动效开关」分解(原 89-153 行)。
 * v3.6 修复的统一收敛:is-reading / no-veil / force-motion 三态 + localStorage 持久化。
 * 优先级:?motion=0 > ?motion=1 > localStorage('zou-motion') > 系统减少动效。
 * 关闭动效时若正停在卷轴段内部,rescueScroll 把滚动位置落到该段之后的章节头,
 * 避免 reel-zone 高度骤失导致页面跳底。
 * zou:motion 自定义事件契约冻结(scene-chain 等经它感知开关切换)。 */
import { useStoryStore } from '../stores/story';
import { REDUCE, reading } from './motion-state';
import { remeasureAll } from './zou-scroll';

export function initMotionToggle(): void {
  const store = useStoryStore();
  const root = document.documentElement;
  const reduce = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false;
  const q = new URLSearchParams(location.search);
  let saved: string | null = null;
  try { saved = localStorage.getItem('zou-motion'); } catch (e) { /* 隐私模式忽略 */ }
  const off = q.get('motion') === '0' ? true
    : (q.get('motion') === '1' ? false
    : (saved ? saved === 'off' : !!reduce));

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'motion-toggle';
  btn.id = 'motionToggle';
  const nav = document.querySelector('.chapnav .inner');
  if (nav) nav.appendChild(btn); else document.body.appendChild(btn);

  const zoneLanding: Record<string, string> = {
    scrollReel: '#heroBoard', reelOrigin: '#secOriginHead',
    reelAtlas: '#secAtlasHead', reelMacro: '#secMacroHead',
    reelChain: '#secChainHead', reelMicro: '#secMicroHead',
    reelMethod: '#secAppendix'
  };
  function rescueScroll(): void {
    const zones = document.querySelectorAll('.reel-zone');
    for (let i = 0; i < zones.length; i++) {
      const z = zones[i];
      const r = z.getBoundingClientRect();
      if (r.top <= 0 && r.bottom >= 0) {
        const sel = zoneLanding[z.id];
        const head = sel && document.querySelector(sel);
        if (head) window.scrollTo(0, head.getBoundingClientRect().top + window.scrollY - 76);
        return;
      }
    }
  }

  function applyMotion(on: boolean): void {
    const offNow = !on;
    document.body.classList.toggle('is-reading', offNow);
    root.classList.toggle('no-veil', offNow);
    root.classList.toggle('force-motion', on && !!reduce);
    btn.textContent = offNow ? '动效：关' : '动效：开';
    btn.setAttribute('aria-pressed', String(!offNow));
    btn.title = offNow ? '当前为速览模式，点击恢复滚动动效' : '点击进入速览模式（关闭滚动动效）';
    try { localStorage.setItem('zou-motion', on ? 'on' : 'off'); } catch (e) { /* 忽略 */ }
    document.dispatchEvent(new CustomEvent('zou:motion', { detail: { off: offNow } }));
    store.setMotionOn(on);
    remeasureAll();
  }

  btn.addEventListener('click', () => {
    const turningOff = !reading();
    if (turningOff) rescueScroll();
    document.body.classList.toggle('is-reading');
    applyMotion(!reading());
  });

  applyMotion(!off);
}
