"""Kemas keluaran PEATRIX_DATA menjadi paket data ringkas untuk web (data/). Jalankan dari folder mana pun:
   python tools/build_data.py /path/ke/PEATRIX_DATA"""
import sys, os, json, numpy as np, pandas as pd, rasterio
from scipy import ndimage
from pyproj import Transformer
SRC = os.path.abspath(sys.argv[1]); OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data'); os.makedirs(OUT, exist_ok=True)
meta = json.load(open(os.path.join(SRC, '12_WEB', 'grid_meta.json')))
XMIN, YMAX, RES, NC, NR = meta['xmin'], meta['ymax'], meta['resolution_m'], meta['ncols'], meta['nrows']
tif = lambda p: rasterio.open(os.path.join(SRC, p)).read(1).astype(float)
cov = dict(np.load(os.path.join(SRC, '02_DEM', 'covariates_100m.npz'))); sc = dict(np.load(os.path.join(SRC, '07_TMA', 'tma_scenarios_100m.npz')))
inK = cov['zone'] > 0; idx = np.flatnonzero(inK.ravel()); n = len(idx)
T = tif('05_PEAT_THICKNESS/thickness_median_100m.tif'); L90 = tif('05_PEAT_THICKNESS/thickness_L90_100m.tif'); E = tif('11_VALIDATION/idx_E_100m.tif')
dem = ndimage.uniform_filter(np.nan_to_num(cov['dem']), size=7)  # dihaluskan 700 m untuk tampilan 3D (DSM memuat tajuk)
# unit kandidat: k-means identik dengan s4_index_web.py
xy = np.c_[cov['x'][inK], cov['y'][inK]]; rng = np.random.default_rng(1); cen = xy[rng.choice(len(xy), 8, replace=False)]
for _ in range(100):
    lab = np.argmin(((xy[:, None] - cen[None])**2).sum(-1), 1); cen = np.array([xy[lab == k].mean(0) for k in range(8)])
order = np.argsort(cen[:, 0]); remap = np.empty(8, int); remap[order] = np.arange(8); unit = remap[lab].astype('uint8')
rc = pd.read_csv(os.path.join(SRC, '11_VALIDATION', 'rank_change.csv'), index_col=0)
assert [int((unit == k).sum()) for k in range(8)] == rc.n_sel.astype(int).tolist(), 'unit tidak cocok dengan rank_change.csv'
q = lambda a: np.round(np.nan_to_num(a.ravel()[idx]) * 100).astype('<i2')
layers = dict(T=T, L90=L90, W0=-sc['dasar'], W1=-sc['sekat'], W2=-sc['defisit'], W3=-sc['sekat_defisit'], Hn=cov['Hn'], E=E, dem=dem)
with open(os.path.join(OUT, 'twin.bin'), 'wb') as f:
    f.write(idx.astype('<u4').tobytes())
    for k, a in layers.items(): f.write(q(a).tobytes())
    f.write(unit.tobytes())
t = Transformer.from_crs(32749, 4326, always_xy=True)
xmax, ymin = XMIN + NC * RES, YMAX - NR * RES
corners = [list(t.transform(x, y)) for x, y in ((XMIN, YMAX), (xmax, YMAX), (xmax, ymin), (XMIN, ymin))]
uc = [[round(v, 5) for v in t.transform(*cen[order][k])] for k in range(8)]
units = {}
for i, u in enumerate('ABCDEFGH'):
    r = rc.loc[u]; units[u] = dict(center=uc[i], n_sel=int(r.n_sel), hotspots=int(r.n_titik_panas), T=round(r.T_med_m, 2), L90=round(r.L90_m, 2), Hn=round(r.Hn, 3))
# penampang W-E lewat kubah timur (relatif terhadap permukaan)
xs = pd.read_csv(os.path.join(SRC, '11_VALIDATION', 'cross_section.csv'))
a, b = t.transform(xs.x_utm.iloc[0], xs.y_utm.iloc[0]), t.transform(xs.x_utm.iloc[-1], xs.y_utm.iloc[-1])
section = dict(line=[[round(a[0], 5), round(a[1], 5)], [round(b[0], 5), round(b[1], 5)]], dist_km=(xs.dist_m / 1000).round(1).tolist(), T=xs.peat_thick_med_m.round(2).tolist(),
    canal=xs.canal.astype(int).tolist(), zona=xs.zona.astype(int).tolist(),
    W=[(xs.elev_dem_m - xs[f'tma_{s}_m']).round(3).tolist() for s in ('dasar', 'sekat', 'defisit', 'sekat_defisit')])
