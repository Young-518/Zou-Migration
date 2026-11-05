/* SFC 模块声明:让纯 tsc 的场合也能解析 .vue 导入(vue-tsc 原生支持,不依赖此文件) */
declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<Record<string, never>, Record<string, never>, unknown>;
  export default component;
}
