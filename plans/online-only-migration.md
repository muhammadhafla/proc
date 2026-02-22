# Online-Only Migration Plan

## Executive Summary

Dokumen ini menganalisis dampak dari penghapusan model offline-first dan penggantian dengan pendekatan online-only.

---

## Perbandingan Arsitektur

### Offline-First (Saat Ini)
```
User Action → Local DB → Queue → [Sync Engine] → Server
                ↓
         ✅ Data tersimpan lokal
         ❌ Sync complexity tinggi
         ❌ Conflict resolution sulit
         ❌ Debugging sulit
```

### Online-Only (Baru)
```
User Action → API Call → Server Response → UI Update
                ↓
         ❌ Tidak bisa offline
         ✅ Data selalu konsisten
         ✅ Logic lebih sederhana
         ✅ Error handling straightforward
```

---

## Dampak Jika Pindah ke Online-Only

### 1. Files yang Perlu Dihapus/Dimodifikasi

| File | Action |
|------|--------|
| `src/modules/db.js` | Hapus seluruh file |
| `src/modules/sync.js` | Hapus seluruh file |
| `src/modules/dataService.js` | Refactor - hapus local queue logic |
| `public/sw.js` | Hapus atau sangat disederhanakan |
| `src/components/admin/DataTable.js` | Modifikasi - tidak perlu offline status |
| `src/pages/capture.js` | Modifikasi - langsung upload |
| `src/pages/batch.js` | Modifikasi - langsung upload |
| `src/pages/home.js` | Modifikasi - load dari API |

### 2. Files yang Perlu Ditambahkan/Diperkuat

| File | Action |
|------|--------|
| `src/modules/api.js` | Perkuat - semua data lewat API |
| `src/modules/cache.js` | OPTIONAL - read cache untuk performance (bukan write queue) |

### 3. Kode yang Perlu Dihapus

**Dari `dataService.js`:**
```javascript
// HAPUS:
import { addSupplier, addModel, saveProcurement, addToQueue } from './db.js';

// HAPUS fungsi:
- saveProcurementItem()   // ganti dengan langsung API call
- saveBatchItems()        // ganti dengan batch API call
- getOrCreateSupplier()   // langsung create di server
- getOrCreateModel()      // langsung create di server
```

**Dari `capture.js`:**
```javascript
// HAPUS:
- import { saveProcurementItem } from '../modules/dataService.js';

// GANTI:
// await saveProcurementItem(item)
// DENGAN:
// await createProcurementAPI(item)
```

### 4. UI Changes

**Status indicators berubah:**
- ❌ "Tersimpan offline, akan sync nanti"
- ✅ "Mengirim ke server..."
- ✅ "Berhasil dikirim" / "Gagal - coba lagi"

---

## Alternatif: Hybrid Approach

Jika tidak bisa sepenuhnya online-only, pertimbangkan:

### Read-Only Offline, Write-Online

| Operas | Offline Support |
|--------|-----------------|
| **Browse data** | ✅ Cache dari API sebelumnya |
| **Cari supplier/model** | ✅ Dari cache |
| **Tambah procurement** | ❌ Wajib online |
| **Upload foto** | ❌ Wajib online |

### Implementasi

```javascript
// api.js - dengan cache
const apiCache = new Map();

export async function getSuppliers(forceRefresh = false) {
  // Jika online dan tidak ada force refresh
  if (navigator.onLine && !forceRefresh) {
    // Check cache first
    if (apiCache.has('suppliers')) {
      return apiCache.get('suppliers');
    }
  }
  
  // Fetch from API
  const response = await fetchSuppliers();
  
  // Cache result
  apiCache.set('suppliers', response);
  
  return response;
}

export async function saveProcurement(data) {
  if (!navigator.onLine) {
    throw new Error('Koneksi internet diperlukan untuk menyimpan data');
  }
  
  // Langsung ke server
  return await api.createProcurement(data);
}
```

---

## Pertimbangan Lain

### 1. Konektivitas di Lokasi Penggunaan

| Skenario | Rekomendasi |
|----------|-------------|
| Area dengan koneksi stabil | Online-only ✓ |
| Area dengan koneksi tidak stabil | Hybrid atau offline-first yang diperbaiki |
| Penggunaan di mana saja | Hybrid (cache untuk read, online untuk write) |

### 2. حجم Data / Penggunaan

| Penggunaan | Rekomendasi |
|------------|-------------|
| Banyak foto/procurement per hari | Online-only lebih baik |
| Jarang ada koneksi | Offline-first diperlukan |

### 3. Kompleksitas Tim

- Online-only:tim pengembang lebih sederhana
- Offline-first: butuh expertise khusus sync/replication

---

## Rekomendasi

Berdasarkan masalah sync yang Anda alami, **salah satu dari ini**:

1. **Online-only** - Jika lokasi penggunaan punya koneksi stabil
2. **Hybrid (cache untuk read, online untuk write)** - Jika tetap butuh akses data saat offline tapi tidak perlu offline write
3. **Offline-first yang diperbaiki** - Jika use case benar-benar butuh offline capture

Mana yang paling sesuai dengan kondisi tim dan pengguna Anda?
