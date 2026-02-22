# Solusi Batch Capture untuk Online-Only

## Masalah dengan Full Online Batch Capture

Jika full online-only, batch capture menghadapi tantangan:

| Tantangan | Dampak |
|-----------|--------|
| **Internet lambat** | Upload 1 per 1 - lambat |
| **Batch besar (50+ foto)** | Queue panjang, user tunggu lama |
| **Koneksi putus** | Sebagian data hilang |
| **User experience** | Tidak bisa capture terus-terusan |

---

## Solusi yang Mungkin

### Opsi 1: Queue System dengan Progress

即使 online-only, tetap butuh queue untuk batch. Bedanya: langsung proses, bukan simpan lokal.

```javascript
// Batch upload dengan parallel processing
async function uploadBatch(items) {
  const CONCURRENT_LIMIT = 3; // Maksimal 3 upload sekaligus
  
  const results = [];
  const queue = [...items];
  
  // Process dengan concurrency limit
  const workers = Array(CONCURRENT_LIMIT).fill(null).map(async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      try {
        const result = await uploadSingleItem(item);
        results.push({ success: true, data: result });
      } catch (error) {
        results.push({ success: false, error, item });
      }
    }
  });
  
  await Promise.all(workers);
  return results;
}
```

**UI Progress:**
```
Uploading: [#####....] 50%
├────────────────────────────────
✓ Foto 1-3 berhasil
✗ Foto 4 gagal - retry otomatis
⏳ Foto 5-7 menunggu
```

### Opsi 2: Background Upload dengan Optimistic UI

User langsung bisa lanjut capture, upload berjalan di background.

```javascript
// Optimistic - langsung "selesai" untuk UX
async function captureAndQueue(item) {
  // 1. Langsung tampilkan "terkirim"
  displayAsSent(item);
  
  // 2. Queue untuk upload
  uploadQueue.add(item);
  
  // 3. Background process
  backgroundUpload();
}

// Background worker
async function backgroundUpload() {
  while (queue.hasItems()) {
    const item = queue.getNext();
    try {
      await uploadSingleItem(item);
      updateUI(item.id, 'success');
    } catch (error) {
      if (canRetry(error)) {
        queue.retryLater(item);
      } else {
        updateUI(item.id, 'failed', error.message);
      }
    }
  }
}
```

**UX:**
- User: "Foto ke-5 tersimpan" (instant)
- Sistem: Upload di background
- Kalau gagal: "Foto 4 gagal upload, coba lagi?"

### Opsi 3: PWA dengan Background Sync

Manfaatkan Service Worker untuk background upload even kalau app tertutup.

```javascript
// Register background sync
async function requestBackgroundSync() {
  if ('serviceWorker' in navigator && 'sync' in window.SyncManager) {
    const reg = await navigator.serviceWorker.ready;
    await reg.sync.register('upload-batch');
  }
}

// Di Service Worker
self.addEventListener('sync', event => {
  if (event.tag === 'upload-batch') {
    event.waitUntil(doBackgroundUpload());
  }
});
```

---

## Rekomendasi untuk Proyek Ini

Berdasarkan sistem yang sudah ada, saya sarankan:

### Hybrid: Optimistic dengan Queue

1. **Tangkap foto** → langsung simpan ke memory (bukan IndexedDB)
2. **Tampilkan ke user** → "Tersimpan lokal"
3. **Upload bertahap** → 3 concurrent connections
4. **Retry otomatis** → exponential backoff
5. **Tandai sukses/gagal** → visible ke user

```javascript
// flow baru
capture → memory → queue → [parallel upload: 3] → server
                ↓
           IndexedDB (cache for display, bukan source of truth)
```

### Apa yang Dihapus vs Dijaga

| Komponen | Offline-First Lama | Hybrid Baru |
|----------|-------------------|-------------|
| **Write ke IndexedDB** | ✅ Source of truth | ❌ Hapus - langsung ke API |
| **Sync Engine** | ✅ Complex queue | ✅ Sederhana - hanya retry |
| **Conflict Resolution** | ✅ Perlu | ❌ Tidak perlu (online) |
| **Service Worker** | Cache app shell | Cache + background sync |

---

## Perbandingan Effort

| Solusi | Effort Implementasi | Kelemahan |
|--------|---------------------|----------|
| **Full Online** | Rendah | User harus online terus |
| **Optimistic + Queue** | Sedang | Still need retry logic |
| **Full Offline-First** | Tinggi | Kompleks (seperti rencana sebelumnya) |

---

## Pertanyaan untuk Keputusan

1. **Berapa banyak foto per sesi capture?** (10, 50, 100+)
2. **Koneksi di lokasi pengguna:** stabil atau sering putus?
3. **Apakah boleh ada jeda** antara capture dan upload, atau harus instant?

Dengan jawaban ini bisa tentukan mana solusi yang paling cocok.
