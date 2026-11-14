/* PEATRIX Digital Twin — logika utama. Semua angka berasal dari data/ (lihat tools/build_data.py). */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const fmt = (v, d = 2) => Number(v).toLocaleString('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d });
const signed = (v, d = 2) => (v > 0 ? '+' : v < 0 ? '−' : '') + fmt(Math.abs(v), d);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const UNITS = 'ABCDEFGH'.split('');
const RAMP = ['#FFF6EE', '#FF751F', '#CD3811', '#A80000', '#550000'];
const INK = '#550000', RED = '#A80000', ORANGE = '#CD3811';
const mobile = matchMedia('(max-width: 900px)');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

const LAYERS = [
  { id: 'P', name: 'Peta A · PEATRIX', sub: 'prioritas inspeksi dan pembasahan', badge: 'Prediksi ML + Simulasi', unit: 'skor 0–10' },
  { id: 'SP', name: 'Peta B · prioritas survei', sub: 'tidak pasti sekaligus penting', badge: 'Prediksi ML', unit: 'skor SP' },
  { id: 'T', name: 'Ketebalan gambut', sub: 'median prediksi', badge: 'Prediksi ML', unit: 'meter', dom: [0, 6] },
  { id: 'L90', name: 'Ketidakpastian ketebalan', sub: 'lebar selang 90%', badge: 'Prediksi ML', unit: 'meter', dom: [1.5, 8] },
  { id: 'W', name: 'TMA puncak kemarau', sub: 'kedalaman di bawah permukaan', badge: 'Simulasi', unit: 'meter', dom: [0.85, 1.4] },
  { id: 'K', name: 'Risiko konvensional', sub: 'V + E, tanpa ketebalan', badge: 'Simulasi', unit: 'skor 0–10' },
];
const OVERLAYS = [
  { id: 'units', name: 'Unit kandidat A–H', badge: 'Prediksi ML', on: true },
  { id: 'canals', name: 'Kanal dan parit', badge: 'Peta dasar', on: true },
  { id: 'cores', name: 'Titik coring', badge: 'Pengukuran', on: true },
  { id: 'aem', name: 'Lintasan AEM', badge: 'Inversi geofisika', on: false },
  { id: 'settle', name: 'Permukiman', badge: 'Penginderaan jauh', on: false },
];

const state = { layer: 'P', sekat: false, defisit: 0, w: { V: .45, C: .35, E: .20 }, compare: 'konv', userCompare: false, unit: null, view: '2d', station: 'BRG20' };
let M, D = {}, G = {}, map, view3d, stations, cellIndex, inv, unitMarkers = [], villageMarkers = [];
const cv = Object.assign(document.createElement('canvas'), {});
let ctx2d, img, lut;

/* ───────── Data ───────── */
async function load() {
  const [meta, buf, units, canals, cores, aem, settle, st] = await Promise.all([
    fetch('data/twin.json').then(r => r.json()), fetch('data/twin.bin').then(r => r.arrayBuffer()),
    ...['units.geojson', 'canals.geojson', 'cores.geojson', 'aem_lines.geojson', 'settlements.json', 'tma_stations.json'].map(f => fetch('data/' + f).then(r => r.json())),
  ]);
  M = meta; stations = st; G = { units, canals, cores, aem, settle };
  const n = M.n; let off = 0;
  D.idx = new Uint32Array(buf, 0, n); off = 4 * n;
  for (const k of M.layers) { const a = new Int16Array(buf, off, n); off += 2 * n; D[k] = Float32Array.from(a, v => v / M.scale); }
  D.unit = new Uint8Array(buf, off, n);
  cellIndex = new Int32Array(M.ncols * M.nrows).fill(-1); D.idx.forEach((g, i) => cellIndex[g] = i);
  const [tlo, thi] = M.norm.T_m, [ulo, uhi] = M.norm.L90_m;
  D.C = D.T.map(v => clamp(10 * (v - tlo) / (thi - tlo), 0, 10));
  D.U = D.L90.map(v => clamp(10 * (v - ulo) / (uhi - ulo), 0, 10));
  for (const k of ['Wc', 'V', 'V0', 'P', 'P0', 'SP', 'K']) D[k] = new Float32Array(n);
  D.count = UNITS.map((_, u) => D.unit.reduce((s, v) => s + (v === u), 0));
  // afine lon/lat -> kolom/baris
  const [a, b, , c] = M.corners, ux = b[0] - a[0], uy = b[1] - a[1], vx = c[0] - a[0], vy = c[1] - a[1], det = ux * vy - uy * vx;
  inv = (lon, lat) => { const dx = lon - a[0], dy = lat - a[1]; return [Math.floor((dx * vy - dy * vx) / det * M.ncols), Math.floor((ux * dy - uy * dx) / det * M.nrows)]; };
}

/* ───────── Model di browser ───────── */
const Vof = (W, Hn) => { const [lo, hi] = M.norm.W_m; return clamp(10 * (.6 * clamp((W - lo) / (hi - lo), 0, 1) + .4 * Hn), 0, 10); };
const mean = arr => { const s = new Float64Array(8); for (let i = 0; i < arr.length; i++) s[D.unit[i]] += arr[i]; return Array.from(s, (v, u) => v / D.count[u]); };
const rankOf = sc => { const o = sc.map((v, i) => [v, i]).sort((x, y) => y[0] - x[0]); const r = []; o.forEach(([, i], k) => r[i] = k + 1); return r; };
const isBase = () => !state.sekat && state.defisit === 0;
let A = {};
function compute() {
  const f = state.defisit / 30, Wa = state.sekat ? D.W1 : D.W0, Wb = state.sekat ? D.W3 : D.W2, { V: wV, C: wC, E: wE } = state.w;
  const kd = (wV + wE) || 1;
  for (let i = 0; i < M.n; i++) {
    const W = Wa[i] + (Wb[i] - Wa[i]) * f, V = Vof(W, D.Hn[i]), V0 = Vof(D.W0[i], D.Hn[i]);
    D.Wc[i] = W; D.V[i] = V; D.V0[i] = V0;
    D.P[i] = wV * V + wC * D.C[i] + wE * D.E[i]; D.P0[i] = wV * V0 + wC * D.C[i] + wE * D.E[i];
    D.SP[i] = D.U[i] * D.P[i] / 10; D.K[i] = (wV * V0 + wE * D.E[i]) / kd;
  }
  A = { P: mean(D.P), P0: mean(D.P0), K: mean(D.K), SP: mean(D.SP), W: mean(D.Wc), W0: mean(D.W0), V: mean(D.V), C: mean(D.C), E: mean(D.E), U: mean(D.U) };
  for (const k of ['P', 'P0', 'K', 'SP']) A['r' + k] = rankOf(A[k]);
}
function domains() {
  const pct = (a, p) => { const s = Float32Array.from(a).sort(); return s[Math.floor(p * (s.length - 1))]; };
  const lo = Math.floor(Math.min(pct(D.P, .02), pct(D.K, .02)) * 2) / 2, hi = Math.ceil(Math.max(pct(D.P, .98), pct(D.K, .98)) * 2) / 2;
  LAYERS[0].dom = LAYERS[5].dom = [lo, hi]; LAYERS[1].dom = [0, Math.ceil(pct(D.SP, .98) * 2) / 2];
}

/* ───────── Raster ───────── */
function buildLut() {
  const rgb = RAMP.map(h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16))); lut = new Uint8Array(256 * 3);
  for (let i = 0; i < 256; i++) { const t = i / 255 * (rgb.length - 1), k = Math.min(Math.floor(t), rgb.length - 2), f = t - k; for (let c = 0; c < 3; c++) lut[i * 3 + c] = rgb[k][c] + (rgb[k + 1][c] - rgb[k][c]) * f; }
  cv.width = M.ncols; cv.height = M.nrows; ctx2d = cv.getContext('2d'); img = ctx2d.createImageData(M.ncols, M.nrows);
  const lc = $('#legendRamp').getContext('2d');
  for (let x = 0; x < 220; x++) { const i = Math.round(x / 219 * 255) * 3; lc.fillStyle = `rgb(${lut[i]},${lut[i + 1]},${lut[i + 2]})`; lc.fillRect(x, 0, 1, 10); }
}
const layerDef = () => LAYERS.find(l => l.id === state.layer);
const layerArr = () => ({ P: D.P, SP: D.SP, T: D.T, L90: D.L90, W: D.Wc, K: D.K })[state.layer];
function drawRaster() {
  const L = layerDef(), a = layerArr(), [lo, hi] = L.dom, px = img.data; px.fill(0);
  for (let i = 0; i < M.n; i++) { const t = Math.round(clamp((a[i] - lo) / (hi - lo), 0, 1) * 255) * 3, o = D.idx[i] * 4; px[o] = lut[t]; px[o + 1] = lut[t + 1]; px[o + 2] = lut[t + 2]; px[o + 3] = 255; }
  ctx2d.putImageData(img, 0, 0);
  const src = map?.getSource('ras'); if (src) { src.play(); map.once('render', () => src.pause()); map.triggerRepaint(); }
  view3d?.refresh();
  $('#legendName').textContent = L.name; $('#legendBadge').textContent = L.badge;
  $('#legendMin').textContent = fmt(lo, 1); $('#legendMax').textContent = (L.id === 'W' ? '' : '≥ ') + fmt(hi, 1); $('#legendUnit').textContent = L.unit;
}

