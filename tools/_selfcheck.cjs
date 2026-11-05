/* 改造探索·三宽度截图自检(taste-skill inspect 思路) */
const { chromium } = require('playwright');

(async () => {
  const base = 'http://127.0.0.1:4173/index.html';
  const out = 'D:/workbuddy_work/WorkBuddy/改造探索/自检截图';
  require('fs').mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true });

  async function shot(name, viewport, opts) {
    const ctx = await browser.newContext({ viewport, reducedMotion: opts.reduce ? 'reduce' : 'no-preference' });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
    page.on('console', (m) => {
      if (m.type() !== 'error') return;
      const loc = (m.location() && m.location().url) || '';
      if (/api\//.test(loc)) return;                     /* 后端探测噪音(preview 无后端,静态兜底为设计行为) */
      errs.push('CONSOLE: ' + m.text());
    });
    await page.goto(base, { waitUntil: 'load' });
    await page.waitForTimeout(opts.reduce ? 1200 : 1500);
    if (!opts.reduce) {
      /* 动效态:跳过开场印幕再验证后续章节 */
      const skip = page.locator('#veilSkip');
      if (await skip.count()) { await skip.click({ force: true }); await page.waitForTimeout(1400); }
    }
    if (opts.scrollTo) {
      await page.evaluate(([sel, block]) => {
        const el = document.querySelector(sel);
        if (el) el.scrollIntoView({ behavior: 'instant', block: block });
      }, [opts.scrollTo, opts.block || 'start']);
      await page.waitForTimeout(opts.wait || 1500);
      if (opts.scrollBy) {
        await page.evaluate((dy) => window.scrollBy(0, dy), opts.scrollBy);
        await page.waitForTimeout(opts.wait2 || 1200);
      }
    }
    await page.screenshot({ path: out + '/' + name + '.png' });
    if (errs.length) console.log('[' + name + '] 报错:\n  ' + errs.slice(0, 5).join('\n  '));
    else console.log('[' + name + '] 零报错 ✓');
    await ctx.close();
  }

  /* 降级静态态(reduced-motion) */
  await shot('01-journey-static-1440', { width: 1440, height: 900 }, { reduce: true, scrollTo: '#journey', block: 'start' });
  await shot('02-sf-static-1440', { width: 1440, height: 900 }, { reduce: true, scrollTo: '#starfield', block: 'start', wait: 2000 });
  /* 动效态:pin 中段(第 5 站埮坪附近) */
  await shot('03-journey-mid-1440', { width: 1440, height: 900 }, { reduce: false, scrollTo: '#journey', block: 'start', scrollBy: 2000, wait: 1600 });
  /* 动效态:星图入幕(星轨半亮) */
  await shot('04-sf-live-1440', { width: 1440, height: 900 }, { reduce: false, scrollTo: '#starfield', block: 'center', wait: 2200 });
  /* 移动端降级 */
  await shot('05-journey-static-390', { width: 390, height: 844 }, { reduce: true, scrollTo: '#journey', block: 'start', wait: 2000 });
  await shot('06-sf-live-390', { width: 390, height: 844 }, { reduce: false, scrollTo: '#starfield', block: 'center', wait: 2200 });

  /* ===== 四期自检:书法字体 + 江山时序底图 ===== */
  const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p2 = await ctx2.newPage();
  const errs2 = [];
  p2.on('pageerror', (e) => errs2.push('PAGEERROR: ' + e.message));
  p2.on('response', (r) => { if (r.status() >= 400 && !/api\//.test(r.url())) errs2.push('HTTP' + r.status() + ': ' + r.url()); });
  await p2.goto(base, { waitUntil: 'load' });
  await p2.waitForTimeout(1400);
  /* 07 开场印幕书法字体(不跳过,截第一拍「范陽」墨书) */
  await p2.screenshot({ path: out + '/07-opening-kouzan-1440.png' });
  const skip2 = p2.locator('#veilSkip');
  if (await skip2.count()) { await skip2.click({ force: true }); await p2.waitForTimeout(1300); }
  /* 08 卷首书法标题(reel h1「鄒氏遷徙」) */
  await p2.evaluate(() => { const el = document.querySelector('.reel-title') || document.getElementById('manifesto'); if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' }); });
  await p2.waitForTimeout(700);
  await p2.screenshot({ path: out + '/08-reel-cal-1440.png' });
  /* 09 江山时序底图:先滚到宏观图(滚动叙事自然推进),再勾选历史政区+强制阶段 4 */
  await p2.evaluate(() => { const el = document.getElementById('secMacroHead') || document.querySelector('#mapMacro, .map-wrap'); if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' }); });
  await p2.waitForTimeout(1500);
  await p2.evaluate(() => {
    const chk = document.getElementById('chkHist');
    if (chk) { chk.checked = true; chk.dispatchEvent(new Event('change', { bubbles: true })); }
    const stage = document.getElementById('stageRange');
    if (stage) { stage.value = '4'; stage.dispatchEvent(new Event('input', { bubbles: true })); }
  });
  await p2.waitForTimeout(1200);
  await p2.screenshot({ path: out + '/09-hist-tang-1440.png' });
  const histState = await p2.evaluate(() => document.getElementById('histStatus') ? document.getElementById('histStatus').textContent : '无状态条');
  console.log('[hist 状态条] ' + histState);
  /* 10 迁路长卷章标书法体 */
  await p2.evaluate(() => document.getElementById('journey').scrollIntoView({ behavior: 'instant', block: 'start' }));
  await p2.waitForTimeout(900);
  await p2.screenshot({ path: out + '/10-journey-cal-1440.png' });
  /* 11 墨晕层(保留项复验) */
  for (let i = 0; i < 20; i++) {
    await p2.mouse.move(220 + i * 42, 320 + Math.sin(i / 3) * 150);
    await p2.waitForTimeout(16);
  }
  await p2.screenshot({ path: out + '/11-inkflow-1440.png' });
  /* 字体加载断言:document.fonts 检查五份子集 */
  const fontsOk = await p2.evaluate(async () => {
    await document.fonts.ready;
    const names = ['AE Kouzan', 'AE BiShu', 'Cal Kouzan', 'Cal Xing', 'Cal Masa'];
    return names.map((n) => n + '=' + document.fonts.check('16px "' + n + '"')).join(' ');
  });
  console.log('[字体加载] ' + fontsOk);
  console.log(errs2.length ? '[四期] 报错:\n  ' + errs2.slice(0, 5).join('\n  ') : '[四期 07-11] 零报错 ✓');
  await ctx2.close();

  await browser.close();
  console.log('DONE');
})().catch((e) => { console.error('FAIL:', e.message); process.exit(1); });
