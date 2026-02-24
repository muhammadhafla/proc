# Rencana Implementasi - Perbaikan Kode

## Ringkasan
Rencana ini menjelaskan langkah-langkah untuk memperbaiki semua masalah kritis, sedang, dan rendah yang ditemukan dalam analisis kode.

---

## Fase 1: Perbaikan Kritis (Prioritas Tinggi)

### 1.1 Perbaiki Akses appState di detail.js
**File**: `src/pages/detail.js:349`

**Kode Saat Ini**:
```javascript
user_id: appState.user?.id,
```

**Kode yang Diperbaiki**:
```javascript
user_id: appState.get('user')?.id,
```

**Langkah-langkah**:
1. Buka `src/pages/detail.js`
2. Navigasi ke baris 349
3. Ganti `appState.user?.id` dengan `appState.get('user')?.id`
4. Verifikasi dengan memeriksa penggunaan appState lain di file tersebut

---

### 1.2 Tambah Transaction Error Handling di db.js
**File**: `src/modules/db.js`

**Fungsi yang Harus Diperbaiki**:
- `cacheSuppliers()` (baris 219)
- `cacheModels()` (baris 328)

**Kode Saat Ini**:
```javascript
export async function cacheSuppliers(suppliers) {
  if (!suppliers || suppliers.length === 0) {
    return;
  }
  
  const db = await getDB();
  const tx = db.transaction('suppliers', 'readwrite');
  const store = tx.objectStore('suppliers');
  
  // Use bulkPut for better performance
  for (const supplier of suppliers) {
    store.put(supplier);
  }
  
  return tx.done;
}
```

**Kode yang Diperbaiki**:
```javascript
export async function cacheSuppliers(suppliers) {
  if (!suppliers || suppliers.length === 0) {
    return;
  }
  
  const db = await getDB();
  
  try {
    const tx = db.transaction('suppliers', 'readwrite');
    const store = tx.objectStore('suppliers');
    
    // Add error handling
    tx.onerror = () => {
      console.error('Transaction failed:', tx.error);
    };
    
    // Use bulkPut for better performance
    for (const supplier of suppliers) {
      store.put(supplier);
    }
    
    return tx.done;
  } catch (error) {
    console.error('Failed to cache suppliers:', error);
    throw error;
  }
}
```

**Langkah-langkah**:
1. Buka `src/modules/db.js`
2. Temukan fungsi `cacheSuppliers()`
3. Tambahkan wrapper try-catch
4. Tambahkan handler `tx.onerror`
5. Ulangi untuk fungsi `cacheModels()`

---

### 1.3 Tambah Blob Cleanup di capture.js
**File**: `src/pages/capture.js`

**Masalah Saat Ini**: Ketika `batchItems` dihapus, URL blob tidak direvoke

**Langkah-langkah**:
1. Tambahkan fungsi untuk membersihkan batch dengan cleanup blob:
```javascript
function clearBatchItems() {
  batchItems.forEach(item => {
    if (item.blob) {
      revokeBlobUrl(URL.createObjectURL(item.blob));
    }
  });
  batchItems = [];
  updateBatchIndicator();
}
```

2. Ganti `batchItems = []` dengan `clearBatchItems()` di:
   - Sekitar baris 490 (setelah simpan)
   - Sekitar baris 576 (saat membersihkan batch)

---

### 1.4 Hapus Duplicate Auth Checks di app.js
**File**: `src/modules/app.js`

**Masalah Saat Ini**: Baris 22-26 memiliki panggilan getUser() dan getSession() yang redundan

**Kode Saat Ini**:
```javascript
const { data: { user }, error } = await getUser();
// Kemudian langsung:
const { data: { session } } = await supabase.auth.getSession();
```

**Kode yang Diperbaiki**:
```javascript
const { data: { session }, error } = await supabase.auth.getSession();

if (session && !error) {
  // Session aktif, restore state
  await handleAuthChange('SIGNED_IN', session);
}
```