/* ───────── Peta ───────── */
function initMap() {
  const xs = [], ys = [];
  for (const f of G.units.features) for (const ring of (f.geometry.type === 'Polygon' ? f.geometry.coordinates : f.geometry.coordinates.flat())) for (const [x, y] of ring) { xs.push(x); ys.push(y); }
  const bounds = [[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]];
  map = new maplibregl.Map({
    container: 'map', attributionControl: false, bounds, fitBoundsOptions: { padding: mobile.matches ? 18 : 48 }, maxZoom: 15, minZoom: 9, dragRotate: false, pitchWithRotate: false,
    style: { version: 8, sources: { base: { type: 'raster', tileSize: 256, tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], maxzoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors' } },
      layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#FFF6EE' } }, { id: 'base', type: 'raster', source: 'base', paint: { 'raster-saturation': -1, 'raster-contrast': -.25, 'raster-opacity': .42 } }] },
  });
  map.touchZoomRotate.disableRotation();
  map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
  if (mobile.matches) map.once('load', () => document.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show'));
  if (!mobile.matches) map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
  map.fitHome = () => map.fitBounds(bounds, { padding: mobile.matches ? 18 : 48, duration: reduced ? 0 : 900 });
  return new Promise(res => map.on('load', () => {
    map.addSource('ras', { type: 'canvas', canvas: cv, coordinates: M.corners, animate: false });
    map.addLayer({ id: 'ras', type: 'raster', source: 'ras', paint: { 'raster-resampling': 'nearest', 'raster-opacity': .92, 'raster-fade-duration': 0 } });
    map.addSource('aem', { type: 'geojson', data: G.aem });
    map.addLayer({ id: 'aem', type: 'line', source: 'aem', layout: { visibility: 'none' }, paint: { 'line-color': '#FFFFFF', 'line-width': .8, 'line-opacity': .8 } });
    map.addSource('canals', { type: 'geojson', data: G.canals });
    map.addLayer({ id: 'canals', type: 'line', source: 'canals', paint: { 'line-color': INK, 'line-opacity': ['case', ['==', ['get', 'k'], 1], .7, .32], 'line-width': ['interpolate', ['linear'], ['zoom'], 10, ['case', ['==', ['get', 'k'], 1], .9, .35], 14, ['case', ['==', ['get', 'k'], 1], 2.2, 1.2]], 'line-dasharray': [2.5, 2] } });
    map.addLayer({ id: 'blocked', type: 'line', source: 'canals', filter: ['==', ['get', 'b'], 1], layout: { visibility: 'none' }, paint: { 'line-color': '#FFFFFF', 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1.1, 14, 3], 'line-dasharray': [1.2, 1.4] } });
    map.addSource('sect', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'LineString', coordinates: M.section.line } } });
    map.addLayer({ id: 'sect', type: 'line', source: 'sect', paint: { 'line-color': INK, 'line-width': 1.6, 'line-dasharray': [.4, 2.2] }, layout: { 'line-cap': 'round' } });
    map.addSource('units', { type: 'geojson', data: G.units, promoteId: 'unit' });
    map.addLayer({ id: 'units-fill', type: 'fill', source: 'units', paint: { 'fill-opacity': 0 } });
    map.addLayer({ id: 'units', type: 'line', source: 'units', paint: { 'line-color': INK, 'line-width': 1.1, 'line-opacity': .85 } });
    map.addLayer({ id: 'units-sel', type: 'line', source: 'units', filter: ['==', ['get', 'unit'], ''], paint: { 'line-color': '#FFFFFF', 'line-width': 5 } });
    map.addLayer({ id: 'units-sel2', type: 'line', source: 'units', filter: ['==', ['get', 'unit'], ''], paint: { 'line-color': RED, 'line-width': 2.6 } });
    map.addSource('settle', { type: 'geojson', data: { type: 'FeatureCollection', features: G.settle.bangunan.map(([x, y, n]) => ({ type: 'Feature', properties: { n }, geometry: { type: 'Point', coordinates: [x, y] } })) } });
    map.addLayer({ id: 'settle', type: 'circle', source: 'settle', layout: { visibility: 'none' }, paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 1.3, 14, 4], 'circle-color': '#FFFFFF', 'circle-stroke-color': INK, 'circle-stroke-width': .8 } });
    map.addSource('cores', { type: 'geojson', data: G.cores });
    map.addLayer({ id: 'cores', type: 'circle', source: 'cores', paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 3.4, 14, 7], 'circle-color': '#FFFFFF', 'circle-stroke-color': INK, 'circle-stroke-width': 1.6 } });
    UNITS.forEach(u => { const el = Object.assign(document.createElement('button'), { className: 'unit-chip', textContent: u, type: 'button' }); el.setAttribute('aria-label', 'Pilih unit ' + u); el.onclick = e => { e.stopPropagation(); selectUnit(u); }; unitMarkers.push(new maplibregl.Marker({ element: el }).setLngLat(M.units[u].center).addTo(map)); });
    G.settle.desa.forEach(([x, y, name]) => { if (!name) return; const el = Object.assign(document.createElement('span'), { className: 'village', textContent: name }); el.hidden = true; villageMarkers.push(new maplibregl.Marker({ element: el }).setLngLat([x, y]).addTo(map)); });
    map.on('click', 'cores', e => { const p = e.features[0].properties; e.originalEvent.cancelBubble = true;
      new maplibregl.Popup({ offset: 10, maxWidth: '240px' }).setLngLat(e.features[0].geometry.coordinates).setHTML(`<b>Titik coring ${p.name}</b><span class="big">${fmt(p.thickness_m)} m</span>ketebalan terukur <span class="badge">Pengukuran</span><br><small>${p.comments ?? ''}</small><br><small>Silvestri et al. (2019)</small>`).addTo(map); });
    map.on('click', e => { if (e.originalEvent.cancelBubble) return; const c = cellAt(e.lngLat); if (c < 0) return; selectUnit(UNITS[D.unit[c]]); if (mobile.matches) { showReadout(c); clearTimeout(showReadout.t); showReadout.t = setTimeout(() => $('#readout').hidden = true, 5000); } });
    map.on('mousemove', e => { const c = cellAt(e.lngLat); map.getCanvas().style.cursor = c < 0 ? '' : 'pointer'; c < 0 ? $('#readout').hidden = true : showReadout(c); });
    map.on('mouseout', () => $('#readout').hidden = true);
    res();
  }));
}
const cellAt = ll => { const [c, r] = inv(ll.lng, ll.lat); return c < 0 || r < 0 || c >= M.ncols || r >= M.nrows ? -1 : cellIndex[r * M.ncols + c]; };
function showReadout(i) {
  const el = $('#readout'); el.hidden = false;
  el.innerHTML = `<b>Sel 100 m · Unit ${UNITS[D.unit[i]]}</b><dl><dt>Ketebalan median</dt><dd>${fmt(D.T[i])} m</dd><dt>Lebar selang 90%</dt><dd>${fmt(D.L90[i], 1)} m</dd><dt>TMA puncak kemarau</dt><dd>−${fmt(D.Wc[i])} m</dd><dt>PEATRIX</dt><dd>${fmt(D.P[i])}</dd><dt>Prioritas survei</dt><dd>${fmt(D.SP[i])}</dd></dl><small style="color:rgba(255,246,238,.78)">Prediksi model, bukan pengukuran</small>`;
}
function applyOverlays() {
  const on = id => $(`#ov-${id}`).checked, vis = b => b ? 'visible' : 'none';
  if (!map?.getLayer('units')) return;
  ['units', 'units-fill', 'units-sel', 'units-sel2'].forEach(l => map.setLayoutProperty(l, 'visibility', vis(on('units'))));
  unitMarkers.forEach(m => m.getElement().hidden = !on('units'));
  map.setLayoutProperty('canals', 'visibility', vis(on('canals'))); map.setLayoutProperty('blocked', 'visibility', vis(on('canals') && state.sekat));
  map.setLayoutProperty('cores', 'visibility', vis(on('cores'))); map.setLayoutProperty('aem', 'visibility', vis(on('aem'))); map.setLayoutProperty('settle', 'visibility', vis(on('settle')));
  villageMarkers.forEach(m => m.getElement().hidden = !on('settle'));
}

