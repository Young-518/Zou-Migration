# zou_frontend —— 邹氏迁徙 WebGIS 前端(Vue 3 外壳 + Pinia 数据总线,v3.0)

> 由原单文件站点(`zou_webgis`,v3.6.6)经两步重构而来:Vite + TS 工程化(方案 B)→ **Vue 3 外壳重构(v3.0)**;
> **渲染结果与原站逐项平价**(三态 DOM 计数一致、打印页数一致,Vue 3 版复验 10/10 全绿)。
> 原站保留在 `../zou_webgis` 未动,可随时对比或回退。

## 架构(四层)

| 层 | 位置 | 说明 |
|---|---|---|
| **Vue 外壳层**(新,v3.0) | `src/main.ts` `src/App.vue` `src/stores/` `src/components/` `src/legacy/errors.ts` | `createApp` + Pinia 应用实例;启动编排(classic → 数据 → legacy → mount);`BootGuard` 启动守卫(出错才显示提示卡);`DataSourceBadge` 调试徽标(`?debug=1` 显示数据来源与规模计数,默认不渲染) |
| **数据总线**(Pinia) | `src/stores/data.ts` | 持有 data-layer 的加载结果(source/migr/poems/meta),向组件暴露响应式状态;取数语义不在此实现 |
| **classic 资产层**(零改动) | `public/css` `public/js/vendor` `public/data` `public/img` `public/fonts` | 原站 8 个 CSS、Leaflet/D3/ECharts UMD、4 个大地理数据文件按**原字节**镜像;`index.html` 中 CSS 链接原序保留 |
| **数据交换层**(TS) | `src/data-layer.ts` `src/contract.ts` `src/static-*.ts` | 对应原 boot.js:API 优先(`GET /api/v1/bootstrap`,补回 `dist/chainLength`)→ `?static=1`/file:// /失败 → 内联静态数据;协议守卫消除 file:// 噪声;数据契约 Stage/Place/Route/Lineage/MigrData… |
| **应用层**(legacy bundle) | `src/legacy-bundle.ts`(生成) | 原 9 个逻辑模块(migration-data→scroll-reel)按原执行顺序合并进单一函数作用域,由 `main.ts` 在数据就绪后调用 `runLegacy()` |

**关键语义(与已验收版本逐字一致)**:`main.ts` 顶层 await 推迟 DOMContentLoaded,与原"脚本在 body 末尾求值"时序对齐;vendor/数据以 `?raw` 构建期读入、运行期 `new Function` 按原 CHAIN 顺序执行(UMD `this` 绑 window);**Vue 挂载在 `runLegacy()` 之后**——legacy 初始化期间看不到任何 Vue 注入的 DOM,`#app` 挂载点位于 body 末尾原 boot.js 处,不触碰任何章节节点。

## Vue 化路线图(绞杀者模式)

- **第一阶段(已完成)**:应用外壳 Vue 化——createApp/Pinia/启动编排/启动守卫/调试徽标;legacy 保持原执行顺序,平价锁死;
- **第二阶段(已完成,2026-11-02)**:交互岛收编 ×3——**渲染权移交 Vue,行为权暂留 legacy**:
  - 生成器(`build-prepare.mjs`)把控制条**原字节**抽到 `src/islands/*.island.html`,外壳标记 `data-vue-island`;支持分章内宿主与生成壳内宿主两种;
  - vite 插件 `islandCompile`:`@vue/compiler-dom`(whitespace preserve)构建期编译成 render 函数,运行期零编译开销;
  - `mountIslands()` 在 `runLegacy()` **之前**渲染岛屿(legacy 按 id 绑定时 DOM 已就位);
  - 已收编:`heat-timeline`(时期控制条 317B)、`poem-drawer`(诗卷抽屉骨架 752B)、`layer-panel`(图层开关暂存区 807B,relocated 型——legacy 会把开关搬进地图图层盒);
  - 每批验收 = 三态 DOM 平价 + 打印 14 页 + **交互岛等价门**(规范化语义树与原字节比对,in-place/relocated 两型)+ 真实交互功能实证(详见 后端验证记录 §十一/§十二);
