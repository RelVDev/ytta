# Analisis Frekuensi Rumus & Cheatsheet Fisika Dasar

Analisis ini dilakukan terhadap seluruh berkas soal di [`db-soal-fisika/Soal [.txt]`](./db-soal-fisika/Soal%20[.txt]).

## 1. Ringkasan Dataset & Cakupan Materi

- **Total berkas diperiksa**: 47 file `.txt` (46 mahasiswa unik + 1 salinan duplikat milik `626108110014_Lovyta Harni Savitri`).
- **Total butir soal terparsing**: **1.879 soal** $\rightarrow$ **1.782 soal unik** setelah deduplikasi teks soal yang sama persis.
- **Sifat soal**:
  - **1.121 soal unik (~62,9%)** menguji penggunaan rumus, hitungan numerik, atau perbandingan proporsional.
  - **661 soal unik (~37,1%)** menguji konsep kualitatif, definisi, ciri-ciri, atau fenomena.

### Distribusi Soal per Bab (1.782 Soal Unik)

| Bab / Topik Utama | Total Soal Unik | Proporsi | Soal Rumus / Hitungan |
| --- | ---: | ---: | ---: |
| **Osilasi & Gerak Harmonik Sederhana (GHS)** | 471 | 26,4% | 295 |
| **Fluida (Statis & Dinamis)** | 438 | 24,6% | 287 |
| **Gelombang Mekanik & Bunyi** | 389 | 21,8% | 249 |
| **Suhu, Pemuaian & Kalor** | 354 | 19,9% | 237 |
| **Teori Kinetik Gas & Termodinamika** | 85 | 4,8% | 47 |
| **Lainnya / Umum** | 45 | 2,5% | 6 |
| **Total** | **1.782** | **100%** | **1.121** |

> **Pola komposisi kuis**: Rata-rata tiap file berisi 40 soal yang terbagi merata (~10 soal per bab besar: Fluida, Osilasi, Gelombang & Bunyi, serta Suhu/Kalor/Termodinamika).

---

## 2. Peringkat Rumus yang Paling Sering Muncul

Tabel berikut diurutkan berdasarkan jumlah **soal unik bertipe rumus/hitungan/perbandingan** yang memakai konsep rumus tersebut (*catatan: satu soal dapat memakai lebih dari satu rumus, misalnya soal Hukum Hooke + Periode Pegas, atau Gas Ideal + Konversi Suhu*).