/* ───────── Peringkat ───────── */
const ARROW = { up: '<svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true"><path d="M5 1l4 6H1z" fill="currentColor"/></svg>', down: '<svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true"><path d="M5 9L1 3h8z" fill="currentColor"/></svg>' };
function spearman(a, b) { const n = a.length; let s = 0; for (let i = 0; i < n; i++) s += (a[i] - b[i]) ** 2; return 1 - 6 * s / (n * (n * n - 1)); }
function renderRank() {
  const list = $('#rankList'), survey = state.layer === 'SP';
  const cur = survey ? A.SP : A.P, rank = survey ? A.rSP : A.rP;
  const ref = survey ? A.P : state.compare === 'konv' ? A.K : A.P0, rref = survey ? A.rP : state.compare === 'konv' ? A.rK : A.rP0;
  const refName = survey ? 'PEATRIX' : state.compare === 'konv' ? 'konv.' : 'dasar';
  const [lo, hi] = survey ? [0, Math.max(...A.SP, ...A.P) * 1.05] : [Math.min(...A.P, ...ref) - .8, Math.max(...A.P, ...ref) + .3];
  $('#rankTitle').textContent = survey ? 'Prioritas survei berikutnya' : 'Peringkat prioritas';
  $('.rank-compare').hidden = survey;
  $('#rankNote').innerHTML = survey ? 'Peta B: SP = U × PEATRIX / 10. Tinggi berarti <b>tidak pasti sekaligus penting</b>, lokasi lintasan GPR berikutnya. Dibanding peringkat PEATRIX.'
    : state.compare === 'konv' ? `Dibanding risiko konvensional (V + E, tanpa ketebalan gambut). Korelasi peringkat Spearman <b>ρ = ${signed(spearman(A.rP, A.rK))}</b>.`
    : 'Dibanding kondisi dasar dengan bobot yang sama. ΔP = skor skenario − skor dasar.';
  const first = new Map($$('li', list).map(li => [li.dataset.u, li.getBoundingClientRect().top]));
  if (!list.children.length) UNITS.forEach(u => { const li = document.createElement('li'); li.dataset.u = u; li.tabIndex = 0; li.onclick = () => selectUnit(u); li.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectUnit(u); } };
    li.innerHTML = `<span class="pos"></span><span class="who">${u}</span><div class="score"><div class="nums"><b></b><span></span></div><div class="track"><i></i><u></u></div></div><div class="move"><span class="shift"></span><span class="dp"></span></div>`; list.append(li); });
  const order = UNITS.map((u, i) => i).sort((x, y) => rank[x] - rank[y]);
  order.forEach(i => { const li = $(`li[data-u="${UNITS[i]}"]`, list); list.append(li);
    const d = rref[i] - rank[i], dp = cur[i] - ref[i];
    $('.pos', li).textContent = rank[i]; $('.nums b', li).textContent = fmt(cur[i]); $('.nums span', li).textContent = `${refName} ${fmt(ref[i])}`;
    $('.track i', li).style.transform = `scaleX(${clamp((cur[i] - lo) / (hi - lo), 0, 1)})`; $('.track u', li).style.left = `calc(${clamp((ref[i] - lo) / (hi - lo), 0, 1) * 100}% - 1px)`;
    const sh = $('.shift', li); sh.className = 'shift ' + (d > 0 ? 'up' : d < 0 ? 'down' : 'same');
    sh.innerHTML = d > 0 ? `${ARROW.up} naik ${d}` : d < 0 ? `${ARROW.down} turun ${-d}` : 'tetap';
    $('.dp', li).textContent = !survey && state.compare === 'dasar' ? `ΔP ${signed(dp)}` : `dari #${rref[i]}`;
    li.classList.toggle('sel', UNITS[i] === state.unit);
    li.setAttribute('aria-label', `Peringkat ${rank[i]}, unit ${UNITS[i]}, skor ${fmt(cur[i])}`);
  });
  if (!reduced && first.size) $$('li', list).forEach(li => { const dy = first.get(li.dataset.u) - li.getBoundingClientRect().top; if (Math.abs(dy) > 1) li.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 620, easing: 'cubic-bezier(.16,1,.3,1)' }); });
  renderUnit();
}
function renderUnit() {
  const u = state.unit ?? UNITS[A.rP.indexOf(1)], i = UNITS.indexOf(u), m = M.units[u], dW = A.W0[i] - A.W[i];
  const bar = (name, v) => `<span>${name}</span><span class="t"><i style="transform:scaleX(${v / 10})"></i></span><span class="v">${fmt(v, 1)}</span>`;
  $('#unitDetail').innerHTML = `<h3>Unit ${u}</h3><p class="facts"><b>${m.n_sel.toLocaleString('id-ID')} ha</b> · gambut median <b>${fmt(m.T)} m</b> · selang 90% rata-rata <b>${fmt(m.L90, 1)} m</b> · <b>${m.hotspots}</b> titik panas 2015–2025</p>
    <div class="comp">${bar('V kerentanan', A.V[i])}${bar('C konsekuensi', A.C[i])}${bar('E eksposur', A.E[i])}${bar('U ketidakpastian', A.U[i])}</div>
    <p class="tmaline">TMA puncak kemarau: <b>−${fmt(A.W[i])} m</b>${isBase() ? ' pada kondisi dasar' : ` · dasar −${fmt(A.W0[i])} m <span class="rise">(${dW > 0.004 ? 'naik ' + fmt(dW) : dW < -0.004 ? 'turun ' + fmt(-dW) : 'tetap'}${Math.abs(dW) > 0.004 ? ' m' : ''})</span>`}</p>`;
}
function selectUnit(u) {
  state.unit = u; const f = ['==', ['get', 'unit'], u];
  if (map?.getLayer('units-sel')) { map.setFilter('units-sel', f); map.setFilter('units-sel2', f); }
  unitMarkers.forEach((m, i) => m.getElement().classList.toggle('sel', UNITS[i] === u));
  $$('#rankList li').forEach(li => li.classList.toggle('sel', li.dataset.u === u)); renderUnit();
}

