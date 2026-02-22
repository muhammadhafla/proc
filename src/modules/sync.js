// Sync Module - Re-exports from uploadQueue (Online-Only)
// This module is kept for backward compatibility
// Use uploadQueue.js directly for queue operations

import {
  addToQueue,
  getQueueItems,
  getQueueItem,
  retryItem,
  removeFromQueue,
  onQueueChange,
  getQueueStats,
  isOnline,
  uploadQueue,
} from './uploadQueue.js';

// Re-export all functions for backward compatibility
export {
  addToQueue,
  getQueueItems as getPendingItems,
  getQueueItem,
  retryItem as updateQueueItem,
  removeFromQueue,
  getQueueItems as getAllQueueItems,
  onQueueChange,
  getQueueStats,
  isOnline,
  uploadQueue,
};

// Legacy sync engine - kept for backward compatibility
// The old auto-sync functionality has been removed
// Queue is now processed immediately when items are added
export const syncEngine = {
  // No more auto-start
  start: () => {
    console.warn('syncEngine.start() is deprecated. Queue processes automatically.');
  },
  
  stop: () => {
    console.warn('syncEngine.stop() is deprecated. Queue processes automatically.');
  },
  
  triggerSync: () => {
    console.warn('syncEngine.triggerSync() is deprecated. Use addToQueue() instead.');
  },
  
  get isRunning() {
    return true; // Always running (processes immediately)
  },
};

// Backward compatibility aliases
export { uploadQueue as queue };
