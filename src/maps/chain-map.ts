/* 本支迁徙链窗组件(②号窗) —— 第四阶段:由 legacy-ports/app.ts「②号窗口:双洲邹氏
 * 本支迁徙链(独立成窗,族谱注直接依据)」分解。
 * 职责:mapChain 创建(高德底图)、七站取景与最大边界兜底(v3.6/v3.6.5 修复保持原样)、
 *       链线/站点渲染、序号徽标、chainCoords 句柄(注册表)、
 *       侧栏迁徙链清单/总里程/分段里程表。
 * 顺序锚点:在历史政区/郡望/名人图层之后、时间轴之前调用(原文本序)。 */
import { useLeafletMap } from '../composables/useLeafletMap';
import { GAODE_URL, R, addPlaces, addRoutes, esc, migr } from './runtime';

export function initChainMap(): void {
  const M = migr();
  const mapChain = useLeafletMap('mapChain', { zoomControl: true, scrollWheelZoom: false });
  R.maps.chain = mapChain;
  L.tileLayer(GAODE_URL,
    { maxZoom: 18, subdomains: '1234', attribution: '© 高德地图' }).addTo(mapChain);
  /* 初始视野贴合七站迁徙链范围 */
  (function () {
    const pts: [number, number][] = [];
    M.chainPlaces.features.forEach((f) => {
      pts.push([f.geometry.coordinates[1], f.geometry.coordinates[0]]);
    });
    mapChain.fitBounds(L.latLngBounds(pts).pad(0.12));
    /* v3.6 修复 B6 取景兜底:限制最大视野,避免日本/朝鲜半岛抢主体。
       v3.6.5 修复:原写法 [[110,24],[126,42]] 是 [经度,纬度] 顺序,Leaflet 需要 [纬度,经度];
       纬度 110/126 超界被钳到 85.05,最大边界退化成「北极一条线」,视野被钉死在高纬,
       高德瓦片无覆盖 → 04 地图整片灰白,形同未加载 */
    mapChain.setMaxBounds([[24, 110], [42, 126]]);
  })();

  const chainLayers2 = L.layerGroup().addTo(mapChain);
  addRoutes(mapChain, M.chain, chainLayers2,
    { color: '#C8A165', weight: 5, opacity: .95, dash: '14 8' });
  R.chainKeys2 = addPlaces(mapChain, M.chainPlaces, chainLayers2, { radius: 9 });
  const chainCoords: [number, number][] = R.chainCoords;
  M.chainPlaces.features.forEach((f, i) => {
    const c = f.geometry.coordinates;
    chainCoords.push([c[1], c[0]]);
    L.marker([c[1], c[0]], {
      interactive: false, icon: L.divIcon({ className: '', iconSize: [20, 20],
        iconAnchor: [-8, 22],
        html: '<div style="background:#8a5a2b;color:#fff;border-radius:50%;width:18px;height:18px;'
          + 'font-size:11px;line-height:18px;text-align:center;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4)">'
          + (i + 1) + '</div>' })
    }).addTo(chainLayers2);
  });
  mapChain.fitBounds(L.latLngBounds(chainCoords).pad(0.18));

  /* 侧栏迁徙链清单 → 点击在②号窗口定位 */
  const chainItems: Array<[string, string, string]> = [
    ['①', '山东莱州东鲁县', '唐武德三年（620）前，全哲公原籍'],
    ['②', '河北范阳（涿州）', '620 年出镇幽州、封范阳侯，立范阳堂'],
    ['③', '河南光州（潢川）', '安史之乱后（约 763 年后）南迁落籍'],
    ['④', '抚州宜黄石马廊下', '约 800 年（贞元年间）举族定居，二世昌宗公开基'],
    ['⑤', '崇仁乐安埮坪', '七世望龙公开基；965 年受旌（乾德三年诰命）'],
    ['⑥', '新淦安国乡湖边', '北宋年间九世德卿公卜居（约 1080），撰湖山八景诗'],
    ['⑦', '清江建安乡双洲', '1507 年十八世有宗公开基']
  ];
  (function () {
    const km = M.chainLength(M.chain);
    document.getElementById('chainMetric')!.innerHTML =
      '本支迁徙链 ①莱州 → ⑦双洲，六段直线里程合计约 <b>' + km.toFixed(0) + ' km</b>' +
      '（直线示意，非实际路径）';
    /* 分段里程表 */
    let segRows = '';
    M.chain.features.forEach((f, i) => {
      const c = f.geometry.coordinates;
      let d = 0;
      for (let j = 1; j < c.length; j++) d += M.dist(c[j - 1], c[j]);
      segRows += '<tr><td>' + chainItems[i][0] + ' → ' + chainItems[i + 1][0] + '</td>'
        + '<td>' + d.toFixed(0) + ' km</td></tr>';
    });
    document.getElementById('segTable')!.innerHTML =
      '<table><thead><tr><th>段</th><th>直线里程</th></tr></thead><tbody>' + segRows + '</tbody></table>';
    const ol = document.getElementById('chainList')!;
    ol.innerHTML = '';
    chainItems.forEach((it, i) => {
      const li = document.createElement('li');
      li.innerHTML = '<b>' + it[0] + ' ' + esc(it[1]) + '</b> — ' + esc(it[2]);
      li.style.cursor = 'pointer';
      li.title = '点击在②号窗口定位';
      li.onclick = () => {
        mapChain.flyTo(chainCoords[i], 9, { duration: .8 });
        const key = chainCoords[i][0] + ',' + chainCoords[i][1];
        const m = R.chainKeys2[key];
        if (m) setTimeout(() => { m.openPopup(); }, 900);
      };
      ol.appendChild(li);
    });
  })();
}