/* ───────── Grafik ───────── */
const svgEl = (s, w, h) => { s.setAttribute('viewBox', `0 0 ${w} ${h}`); return s; };
function drawSection() {
  const svg = $('#sectionSvg'), w = svg.clientWidth || 600, h = svg.clientHeight || 132, S = M.section, n = S.T.length;
  const l = 30, r = 8, t = 10, b = 18, f = state.defisit / 30, Wa = S.W[state.sekat ? 1 : 0], Wb = S.W[state.sekat ? 3 : 2];
  const ymax = Math.ceil(Math.max(...S.T)), X = i => l + i / (n - 1) * (w - l - r), Y = d => t + d / ymax * (h - t - b);
  const path = a => a.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join('');
  const cur = Wa.map((v, i) => v + (Wb[i] - v) * f);
  const z0 = S.zona.indexOf(215), z1 = S.zona.lastIndexOf(215);
  let g = `<rect x="${X(z0)}" y="${t}" width="${X(z1) - X(z0)}" height="${h - t - b}" fill="rgba(255,117,31,.08)"/><text class="lbl" x="${(X(z0) + X(z1)) / 2}" y="${h - b - 6}" text-anchor="middle">kubah timur${state.sekat ? ' · kanal disekat' : ''}</text>`;
  for (let d = 0; d <= ymax; d += 2) g += `<line x1="${l}" x2="${w - r}" y1="${Y(d)}" y2="${Y(d)}" stroke="rgba(85,0,0,.1)"/><text x="${l - 6}" y="${Y(d) + 3.5}" text-anchor="end">${d ? '−' + d : '0'} m</text>`;
  for (let k = 5; k <= S.dist_km[n - 1]; k += 5) { const i = S.dist_km.findIndex(v => v >= k); g += `<text x="${Math.min(X(i), w - r)}" y="${h - 4}" text-anchor="${X(i) > w - 40 ? 'end' : 'middle'}">${k} km</text>`; }
  g += `<path d="${path(S.T)}L${X(n - 1)},${Y(0)}L${X(0)},${Y(0)}Z" fill="rgba(255,117,31,.42)" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/>`;
  g += `<line x1="${l}" x2="${w - r}" y1="${Y(.4)}" y2="${Y(.4)}" stroke="${INK}" stroke-width="1.2" stroke-dasharray="1 3"/>`;
  if (!isBase()) g += `<path d="${path(S.W[0])}" fill="none" stroke="rgba(85,0,0,.4)" stroke-width="1.3" stroke-dasharray="4 3"/>`;
  g += `<path d="${path(cur)}" fill="none" stroke="${RED}" stroke-width="2" stroke-dasharray="6 3.5" stroke-linejoin="round"/>`;
  svgEl(svg, w, h).innerHTML = g;
}
function drawStation() {
  const svg = $('#stationSvg'), w = svg.clientWidth || 310, h = svg.clientHeight || 190, s = stations[state.station], n = s.model.length;
  const l = 36, r = 8, t = 12, b = 22, all = [...s.model, ...s.obs.filter(v => v != null), -0.4], lo = Math.floor(Math.min(...all) * 5) / 5, hi = Math.min(0.1, Math.ceil(Math.max(...all) * 5) / 5);
  const X = i => l + i / (n - 1) * (w - l - r), Y = v => t + (hi - v) / (hi - lo) * (h - t - b), t0 = new Date(s.start + 'T00:00:00Z');
  const line = a => { let d = '', pen = false; a.forEach((v, i) => { if (v == null) { pen = false; return; } d += `${pen ? 'L' : 'M'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`; pen = true; }); return d; };
  let g = '';
  for (let v = hi; v >= lo - 1e-6; v -= (hi - lo) > 1 ? .4 : .2) g += `<line x1="${l}" x2="${w - r}" y1="${Y(v)}" y2="${Y(v)}" stroke="rgba(85,0,0,.1)"/><text x="${l - 6}" y="${Y(v) + 3.5}" text-anchor="end">${fmt(v, 1).replace('-', '−')}</text>`;
  const split = Math.round((Date.UTC(2019, 0, 1) - t0) / 864e5);
  if (split < n) g += `<line x1="${X(split)}" x2="${X(split)}" y1="${t}" y2="${h - b}" stroke="rgba(85,0,0,.34)"/><text x="${X(split) - 5}" y="${h - 6}" text-anchor="end">kalibrasi 2018</text><text x="${X(split) + 5}" y="${h - 6}">validasi 2019</text>`;
  else g += `<text x="${l}" y="${h - 6}">kalibrasi 2018 (tanpa data 2019)</text>`;
  g += `<line x1="${l}" x2="${w - r}" y1="${Y(-.4)}" y2="${Y(-.4)}" stroke="${INK}" stroke-width="1.2" stroke-dasharray="1 3"/><text class="lbl" x="${w - r}" y="${Y(-.4) - 4}" text-anchor="end">ambang −0,4 m</text>`;
  g += `<path d="${line(s.obs)}" fill="none" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/><path d="${line(s.model)}" fill="none" stroke="${ORANGE}" stroke-width="1.6" stroke-dasharray="5 3" stroke-linejoin="round"/>`;
  g += `<line x1="${l + 4}" x2="${l + 22}" y1="${t + 1}" y2="${t + 1}" stroke="${INK}" stroke-width="1.6"/><text x="${l + 26}" y="${t + 4.5}">observasi</text><line x1="${l + 86}" x2="${l + 104}" y1="${t + 1}" y2="${t + 1}" stroke="${ORANGE}" stroke-width="1.6" stroke-dasharray="5 3"/><text x="${l + 108}" y="${t + 4.5}">model</text>`;
  svgEl(svg, w, h).innerHTML = g;
  const k = M.tma_kalibrasi.filter(x => x.station === state.station), c = k.find(x => x.periode.startsWith('kal')), v = k.find(x => x.periode.startsWith('val'));
  $('#stationNote').innerHTML = `Kalibrasi 2018: RMSE <b>${fmt(c.RMSE)} m</b>, NSE ${fmt(c.NSE)}. ${v ? `Validasi 2019: RMSE <b>${fmt(v.RMSE)} m</b>, NSE ${fmt(v.NSE)}.` : 'Tidak ada data 2019 untuk validasi.'} Stasiun regional Kubu Raya (Taufik et al. 2022), bukan titik di dalam KHG.`;
}

