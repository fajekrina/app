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
| `/s/:screen` | App nasabah: halaman terbit, mis. `/s/insightKopi` — tanpa merchant / kanal / user di alamatnya. Query lain menjadi data layar (`?seatId=A1`). Halaman yang dibuat sebelum 2.6 tetap di `/s/:space/:screen` (mis. `/s/merchant_demo/home`); link lama `/s/:screen?m=<space>` dialihkan ke sana. Template + value set bertanda tangan diambil dari `/bff/sdui` (web-bff → delivery-service) lalu disusun oleh engine. Ada manifest, cache IndexedDB terenkripsi, dan banner offline. Aksi `api` dikirim ke `/bff/api/*` dengan CSRF |
| `/studio/login` | Login dev ke studio-bff: cukup **nama pengguna**. Nama hanya dicatat sebagai pembuat / penerbit |
| `/studio/templates[/:key]` | Tab **Template**: template **bersama** semua pengguna. Editor Studio lengkap (palet, outline, drag & drop); template menentukan komponen apa saja + nilai default (teks contoh `[...]`). **Terbitkan** langsung aktif, lalu menawarkan memperbarui halaman yang memakai template itu (dengan daftar yang akan hilang) |
| `/studio/pages[/:key]` | Tab **Konten**: **semua halaman**. **Buat halaman** = pilih template + kunci halaman (satu template, banyak halaman). Editor yang sama dengan struktur terkunci: tanpa palet, tanpa tambah/hapus/pindah komponen, tetapi semua isi, style, layout, sumber data, dan tujuan tombol bisa diubah (spec 2.6; yang berbeda dari template ditandai, **↺ template** mengembalikan). **Terbitkan** langsung tayang. Halaman lama: `/studio/pages/:space/:key` |

Pengguna Studio internal: satu peran (`SDUI_TEMPLATE_ADMIN`), **tanpa checker/review**. **Tidak ada yang
dimiliki pengguna**: semua pengguna melihat dan mengubah semua template dan halaman; nama pengguna hanya dicatat
(pembuat revisi, `published_by`). Halaman baru disimpan di satu ruang internal (`PAGE_SPACE` = `sdui`, di API masih
bernama merchant) yang tidak pernah terlihat pengguna maupun nasabah. Link lama `/studio/screens/...` dan
`/studio/templates/:key/:tab` dialihkan.
`src/api` dan `src/sdui` identik di React dan Vue (`sdui/page.ts`: `mergePage` / `splitPage`, pembaruan halaman).

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
