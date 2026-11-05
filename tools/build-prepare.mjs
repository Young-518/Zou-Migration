/* build-prepare.mjs —— 从原站点生成 Vite 工程源文件(可重复运行,勿手改产物)
 *
 * 1) src/legacy-bundle.ts   9 个逻辑模块按原执行顺序合并进单一函数作用域
 * 2) src/static-migr.ts     js/data.js → export const MIGR_STATIC
 * 3) src/static-poems.ts    js/poems.js → export const POEMS_STATIC
 * 4) index.html             原站 index.html;boot.js 标签 → 模块入口;body 顶层与 main.wrap
 *                           直属章节节点按 parse5 源码偏移做**字节级无损拆分**到 sections/*.html,
 *                           原位以 <!--#include --> 指示;自检「重组 === 原文」不通过即拒绝生成。
 */
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'parse5';
import { transformSync as esbuildTransform } from 'esbuild';

const F = path.resolve(import.meta.dirname, '..');
const read = p => fs.readFileSync(p, 'utf8');
const must = (cond, msg) => { if (!cond) throw new Error('生成失败:' + msg); };

/* 原站目录候选:开发布局(zou_frontend 平级的 zou_webgis)与交付包布局(5-原站基准/zou_webgis)。
 * 审计修复:此前写死 `../../zou_webgis`,交付包内 npm install(触发本脚本)会直接失败。 */
const SITE_CANDIDATES = [
  path.resolve(import.meta.dirname, '..', '..', 'zou_webgis'),                      // 开发布局:工作区根/zou_webgis
  path.resolve(import.meta.dirname, '..', '..', '..', '5-原站基准', 'zou_webgis'),  // 交付包:zou_submission/5-原站基准/
  path.resolve(import.meta.dirname, '..', '..', '..', 'zou_webgis'),                // 兜底:交付包根
];
const SITE = SITE_CANDIDATES.find(p => fs.existsSync(path.join(p, 'index.html')));
must(SITE, '找不到原站 zou_webgis(候选:../zou_webgis 与 ../../../5-原站基准/zou_webgis 均不存在)');

/* ---------- 1) legacy bundle(第三阶段起:退役模块由 legacy-ports 注入) ----------
 * 退役 = 生成器用 esbuild 把 src/legacy-ports/<name>.ts 编译成 JS,替换 bundle 中原模块体——
 * 注入位置与原模块相同,保持"同一函数作用域"的共享语义;未退役模块原样并入。 */
/* ---------- 1) legacy bundle(第三阶段终点:九模块全部退役,不再生成) ----------
 * 原 9 个模块已全部移出:src/legacy-ports/(migration-data, migration-charts, app)
 * 与 src/composables/(motion, scroll-reel, typo-motion, v31, poem-ui, scroll-story),
 * 由 src/main.ts 按(原)模块序编排。order 保留为空表以记录历史顺序。 */
const order = [];
/* 已退役(实现见 src/composables/,由 main.ts 编排):motion, scroll-reel, typo-motion, v31, poem-ui, scroll-story */
const PORTS = {
  'migration-data.js': path.join(F, 'src', 'legacy-ports', 'migration-data.ts'),
  'migration-charts.js': path.join(F, 'src', 'legacy-ports', 'migration-charts.ts'),
};
/* 缝合线:退役模块需要的 Vue 侧能力,以 import 注入 legacy-bundle.ts 顶部;
 * 注入脚本在同一函数作用域内以裸标识符引用(闭包可见)。 */
const PORT_IMPORTS = {
  'migration-charts.js':
    "import { getOrInitChart, registerChartMap, setChartsEffect, resizeAll, prefersReducedMotion } from './composables/useECharts';",
};
function portBody(tsFile, origName) {
  const ts = read(tsFile);
  must(!/^\s*(import|export)\s/m.test(ts), `移植文件 ${origName} 不得使用 import/export(经缝合线引用 Vue 侧能力)`);
  const out = esbuildTransform(ts, { loader: 'ts' }).code;
  return `\n/* ========== js/${origName} —— 已退役:实现移植于 ${path.relative(F, tsFile)}`
       + `(esbuild 构建期注入,作用域等价) ========== */\n` + out;
}
const bodies = order
  .map(f => {
    const header = `\n/* ========== js/${f} ========== */\n`;
    if (PORTS[f]) return header + portBody(PORTS[f], f);
    return header + `/* (原样并入,与原站共享同一全局作用域语义) */\n` + read(path.join(SITE, 'js', f));
  })
  .join('\n');