/* ───────── Kendali ───────── */
function update(what = {}) {
  compute(); drawRaster(); renderRank(); drawSection(); applyOverlays(); view3d?.setWater(D.Wc);
  $('#sekat').checked = state.sekat; const d = $('#defisit'); d.value = state.defisit; d.style.setProperty('--fill', state.defisit / 30 * 100 + '%'); $('#defisitOut').textContent = state.defisit + '%';
  for (const k of ['V', 'C', 'E']) { const el = $('#w' + k); el.value = Math.round(state.w[k] * 100); el.style.setProperty('--fill', state.w[k] * 100 + '%'); $(`#w${k}Out`).textContent = fmt(state.w[k]); }
  $$('#layerList input').forEach(i => i.checked = i.value === state.layer);
  $$('[data-compare]').forEach(b => b.setAttribute('aria-pressed', b.dataset.compare === state.compare));
}
function setScenario(p) { Object.assign(state, p); if (!state.userCompare) state.compare = isBase() ? 'konv' : 'dasar'; update(); }
function setWeight(k, v) {
  const o = ['V', 'C', 'E'].filter(x => x !== k), rest = 1 - v, s = state.w[o[0]] + state.w[o[1]];
  state.w[k] = v; state.w[o[0]] = s > 1e-6 ? rest * state.w[o[0]] / s : rest / 2; state.w[o[1]] = rest - state.w[o[0]];
  for (const x of ['V', 'C', 'E']) state.w[x] = Math.round(state.w[x] * 100) / 100;
  state.w[o[1]] = Math.round((1 - state.w[k] - state.w[o[0]]) * 100) / 100; update();
}
async function setView(v) {
  state.view = v; $$('[data-view]').forEach(b => b.setAttribute('aria-pressed', b.dataset.view === v));
  $('#map').style.visibility = v === '2d' ? 'visible' : 'hidden'; $('#three').hidden = v !== '3d'; $('#tools3d').hidden = v !== '3d'; $('#readout').hidden = true;
  if (v === '3d' && !view3d) { const mod = await import('./view3d.js'); view3d = mod.create($('#three'), { M, D, canvas: cv, peel: () => $('#peel').value / 100 }); view3d.setWater(D.Wc, true); }
  view3d?.active(v === '3d');
}
function buildControls() {
  $('#layerList').innerHTML = LAYERS.map(l => `<label class="layer"><input type="radio" name="layer" value="${l.id}"><span class="dot"></span><span class="layer-name">${l.name}<small>${l.sub}</small></span><span class="badge">${l.badge.replace('Prediksi ML + Simulasi', 'ML + Simulasi')}</span></label>`).join('');
  $('#overlayList').innerHTML = OVERLAYS.map(o => `<label class="layer"><input type="checkbox" id="ov-${o.id}" ${o.on ? 'checked' : ''}><span class="dot box"></span><span class="layer-name">${o.name}</span><span class="badge">${o.badge}</span></label>`).join('');
  $('#stationSeg').innerHTML = Object.keys(stations).map(s => `<button type="button" data-station="${s}" aria-pressed="${s === state.station}">${s}</button>`).join('');
  $('#layerList').onchange = e => { state.layer = e.target.value; update(); };
  $('#overlayList').onchange = applyOverlays;
  $('#sekat').onchange = e => setScenario({ sekat: e.target.checked });
  $('#defisit').oninput = e => setScenario({ defisit: +e.target.value });
  $('#resetScenario').onclick = () => setScenario({ sekat: false, defisit: 0 });
  for (const k of ['V', 'C', 'E']) $('#w' + k).oninput = e => setWeight(k, e.target.value / 100);
  $('#resetWeights').onclick = () => { state.w = { V: .45, C: .35, E: .20 }; update(); };
  $$('[data-compare]').forEach(b => b.onclick = () => { state.compare = b.dataset.compare; state.userCompare = true; update(); });
  $$('[data-view]').forEach(b => b.onclick = () => setView(b.dataset.view));
  $('#stationSeg').onclick = e => { const s = e.target.dataset.station; if (!s) return; state.station = s; $$('[data-station]').forEach(b => b.setAttribute('aria-pressed', b.dataset.station === s)); drawStation(); };
  $$('[data-tabbtn]').forEach(b => b.onclick = () => setTab(b.dataset.tabbtn));
  $('#peel').oninput = () => view3d?.refresh();
  $('#infoBtn').onclick = openInfo; $('#demoBtn').onclick = () => demo.running ? demo.stop() : demo.start(); $('#demoStop').onclick = () => demo.stop();
  $('#info').addEventListener('click', e => { if (e.target === e.currentTarget) e.currentTarget.close(); });
  const place = () => (mobile.matches ? $('#sectionSlot') : $('.center')).append($('#sectionFig'));
  mobile.addEventListener('change', () => { place(); requestAnimationFrame(() => { drawSection(); drawStation(); map?.resize(); }); }); place();
  let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { drawSection(); drawStation(); }, 120); });
}
function setTab(t) { $('.stage').dataset.tab = t; $$('[data-tabbtn]').forEach(b => b.setAttribute('aria-pressed', b.dataset.tabbtn === t)); requestAnimationFrame(() => { drawSection(); drawStation(); }); }