| Peringkat | Soal Rumus (Unik) | Total Terkait (Termasuk Konseptual) | Bab | Konsep & Rumus Utama |
| :---: | ---: | ---: | --- | --- |
| **1** | **194** | 212 | Gelombang & Bunyi | Cepat rambat gelombang dasar ($v = \lambda f = \lambda/T$, $n\lambda = L$) |
| **2** | **127** | 152 | Suhu & Kalor | Konversi skala suhu ($C : R : (F-32) = 5 : 4 : 9$, $K = C + 273$) |
| **3** | **78** | 109 | Osilasi / GHS | Persamaan & kinematika GHS ($y = A\sin(\omega t+\varphi)$, $v_{\text{maks}} = \omega A$, $a_{\text{maks}} = \omega^2 A$) |
| **4** | **70** | 81 | Fluida | Debit & persamaan kontinuitas ($Q = V/t = Av$, $A_1 v_1 = A_2 v_2$) |
| **5** | **68** | 78 | Osilasi / GHS | Periode & frekuensi pegas ($T = 2\pi\sqrt{m/k}$, $\omega = \sqrt{k/m}$) |
| **6** | **67** | 77 | Osilasi / GHS | Periode, frekuensi & frekuensi sudut ($T = t/n = 1/f$, $\omega = 2\pi f$) |
| **7** | **56** | 71 | Fluida | Tekanan hidrostatis & pipa U ($P_h = \rho g h$, $\rho_1 h_1 = \rho_2 h_2$) |
| **8** | **54** | 92 | Fluida | Hukum Archimedes / gaya apung ($F_a = \rho_f g V_{\text{celup}}$, $w_{\text{semu}} = w - F_a$) |
| **9** | **45** | 61 | Osilasi / GHS | Energi GHS ($E_m = \frac{1}{2}kA^2$, $E_p = \frac{1}{2}ky^2$, $E_k = \frac{1}{2}k(A^2-y^2)$) |
| **10** | **45** | 61 | Osilasi / GHS | Bandul sederhana ($T = 2\pi\sqrt{L/g}$) |
| **11** | **44** | 68 | Fluida | Hukum Pascal / dongkrak hidrolik ($F_1/A_1 = F_2/A_2$) |
| **12** | **43** | 49 | Gelombang & Bunyi | Persamaan gelombang berjalan & beda fase ($y = A\sin(\omega t \pm kx)$, $\Delta\varphi = \Delta x/\lambda$) |
| **13** | **41** | 67 | Gas & Termo | Persamaan gas ideal & hukum gas ($PV = nRT$, $P_1 V_1/T_1 = P_2 V_2/T_2$) |
| **14** | **37** | 53 | Osilasi / GHS | Hukum Hooke, gaya pemulih & susunan pegas ($F = -kx$, $k_p, k_s$) |
| **15** | **37** | 42 | Suhu & Kalor | Pemuaian panjang ($\Delta L = L_0\alpha\Delta T$) |
| **16** | **36** | 45 | Fluida | Massa jenis ($\rho = m/V$) *(di luar soal yang hanya memakai $\rho_{\text{air}}$ sebagai konstanta bantu)* |
| **17** | **35** | 52 | Gelombang & Bunyi | Gelombang stasioner, dawai & pipa organa ($f_n = (n+1)v/2L$, $(2n+1)v/4L$) |
| **18** | **33** | 40 | Gelombang & Bunyi | Intensitas & taraf intensitas bunyi ($I = P/4\pi r^2$, $TI = 10\log(I/I_0)$) |
| **19** | **28** | 29 | Gelombang & Bunyi | Hukum Melde / gelombang dawai ($v = \sqrt{F/\mu} = \sqrt{FL/m}$) |
| **20** | **23** | 26 | Fluida | Tekanan mutlak / gauge ($P_{\text{abs}} = P_0 + \rho gh = P_0 + P_{\text{gauge}}$) |
| **21** | **22** | 25 | Suhu & Kalor | Skala termometer X ($\frac{X - X_b}{X_a - X_b} = \frac{C - 0}{100}$) |
| **22** | **21** | 23 | Gelombang & Bunyi | Laju bunyi di medium ($v = \sqrt{B/\rho}$) & sonar/gema ($s = \frac{1}{2}vt$) |
| **23** | **20** | 41 | Fluida | Persamaan Bernoulli, Venturimeter & sayap ($P + \frac{1}{2}\rho v^2 + \rho gh = \text{konstan}$) |
| **24** | **19** | 32 | Gelombang & Bunyi | Efek Doppler ($f_p = \frac{v \pm v_p}{v \mp v_s} f_s$) |
| **25** | **14** | 16 | Gas & Termo | Teori kinetik gas & Boltzmann ($E_k = \frac{3}{2}k_BT$, $v_{\text{rms}} = \sqrt{3RT/M}$, $U = \frac{f}{2}nRT$) |
| **26** | **14** | 14 | Suhu & Kalor | Kalor sensibel & kapasitas kalor ($Q = mc\Delta T$, $C = mc$) |
| **27** | **13** | 14 | Fluida | Teorema Torricelli / tangki bocor ($v = \sqrt{2gh}$, $x = 2\sqrt{h_1 h_2}$) |
| **28** | **10** | 10 | Fluida | Tekanan dasar ($P = F/A$) |
| **29** | **10** | 10 | Suhu & Kalor | Pemuaian luas & volume ($\beta = 2\alpha$, $\gamma = 3\alpha$) |
| **30** | **10** | 11 | Suhu & Kalor | Asas Black ($Q_{\text{lepas}} = Q_{\text{terima}}$) |
| **31** | **10** | 15 | Fluida | Viskositas & Hukum Stokes ($F_s = 6\pi\eta r v$, $v_t$) |
| **32** | **8** | 9 | Fluida | Tegangan permukaan ($\gamma = F/L$ atau $F/(2L)$) |
| **33** | **6** | 7 | Suhu & Kalor | Kalor laten ($Q = mL$) |
| **34** | **5** | 5 | Gelombang & Bunyi | Daya gelombang pada tali ($P = \frac{1}{2}\mu v \omega^2 A^2$) |
| **35–41** | **2–3** | 2–5 | Campuran | Bandul fisis/puntir (3), Konduksi (3), Radiasi & Konveksi (3), Kapilaritas (3), Usaha & Hukum I Termo (2), Mesin Carnot & Entropi (2), Pelayangan bunyi (2) |

