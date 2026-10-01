# Form Helper

Ekstensi WebExtension untuk Firefox Android yang menampilkan saran jawaban di Google Forms. Alat ini dibuat untuk belajar dan membahas latihan. Ekstensi tidak mengisi atau mengubah jawaban form.

## Alur

1. Tombol kecil yang terlihat muncul pada setiap pertanyaan Google Forms respondent.
2. Ekstensi mengirim soal ke API Vercel.
3. API mencoba model Harbor yang dipilih. Timeout, gangguan jaringan, HTTP 408/429, atau HTTP 5xx pada Harbor memicu fallback ke model Gemini yang dipilih. Error autentikasi atau payload tidak memicu fallback.
4. API memvalidasi respons dan mengembalikan saran terstruktur.

Pengaturan dan pemindaian halaman dibuka dari menu **Bantuan dan masukan** bawaan Google Forms. Pilih **Pengaturan Form Helper** untuk memilih model Harbor utama dan Gemini cadangan. **Muat soal halaman ini** memindai ulang pertanyaan setelah berpindah section. Sebelum aktif, panel meminta persetujuan bahwa teks dan gambar yang ditanyakan dikirim ke Vercel untuk diproses oleh Harbor dan, bila perlu, Gemini.

## Model

Harbor:

- [`qwen3.8-flash:free`](https://tokenharbor.ai/models/qwen3.8-flash%3Afree)
- [`deepseek-v4.1-flash:free`](https://tokenharbor.ai/models/deepseek-v4.1-flash%3Afree)
- [`mimo-v2.6-flash:free`](https://tokenharbor.ai/models/mimo-v2.6-flash%3Afree) (route Token Harbor saat ini menerima teks saja; soal bergambar menampilkan peringatan jika model ini dipilih)

Gemini:

- `gemini-3.5-flash-lite`
- `gemini-3.6-flash`
- `gemini-3.8-flash`

API menolak ID model di luar daftar tersebut. Panggilan Harbor menggunakan endpoint kompatibel OpenAI `/v1/chat/completions`. Gemini memakai Interactions API dengan structured output dan `store: false`. `API-DOCS.txt` disertakan sebagai referensi; detail Gemini dicek terhadap [dokumentasi Interactions API](https://ai.google.dev/gemini-api/docs/interactions-overview) dan [structured output](https://ai.google.dev/gemini-api/docs/structured-output).

## Menyiapkan API Vercel

Persyaratan: Node.js LTS dan Vercel CLI. Tidak ada SDK provider runtime; backend memakai `fetch` bawaan Node.

1. Buat proyek Vercel dari repo ini.
2. Tambahkan environment variables di pengaturan proyek Vercel:

   - `TOKENHARBOR_API_KEY` — API key Harbor.
   - `GEMINI_API_KEY` — API key Gemini AI Studio.
   - `CLIENT_TOKEN` — token acak yang digunakan ekstensi untuk mengakses API.
   - `HARBOR_MODEL` — opsional, default `qwen3.8-flash:free`.
   - `GEMINI_MODEL` — opsional, default `gemini-3.8-flash`.
   - `GEMINI_THINKING_BUDGET` — opsional, `0` memilih thinking minimal; nilai positif memilih level rendah.
   - `RATE_LIMIT_PER_MIN` — opsional, default 20 permintaan per menit untuk tiap IP dan token.
   - `ALLOWED_ORIGINS` — opsional, daftar origin dipisahkan koma untuk pemanggilan browser biasa.
   - `UPSTASH_REDIS_REST_URL` dan `UPSTASH_REDIS_REST_TOKEN` — opsional, rate limit bersama antar instance.

   Jangan taruh provider key di source, ekstensi, `.env.example`, atau log. Nilai lokal yang sensitif harus tetap di file `.env` yang sudah diabaikan Git, atau masukkan langsung ke Vercel.
3. Jalankan `vercel dev` untuk uji lokal atau deploy lewat alur Vercel proyek. Setelah deploy, isi Base URL API dan `CLIENT_TOKEN` pada panel ekstensi.

`GET /api/health` menguji token dan melaporkan apakah kedua provider sudah dikonfigurasi. `POST /api/answer` menerima payload soal dan pilihan model. Batas payload 3,5 MB, maksimal 4 gambar, dan teks soal maksimal 6.000 karakter.

Jika Upstash tidak dikonfigurasi, rate limit memakai memori proses serverless dan sifatnya best-effort; batas ini tidak dibagi antar instance dan dapat hilang saat instance dimulai ulang.

## Menyiapkan ekstensi

Jalankan `npm run package:extension` untuk membuat dua arsip dengan manifest yang sesuai browser:

- `form-helper-extension.zip` untuk Chrome/Chromium (background service worker).
- `form-helper-firefox.zip` untuk Firefox (background scripts/event page).

Ekstrak arsip yang sesuai, lalu muat folder hasil ekstrak lewat halaman Extensions dengan Developer mode dan **Load unpacked** di Chromium, atau `about:debugging` di Firefox desktop. Untuk Firefox Android, buat kredensial AMO API dan jalankan `npx web-ext sign --channel=unlisted --source-dir=/path/ke/folder-firefox-yang-diekstrak --api-key="$AMO_API_KEY" --api-secret="$AMO_API_SECRET"`. Hasil `.xpi` muncul di `web-ext-artifacts/`; pasang XPI yang ditandatangani melalui Firefox.

Buka menu **Bantuan dan masukan** pada Google Forms, pilih **Pengaturan Form Helper** untuk memasukkan Base URL API, token klien, bahasa, model, serta persetujuan pemrosesan data. Setelah berpindah halaman/section, buka menu yang sama dan pilih **Muat soal halaman ini**. Izinkan akses host API saat browser meminta izin. Toggle “Aktifkan tombol saran” mengatur tombol jawaban. Pemicu jawaban berupa ikon bintang kecil di dalam setiap soal.

Untuk memeriksa ekstensi jalankan `npm run lint:extension`. Manifest menyediakan background event page untuk Firefox Android 142+ dan service worker untuk Chromium. Izin data Firefox mendeklarasikan `websiteContent` karena teks/gambar soal dikirim ke API setelah pengguna menekan tombol. Ikon browser khusus belum disertakan.

## Pengembangan

```sh
npm install
npm test
```

Fixture parser ada di `tests/fixtures/questions.html`. Test unit tidak memanggil provider berbayar atau layanan eksternal.

## Batas penggunaan

Gunakan sesuai aturan dosen/penyelenggara ujian. Tidak ada fitur penyamaran, anti-deteksi, atau pengisian otomatis. Log API hanya menyimpan metadata tipe soal, provider, status, latensi, dan kode error; isi pertanyaan dan gambar tidak dicatat.
