<script setup lang="ts">
/* 启动守卫 —— Vue 3 重构(第一阶段)的兜底组件。
 * 平时不渲染任何内容(模板根节点 v-if 为假时只留一个注释节点,不产生可见 DOM);
 * 一旦页面出现未捕获错误(classic 脚本 / 数据装载 / legacy 模块 / 运行期),
 * 显示一张可操作的提示卡:错误摘要 + 静态数据模式入口 + 刷新入口。
 * 打印时同样隐藏,不影响打印平价。 */
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { bootErrors, type BootError } from '../legacy/errors';

const errors = ref<BootError[]>(bootErrors());
const sync = () => { errors.value = bootErrors(); };

onMounted(() => {
  window.addEventListener('error', sync);
  window.addEventListener('unhandledrejection', sync);
  window.addEventListener('zou-boot-error', sync);
});
onBeforeUnmount(() => {
  window.removeEventListener('error', sync);
  window.removeEventListener('unhandledrejection', sync);
  window.removeEventListener('zou-boot-error', sync);
});

const staticUrl = location.pathname + '?static=1' + location.hash;
const first = (): string => (errors.value[0]?.message ?? '').slice(0, 180);
</script>

<template>
  <div v-if="errors.length" class="zou-bootguard" role="alert">
    <strong>页面部分功能加载失败</strong>
    <p class="zou-bootguard__msg">{{ first() }}</p>
    <p>
      可改用 <a :href="staticUrl">静态数据模式</a> 打开,或刷新重试;
      带后端演示请确认服务已启动(见交付说明)。
    </p>
  </div>
</template>

<style scoped>
.zou-bootguard {
  position: fixed;
  left: 50%;
  bottom: 18px;
  transform: translateX(-50%);
  z-index: 99999;
  max-width: min(560px, 88vw);
  padding: 12px 16px;
  border: 1px solid rgba(160, 60, 40, 0.45);
  border-radius: 10px;
  background: rgba(255, 248, 246, 0.97);
  color: #6b3a2c;
  font: 13px/1.7 "Noto Sans SC", sans-serif;
  box-shadow: 0 6px 24px rgba(80, 30, 20, 0.18);
}
.zou-bootguard strong { display: block; margin-bottom: 4px; }
.zou-bootguard__msg {
  font-family: Consolas, monospace;
  font-size: 12px;
  word-break: break-all;
  opacity: 0.85;
}
.zou-bootguard a { color: #8a5a2b; }
@media print {
  .zou-bootguard { display: none !important; }
}
</style>
