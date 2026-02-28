# Implementation Plan - Code Review Fixes

> **REVISION NOTES** (2026-02-27):
> - Section 1.5: IndexedDB is HEAVILY used - changed from "remove" to "refactor"
> - Section 2.1: Progress IS tracked (step-based), not 0 - changed to "fix UI"
> - Section 2.2: Debounce ALREADY exists - changed to "consolidate duplicate"
> - Section 2.3: Token refresh function exists - added proactive scheduling
> - Section 3: Upload queue already well-implemented - marked DONE
> - Section 5: State management already simplified - marked DONE
> - Section 6: Service worker already v4 (online-only) - marked DONE
> - Section 7: Session service already configurable - marked DONE

This document outlines the implementation plan for addressing issues identified in the code review.

## Priority Summary

| Priority | Issues | Impact |
|----------|--------|--------|
| 🔴 High | Security fixes, CORS, DB Index | Security & Reliability |
| 🟡 Medium | Token refresh scheduling, Consolidate debounce, Fix progress UI | UX & Reliability |
| 🟢 Low | Code organization, Testing | Maintainability |

---

## Phase 1: High Priority Fixes

### 1.1 Fix localStorage Security (Session Data)

**Problem**: Sensitive session data stored in localStorage is vulnerable to XSS attacks.

**Solution**: Move to sessionStorage with fallback mechanism.

**Files to modify**:
- `src/services/sessionService.js`
- `src/modules/api.js`
- `src/modules/sessionManager.js`

**Implementation**:
```javascript
// Create a secure storage utility
// src/utils/storage.js (new file)
const SecureStorage = {
  get(key) {
    try {
      // Try sessionStorage first
      const sessionData = sessionStorage.getItem(key);
      if (sessionData) return JSON.parse(sessionData);
      
      // Fallback to localStorage for backward compatibility
      const localData = localStorage.getItem(key);
      if (localData) {
        // Migrate to sessionStorage
        sessionStorage.setItem(key, localData);
        localStorage.removeItem(key);
        return JSON.parse(localData);
      }
      return null;
    } catch (e) {
      console.warn('Storage read failed:', e);
      return null;
    }
  },
  
  set(key, value) {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn('Storage write failed:', e);
    }
  },
  
  remove(key) {
    sessionStorage.removeItem(key);
    localStorage.removeItem(key);
  }
};
```

**Estimated effort**: 2 hours

---

### 1.2 Fix CORS Configuration

**Problem**: Cloudflare Worker defaults to `*` allowed origin.

**Solution**: Configure specific allowed origins via environment variables.

**Files to modify**:
- `workers/upload.js`
- Create `workers/.dev.vars` for local development

**Implementation**:
```javascript
// workers/upload.js - Replace line 10
const ALLOWED_ORIGIN = env.ALLOWED_ORIGIN || '';
const CORS_ORIGIN = ALLOWED_ORIGIN === '*' || !ALLOWED_ORIGIN 
  ? ''  // Let browser enforce same-origin
  : ALLOWED_ORIGIN;

// Add origin validation
function isOriginAllowed(origin) {
  if (!CORS_ORIGIN) return true; // Same-origin only
  return CORS_ORIGIN.split(',').some(allowed => 
    allowed.trim() === origin || allowed.trim() === '*'
  );
}

// Check in fetch handler
if (!isOriginAllowed(request.headers.get('Origin'))) {
  return new Response('Origin not allowed', { status: 403 });
}
```

