# Offline-First Sync System - Implementation Plan

## Executive Summary

Rencana ini mengatasi kelemahan sistem sync offline-first yang ada untuk meningkatkan reliability dan data integrity. Fokus utama: idempotency, exponential backoff, conflict resolution, dan visibility.

---

## Todo List

```
[ ] Analyze current sync architecture and identify all failure points
[ ] Implement idempotency key system in uploadQueue to prevent duplicates
[ ] Add exponential backoff with jitter to retry logic in sync.js
[ ] Implement transactional outbox pattern for atomic multi-step operations
[ ] Add conflict detection with timestamp/version vector for data integrity
[ ] Create sync status tracking system (pending/failed/success counts)
[ ] Add sync status UI component for user visibility
[ ] Implement Service Worker caching strategy for dynamic API responses
[ ] Add database migration for new schema fields (idempotency keys, timestamps)
[ ] Write unit tests for new sync mechanisms
[ ] Document the offline-first architecture and failure recovery procedures
```

---

## Task 1: Analyze Current Sync Architecture

### Objective
Identifikasi semua potential failure points dalam sistem sync yang ada.

### Current Flow Analysis
```
User Action → saveProcurementItem() → Local DB → addToQueue() 
                                                    ↓
                                          Sync Engine (30s interval)
                                                    ↓
                        processItem() → uploadToR2() → createProcurement() → createProcurementImage()
                                                    ↓
                                          removeFromQueue()
```

### Identified Failure Points

| # | Failure Point | Impact | Severity |
|---|--------------|--------|----------|
| 1 | Image upload succeeds, DB create fails | Orphan image in R2 | High |
| 2 | Retry after partial failure | Duplicate uploads | High |
| 3 | Network drops mid-sync | Inconsistent state | Medium |
| 4 | Multiple devices offline with same data | Conflict on sync | Medium |
| 5 | IndexedDB quota exceeded | Data loss | Low |
| 6 | Service worker not updated | Stale cache | Low |

### Deliverable
- Failure mode analysis document
- Risk assessment matrix

---

## Task 2: Implement Idempotency Key System

### Objective
Setiap sync operation harus memiliki unique identifier untuk mencegah duplikasi.

### Implementation

#### 2.1 Update uploadQueue Schema
Tambahkan field baru ke IndexedDB:
```javascript
// Di db.js - update addToQueue()
{
  idempotencyKey: string,  // UUID yang sama untuk retry
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'failed',
  createdAt: timestamp,
  lastAttemptAt: timestamp,
  retryCount: number,
}
```

#### 2.2 Modify addToQueue()
```javascript
// Di db.js
export async function addToQueue(item) {
  const idempotencyKey = item.idempotencyKey || uuidv4();
  // Check if already exists
  const existing = await getByIdempotencyKey(idempotencyKey);
  if (existing) {
    return existing.id; // Return existing, don't create duplicate
  }
  // ... rest of implementation
}
```

#### 2.3 Check Before Process
```javascript
// Di sync.js - processItem()
async function processItem(item) {
  // Generate idempotency key from item data
  const idempotencyKey = generateIdempotencyKey(item);
  
  // Check if this operation already succeeded
  const previousSuccess = await checkIdempotencyRecord(idempotencyKey);
  if (previousSuccess) {
    console.log('Skipping already synced item:', idempotencyKey);
    await removeFromQueue(item.id);
    return;
  }
  // ... rest of process
}
```

### Files to Modify
- `src/modules/db.js` - Schema update + new functions
- `src/modules/sync.js` - Idempotency check logic

---

## Task 3: Exponential Backoff with Jitter

### Objective
Perbaiki retry logic untuk mengurangi failures akibat network congestion.

### Current Problem
```javascript
// Current (sync.js line 144)
if (newRetryCount >= config.sync.retryAttempts) {
  // Only 3 attempts, no backoff
}
```

### Implementation

#### 3.1 Add Backoff Configuration
```javascript
// Di config.js
sync: {
  retryAttempts: 5,           // Increased from 3
  initialRetryDelay: 1000,    // 1 second
  maxRetryDelay: 60000,       // 60 seconds max
  backoffMultiplier: 2,       // Exponential
  jitterFactor: 0.3,          // 30% random jitter
}
```

#### 3.2 Implement Backoff Function
```javascript
// Di sync.js
function calculateBackoffDelay(retryCount) {
  const config = getSyncConfig();
  const exponentialDelay = config.initialRetryDelay * Math.pow(config.backoffMultiplier, retryCount);
  const cappedDelay = Math.min(exponentialDelay, config.maxRetryDelay);
  
  // Add jitter to prevent thundering herd
  const jitter = cappedDelay * config.jitterFactor * Math.random();
  return Math.floor(cappedDelay + jitter);
}
```

