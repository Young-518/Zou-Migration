<script setup lang="ts">
/* 应用根组件 —— Vue 3 重构(第一阶段「外壳 + 数据总线」)。
 *
 * 本页是内容为主体的数字人文长卷:章节 DOM、地图/图表/卷轴等交互由 legacy-bundle
 * (原站九个逻辑模块)负责,并已与原站做过逐项平价验收。因此本阶段的策略是
 * 「绞杀者模式」:Vue 3 接管应用外壳(应用实例、Pinia 数据总线、启动编排、
 * 调试徽标、启动守卫),legacy 保持原执行顺序与原 DOM 不动,后续再按模块
 * 逐个收编(见 README 的 Vue 化路线图)。
 *
 * 挂载时机由 main.ts 控制:runLegacy() 执行完才 mount('#app')——
 * Vue 的 DOM 增量发生在 legacy 初始化之后,默认渲染零视觉差异。 */
import DataSourceBadge from './components/DataSourceBadge.vue';
import BootGuard from './components/BootGuard.vue';

/* 调试徽标仅 ?debug=1 打开;#debug 亦支持(便于 file:// 下使用) */
const debug = /[?&]debug=1\b/.test(location.search) || /#debug\b/.test(location.hash);
</script>

<template>
  <DataSourceBadge v-if="debug" />
  <BootGuard />
</template>
