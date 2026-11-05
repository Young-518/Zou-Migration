import { defineConfig, type PluginOption } from 'vite';
import vue from '@vitejs/plugin-vue';
import { compile } from '@vue/compiler-dom';
import { viteSingleFile } from 'vite-plugin-singlefile';
import fs from 'node:fs';
import path from 'node:path';

/* 交互岛编译:src/islands/*.island.html(分章内抽出的原字节)
 * → @vue/compiler-dom 编译成 render 函数(whitespace:'preserve' 保持原文空白)。
 * 构建期一次编译,运行期零编译开销;new Function 只在构建产物生成时执行一次。 */
function islandCompile(): PluginOption {
  return {
    name: 'island-compile',
    transform(_code, id) {
      if (!id.endsWith('.island.html?island')) return null;
      const file = id.slice(0, -'?island'.length);
      const src = fs.readFileSync(file, 'utf8');
      const { code: compiled } = compile(src, { whitespace: 'preserve', mode: 'function' });
      return {
        code: `import * as Vue from 'vue';\nexport default (new Function('Vue', ${JSON.stringify(compiled)}))(Vue);\n`,
        map: null,
      };
    },
  };
}

/* 分章装配:index.html 中的 <!--#include file="sections/xx.html" --> 在构建期原位展开。
 * 片段由 tools/build-prepare.mjs 按 parse5 源码偏移做字节级无损切片,重组自检逐字节相等。 */
function htmlPartials(): PluginOption {
  return {
    name: 'html-partials',
    transformIndexHtml(html) {
      const root = path.resolve(import.meta.dirname);
      return html.replace(/<!--#include file="([^"]+?)" -->/g, (_, f) =>
        fs.readFileSync(path.resolve(root, f), 'utf8'));
    },
  };
}

/* Vue 3 重构(第一阶段)要点:
 * - vue():SFC 编译(App.vue / components);Pinia 作为数据总线随应用层 bundle 内联;
 * - base './':产物全部相对路径,file:// 双击可开;
 * - viteSingleFile:应用层 bundle(Vue 外壳 + 数据交换层 + legacy-bundle)内联进 index.html——
 *   离线打开不需要 module 文件请求(规避 file:// 的 ES Module CORS 限制);
 * - vendor / 大地理数据 / 8 个 CSS 是 classic 资产(public/ 镜像,零改动),
 *   以原时序在 HTML 中以 classic 标签加载,先于模块 bundle 执行;
 * - dev 代理:/api → FastAPI(127.0.0.1:8000),前后端一体化联调。 */
export default defineConfig({
  base: './',
  plugins: [htmlPartials(), islandCompile(), vue(), viteSingleFile()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: { '/api': { target: 'http://127.0.0.1:8000', changeOrigin: true } },
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 4096,
  },
});