#### 3.3 Apply Backoff to Retry Logic
```javascript
// Di sync.js - sync() function
for (const item of pendingItems) {
  try {
    await processItem(item);
  } catch (error) {
    const newRetryCount = (item.retryCount || 0) + 1;
    
    if (newRetryCount >= config.sync.retryAttempts) {
      await updateQueueItem(item.id, {
        status: 'failed',
        retryCount: newRetryCount,
        error: error.message,
        nextRetryAt: null, // No more retries
      });
    } else {
      // Calculate backoff delay
      const delay = calculateBackoffDelay(newRetryCount);
      const nextRetry = new Date(Date.now() + delay).toISOString();
      
      await updateQueueItem(item.id, {
        retryCount: newRetryCount,
        nextRetryAt: nextRetry,
        error: error.message,
      });
    }
  }
}
```

#### 3.4 Only Process Items Ready for Retry
```javascript
async function sync() {
  const pendingItems = await getPendingItems();
  
  // Filter items that are due for retry
  const now = new Date().toISOString();
  const itemsToProcess = pendingItems.filter(item => {
    if (item.status === 'pending') return true;
    if (item.nextRetryAt && item.nextRetryAt <= now) return true;
    return false;
  });
  
  // ... process filtered items
}
```

### Files to Modify
- `src/modules/config.js` - Backoff configuration
- `src/modules/sync.js` - Backoff logic implementation

---

## Task 4: Transactional Outbox Pattern

### Objective
Pastikan atomicity untuk multi-step operations (upload → create record → create metadata).

### Current Problem
3 steps yang tidak atomic - jika step 2 gagal, step 1 sudah terjadi.

### Implementation

#### 4.1 Create Outbox Table
```javascript
// Di db.js
{
  outbox: {
    id: string,
    type: 'procurement' | 'supplier' | 'model',
    payload: object,
    status: 'pending' | 'processing' | 'completed' | 'failed',
    createdAt: timestamp,
    processedAt: timestamp,
    retryCount: number,
    lastError: string,
  }
}
```

#### 4.2 Implement Two-Phase Commit

**Phase 1: Local Transaction**
```javascript
// Di dataService.js
async function saveProcurementWithOutbox(item) {
  const db = await getDB();
  
  // Start transaction
  const tx = db.transaction(['procurements', 'outbox'], 'readwrite');
  
  // Save procurement locally
  await tx.objectStore('procurements').put({
    ...procurement,
    status: 'pending_sync',
  });
  
  // Add to outbox
  await tx.objectStore('outbox').add({
    id: uuidv4(),
    type: 'procurement',
    payload: item,
    status: 'pending',
    createdAt: new Date().toISOString(),
  });
  
  await tx.done;
}
```

**Phase 2: Process with Compensation**
```javascript
// Di sync.js - processOutboxItem()
async function processOutboxItem(outboxItem) {
  try {
    // Process the item
    await processItem(outboxItem.payload);
    
    // Mark outbox as completed
    await updateOutboxItem(outboxItem.id, {
      status: 'completed',
      processedAt: new Date().toISOString(),
    });
    
  } catch (error) {
    // Compensation logic
    if (outboxItem.compensation?.procurementId) {
      // Rollback: mark procurement as failed locally
      await markProcurementFailed(outboxItem.compensation.procurementId);
    }
    
    throw error; // Re-throw for retry logic
  }
}
```

### Files to Modify
- `src/modules/db.js` - Outbox schema and functions
- `src/modules/sync.js` - Outbox processor
- `src/modules/dataService.js` - Use outbox pattern

---

## Task 5: Conflict Detection with Timestamp/Vector Clock

### Objective
Deteksi konflik saat multiple devices sync data yang sama.

### Implementation

#### 5.1 Add Version Metadata
```javascript
// Di setiap record yang di-cache
{
  id: string,
  // ... data fields
  _version: number,        // Incremental version
  _modifiedAt: timestamp,  // Last modification time
  _deviceId: string,      // Which device last modified
  _syncStatus: 'synced' | 'local_modified' | 'server_modified' | 'conflict',
}
```

#### 5.2 Conflict Detection Logic
```javascript
// Di sync.js - sebelum update data
async function detectConflict(localItem, serverItem) {
  if (!serverItem) return null; // No conflict - new item
  
  // If server version is newer
  if (serverItem._version > localItem._version) {
    // Check if local was modified after last sync
    if (localItem._modifiedAt > localItem._lastSyncedAt) {
      return {
        type: 'conflict',
        local: localItem,
        server: serverItem,
      };
    }
  }
  
  return null; // No conflict
}
```

#### 5.3 Conflict Resolution Strategies

