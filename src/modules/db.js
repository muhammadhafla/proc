// IndexedDB Module - Offline-first local storage
import { openDB } from 'idb';

const DB_NAME = 'procurement-db';
const DB_VERSION = 1;

let dbPromise = null;

/**
 * Initialize the IndexedDB database
 */
export async function initDB() {
  if (dbPromise) return dbPromise;
  
  dbPromise = openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, newVersion, transaction) {
      // Store for pending uploads (queue)
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
 * Get all cached procurements
 */
export async function getProcurements(limit = 50, offset = 0) {
  const db = await getDB();
  const all = await db.getAll('procurements');
  
  // Sort by captured_at descending
  all.sort((a, b) => new Date(b.captured_at) - new Date(a.captured_at));
  
  return all.slice(offset, offset + limit);
}

/**
 * Get procurement by ID
 */
export async function getProcurement(id) {
  const db = await getDB();
  return db.get('procurements', id);
}

/**
 * Search procurements by supplier
 */
export async function getProcurementsBySupplier(supplierId) {
  const db = await getDB();
  const tx = db.transaction('procurements', 'readonly');
  const index = tx.store.index('supplierId');
  return index.getAll(supplierId);
}

// ==================== Supplier Operations ====================

/**
 * Cache suppliers locally
 */
export async function cacheSuppliers(suppliers) {
  const db = await getDB();
  const tx = db.transaction('suppliers', 'readwrite');
  
  for (const supplier of suppliers) {
    await tx.store.put(supplier);
  }
  
  return tx.done;
}

/**
 * Get all cached suppliers
 */
export async function getSuppliers() {
  const db = await getDB();
  const all = await db.getAll('suppliers');
  return all.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Add a new supplier locally
 */
export async function addSupplier(supplier) {
  const db = await getDB();
  return db.put('suppliers', {
    ...supplier,
    created_at: new Date().toISOString(),
  });
}

// ==================== Model Operations ====================

/**
 * Cache models locally
 */
export async function cacheModels(models) {
  const db = await getDB();
  const tx = db.transaction('models', 'readwrite');
  
  for (const model of models) {
    await tx.store.put(model);
  }
  
  return tx.done;
}

/**
 * Get all cached models
 */
export async function getModels() {
  const db = await getDB();
  const all = await db.getAll('models');
  return all.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Add a new model locally
 */
export async function addModel(model) {
  const db = await getDB();
  return db.put('models', {
    ...model,
    first_seen: new Date().toISOString(),
    created_at: new Date().toISOString(),
  });
}

/**
 * Search models by name (normalized)
 */
export async function searchModels(query) {
  const models = await getModels();
  const normalizedQuery = query.toLowerCase().trim();
  
  return models.filter(model => 
    model.name.toLowerCase().includes(normalizedQuery) ||
    model.normalized_name?.includes(normalizedQuery)
  );
}
