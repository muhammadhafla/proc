# Implementation Plan - Code Quality Improvements

## Overview

This document outlines the implementation plan to address critical code quality issues identified in the Procurement System codebase. The plan is organized into phases based on priority and dependency order.

---

## Phase 1: Critical Fixes (Week 1-2)

### 1.1 Add Service Worker for True Offline Support

**Files to Create:**
- `public/sw.js` - Service Worker for offline caching

**Implementation:**
```javascript
// public/sw.js
const CACHE_NAME = 'procurement-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/128x128@2x.png',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
```

**Files to Modify:**
- `src/main.js` - Register service worker
- `vite.config.js` - Configure service worker bundling

**Estimated Effort:** 2-3 hours

---

### 1.2 Fix Blob URL Memory Leaks

**Files to Modify:**
- `src/pages/capture.js`
- `src/pages/batch.js`
- `src/modules/camera.js`

**Implementation:**
```javascript
// In camera.js - Add global blob URL tracker
const activeBlobUrls = new Set();

export function createBlobUrl(blob) {
  const url = URL.createObjectURL(blob);
  activeBlobUrls.add(url);
  return url;
}

export function revokeBlobUrl(url) {
  if (activeBlobUrls.has(url)) {
    URL.revokeObjectURL(url);
    activeBlobUrls.delete(url);
  }
}

export function revokeAllBlobUrls() {
  activeBlobUrls.forEach(url => URL.revokeObjectURL(url));
  activeBlobUrls.clear();
}

// In page components - Use cleanup on navigation
window.addEventListener('hashchange', () => {
  revokeAllBlobUrls();
});
```

**Estimated Effort:** 1-2 hours

---

### 1.3 Implement Proper State Management

**Files to Create:**
- `src/modules/state.js` - Centralized state management

**Implementation:**
```javascript
// src/modules/state.js
import { EventEmitter } from 'events';

class AppState extends EventEmitter {
  constructor() {
    super();
    this._state = {
      user: null,
      organization: null,
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
      isSyncing: false,
    };
  }

  get(key) {
    return this._state[key];
  }

  set(key, value) {
    const oldValue = this._state[key];
    this._state[key] = value;
    this.emit('change', { key, oldValue, newValue: value });
  }

  getAll() {
    return { ...this._state };
  }
}

export const appState = new AppState();
```

**Files to Modify:**
- `src/modules/app.js` - Use new state manager
- `src/modules/sync.js` - Use state events
- `src/modules/router.js` - Subscribe to state changes
- All page components using `window.appState`

**Estimated Effort:** 4-6 hours

---

## Phase 2: Code Quality (Week 2-3)

### 2.1 Refactor batch.js and capture.js

**Strategy:** Use existing `camera.js` module properly instead of duplicating code.

**Files to Modify:**
- `src/pages/capture.js`
- `src/pages/batch.js`

**Implementation:**

Step 1: Extract common functions to `camera.js`:
- Ensure all shared camera functions are properly exported
- Add missing wrapper functions

Step 2: Update `capture.js`:
```javascript
// Before: Duplicate camera code
async function captureImage() {
  const video = document.getElementById('camera-preview');
  // ... duplicated code
}

// After: Use shared module
import { captureImage as sharedCapture } from '../modules/camera.js';

async function captureImage() {
  const supplier = getSupplierInput();
  const model = getModelInput();
  const price = getPriceInput();
  
  return sharedCapture({
    maxWidth: 1200,
    quality: 0.7,
    overlayText: `${supplier} | ${model} | Rp${price}`,
    timestamp: new Date().toLocaleString('id-ID'),
  });
}
```

Step 3: Update `batch.js` similarly

**Estimated Effort:** 3-4 hours

---

### 2.2 Add ESLint and Prettier Configuration

**Files to Create:**
- `.eslintrc.json`
- `.prettierrc`

