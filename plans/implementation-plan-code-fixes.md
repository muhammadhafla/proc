# Rencana Implementasi Perbaikan Kode

Dokumen ini berisi rencana implementasi untuk memperbaiki isu-isu yang ditemukan dalam analisis kode sebelumnya.

---

## Daftar Isi

1. [Ringkasan Isu](#ringkasan-isu)
2. [Prioritas Tinggi](#prioritas-tinggi)
3. [Prioritas Sedang](#prioritas-sedang)
4. [Prioritas Rendah](#prioritas-rendah)
5. [Jadwal Implementasi](#jadwal-implementasi)

---

## Ringkasan Isu

| # | File | Severity | Impact |
|---|------|----------|--------|
| 1 | sync.js:262 | Tinggi | Performa saat cleanup queue |
| 2 | detail.js:349 | Kritis | Potential crash |
| 3 | db.js:213 | Tinggi | Data corruption |
| 4 | app.js:22 | Sedang | Lambat saat startup |
| 5 | capture.js:576 | Tinggi | Memory leak |
| 6 | router.js:23 | Rendah | Kode redundan |
| 7 | login.js:181 | Sedang | Performa saat theme toggle |

---

## Prioritas Tinggi

### 1. Perbaiki appState Access di detail.js

**File**: `src/pages/detail.js:349`

**Masalah**:
```javascript
// Salah - menggunakan property langsung
user_id: appState.user?.id,

// Seharusnya menggunakan get()
user_id: appState.get('user')?.id,
```

**Impact**: Potential undefined reference error

**Solusi**:
```javascript
user_id: appState.get('user')?.id,
```

---

### 2. Tambahkan Error Handling di db.js

**File**: `src/modules/db.js:213`

**Masalah**: Transaksi IndexedDB tidak memiliki error handling

**Solusi**:
```javascript
export async function cacheSuppliers(suppliers) {
  if (!suppliers || suppliers.length === 0) {
    return;
  }
  
  const db = await getDB();
  const tx = db.transaction('suppliers', 'readwrite');
  const store = tx.objectStore('suppliers');
  
  // Add error handling
  tx.onerror = () => {
    console.error('Transaction failed:', tx.error);
  };
  
  for (const supplier of suppliers) {
    store.put(supplier);
  }
  
  return tx.done;
}
```

---

### 3. Perbaiki Blob Cleanup di capture.js

**File**: `src/pages/capture.js:576`

**Masalah**: Blob URLs tidak di-revoke saat batch dikosongkan

**Solusi**:
```javascript
// Tambahkan import
import { revokeBlobUrl } from '../modules/camera.js';

// Modifikasi fungsi clearBatch
function clearBatch() {
  // Revoke all blob URLs before clearing
  batchItems.forEach(item => {
    if (item.blob) {
      // Create a temporary blob to revoke URL
      const url = URL.createObjectURL(item.blob);
      revokeBlobUrl(url);
    }
  });
  batchItems = [];
  updateBatchIndicator();
}

// Atau saat handleBack
document.getElementById('btn-confirm-discard').onclick = () => {
  // Cleanup blobs first
  batchItems.forEach(item => {
    if (item.blob) {
      const url = URL.createObjectURL(item.blob);
      revokeBlobUrl(url);
    }
  });
  batchItems = [];
  // ... rest of function
};
```

---

## Prioritas Sedang

### 4. Optimasi Queue Cleanup di sync.js

**File**: `src/modules/sync.js:262`

**Masalah**: Sequential deletion menyebabkan performa buruk

**Solusi**:
```javascript
// Sebelum (line 262-269)
async function cleanupCompleted() {
  const items = await getAllQueueItems();
  const completed = items.filter(item => item.status === 'success');
  
  for (const item of completed) {
    await removeFromQueue(item.id);
  }
}

// Sesudah - parallel deletion
async function cleanupCompleted() {
  const items = await getAllQueueItems();
  const completed = items.filter(item => item.status === 'success');
  
  if (completed.length === 0) return;
  
  // Delete in parallel
  await Promise.all(completed.map(item => removeFromQueue(item.id)));
}
```

---

### 5. Hapus Duplicate Auth Check di app.js

**File**: `src/modules/app.js:22`

**Masalah**: Dua kali pengecekan auth saat startup

**Solusi**:
```javascript
// Sebelum
const { data: { user }, error } = await getUser();
if (user && !error) {
  const { data: { session } } = await supabase.auth.getSession();
  // ...
}

// Sesudah - gunakan getSession saja jika user sudah tersedia
const { data: { session }, error } = await supabase.auth.getSession();

if (session && !error) {
  await handleAuthChange('SIGNED_IN', session);
} else {
  // Check for magic link
  const magicLinkProcessed = await handleMagicLinkCallback();
  if (!magicLinkProcessed) {
    router.navigate('login');
  }
}
```

---

### 6. Optimasi Theme Toggle di login.js

**File**: `src/pages/login.js:181`

**Masalah**: Manipulasi DOM berlebihan

**Solusi**: Gunakan CSS classes:
```javascript
// Tambahkan class untuk dark mode
function applyThemeDynamicallyLogin(isDark) {
  const container = document.querySelector('.min-h-screen');
  container.classList.toggle('dark-theme', isDark);
  container.classList.toggle('light-theme', !isDark);
  
  // Lebih sedikit manipulasi, biarkan CSS yanghandle
}
```

---

## Prioritas Rendah

### 7. Hapus Redundant Route di router.js

**File**: `src/modules/router.js:23`

**Masalah**: Route 'batch' dan 'capture' sama

**Solusi**:
```javascript
// Sebelum
batch: {
  render: renderCapture,
  requiresAuth: true,
},
capture: {
  render: renderCapture,
  requiresAuth: true,
},

// Sesudah - redirect batch ke capture
batch: {
  render: () => router.navigate('capture'),
  requiresAuth: true,
},
```

---

## Jadwal Implementasi

| Minggu | Task | Status |
|--------|------|--------|
| 1 | #1 Fix appState di detail.js | [ ] |
| 1 | #2 Error Handling di db.js | [ ] |
| 2 | #3 Blob Cleanup di capture.js | [ ] |
| 2 | #4 Queue Cleanup di sync.js | [ ] |
| 3 | #5 Duplicate Auth di app.js | [ ] |
| 3 | #6 Theme Toggle di login.js | [ ] |
| 4 | #7 Redundant Route di router.js | [ ] |

---

## Catatan

- Semua perubahan harus diuji dengan `npm run lint` dan `npm run build`
- Testing manual diperlukan untuk fitur kamera dan offline
- Backup sebelum perubahan besar

---

*Dokumen ini dibuat berdasarkan hasil analisis kode*