---

## 3. Konstanta & Konvensi Penting di Bank Soal

Berdasarkan pemeriksaan angka pada seluruh soal:
- **Percepatan gravitasi ($g$)**: Mayoritas memakai **$g = 10\text{ m/s}^2$** (muncul eksplisit di 65 soal), sebagian kecil memakai **$g = 9{,}8\text{ m/s}^2$** (8 soal).
- **Tekanan atmosfer ($P_0$)**: Umumnya dipakai **$10^5\text{ Pa} = 100\text{ kPa}$** (19 soal) atau **$101\text{ kPa} / 1{,}01 \times 10^5\text{ Pa}$** (8 soal). Cek opsi jawaban bila $P_0$ tidak ditulis di soal.
- **Massa jenis air ($\rho_{\text{air}}$)**: $1.000\text{ kg/m}^3 = 1\text{ g/cm}^3$.
- **Intensitas ambang bunyi ($I_0$)**: $10^{-12}\text{ W/m}^2$.
- **Konversi suhu Kelvin**: Umumnya memakai **$T(\text{K}) = T(^\circ\text{C}) + 273$** (kadang $273{,}15$).
- **Pendekatan $\pi$**: Sering dipakai $\pi^2 \approx 10$ pada soal pegas/bandul, atau $\pi$ dibiarkan simbolik / $3{,}14$.

---

## 4. Cheatsheet Rumus Fisika Dasar (Per Bab)

Legenda prioritas kemunculan:
- `★★★` : **Wajib hafal** (sangat sering muncul, $\ge 40$ soal)
- `★★☆` : **Sering muncul** (15–39 soal)
- `★☆☆` : **Pelengkap / sesekali muncul** ($\le 14$ soal)

---

### A. Suhu, Pemuaian & Kalor

#### 1. Konversi Skala Suhu `★★★`
$$
\frac{C}{5} = \frac{R}{4} = \frac{F - 32}{9} = \frac{K - 273}{5}
$$
- **Selisih suhu ($\Delta T$)**: $\Delta C : \Delta R : \Delta F = 5 : 4 : 9$, dan $\Delta K = \Delta C$.
- **Skala Rankine** *(muncul di 2 soal)*: $^\circ\text{Ra} = ^\circ\text{F} + 459{,}67 \approx \frac{9}{5}K$.
- **Titik temu skala**: $^\circ\text{C} = ^\circ\text{F}$ terjadi pada **$-40^\circ$**.

#### 2. Termometer Skala Sembarang (Termometer X) `★★☆`
$$
\frac{X - X_{\text{bawah}}}{X_{\text{atas}} - X_{\text{bawah}}} = \frac{C - 0}{100 - 0}
$$
- $X_{\text{bawah}}$: titik tetap bawah (es mencair), $X_{\text{atas}}$: titik tetap atas (air mendidih).

#### 3. Pemuaian Zat `★★☆`
- **Muai panjang**: $\Delta L = L_0\,\alpha\,\Delta T \implies L = L_0(1 + \alpha\,\Delta T)$
- **Muai luas**: $\Delta A = A_0\,\beta\,\Delta T$, dengan $\beta = 2\alpha$
- **Muai volume**: $\Delta V = V_0\,\gamma\,\Delta T$, dengan $\gamma = 3\alpha$
- **Cairan dalam bejana penuh (volume tumpah)**: $V_{\text{tumpah}} = V_0(\gamma_{\text{cair}} - 3\alpha_{\text{bejana}})\Delta T$
- **Koefisien suhu hambatan jenis** *(variasi)*: $\rho = \rho_0[1 + \alpha(T - T_0)]$