/* 缝合线汇总:被退役模块引用的 Vue 侧 import(去重后置于 @ts-nocheck 之后——
 * 注意 @ts-nocheck 必须是文件第一条语句级内容,否则 vue-tsc 会检查整个 bundle) */
const seamImports = [...new Set(order.map(f => PORT_IMPORTS[f]).filter(Boolean))];
/* 第三阶段终点:order 为空 = 九模块全部退役,不再生成 legacy-bundle.ts;
 * 清理历史遗留文件,避免误 import 一个空的 runLegacy。 */
const BUNDLE = path.join(F, 'src', 'legacy-bundle.ts');
if (order.length) {
  fs.writeFileSync(BUNDLE,
`// @ts-nocheck
${seamImports.join('\n')}
/* 自动生成:node tools/build-prepare.mjs —— 不要手改本文件;改原站 js/ 后重新生成。
 * 模块在原站点按 <script> 顺序共享全局作用域;此处并入单一函数作用域,
 * 由 src/main.ts 在数据就绪后调用 runLegacy(),执行顺序与原站一致。
 * 第三阶段:已退役模块由 legacy-ports 注入,Vue 侧能力经 import 缝合线进入同一函数作用域。 */
export function runLegacy(): void {
${bodies}
}
`);
} else if (fs.existsSync(BUNDLE)) {
  fs.rmSync(BUNDLE);
  console.log('[prepare] legacy-bundle.ts 已退役移除(九模块全部移植完毕)');
}

/* ---------- 2) static-migr.ts ---------- */
const migrSrc = read(path.join(SITE, 'js/data.js'));
must(migrSrc.includes('window.MIGR = (function () {'), 'data.js 包装行不匹配');
fs.writeFileSync(path.join(F, 'src/static-migr.ts'),
`// @ts-nocheck
/* 自动生成:js/data.js → 静态数据模块(函数 dist/chainLength 保留在对象内) */
` + migrSrc.replace('window.MIGR = (function () {', 'export const MIGR_STATIC = (function () {'));

/* ---------- 3) static-poems.ts ---------- */
const poemsSrc = read(path.join(SITE, 'js/poems.js'));
must(poemsSrc.includes('window.ZOU_POEMS = {'), 'poems.js 包装行不匹配');
fs.writeFileSync(path.join(F, 'src/static-poems.ts'),
`// @ts-nocheck
/* 自动生成:js/poems.js → 静态诗文数据模块 */
` + poemsSrc.replace('window.ZOU_POEMS = {', 'export const POEMS_STATIC = {'));

/* ---------- 4) index.html:模块入口 + 字节级无损分章拆分 ---------- */
const originalHtml = read(path.join(SITE, 'index.html'));
must(originalHtml.includes('<script src="js/boot.js"></script>'), 'boot.js 标签不匹配');

const doc = parse(originalHtml, { sourceCodeLocationInfo: true });
const htmlEl = doc.childNodes.find(n => n.tagName === 'html');
const body = htmlEl.childNodes.find(n => n.tagName === 'body');
must(!!body, 'parse5 未找到 body');

const idFile = {
  veil: '01-veil', heroBoard: '02-hero', manifesto: '03-manifesto',
  secOrigin: '10-origin', sceneHeat: '11-heat', statBand: '13-stat',
  secAtlas: '14-atlas', sceneMacro: '15-macro', sceneChain: '16-chain',
  sceneMicro: '17-micro', bajingPlates: '18-bajing', textScroll: '19-text',
  poemScroll: '20-poems', toolPanel: '21-tools', zibeiSection: '22-zibei',
  spacetime: '23-spacetime', references: '24-references', colophon: '30-footer',
};
const classFile = { 'bridge-band': '12-bridge', 'bottom-panels': '25-panels' };
const fragments = [];   /* {file, start, end} */
let extraSeq = 0;

function groupKeyOf(el, withinMain) {
  const attrs = el.attrs || [];
  const id = attrs.find(a => a.name === 'id')?.value;
  if (id && idFile[id]) return idFile[id];
  const cls = attrs.find(a => a.name === 'class')?.value || '';
  for (const c of cls.split(/\s+/)) if (classFile[c]) return classFile[c];
  if (withinMain) return `26-extra-${String(++extraSeq).padStart(2, '0')}`;
  return null;
}

const mainWrap = body.childNodes.find(n => n.tagName === 'main');
must(!!mainWrap, 'parse5 未找到 main.wrap');

