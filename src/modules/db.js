// IndexedDB Module - Local cache for read-only data (Online-Only)
// Queue operations moved to uploadQueue.js
// For backward compatibility, queue functions are deprecated and will be removed
// Use uploadQueue.js directly for queue operations
import { openDB } from 'idb';

const DB_NAME = 'procurement-db';
const DB_VERSION = 1;

let dbPromise = null;

/**
 * Initialize the IndexedDB database
 */
export async function initDB() {
  if (dbPromise) return dbPromise;
  
  console.log('[DB] Initializing with version:', DB_VERSION);
  
  dbPromise = openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, _newVersion, _transaction) {
      console.log('[DB] Running upgrade, old version:', oldVersion, '-> new:', DB_VERSION);
      
      // Initial schema setup (version 1)
      if (!db.objectStoreNames.contains('uploadQueue')) {
        const queueStore = db.createObjectStore('uploadQueue', { 
          keyPath: 'id', 
          autoIncrement: true 
        });
        queueStore.createIndex('status', 'status');
        queueStore.createIndex('createdAt', 'createdAt');
      }
      
      // Store for cached procurement data
      if (!db.objectStoreNames.contains('procurements')) {
        const procStore = db.createObjectStore('procurements', { 
          keyPath: 'id' 
        });
        procStore.createIndex('supplierId', 'supplier_id');
        procStore.createIndex('capturedAt', 'captured_at');
      }
      
      // Store for suppliers (cached from server)
      if (!db.objectStoreNames.contains('suppliers')) {
        const supplierStore = db.createObjectStore('suppliers', { 
          keyPath: 'id' 
        });
        supplierStore.createIndex('name', 'name');
      }
      
      // Store for models (cached from server)
      if (!db.objectStoreNames.contains('models')) {
        const modelStore = db.createObjectStore('models', { 
          keyPath: 'id' 
        });
        modelStore.createIndex('name', 'name');
      }
    },
  });
  
  return dbPromise;
}

/**
 * Get the database instance
 */
export async function getDB() {
  if (!dbPromise) {
    await initDB();
  }
  return dbPromise;
}

// ==================== Upload Queue Operations ====================

/**
 * Add item to upload queue
 */
export async function addToQueue(item) {
  const db = await getDB();
  const queueItem = {
    ...item,
    status: 'pending',
    createdAt: new Date().toISOString(),
    retryCount: 0,
  };
  return db.add('uploadQueue', queueItem);
}

/**
 * Get all pending items from queue
 */
export async function getPendingItems() {
  const db = await getDB();
  const tx = db.transaction('uploadQueue', 'readonly');
  const index = tx.store.index('status');
  return index.getAll('pending');
}

/**
 * Get all items in queue
 */
export async function getAllQueueItems() {
  const db = await getDB();
  return db.getAll('uploadQueue');
}

/**
 * Update queue item status
 */
export async function updateQueueItem(id, updates) {
  const db = await getDB();
  const item = await db.get('uploadQueue', id);
  if (item) {
    return db.put('uploadQueue', { ...item, ...updates });
  }
}

/**
 * Remove item from queue
 */
export async function removeFromQueue(id) {
  const db = await getDB();
  return db.delete('uploadQueue', id);
}

/**
 * Clear all completed items from queue
 */
export async function clearCompletedQueue() {
  const db = await getDB();
  const tx = db.transaction('uploadQueue', 'readwrite');
  const index = tx.store.index('status');
  const completed = await index.getAllKeys('success');
  
  for (const key of completed) {
    await tx.store.delete(key);
  }
  
  return tx.done;
}

// ==================== Procurement Operations ====================

/**
 * Save procurement locally
 */
export async function saveProcurement(procurement) {
  const db = await getDB();
  return db.put('procurements', {
    ...procurement,
    cached_at: new Date().toISOString(),
  });
}

/**
 * Get all cached procurements with proper cursor-based pagination
 */