**Create development config**:
```bash
# workers/.dev.vars
ALLOWED_ORIGIN=http://localhost:5173
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

**Estimated effort**: 2 hours

---

### 1.4 Add batch_id Index

**Problem**: Missing index on batch_id column for batch queries.

**Solution**: Add index to database schema.

**Files to modify**:
- `supabase/schema.sql`

**Implementation**:
```sql
-- Add after line 117 in schema.sql
CREATE INDEX IF NOT EXISTS idx_procurement_batch ON public.procurement(batch_id);
```

**Estimated effort**: 30 minutes

---

### 1.5 Refactor IndexedDB Usage

⚠️ **REVISED**: IndexedDB IS actually used throughout the codebase!

**Verified Usage**:
- `src/pages/list.js` - imports `getProcurements`, `getSuppliers`
- `src/pages/home.js` - imports `getAllQueueItems`
- `src/pages/detail.js` - imports `getProcurement`
- `src/pages/capture.js` - imports `getSuppliers`, `cacheSuppliers`
- `src/pages/batch.js` - imports `getSuppliers`
- `src/modules/dataService.js` - imports `getSupplierByName`, `getModelByName`, `cacheSuppliers`, `cacheModels`
- `src/main.js` - imports `initDB`

**Settings store** - CORRECT: The `settings` store is NEVER accessed (no getSetting/setSetting)

**Solution**: Consolidate IndexedDB usage, don't remove it. Keep only what's necessary.

**Files to modify**:
- `src/modules/db.js` - Remove unused functions
- `src/pages/list.js` - Refactor to use API directly
- `src/pages/capture.js` - Refactor to use API directly
- `src/modules/dataService.js` - Refactor to use API directly

**Current IndexedDB Stores**:
| Store | Used By | Action |
|-------|---------|--------|
| `uploadQueue` | uploadQueue.js (in-memory already!) | Keep for persistence |
| `procurements` | list.js, detail.js | Consolidate to API |
| `suppliers` | capture.js, batch.js, dataService.js | Consolidate to API |
| `models` | dataService.js | Consolidate to API |
| `settings` | NONE | **Hapus - tidak digunakan** |

**Estimated effort**: 3 jam

---

## Phase 2: Medium Priority Fixes

### 2.1 Fix Upload Progress UI (NOT 0 - Check Rendering)

⚠️ **REVISED**: Progress IS tracked in uploadQueue.js (lines 201, 216, 222, 239, 254)

**Problem**: Progress shows 20%→40%→70%→90%→100% based on steps, not bytes. If UI shows 0, issue is in rendering.

**Solution**: Debug why UI isn't showing step-based progress, or add XMLHttpRequest for byte-level.

**Files to modify**:
- `src/modules/uploadQueue.js` - Debug existing progress
- UI component showing progress

**Estimated effort**: 1 jam

**Implementation**:
```javascript
async function uploadWithProgress(blob, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        const percent = Math.round((e.loaded / e.total) * 100);
        onProgress(percent);
      }
    });
    
    xhr.addEventListener('load', () => resolve(xhr));
    xhr.addEventListener('error', () reject(xhr.error));
    
    xhr.open('PUT', uploadUrl);
    xhr.send(blob);
  });
}
```

**Estimated effort**: 1 jam

---

### 2.2 Consolidate Duplicate Debounce Functions

⚠️ **REVISED**: Debounce ALREADY EXISTS in multiple files!

**Current State**:
- `src/pages/list.js:112` - has `debounce(applyFilters, 300)`
- `src/pages/batch.js:151` - has `debounce(filterSuppliers, 200)`
- Both have their own inline `debounce()` function!

**Problem**: Duplicate debounce functions, should be consolidated.

**Solution**: Create shared utility and refactor both files.

**Files to modify**:
- `src/utils/debounce.js` (new - extract from existing)
- `src/pages/list.js` - use shared utility
- `src/pages/batch.js` - use shared utility

**Implementation**:
```javascript
// src/utils/debounce.js
export function debounce(fn, delay) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}
```

**Estimated effort**: 1 jam

---

### 2.3 Implement Proactive Token Refresh

⚠️ **REVISED**: `refreshSession()` function EXISTS in sessionService.js, but no proactive scheduling!

**Current State**:
- `src/services/sessionService.js` has `refreshSession()` function
- Token refresh happens REACTIVELY (on request failure)
- No scheduled proactive refresh BEFORE expiry

**Problem**: Users get logged out unexpectedly when token expires.

**Solution**: Add scheduled refresh that runs BEFORE token expiry.

**Files to modify**:
- `src/services/sessionService.js`

**Implementation**:
```javascript
let refreshTimer = null;

