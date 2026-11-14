/* Tampilan 3D cekungan gambut: permukaan (DEM dihaluskan), dasar gambut (DEM − ketebalan median), bidang TMA (DEM − kedalaman TMA). */
import * as THREE from '../vendor/three.module.min.js';
import { OrbitControls } from '../vendor/OrbitControls.js';

const EX = 0.6; // 1 m vertikal = 0,6 sel (60 m) → dilebihkan 60×

export function create(el, { M, D, canvas, peel }) {
  const { ncols, nrows, n } = M;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setClearColor(0xFFF6EE);
  el.append(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 1, 4000); camera.position.set(-30, 250, 430);
  const controls = new OrbitControls(camera, renderer.domElement);
  Object.assign(controls, { enableDamping: true, dampingFactor: .08, maxPolarAngle: Math.PI * .49, minDistance: 60, maxDistance: 900 });
  controls.target.set(0, 0, 0);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xFF751F, 1.5));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(-120, 200, 80); scene.add(sun);

  // indeks segitiga: hanya sel yang keempat sudutnya di dalam KHG
  const grid = new Int32Array(ncols * nrows).fill(-1); D.idx.forEach((g, i) => grid[g] = i);
  const index = [];
  for (let i = 0; i < n; i++) {
    const g = D.idx[i], c = g % ncols, r = (g - c) / ncols; if (c + 1 >= ncols || r + 1 >= nrows) continue;
    const b = grid[g + 1], d = grid[g + ncols], e = grid[g + ncols + 1]; if (b < 0 || d < 0 || e < 0) continue;
    index.push(i, d, b, b, d, e);
  }
  const zmid = 5; // m, untuk memusatkan model
  const make = height => {
    const pos = new Float32Array(n * 3), uv = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) { const g = D.idx[i], c = g % ncols, r = (g - c) / ncols; pos[i * 3] = c - ncols / 2; pos[i * 3 + 1] = (height(i) - zmid) * EX; pos[i * 3 + 2] = r - nrows / 2; uv[i * 2] = (c + .5) / ncols; uv[i * 2 + 1] = 1 - (r + .5) / nrows; }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.setIndex(index); geo.computeVertexNormals(); return geo;
  };
  const tex = new THREE.CanvasTexture(canvas); tex.magFilter = THREE.NearestFilter; tex.colorSpace = THREE.SRGBColorSpace;
  const top = new THREE.Mesh(make(i => D.dem[i]), new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, depthWrite: false })); top.renderOrder = 3;
  const base = new THREE.Mesh(make(i => D.dem[i] - D.T[i]), new THREE.MeshLambertMaterial({ color: 0x550000, side: THREE.DoubleSide }));
  // tekstur garis putus-putus untuk bidang TMA
  const dc = Object.assign(document.createElement('canvas'), { width: 32, height: 32 }), dx = dc.getContext('2d');
  dx.fillStyle = 'rgba(255,246,238,.34)'; dx.fillRect(0, 0, 32, 32); dx.fillStyle = '#FFFFFF'; dx.fillRect(0, 14, 20, 4);
  const dash = new THREE.CanvasTexture(dc); dash.wrapS = dash.wrapT = THREE.RepeatWrapping; dash.repeat.set(ncols / 5, nrows / 5); dash.colorSpace = THREE.SRGBColorSpace;
  const waterGeo = make(i => D.dem[i] - D.W0[i]);
  const water = new THREE.Mesh(waterGeo, new THREE.MeshBasicMaterial({ map: dash, transparent: true, side: THREE.DoubleSide, depthWrite: false })); water.renderOrder = 2;
  scene.add(base, water, top);

  let target = Float32Array.from(D.W0), current = Float32Array.from(D.W0), t0 = 0, from = current, running = false, dirty = true;
  const wp = waterGeo.attributes.position;
  const writeWater = () => { for (let i = 0; i < n; i++) wp.array[i * 3 + 1] = (D.dem[i] - current[i] - zmid) * EX; wp.needsUpdate = true; };
  const resize = () => { const w = el.clientWidth, h = el.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); renderer.domElement.style.cssText = 'width:100%;height:100%'; camera.aspect = w / h; camera.updateProjectionMatrix(); dirty = true; };
  new ResizeObserver(resize).observe(el);
  controls.addEventListener('change', () => dirty = true);
  const frame = now => {
    if (!running) return; requestAnimationFrame(frame);
    if (t0) { const k = Math.min((now - t0) / 700, 1), e = 1 - Math.pow(1 - k, 4); for (let i = 0; i < n; i++) current[i] = from[i] + (target[i] - from[i]) * e; writeWater(); dirty = true; if (k >= 1) t0 = 0; }
    controls.update(); if (dirty) { renderer.render(scene, camera); dirty = false; }
  };
  return {
    active(on) { if (on && !running) { running = true; resize(); requestAnimationFrame(frame); } else if (!on) running = false; },
    refresh() { tex.needsUpdate = true; top.material.opacity = 1 - peel() * .9; dirty = true; },
    setWater(arr, now) { target = Float32Array.from(arr); if (now) { current = Float32Array.from(arr); writeWater(); } else { from = Float32Array.from(current); t0 = performance.now(); } this.refresh(); },
  };
}
