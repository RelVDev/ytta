# Form Helper

Ekstensi WebExtension untuk Firefox Android yang menampilkan saran jawaban di Google Forms dan halaman pengerjaan kuis HEBAT Universitas Airlangga. Ekstensi tidak mengisi atau mengubah jawaban kuis.

## Alur

1. Tombol kecil muncul pada pertanyaan Google Forms atau Moodle HEBAT (`/mod/quiz/attempt.php`).
2. Ekstensi mengirim soal ke API Vercel.
3. API memakai model utama yang dipilih: Harbor atau Groq GPT-OSS 120B. Jika GPT-OSS dipilih, Harbor menjadi fallback berikutnya. Gemini dapat menjadi fallback terakhir dan bisa dinonaktifkan.
4. API memvalidasi respons dan mengembalikan saran terstruktur.

Di Google Forms, pengaturan dan pemindaian dibuka dari menu **Bantuan dan masukan**. Di HEBAT, gunakan menu **Form Helper** di kanan bawah. Keduanya menyediakan pengaturan model dan pemindaian ulang. Parser HEBAT membaca pilihan ganda, checkbox, dropdown, jawaban singkat, dan essay Moodle; Google Forms memakai kolom paragraf sebagai mode essay. Saran essay mempertahankan jawaban lengkap tanpa batas tiga kalimat dan tetap hanya ditampilkan untuk ditinjau atau disalin, tidak dimasukkan otomatis ke form. Gambar hanya disalin dari elemen same-origin yang sudah dimuat di halaman melalui canvas; ekstensi tidak mengambil ulang URL `pluginfile.php`. Jika pembacaan lokal gagal, gambar dilewati dan ditandai agar hasil tidak dianggap pasti.

Pada HEBAT, ikon klip pada tiap soal dapat melampirkan maksimal dua file lokal berukuran 500 KB per file dalam format PDF, TXT, MD, atau CSV. Lampiran hanya diproses dengan model Harbor Claude Haiku 5.5. File dipilih dari perangkat lewat pemilih file browser; ekstensi tidak mengunduh lampiran dari Moodle. Sebelum aktif, panel meminta persetujuan pengiriman teks, gambar, dan file yang dipilih ke Vercel/provider.

## Model

Harbor:

