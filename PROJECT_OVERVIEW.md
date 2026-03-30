# Sistem Manajemen Peralatan Kantor - Gambaran Umum Proyek 🏢

## 1. Tujuan Proyek
Aplikasi ini adalah **Sistem Manajemen Peralatan Kantor** yang komprehensif, dirancang untuk melacak, mengelola, dan memfasilitasi peminjaman aset kantor. Sistem ini melayani tiga jenis pengguna utama: **Admin**, **Petugas (Officer)**, dan **Karyawan (User)**, yang bertujuan untuk menyederhanakan proses kontrol inventaris dan peminjaman peralatan.

## 2. Stack Teknologi 🛠️

### Frontend (Tampilan)
- **Framework**: React.js (Vite)
- **Styling**: Tailwind CSS (Framework CSS utility-first)
- **Ikon**: React Icons (Feather Icons, FontAwesome)
- **Manajemen State**: React Context API (`AuthContext`, `SocketContext`)
- **Routing**: React Router DOM (Navigasi halaman)
- **HTTP Client**: Axios (Koneksi ke backend)
- **Notifikasi**: React Hot Toast
- **Grafik**: Recharts

### Backend (Server)
- **Runtime**: Node.js
- **Framework**: Express.js
- **ORM Database**: Sequelize
- **Database**: MySQL
- **Real-time**: Socket.io (untuk notifikasi instan)
- **Upload File**: Multer (untuk gambar barang)
- **Keamanan**: CORS, Helmet (dasar), Rate Limiting (pembatasan request)

## 3. Fitur & Modul Utama 📦

### A. Autentikasi & Peran (Roles)
- **Sistem Login**: Akses aman menggunakan JWT (JSON Web Tokens).
- **Kontrol Akses Berbasis Peran (RBAC)**:
  - **Admin**: Akses penuh ke semua modul, termasuk Manajemen User dan data master.
  - **Petugas (Officer)**: Mengelola Barang, Kategori, dan menyetujui/menolak permintaan Peminjaman.
  - **User**: Dapat menelusuri barang, mengajukan peminjaman, dan melihat riwayat sendiri.

### B. Dashboard
- **Kartu Statistik**: Total Barang, Barang Tersedia, Peminjaman Aktif, dll.
- **Grafik**:
  - *Tren Peminjaman*: Grafik garis yang menunjukkan aktivitas dari waktu ke waktu.
  - *Status Barang*: Diagram lingkaran ketersediaan vs dipinjam.
  - *Barang Terpopuler*: Grafik batang peralatan yang sering digunakan.
- **Aktivitas Terbaru**: Tampilan cepat log aktivitas terkini.

### C. Manajemen Inventaris
- **Barang (Items)**: Operasi CRUD (Buat, Baca, Ubah, Hapus) untuk peralatan.
  - Termasuk upload gambar, pelacakan stok, status kondisi (Bagus, Rusak, dll).
- **Kategori**: Pengelompokan barang (misal: Elektronik, Mebel) untuk organisasi yang lebih baik.
- **Manajemen Stok**: Melacak jumlah total vs tersedia secara otomatis.

### D. Alur Peminjaman 🔄
1.  **Pengajuan**: User memilih barang -> klik "Pinjam" -> isi form (Tanggal, Tujuan).
2.  **Tinjauan**: Status transaksi menjadi `pending`. Petugas mendapat notifikasi.
3.  **Persetujuan/Penolakan**: Petugas menyetujui (status -> `approved`) atau menolak.
4.  **Serah Terima**: User mengambil barang -> Petugas menandai sebagai `borrowed` (dipinjam).
5.  **Pengembalian**: User mengembalikan barang -> Petugas menandai sebagai `returned` (dikembalikan, stok pulih).
6.  **Pelacakan Terlambat**: Sistem menyoroti barang yang belum dikembalikan sesuai tanggal jatuh tempo.

### E. Laporan & Log
- **Log Aktivitas**: Jejak audit mendetail tentang siapa melakukan apa (misal: "User X membuat permintaan peminjaman", "Petugas Y menyetujui permintaan").
- **Laporan**: Data yang dapat diekspor (PDF/Excel) untuk inventaris dan riwayat peminjaman.

## 4. Struktur Direktori Utama 📂

### Backend (`/`)
- `server.js`: Titik masuk utama. Menyiapkan server Express, koneksi database, dan Socket.io.
- `/models`: Definisi skema database (User, Item, Borrowing, dll).
- `/controllers`: Logika untuk menangani permintaan API.
- `/routes`: Definisi endpoint API yang menghubungkan URL ke controller.
- `/middleware`: Pemeriksaan autentikasi, penangan upload file.

### Frontend (`/office-equipment-frontend/src`)
- `/pages`: Komponen tampilan utama.
  - `Dashboard.jsx`: Pusat analitik, tampilan berbeda untuk Admin vs User.
  - `BrowseItems.jsx`: Katalog gaya "E-commerce" untuk user.
  - `Borrowings.jsx`: Tampilan Admin/Petugas untuk mengelola permintaan.
  - `MyBorrowings.jsx`: Riwayat pribadi untuk user standar.
- `/components`: Bagian UI yang dapat digunakan kembali (Navbar, Sidebar, Modal, Kartu).
- `/contexts`: Penyedia state global (`AuthContext` untuk status login).
- `/api`: Fungsi pemanggilan API terpusat.

## 5. Perbaikan Terbaru ✨
- **Optimasi Mobile**: Penyesuaian tata letak responsif untuk pengalaman seluler yang lebih baik.
- **Notifikasi Real-time**: Integrasi Socket.io untuk memberi tahu petugas tentang permintaan baru secara instan.
- **Peningkatan Keamanan**: Menambahkan pembatasan laju (rate limiting) untuk mencegah penyalahgunaan.
- **UI Bersih**: Antarmuka modern dan bersih dengan dukungan mode gelap (diatur via sistem/class).
