# Online-Only Migration - Implementation Plan

## Overview

Migrate dari offline-first ke online-only dengan optimistic queue. Sistem baru lebih sederhana dan langsung.

---

## Implementation Todo List

```
[ ] Step 1: Create uploadQueue.js module
[ ] Step 2: Refactor dataService.js untuk optimistic API
[ ] Step 3: Simplify db.js - hapus queue functions
[ ] Step 4: Refactor sync.js jadi simple upload processor
[ ] Step 5: Update capture.js - loading states
[ ] Step 6: Update batch.js - progress UI
[ ] Step 7: Simplify service worker
[ ] Step 8: Integration testing
```

---

## Step 1: Create uploadQueue.js

**File:** `src/modules/uploadQueue.js` (NEW)

```javascript
// ============================================
// UPLOAD QUEUE MODULE
// Simple in-memory queue untuk optimistic uploads
// ============================================

import { getSignedUploadUrl, createProcurement, createProcurementImage } from './api.js';
import { v4 as uuidv4 } from 'uuid';

// Configuration
const CONCURRENT_UPLOADS = 3;
const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000]; // exponential backoff

// State
let queue = [];
let processing = false;
let listeners = [];

// ============================================
// PUBLIC API
// ============================================

/**
 * Add item ke queue
 * @param {Object} item - { supplierId, supplierName, modelId, modelName, price, quantity, imageBlob }
 * @returns {string} - temp ID untuk tracking
 */
export function addToQueue(item) {
  const id = uuidv4();
  const queueItem = {
    id,
    ...item,
    status: 'pending', // pending | uploading | success | failed
    progress: 0,
    retryCount: 0,
    error: null,
    createdAt: new Date().toISOString(),
  };
  
  queue.push(queueItem);
  notifyListeners();
  
  // Start processing if not already
  processQueue();
  
  return id;
}

/**
 * Get all queue items
 */
export function getQueueItems() {
  return [...queue];
}

/**
 * Get item by ID
 */
export function getQueueItem(id) {
  return queue.find(item => item.id === id);
}

/**
 * Retry failed item
 */
export function retryItem(id) {
  const item = queue.find(item => item.id === id);
  if (item && item.status === 'failed') {
    item.status = 'pending';
    item.retryCount = 0;
    item.error = null;
    notifyListeners();
    processQueue();
  }
}

/**
 * Retry all failed items
 */
export function retryAllFailed() {
  queue.forEach(item => {
    if (item.status === 'failed') {
      item.status = 'pending';
      item.retryCount = 0;
      item.error = null;
    }
  });
  notifyListeners();
  processQueue();
}

/**
 * Remove item from queue
 */
export function removeFromQueue(id) {
  queue = queue.filter(item => item.id !== id);
  notifyListeners();
}

/**
 * Clear completed items
 */
export function clearCompleted() {
  queue = queue.filter(item => item.status !== 'success');
  notifyListeners();
}

/**
 * Subscribe to queue changes
 */
export function onQueueChange(callback) {
  listeners.push(callback);
  return () => {
    listeners = listeners.filter(cb => cb !== callback);
  };
}

// ============================================
// PRIVATE: Queue Processing
// ============================================

async function processQueue() {
  if (processing) return;
  processing = true;
  
  while (true) {
    // Find pending items
    const pendingItems = queue.filter(item => item.status === 'pending');
    
    if (pendingItems.length === 0) break;
    
    // Get items that can be processed (based on concurrent limit)
    const uploadingCount = queue.filter(item => item.status === 'uploading').length;
    const availableSlots = CONCURRENT_UPLOADS - uploadingCount;
    
    if (availableSlots <= 0) break;
    
    // Process up to available slots
    const itemsToProcess = pendingItems.slice(0, availableSlots);
    
    // Process in parallel
    await Promise.all(
      itemsToProcess.map(item => processItem(item))
    );
  }
  
  processing = false;
}

async function processItem(item) {
  // Update status to uploading
  item.status = 'uploading';
  item.progress = 10;
  notifyListeners();
  
  try {
    // Step 1: Get signed URL
    item.progress = 20;
    notifyListeners();
    
    const { uploadUrl, fields, storagePath } = await getSignedUploadUrl(
      item.organizationId || getCurrentOrgId(),
      `${item.id}.jpg`,
      'image/jpeg'
    );
    
    // Step 2: Upload to R2
    item.progress = 40;
    notifyListeners();
    
    await uploadToR2(uploadUrl, fields, item.imageBlob);
    
    // Step 3: Create procurement record
    item.progress = 70;
    notifyListeners();
    
    const procurement = await createProcurement({
      organization_id: item.organizationId || getCurrentOrgId(),
      supplier_id: item.supplierId,
      model_id: item.modelId || null,
      request_id: item.id,
      price: item.price,
      currency: 'IDR',
      quantity: item.quantity || 1,
      captured_by: getCurrentUserId(),
      captured_at: new Date().toISOString(),
      device_id: getDeviceId(),
    });
    
    // Step 4: Create image metadata
    item.progress = 90;
    notifyListeners();
    
    await createProcurementImage({
      procurement_id: procurement.id,
      organization_id: item.organizationId || getCurrentOrgId(),
      storage_path: storagePath,
      content_type: 'image/jpeg',
      file_size: item.imageBlob.size,
      variant: 'original',
    });
    
    // Success!
    item.status = 'success';
    item.progress = 100;
    notifyListeners();
    
  } catch (error) {
    console.error('Upload failed:', error);
    
    // Handle retry
    item.retryCount++;
    
    if (item.retryCount < MAX_RETRIES) {
      // Schedule retry with backoff
      const delay = RETRY_DELAYS[item.retryCount - 1] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
      item.status = 'pending';
      
      setTimeout(() => {
        notifyListeners();
        processQueue();
      }, delay);
    } else {
      // Max retries reached
      item.status = 'failed';
      item.error = error.message;
    }
    
    notifyListeners();
  }
}

async function uploadToR2(uploadUrl, fields, blob) {
  const formData = new FormData();
  
  for (const [key, value] of Object.entries(fields)) {
    formData.append(key, value);
  }
  
  formData.append('file', blob);
  
  const response = await fetch(uploadUrl, {
    method: 'POST',
    body: formData,
  });
  
  if (!response.ok) {
    throw new Error(`Upload failed: ${response.status}`);
  }
}

function getCurrentOrgId() {
  // Get from app state
  const org = window.appState?.organization;
  return org?.id;
}

function getCurrentUserId() {
  const user = window.appState?.user;
  return user?.id;
}

function getDeviceId() {
  let deviceId = localStorage.getItem('device_id');
  if (!deviceId) {
    deviceId = uuidv4();
    localStorage.setItem('device_id', deviceId);
  }
  return deviceId;
}

function notifyListeners() {
  listeners.forEach(cb => cb([...queue]));
}
```

