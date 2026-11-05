/* 启动期错误捕获 —— Vue 3 重构(第一阶段)新增。
 * main.ts 在执行 classic 资产层「之前」安装;classic / 数据装载 / runLegacy 任意环节
 * 抛出未捕获错误时记录下来,由 App.vue 里的 BootGuard 组件在挂载后读取并展示
 * 可操作的提示(静态回退链接),而不是半渲染页面 + 一条用户看不见的 console 报错。
 * 正常路径零输出、零视觉增量——只有真的出错才出现界面。 */

export interface BootError {
  message: string;
  source: string;
}

const state: { errors: BootError[]; installed: boolean } = { errors: [], installed: false };

export function installBootErrorCapture(): void {
  if (state.installed) return;
  state.installed = true;
  window.addEventListener('error', (ev) => {
    state.errors.push({
      message: String((ev as ErrorEvent).message ?? String(ev.error ?? 'unknown error')),
      source: (ev as ErrorEvent).filename ?? '',
    });
  });
  window.addEventListener('unhandledrejection', (ev) => {
    state.errors.push({
      message: '未处理的 Promise 拒绝:' + String((ev as PromiseRejectionEvent).reason ?? ''),
      source: '',
    });
  });
}

export function bootErrors(): BootError[] {
  return state.errors.slice();
}

/** 直接记录一条启动失败(main.ts 的 catch 分支调用;不经 window error 事件,消息更准确)。
 * 第二阶段起 BootGuard 在 classic 之前就已挂载,通过 zou-boot-error 事件即时刷新。 */
export function recordBootFailure(err: unknown): void {
  state.errors.push({
    message: err instanceof Error ? err.message : String(err),
    source: 'boot',
  });
  try {
    window.dispatchEvent(new CustomEvent('zou-boot-error'));
  } catch { /* 极端环境下事件不可用,BootGuard 仍可在自身生命周期内读取 bootErrors() */ }
}
