/* 截图基线与比对(第三阶段退役门)
 *
 * 用法:
 *   node tools/_shot.cjs baseline   —— 以当前 dist 拍摄基线(第三阶段开工前拍一次)
 *   node tools/_shot.cjs check      —— 以当前 dist 拍摄并与基线比对,输出每视角差异率
 *
 * 确定性保障:拦截瓦片请求(地图底图为外部服务,像素逐次不同);
 * motion=0;固定视口与等待。像素级容差:16px 网格均值灰度,差异率超过阈值(3%)FAIL。
 */
const { chromium } = require('playwright');
const { PNG } = require('pngjs');
const fs = require('fs');
const path = require('path');

const DIST = path.resolve(__dirname, '..', 'dist', 'index.html');
const SHOTS = path.resolve(__dirname, '..', '..', 'zou_backend', '记录', 'vue3-phase3') + path.sep;
const MODE = process.argv[2] || 'check';
/* 高德/OSM 瓦片与统计外链:拦截以保证确定性 */
const BLOCK = /webrd0\d|tile\.openstreetmap|api\.tianditu|hm\.baidu/;

const VIEWS = [
  { key: 'api-top', url: 'http://127.0.0.1:8000/' },
  { key: 'api-stat', url: 'http://127.0.0.1:8000/#statBand' },
  { key: 'api-macro', url: 'http://127.0.0.1:8000/#sceneMacro' },
  { key: 'api-micro', url: 'http://127.0.0.1:8000/#sceneMicro' },
  { key: 'static-top', url: 'http://127.0.0.1:8000/?static=1' },
  { key: 'file-top', url: 'file:///' + DIST.replace(/\\/g, '/') },
];

async function capture() {
  const b = await chromium.launch({ channel: 'msedge' });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  await p.route(BLOCK, r => r.abort());
  const shots = {};
  for (const v of VIEWS) {
    const errs = [];
    p.on('pageerror', e => errs.push(String(e.message).slice(0, 80)));
    await p.goto(v.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await p.waitForTimeout(7000);
    shots[v.key] = await p.screenshot({ fullPage: false });
    if (errs.length) shots[v.key + '__errors'] = Buffer.from(errs.join('|'));
    await p.evaluate(() => window.scrollTo(0, 0));
  }
  await b.close();
  return shots;
}

/* 16px 网格灰度均值差异率 */
function diffRate(bufA, bufB) {
  const a = PNG.sync.read(bufA), b = PNG.sync.read(bufB);
  if (a.width !== b.width || a.height !== b.height) return 1;
  const G = 16;
  let diff = 0, total = 0;
  const gray = (d, x, y) => {
    const i = (y * a.width + x) * 4;
    return (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114);
  };
  for (let gy = 0; gy < a.height; gy += G) {
    for (let gx = 0; gx < a.width; gx += G) {
      let sa = 0, sb = 0, n = 0;
      for (let y = gy; y < Math.min(gy + G, a.height); y += 4)
        for (let x = gx; x < Math.min(gx + G, a.width); x += 4) { sa += gray(a.data, x, y); sb += gray(b.data, x, y); n++; }
      if (n === 0) continue;
      total++;
      if (Math.abs(sa - sb) / n > 24) diff++;   /* 单格均值差 >24/255 视为实质差异 */
    }
  }
  return total ? diff / total : 1;
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const shots = await capture();
  if (MODE === 'baseline') {
    for (const [k, buf] of Object.entries(shots)) fs.writeFileSync(SHOTS + 'base_' + k + '.png', buf);
    console.log('[shot] 基线已写入 ' + SHOTS);
    return;
  }
  let worst = 0, fail = false;
  for (const v of VIEWS) {
    const base = SHOTS + 'base_' + v.key + '.png';
    const cur = shots[v.key];
    const curErr = shots[v.key + '__errors'];
    if (curErr && curErr.length) { console.log('FAIL [shot:' + v.key + '] 页面报错: ' + curErr.toString().slice(0, 120)); fail = true; continue; }
    if (!fs.existsSync(base)) { console.log('FAIL [shot:' + v.key + '] 基线缺失 ' + base); fail = true; continue; }
    const rate = diffRate(fs.readFileSync(base), cur);
    fs.writeFileSync(SHOTS + 'cur_' + v.key + '.png', cur);
    const okv = rate <= 0.03;
    if (!okv) fail = true;
    worst = Math.max(worst, rate);
    console.log((okv ? 'PASS ' : 'FAIL ') + `[shot:${v.key}] 网格差异率 ${(rate * 100).toFixed(2)}%`);
  }
  console.log(fail ? 'SHOT RESULT: FAIL' : 'SHOT RESULT: PASS (worst ' + (worst * 100).toFixed(2) + '%)');
  if (fail) process.exit(1);
})().catch(e => { console.error('ABORT ' + e.message); process.exit(1); });
