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
| `/s/:screen?m=<merchant>` | App nasabah. Template + value set bertanda tangan diambil dari `/bff/sdui` (web-bff → delivery-service) lalu disusun oleh engine. Ada manifest, cache IndexedDB terenkripsi, dan banner offline. Aksi `api` dikirim ke `/bff/api/*` dengan CSRF |
| `/studio/login` | Login dev ke studio-bff: nama, peran, merchant |
| `/studio/templates[/:key]` | **Template Builder** (admin, `SDUI_TEMPLATE_ADMIN`). Palette berisi komponen; hasilnya template (id + order). Pengajuan disetujui `SDUI_TEMPLATE_PUBLISHER` |
| `/studio/screens[/:merchant/:key]` | **Screen Builder** (maker, `SDUI_AUTHOR`). Palette berisi template; maker mengisi value per komponen. Hasilnya value set, yang disetujui `SDUI_PUBLISHER` |

Maker-checker dijaga backend: pengaju (atau penulis revisi) tidak bisa menyetujui perubahannya sendiri.
Untuk menyetujui, login sebagai pengguna lain.

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