function scheduleTokenRefresh(expiresInSeconds) {
  // Refresh 5 minutes before expiry
  const refreshTime = (expiresInSeconds - 300) * 1000;
  
  if (refreshTimer) clearTimeout(refreshTimer);
  
  if (refreshTime > 0) {
    refreshTimer = setTimeout(async () => {
      try {
        const { data, error } = await supabase.auth.refreshSession();
        if (!error && data.session) {
          scheduleTokenRefresh(data.session.expires_in);
        }
      } catch (e) {
        console.warn('Token refresh failed:', e);
      }
    }, refreshTime);
  }
}
```

**Estimated effort**: 2 jam

---

### 2.4 Ensure User Cache Invalidated on Logout

**Problem**: User cache may persist after logout.

**Solution**: Ensure cache is cleared in all logout paths.

**Files to modify**:
- `src/modules/api.js`
- `src/modules/sessionManager.js`

**Implementation**:
```javascript
// In signOut function
export async function signOut() {
  clearUserCache();  // Add this line
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
```

**Estimated effort**: 1 hour

---

## Phase 3: Low Priority Improvements

### 3.1 Create UI Component Library

**Problem**: Large inline HTML strings in pages.

**Solution**: Extract reusable components.

**New files**:
- `src/components/LoadingSpinner.js`
- `src/components/EmptyState.js`
- `src/components/ConfirmDialog.js`

**Estimated effort**: 4 hours

---

### 3.2 Add Basic Error Logging

**Problem**: No centralized error tracking.

**Solution**: Add simple error logging utility.

**Files to create**:
- `src/utils/logger.js`

**Estimated effort**: 2 hours

---

## Implementation Timeline

| Phase | Tasks | Estimated Total |
|-------|-------|-----------------|
| Phase 1 | 4 tasks (Security, CORS, DB Index, IndexedDB refactor) | ~8 hours |
| Phase 2 | 3 tasks (Progress UI, Debounce consolidate, Token refresh) | 4 hours |
| Phase 3 | 2 tasks | 6 hours |
| **Total** | **9 tasks** | **~18 hours** |

---

## Testing Checklist

- [ ] Session data menggunakan sessionStorage (tidak localStorage)
- [ ] Suppliers/models di-fetch setiap halaman dibuka
- [ ] CORS memblokir origin tidak authorized
- [ ] Debounce function di-consolidate ke src/utils/debounce.js
- [ ] Token refresh terjadi SEBELUM expiry (5 menit sebelumnya)
- [ ] Progress bar menunjukkan step-based progress (20%, 40%, 70%, 90%, 100%)

---

## Additional Simplification Suggestions

### 1. Consolidate Debounce Functions ✅ DONE

**Status**: COMPLETED 2026-02-27

**Changes**:
- Created `src/utils/debounce.js` - shared debounce utility
- Refactored `src/pages/list.js` - use shared utility, removed local function
- Refactored `src/pages/batch.js` - use shared utility, removed local function

**Estimated saving**: ~20 baris kode duplikat

---

### 2. Remove Unused db.js Functions ✅ DONE

**Status**: COMPLETED 2026-02-27

**Removed functions** (not imported anywhere):
- `getProcurementsCount()` - not used
- `getProcurementsBySupplier()` - not used
- `addSupplier()` - not used
- `addModel()` - not used
- `searchModels()` - not used

**Estimated saving**: ~50 baris kode

---

### 3. Simplify Upload Queue ✅ DONE

**Status**: COMPLETED 2026-02-27

**Current Implementation**: Already well-implemented with:
- Concurrent uploads (3 at a time)
- Retry logic with exponential backoff
- Progress tracking (10% → 20% → 40% → 70% → 90% → 100%)
- Event listeners for UI updates
- In-memory queue (no IndexedDB persistence)

**Verdict**: No changes needed - meets online-only requirements


---

### 4. Consolidate Capture Pages

**Current**: `capture.js` dan `batch.js` punya banyak code duplikat
**Suggestion**: Ekstrak common logic ke shared module

```javascript
// src/modules/captureLogic.js - common functions
- initCamera()
- captureImage()
- validateForm()
- saveProcurement()
```

**Estimated saving**: ~300 baris duplikat

---

### 5. Simplify State Management ✅ DONE

**Status**: COMPLETED 2026-02-27

**Current Implementation**: Already using centralized AppState:
- Single `AppState` class with event emission
- Used for: user, organization, isOnline, isSyncing
- Additional storage: sessionStorage (for sensitive data), query params (for routing)

**Verdict**: No changes needed - already well-structured

---

### 6. Remove Service Worker Complexity ✅ DONE

**Status**: COMPLETED 2026-02-27

**Current Implementation**: Already simplified to v4:
- Network-first strategy for navigation
- Cache-first for static assets
- No complex offline strategies (online-only)
- Minimal cache list: index.html, manifest, icons

**Verdict**: No changes needed - already optimized for online-only

---

### 7. Reduce Session Service Complexity ✅ DONE

**Status**: COMPLETED 2026-02-27

**Current Implementation**: Already has configurable features:
- `SESSION_CONFIG` object with configurable options
- Proactive token refresh implemented (`scheduleTokenRefresh`)
- Multi-tab sync (BroadcastChannel + storage events)
- Idle detection
- Warning countdown

**Verdict**: Already configurable via SESSION_CONFIG - no changes needed

---

## Summary of Potential Code Reduction

| Area | Status | Notes |
|------|--------|-------|
| Debounce consolidation | ✅ DONE | src/utils/debounce.js created |
| Unused db functions | ✅ DONE | 5 functions removed |
| Upload queue | ✅ DONE | Already well-implemented |
| Service Worker | ✅ DONE | Already v4 (online-only) |
| State management | ✅ DONE | Already using AppState |
| Session service | ✅ DONE | Already configurable |
| Proactive token refresh | ✅ DONE | Implemented in sessionService.js |
| IndexedDB refactor | 🔄 IN PROGRESS | Refactor (not remove) |
| CORS configuration | 🔄 IN PROGRESS | Workers need env setup |
| Security (sessionStorage) | 🔄 IN PROGRESS | Need to implement |

**Remaining Work:**
- Phase 1: Security fixes, CORS, DB Index, IndexedDB refactor
- Phase 2: Progress UI fix (if needed)

---