**Configuration:**
```json
// .eslintrc.json
{
  "env": {
    "browser": true,
    "es2021": true
  },
  "extends": ["eslint:recommended"],
  "parserOptions": {
    "ecmaVersion": "latest",
    "sourceType": "module"
  },
  "rules": {
    "no-unused-vars": "warn",
    "no-console": "off"
  }
}
```

**Files to Modify:**
- `package.json` - Add lint script

**Estimated Effort:** 1 hour

---

## Phase 3: Database & Performance (Week 3-4)

### 3.1 Add Database Migration Support

**Files to Modify:**
- `src/modules/db.js`

**Implementation:**
```javascript
const DB_VERSION = 2; // Increment version

export async function initDB() {
  if (dbPromise) return dbPromise;
  
  dbPromise = openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, newVersion, transaction) {
      // Migration logic
      if (oldVersion < 2) {
        // Add new stores or indexes
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      }
    },
  });
  
  return dbPromise;
}
```

**Estimated Effort:** 2-3 hours

---

### 3.2 Implement Proper Pagination

**Files to Modify:**
- `src/modules/db.js`

**Implementation:**
```javascript
// Instead of loading all and slicing
export async function getProcurements(limit = 20, offset = 0) {
  const db = await getDB();
  const tx = db.transaction('procurements', 'readonly');
  const store = tx.objectStore('procurements');
  
  // Use IDBKeyRange for proper pagination
  const results = [];
  let cursor = await store.openCursor(null, 'prev');
  
  let count = 0;
  while (cursor && count < offset + limit) {
    if (count >= offset) {
      results.push(cursor.value);
    }
    count++;
    cursor = await cursor.continue();
  }
  
  return results;
}
```

**Estimated Effort:** 2 hours

---

## Phase 4: UX Improvements (Week 4-5)

### 4.1 Fix Theme Toggle

**Files to Modify:**
- `src/pages/login.js`

**Implementation:**
```javascript
// Instead of router.navigate, apply theme dynamically
document.getElementById('theme-toggle-login')?.addEventListener('click', () => {
  const newTheme = toggleTheme();
  applyThemeDynamically(newTheme); // Similar to home.js implementation
});
```

**Estimated Effort:** 1 hour

---

### 4.2 Improve Offline Indicator

**Files to Modify:**
- `src/modules/app.js`

**Implementation:**
```javascript
function showOfflineIndicator() {
  const existing = document.getElementById('offline-indicator');
  if (existing) return;
  
  const indicator = document.createElement('div');
  indicator.id = 'offline-indicator';
  // ... existing code
  
  document.body.appendChild(indicator);
  
  // Don't auto-remove - let user dismiss manually
  indicator.addEventListener('click', () => {
    indicator.remove();
  });
}
```

**Estimated Effort:** 1 hour

---

## Phase 5: Testing (Week 5+)

### 5.1 Add Unit Tests

**Files to Create:**
- `tests/db.test.js`
- `tests/state.test.js`
- `tests/camera.test.js`

**Tools to Add:**
```bash
npm install --save-dev vitest
```

**Files to Modify:**
- `package.json` - Add test script

**Estimated Effort:** 8-10 hours

---

## Implementation Checklist

- [x] Phase 1.1: Service Worker
- [x] Phase 1.2: Memory Leak Fixes
- [x] Phase 1.3: State Management
- [x] Phase 2.1: Code Deduplication
- [x] Phase 2.2: ESLint/Prettier
- [ ] Phase 3.1: Database Migrations
- [ ] Phase 3.2: Pagination
- [ ] Phase 4.1: Theme Toggle Fix
- [ ] Phase 4.2: Offline Indicator
- [ ] Phase 5.1: Unit Tests

---

## Estimated Total Effort

| Phase | Hours |
|-------|-------|
| Phase 1 (Critical) | 10-13 hours |
| Phase 2 (Quality) | 4-5 hours |
| Phase 3 (DB/Perf) | 4-5 hours |
| Phase 4 (UX) | 2 hours |
| Phase 5 (Testing) | 8-10 hours |
| **Total** | **28-35 hours** |