/* ───────── Info + QR ───────── */
let qrReady;
async function openInfo() {
  const tb = $('#valTable tbody');
  if (!tb.children.length) tb.innerHTML = M.validasi.map(v => `<tr class="${v.id === 'E4_QRF_AEM' ? 'hl' : ''}"><td>${v.nama}</td><td>${v.n}</td><td>${fmt(v.RMSE)}</td><td>${fmt(v.R2)}</td><td>${v.cover90 == null ? '–' : fmt(v.cover90)}</td></tr>`).join('');
  $('#info').showModal();
  const url = location.origin + location.pathname; $('#shareUrl').textContent = url.replace(/^https?:\/\//, '');
  qrReady ??= new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'vendor/qrcode.js'; s.onload = res; s.onerror = rej; document.head.append(s); });
  await qrReady; const q = window.qrcode(0, 'M'); q.addData(url); q.make(); const n = q.getModuleCount();
  let p = ''; for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) p += `M${c},${r}h1v1h-1z`;
  $('#qr').innerHTML = `<svg viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges"><path d="${p}" fill="${INK}"/></svg>`;
  $('#qrDownload').onclick = () => { const k = 16, m = 4, c = Object.assign(document.createElement('canvas'), { width: (n + 2 * m) * k, height: (n + 2 * m) * k }), x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.fillStyle = INK;
    for (let r = 0; r < n; r++) for (let cc = 0; cc < n; cc++) if (q.isDark(r, cc)) x.fillRect((cc + m) * k, (r + m) * k, k, k);
    Object.assign(document.createElement('a'), { href: c.toDataURL('image/png'), download: 'peatrix-twin-qr.png' }).click(); };
}

