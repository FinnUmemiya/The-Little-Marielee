# The Little Marielee — Soft Whitelist Website

Website whitelist bertema **soft pastel** (ungu muda, pink soft, rounded, glass effect), lengkap dengan animasi, validasi form, dan dashboard admin.

## Struktur Folder

```
the-little-marielee/
├── index.html                 # Halaman utama
├── admin.html                 # Dashboard admin (lihat data whitelist)
├── css/
│   ├── style.css              # Styling utama (soft pastel, animasi, responsive)
│   └── admin.css              # Styling khusus dashboard admin
├── js/
│   ├── main.js                # Logic modal + validasi + Google Sheet
│   └── admin.js                # Logic dashboard admin
├── google-apps-script.js      # Kode yang di-paste ke Google Apps Script
├── vercel.json                 # Config Vercel (clean URL /admin, noindex)
├── assets/                    # (kosong, siap untuk gambar nanti)
└── README.md
```

## 1. Setup Google Sheet (WAJIB untuk data real)

1. Buka [Google Sheets](https://sheets.google.com) → buat spreadsheet baru
2. Rename sheet pertama menjadi **`Whitelist`**
3. Isi header di baris 1:
   | A | B | C | D |
   |---|---|---|---|
   | Timestamp | Twitter | Wallet | Status |
4. Klik **Extensions → Apps Script**
5. Hapus kode default, lalu **copy-paste seluruh isi** file `google-apps-script.js`
6. Klik ikon gerigi **Project Settings → Script Properties → Add script property**
   - Property: `ADMIN_KEY`
   - Value: bikin string acak & rahasia sendiri (ini "password" dashboard admin kamu)
7. Simpan (Ctrl+S / Cmd+S)
8. Klik **Deploy → New deployment**
   - Type: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
9. Klik **Deploy** → Authorize → copy **Web App URL**
10. Ganti `GOOGLE_SCRIPT_URL` dengan URL tadi di **dua file**:
    - `js/main.js`
    - `js/admin.js`

```js
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/xxxxx/exec";
```

> Kalau kamu ubah kode Apps Script lagi nanti, jangan lupa **Deploy → Manage deployments → Edit (ikon pensil) → New version → Deploy** — bukan cuma Save, atau perubahan tidak akan live.

## 2. Dashboard Admin (`/admin`)

- Buka `admin.html` (atau `yourdomain.com/admin` setelah deploy ke Vercel)
- Masukkan `ADMIN_KEY` yang sama dengan yang kamu set di Script Properties
- Setelah masuk, kamu bisa:
  - **Ubah Link & Sosial Media (X/Twitter, Post Retweet, Discord, Telegram)** langsung dari admin
  - Lihat semua entri whitelist (waktu daftar, username X, wallet, status)
  - Cari berdasarkan username/wallet
  - Sort per kolom (klik header tabel)
  - Copy alamat wallet lengkap
  - Hapus entri
  - Export ke CSV

**Catatan keamanan (penting):** ini situs statis tanpa server sendiri, jadi ini bukan sistem login "sungguhan". `ADMIN_KEY` dicocokkan di sisi Apps Script (server), jadi orang lain tidak bisa lihat data tanpa key yang benar — tapi key tetap terlihat di request jaringan saat dipakai. Jangan share link `/admin` atau key-nya, dan ganti `ADMIN_KEY` kalau kamu curiga bocor. Untuk data sensitif dalam jumlah besar, pertimbangkan proteksi tambahan (misalnya Vercel Password Protection di paket Pro/Team).

## 3. Deploy ke Vercel

1. Push folder ini ke GitHub (atau drag-drop langsung di dashboard Vercel)
2. Di [vercel.com](https://vercel.com) → **Add New → Project** → import repo ini
3. Framework preset: pilih **Other** (situs ini HTML/CSS/JS statis, tidak butuh build step)
4. Deploy — selesai. `vercel.json` sudah mengatur:
   - `/admin` otomatis mengarah ke `admin.html`
   - Header `noindex` di halaman admin supaya tidak muncul di hasil pencarian Google

## Cara Menjalankan Lokal

```bash
cd the-little-marielee
python -m http.server 8080
```

Lalu buka `http://localhost:8080` (situs utama) dan `http://localhost:8080/admin.html` (admin).

## Fitur

**Situs utama**
- Animasi masuk saat halaman dibuka (hero fade-up bertahap), elemen "The Soft Garden" muncul saat di-scroll
- Modal whitelist dengan transisi antar step, progress bar animasi
- Validasi inline: username X (2–15 karakter, huruf/angka/underscore) & format wallet (EVM/Solana/umum), dengan pesan error & shake animation, bukan cuma ganti warna border
- Notifikasi (toast) untuk sukses/gagal, termasuk saat wallet ternyata sudah pernah didaftarkan
- Tombol Follow X memakai warna slate-lavender yang senada dengan palet, bukan biru Twitter default
- Loading spinner di tombol saat submit, disabled state yang jelas
- State tersimpan di localStorage supaya tidak submit ganda di device yang sama
- Responsive penuh dari 320px sampai desktop lebar, hormat `prefers-reduced-motion`

**Dashboard admin**
- Gate dengan admin key (dicek server-side)
- Tabel sortable + searchable, export CSV, hapus entri, copy wallet

## Customisasi Cepat

| Yang ingin diubah | File | Keterangan |
|-------------------|------|------------|
| Warna utama | `css/style.css` → `:root` | `--primary`, `--accent`, `--x-color`, dll |
| Nama project | `index.html` | Cari "Marielee" |
| Link Twitter Follow | `index.html` | Cari `MarieleeHQ` |
| Link Post RT | `index.html` | Cari `Open Post on X` |
| Teks lore | `index.html` | Section `.about-text` |
| Validasi wallet | `js/main.js` → `isPlausibleWalletAddress` | Tambah/ubah pola chain lain |

## Catatan

- Mode demo (tanpa `GOOGLE_SCRIPT_URL` diisi) tetap jalan di `index.html` dan `admin.html` dengan data dummy, jadi kamu bisa preview desain sebelum backend siap.
- Setelah Apps Script di-deploy dengan benar, count, submit, dan dashboard admin akan pakai data real dari Google Sheet.
- Pastikan Web App access = **Anyone**, atau frontend tidak bisa fetch data.
