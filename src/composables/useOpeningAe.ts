/* ============================================================
 * 开场印幕 AE 层 —— 「书道·逐词墨书」v3(正風毛筆 · 繁體行書)
 * ============================================================
 * 基准:用户提供录屏逐帧分析 —— 暖纸底、毛笔书法逐词亮相、竖排小注、
 * 竖行间奏、留白呼吸、收束竖句。字体:正風毛筆字體(衡山毛筆行書繁中
 * 補字版,max32002/masafont,OFL 衍生·免費商用,子集 28.3KB/66 字,
 * 全字覆盖经 cmap 校验)。
 *
 * v3 修订(用户反馈三点):
 *   1. 遮盖根治 —— 结构性保证:beat 改为 flex 行布局(大字组与竖注为
 *      兄弟节点,天然互不重叠);大字双字在词内 flex+gap 排列,任何时刻
 *      不做绝对定位叠放;拍间零交叠(前拍完全消失 ≥100ms 后下一拍首字
 *      才出现,见节拍表 out 完成时刻与下一拍 in 的间隔);
 *   2. 字体更正 —— 草书感毛笔行书繁体(MasaFont)替换文楷楷体;
 *   3. 古风背景 —— .ae-bg 层:宣纸纤维纹理、三团水墨晕染(极缓呼吸)、
 *      两层远山墨影(极缓漂移)、印章离纸时朱砂屑一次散落(有来源有退场)。
 *
 * 时间线(t0 = 挂类时刻,总长 ≈16.3s;单字符动效均 ≤700ms;
 * 节拍表为绝对 ms,拍间零交叠由 outAt+480 与下一拍 in 的间隔保证):
 *   0.15–0.65s  落章「鄒」→ 0.55–1.0s 印泥离纸(朱砂屑散落)
 *   1.05–3.13s  拍A 范陽 + 竖注「唐武德三年·封范陽侯」
 *   3.28–5.36s  拍B 宜黃 + 竖注「貞元年間·舉族南遷」
 *   5.51–6.77s  间奏竖行「九六五年·埮坪受旌」
 *   6.92–9.00s  拍C 湖邊 + 竖注「北宋年間·卜居撰詩」
 *   9.15–11.23s 拍D 雙洲 + 竖注「正德二年·有宗公開基」
 *  11.38–12.64s 间奏竖行「三十三段路線·二十四個起點」
 *  12.79–14.67s 集群「七站 / 六段 / 一千八百八十六公里」
 *  14.82s      收束竖句「一族一村·千年可考」
 *  15.45–16.30s 揭幕 veilOut(时长/曲线不变,延迟覆盖)
 *
 * 降级:reduced-motion / html.no-veil / 回访 / 跳过 —— 不建 DOM 不挂类。
 * ============================================================
 * ★ 微调入口(三处对应,改动前必读):
 *   1. 文案/节奏 → 本文件 BEATS[](字、delay、outAt、step 全在此);
 *      ★ 改文案后必跑 npm run ae:subset,否则新字不在子集内回退后备字体;
 *   2. 落位/构图 → opening-ae.css 各拍 --bx/--by 与字号 keyframes;
 *   3. 总时长 → veilHold/veilOut 延迟(opening-ae.css)须与 BEATS 尾拍
 *      + VEIL_HOLD_UNTIL_MS(本文件)三处同步。
 * ============================================================ */

interface CharSpec { ch: string; delay: number }
interface BeatSpec {
  cls: string;
  word?: { chars: CharSpec[]; dur: number };                 /* 大字词(flex 横排) */
  note?: { text: string; delay: number; dur: number; step: number };  /* 竖排小注 */
  vline?: { text: string; delay: number; dur: number; step: number }; /* 间奏竖行 */
  cluster?: Array<{ text: string; kind: 'cl-big' | 'cl-small'; delay: number }>;
  outAt?: number;                                            /* 本拍整体淡出时刻 */
}

const BIG_DUR = 560;
const NOTE_DUR = 380;

