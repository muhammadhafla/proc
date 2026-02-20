# Deployment Guide

## Procurement & Product Intelligence System

Dokumentasi ini menjelaskan langkah-langkah untuk melakukan deployment sistem ke lingkungan production.

---

## Prerequisites

Pastikan perangkat Anda telah terinstall:

- **Node.js** (v18+) - [Download](https://nodejs.org)
- **npm** (v9+) - Sudah include dengan Node.js
- **Git** - [Download](https://git-scm.com)
- **Wrangler** - Sudah include di `devDependencies` (cukup jalankan dengan `npx`)

---

## 1. Setup Supabase

### 1.1 Buat Project Supabase

1. Buka [supabase.com](https://supabase.com) dan login
2. Klik **New Project**
3. Isi detail project:
   - **Name**: `procurement-system`
   - **Database Password**: Buat password yang kuat (simpan baik-baik)
   - **Region**: Pilih region terdekat (Singapore/sin1)
4. Klik **Create new project**
5. Tunggu beberapa menit hingga project siap

### 1.2 Setup Database Schema

1. Di dashboard Supabase, klik **SQL Editor** di sidebar
2. Klik **New query**
3. Copy isi file [`supabase/schema.sql`](supabase/schema.sql) dan paste ke SQL Editor
4. Klik **Run** untuk mengeksekusi
5. Schema akan membuat:
   - Tabel: `organizations`, `users`, `suppliers`, `models`, `procurement`, `procurement_images`
   - Row Level Security (RLS) policies
   - Trigger untuk auto user creation

### 1.3 Ambil Credentials

1. Klik **Project Settings** (icon gear) di sidebar
2. Klik **API**
3. Catat informasi berikut:
   - **Project URL**: Contoh `https://xxxxx.supabase.co`
   - **anon public** key: Contoh `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

---

## 2. Setup Cloudflare (CLI)

Semua setup Cloudflare bisa dilakukan via Wrangler CLI.

### 2.1 Login ke Cloudflare

```bash
npx wrangler login
```

Browser akan terbuka. Izinkan akses.

### 2.2 Buat R2 Bucket

```bash
npm run r2-create
```

### 2.3 Buat Worker dengan R2 Binding

Buat `wrangler.toml` di folder `workers/`:

```toml
name = "procurement-worker"
main = "upload.js"
compatibility_date = "2024-01-01"

[[r2_buckets]]
binding = "procurement_images"
bucket_name = "procurement-images"
```

Deploy Worker:

```bash
npm run deploy-worker
```

Atau bisa juga dengan script di package.json:

```bash
npm run deploy-worker
```

### 2.4 Dapatkan Worker URL

Setelah deploy, Worker URL akan muncul di output. Format:
```
https://procurement-worker.your-account.workers.dev
```

Simpan URL ini untuk configurasi.

---

## 3. Konfigurasi Environment Variables

### 3.1 Copy .env Example

```bash
cp .env.example .env
```

### 3.2 Edit .env

Buka file `.env` dan isi dengan credentials:

```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Cloudflare Worker URL
VITE_WORKER_URL=https://procurement-upload.your-account.workers.dev
```

> **Penting**: Pastikan tidak ada spasi di sekitar tanda `=`

---

## 4. Build Application

### 4.1 Install Dependencies

```bash
npm install
```

### 4.2 Build untuk Production

```bash
npm run build
```

Output akan berada di folder `dist/`.

### 4.3 Preview Build Lokal

```bash
npm run preview
```

Buka `http://localhost:4173` untuk preview.

---

## 5. Deployment dengan Wrangler (Cloudflare Pages)

Semua deployment bisa dilakukan via CLI.

### 5.1 Build Application

```bash
npm run build
```

### 5.2 Deploy ke Cloudflare Pages

```bash
npx wrangler pages project create procurement-system
npx wrangler pages deploy dist
```

Ikuti instruksi:
- Project name: `procurement-system`
- Production branch: `main`

### 5.3 Setup Environment Variables

```bash
npx wrangler secret put VITE_SUPABASE_URL
# Masukkan: your_supabase_url

npx wrangler secret put VITE_SUPABASE_ANON_KEY  
# Masukkan: your_anon_key

npx wrangler secret put VITE_WORKER_URL
# Masukkan: your_worker_url
```

### 5.4 Konfigurasi Cloudflare Pages (wrangler.toml)

Buat `wrangler.toml` di root project:

```toml
name = "procurement-system"
compatibility_date = "2024-01-01"
pages_build_output_dir = "dist"

[vars]
VITE_SUPABASE_URL = "your_supabase_url"
VITE_WORKER_URL = "your_worker_url"
```

Untuk `VITE_SUPABASE_ANON_KEY`, gunakan `wrangler secret` seperti di atas.

### 5.5 Deploy Sekaligus (Build + Deploy)

Tambahkan script di `package.json`:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "deploy": "npm run build && npx wrangler pages deploy dist",
    "deploy-worker": "npx wrangler deploy --config workers/wrangler.toml",
    "r2-create": "npx wrangler r2 bucket create procurement-images"
  }
}
```

Jalankan deploy:

```bash
npm run deploy
```

### 5.6 Satu Command untuk Semua (Worker + Pages + R2)

Jalankan secara berurutan:

```bash
# 1. Setup R2 Bucket
npm run r2-create

# 2. Deploy Worker
npm run deploy-worker

# 3. Build dan Deploy Pages
npm run deploy
```

---

## 6. Setup Authentication

### 6.1 Konfigurasi Supabase Auth

1. Buka **Authentication** → **Providers** di Supabase
2. **Email** sudah enable by default
3. Untuk social login:
   - Klik **GitHub** (atau provider lain)
   - Enable
   - Masukkan Client ID dan Secret
   - Klik **Save**

### 6.2 Setup Redirect URLs

1. Di Supabase Dashboard, klik **Authentication** → **URL Configuration**
2. Tambahkan redirect URLs:
   - `https://your-domain.com/auth/callback`
   - `http://localhost:5173/auth/callback` (development)
3. Klik **Save**

---

## 7. Verifikasi Deployment

### 7.1 Checklist

- [ ] Supabase project aktif
- [ ] Database schema ter-install
- [ ] Cloudflare R2 bucket created
- [ ] Cloudflare Worker deployed dan bisa diakses
- [ ] Environment variables sudah dikonfigurasi
- [ ] Build berhasil tanpa error
- [ ] Application bisa diakses di browser

### 7.2 Testing

1. Buka URL deployment
2. Coba register user baru
3. Login dengan user tersebut
4. Coba capture produk
5. Verifikasi data muncul di Supabase

### 7.3 Troubleshooting

#### Error: CORS

Pastikan Worker URL sudah benar di `.env` dan tidak ada typo.

#### Error: 401 Unauthorized

- Pastikan `VITE_SUPABASE_ANON_KEY` benar
- Cek RLS policies di Supabase

#### Error: Storage Upload Failed

- Cek konfigurasi R2 binding di Worker
- Pastikan bucket name sesuai

#### Error: Page Not Found (404)

Cloudflare Pages sudah otomatis menangani SPA routing. Pastikan `pages_build_output_dir` sudah diset di `wrangler.toml`:

```toml
pages_build_output_dir = "dist"
```

Jika masih ada masalah, tambahkan `_redirects` di folder `public/`:

---

## 8. Maintenance

### 8.1 Update Application

```bash
# Update dependencies
npm update

# Rebuild
npm run build

# Redeploy
npm run deploy
```

### 8.2 Backup Database

Di Supabase Dashboard:
1. Klik **Settings** → **Database**
2. Di bagian **Backups**, cek schedule
3. Untuk manual backup: **Backups** → **Create backup**

### 8.3 Monitoring

- **Cloudflare**: Dashboard → Analytics

---

## Quick Reference

### Setup Commands (Sekali saja)

```bash
# Login Cloudflare
npx wrangler login

# Buat R2 Bucket
npm run r2-create

# Deploy Worker
npm run deploy-worker

# Buat Pages Project
npx wrangler pages project create procurement-system
```

### Deployment Commands

```bash
# Build + Deploy (sekali command)
npm run deploy

# Atau manual:
npm run build
npx wrangler pages deploy dist
```

### Environment Variables

```bash
npx wrangler secret put VITE_SUPABASE_URL
npx wrangler secret put VITE_SUPABASE_ANON_KEY
npx wrangler secret put VITE_WORKER_URL
```

### Semua dalam Sekali Setup

```bash
# 1. Login
npx wrangler login

# 2. Setup R2
npm run r2-create

# 3. Deploy Worker
npm run deploy-worker

# 4. Build & Deploy Pages
npm run deploy

# 5. Setup Secrets
npx wrangler secret put VITE_SUPABASE_URL  # your_supabase_url
npx wrangler secret put VITE_SUPABASE_ANON_KEY  # your_anon_key
npx wrangler secret put VITE_WORKER_URL  # your_worker_url
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | Yes | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase anon key |
| `VITE_WORKER_URL` | Yes | Cloudflare Worker URL |

---

## Support

Jika mengalami masalah:

1. Cek [Troubleshooting](#troubleshooting) di atas
2. Cek console browser untuk error messages
3. Cek network tab untuk failed requests
4. Review deployment logs di platform hosting
