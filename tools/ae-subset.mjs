/* ============================================================
 * ae-subset —— 开场印幕「书道·逐词墨书」字体一键重取子集
 * ============================================================
 * 用途:修改 useOpeningAe.ts BEATS[] 文案后跑本脚本,使
 *      public/fonts/ae-bishu.woff2 覆盖全部新文案字符。
 * 命令:npm run ae:subset
 *
 * 管线(与 v3 建立时同源):
 *   1. 从 useOpeningAe.ts 提取全部单引号字符串字面量中的非 ASCII
 *      字符(BEATS[] 文案、印章/竖注/竖行/集群全在此);
 *   2. 取源字体:tools/.fontcache/MasaFont-Regular.woff2 缓存优先,
 *      无缓存从 jsdelivr 下载(max32002/masafont 正風毛筆,OFL 免費商用);
 *   3. subset-font 双份:sfnt 供校验,woff2 供产出(harfbuzzjs 内核);
 *   4. opentype.js 读 sfnt cmap 逐字校验全覆盖(缺字硬失败退出 1);
 *   5. 覆盖写出 ae-bishu.woff2(旧产物备份至 .fontcache/ae-bishu.prev.woff2),
 *      字符集清单记录至 .fontcache/ae-chars.json 供下次 diff。
 *
 * 字体事实(勿重蹈):柳建毛草/龙藏/马善政均 GB2312 简体集无繁体字形;
 * 繁体书法开源可用最优=正風毛筆行书(MasaFont,繁中補字 23,699 字)。
 * ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import subsetFont from 'subset-font';
import opentype from 'opentype.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TS_SRC = path.join(ROOT, 'src/composables/useOpeningAe.ts');
const OUT_WOFF2 = path.join(ROOT, 'public/fonts/ae-bishu.woff2');
const CACHE_DIR = path.join(ROOT, 'tools/.fontcache');
const CACHE_FONT = path.join(CACHE_DIR, 'MasaFont-Regular.woff2');
const REC = path.join(CACHE_DIR, 'ae-chars.json');
const SRC_URL =
  'https://cdn.jsdelivr.net/gh/max32002/masafont@master/webfont/MasaFont-Regular.woff2';

/* ---- 1. 提取文案字符:单引号字符串字面量中全部非 ASCII 字符 ---- */
function extractChars() {
  const src = fs.readFileSync(TS_SRC, 'utf8');
  const set = new Set();
  /* useOpeningAe.ts 文案与属性均在单引号字符串内;注释无单引号字面量,
   * 故不误收注释汉字。逐 code point 遍历,保留 ASCII 可见区之外全部字符
   * (含「·」U+00B7 等 CJK 文案标点)。 */
  const lit = /'((?:[^'\\\n]|\\.)*)'/g;
  let m;
  while ((m = lit.exec(src)) !== null) {
    for (const ch of m[1].replace(/\\(.)/g, '$1')) {
      if (ch.codePointAt(0) > 0x7e) set.add(ch);
    }
  }
  if (set.size === 0) throw new Error('未从 useOpeningAe.ts 提取到任何文案字符,提取正则可能失配');
  return [...set].sort();
}

/* ---- 2. 取源字体:缓存优先,否则 jsdelivr 下载 ---- */
async function loadSourceFont() {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  if (fs.existsSync(CACHE_FONT)) {
    console.log('[2/5] 源字体:使用本地缓存 ' + path.relative(ROOT, CACHE_FONT));
    return fs.promises.readFile(CACHE_FONT);
  }
  console.log('[2/5] 源字体:缓存未命中,从 jsdelivr 下载…');
  const res = await fetch(SRC_URL);
  if (!res.ok) throw new Error('源字体下载失败 HTTP ' + res.status + '(网络情报:jsdelivr 可用;gstatic/loli 被墙勿用)');
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 1024 * 1024) throw new Error('源字体异常过小(' + buf.length + 'B),疑似错误页,已放弃');
  await fs.promises.writeFile(CACHE_FONT, buf);
  console.log('      已缓存 ' + (buf.length / 1048576).toFixed(1) + 'MB → ' + path.relative(ROOT, CACHE_FONT));
  return buf;
}

async function main() {
  /* ---- 1. 提取 ---- */
  const chars = extractChars();
  const text = chars.join('');
  console.log('[1/5] 文案字符提取:useOpeningAe.ts → ' + chars.length + ' 字');
  console.log('      ' + text);

  /* ---- 2. 源字体 ---- */
  const srcFont = await loadSourceFont();

  /* ---- 3. 子集双份:sfnt 校验 + woff2 产出 ---- */
  console.log('[3/5] 子集切分(harfbuzzjs):sfnt(校验用) + woff2(产出用)…');
  const sfnt = await subsetFont(srcFont, text, { targetFormat: 'sfnt' });
  const woff2 = await subsetFont(srcFont, text, { targetFormat: 'woff2' });

  /* ---- 4. cmap 全覆盖校验 ---- */
  console.log('[4/5] opentype.js cmap 全覆盖校验…');
  const parsed = opentype.parse(sfnt.buffer.slice(sfnt.byteOffset, sfnt.byteOffset + sfnt.byteLength));
  /* opentype.js 2.0:charToGlyph 收字符串;缺字返回 .notdef(index 0) */
  const missing = chars.filter((c) => parsed.charToGlyph(c).index === 0);
  if (missing.length) {
    throw new Error('源字体缺字,禁止产出:' + missing.join(' ') + ' — 请更换文案或补 EXTRA 白名单');
  }
  console.log('      全覆盖 ✓(' + chars.length + '/' + chars.length + ')');

  /* ---- 5. 与上次 diff → 写出 ---- */
  let added = [];
  let removed = [];
  if (fs.existsSync(REC)) {
    try {
      const prev = JSON.parse(fs.readFileSync(REC, 'utf8')).chars || [];
      added = chars.filter((c) => !prev.includes(c));
      removed = prev.filter((c) => !chars.includes(c));
    } catch { /* 记录损坏按无对比处理 */ }
  }
  if (fs.existsSync(OUT_WOFF2)) {
    await fs.promises.copyFile(OUT_WOFF2, path.join(CACHE_DIR, 'ae-bishu.prev.woff2'));
  }
  await fs.promises.writeFile(OUT_WOFF2, woff2);
  await fs.promises.writeFile(REC, JSON.stringify({ date: new Date().toISOString(), chars }, null, 1));

  console.log('[5/5] 已写出 ' + path.relative(ROOT, OUT_WOFF2) +
    '(' + (woff2.length / 1024).toFixed(1) + 'KB / ' + chars.length + ' 字)');
  if (added.length) console.log('      新增字:' + added.join(' '));
  if (removed.length) console.log('      移除字:' + removed.join(' '));
  console.log('完成。build 后 dist 内字体随 vite 指纹更新。');
}

main().catch((e) => {
  console.error('ae-subset 失败:' + (e && e.message ? e.message : e));
  process.exit(1);
});
