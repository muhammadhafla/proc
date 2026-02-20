// Sync Engine - Background synchronization module
import { getPendingItems, updateQueueItem, removeFromQueue, getAllQueueItems } from './db.js';
import { getSignedUploadUrl, createProcurement, createProcurementImage } from './api.js';
import { config } from './config.js';
import { v4 as uuidv4 } from 'uuid';

let syncInterval = null;
let isSyncing = false;

/**
 * Start the sync engine
 */
export function start() {
  if (syncInterval) return;
  
  console.log('Sync engine started');
  
  // Initial sync
  sync();
  
  // Set up periodic sync every 30 seconds
  syncInterval = setInterval(sync, 30000);
  
  // Also sync when network becomes available
  window.addEventListener('online', handleOnline);
}

/**
 * Stop the sync engine
 */
export function stop() {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
  console.log('Sync engine stopped');
}

/**
 * Trigger manual sync
 */
export function triggerSync() {
  sync();
}

/**
 * Handle coming online
 */
function handleOnline() {
  console.log('Network available, triggering sync');
  sync();
}

/**
 * Main sync function
 */
async function sync() {
  // Prevent concurrent syncs
  if (isSyncing || !navigator.onLine) return;
  
  isSyncing = true;
  
  try {
    const pendingItems = await getPendingItems();
    
    if (pendingItems.length === 0) {
      console.log('No pending items to sync');
      return;
    }
    
    console.log(`Syncing ${pendingItems.length} pending items...`);
    
    // Process items sequentially
    for (const item of pendingItems) {
      try {
        await processItem(item);
      } catch (error) {
        console.error('Failed to sync item:', error);
        
        // Increment retry count
        const newRetryCount = (item.retryCount || 0) + 1;
        
        if (newRetryCount >= config.sync.retryAttempts) {
          // Mark as failed after max retries
          await updateQueueItem(item.id, {
            status: 'failed',
            retryCount: newRetryCount,
            error: error.message,
          });
        } else {
          // Update retry count
          await updateQueueItem(item.id, {
            retryCount: newRetryCount,
          });
        }
      }
    }
    
    // Clean up completed items
    await cleanupCompleted();
    
  } catch (error) {
    console.error('Sync error:', error);
  } finally {
    isSyncing = false;
  }
}

/**
 * Process a single queue item
 */
async function processItem(item) {
  // Update status to uploading
  await updateQueueItem(item.id, { status: 'uploading' });
  
  const organizationId = window.appState?.organization?.id;
  if (!organizationId) {
    throw new Error('No organization found');
  }
  
  // Generate storage path
  const requestId = item.requestId || uuidv4();
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const storagePath = `${organizationId}/${item.supplierId}/${year}/${month}/${requestId}.jpg`;
  
  // Get signed upload URL
  const { uploadUrl, fields } = await getSignedUploadUrl(
    organizationId,
    `${requestId}.jpg`,
    'image/jpeg'
  );
  
  // Upload image to R2
  await uploadToR2(uploadUrl, fields, item.imageBlob);
  
  // Create procurement record in database
  const procurementData = {
    organization_id: organizationId,
    supplier_id: item.supplierId,
    model_id: item.modelId || null,
    request_id: requestId,
    price: item.price,
    currency: 'IDR',
    quantity: item.quantity || 1,
    captured_by: window.appState.user?.id,
    captured_at: new Date().toISOString(),
    device_id: getDeviceId(),
    batch_id: item.batchId || null,
  };
  
  const procurement = await createProcurement(procurementData);
  
  // Create image metadata
  const imageData = {
    procurement_id: procurement.id,
    organization_id: organizationId,
    storage_path: storagePath,
    content_type: 'image/jpeg',
    file_size: item.imageBlob.size,
    variant: 'original',
  };
  
  await createProcurementImage(imageData);
  
  // Remove from queue on success
  await removeFromQueue(item.id);
  
  console.log(`Successfully synced item ${item.id}`);
}

/**
 * Upload image to R2 using signed URL
 */
async function uploadToR2(uploadUrl, fields, blob) {
  // Create FormData with signed fields
  const formData = new FormData();
  
  for (const [key, value] of Object.entries(fields)) {
    formData.append(key, value);
  }
  
  // Add the file
  formData.append('file', blob);
  
  // Upload
  const response = await fetch(uploadUrl, {
    method: 'POST',
    body: formData,
  });
  
  if (!response.ok) {
    throw new Error(`Upload failed: ${response.status}`);
  }
}

/**
 * Clean up completed items
 */
async function cleanupCompleted() {
  const items = await getAllQueueItems();
  const completed = items.filter(item => item.status === 'success');
  
  for (const item of completed) {
    await removeFromQueue(item.id);
  }
}

/**
 * Get or generate device ID
 */
function getDeviceId() {
  let deviceId = localStorage.getItem('device_id');
  if (!deviceId) {
    deviceId = uuidv4();
    localStorage.setItem('device_id', deviceId);
  }
  return deviceId;
}

// Export sync engine
export const syncEngine = {
  start,
  stop,
  triggerSync,
  get isRunning() {
    return !!syncInterval;
  },
};