/* body 顶层元素(除 main 外) */
for (const n of body.childNodes) {
  if (n.tagName !== 'section' && n.tagName !== 'div' && n.tagName !== 'footer') continue;
  if (n === mainWrap) continue;
  const key = groupKeyOf(n, false);
  if (!key || !n.sourceCodeLocation) continue;
  fragments.push({ file: `sections/${key}.html`,
    start: n.sourceCodeLocation.startOffset, end: n.sourceCodeLocation.endOffset });
}
/* main.wrap 的直属子元素(章节)全部入文件 */
let mainMatched = 0;
for (const n of mainWrap.childNodes) {
  if (n.tagName === undefined) continue;            /* 空白文本留在壳内 */
  if (!n.sourceCodeLocation) continue;
  const key = groupKeyOf(n, true);
  if (!key) continue;
  fragments.push({ file: `sections/${key}.html`,
    start: n.sourceCodeLocation.startOffset, end: n.sourceCodeLocation.endOffset });
  mainMatched++;
}
fragments.sort((a, b) => a.start - b.start);

/* 生成壳:原位替换为 include 指示(必须按偏移降序替换,避免前移影响后续片段) */
const desc = [...fragments].sort((a, b) => b.start - a.start);
let shell = originalHtml;
for (const fr of desc) {
  const tag = `<!--#include file="${fr.file}" -->`;
  shell = shell.slice(0, fr.start) + tag + shell.slice(fr.end);
}

/* 自检:重组必须与原文逐字节相等 */
let reassembled = shell;
for (const fr of fragments) {
  reassembled = reassembled.replace(`<!--#include file="${fr.file}" -->`,
                                    originalHtml.slice(fr.start, fr.end));
}
must(reassembled === originalHtml,
     `拆分重组自检失败(${fragments.length} 片段)——拒绝生成`);

fs.mkdirSync(path.join(F, 'sections'), { recursive: true });
for (const fr of fragments) {
  fs.writeFileSync(path.join(F, fr.file), originalHtml.slice(fr.start, fr.end));
}
must(mainMatched >= 17, `main.wrap 直属章节匹配数异常:${mainMatched}`);

/* ---------- 2.5) 交互岛抽取(Vue 化第二阶段:渲染权移交) ----------
 * 岛屿 = 分章内「外壳保留、内容抽走」的元素:内容**原字节**写入 src/islands/<name>.island.html,
 * 由 vite 的 islandCompile 插件编译成 Vue render 函数,main.ts 在 runLegacy() 之前
 * mountIslands() 渲染回外壳——DOM 与原字节等价,legacy 照常按 id 绑定行为。
 * 抽取本身不破坏重组自检:自检在上方已对未编辑片段完成,此处只编辑单个分章文件并做局部校验。 */
const ISLANDS = [
  { name: 'heat-timeline', rootId: 'sceneHeat',
    pick: el => el.tagName === 'div' &&
      (el.attrs || []).some(a => a.name === 'class' && a.value.split(/\s+/).includes('timeline')) },
  /* 2b:诗卷抽屉骨架(#poemDrawer 本身即岛屿;hidden 属性留在壳上由 legacy 开合) */
  { name: 'poem-drawer', rootId: 'poemDrawer', pick: () => true },
];

function walkNode(node, fn) {
  if (fn(node)) return node;
  for (const c of node.childNodes || []) {
    const r = walkNode(c, fn);
    if (r) return r;
  }
  return null;
}
fs.mkdirSync(path.join(F, 'src', 'islands'), { recursive: true });

