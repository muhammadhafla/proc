# Online-Only Migration Plan dengan Optimistic Queue

## Arsitektur Baru

```
┌─────────────────────────────────────────────────────────────┐
│                        USER FLOW                            │
├─────────────────────────────────────────────────────────────┤
│  1. User capture foto                                       │
│         ↓                                                   │
│  2. Tampilkan "Tersimpan" (OPTIMISTIC - di memory)        │
│         ↓                                                   │
│  3. Queue untuk upload (3 concurrent max)                  │
│         ↓                                                   │
│  4. Upload ke server                                        │
│         ↓                                                   │
│  5. Success → Update UI / Failed → Show retry button       │
└─────────────────────────────────────────────────────────────┘
```

---

## Todo List Implementation

### Task 1: Analisis dan Persiapan

- [x] Analisis kode yang ada - DONE
- [x] Tentukan arsitektur - DONE
- [ ] Backup state management yang ada

---

### Task 2: Refactor `src/modules/db.js`

**Objective:** Hapus upload queue, tetap simpan untuk read cache

**Changes:**

```javascript
// KEEP:
- initDB()
- getDB()
- getProcurements()
- getProcurement()
- getProcurementsBySupplier()
- cacheSuppliers()
- getSuppliers()
- getSupplierByName()
- cacheModels()
- getModels()
- getModelByName()

// REMOVE/HIDE:
- addToQueue()          // Tidak perlu, langsung upload
- getPendingItems()    // Ganti dengan uploadQueue module
- updateQueueItem()    // Ganti dengan uploadQueue module
- removeFromQueue()    // Ganti dengan uploadQueue module
- getAllQueueItems()   // Ganti dengan uploadQueue module
- clearCompletedQueue() // Ganti dengan uploadQueue module

// RENAME:
- saveProcurement() → cacheProcurement()  // Untuk display dari cache
```

---

### Task 3: Create New `src/modules/uploadQueue.js`

**Objective:** Simple queue untuk upload dengan optimistic UI

```javascript
// Fungsi utama:
// - add(item) → langsung return "queued", upload di background
// - getStatus(id) → dapat status upload
// - retry(id) → retry failed upload
// - getAll() → dapat semua queue items

// Concurrent upload: max 3 simultaneously
// Retry: exponential backoff (1s, 2s, 4s, max 30s)
// Persistence: localStorage (simpler dari IndexedDB)
```

---

### Task 4: Refactor `src/modules/dataService.js`

**Objective:** Langsung API call dengan optimistic UI

**Changes:**

```javascript
// SEBELUM (offline-first):
async function saveProcurementItem(item) {
  // 1. Save ke local DB
  await saveProcurement({...});
  // 2. Add ke queue
  await addToQueue({...});
  // 3. Return id
  return procurementId;
}

// SESUDAH (online-only + optimistic):
async function saveProcurementItem(item) {
  // 1. Generate temp ID
  const tempId = generateTempId();
  
  // 2. Display ke user sebagai "pending"
  notifyUploadQueued(tempId, item);
  
  // 3. Add ke upload queue (background)
  await uploadQueue.add({
    id: tempId,
    data: item,
    status: 'pending'
  });
  
  // 4. Langsung mulai upload
  uploadQueue.processQueue();
  
  return tempId;
}
```

---

### Task 5: Refactor `src/modules/sync.js`

**Objective:** Jadikan simple upload processor

**Changes:**

```javascript
// SEBELUM:
// - Complex sync engine
// - IndexedDB queue
// - Auto-sync every 30s

// SESUDAH:
// - Simple upload processor
// - Memory queue (dari uploadQueue.js)
// - Triggered by: user action + retry

// Hapus:
// - start(), stop() - auto sync
// - testNetworkConnectivity() - assume online
// - handleOnline() - assume online
// - periodic sync interval

// Keep:
// - processItem() - upload single item
// - retry logic - exponential backoff
```

---

