# Alfatih - Bendahara

Aplikasi web pencatatan keuangan dan tabungan santri berbasis multi-peran (**Admin** dan **Wali Santri**).

## Fitur Utama

1. **Autentikasi & Manajemen Akun**
   - **Login Otomatis Sesuai Peran:** Sistem membaca peran akun (`Admin` atau `Wali Santri`) secara internal saat tombol **Masuk** ditekan.
   - **Validasi Akun Terdaftar:** Jika username belum terdaftar, pengguna otomatis diarahkan ke halaman **Create Account**.
   - **Kelola Akun (Khusus Admin):** Admin dapat langsung membuatkan akun baru untuk **Wali Santri** maupun **Admin** langsung dari menu **Kelola Akun** tanpa harus keluar aplikasi.
   - **Reset Password:** Pemulihan kata sandi berdasarkan kecocokan Username dan Nama Lengkap terdaftar.
   - **Coba Demo:** Akses cepat untuk mengecek seluruh fitur aplikasi.

2. **Hak Akses Multi-Peran**
   - **Admin:** Akses penuh pada menu **Beranda**, **Daftar Santri** (tambah santri, hapus santri satuan/banyak sekaligus, cek profil santri, input transaksi keuangan), **Hasil Laporan** (edit/hapus transaksi, filter per santri, ekspor Excel & PDF), serta **Kelola Akun**.
   - **Wali Santri:** Akses *read-only* (hanya memantau) yang otomatis tersaring khusus untuk data santri milik nama akun yang login.

3. **Ekspor Laporan (Excel & PDF)**
   - Nama file unduhan untuk **Wali Santri** otomatis memakai nama masing-masing (misalnya `Galih.xlsx` dan `Galih.pdf`).
   - Cetakan **PDF** dilengkapi tanda tangan rata tengah (*center*) **Mengetahui, Muhammad Galih Assyafi**.

## Struktur File

```text
alfatih-bendahara/
├── index.html   # Struktur halaman utama, autentikasi, dashboard & modal
├── style.css    # Styling kustom, animasi transisi & scrollbar
├── script.js    # Logika aplikasi, manajemen akun, filter & ekspor Excel/PDF
└── README.md    # Dokumentasi aplikasi
```

## Akun Bawaan (Pengujian)

| Peran | Nama Lengkap | Username | Kata Sandi |
| :--- | :--- | :--- | :--- |
| **Admin** | Riski | `riski_123` | `password123` |
| **Wali Santri** | Sahal | `sahal_123` | `password123` |
| **Wali Santri** | Galih | `galih_123` | `password123` |

## Cara Menjalankan & Deploy

1. Pastikan `index.html`, `style.css`, dan `script.js` berada dalam **satu folder yang sama**.
2. Klik dua kali `index.html` untuk menjalankan langsung di browser.
3. Untuk meng-online-kan, unggah seluruh isi folder ke **Netlify**, **Vercel**, **GitHub Pages**, atau **cPanel (`public_html`)**.
