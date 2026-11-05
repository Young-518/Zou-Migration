/* ============================================================
 * kouzan-subset —— 书法字体子集管线(衡山原版为主 + MasaFont 补缺)
 * ============================================================
 * 字体事实(实测 cmap 校验):
 *   - 衡山毛筆行書原版(opentype.jp,青柳衡山挥毫,OFL/免费商用,JIS 字集):
 *     真书法字形;开场 62 字缺「埮黃」,全站标题字符缺 20 个简体专用字
 *     (邹图谱线录舆热链观诗辈时导览汉辽现桥统计);
 *   - MasaFont(max32002,衡山补字版,繁中 23,699 字)与之同源,全覆盖。
 * 策略:font stack 逐字回退 —— 'Kouzan 主集' 缺字自动落到 'MasaFont 补缺集',
 * 同源笔意,视觉无痕。
 * 产物(public/fonts/):
 *   ae-kouzan.woff2   开场 60 字(衡山)      ae-bishu2.woff2  开场补缺 2 字(MasaFont)
 *   head-kouzan.woff2 全站标题集(衡山覆盖)   head-masa.woff2  标题补缺(MasaFont)
 * 校验:sfnt 份逐字 cmap 断言,缺字即失败(与 ae-subset 同法)。
 * 运行:node tools/kouzan-subset.mjs <衡山TTF路径>
 * ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import subsetFont from 'subset-font';
import opentype from 'opentype.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const KOUZAN_TTF = process.argv[2];
if (!KOUZAN_TTF || !fs.existsSync(KOUZAN_TTF)) {
  console.error('用法:node tools/kouzan-subset.mjs <衡山行書TTF路径>');
  process.exit(1);
}
const CACHE = path.join(ROOT, 'tools/.fontcache');
const MASA_CACHE = path.join(CACHE, 'MasaFont-Regular.woff2');
const MASA_URL = 'https://cdn.jsdelivr.net/gh/max32002/masafont@master/webfont/MasaFont-Regular.woff2';
const XING_CACHE = path.join(CACHE, 'ZhiMangXing-Regular.ttf');
const XING_URL = 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/zhimangxing/ZhiMangXing-Regular.ttf';

/* ---- 1. 字符集提取 ---- */
function collect(dir, ext, set) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    const st = fs.statSync(p);
    if (st.isDirectory()) collect(p, ext, set);
    else if (f.endsWith(ext)) for (const ch of fs.readFileSync(p, 'utf8')) if (ch.codePointAt(0) > 0x7e) set.add(ch);
  }
}
const aeSet = new Set();                       /* 开场:BEATS 文案 */
{
  const src = fs.readFileSync(path.join(ROOT, 'src/composables/useOpeningAe.ts'), 'utf8');
  const lit = /'((?:[^'\\\n]|\\.)*)'/g;
  let m;
  while ((m = lit.exec(src)) !== null) for (const ch of m[1].replace(/\\(.)/g, '$1')) if (ch.codePointAt(0) > 0x7e) aeSet.add(ch);
}
const headSet = new Set(aeSet);                /* 标题集 ⊇ 开场集( stamps 等共用) */
collect(path.join(ROOT, 'sections'), '.html', headSet);
headSet.add('鄒');
for (const f of ['src/main.ts', 'src/maps/macro-layers.ts']) {
  for (const ch of fs.readFileSync(path.join(ROOT, f), 'utf8')) if (ch.codePointAt(0) > 0x7e) headSet.add(ch);
}
const AE = [...aeSet].sort();
const HEAD = [...headSet].sort();
console.log('[1/5] 字符集:开场 ' + AE.length + ' 字 / 标题 ' + HEAD.length + ' 字');

/* ---- 2. 源字体 ---- */
fs.mkdirSync(CACHE, { recursive: true });
const kouzanBuf = fs.readFileSync(KOUZAN_TTF);
let masaBuf;
if (fs.existsSync(MASA_CACHE)) masaBuf = fs.readFileSync(MASA_CACHE);
else {
  console.log('[2/5] MasaFont 缓存未命中,jsdelivr 下载…');
  const res = await fetch(MASA_URL);
  if (!res.ok) throw new Error('MasaFont 下载失败 HTTP ' + res.status);
  masaBuf = Buffer.from(await res.arrayBuffer());
  await fs.promises.writeFile(MASA_CACHE, masaBuf);
}
const kouzan = opentype.parse(kouzanBuf.buffer.slice(kouzanBuf.byteOffset, kouzanBuf.byteOffset + kouzanBuf.byteLength));
let xingBuf;
if (fs.existsSync(XING_CACHE)) xingBuf = fs.readFileSync(XING_CACHE);
else {
  console.log('[2/5] 志莽行书缓存未命中,jsdelivr 下载…');
  const res = await fetch(XING_URL);
  if (!res.ok) throw new Error('志莽行书下载失败 HTTP ' + res.status);
  xingBuf = Buffer.from(await res.arrayBuffer());
  await fs.promises.writeFile(XING_CACHE, xingBuf);
}
const xing = opentype.parse(xingBuf.buffer.slice(xingBuf.byteOffset, xingBuf.byteOffset + xingBuf.byteLength));
const has = (font, ch) => font.charToGlyph(ch).index !== 0;