**Auto-merge for non-conflicting changes:**
```javascript
function autoMerge(local, server) {
  return {
    ...server,
    ...local, // Local wins for same fields
  };
}
```

**Flag for manual resolution:**
```javascript
// Simpan conflict untuk user decision
await saveConflict({
  id: uuidv4(),
  localSnapshot: localItem,
  serverSnapshot: serverItem,
  detectedAt: new Date().toISOString(),
  status: 'pending_resolution',
});
```

### Files to Modify
- `src/modules/db.js` - Version metadata schema
- `src/modules/sync.js` - Conflict detection and resolution
- `src/modules/api.js` - Include version in API responses

---

## Task 6: Sync Status Tracking System

### Objective
Track dan expose sync status untuk visibility.

### Implementation

#### 6.1 Status Types
```javascript
const SyncStatus = {
  IDLE: 'idle',
  SYNCING: 'syncing',
  PENDING: 'pending',      // Items waiting to sync
  FAILED: 'failed',        // Items that failed
  COMPLETED: 'completed',  // Recently synced
  OFFLINE: 'offline',      // No network
};
```

#### 6.2 Global Status Store
```javascript
// Di state.js - add syncState
const syncState = {
  status: SyncStatus.IDLE,
  lastSyncAt: null,
  pendingCount: 0,
  failedCount: 0,
  completedCount: 0,
  errors: [],              // Recent errors
};
```

#### 6.3 Update Status on Events
```javascript
// Di sync.js - update everywhere
function updateSyncState(updates) {
  syncState.set({...syncState.get(), ...updates});
  
  // Dispatch event for UI
  window.dispatchEvent(new CustomEvent('syncStatusChange', {
    detail: syncState.get()
  }));
}

// Usage in sync()
updateSyncState({ status: 'syncing', pendingCount: pendingItems.length });
// ... after processing
updateSyncState({ 
  status: 'idle', 
  lastSyncAt: new Date().toISOString(),
  pendingCount: remainingItems.length,
});
```

### Files to Modify
- `src/modules/state.js` - Add syncState
- `src/modules/sync.js` - Emit status updates

---

## Task 7: Sync Status UI Component

### Objective
Tampilkan sync status ke user agar tahu apa yang terjadi.

### Implementation

#### 7.1 Create SyncStatusBar Component
```javascript
// Di src/components/SyncStatusBar.js
export function SyncStatusBar() {
  const [status, setStatus] = useState('idle');
  const [counts, setCounts] = useState({ pending: 0, failed: 0 });
  
  useEffect(() => {
    const handleSyncStatus = (e) => {
      setStatus(e.detail.status);
      setCounts({
        pending: e.detail.pendingCount,
        failed: e.detail.failedCount,
      });
    };
    
    window.addEventListener('syncStatusChange', handleSyncStatus);
    return () => window.removeEventListener('syncStatusChange', handleSyncStatus);
  }, []);
  
  // Render based on status
  if (status === 'offline') return <OfflineIndicator />;
  if (counts.failed > 0) return <SyncErrorIndicator count={counts.failed} />;
  if (counts.pending > 0) return <SyncPendingIndicator count={counts.pending} />;
  return <SyncCompleteIndicator />;
}
```

#### 7.2 Add to App Layout
```javascript
// Di src di/modules/app.js - main container
import { SyncStatusBar } from './components/SyncStatusBar.js';

function render() {
  return `
    <div id="app">
      <header>
        ${SyncStatusBar()}
        <!-- rest of app -->
      </header>
    </div>
  `;
}
```

#### 7.3 Detailed Sync Panel (Admin)
```javascript
// Di admin.js - add sync panel
function renderSyncPanel() {
  const pending = getPendingItems();
  const failed = getFailedItems();
  
  return `
    <div class="sync-panel">
      <h3>Sync Status</h3>
      <div>Pending: ${pending.length}</div>
      <div>Failed: ${failed.length}</div>
      <button onclick="triggerSync()">Sync Now</button>
      <button onclick="clearFailed()">Clear Failed</button>
    </div>
  `;
}
```

### Files to Modify
- `src/components/SyncStatusBar.js` - New component
- `src/modules/app.js` - Add to layout
- `src/pages/admin.js` - Add sync panel

---

## Task 8: Service Worker Caching for Dynamic Content

### Objective
Cache API responses untuk offline access.

### Implementation

