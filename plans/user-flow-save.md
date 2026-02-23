# User Flow: Save Procurement

## Flow Saat Ini (Offline-First)

```
┌─────────────────────────────────────────────────────────────┐
│ USER PERSPECTIVE                                           │
├─────────────────────────────────────────────────────────────┤
│ 1. Buka app                                                │
│ 2. Klik "Capture" atau "Batch"                             │
│ 3. Ambil foto                                              │
│ 4. Input supplier, model, price                           │
│ 5. Klik "Save"                                             │
│ 6. APP: "Tersimpan" ✅ (tapi actually masih di local)      │
│ 7. Sync berjalan di background (30 detik)                  │
│ 8. Kalau sync gagal → tidak ada notifikasi                │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ SYSTEM PERSPECTIVE                                         │
├─────────────────────────────────────────────────────────────┤
│ 1. User klik save                                          │
│ 2. Simpan ke IndexedDB (local)                            │
│ 3. Add ke uploadQueue di IndexedDB                        │
│ 4. return ke UI: "Success"                                │
│ 5. Sync engine (30s interval):                            │
│    a. Ambil dari queue                                    │
│    b. Request signed URL ke Worker                        │
│    c. Upload ke R2                                        │
│    d. Create record di Supabase                          │
│    e. Remove dari queue                                   │
└─────────────────────────────────────────────────────────────┘

MASALAH:
- User think it's saved, but actually still local
- No visibility of upload progress
- Hard to debug when sync fails
```

---

## Flow Baru (Online-Only + Optimistic Queue)

```
┌─────────────────────────────────────────────────────────────┐
│ USER PERSPECTIVE                                           │
├─────────────────────────────────────────────────────────────┤
│ 1. Buka app                                                │
│ 2. Klik "Capture" atau "Batch"                             │
│ 3. Ambil foto                                              │
│ 4. Input supplier, model, price                           │
│ 5. Klik "Save"                                             │
│ 6. APP: "Menyimpan..." (loading)                           │
│ 7. APP: "Tersimpan" ✅ (atau "Gagal - Coba Lagi")         │
│ 8. Kalau offline → "Perlu koneksi internet"               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ SYSTEM PERSPECTIVE (SINGLE ITEM)                           │
├─────────────────────────────────────────────────────────────┤
│ 1. User klik save                                          │
│ 2. Generate temp ID                                        │
│ 3. Display item di UI sebagai "pending"                   │
│ 4. Request signed URL ke Worker                           │
│ 5. Upload ke R2                                           │
│ 6. Create record di Supabase                             │
│ 7. Update UI: "Success"                                   │
│    ATAU (jika gagal):                                      │
│    - Retry dengan exponential backoff                     │
│    - Setelah max retry → "Gagal - Coba Lagi" button      │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ SYSTEM PERSPECTIVE (BATCH - MULTIPLE ITEMS)                │
├─────────────────────────────────────────────────────────────┤
│ 1. User add 10 photos                                     │
│ 2. Add semua ke in-memory queue                           │
│ 3. UI: "10 items, 0/10 done"                             │
│ 4. Process max 3 concurrently:                            │
│    ┌─ Item 1 ─┐ ┌─ Item 2 ─┐ ┌─ Item 3 ─┐               │
│    │ Get URL  │ │ Get URL  │ │ Get URL  │  (parallel)   │
│    │ Upload   │ │ Upload   │ │ Upload   │               │
│    │ Create DB│ │ Create DB│ │ Create DB│               │
│    └──────────┘ └──────────┘ └──────────┘               │
│                                                             │
│ 5. When one finishes → start next                         │
│ 6. UI update progress: "3/10 done, 2 uploading..."        │
│ 7. If item fails → retry with backoff                     │
│ 8. If all done → "All complete!"                          │
└─────────────────────────────────────────────────────────────┘
```

---

## Perbandingan

| Aspek | Offline-First (Lama) | Online-Only (Baru) |
|-------|---------------------|-------------------|
| **Save response** | Instant "Success" | "Menyimpan..." → Success/Fail |
| **Data location** | Local first | Server first |
| **Offline save** | ✅ bisa | ❌ harus online |
| **Progress visibility** | ❌ tidak ada | ✅ ada progress |
| **Error handling** | Tidak keliatan | Tampilkan error + retry |
| **Debugging** | Susah | Gampang |

---

## UI States

### Single Capture
```
┌─────────────────────────────┐
│ [✓] Berhasil!              │  ← Success (green)
└─────────────────────────────┘

┌─────────────────────────────┐
│ [⏳] Menyimpan...           │  ← Loading
└─────────────────────────────┘

┌─────────────────────────────┐
│ [✗] Gagal upload           │  ← Failed (red)
│ [Coba Lagi]                │  ← Retry button
└─────────────────────────────┘

┌─────────────────────────────┐
│ [📡] Perlu koneksi         │  ← Offline (yellow)
└─────────────────────────────┘
```

### Batch Capture
```
┌─────────────────────────────────────────┐
│ Batch Upload                    [3/10]│
├─────────────────────────────────────────┤
│ [✓] Foto 1 - Supplier A     ✅ Success │
│ [✓] Foto 2 - Supplier B    ✅ Success │
│ [▓] Foto 3 - Supplier C    ⏳ Uploading│
│ [✓] Foto 4 - Supplier D    ✅ Success │
│ [ ] Foto 5 - Supplier E    ⏳ Waiting │
│ [ ] Foto 6 - Supplier F    ⏳ Waiting │
│ [✗] Foto 7 - Supplier G    ❌ Retry   │
│─────────────────────────────────────────│
│ Total: 4✅ 1⏳ 1❌ 4⏳                   │
│                         [Coba Lagi]     │
└─────────────────────────────────────────┘
```

---

## Detail Step-by-Step

### Single Save Flow
```
1. User klik "Save"
   │
2. UI: show loading state
   │
3. Check online?
   │ ├─ NO → show "Offline" error, return
   │ └─ YES → continue
   │
4. Get signed URL from Worker
   │ (POST /upload, get uploadUrl + fields)
   │
5. Upload image to R2
   │ (POST to uploadUrl with FormData)
   │
6. Create procurement in Supabase
   │ (INSERT to procurements table)
   │
7. Create image metadata in Supabase
   │ (INSERT to procurement_images table)
   │
8. SUCCESS:
   │ UI: show success, remove loading state
   │
9. FAILURE (any step):
   │ - Retry with exponential backoff (1s, 2s, 4s, 8s)
   │ - Max 3 retries
   │ - If still fails: show error + retry button
```

### Batch Save Flow
```
1. User add photo 1, 2, 3... 10
   │
2. For each photo:
   │ - Add to in-memory queue
   │ - Show in UI as "pending"
   │
3. Start upload processor (max 3 concurrent)
   │
4. For each slot available:
   │ - Take next item from queue
   │ - Same flow as single save (steps 3-7)
   │ - Update UI on completion
   │
5. If item fails:
   │ - Add to retry queue
   │ - Continue with next items
   │
6. When all done:
   │ - Show summary (X success, Y failed)
   │ - Allow retry failed items
```
