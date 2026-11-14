# Panduan deploy PEATRIX Digital Twin (untuk AI agent)

Tujuan: memasukkan folder ini ke repo GitHub, lalu men-deploy-nya ke Vercel sebagai situs statis.

Folder ini **sudah siap deploy**: tanpa proses build, tanpa backend, tanpa `npm install`. Vercel cukup menyajikan isi folder apa adanya.

## Prasyarat

- Git terpasang, dan `git config user.name` / `user.email` sudah diatur di mesin ini.
- Akun GitHub, serta `gh` CLI (opsional, untuk membuat repo dari terminal).
- Akun Vercel yang sudah dihubungkan ke GitHub.

## Langkah 1 · Inisialisasi repo dan commit

Jalankan dari dalam folder `peatrix-twin/`:

```bash
cd peatrix-twin
git init -b main
```

Lalu buat commit berurutan. Pesan commit ada di bagian **Daftar commit** di bawah. Jalankan perintah `git add` dan `git commit` sesuai urutan.

## Langkah 2 · Buat repo di GitHub dan unggah

Dengan `gh`:

```bash
gh repo create peatrix-twin --public --source=. --remote=origin --push
```

Tanpa `gh`: buat repo kosong bernama `peatrix-twin` di github.com, lalu:

```bash
git remote add origin https://github.com/<USER>/peatrix-twin.git
git push -u origin main
```

Ganti `<USER>` dengan nama akun GitHub pemilik.

## Langkah 3 · Import ke Vercel

1. Buka https://vercel.com/new, pilih **Import Git Repository**, lalu pilih repo `peatrix-twin`.
2. Pengaturan proyek:
   - **Framework Preset:** `Other`
   - **Root Directory:** `./` (biarkan default)
   - **Build Command:** kosongkan (matikan override)
   - **Output Directory:** kosongkan (matikan override). Vercel akan menyajikan folder akar.
   - **Install Command:** kosongkan
3. Klik **Deploy**. Tunggu sekitar 30 detik.
4. Nama proyek bisa diganti di **Project Settings → General**, misalnya `peatrix-twin`, agar URL menjadi `peatrix-twin.vercel.app` (jika nama itu tersedia).

Konfigurasi `vercel.json` sudah ada di repo: URL tanpa `.html` dan header cache untuk `fonts/`, `vendor/`, dan `data/`. Tidak perlu diubah.

## Langkah 4 · Verifikasi setelah deploy

Buka URL produksi dan cek:

| Yang diuji | Cara | Hasil yang diharapkan |
|---|---|---|
| Halaman utama | buka `/` | peta termuat, peringkat tampil, tanpa galat di console |
| Data | buka `/data/twin.json` | JSON tampil, status 200 |
| Mode demo | buka `/?demo` | empat langkah berjalan otomatis |
| Langkah storyboard | `/?langkah=1` … `/?langkah=4` | keadaan sesuai panel 1–4 |
| 3D | `/?tampilan=3d` | permukaan 3D tampil |
| Info dan QR | klik ⓘ | tabel validasi dan QR tampil |
| HP | buka di HP | layout bertab, tanpa scroll horizontal |

Jika ada yang gagal, cek **Vercel → Deployments → Logs** dan **Build Logs**. Karena situs statis, kegagalan biasanya berupa berkas yang tidak terunggah atau salah huruf besar-kecil pada nama berkas.

## Langkah 5 · Ambil QR untuk slide

1. Buka URL produksi, klik tombol **ⓘ** di kanan atas.
2. Klik **Unduh QR (PNG)**.
3. QR dibuat dari alamat halaman yang sedang dibuka, jadi unduhan ini sudah berisi URL final. Jika URL berubah, unduh ulang.

## Hal yang perlu diperhatikan

- **Peta dasar** memakai ubin OpenStreetMap (`tile.openstreetmap.org`). Situs tetap berfungsi tanpa ubin, tetapi latar peta akan kosong. Untuk presentasi yang sangat penting, cek ulang sebelum acara.
- **Tidak ada pelacakan dan tidak ada cookie.** Jangan tambahkan analitik tanpa persetujuan tim.
- **Jangan** menambahkan logo instansi (BRGM, BPBD, dll.) tanpa izin tertulis.
- **Jangan** mengubah angka di `data/` secara manual. Jika data perlu diperbarui, jalankan ulang `tools/build_data.py` dari `PEATRIX_DATA/`, lalu commit.
- Folder `.impeccable/` sudah diabaikan oleh `.gitignore` dan **tidak** ikut ke repo. Itu wajar.
- Vercel tidak membutuhkan `node_modules`. Jangan unggah folder itu.

## Pembaruan setelah deploy pertama

Setiap `git push` ke `main` otomatis memicu deploy baru di Vercel. Untuk perubahan kecil:

```bash
git add -A
git commit -m "fix(ui): <ringkasan perubahan>"
git push
```

---

## Daftar commit

Ada **15 commit**, dibuat satu per satu dari yang paling dasar sampai halaman utama. Setiap commit berdiri sendiri. Jalankan berurutan dari dalam `peatrix-twin/`. Setiap pesan diakhiri baris atribusi sesuai instruksi.

### Commit 1 · chore: tambahkan .gitignore

```bash
git add .gitignore
git commit -m "chore: tambahkan .gitignore" -m "Abaikan .impeccable/, .vercel/, __pycache__/, dan artefak OS." -m "Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>"
```