/* 节拍表 —— 拍间零交叠:outAt+480 完成时刻与下一拍最早 in 间隔 ≥100ms */
const BEATS: BeatSpec[] = [
  { cls: 'ae-bA',
    word: { chars: [{ ch: '范', delay: 1050 }, { ch: '陽', delay: 1290 }], dur: BIG_DUR },
    note: { text: '唐武德三年·封范陽侯', delay: 1500, dur: NOTE_DUR, step: 55 },
    outAt: 2650 },
  { cls: 'ae-bB',
    word: { chars: [{ ch: '宜', delay: 3280 }, { ch: '黃', delay: 3520 }], dur: BIG_DUR },
    note: { text: '貞元年間·舉族南遷', delay: 3730, dur: NOTE_DUR, step: 55 },
    outAt: 4880 },
  { cls: 'ae-int1',
    vline: { text: '九六五年·埮坪受旌', delay: 5510, dur: NOTE_DUR, step: 55 },
    outAt: 6350 },
  { cls: 'ae-bC',
    word: { chars: [{ ch: '湖', delay: 6920 }, { ch: '邊', delay: 7160 }], dur: BIG_DUR },
    note: { text: '北宋年間·卜居撰詩', delay: 7370, dur: NOTE_DUR, step: 55 },
    outAt: 8520 },
  { cls: 'ae-bD',
    word: { chars: [{ ch: '雙', delay: 9150 }, { ch: '洲', delay: 9390 }], dur: BIG_DUR },
    note: { text: '正德二年·有宗公開基', delay: 9600, dur: NOTE_DUR, step: 55 },
    outAt: 10750 },
  { cls: 'ae-int2',
    vline: { text: '三十三段路線·二十四個起點', delay: 11380, dur: NOTE_DUR, step: 42 },
    outAt: 12220 },
  { cls: 'ae-cl',
    cluster: [
      { text: '七站', kind: 'cl-big', delay: 12790 },
      { text: '六段', kind: 'cl-big', delay: 13030 },
      { text: '一千八百八十六公里', kind: 'cl-small', delay: 13270 },
    ],
    outAt: 14190 },
  { cls: 'ae-vt',
    vline: { text: '一族一村·千年可考', delay: 14820, dur: 420, step: 90 } },
];

const VEIL_HOLD_UNTIL_MS = 16600;

function mkSpan(cls: string, ch: string, delay: number, dur: number): HTMLSpanElement {
  const s = document.createElement('span');
  s.className = cls;
  s.setAttribute('aria-hidden', 'true');
  s.textContent = ch;
  s.style.animationDelay = delay + 'ms';
  s.style.animationDuration = dur + 'ms';
  return s;
}

/* 古风背景层:宣纸纤维 + 墨晕×3 + 远山×2(纯 CSS/SVG data-uri,零外链) */
function buildBackground(): HTMLElement {
  const bg = document.createElement('div');
  bg.className = 'ae-bg';
  bg.setAttribute('aria-hidden', 'true');
  bg.innerHTML =
    '<div class="ae-bg-fiber"></div>' +
    '<div class="ae-bg-mist ae-mist1"></div>' +
    '<div class="ae-bg-mist ae-mist2"></div>' +
    '<div class="ae-bg-mist ae-mist3"></div>' +
    '<div class="ae-bg-hill ae-hill1"></div>' +
    '<div class="ae-bg-hill ae-hill2"></div>';
  return bg;
}