---

## Step 2: Refactor dataService.js

**File:** `src/modules/dataService.js`

**Changes:**

```javascript
// BEFORE (offline-first):
import { addToQueue, ... } from './db.js';

export async function saveProcurementItem(item) {
  // 1. Save to IndexedDB
  await saveProcurement({...});
  // 2. Add to queue
  await addToQueue({...});
  // 3. Return
  return procurementId;
}

// AFTER (online-only):
import { addToQueue } from './uploadQueue.js';

export async function saveProcurementItem(item) {
  // Check online first
  if (!navigator.onLine) {
    throw new Error('Koneksi internet diperlukan');
  }
  
  // Add to upload queue (optimistic)
  const tempId = addToQueue(item);
  
  return tempId;
}
```

---

## Step 3: Simplify db.js

**File:** `src/modules/db.js`

**Changes:**

```javascript
// REMOVE these functions:
- addToQueue()
- getPendingItems()
- updateQueueItem()
- removeFromQueue()
- getAllQueueItems()
- clearCompletedQueue()

// KEEP these functions (for read cache):
- initDB()
- getProcurements()
- getProcurement()
- getProcurementsBySupplier()
- cacheSuppliers()
- getSuppliers()
- getSupplierByName()
- cacheModels()
- getModels()
- getModelByName()
```

---

## Step 4: Refactor sync.js

**File:** `src/modules/sync.js`

**Changes:**

```javascript
// BEFORE:
// - Complex sync engine
// - Auto sync every 30s
// - IndexedDB queue

// AFTER:
// - Just re-export from uploadQueue
// - Keep for backward compatibility

import {
  addToQueue,
  getQueueItems,
  getQueueItem,
  retryItem,
  retryAllFailed,
  removeFromQueue,
  clearCompleted,
  onQueueChange,
} from './uploadQueue.js';

// Re-export for backward compatibility
export {
  addToQueue,
  getQueueItems,
  getQueueItem,
  retryItem,
  retryAllFailed,
  removeFromQueue,
  clearCompleted,
  onQueueChange,
};

// Remove old sync functions:
// - start() - REMOVE
// - stop() - REMOVE
// - triggerSync() - REMOVE (use addToQueue instead)
// - sync() - REMOVE (handled by uploadQueue)
// - processItem() - REMOVE (handled by uploadQueue)
```

---

## Step 5: Update capture.js

**File:** `src/pages/capture.js`

**Changes:**