#### 4. Kalor, Perubahan Wujud & Asas Black `★☆☆`
- **Kalor sensibel (ubah suhu)**: $Q = m\,c\,\Delta T$
- **Kapasitas kalor**: $C = m\,c = \dfrac{Q}{\Delta T}$
- **Kalor laten (ubah wujud)**: $Q = m\,L$ ($L_{\text{lebur es}} \approx 80\text{ kal/g} = 3{,}36 \times 10^5\text{ J/kg}$)
- **Asas Black**: $Q_{\text{lepas}} = Q_{\text{terima}}$ *(untuk es $0^\circ\text{C}$ menjadi air, jangan lupa $m_{\text{es}} L_{\text{lebur}} + m_{\text{es}} c_{\text{air}} (T_{\text{camp}} - 0)$)*

#### 5. Perpindahan Kalor `★☆☆`
- **Konduksi**: $H = \dfrac{Q}{t} = \dfrac{k\,A\,\Delta T}{L}$
- **Konveksi**: $H = h\,A\,\Delta T$
- **Radiasi (Stefan-Boltzmann)**: $P = \dfrac{Q}{t} = e\,\sigma\,A\,T^4$ *(suhu $T$ wajib dalam Kelvin!)*, $\sigma = 5{,}67 \times 10^{-8}\text{ W/m}^2\text{K}^4$
- **Pergeseran Wien**: $\lambda_{\text{maks}}\,T = b \approx 2{,}9 \times 10^{-3}\text{ m}\cdot\text{K}$

---

### B. Fluida (Statis & Dinamis)

#### 1. Besaran Dasar & Tekanan Hidrostatis `★★★`
- **Massa jenis**: $\rho = \dfrac{m}{V}$ *(konversi: $1\text{ g/cm}^3 = 1.000\text{ kg/m}^3$)*
- **Tekanan dasar**: $P = \dfrac{F}{A}$ *(dengan $F = w = mg$ untuk benda berdiri/menekan lantai)*
- **Tekanan hidrostatis**: $P_h = \rho\,g\,h$ *($h$ diukur dari permukaan fluida ke titik tinjau)*
- **Pipa U / Bejana berhubungan**: $\rho_1\,h_1 = \rho_2\,h_2$
- **Tekanan mutlak (absolut) & gauge**:
  $$P_{\text{abs}} = P_0 + P_{\text{gauge}} = P_0 + \rho\,g\,h$$

#### 2. Hukum Pascal (Hidrolik) `★★★`
$$
\frac{F_1}{A_1} = \frac{F_2}{A_2} \implies \frac{F_1}{d_1^2} = \frac{F_2}{d_2^2} = \frac{F_1}{r_1^2} = \frac{F_2}{r_2^2}
$$
- Bila mengangkat mobil/beban: $F_2 = m_{\text{beban}}\,g$.

#### 3. Hukum Archimedes (Gaya Apung) `★★★`
$$
F_a = \rho_f\,g\,V_{\text{celup}}
$$
- **Berat semu di fluida**: $w_{\text{fluida}} = w_{\text{udara}} - F_a$ *(atau gaya minimum mengangkat benda di air: $F_{\text{angkat}} = mg - \rho_f g V$)*
- **Benda terapung seimbang**:
  $$\frac{V_{\text{celup}}}{V_{\text{total}}} = \frac{\rho_{\text{benda}}}{\rho_{\text{fluida}}}$$
  *(Jika $20\%$ di udara, maka $V_{\text{celup}}/V = 80\% \implies \rho_b = 0{,}8\,\rho_f$)*
- **Beban maksimum pelampung/rakit**: $m_{\text{beban maks}} = \rho_f\,V_{\text{pelampung}} - m_{\text{pelampung}}$