### Commit 2 · chore(deploy): tambahkan konfigurasi Vercel

```bash
git add vercel.json
git commit -m "chore(deploy): tambahkan konfigurasi Vercel" -m "URL tanpa .html dan header cache panjang untuk fonts/, vendor/, dan data/." -m "Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>"
```

### Commit 3 · docs: tambahkan README

```bash
git add README.md
git commit -m "docs: tambahkan README" -m "Cara menjalankan secara lokal, cara deploy, tautan storyboard, dan catatan kejujuran data." -m "Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>"
```

### Commit 4 · docs: tambahkan konteks produk dan sistem visual

```bash
git add PRODUCT.md DESIGN.md
git commit -m "docs: tambahkan konteks produk dan sistem visual" -m "PRODUCT.md: pengguna, tujuan, dan batasan. DESIGN.md: empat warna PEATRIX, Poppins, dan tanpa biru." -m "Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>"
```

### Commit 5 · docs: tambahkan panduan deploy untuk agent

```bash
git add DEPLOY.md
git commit -m "docs: tambahkan panduan deploy untuk agent" -m "Langkah GitHub dan Vercel, checklist verifikasi, dan daftar commit." -m "Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>"
```

### Commit 6 · chore(fonts): simpan Poppins secara lokal

```bash
git add fonts/
git commit -m "chore(fonts): simpan Poppins secara lokal" -m "Subset latin, format woff2, bobot 400, 500, 600, dan 700 dari @fontsource/poppins 5.0.14." -m "Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>"
```

### Commit 7 · chore(vendor): simpan MapLibre, Three.js, dan qrcode secara lokal

```bash
git add vendor/
git commit -m "chore(vendor): simpan MapLibre, Three.js, dan qrcode secara lokal" -m "MapLibre GL JS 4.7.1, Three.js 0.160.0 beserta OrbitControls, dan qrcode-generator 1.4.4." -m "Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>"
```

### Commit 8 · feat(ui): tambahkan favicon PEATRIX

```bash
git add favicon.svg
git commit -m "feat(ui): tambahkan favicon PEATRIX" -m "Ikon garis putus-putus di atas latar krem, memakai warna merah PEATRIX." -m "Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>"
```

### Commit 9 · feat(ui): tambahkan gaya dengan token empat warna PEATRIX

```bash
git add css/style.css
git commit -m "feat(ui): tambahkan gaya dengan token empat warna PEATRIX" -m "Token di :root, Poppins, tombol, switch, slider, badge, daftar peringkat, dan tata letak HP di bawah 900 px." -m "Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>"
```

### Commit 10 · data: tambahkan raster per sel KHG dan metadata

```bash
git add data/twin.json data/twin.bin
git commit -m "data: tambahkan raster per sel KHG dan metadata" -m "twin.bin berisi indeks sel dan layer int16 dengan skala 100. twin.json berisi normalisasi, unit, penampang, dan ringkasan validasi." -m "Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>"
```

### Commit 11 · data: tambahkan unit, kanal, coring, lintasan AEM, desa, dan TMA stasiun

```bash
git add data/units.geojson data/canals.geojson data/cores.geojson data/aem_lines.geojson data/settlements.json data/tma_stations.json
git commit -m "data: tambahkan unit, kanal, coring, lintasan AEM, desa, dan TMA stasiun" -m "Vektor untuk lapisan peta dan deret waktu TMA observasi serta model." -m "Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>"
```

### Commit 12 · chore(tools): tambahkan skrip pembangun data dari PEATRIX_DATA

```bash
git add tools/build_data.py
git commit -m "chore(tools): tambahkan skrip pembangun data dari PEATRIX_DATA" -m "Tidak dipakai saat deploy. Dijalankan ulang hanya jika data sumber berubah." -m "Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>"
```

### Commit 13 · feat(3d): tambahkan tampilan cekungan gambut dengan bidang muka air

```bash
git add js/view3d.js
git commit -m "feat(3d): tambahkan tampilan cekungan gambut dengan bidang muka air" -m "Permukaan DEM, dasar gambut, dan bidang TMA yang bergerak saat skenario berubah. Dimuat hanya saat tombol 3D ditekan." -m "Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>"
```

### Commit 14 · feat(app): tambahkan peta, indeks di browser, peringkat, dan mode demo

```bash
git add js/app.js
git commit -m "feat(app): tambahkan peta, indeks di browser, peringkat, dan mode demo" -m "Skor PEATRIX dan ΔP dihitung di browser. Sekat kanal, defisit hujan, bobot wV, wC, dan wE, mode demo empat langkah, dan dialog info dengan QR." -m "Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>"
```

### Commit 15 · feat(ui): tambahkan halaman utama digital twin

```bash
git add index.html
git commit -m "feat(ui): tambahkan halaman utama digital twin" -m "Tata letak tiga panel dengan tab di HP, grafik penampang dan TMA, serta tautan ?langkah=1 sampai 4 untuk screenshot." -m "Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>"
```

### Setelah semua commit

```bash
git status --short   # harus kosong
git log --oneline    # harus berisi 15 commit
git push -u origin main
```

Catatan: `DEPLOY.md` ikut masuk ke repo di commit 5. Jika tidak ingin itu publik, hapus `DEPLOY.md` dari commit 5 dengan `git rm --cached DEPLOY.md`, tambahkan `DEPLOY.md` ke `.gitignore`, lalu buat commit baru. Jangan ubah commit yang sudah di-push.
