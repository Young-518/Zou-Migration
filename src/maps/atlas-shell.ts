/* 三窗外壳组件 —— 第四阶段:由 legacy-ports/app.ts「三窗定位按钮/自适应/世系树初始化」分解。
 * 职责:三窗定位按钮、窗口 resize/ResizeObserver 重算、字体/布局稳定后的取景兜底
 *       (用户已操作则不打扰)、打印前后尺寸与统计图空容器处理、renderTree() 调用。
 * 顺序锚点:在微观图之后、名人堂卡片等面板之前调用(原文本序);
 *          renderTree() 的调用位于本组件末尾,与原文件第 1154 行一致。 */
import { R, migr } from './runtime';
import { renderTree } from './lineage-tree';
import type { LMap } from './types';

export function initAtlasShell(): void {
  const M = migr();
  const mapHeat = R.maps.heat as LMap;
  const mapMacro = R.maps.macro as LMap;
  const mapChain = R.maps.chain as LMap;
  const mapMicro = R.maps.micro as LMap;

  document.getElementById('btnFocusMacro')!.onclick = () => {
    document.querySelector('.card-macro')!.scrollIntoView({ behavior: 'smooth', block: 'start' });
    mapMacro.fitBounds(L.latLngBounds(
      M.nationalPlaces.features.filter((f) => {
        return f.geometry.coordinates[1] >= 18;   /* 排除新加坡/吉隆坡等海外节点 */
      }).map((f): [number, number] => {
        const c = f.geometry.coordinates; return [c[1], c[0]];
      })).pad(0.05));
  };
  document.getElementById('btnFocusChain')!.onclick = () => {
    document.querySelector('.card-chain')!.scrollIntoView({ behavior: 'smooth', block: 'start' });
    mapChain.fitBounds(L.latLngBounds(R.chainCoords).pad(0.18));
  };
  document.getElementById('btnFocusMicro')!.onclick = () => {
    document.querySelector('.card-micro')!.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const core = ['邹游村', '游家洲', '双洲村'];
    const pts: [number, number][] = M.villagePlaces.features.filter((f) => {
      return core.indexOf(f.properties.name as string) >= 0;
    }).map((f): [number, number] => {
      const c = f.geometry.coordinates; return [c[1], c[0]];
    });
    mapMicro.flyToBounds(L.latLngBounds(pts).pad(0.12), { maxZoom: 15, duration: .8 });
  };

  window.addEventListener('resize', () => {
    mapMacro.invalidateSize();
    mapChain.invalidateSize();
    mapMicro.invalidateSize();
  });
  /* 容器尺寸变化（如展开统计面板拉高布局）时自动重算，防止灰白留白 */
  if (window.ResizeObserver) {
    const mapRO = new ResizeObserver(() => {
      mapHeat.invalidateSize();
      mapMacro.invalidateSize();
      mapChain.invalidateSize();
      mapMicro.invalidateSize();
    });
    ['mapMacro', 'mapChain', 'mapMicro'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) mapRO.observe(el);
    });
  }
  /* 字体/布局稳定后重算三窗尺寸，避免瓦片留白 */
  const bootAt = Date.now();
  let chainTouched = false, microTouched = false;
  mapChain.on('zoomstart dragstart', () => {
    if (Date.now() - bootAt > 1500) chainTouched = true;
  });
  mapMicro.on('zoomstart dragstart', () => {
    if (Date.now() - bootAt > 1500) microTouched = true;
  });
  function fitChainHome(): void {
    if (R.chainCoords.length) mapChain.fitBounds(L.latLngBounds(R.chainCoords).pad(0.18));
  }
  function fitMicroHome(): void {
    const core = ['邹游村', '游家洲', '双洲村'];
    const pts: [number, number][] = M.villagePlaces.features.filter((f) => {
      return core.indexOf(f.properties.name as string) >= 0;
    }).map((f): [number, number] => {
      const c = f.geometry.coordinates; return [c[1], c[0]];
    });
    mapMicro.fitBounds(L.latLngBounds(pts).pad(0.12), { maxZoom: 15 });
  }
  window.addEventListener('load', () => {
    setTimeout(() => {
      mapHeat.invalidateSize();
      mapMacro.invalidateSize();
      mapChain.invalidateSize();
      mapMicro.invalidateSize();
      /* 初始 fitBounds 早于最终布局，按真实尺寸重新取景（用户已操作则不打扰） */
      if (!chainTouched) fitChainHome();
      if (!microTouched) fitMicroHome();
    }, 400);
  });
  /* 打印（含"另存为 PDF"）前重算尺寸，避免打印稿中地图空白 */
  window.addEventListener('beforeprint', () => {
    [mapHeat, mapMacro, mapChain, mapMicro].forEach((m) => { m.invalidateSize(); });
    /* 统计图未展开/未初始化时，打印稿隐藏其空容器 */
    const gb = document.getElementById('chartGens');
    if (gb && !gb.querySelector('canvas')) {
      const boxEl = gb.closest('.chart-box') || gb;
      boxEl.classList.add('mig-nochart');
    }
  });
  window.addEventListener('afterprint', () => {
    const gb = document.getElementById('chartGens');
    if (gb) { const boxEl = gb.closest('.chart-box') || gb; boxEl.classList.remove('mig-nochart'); }
  });

  /* 面板常显，DOM 就绪后直接渲染世系树（原文件第 1154 行位置） */
  renderTree();
}
