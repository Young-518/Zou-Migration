/* 世系树组件(D3,纵向布局适配侧栏) —— 第四阶段:由 legacy-ports/app.ts「世系树」分解。
 * 职责:renderTree 渲染树形布局/缩放/节点点击联动 ③ 号图、地图节点 → 树高亮。
 * 顺序锚点:renderTree() 的调用位于外壳组件(beforeprint/afterprint 注册)之后,
 *          与原文件第 1154 行位置一致,由 atlas-shell 编排。 */
import { R, migr, showToast } from './runtime';
import { revealMicroMap } from './micro-map';

export function renderTree(): void {
  const box = document.getElementById('treeBox')!;
  const mapMicro = R.maps.micro!;
  box.innerHTML = '';
  const BW = box.clientWidth || 360, colW = 96, rowH = 76;
  const root = d3.hierarchy(migr().lineage);
  const treeLayout = d3.tree().nodeSize([colW, rowH]);
  treeLayout(root);

  const x0: number[] = root.descendants().map((d: any) => d.x);
  const minX = Math.min.apply(null, x0) - 30, maxX = Math.max.apply(null, x0) + 30;
  const treeW = maxX - minX;
  void treeW;
  const svgH = Math.max(500, (root.height + 1) * rowH + 80);
  const svg = d3.select(box).append('svg')
    .attr('width', BW).attr('height', svgH)
    .attr('viewBox', '0 0 ' + BW + ' ' + svgH);
  const g = svg.append('g');
  const initTx = d3.zoomIdentity.translate(BW / 2 - (minX + maxX) / 2, 26);
  const zoomBeh = d3.zoom().scaleExtent([0.5, 2.2])
    .on('zoom', (event: any) => { g.attr('transform', event.transform); });
  svg.call(zoomBeh);
  svg.call(zoomBeh.transform, initTx);
  svg.on('dblclick.zoom', null);

  g.selectAll('.tlink').data(root.links()).join('path')
    .attr('class', 'tlink')
    .attr('d', d3.linkVertical().x((d: any) => d.x)
      .y((d: any) => d.y));

  const node = g.selectAll('.tnode').data(root.descendants()).join('g')
    .attr('class', (d: any) => {
      return 'tnode' + (d.data.placeholder ? ' placeholder' : '');
    })
    .attr('transform', (d: any) => 'translate(' + d.x + ',' + d.y + ')');

  node.append('circle')
    .attr('r', (d: any) => d.data.placeholder ? 5 : 9)
    .attr('cy', 0)
    .attr('fill', (d: any) => d.data.latlng ? '#8a5a2b' : '#fff')
    .attr('stroke', (d: any) => d.data.latlng ? '#fff' : '#8a5a2b');

  node.append('text')
    .attr('x', 0).attr('y', -14).attr('text-anchor', 'middle')
    .text((d: any) => d.data.name);
  node.append('text').attr('class', 'gen')
    .attr('x', 0).attr('y', 24).attr('text-anchor', 'middle')
    .text((d: any) => {
      let t = '第' + d.data.gen + '世';
      if (d.data.year) t += ' · ' + d.data.year;
      if (d.data.place) t += ' · ' + d.data.place;
      return t;
    });

  node.on('click', (event: any, d: any) => {
    event.stopPropagation();
    node.classed('hl', false);
    d3.select(event.currentTarget).classed('hl', true);
    if (d.data.latlng && d.data.latlng.length === 2) {
      /* v2.7：树在地图下方，只 flyTo 屏幕外的地图＝"点了没反应"。
         先把 ③ 号图带回视口，再飞行定位，并给一句回执 */
      const key = d.data.latlng[0] + ',' + d.data.latlng[1];
      const mk = R.personByKey[key] || R.microKeys[key];
      revealMicroMap(() => {
        mapMicro.flyTo(d.data.latlng, 13, { duration: .8 });
        if (mk) setTimeout(() => { mk.openPopup(); }, 900);
      });
      showToast('已在 ③ 号图定位：第' + d.data.gen + '世 · ' + d.data.name);
    } else {
      showToast('第' + d.data.gen + '世 · ' + d.data.name + ' 暂无坐标，③ 号图无法定位');
    }
  });

  /* 地图节点 → 树高亮（村落点位 + 先祖名签） */
  function bindHighlight(markerMap: Record<string, any>): void {
    Object.keys(markerMap).forEach((k) => {
      markerMap[k].on('click', () => {
        node.classed('hl', false);
        node.filter((d: any) => {
          return d.data.latlng && (d.data.latlng[0] + ',' + d.data.latlng[1]) === k;
        }).classed('hl', true);
      });
    });
  }
  bindHighlight(R.microKeys);
  bindHighlight(R.personByKey);
}