/* ---- 3. 拆分:衡山主 → 志莽(简体行书)补 → MasaFont 终补 ---- */
const aeKz = AE.filter((c) => has(kouzan, c));
const aeMs = AE.filter((c) => !has(kouzan, c));
const headKz = HEAD.filter((c) => has(kouzan, c));
const headRest = HEAD.filter((c) => !has(kouzan, c));
const headXg = headRest.filter((c) => has(xing, c));
const headMs = headRest.filter((c) => !has(xing, c));
console.log('[3/5] 衡山覆盖:开场 ' + aeKz.length + '/' + AE.length + ',标题 ' + headKz.length + '/' + HEAD.length +
  ';志莽补 ' + headXg.length + ' 字;MasaFont 终补:开场 ' + (aeMs.length ? aeMs.join(' ') : '无') + ',标题 ' + headMs.length + ' 字');

/* ---- 4. 子集 + 逐字校验 ---- */
async function make(fontBuf, chars, outFile, label) {
  if (!chars.length) { console.log('[4/5] ' + label + ':空集跳过'); return; }
  let text = chars.join('');
  const sfnt0 = await subsetFont(fontBuf, text, { targetFormat: 'sfnt' });
  const parsed0 = opentype.parse(sfnt0.buffer.slice(sfnt0.byteOffset, sfnt0.byteOffset + sfnt0.byteLength));
  /* 该源真正缺的字符:警告后从本子集剔除(由 font stack 尾部的 Noto Sans SC/系统字体兜底) */
  const sourceMissing = chars.filter((c) => parsed0.charToGlyph(c).index === 0);
  if (sourceMissing.length) {
    console.warn('[warn] ' + label + ' 源字体缺(交由兜底字体渲染):' + sourceMissing.join(' '));
    const drop = new Set(sourceMissing);
    chars = chars.filter((c) => !drop.has(c));
    if (!chars.length) { console.log('[4/5] ' + label + ':剔除后为空,跳过'); return; }
    text = chars.join('');
  }
  const sfnt = await subsetFont(fontBuf, text, { targetFormat: 'sfnt' });
  const woff2 = await subsetFont(fontBuf, text, { targetFormat: 'woff2' });
  const parsed = opentype.parse(sfnt.buffer.slice(sfnt.byteOffset, sfnt.byteOffset + sfnt.byteLength));
  const missing = chars.filter((c) => parsed.charToGlyph(c).index === 0);
  if (missing.length) throw new Error(label + ' 缺字:' + missing.join(' '));
  await fs.promises.writeFile(path.join(ROOT, 'public/fonts', outFile), woff2);
  console.log('[4/5] ' + label + ' → ' + outFile + '(' + (woff2.length / 1024).toFixed(1) + 'KB / ' + chars.length + ' 字) ✓');
}
await make(kouzanBuf, aeKz, 'ae-kouzan.woff2', '开场·衡山主集');
await make(masaBuf, aeMs, 'ae-bishu2.woff2', '开场·MasaFont 补缺');
await make(kouzanBuf, headKz, 'head-kouzan.woff2', '标题·衡山主集');
await make(xingBuf, headXg, 'head-xing.woff2', '标题·志莽行书补简体');
await make(masaBuf, headMs, 'head-masa.woff2', '标题·MasaFont 终补');

/* ---- 5. 许可说明 ---- */
fs.writeFileSync(path.join(ROOT, 'public/fonts/FONT-LICENSE.txt'),
  '网页用字字体许可(2026-11-04)\n' +
  '=============================================\n' +
  '1) ae-kouzan.woff2 / head-kouzan.woff2\n' +
  '   衡山毛筆フォント行書(Kouzan Mouhitu Gyosho)子集\n' +
  '   书法家青柳衡山挥毫,opentype.jp 发布,免费商用(含网页嵌入)。\n' +
  '   来源:https://opentype.jp/kouzanmouhitufont.htm\n' +
  '2) ae-bishu2.woff2 / head-masa.woff2\n' +
  '   正風毛筆字體 MasaFont 子集(衡山毛筆行書繁中補字版)\n' +
  '   max32002/masafont,SIL OFL 1.1,免费商用。\n' +
  '   来源:https://github.com/max32002/masafont\n' +
  '3) head-xing.woff2\n' +
  '   站酷志莽行书 Zhi Mang Xing 子集(简体行书)\n' +
  '   Google Fonts 收录,SIL OFL 1.1,免费商用。\n' +
  '   来源:https://fonts.google.com/specimen/Zhi+Mang+Xing\n' +
  '4) 子集生成:zou_frontend/tools/kouzan-subset.mjs(harfbuzzjs)\n');
console.log('[5/5] 完成。许可说明 → public/fonts/FONT-LICENSE.txt');
