/* ============================================================
 * jiangshan-hist —— 「江山时序」历史底图接入(v2:官方导出完整快照)
 * ============================================================
 * v1 教训(本文件重写原因):data/atlas/*.geojson 是「可编辑源快照」,
 * 运行时疆域由 190 个增量快照合成——单取源快照只拿到增量片段
 * (tang 快照里没有唐本体、weijin 只有北方政权),且 until 语义错位
 * (前200 年图层混入前 127 年才设立的河西四郡与刺史部)。
 *
 * v2 正解:跑 jiangshan-map 官方导出 `node scripts/export_geojson.js`
 * (README「GeoJSON 导出」节),得到 geojson/snapshots/<id>.geojson——
 * **每个疆域阶段一份完整合成快照**(RFC 7946,要素含 layer:
 * polity 政权/region 一级政区/prefecture 州郡、title、tint、category),
 * geojson/index.json 的 dynasties[].phases[] 带 from/to 真实年份区间。
 * 选择:from <= 目标年 <= to 的 phase。
 *
 * 许可:GPL-3.0(jiangshan-map);prefecture 层源自 CHGIS V6/Hartwell,
 * 原条款学术非商业——本项目课程大作业(学术)适用,引用注明
 * 「江山时序 Jiangshan Atlas」+ 上游来源(已在数据头与 popup 注明)。
 * 运行:node tools/jiangshan-hist.mjs <jiangshan-map仓库路径>
 * ============================================================ */
import fs from 'node:fs';
import path from 'node:path';

const REPO = process.argv[2];
const GEO = path.join(REPO, 'geojson');
if (!REPO || !fs.existsSync(path.join(GEO, 'index.json'))) {
  console.error('用法:先在 jiangshan-map 仓库跑 node scripts/export_geojson.js,再执行\n' +
    '  node tools/jiangshan-hist.mjs <jiangshan-map仓库路径>');
  process.exit(1);
}

const idx = JSON.parse(fs.readFileSync(path.join(GEO, 'index.json'), 'utf8'));

/* 网页时间轴阶段 → 目标年份 → 朝代候选(与 STAGE_HIST 语义对齐) */
const TARGETS = [
  { key: 'qinhan_bc200', year: -200, dyn: ['qin', 'xihan'] },
  { key: 'weijin_400', year: 400, dyn: ['dongjin', 'nanbei'] },
  { key: 'tang800', year: 800, dyn: ['tang'] },
  { key: 'ming1530', year: 1530, dyn: ['ming'] },
  { key: '1911', year: 1911, dyn: ['qing'] },
];

function pickPhase(year, dynKeys) {
  for (const k of dynKeys) {
    const d = idx.dynasties.find((x) => x.key === k);
    if (!d) continue;
    for (const ph of d.phases) {
      if (ph.from <= year && year <= ph.to) return { ph, dyn: d };
    }
  }
  return null;
}

const OUT = {};
const SRC_NOTE = '江山时序 Jiangshan Atlas(参考谭其骧图集/CHGIS/Hartwell 简化示意,GPL-3.0/学术条款)';
/* 时代错置过滤(核验实测:s_xihan_a 区间标注 -202—-128,但州郡层混入
 * 河西四郡[前 121—111 年间陆续设立]与十二刺史部[前 106 年设立]——
 * 对「前 200 年」构成时代错置,依《汉书·地理志》剔除。名称含匹配即剔除。) */
const EXCLUDE = {
  qinhan_bc200: ['武威', '张掖', '酒泉', '敦煌', '司隶', '豫州', '冀州', '兖州', '徐州', '青州', '荆州', '扬州', '益州', '凉州', '并州', '幽州'],
};
for (const t of TARGETS) {
  const hit = pickPhase(t.year, t.dyn);
  if (!hit) { console.error('未找到覆盖 ' + t.year + ' 的阶段(' + t.key + ')'); process.exit(1); }
  const file = path.join(GEO, hit.ph.file);
  const fc = JSON.parse(fs.readFileSync(file, 'utf8'));
  const ex = EXCLUDE[t.key] || [];
  const kept = fc.features.filter((f) => {
    const title = (f.properties && f.properties.title) || '';
    return !ex.some((w) => title.includes(w));
  });
  const dropped = fc.features.length - kept.length;
  const out = {
    type: 'FeatureCollection',
    features: kept.map((f) => ({
      type: 'Feature',
      geometry: f.geometry,
      properties: {
        name: (f.properties && f.properties.title) || hit.dyn.title,
        layer: (f.properties && f.properties.layer) || 'polity',
        year: t.year,
        tint: (f.properties && f.properties.tint) || '',
        src: SRC_NOTE,
      },
    })),
  };
  OUT[t.key] = out;
  const kb = Math.round(JSON.stringify(out).length / 1024);
  const layers = {};
  for (const f of out.features) layers[f.properties.layer] = (layers[f.properties.layer] || 0) + 1;
  console.log(t.key + ' ← ' + hit.dyn.title + '/' + hit.ph.snapshot + '(' + hit.ph.from + '—' + hit.ph.to + ')  ' +
    out.features.length + ' 面 / ' + kb + 'KB  layer=' + JSON.stringify(layers) +
    (dropped ? '  [时代过滤剔除 ' + dropped + ' 面]' : ''));
}

const body = '/* 历史年代底图——源自「江山时序 Jiangshan Atlas」(github.com/DeanChensj/jiangshan-map,GPL-3.0)\n' +
  ' * 由官方导出 scripts/export_geojson.js 的**完整合成快照**生成(每阶段含政权/一级政区/州郡三层)。\n' +
  ' * 生成器:tools/jiangshan-hist.mjs。引用须注明「江山时序」与上游\n' +
  ' * (谭其骧图集/CHGIS/Hartwell;prefecture 层原条款学术非商业)。近似边界示意,非测绘成果。 */\n' +
  'window.HIST_LAYERS = window.HIST_LAYERS || {};\n' +
  Object.entries(OUT).map(([k, v]) => 'window.HIST_LAYERS[' + JSON.stringify(k) + '] = ' + JSON.stringify(v) + ';').join('\n') + '\n';
fs.writeFileSync(new URL('../public/data/hist_jiangshan.js', import.meta.url), body);
console.log('已写出 public/data/hist_jiangshan.js(' + Math.round(body.length / 1024) + 'KB)');
