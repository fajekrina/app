# sdui-r apps

Dua app yang identik fungsinya, masing-masing memakai `@fajekrina/sdui-r` (`file:../../package`).
Rujukannya HLD Target Aplikasi Web; desainnya ada di `../DESAIN-SDUI-R.md`.

| App | Port | Stack |
| --- | --- | --- |
| `react/` | 5180 | React 18 + Tailwind 4 + react-router |
| `vue/` | 5181 | Vue 3 + Bootstrap 5 + vue-router |

## Rute

| Rute | Isi |
| --- | --- |
| `/s/:merchantId/:screen` | App nasabah: halaman terbit satu merchant, mis. `/s/merchant_demo/home`. Query lain menjadi data layar (`?seatId=A1`). Link lama `/s/:screen?m=<merchant>` dialihkan ke sini. Template + value set bertanda tangan diambil dari `/bff/sdui` (web-bff → delivery-service) lalu disusun oleh engine. Ada manifest, cache IndexedDB terenkripsi, dan banner offline. Aksi `api` dikirim ke `/bff/api/*` dengan CSRF |
| `/studio/login` | Login dev ke studio-bff: cukup nama admin. Nama admin = ID merchant |
| `/studio/templates[/:key]` | Tab **Desain** (Template Builder). Palette berisi komponen; hasilnya template (id + order). **Simpan draf** atau **Terbitkan**: release langsung aktif tanpa review |
| `/studio/templates/:key/content` | Tab **Isi konten**. Admin mengisi value halaman merchant-nya yang dibuat dari template ini (key halaman = key template), lalu **Terbitkan** langsung |

Hanya ada satu peran, `SDUI_TEMPLATE_ADMIN`. Admin hanya melihat dan mengubah template serta halaman
miliknya sendiri; backend membatasi setiap panggilan. Link lama `/studio/screens/...` dialihkan ke tab
Isi konten. Navbar app nasabah menampilkan semua merchant yang punya halaman terbit
(`GET /bff/sdui/merchants`), bukan daftar tetap.

## Jalankan

```bash
# 1. backend: cd ../service && ./gradlew bootJar && ./dev-up.sh
# 2. per app
npm install
npm run gen:keys        # sematkan kunci publik delivery ke src/sdui/keys.generated.ts (saat build, bukan runtime)
npm run dev             # react: http://localhost:5180 · vue: http://localhost:5181
npm test
```

`src/sdui/*` dan `src/api/*` sama persis di kedua app karena tidak bergantung pada framework.
Hanya halaman (`src/pages`) yang berbeda per framework.

Untuk dev, kunci AES cache dibuat ulang tiap tab, dan sesi BFF disimpan di memori. Di target,
kunci per perangkat bersifat non-extractable dan sesi disimpan di Redis.