```javascript
// Add loading state
let isSaving = false;

async function handleSave() {
  if (isSaving) return;
  
  // Check online
  if (!navigator.onLine) {
    showNotification('offline');
    return;
  }
  
  // Show loading
  isSaving = true;
  showLoadingState();
  
  try {
    const tempId = await saveProcurementItem(item);
    
    // Subscribe to upload status
    const unsubscribe = onQueueChange((queue) => {
      const uploadItem = queue.find(i => i.id === tempId);
      if (uploadItem) {
        updateUploadStatus(uploadItem);
        
        if (uploadItem.status === 'success') {
          showNotification('success');
          unsubscribe();
          navigateToHome();
        } else if (uploadItem.status === 'failed') {
          showNotification('failed', uploadItem.error);
          unsubscribe();
        }
      }
    });
    
  } catch (error) {
    showNotification('error', error.message);
    isSaving = false;
  }
}

function showLoadingState() {
  // Disable form
  // Show spinner
  // Change button text to "Menyimpan..."
}

function updateUploadStatus(item) {
  if (item.status === 'uploading') {
    // Show progress
  }
}
```

---

## Step 6: Update batch.js

**File:** `src/pages/batch.js`

**Changes:**

```javascript
// Add batch queue state
let batchQueue = [];

// When photo is captured:
function onPhotoCapture(photoData) {
  // Add to local queue
  batchQueue.push({
    ...photoData,
    status: 'pending',
  });
  
  renderBatchList();
  
  // Start upload if not already
  if (!isUploading) {
    startBatchUpload();
  }
}

// Upload function:
async function startBatchUpload() {
  isUploading = true;
  
  while (batchQueue.some(item => item.status === 'pending')) {
    // Get pending items (max 3)
    const pending = batchQueue
      .filter(item => item.status === 'pending')
      .slice(0, 3);
    
    // Upload in parallel
    await Promise.all(pending.map(async (item) => {
      try {
        item.status = 'uploading';
        renderBatchList();
        
        const tempId = await saveProcurementItem({
          supplierId: item.supplierId,
          supplierName: item.supplierName,
          modelName: item.modelName,
          price: item.price,
          quantity: item.quantity,
          imageBlob: item.imageBlob,
        });
        
        item.status = 'success';
        item.tempId = tempId;
      } catch (error) {
        item.status = 'failed';
        item.error = error.message;
      }
      
      renderBatchList();
    }));
  }
  
  isUploading = false;
}

// UI: Render batch list with status
function renderBatchList() {
  const html = batchQueue.map((item, index) => {
    const statusIcon = {
      pending: '⏳',
      uploading: '📤',
      success: '✅',
      failed: '❌',
    }[item.status];
    
    return `
      <div class="batch-item ${item.status}">
        <span>${statusIcon} ${item.supplierName}</span>
        ${item.status === 'failed' ? `<button onclick="retry(${index})">Coba</button>` : ''}
      </div>
    `;
  }).join('');
  
  document.getElementById('batch-list').innerHTML = html;
}
```

---

## Step 7: Simplify Service Worker

**File:** `public/sw.js`

**Changes:**

```javascript
// Keep only:
// - Cache static assets (app shell)
// - Offline fallback for navigation

// Remove:
// - API caching
// - Complex fetch handlers

const CACHE_NAME = 'procurement-v1';
const ASSETS = ['/', '/index.html', '/128x128@2x.png', '/manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  // Only cache GET requests for app shell
  if (event.request.method !== 'GET') return;
  
  // For navigation requests, try network first
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/'))
    );
    return;
  }
});
```

---

## Step 8: Integration Testing

**Test scenarios:**

1. ✅ Single capture - success flow
2. ✅ Single capture - fail + retry
3. ✅ Single capture - offline error
4. ✅ Batch capture - all success
5. ✅ Batch capture - partial fail + retry
6. ✅ Page refresh - queue state persists? (decide: keep or lose)

---

## Files Summary

| Step | File | Action |
|------|------|--------|
| 1 | `src/modules/uploadQueue.js` | CREATE |
| 2 | `src/modules/dataService.js` | REFACTOR |
| 3 | `src/modules/db.js` | MODIFY - remove queue |
| 4 | `src/modules/sync.js` | REFACTOR - re-export |
| 5 | `src/pages/capture.js` | MODIFY - loading states |
| 6 | `src/pages/batch.js` | MODIFY - progress UI |
| 7 | `public/sw.js` | SIMPLIFY |

---

## Timeline

```
Day 1: uploadQueue.js + dataService.js
Day 2: db.js + sync.js
Day 3: capture.js
Day 4: batch.js
Day 5: sw.js + testing
```
