<script setup lang="ts">
/* 数据来源徽标 —— Vue 3 重构(第一阶段)的演示组件。
 * 默认隐藏,仅在 ?debug=1 时渲染:用于课程演示「同一页面、两种数据来源」——
 * API 态显示后端 /api/v1/bootstrap 的规模计数与版本,静态态显示内联快照。
 * 默认路径零视觉增量,不触碰与原站的平价;打印时也不出现。 */
import { computed } from 'vue';
import { useDataStore } from '../stores/data';

const store = useDataStore();

const sourceLabel = computed(() =>
  store.source === 'api' ? '后端 API' : store.source === 'static' ? '静态快照' : '载入中…');
const versionLabel = computed(() => (store.loaded ? 'v' + store.version : ''));
</script>

<template>
  <div class="zou-dsbadge" role="status" aria-label="数据来源调试徽标">
    <span class="zou-dsbadge__dot" :class="'is-' + (store.source ?? 'loading')"></span>
    <span class="zou-dsbadge__lab">数据源 · {{ sourceLabel }}</span>
    <span v-if="store.loaded" class="zou-dsbadge__meta">
      <template v-if="store.source === 'api'">
        {{ store.counts.places ?? '?' }} 地点 / {{ store.counts.routes ?? '?' }} 路线 /
        {{ store.counts.poems ?? '?' }} 诗
        <em>{{ versionLabel }}</em>
      </template>
      <template v-else>内联静态快照 · 规模计数随 API 态提供</template>
    </span>
  </div>
</template>

<style scoped>
.zou-dsbadge {
  position: fixed;
  right: 14px;
  bottom: 14px;
  z-index: 99990;
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: 60vw;
  padding: 7px 12px;
  border: 1px solid rgba(138, 90, 43, 0.35);
  border-radius: 999px;
  background: rgba(253, 250, 244, 0.92);
  color: #5b4632;
  font: 12px/1.5 "Noto Sans SC", sans-serif;
  box-shadow: 0 2px 10px rgba(60, 40, 20, 0.12);
  pointer-events: none;
}
.zou-dsbadge__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #b9a98f;
  flex: none;
}
.zou-dsbadge__dot.is-api { background: #3d8b4f; }
.zou-dsbadge__dot.is-static { background: #b98a2b; }
.zou-dsbadge__meta em {
  font-style: normal;
  opacity: 0.65;
  margin-left: 6px;
}
@media print {
  .zou-dsbadge { display: none !important; }
}
</style>