#### 4. Debit & Persamaan Kontinuitas `★★★`
$$
Q = \frac{V}{t} = A\,v \qquad\text{dan}\qquad A_1\,v_1 = A_2\,v_2 \implies d_1^2\,v_1 = d_2^2\,v_2
$$
- Jika jari-jari menjadi $2\times$ semula, maka $v_2 = v_1 / 4$ (berbanding terbalik dengan $r^2$ atau $d^2$).

#### 5. Persamaan Bernoulli & Aplikasinya `★★☆`
$$
P_1 + \frac{1}{2}\rho v_1^2 + \rho g h_1 = P_2 + \frac{1}{2}\rho v_2^2 + \rho g h_2
$$
- **Pipa mendatar ($h_1 = h_2$)**:
  $$\Delta P = P_1 - P_2 = \frac{1}{2}\rho\left(v_2^2 - v_1^2\right)$$
- **Gaya angkat sayap pesawat**: $F_{\text{angkat}} = \frac{1}{2}\rho_{\text{udara}}\left(v_{\text{atas}}^2 - v_{\text{bawah}}^2\right)A$
- **Venturimeter tanpa manometer**: $v_1 = A_2\sqrt{\dfrac{2gh}{A_1^2 - A_2^2}}$
- **Tabung Pitot**: $v = \sqrt{\dfrac{2\rho' g h}{\rho_{\text{gas}}}}$

#### 6. Teorema Torricelli (Tangki Bocor) `★☆☆`
- **Laju semburan air**: $v = \sqrt{2 g h}$ *($h$ = jarak lubang dari **permukaan atas** air)*
- **Jarak pancaran mendatar**: $x = 2\sqrt{h \cdot h_{\text{dasar}}}$ *($h_{\text{dasar}}$ = jarak lubang dari tanah/dasar)*
- **Waktu jatuh pancaran**: $t = \sqrt{\dfrac{2 h_{\text{dasar}}}{g}}$

#### 7. Viskositas, Tegangan Permukaan & Kapilaritas `★☆☆`
- **Gaya Stokes**: $F_s = 6\pi\,\eta\,r\,v$
- **Kecepatan terminal**: $v_t = \dfrac{2 r^2 g (\rho_b - \rho_f)}{9\eta}$
- **Tegangan permukaan**: $\gamma = \dfrac{F}{L}$ (kawat/batang satu permukaan) atau $\gamma = \dfrac{F}{2L}$ (**lapisan tipis sabun** memiliki 2 permukaan!)
- **Kapilaritas**: $h = \dfrac{2\gamma\cos\theta}{\rho\,g\,r}$

---

### C. Osilasi & Gerak Harmonik Sederhana (GHS)

#### 1. Periode, Frekuensi & Frekuensi Sudut `★★★`
$$
T = \frac{t}{n} = \frac{1}{f} \qquad f = \frac{n}{t} = \frac{1}{T} \qquad \omega = 2\pi f = \frac{2\pi}{T}
$$
- **Jarak tempuh 1 getaran penuh** = $4A$ *(dalam $n$ getaran, jarak total $= 4nA$)*.

#### 2. Kinematika GHS `★★★`
- **Persamaan simpangan**: $y = A\sin(\omega t + \varphi_0)$ atau $x = A\cos(\omega t + \varphi_0)$
- **Kecepatan**: $v = \omega A\cos(\omega t + \varphi_0) = \pm\,\omega\sqrt{A^2 - y^2}$
- **Percepatan**: $a = -\omega^2 y = -\omega^2 A\sin(\omega t + \varphi_0)$
- **Nilai maksimum**:
  $$v_{\text{maks}} = \omega A \qquad\text{dan}\qquad a_{\text{maks}} = \omega^2 A$$
- **Saat di titik setimbang ($y = 0$)**: $v = v_{\text{maks}}$, $E_k = E_m$, sedangkan $a = 0$, $F = 0$, $E_p = 0$.
- **Saat di titik balik ($y = \pm A$)**: $v = 0$, $E_k = 0$, sedangkan $|a| = a_{\text{maks}}$, $E_p = E_m$.

#### 3. Sistem Pegas & Hukum Hooke `★★★`
- **Hukum Hooke / gaya pemulih**: $F = -k\,x$ *(pada gerak harmonik: $F = m\,a = -m\omega^2 y$)*
- **Periode & frekuensi pegas**:
  $$T = 2\pi\sqrt{\frac{m}{k}} \qquad f = \frac{1}{2\pi}\sqrt{\frac{k}{m}} \qquad \omega = \sqrt{\frac{k}{m}}$$
  *(Jika massa dijadikan $4\times$, periode menjadi $2\times$; amplitudo tidak memengaruhi $T$!)*
- **Susunan pegas**:
  - **Paralel**: $k_p = k_1 + k_2 + \dots$
  - **Seri**: $\dfrac{1}{k_s} = \dfrac{1}{k_1} + \dfrac{1}{k_2} + \dots$

#### 4. Bandul Sederhana & Bandul Fisis/Puntir `★★★`
- **Bandul sederhana**:
  $$T = 2\pi\sqrt{\frac{L}{g}} \qquad f = \frac{1}{2\pi}\sqrt{\frac{g}{L}}$$
  *(Tidak bergantung pada massa bandul maupun amplitudo kecil!)*
- **Bandul fisis** *(jarang)*: $T = 2\pi\sqrt{\dfrac{I}{m g d}}$
- **Bandul puntir** *(jarang)*: $T = 2\pi\sqrt{\dfrac{I}{\kappa}}$

#### 5. Energi pada GHS `★★★`
$$
E_m = \frac{1}{2}kA^2 = \frac{1}{2}m\omega^2 A^2 \qquad E_p = \frac{1}{2}ky^2 \qquad E_k = \frac{1}{2}k(A^2 - y^2) = \frac{1}{2}mv^2
$$
- **Trik cepat**: Saat $E_k = E_p$, maka $y = \dfrac{A}{\sqrt{2}} = \dfrac{1}{2}A\sqrt{2}$. Jika $A$ dijadikan $2\times$, energi mekanik $E_m$ menjadi $4\times$.

---

### D. Gelombang Mekanik & Bunyi

#### 1. Cepat Rambat Gelombang Dasar `★★★`
$$
v = \lambda\,f = \frac{\lambda}{T} \qquad\text{dan}\qquad \lambda = \frac{L}{n_{\text{gelombang}}}
$$
- **Menghitung $n_{\text{gelombang}}$**:
  - Puncak ke-$1$ sampai puncak ke-$k$ $\implies n = k - 1$ gelombang.
  - 1 bukit + 1 lembah = $1\lambda$; puncak ke lembah berdekatan = $\frac{1}{2}\lambda$.

#### 2. Persamaan Gelombang Berjalan & Beda Fase `★★★`
$$
y = A\sin(\omega t \mp kx) \quad\text{atau}\quad y = A\sin 2\pi\left(\frac{t}{T} \mp \frac{x}{\lambda}\right)
$$
- **Tanda di dalam $\sin/\cos$**:
  - $\omega t - kx$ $\rightarrow$ merambat ke **kanan ($+x$)**
  - $\omega t + kx$ $\rightarrow$ merambat ke **kiri ($-x$)**
- **Hubungan parameter**:
  $$\omega = 2\pi f = \frac{2\pi}{T} \qquad k = \frac{2\pi}{\lambda} \qquad v = \frac{\omega}{k} = \lambda f$$
- **Beda fase dua titik berjarak $\Delta x$**: $\Delta\varphi = \dfrac{\Delta x}{\lambda}$ (beda sudut fase $\Delta\theta = 2\pi\dfrac{\Delta x}{\lambda}$).

#### 3. Gelombang Stasioner, Dawai & Pipa Organa `★★☆`
- **Gelombang stasioner**:
  - Ujung tetap/terikat: $y_s = 2A\sin(kx)\cos(\omega t)$
  - Ujung bebas: $y_s = 2A\cos(kx)\sin(\omega t)$
  - Jarak dua simpul (atau dua perut) berurutan = $\dfrac{1}{2}\lambda$; jarak simpul ke perut berdekatan = $\dfrac{1}{4}\lambda$.
- **Frekuensi nada pada dawai / pipa organa terbuka**:
  $$f_n = \frac{(n + 1)v}{2L}, \quad n = 0, 1, 2, \dots \qquad \left(f_0 : f_1 : f_2 = 1 : 2 : 3\right)$$
- **Frekuensi nada pada pipa organa tertutup**:
  $$f_n = \frac{(2n + 1)v}{4L}, \quad n = 0, 1, 2, \dots \qquad \left(f_0 : f_1 : f_2 = 1 : 3 : 5\right)$$

#### 4. Cepat Rambat Gelombang Tali (Hukum Melde) & Daya `★★☆`
$$
v = \sqrt{\frac{F}{\mu}} = \sqrt{\frac{F\,L}{m}} \qquad\text{dengan } \mu = \frac{m}{L}
$$
- **Daya rata-rata gelombang tali** *(5 soal)*: $P = \frac{1}{2}\,\mu\,v\,\omega^2 A^2$.

#### 5. Laju Bunyi di Medium & Pemantulan (Sonar/Gema) `★★☆`
- **Laju bunyi dalam fluida**: $v = \sqrt{\dfrac{B}{\rho}}$ ($B$ = modulus bulk/limbak)
- **Laju bunyi dalam zat padat**: $v = \sqrt{\dfrac{E}{\rho}}$ ($E$ = modulus Young)
- **Laju bunyi dalam gas**: $v = \sqrt{\dfrac{\gamma R T}{M}}$
- **Sonar / Gema / Kedalaman laut**: $s = \dfrac{v \cdot t}{2}$ *(dibagi 2 karena bunyi bolak-balik)*

#### 6. Intensitas & Taraf Intensitas Bunyi `★★☆`
$$
I = \frac{P}{A} = \frac{P}{4\pi r^2} \implies \frac{I_2}{I_1} = \left(\frac{r_1}{r_2}\right)^2
$$
$$
TI = 10\log\left(\frac{I}{I_0}\right)\text{ dB} \qquad\left(I_0 = 10^{-12}\text{ W/m}^2\right)
$$
- **Perubahan jarak**: $TI_2 = TI_1 - 20\log\left(\dfrac{r_2}{r_1}\right)$
- **Banyak sumber identik ($n$ buah)**: $TI_n = TI_1 + 10\log n$

#### 7. Efek Doppler & Pelayangan Bunyi `★★☆`
$$
f_p = \left(\frac{v \pm v_p}{v \mp v_s}\right) f_s
$$
- **Aturan tanda cepat**:
  - Pengamat ($v_p$) **mendekati** sumber $\rightarrow$ **$+v_p$**; **menjauh** $\rightarrow$ **$-v_p$**
  - Sumber ($v_s$) **mendekati** pengamat $\rightarrow$ **$-v_s$**; **menjauh** $\rightarrow$ **$+v_s$**
- **Pelayangan bunyi** *(2 soal)*: $f_{\text{layang}} = |f_1 - f_2|$

---

### E. Teori Kinetik Gas & Termodinamika

#### 1. Persamaan Gas Ideal & Hukum Gas `★★★`
$$
P\,V = n\,R\,T = N\,k_B\,T \qquad\text{dan}\qquad \frac{P_1 V_1}{T_1} = \frac{P_2 V_2}{T_2}
$$
- **Suhu $T$ WAJIB Kelvin ($^\circ\text{C} + 273$)!**
- **Isotermal ($T$ tetap / Hukum Boyle)**: $P_1 V_1 = P_2 V_2$
- **Isobarik ($P$ tetap / Hukum Charles)**: $\dfrac{V_1}{T_1} = \dfrac{V_2}{T_2}$
- **Isokhorik ($V$ tetap / Hukum Gay-Lussac)**: $\dfrac{P_1}{T_1} = \dfrac{P_2}{T_2}$
- $R = 8{,}314\text{ J/(mol}\cdot\text{K)} = 0{,}082\text{ L}\cdot\text{atm/(mol}\cdot\text{K)}$, $k_B = 1{,}38 \times 10^{-23}\text{ J/K}$.

#### 2. Teori Kinetik Gas & Statistik Boltzmann `★★☆`
- **Energi kinetik rata-rata molekul**:
  - Monoatomik ($f=3$): $\overline{E_k} = \frac{3}{2} k_B T$
  - Umum ($f$ derajat kebebasan): $\overline{E_k} = \frac{f}{2} k_B T$
- **Kelajuan efektif ($v_{\text{rms}}$)**:
  $$v_{\text{rms}} = \sqrt{\frac{3 R T}{M}} = \sqrt{\frac{3 k_B T}{m}} = \sqrt{\frac{3 P}{\rho}}$$
- **Energi dalam gas ideal**: $U = \dfrac{f}{2} n R T = \dfrac{f}{2} P V$ ($f=3$ monoatomik, $f=5$ diatomik suhu ruang)
- **Faktor / Rasio Boltzmann**: $\dfrac{N_2}{N_1} = e^{-\Delta E / (k_B T)}$ *(konversi $1\text{ eV} = 1{,}6 \times 10^{-19}\text{ J}$, atau $k_B \approx 8{,}617 \times 10^{-5}\text{ eV/K}$)*

#### 3. Hukum I Termodinamika, Usaha, Mesin Carnot & Entropi `★☆☆`
- **Hukum I Termodinamika**: $\Delta U = Q - W$ *(dengan perjanjian: $Q>0$ menyerap kalor, $W>0$ melakukan usaha)*
- **Usaha ($W$)**:
  - Isobarik: $W = P\,\Delta V$
  - Isokhorik: $W = 0 \implies Q = \Delta U$
  - Isotermal: $\Delta U = 0 \implies Q = W = n R T \ln\left(\dfrac{V_2}{V_1}\right)$
  - Adiabatik: $Q = 0 \implies W = -\Delta U$, berlaku $P V^\gamma = \text{konstan}$
- **Efisiensi mesin kalor & Carnot**:
  $$\eta = \frac{W}{Q_h} = 1 - \frac{Q_c}{Q_h} \qquad\text{dan}\qquad \eta_{\text{Carnot}} = 1 - \frac{T_c}{T_h}$$
- **Perubahan entropi (proses isotermal/reversibel)**: $\Delta S = \dfrac{Q}{T}$

---

## 5. Daftar Jebakan Konversi Satuan yang Paling Sering Keluar

1. **Luas & Volume**: $1\text{ cm}^2 = 10^{-4}\text{ m}^2$, $1\text{ cm}^3 = 10^{-6}\text{ m}^3$, $1\text{ liter} = 10^{-3}\text{ m}^3$. *(Sering dipakai di $P=F/A$, Hukum Pascal, dan Debit $Q$).*
2. **Suhu mutlak**: Selalu ubah $^\circ\text{C} \to \text{K}$ ($+273$) pada rumus **Gas Ideal, $v_{\text{rms}}$, Energi Kinetik Gas, Radiasi $T^4$, Carnot, dan Entropi**, sedangkan pada $\Delta T$ ($Q=mc\Delta T$, $\Delta L = L_0\alpha\Delta T$, konduksi), selisih $^\circ\text{C} = \text{K}$.
3. **Tekanan gauge vs absolut**: Pengukur tekanan ban menunjukkan tekanan *gauge*; tekanan absolut harus ditambah $P_0 \approx 101\text{ kPa}$ atau $100\text{ kPa}$.
4. **Diameter vs Luas penampang**: Pada Pascal & Kontinuitas, jika soal memberi **diameter ($d$)** atau **jari-jari ($r$)**, rasio luas adalah **kuadratnya** ($\frac{A_1}{A_2} = \frac{d_1^2}{d_2^2}$).
5. **Lapisan sabun**: Kawat yang menarik **lapisan tipis sabun** memiliki 2 sisi permukaan, sehingga $\gamma = \dfrac{F}{2L}$ (bukan $F/L$).
6. **Gema / Sonar**: Waktu $t$ yang dicatat adalah waktu pergi + pulang, jadi jarak $s = \dfrac{v\,t}{2}$.
