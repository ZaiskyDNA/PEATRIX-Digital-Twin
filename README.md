# PEATRIX Digital Twin (prototipe)

Prototipe web uji konsep digital twin lahan gambut **KHG.61.12.02, Kubu Raya**. Situs statis murni: tanpa backend, tanpa proses build, tanpa pelacakan.

## Menjalankan di komputer sendiri

```bash
python3 -m http.server 8080
# buka http://localhost:8080
```

Harus lewat server (bukan klik dua kali `index.html`), karena data dimuat dengan `fetch`.

## Deploy ke Vercel lewat GitHub

1. Buat repo GitHub baru, lalu unggah **isi folder ini** (folder ini menjadi akar repo).
2. Di Vercel: **Add New → Project → Import** repo tersebut.
3. Framework Preset: **Other**. Build Command dan Output Directory dikosongkan. Klik **Deploy**.
4. Atur nama proyek (mis. `peatrix-twin`) agar URL-nya pendek.

## QR

Buka situs yang sudah di-deploy, klik tombol **ⓘ** di kanan atas, lalu **Unduh QR (PNG)**. QR dibuat dari alamat halaman yang sedang dibuka, jadi unduh dari URL final.

## Tautan khusus untuk screenshot dan video

| Tautan | Keadaan |
|---|---|
| `/?langkah=1` | Panel 1: kondisi dasar, Peta A |
| `/?langkah=2` | Panel 2: sekat kanal kubah timur |
| `/?langkah=3` | Panel 3: defisit hujan 30% |
| `/?langkah=4` | Panel 4: Peta B (prioritas survei) |
| `/?demo` | Mode Demo berjalan otomatis (4 × 15 detik) |
| `/?tampilan=3d` | Langsung ke tampilan 3D |

## Struktur

```
index.html      halaman tunggal
css/style.css   gaya (4 warna PEATRIX + krem, Poppins)
js/app.js       peta, perhitungan indeks di browser, peringkat, grafik, mode demo
js/view3d.js    tampilan 3D (Three.js), dimuat saat dibutuhkan
data/           paket data ringkas (±1,4 MB)
vendor/, fonts/ MapLibre GL JS, Three.js, qrcode-generator, Poppins (disimpan lokal)
tools/build_data.py  membangun ulang data/ dari PEATRIX_DATA
```

## Memperbarui data

```bash
python tools/build_data.py /path/ke/PEATRIX_DATA
```

Butuh `numpy pandas scipy rasterio pyproj`. Skrip ini tidak dipakai saat deploy.

## Catatan kejujuran data

- Skor PEATRIX, peringkat, dan ΔP dihitung di browser dari nilai per sel (V dari TMA simulasi + titik panas, C dari ketebalan, E dari eksposur), dengan rumus Lampiran 3 esai.
- Skenario yang benar-benar disimulasikan: dasar, sekat kanal kubah timur, defisit hujan 30%, dan kombinasinya. Slider defisit di antara 0% dan 30% adalah **interpolasi linier**.
- Basemap: ubin © OpenStreetMap contributors, ditampilkan abu-abu (tanpa biru).
