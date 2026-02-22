// ============================================
// UPLOAD QUEUE MODULE
// Simple in-memory queue for optimistic uploads (Online-Only)
// ============================================

import { getSignedUploadUrl, createProcurement, createProcurementImage } from './api.js';
import { v4 as uuidv4 } from 'uuid';

// ============================================
// CONFIGURATION
// ============================================

const CONCURRENT_UPLOADS = 3;
const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000]; // exponential backoff in ms

// ============================================
// STATE
// ============================================

let queue = [];
let processing = false;
let listeners = [];

// ============================================
// PUBLIC API
// ============================================

/**
 * Add item to upload queue
 * @param {Object} item - { supplierId, supplierName, modelId, modelName, price, quantity, imageBlob }
 * @returns {string} - temp ID for tracking
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
 * @returns {Array} - copy of queue array
 */
export function getQueueItems() {
  return [...queue];
}

/**
 * Get item by ID
 * @param {string} id - item ID
 * @returns {Object|null} - queue item or null
 */
export function getQueueItem(id) {
  return queue.find(item => item.id === id) || null;
}

/**
 * Retry failed item
 * @param {string} id - item ID to retry
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
 * @param {string} id - item ID to remove
 */
export function removeFromQueue(id) {
  queue = queue.filter(item => item.id !== id);
  notifyListeners();
}

/**
 * Clear completed items from queue
 */
export function clearCompleted() {
  queue = queue.filter(item => item.status !== 'success');
  notifyListeners();
}

/**
 * Subscribe to queue changes
 * @param {Function} callback - called with queue array on changes
 * @returns {Function} - unsubscribe function
 */
export function onQueueChange(callback) {
  listeners.push(callback);
  return () => {
    listeners = listeners.filter(cb => cb !== callback);
  };
}

/**
 * Get queue statistics
 * @returns {Object} - { pending, uploading, success, failed, total }
 */
export function getQueueStats() {
  return {
    pending: queue.filter(item => item.status === 'pending').length,
    uploading: queue.filter(item => item.status === 'uploading').length,
    success: queue.filter(item => item.status === 'success').length,
    failed: queue.filter(item => item.status === 'failed').length,
    total: queue.length,
  };
}

/**
 * Check if online
 * @returns {boolean}
 */
export function isOnline() {
  return navigator.onLine;
}

// ============================================
// PRIVATE: QUEUE PROCESSING
// ============================================

async function processQueue() {
  if (processing) return;
  processing = true;
  
  let shouldContinue = true;
  
  while (shouldContinue) {
    // Find pending items
    const pendingItems = queue.filter(item => item.status === 'pending');
    
    if (pendingItems.length === 0) {
      shouldContinue = false;
      break;
    }
    
    // Get items that can be processed (based on concurrent limit)
    const uploadingCount = queue.filter(item => item.status === 'uploading').length;
    const availableSlots = CONCURRENT_UPLOADS - uploadingCount;
    
    if (availableSlots <= 0) {
      shouldContinue = false;
      break;
    }
    
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
    // Step 1: Get signed URL from Worker
    item.progress = 20;
    notifyListeners();
    
    const orgId = getCurrentOrgId();
    if (!orgId) {
      throw new Error('No organization found. Please sign out and sign in again.');
    }
    
    const { uploadUrl, fields, storagePath } = await getSignedUploadUrl(
      orgId,
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
      organization_id: orgId,
      supplier_id: item.supplierId,
      model_id: item.modelId || null,
      request_id: item.id,
      price: item.price,
      currency: 'IDR',
      quantity: item.quantity || 1,
      captured_by: getCurrentUserId(),
      captured_at: new Date().toISOString(),
      device_id: getDeviceId(),
      batch_id: item.batchId || null,
    });
    
    // Step 4: Create image metadata
    item.progress = 90;
    notifyListeners();
    
    await createProcurementImage({
      procurement_id: procurement.id,
      organization_id: orgId,
      storage_path: storagePath,
      content_type: 'image/jpeg',
      file_size: item.imageBlob.size,
      variant: 'original',
    });
    
    // Success!
    item.status = 'success';
    item.progress = 100;
    item.procurementId = procurement.id;
    notifyListeners();
    
  } catch (error) {
    console.error('Upload failed:', error);
    
    // Handle retry
    item.retryCount++;
    
    if (item.retryCount < MAX_RETRIES) {
      // Schedule retry with backoff
      const delay = RETRY_DELAYS[item.retryCount - 1] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
      item.status = 'pending';
      item.progress = 0;
      
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
  // Try multiple sources for organization ID
  try {
    // From appState
    const org = window.appState?.organization;
    if (org?.id) return org.id;
    
    // From localStorage
    const stored = localStorage.getItem('organization');
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed?.id;
    }
  } catch (e) {
    console.warn('Failed to get org ID:', e);
  }
  return null;
}

function getCurrentUserId() {
  try {
    const user = window.appState?.user;
    if (user?.id) return user.id;
    
    const stored = localStorage.getItem('user');
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed?.id;
    }
  } catch (e) {
    console.warn('Failed to get user ID:', e);
  }
  return null;
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
  const queueCopy = [...queue];
  listeners.forEach(cb => {
    try {
      cb(queueCopy);
    } catch (e) {
      console.error('Queue listener error:', e);
    }
  });
}

// ============================================
// EXPORTS
// ============================================

export const uploadQueue = {
  add: addToQueue,
  getItems: getQueueItem,
  getAll: getQueueItems,
  retry: retryItem,
  retryAll: retryAllFailed,
  remove: removeFromQueue,
  clear: clearCompleted,
  onChange: onQueueChange,
  getStats: getQueueStats,
  isOnline,
};