for (const spec of ISLANDS) {
  const rootEl = walkNode(doc, n => n.tagName && (n.attrs || []).some(a => a.name === 'id' && a.value === spec.rootId));
  must(rootEl, `岛屿 ${spec.name}: 根节点 #${spec.rootId} 未找到`);
  const el = walkNode(rootEl, spec.pick);
  must(el && el.sourceCodeLocation && el.sourceCodeLocation.endTag,
       `岛屿 ${spec.name}: 定位失败或非常规闭合标签`);
  const loc = el.sourceCodeLocation;
  const innerStart = loc.startTag.endOffset;
  const innerEnd = loc.endTag.startOffset;
  const inner = originalHtml.slice(innerStart, innerEnd);
  must(inner.trim().length > 0, `岛屿 ${spec.name}: 内容为空`);
  const host = fragments.find(f => innerStart >= f.start && loc.endTag.endOffset <= f.end);
  must(host, `岛屿 ${spec.name}: 跨分章或未落入任何分章(不支持)`);

  fs.writeFileSync(path.join(F, 'src', 'islands', `${spec.name}.island.html`), inner);

  /* 编辑该分章文件:startTag '>' 前插 data-vue-island,内容区间清空 */
  const fragPath = path.join(F, host.file);
  const fragText = read(fragPath);
  const attrPos = loc.startTag.endOffset - 1 - host.start;   /* startTag 的 '>' 位置 */
  const inA = innerStart - host.start;
  const inB = innerEnd - host.start;
  must(fragText[attrPos] === '>', `岛屿 ${spec.name}: startTag 定位异常(${JSON.stringify(fragText[attrPos])})`);
  const attrText = ` data-vue-island="${spec.name}"`;
  const edited = fragText.slice(0, attrPos) + attrText + fragText.slice(attrPos, inA) + fragText.slice(inB);
  fs.writeFileSync(fragPath, edited);

  /* 局部校验:外壳带标记、内容不再出现在分章里、按位复原后与原分章逐字节相等(可逆性) */
  const back = read(fragPath);
  must(back.includes(attrText), `岛屿 ${spec.name}: 外壳标记写入失败`);
  must(!back.includes(inner), `岛屿 ${spec.name}: 内容未抽净`);
  const restored = back.slice(0, attrPos) + back.slice(attrPos + attrText.length, inA + attrText.length)
                 + inner + back.slice(inA + attrText.length);
  must(restored === fragText, `岛屿 ${spec.name}: 可逆性校验失败(拒绝生成)`);
  console.log(`[prepare] 岛屿 ${spec.name}: ${inner.length}B 内容抽至 src/islands/,外壳已标记(${host.file})`);
}

/* ---------- 2.6) 壳内宿主岛屿(不在任何分章里,如 body 顶层的暂存容器) ----------
 * 分章替换后 shell 里仍是原始标记,重新解析 shell 定位、同样"外壳保留+内容抽出"。
 * 注意:legacy 会把 #layerStaging 里的开关搬进地图「图层管理」盒(app.js addBox),
 * 因此该岛的等价门为 relocated 型(见 _verify_dist.cjs)。 */
const SHELL_ISLANDS = [
  { name: 'layer-panel', rootId: 'layerStaging', pick: () => true },
];
for (const spec of SHELL_ISLANDS) {
  const shellDoc = parse(shell, { sourceCodeLocationInfo: true });
  const rootEl = walkNode(shellDoc, n => n.tagName && (n.attrs || []).some(a => a.name === 'id' && a.value === spec.rootId));
  must(rootEl, `壳内岛屿 ${spec.name}: #${spec.rootId} 未找到`);
  const el = walkNode(rootEl, spec.pick);
  must(el && el.sourceCodeLocation && el.sourceCodeLocation.endTag, `壳内岛屿 ${spec.name}: 定位失败`);
  const loc = el.sourceCodeLocation;
  const inA = loc.startTag.endOffset;
  const inB = loc.endTag.startOffset;
  const inner = shell.slice(inA, inB);
  must(inner.trim().length > 0, `壳内岛屿 ${spec.name}: 内容为空`);
  fs.writeFileSync(path.join(F, 'src', 'islands', `${spec.name}.island.html`), inner);
  const attrPos = loc.startTag.endOffset - 1;
  must(shell[attrPos] === '>', `壳内岛屿 ${spec.name}: startTag 定位异常`);
  const attrText = ` data-vue-island="${spec.name}"`;
  const edited = shell.slice(0, attrPos) + attrText + shell.slice(attrPos, inA) + shell.slice(inB);
  const restored = edited.slice(0, attrPos) + edited.slice(attrPos + attrText.length, inA + attrText.length)
                 + inner + edited.slice(inA + attrText.length);
  must(restored === shell, `壳内岛屿 ${spec.name}: 可逆性校验失败(拒绝生成)`);
  shell = edited;
  console.log(`[prepare] 壳内岛屿 ${spec.name}: ${inner.length}B 内容抽至 src/islands/,外壳已标记`);
}

/* 模块入口:boot.js 标签替换 → Vue 3 挂载点 + 模块入口
 * (#app 是 Vue 应用的挂载容器,位于 body 末尾原 boot.js 处——
 *  不触碰任何既有章节节点,CSS 选择器与 legacy 查询完全不受影响) */
must(shell.includes('<script src="js/boot.js"></script>'), 'boot.js 标签不匹配');
shell = shell.replace('<script src="js/boot.js"></script>',
                      '<div id="app"></div>\n<script type="module" src="/src/main.ts"></script>');
fs.writeFileSync(path.join(F, 'index.html'), shell);

console.log(`[prepare] legacy-bundle / static-migr / static-poems 生成完毕;` +
            `index.html 拆分 ${fragments.length} 片段(main 直属 ${mainMatched}),重组自检通过`);