#### 8.1 Update Service Worker
```javascript
// Di public/sw.js

// Cache strategies
const CACHE_STRATEGIES = {
  CACHE_FIRST: 'cache-first',
  NETWORK_FIRST: 'network-first',
  STALE_WHILE_REVALIDATE: 'stale-while-revalidate',
};

// API routes configuration
const API_ROUTES = [
  { pattern: /\/api\/suppliers/, strategy: CACHE_STRATEGIES.STALE_WHILE_REVALIDATE },
  { pattern: /\/api\/models/, strategy: CACHE_STRATEGIES.STALE_WHILE_REVALIDATE },
  { pattern: /\/api\/procurements/, strategy: CACHE_STRATEGIES.NETWORK_FIRST },
];

// Stale-while-revalidate strategy
async function staleWhileRevalidate(request) {
  const cache = await caches.open(DYNAMIC_CACHE);
  const cachedResponse = await cache.match(request);
  
  const fetchPromise = fetch(request).then(response => {
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  });
  
  return cachedResponse || fetchPromise;
}

// Network-first with cache fallback
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw error;
  }
}
```

#### 8.2 Background Sync API
```javascript
// Di public/sw.js - untuk queue sync
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-procurements') {
    event.waitUntil(syncProcurements());
  }
});

// Di sync.js - register background sync
async function registerBackgroundSync() {
  if ('serviceWorker' in navigator && 'sync' in window.SyncManager) {
    const registration = await navigator.serviceWorker.ready;
    await registration.sync.register('sync-procurements');
  }
}
```

### Files to Modify
- `public/sw.js` - Enhanced caching strategies

---

## Task 9: Database Migration

### Objective
Tambahkan schema fields baru untuk support fitur di atas.

### Implementation

#### 9.1 Migration Script
```javascript
// Di db.js - update initDB()
async function initDB() {
  const db = await openDB(DB_NAME, DB_VERSION + 1, {
    upgrade(db, oldVersion, newVersion, transaction) {
      // Version 3: Add idempotency and versioning
      if (oldVersion < 3) {
        // Update uploadQueue
        if (db.objectStoreNames.contains('uploadQueue')) {
          const store = transaction.objectStore('uploadQueue');
          if (!store.indexNames.contains('idempotencyKey')) {
            store.createIndex('idempotencyKey', 'idempotencyKey', { unique: true });
          }
          if (!store.indexNames.contains('nextRetryAt')) {
            store.createIndex('nextRetryAt', 'nextRetryAt');
          }
        }
        
        // Add outbox store
        if (!db.objectStoreNames.contains('outbox')) {
          const outboxStore = db.createObjectStore('outbox', { keyPath: 'id' });
          outboxStore.createIndex('status', 'status');
          outboxStore.createIndex('type', 'type');
        }
        
        // Add conflicts store
        if (!db.objectStoreNames.contains('conflicts')) {
          const conflictStore = db.createObjectStore('conflicts', { keyPath: 'id' });
          conflictStore.createIndex('status', 'status');
        }
      }
    },
  });
  
  return db;
}
```

### Files to Modify
- `src/modules/db.js` - Migration logic

---

## Task 10: Unit Tests

### Objective
Pastikan reliability dengan test coverage.

### Test Cases

```javascript
// sync.test.js
describe('Sync Engine', () => {
  describe('Exponential Backoff', () => {
    it('should increase delay with each retry');
    it('should cap at max delay');
    it('should include jitter');
  });
  
  describe('Idempotency', () => {
    it('should not create duplicate on retry');
    it('should handle network failure after upload');
  });
  
  describe('Conflict Detection', () => {
    it('should detect conflict when both modified');
    it('should auto-merge non-conflicting');
  });
});
```

---

## Task 11: Documentation

### Objective
Dokumentasikan arsitektur dan cara recovery.

### Documentation Structure
```
docs/
├── OFFLINE_ARCHITECTURE.md    # Arsitektur sistem
├── SYNC_RECOVERY.md          # Prosedur recovery
└── API_SPEC.md               # API contracts
```

---

## Implementation Order

```
Week 1:
├── Task 1: Analysis (1 day)
├── Task 2: Idempotency (2 days)
└── Task 3: Exponential Backoff (2 days)

Week 2:
├── Task 4: Outbox Pattern (3 days)
├── Task 5: Conflict Detection (2 days)
└── Task 6: Status Tracking (1 day)

Week 3:
├── Task 7: UI Components (2 days)
├── Task 8: Service Worker (2 days)
└── Task 9: Migration (1 day)

Week 4:
├── Task 10: Tests (3 days)
└── Task 11: Documentation (2 days)
```

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Breaking existing sync | Incremental migration, feature flags |
| Data loss during migration | Backup before migration |
| Performance impact | Batch operations, lazy loading |
| Conflict resolution bugs | Manual review UI option |

---

## Success Metrics

- [ ] Zero duplicate records after sync
- [ ] < 5% sync failure rate in production
- [ ] User can see sync status in real-time
- [ ] Conflicts detected and presented to user
- [ ] Offline mode fully functional for 24+ hours