### Task 6: Update `src/pages/capture.js`

**Objective:** Optimistic display, queue upload

**Changes:**

```javascript
// SEBELUM:
// 1. capturePhoto()
// 2. saveProcurementItem() → IndexedDB + queue
// 3. Redirect to home

// SESUDAH:
// 1. capturePhoto()
// 2. saveProcurementItem() → optimistic: tampilkan "Tersimpan"
// 3. Upload berjalan di background
// 4. Show toast: "Foto ditambahkan, mengupload..."
// 5. Jika gagal: "Upload gagal, coba lagi?"
```

---

### Task 7: Update `src/pages/batch.js`

**Objective:** Parallel upload dengan progress

**Changes:**

```javascript
// SEBELUM:
// 1. Batch capture → saveProcurementItem() untuk semua
// 2. IndexedDB store semua
// 3. Sync engine upload satu-satu

// SESUDAH:
// 1. Batch capture → add ke uploadQueue (semua)
// 2. UI: "X foto di queue, Y sedang upload"
// 3. Parallel upload (max 3)
// 4. Progress indicator per foto
// 5. Retry individual kalau gagal

// UI Component:
// ┌─────────────────────────────────┐
// │ Batch Upload [3/10]             │
// ├─────────────────────────────────┤
// │ [✓] Foto 1        ✓ Success     │
// │ [✓] Foto 2        ✓ Success     │
// │ [▓] Foto 3        ⏳ Uploading  │
// │ [ ] Foto 4        ⏳ Waiting    │
// │ [ ] Foto 5        ⏳ Waiting    │
// │ [✗] Foto 6        ❌ Retry      │
// └─────────────────────────────────┘
```

---

### Task 8: Simplify `public/sw.js`

**Objective:** Hanya cache app shell, tidak perlu offline API

```javascript
// Hapus semua API caching logic
// Keep hanya:
// - Cache static assets (HTML, JS, CSS, images)
// - Offline fallback untuk navigation
```

---

### Task 9: Update API Module

**Objective:** Support optimistic flow

```javascript
// Tambahkan:
// - Batch upload endpoint
// - Idempotency key support
// - Progress callback untuk upload

// Contoh:
async function uploadProcurement(item, onProgress) {
  // Check online
  if (!navigator.onLine) {
    throw new Error('Offline - item will upload when online');
  }
  
  // Upload dengan progress
  const result = await api.createProcurement(item, onProgress);
  
  return result;
}
```

---

## Files to Modify

| Priority | File | Action |
|----------|------|--------|
| 1 | `src/modules/uploadQueue.js` | CREATE - new queue module |
| 2 | `src/modules/dataService.js` | REFACTOR - optimistic API |
| 3 | `src/modules/db.js` | MODIFY - hapus queue functions |
| 4 | `src/modules/sync.js` | REFACTOR - simple upload |
| 5 | `src/pages/capture.js` | MODIFY - optimistic UI |
| 6 | `src/pages/batch.js` | MODIFY - progress UI |
| 7 | `public/sw.js` | SIMPLIFY - hanya static cache |
| 8 | `src/modules/api.js` | ENHANCE - batch + progress |

---

## Implementation Order

```
Week 1:
├── Day 1: Create uploadQueue.js
├── Day 2: Refactor dataService.js
├── Day 3: Modify db.js
└── Day 4: Simplify sync.js

Week 2:
├── Day 5-6: Update capture.js
├── Day 7: Update batch.js
└── Day 8: Simplify sw.js

Week 3:
├── Day 9: Update api.js
├── Day 10: Integration testing
└── Day 11-12: Bug fixes
```

---

## Migration Checklist

- [ ] Create uploadQueue module
- [ ] Test optimistic display
- [ ] Test parallel upload (3 concurrent)
- [ ] Test retry logic
- [ ] Test batch upload progress
- [ ] Test offline error handling
- [ ] Remove old sync-related code
- [ ] Update documentation