- [`qwen3.8-flash:free`](https://tokenharbor.ai/models/qwen3.8-flash%3Afree)
- [`deepseek-v4.1-flash:free`](https://tokenharbor.ai/models/deepseek-v4.1-flash%3Afree)
- [`mimo-v2.6-flash:free`](https://tokenharbor.ai/models/mimo-v2.6-flash%3Afree) (route Token Harbor saat ini menerima teks saja; soal bergambar menampilkan peringatan jika model ini dipilih)
- [`glm-5.3-flash`](https://tokenharbor.ai/models/glm-5.3-flash)
- [`glm-5.3-flashx`](https://tokenharbor.ai/models/glm-5.3-flashx)
- [`gpt-6-luna`](https://tokenharbor.ai/models/gpt-6-luna)
- [`gpt-6-luna-fast`](https://tokenharbor.ai/models/gpt-6-luna-fast) (teks saja)
- [`qwen3.8-flash`](https://tokenharbor.ai/models/qwen3.8-flash) (berbayar)
- `claude-haiku-5.5` (teks, gambar, PDF, dan file teks melalui endpoint Messages Harbor)

Gemini:

- `gemini-3.5-flash-lite`
- `gemini-3.6-flash`
- `gemini-3.8-flash`

Groq:

- [`qwen/qwen3.8-27b`](https://console.groq.com/docs/model/qwen/qwen3.8-27b) — OCR/transkripsi gambar, dapat dimatikan di pengaturan.
- [`openai/gpt-oss-120b`](https://console.groq.com/docs/model/openai/gpt-oss-120b) — model jawaban teks utama opsional; jika dipilih, Harbor dan lalu Gemini menjadi fallback sesuai pengaturan. Model ini tidak menerima gambar, sehingga soal gambar memerlukan OCR Qwen agar GPT-OSS bisa dipakai.

API menolak ID model di luar daftar tersebut. Model Harbor selain Claude Haiku dan Groq memakai endpoint kompatibel OpenAI `/v1/chat/completions`; Claude Haiku menggunakan endpoint Anthropic-compatible `/v1/messages` agar gambar dan PDF bisa dikirim sebagai content blocks. Gemini memakai Interactions API dengan structured output dan `store: false`. OCR Qwen menghasilkan transkripsi teks terlebih dahulu, termasuk angka, rumus, tabel, dan label diagram. `API-DOCS.txt` disertakan sebagai referensi; detail provider dilengkapi dokumentasi resmi.

## Menyiapkan API Vercel

Persyaratan: Node.js LTS dan Vercel CLI. Tidak ada SDK provider runtime; backend memakai `fetch` bawaan Node.

1. Buat proyek Vercel dari repo ini.
2. Tambahkan environment variables di pengaturan proyek Vercel:

   - `TOKENHARBOR_API_KEY` — API key Harbor.
   - `GEMINI_API_KEY` — API key Gemini AI Studio.
   - `GROQ_API_KEY` — API key Groq; dipakai bersama oleh Qwen OCR dan GPT-OSS.
   - `CLIENT_TOKEN` — token acak yang digunakan ekstensi untuk mengakses API.
   - `HARBOR_MODEL` — opsional, default `qwen3.8-flash:free`.
   - `GEMINI_MODEL` — opsional, default `gemini-3.8-flash`.
   - `GROQ_OCR_MODEL` — opsional, default `qwen/qwen3.8-27b`.
   - `GROQ_ANSWER_MODEL` — opsional, default `openai/gpt-oss-120b`.
   - `GEMINI_THINKING_BUDGET` — opsional, `0` memilih thinking minimal; nilai positif memilih level rendah.
   - `RATE_LIMIT_PER_MIN` — opsional, default 20 permintaan per menit untuk tiap IP dan token.
   - `ALLOWED_ORIGINS` — opsional, daftar origin dipisahkan koma untuk pemanggilan browser biasa.
   - `UPSTASH_REDIS_REST_URL` dan `UPSTASH_REDIS_REST_TOKEN` — opsional, rate limit bersama antar instance.

   Jangan taruh provider key di source, ekstensi, `.env.example`, atau log. Nilai lokal yang sensitif harus tetap di file `.env` yang sudah diabaikan Git, atau masukkan langsung ke Vercel.
3. Jalankan `vercel dev` untuk uji lokal atau deploy lewat alur Vercel proyek. Setelah deploy, isi Base URL API dan `CLIENT_TOKEN` pada panel ekstensi.

`GET /api/health` memeriksa token klien dan melaporkan apakah key Harbor, Gemini, dan Groq telah dikonfigurasi. Endpoint ini tidak memanggil model atau menguji kuota provider. `POST /api/answer` menerima payload soal dan pilihan model. Batas payload 3,5 MB, maksimal 4 gambar, dan teks soal maksimal 6.000 karakter. URL gambar HTTPS dari host publik dapat digunakan; server memeriksa DNS, memblokir alamat jaringan privat, memvalidasi redirect, dan menerima hanya PNG/JPEG/GIF/WebP dalam batas ukuran. Groq mendukung hingga tiga gambar per permintaan OCR; jika ada empat gambar, backend memprosesnya dalam beberapa kelompok paralel.

Jika Upstash tidak dikonfigurasi, rate limit memakai memori proses serverless dan sifatnya best-effort; batas ini tidak dibagi antar instance dan dapat hilang saat instance dimulai ulang.

## Menyiapkan ekstensi

Jalankan `npm run package:extension` untuk membuat dua arsip dengan manifest yang sesuai browser:

- `form-helper-extension.zip` untuk Chrome/Chromium (background service worker).
- `form-helper-firefox.zip` untuk Firefox (background scripts/event page).

Ekstrak arsip yang sesuai, lalu muat folder hasil ekstrak lewat halaman Extensions dengan Developer mode dan **Load unpacked** di Chromium, atau `about:debugging` di Firefox desktop. Untuk Firefox Android, buat kredensial AMO API dan jalankan `npx web-ext sign --channel=unlisted --source-dir=/path/ke/folder-firefox-yang-diekstrak --api-key="$AMO_API_KEY" --api-secret="$AMO_API_SECRET"`. Hasil `.xpi` muncul di `web-ext-artifacts/`; pasang XPI yang ditandatangani melalui Firefox. Gunakan `form-helper-extension.zip` pada Chromium Android dan `form-helper-firefox.zip` pada Firefox; manifest Chromium tidak lagi memuat field khusus Firefox.

Buka **Pengaturan Form Helper** dari menu **Bantuan dan masukan** di Google Forms atau menu **Form Helper** di halaman HEBAT. Masukkan Base URL API dan token klien, pilih model, lalu setujui pemrosesan data. Di HEBAT tombol **Muat soal halaman ini** memindai halaman kuis yang sedang terbuka. Ikon bintang hanya meminta dan menampilkan saran; ikon klip memilih file lokal. Keduanya `type=button`, dan ekstensi tidak mengubah jawaban, mencegat navigasi, atau mengirim form kuis. Permintaan jawaban dikirim ke Vercel; log server hanya mencatat metadata permintaan. Moodle tetap dapat mencatat pemuatan halaman dan gambar normal yang dilakukan browser saat halaman kuis dibuka.

Untuk memeriksa ekstensi jalankan `npm run lint:extension`. Manifest menyediakan background event page untuk Firefox Android 142+ dan service worker untuk Chromium. Izin data Firefox mendeklarasikan `websiteContent` karena teks/gambar soal dikirim ke API setelah pengguna menekan tombol. Ikon browser khusus belum disertakan.

## Pengembangan

```sh
npm install
npm test
```

Fixture Google Forms ada di `tests/fixtures/questions.html`; parser HEBAT juga diuji dengan markup lokal dan snapshot halaman `HEBAT.md`. Test unit memakai provider palsu dan tidak memanggil layanan eksternal.

## Batas penggunaan

Gunakan sesuai aturan dosen/penyelenggara ujian. Tidak ada fitur penyamaran, anti-deteksi, atau pengisian otomatis. Log API hanya menyimpan metadata tipe soal, provider, status, latensi, dan kode error; isi pertanyaan dan gambar tidak dicatat.
