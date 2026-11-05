/// <reference types="vite/client" />

declare module '*?raw' {
  const content: string;
  export default content;
}

/* 交互岛:*.island.html?island → 构建期编译为 Vue render 函数 */
declare module '*.island.html?island' {
  const render: (ctx?: unknown, cache?: unknown) => unknown;
  export default render;
}