**Langkah-langkah**:
1. Buka `src/modules/app.js`
2. Hapus panggilan `getUser()` di baris 22
3. Pertahankan hanya panggilan `getSession()`
4. Update referensi apapun ke variabel `user`

---

## Fase 2: Perbaikan Prioritas Sedang

### 2.1 Optimasi Queue Cleanup di sync.js
**File**: `src/modules/sync.js`

**Kode Saat Ini** (di uploadQueue.js - implementasi sebenarnya):
```javascript
export async function clearCompletedQueue() {
  const db = await getDB();
  const tx = db.transaction('uploadQueue', 'readwrite');
  const index = tx.store.index('status');
  const completed = await index.getAllKeys('success');
  
  for (const key of completed) {
    await tx.store.delete(key); // Sekuensial - tidak efisien
  }
  
  return tx.done;
}
```

**Kode yang Diperbaiki**:
```javascript
export async function clearCompletedQueue() {
  const db = await getDB();
  const tx = db.transaction('uploadQueue', 'readwrite');
  const index = tx.store.index('status');
  const completed = await index.getAllKeys('success');
  
  // Hapus semua secara paralel
  await Promise.all(completed.map(key => tx.store.delete(key)));
  
  return tx.done;
}
```

---

### 2.2 Hapus Route batch Redundan
**File**: `src/modules/router.js`

**Kode Saat Ini**:
```javascript
batch: {
  render: () => router.navigate('capture'),
  requiresAuth: true,
},
```

**Opsi A**: Hapus route entirely
**Opsi B**: Jaga tapi ubah ke render langsung (direkomendasikan)

**Kode yang Diperbaiki**:
```javascript
// Hapus entry 'batch' dari routes object
```

**Langkah-langkah**:
1. Buka `src/modules/router.js`
2. Hapus entri 'batch' dari object routes
3. Test navigasi masih berfungsi

---

### 2.3 Perbaiki Performa Theme Toggle
**File**: `src/pages/login.js`

**Masalah**: Baris 201-293 mengupdate elemen secara individual

**Solusi**: Gunakan toggling kelas CSS

**Langkah-langkah**:
1. Tambahkan kelas CSS untuk tema light/dark
2. Ganti update elemen individual dengan toggling kelas
3. Gunakan satu pemanggilan fungsi `applyTheme()`

---

## Fase 3: Perbaikan Prioritas Rendah

### 3.1 Tambah Error Retry Logic ke API
**File**: `src/modules/api.js`

**Implementasi**:
```javascript
async function fetchWithRetry(fn, maxRetries = 3) {
  let lastError;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (i < maxRetries - 1) {
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
      }
    }
  }
  throw lastError;
}
```

---

### 3.2 Tambah Unit Tests
Buat file test untuk:
- `tests/db.test.js` - Operasi IndexedDB
- `tests/api.test.js` - Panggilan API
- `tests/state.test.js` - Manajemen state

---

### 3.3 Migrasi TypeScript
1. Install TypeScript: `npm install -D typescript`
2. Buat `tsconfig.json`
3. Rename file ke `.ts` secara progresif
4. Tambahkan definisi tipe

---

## Timeline Implementasi

| Fase | Tugas | Estimasi Waktu |
|------|-------|----------------|
| Fase 1 | 4 perbaikan kritis | 2 jam |
| Fase 2 | 3 perbaikan sedang | 3 jam |
| Fase 3 | 3 perbaikan rendah | 4 jam |

**Total**: ~9 jam

---

## Checklist Verifikasi

Setelah setiap perbaikan:
- [ ] Jalankan aplikasi
- [ ] Periksa console browser untuk error
- [ ] Test fungsionalitas spesifik
- [ ] Verifikasi tidak ada regresi

---

## Mitigasi Risiko

1. **Backup**: Buat git branch sebelum membuat perubahan
2. **Inkremental**: Buat satu perbaikan pada satu waktu
3. **Pengujian**: Test setiap perbaikan secara individual
4. **Rollback**: Simpan branch backup untuk quick rollback jika diperlukan

---

*Rencana dibuat: 2026-02-23*
