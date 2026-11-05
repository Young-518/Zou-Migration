/* ============================================================
 * 迁徙图谱(4 幅 ECharts 模拟迁徙图) · 编排器 —— 第四阶段:原单文件
 * 已分解为 src/charts/*(shared 绘图基建 + figure-a/b/c/d 四图组件)。
 *
 * 依赖:echarts 5.5(classic 全局)、window.CHINA_PROV、window.MIGR、window.MIG(PR-1 产物)。
 * 生命周期:IntersectionObserver 懒加载;离开视口暂停 effect;页面隐藏统一停;
 *           resize 自适应;prefers-reduced-motion 关动效;打印前预热。
 * 实例生命周期原语 useECharts 由本模块直接 import(正式 ES 模块)。
 * 数据口径:弧线为方向示意,非实际行走路径;热度为定性分级,非人口普查数值。
 * ============================================================ */
import { getOrInitChart, registerChartMap, setChartsEffect, resizeAll, prefersReducedMotion } from '../composables/useECharts';
import { box, setReduce } from '../charts/shared';
import { buildA } from '../charts/figure-a';
import { buildB } from '../charts/figure-b';
import { buildC } from '../charts/figure-c';
import { buildD } from '../charts/figure-d';

export function initMigrationCharts(): void {
(() => {
  if (!window.echarts || !window.MIGR || !window.MIG) return;
  if (!window.CHINA_PROV) return;

  registerChartMap('zou-china', (window as any).CHINA_PROV);
  setReduce(prefersReducedMotion());

  /* ================= 生命周期:懒加载 / 暂停 / 自适应 ================= */
  const built: Record<string, any> = {};
  const builders: Record<string, (c: any) => void> = { mapA: buildA, mapB: buildB, mapC: buildC, mapD: buildD };

  function ensure(id: string): any {
    if (built[id]) return built[id];
    const el = box(id);
    if (!el) return null;
    /* v3.1:折叠中(Ⅱ/Ⅲ 收在 #migMore)容器 0×0 —— 等展开(有尺寸)再建,避免 0×0 画布刷屏 */
    if (el.offsetWidth < 20 || el.offsetHeight < 20) return null;
    const c = getOrInitChart(el);
    built[id] = c;
    builders[id](c);
    return c;
  }

  const allCharts = () => Object.keys(built).map(k => built[k]);

  /* 只切 effect.show,不动数据 —— 离开视口即省 CPU */
  function setEffect(c: any, on: boolean) {
    setChartsEffect([c], on, prefersReducedMotion());
  }

  const io = ('IntersectionObserver' in window) ? new IntersectionObserver(entries => {
    entries.forEach(en => {
      const id = en.target.id;
      const c = built[id];
      if (en.isIntersecting) {
        if (!c) ensure(id);
        else setEffect(c, true);
      } else if (c) {
        setEffect(c, false);
      }
    });
  }, { rootMargin: '240px 0px' }) as IntersectionObserver | null : null;

  (['mapA', 'mapB', 'mapC', 'mapD'] as const).forEach(id => {
    const el = box(id);
    if (!el) return;
    if (io) io.observe(el); else ensure(id);
  });

  document.addEventListener('visibilitychange', () => {
    Object.keys(built).forEach(id => {
      const c = built[id], el = box(id);
      if (!c || !el) return;
      if (document.hidden) { setEffect(c, false); return; }
      const r = el.getBoundingClientRect();
      if (r.bottom > 0 && r.top < window.innerHeight) setEffect(c, true);
    });
  });

  let t: ReturnType<typeof setTimeout>;
  window.addEventListener('resize', () => {
    clearTimeout(t);
    t = setTimeout(() => resizeAll(allCharts()), 160);
  });

  /* P0-4:空闲预热(不阻塞首屏,保证打印/整页截图/快速跳转时已有内容) */
  function warmAll() {
    (['mapA', 'mapB', 'mapC', 'mapD'] as const).forEach(ensure);
    resizeAll(allCharts());
  }
  if ('requestIdleCallback' in window) {
    requestIdleCallback(warmAll, { timeout: 2500 });
  } else {
    setTimeout(warmAll, 1800);
  }

  /* P0-3:打印前确保四图已初始化并重绘(与 CSS 440px 配合) */
  window.addEventListener('beforeprint', () => { warmAll(); });

  /* v2.7:Ⅱ/Ⅲ 收进 <details>,展开后必须重算尺寸,否则停在 0×0 呈现空白 */
  const moreBox = document.getElementById('migMore') as HTMLDetailsElement | null;
  if (moreBox) {
    moreBox.addEventListener('toggle', () => {
      if (!moreBox.open) return;
      (['mapB', 'mapC'] as const).forEach(id => {
        const el = box(id);
        if (!el) return;
        if (!built[id]) { ensure(id); return; }
        resizeAll([built[id]]);
      });
      /* 展开动画结束后再校一次,避免横向轨道/字体回流造成差几像素 */
      setTimeout(() => {
        (['mapB', 'mapC'] as const).forEach(id => {
          const c = built[id];
          if (c && !c.isDisposed()) c.resize();
        });
      }, 220);
    });
  }

  /* 供 tests/test_migration.js 与验收脚本断言(函数形式,避免脚本先于图表执行) */
  window.__MIG_READY__ = () => {
    const MIG = window.MIG as { stats: { routes: number; starts: number; provinces: number } };
    return {
      routes: MIG.stats.routes, starts: MIG.stats.starts,
      provinces: MIG.stats.provinces, charts: Object.keys(built).length,
    };
  };
})();
}