- **第三阶段(已完成,2026-11-02,前端 v3.1.0)**:legacy 九模块**全部退役**,`legacy-bundle.ts` 不再生成,`main.ts` 按(原)模块序编排 9 个 init。验收 = 构建链 + 19 项平价 + **截图基线比对**(`tools/_shot.cjs`,6 视角网格差异率 ≤3%,基线在 `zou_backend/记录/vue3-phase3/`)+ 交互功能实证:
  - **机制**:退役实现移入 `src/legacy-ports/<name>.ts`(migration-data/migration-charts/app;esbuild 构建期编译)或 `src/composables/<name>.ts`(motion/scroll-reel/typo-motion/v31/poem-ui/scroll-story);需要 classic 全局的经 `src/types/legacy-globals.d.ts` 声明桥;
  - 组合式函数落地:**useECharts**(getOrInitChart/registerChartMap/setChartsEffect/resizeAll)、**useLeafletMap**(四图创建工厂:mapHeat/mapMacro/mapChain/mapMicro)、useMotionReveal/useScrollReel/useTypoMotion/useBasemapSwitcher/usePoemUi/useScrollStory;
  - 逐 PR 实证:PR-1 数据整形 / PR-2 四图+芯片 / PR-6 底图 OSM 90 瓦片切换 / PR-7 诗卷开卷 / PR-9 时轴图例+检索「宜黄」+`__MIG_READY__`(详见 后端验证记录 §十三/§十四);
  - 说明:app/migration-charts/scroll-story 移植文件内部暂为原样移植(@ts-nocheck 标注),分解为地图组件 + Pinia 状态、逐步摘除豁免,属第四阶段。

第二阶段起每收编一个模块,用 `npm run verify` 做一次三态 DOM + 打印平价回归,计数不等于基线即拒绝合并。

## 命令

```bash
npm install            # 安装 vue/pinia + vite/vue-tsc/plugin-vue 等(devDeps 含 playwright,走系统 Edge 验证)
npm run dev            # 开发服务器 :5173,/api 自动代理到 FastAPI :8000(需先 start.bat)
npm run build          # 产出到 dist/:分章重组自检 → vue-tsc 严格类型门 → vite 打包(单文件 index.html + classic 资产镜像)
npm run verify         # Playwright 三态平价:DOM 计数 + 打印页数 + 零报错(需后端在 8001 或改脚本端口)
node tools/build-prepare.mjs   # 从 ../zou_webgis 重新生成 legacy-bundle/静态模块/index.html(改原站 js 后跑)
```

调试徽标:`http://…/?debug=1`(或 `#debug`)右下角显示 数据源 · API/静态快照 + 规模计数 + 版本。

## 交付与运行形态

- `dist/` 即可部署:**本地**由后端同源托管(backend/.env `ZOU_SITE_DIR` 已指向 dist,`start.bat` 起服即 API 态);
- **file:// 双击 dist/index.html**:离线静态数据已内联,完整可玩(零报错);
- **线上**:静态托管部署 dist,运行时自动回退静态(已实测)。

## 已验证(2026-11-02,Vue 3 版)

- 三态 DOM 平价:范阳 24 / ECharts 2 / Leaflet 标记 128 / 可交互路径 222 / h1 鄒氏遷徙 / 卷区 7 —— API/静态/file 三态全等,与方案 B 版一致;
- 三态零 JS 报错;打印页数 **14 页**(与方案 B 版 14=14 一致;`_verify_dist.cjs` 基线已同步订正为 14);
- `?debug=1` 徽标实测:API 态显示「43 地点 / 41 路线 / 16 诗 · v1.0.0」;静态态显示"内联静态快照";
- **审计加固(2026-11-02 下午)**:启动失败也必挂载守卫(负向测试实证:注入 throw 后错误卡正常出现);生成器兼容交付包布局(`npm install` 场景实测);`npm run verify` 端口自适应(8001→8000→无后端降级);
- dev 联调:后端不在时按设计回退静态快照(DOM 计数不变);
- 后端 `verify.ps1` 43/43 + 载荷比对 PASS(本轮未动后端)。

## 回退

- **回退到方案 B(Vite+TS)**:归档在 `../项目文档/前端Vite方案B备份-20261102.tar.gz`(解压后整目录拷回即可);
- **回退到原站**:`../zou_webgis` 完好未动:后端 `.env` 的 `ZOU_SITE_DIR` 改回原路径 + 线上重发布原目录。