/* 朱砂屑:印章离纸时一次散落(来源=印章,退场=落出淡出,700ms) */
function buildSparks(): HTMLElement {
  const sp = document.createElement('div');
  sp.className = 'ae-sparks';
  sp.setAttribute('aria-hidden', 'true');
  /* 印章中心 ≈ 屏幕中心偏上(veil flex 居中,立方 104px) */
  const SEEDS = [
    { x: -14, y: -10, dx: 46, dy: 120, d: 40 },
    { x: 10, y: 6, dx: -38, dy: 150, d: 120 },
    { x: -2, y: 14, dx: 22, dy: 168, d: 210 },
  ];
  SEEDS.forEach((s, i) => {
    const dot = document.createElement('i');
    dot.className = 'ae-spark';
    dot.style.left = 'calc(50% + ' + s.x + 'px)';
    dot.style.top = 'calc(50% + ' + s.y + 'px)';
    dot.style.setProperty('--dx', s.dx + 'px');
    dot.style.setProperty('--dy', s.dy + 'px');
    dot.style.animationDelay = (560 + s.d) + 'ms';
    dot.style.animationDuration = '700ms';
    if (i % 2) dot.classList.add('ae-spark-b');
    sp.appendChild(dot);
  });
  return sp;
}

export function initOpeningAe(): void {
  const veil = document.getElementById('veil');
  if (!veil) return;
  if (document.documentElement.classList.contains('no-veil')) return;
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
  if (reduce && reduce.matches) return;

  const skipBtn = document.getElementById('veilSkip');
  const frag = document.createDocumentFragment();

  /* 背景层最先插入(同 z 下 DOM 序在前 = 垫底) */
  frag.appendChild(buildBackground());
  frag.appendChild(buildSparks());

  for (const beat of BEATS) {
    const box = document.createElement('div');
    box.className = 'ae-beat ' + beat.cls;
    box.setAttribute('aria-hidden', 'true');
    if (beat.outAt != null) {
      box.style.animationName = 'aeBeatOut';
      box.style.animationDelay = beat.outAt + 'ms';
      box.style.animationDuration = '480ms';
      box.style.animationTimingFunction = 'ease-in';
      box.style.animationFillMode = 'forwards';
    }

    if (beat.word) {
      const word = document.createElement('span');
      word.className = 'ae-word';
      let lastDelay = 0;
      for (const c of beat.word.chars) {
        word.appendChild(mkSpan('ae-big-ch', c.ch, c.delay, beat.word.dur));
        lastDelay = Math.max(lastDelay, c.delay);
      }
      /* 收束扫光:末字落纸后,一道印金微光横扫整词(词级,不逐字) */
      word.style.setProperty('--wi', (lastDelay + beat.word.dur) + 'ms');
      box.appendChild(word);
    }
    if (beat.note) {
      const col = document.createElement('span');
      col.className = 'ae-note';
      let i = 0;
      for (const ch of beat.note.text) {
        col.appendChild(mkSpan('ae-note-ch', ch, beat.note.delay + i * beat.note.step, beat.note.dur));
        i += 1;
      }
      box.appendChild(col);
    }
    if (beat.vline) {
      const col = document.createElement('span');
      col.className = 'ae-vline';
      let i = 0;
      for (const ch of beat.vline.text) {
        col.appendChild(mkSpan('ae-vline-ch', ch, beat.vline.delay + i * beat.vline.step, beat.vline.dur));
        i += 1;
      }
      box.appendChild(col);
    }
    if (beat.cluster) {
      for (const it of beat.cluster) {
        const w = document.createElement('span');
        w.className = 'ae-cl-item ' + it.kind;
        const dur = it.kind === 'cl-small' ? 340 : BIG_DUR;
        let i = 0;
        for (const ch of it.text) {
          w.appendChild(mkSpan('ae-cl-ch', ch, it.delay + i * 60, dur));
          i += 1;
        }
        box.appendChild(w);
      }
    }
    frag.appendChild(box);
  }

  const legacyLine = veil.querySelector<HTMLElement>('.veil-line');
  if (legacyLine) legacyLine.style.display = 'none';

  veil.insertBefore(frag, skipBtn);
  veil.classList.add('ae-open');

  (window as unknown as { __ZOU_VEIL_HOLD_UNTIL?: number }).__ZOU_VEIL_HOLD_UNTIL =
    Date.now() + VEIL_HOLD_UNTIL_MS;
}