/* ───────── Mode demo (4 langkah storyboard) ───────── */
const STEPS = [
  { title: 'Kondisi dasar · Peta A', text: () => `Dengan ketebalan gambut ikut dihitung, unit ${UNITS[A.rP.indexOf(1)]} menjadi prioritas pertama. Pada risiko konvensional ia hanya peringkat ${A.rK[A.rP.indexOf(1)]}.`, set: { layer: 'P', sekat: false, defisit: 0, compare: 'konv' }, after: () => selectUnit(UNITS[A.rP.indexOf(1)]) },
  { title: 'Sekat kanal di kubah timur', text: () => { const i = UNITS.indexOf(state.unit); return `Muka air naik di sekitar kanal yang disekat (pengaruh ≤600 m). Skor unit ${state.unit} turun ${fmt(A.P0[i] - A.P[i])} poin, TMA naik ${fmt(A.W0[i] - A.W[i])} m.`; }, set: { layer: 'W', sekat: true, defisit: 0, compare: 'dasar' } },
  { title: 'Defisit hujan 30%', text: () => { const i = A.P.map((v, k) => v - A.P0[k]).reduce((b, v, k, a) => v > a[b] ? k : b, 0); return `Tanpa sekat, kemarau lebih kering menaikkan skor semua unit. Kenaikan terbesar di unit ${UNITS[i]} (ΔP ${signed(A.P[i] - A.P0[i])}).`; }, set: { layer: 'P', sekat: false, defisit: 30, compare: 'dasar' } },
  { title: 'Peta B · survei berikutnya', text: () => `Lintasan GPR berikutnya diarahkan ke lokasi yang tidak pasti sekaligus penting. Peringkat survei pertama: unit ${UNITS[A.rSP.indexOf(1)]}.`, set: { layer: 'SP', sekat: false, defisit: 0, compare: 'konv' }, after: () => selectUnit(UNITS[A.rSP.indexOf(1)]) },
];
function applyStep(k) { const s = STEPS[k]; Object.assign(state, s.set); state.userCompare = false; update(); s.after?.(); $('#demoTitle').textContent = s.title; $('#demoCaption').textContent = s.text(); $('#demoStep').textContent = `${k + 1} / ${STEPS.length}`; if (mobile.matches) setTab(k === 1 ? 'tma' : 'rank'); }
const demo = { running: false, timer: 0, anim: null,
  start(k = 0, dur = 15000) { this.running = true; $('#demoBar').hidden = false; $('#demoBtn span').textContent = 'Hentikan'; if (state.view !== '2d') setView('2d'); map?.fitHome(); this.go(k, dur); },
  go(k, dur) { applyStep(k); this.anim?.cancel(); this.anim = $('#demoProgress').animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: dur, fill: 'forwards' }); this.timer = setTimeout(() => k + 1 < STEPS.length ? this.go(k + 1, dur) : this.stop(), dur); },
  stop() { clearTimeout(this.timer); this.anim?.cancel(); this.running = false; $('#demoBar').hidden = true; $('#demoBtn span').textContent = 'Mode Demo'; state.userCompare = false; },
};

/* ───────── Mulai ───────── */
(async () => {
  try {
    await load(); buildLut(); buildControls(); compute(); domains(); update(); drawStation();
    await initMap(); applyOverlays(); selectUnit(UNITS[A.rP.indexOf(1)]);
    const q = new URLSearchParams(location.search), k = +q.get('langkah');
    if (k >= 1 && k <= STEPS.length) { applyStep(k - 1); $('#demoBar').hidden = false; $('#demoStop').hidden = true; }
    if (q.get('tampilan') === '3d') await setView('3d');
    if (q.has('demo')) demo.start();
    $('#loading').classList.add('done');
  } catch (e) { console.error(e); $('#loading').textContent = 'Data twin gagal dimuat. Muat ulang halaman, atau periksa koneksi Anda.'; }
})();