# validasi untuk panel info
m = pd.read_csv(os.path.join(SRC, '11_VALIDATION', 'metrics_E1-E6.csv')); cal = pd.read_csv(os.path.join(SRC, '11_VALIDATION', 'tma_calibration.csv'))
pick = {'E1_IDW': 'Interpolasi titik bor (IDW)', 'E2_DEMcop': 'Topografi, DEM publik', 'E3_AEM_nearest20m': 'AEM langsung (≤20 m)', 'E4_QRF_AEM': 'QRF dilatih dari AEM', 'E5_QRF_RS': 'QRF dilatih dari coring'}
val = [dict(id=r.exp, nama=pick[r.exp], n=int(r.n), RMSE=r.RMSE, MAE=r.MAE, R2=r.R2, cover90=None if np.isnan(r.cover90) else r.cover90) for r in m.iloc[:10].itertuples() if r.exp in pick]
tma = [dict(station=r.station, periode=r.periode, n=int(r.n), RMSE=r.RMSE, NSE=r.NSE) for r in cal.itertuples()]
carbon = json.load(open(os.path.join(SRC, '11_VALIDATION', 'carbon_at_risk.json')))
json.dump(dict(ncols=NC, nrows=NR, n=n, layers=list(layers), scale=100, corners=corners, norm=meta['normalisasi'], units=units, section=section, validasi=val, tma_kalibrasi=tma,
    karbon=dict(ha=carbon['luas_prioritas_ha'], tC=carbon['karbon_berisiko_tC'], tCO2=carbon['karbon_berisiko_tCO2'])), open(os.path.join(OUT, 'twin.json'), 'w'), separators=(',', ':'))
# vektor
W = os.path.join(SRC, '12_WEB'); T2 = Transformer.from_crs(4326, 32749, always_xy=True)
bl = sc['blocked']; near = ndimage.binary_dilation(inK, iterations=5)
def cellhit(coords, mask):
    c = np.array(coords); e, nn = T2.transform(c[:, 0], c[:, 1]); pts = []
    for i in range(len(e) - 1):
        k = max(int(np.hypot(e[i+1]-e[i], nn[i+1]-nn[i]) / 40), 1); tt = np.linspace(0, 1, k + 1); pts.append(np.c_[e[i] + tt*(e[i+1]-e[i]), nn[i] + tt*(nn[i+1]-nn[i])])
    p = np.vstack(pts) if pts else np.c_[e, nn]; cc = ((p[:, 0] - XMIN) // RES).astype(int); rr = ((YMAX - p[:, 1]) // RES).astype(int)
    ok = (rr >= 0) & (rr < NR) & (cc >= 0) & (cc < NC); return mask[rr[ok], cc[ok]].any()
cf = []
for f in json.load(open(os.path.join(W, 'canals.geojson')))['features']:
    g = f['geometry']
    if g['type'] != 'LineString' or len(g['coordinates']) < 2 or not cellhit(g['coordinates'], near): continue
    cf.append(dict(type='Feature', properties=dict(b=int(cellhit(g['coordinates'], bl)), k=1 if f['properties'].get('waterway') == 'canal' else 0), geometry=dict(type='LineString', coordinates=[[round(x, 5), round(y, 5)] for x, y in g['coordinates']])))
json.dump(dict(type='FeatureCollection', features=cf), open(os.path.join(OUT, 'canals.geojson'), 'w'), separators=(',', ':'))
st = json.load(open(os.path.join(W, 'settlements.geojson')))['features']
json.dump(dict(desa=[[*f['geometry']['coordinates'], f['properties'].get('name')] for f in st if f['properties']['jenis'].startswith('desa')],
               bangunan=[[*f['geometry']['coordinates'], f['properties']['n_bangunan']] for f in st if not f['properties']['jenis'].startswith('desa')]), open(os.path.join(OUT, 'settlements.json'), 'w'), separators=(',', ':'))
for fn in ('cores.geojson', 'aem_lines_simplified.geojson'):
    json.dump(json.load(open(os.path.join(W, fn))), open(os.path.join(OUT, fn.replace('_simplified', '')), 'w'), separators=(',', ':'))
u = json.load(open(os.path.join(W, 'units.geojson')))
for f in u['features']:
    f['properties'] = dict(unit=f['properties']['unit'])
    rnd = lambda ring: [[round(x, 5), round(y, 5)] for x, y in ring]
    g = f['geometry']; g['coordinates'] = [rnd(r) for r in g['coordinates']] if g['type'] == 'Polygon' else [[rnd(r) for r in p] for p in g['coordinates']]
json.dump(u, open(os.path.join(OUT, 'units.geojson'), 'w'), separators=(',', ':'))
ts = json.load(open(os.path.join(W, 'tma_timeseries.json')))
json.dump({k: dict(start=v['date'][0], obs=v['obs'], model=[round(x, 2) for x in v['model']]) for k, v in ts.items()}, open(os.path.join(OUT, 'tma_stations.json'), 'w'), separators=(',', ':'))
print('sel KHG', n, 'kanal', len(cf), 'disekat', sum(f['properties']['b'] for f in cf)); os.system(f'ls -la {OUT}; du -sh {OUT}')
