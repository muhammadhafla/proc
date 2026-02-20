# Procurement System

Offline-first procurement and product intelligence system built with Supabase and Cloudflare.

## Tech Stack

- **Frontend**: Vanilla JavaScript, Tailwind CSS, PWA
- **Backend**: Supabase (PostgreSQL, Auth)
- **Storage**: Cloudflare R2
- **Edge**: Cloudflare Workers

## Getting Started

### 1. Setup Supabase

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Go to SQL Editor and run the schema from `supabase/schema.sql`
3. Get your Supabase URL and anon key from Settings → API

### 2. Setup Cloudflare

1. Create a Cloudflare account
2. Create an R2 bucket named `procurement-images`
3. Create a Worker with the code in `workers/upload.js`
4. Bind the R2 bucket to the worker

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your credentials:
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_WORKER_URL=https://your-worker.your-account.workers.dev
```

### 4. Install Dependencies

```bash
npm install
```

### 5. Run Development Server

```bash
npm run dev
```

### 6. Build for Production

```bash
npm run build
```

## Project Structure

```
├── src/
│   ├── main.js              # Entry point
│   ├── modules/
│   │   ├── api.js           # Supabase API
│   │   ├── app.js           # App initialization
│   │   ├── config.js        # Configuration
│   │   ├── compression.js   # Image compression
│   │   ├── db.js            # IndexedDB (offline)
│   │   ├── router.js        # Simple router
│   │   └── sync.js          # Sync engine
│   ├── pages/
│   │   ├── login.js
│   │   ├── home.js
│   │   ├── capture.js       # Single capture
│   │   ├── batch.js        # Batch capture
│   │   ├── list.js         # History
│   │   └── detail.js       # Detail view
│   └── styles/
│       └── main.css
├── workers/
│   ├── upload.js           # Signed URL worker
│   └── wrangler.toml
├── supabase/
│   └── schema.sql          # Database schema
├── public/
│   └── manifest.json       # PWA manifest
├── package.json
├── vite.config.js
└── tailwind.config.js
```

## Features

- **Offline-first**: Works without internet, syncs when connected
- **Single Capture**: Quick single item capture
- **Batch Capture**: High-speed capture for wholesale
- **Image Compression**: Automatic JPEG compression
- **Supplier Management**: Track suppliers
- **Model Database**: Product catalog
- **History**: View past procurements

## Development Phases

1. **Phase 0**: Core Infrastructure (Setup Supabase, Cloudflare)
2. **Phase 1**: Single Capture (End-to-end pipeline)
3. **Phase 2**: Offline Foundation (IndexedDB, sync)
4. **Phase 3**: Batch Capture
5. **Phase 4**: Viewing/History
6. **Phase 5**: Search & Autocomplete
7. **Phase 6**: Compression
8. **Phase 7**: Correction & Audit

## License

MIT