export async function getProcurements(limit = 20, offset = 0) {
  const db = await getDB();
  const tx = db.transaction('procurements', 'readonly');
  const store = tx.objectStore('procurements');
  
  // Use cursor for efficient pagination instead of loading all
  const results = [];
  let cursor = await store.openCursor(null, 'prev'); // 'prev' for descending order
  
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

/**
 * Get procurement by ID
 */
export async function getProcurement(id) {
  const db = await getDB();
  return db.get('procurements', id);
}

// ==================== Supplier Operations ====================

/**
 * Cache suppliers locally
 */
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
  
  // Use bulkPut for better performance - remove await inside loop
  for (const supplier of suppliers) {
    store.put(supplier);
  }
  
  return tx.done;
}

/**
 * Get all cached suppliers with optional pagination
 */
export async function getSuppliers(limit = null, offset = 0) {
  const db = await getDB();
  
  // If no limit requested, still use cursor for memory efficiency
  if (limit === null) {
    const tx = db.transaction('suppliers', 'readonly');
    const store = tx.objectStore('suppliers');
    const index = store.index('name');
    const results = [];
    
    // Use IDBKeyRange to get sorted results efficiently
    let cursor = await index.openCursor();
    while (cursor) {
      results.push(cursor.value);
      cursor = await cursor.continue();
    }
    return results;
  }
  
  // Optimized pagination using cursor
  const tx = db.transaction('suppliers', 'readonly');
  const store = tx.objectStore('suppliers');
  const index = store.index('name');
  
  const results = [];
  let cursor = await index.openCursor();
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

/**
 * Get total count of suppliers (for pagination UI)
 */
export async function getSuppliersCount() {
  const db = await getDB();
  return db.count('suppliers');
}

/**
 * Get supplier by normalized name (efficient lookup)
 * @param {string} normalizedName - Normalized supplier name
 * @returns {Promise<Object|null>} - Supplier or null
 */
export async function getSupplierByName(normalizedName) {
  const db = await getDB();
  const tx = db.transaction('suppliers', 'readonly');
  const store = tx.objectStore('suppliers');
  const index = store.index('name');
  
  // Use IDBKeyRange for exact match
  const range = IDBKeyRange.only(normalizedName);
  const cursor = await index.openCursor(range);
  
  if (cursor) {
    return cursor.value;
  }
  return null;
}

// ==================== Model Operations ====================

/**
 * Cache models locally
 */
export async function cacheModels(models) {
  if (!models || models.length === 0) {
    return;
  }
  
  const db = await getDB();
  const tx = db.transaction('models', 'readwrite');
  const store = tx.objectStore('models');
  
  // Use bulkPut for better performance - remove await inside loop
  for (const model of models) {
    store.put(model);
  }
  
  return tx.done;
}

/**
 * Get all cached models with optional pagination
 */
export async function getModels(limit = null, offset = 0) {
  const db = await getDB();
  
  // If no limit requested, still use cursor for memory efficiency
  if (limit === null) {
    const tx = db.transaction('models', 'readonly');
    const store = tx.objectStore('models');
    const index = store.index('name');
    const results = [];
    
    // Use IDBKeyRange to get sorted results efficiently
    let cursor = await index.openCursor();
    while (cursor) {
      results.push(cursor.value);
      cursor = await cursor.continue();
    }
    return results;
  }
  
  // Optimized pagination using cursor
  const tx = db.transaction('models', 'readonly');
  const store = tx.objectStore('models');
  const index = store.index('name');
  
  const results = [];
  let cursor = await index.openCursor();
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

/**
 * Get total count of models (for pagination UI)
 */
export async function getModelsCount() {
  const db = await getDB();
  return db.count('models');
}

/**
 * Get model by normalized name (efficient lookup)
 * @param {string} normalizedName - Normalized model name
 * @returns {Promise<Object|null>} - Model or null
 */
export async function getModelByName(normalizedName) {
  const db = await getDB();
  const tx = db.transaction('models', 'readonly');
  const store = tx.objectStore('models');
  const index = store.index('name');
  
  const range = IDBKeyRange.only(normalizedName);
  const cursor = await index.openCursor(range);
  
  if (cursor) {
    return cursor.value;
  }
  return null;
}
