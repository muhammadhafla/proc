// Shared Data Service Module
// Online-Only with Optimistic Queue - Refactored
import { v4 as uuidv4 } from 'uuid';
import { getSupplierByName, getModelByName, cacheSuppliers, cacheModels } from './db.js';
import { createSupplier, createModel } from './api.js';
import { addToQueue, isOnline } from './uploadQueue.js';

/**
 * Wrap a promise with a timeout
 * @param {Promise} promise - Promise to wrap
 * @param {number} ms - Timeout in milliseconds
 * @param {string} errorMessage - Error message for timeout
 * @returns {Promise} - Promise that rejects after timeout
 */
function withTimeout(promise, ms, errorMessage) {
  return Promise.race([
    promise,
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error(errorMessage)), ms)
    )
  ]);
}

/**
 * Get or create a supplier (Online-Only)
 * Creates directly on server, caches locally for read
 * @param {string} name - Supplier name
 * @returns {Promise<string>} - Supplier ID
 */
export async function getOrCreateSupplier(name) {
  if (!name || !name.trim()) {
    throw new Error('Supplier name is required');
  }

  // Check if online first
  if (!isOnline()) {
    throw new Error('Koneksi internet diperlukan untuk menambah supplier baru');
  }

  const normalizedName = name.toLowerCase().trim();
  
  // Check local cache first
  const existingSupplier = await getSupplierByName(normalizedName);
  if (existingSupplier) {
    return existingSupplier.id;
  }

  // Create new on server
  const supplierId = uuidv4();
  
  try {
    const organizationId = window.appState.get('organization')?.id;
    if (!organizationId) {
      throw new Error('No organization found. Please sign out and sign in again.');
    }
    
    // Create on server
    await withTimeout(
      createSupplier({
        id: supplierId,
        organization_id: organizationId,
        name: name.trim(),
        normalized_name: normalizedName,
      }),
      10000,
      'Failed to create supplier. Please try again.'
    );
    
    // Cache locally for read
    await cacheSuppliers([{
      id: supplierId,
      name: name.trim(),
      normalized_name: normalizedName,
    }]);
    
    return supplierId;
    
  } catch (error) {
    console.error('Failed to create supplier:', error);
    throw error;
  }
}

/**
 * Get or create a model (Online-Only)
 * Creates directly on server, caches locally for read
 * @param {string} name - Model name
 * @returns {Promise<string|null>} - Model ID or null if name not provided
 */
export async function getOrCreateModel(name) {
  if (!name || !name.trim()) {
    return null;
  }

  // Check if online first
  if (!isOnline()) {
    throw new Error('Koneksi internet diperlukan untuk menambah model baru');
  }

  const normalizedName = name.toLowerCase().trim();

  // Check local cache first
  const existingModel = await getModelByName(normalizedName);
  if (existingModel) {
    return existingModel.id;
  }

  // Create new on server
  const modelId = uuidv4();
  
  try {
    const organizationId = window.appState.get('organization')?.id;
    if (!organizationId) {
      throw new Error('No organization found. Please sign out and sign in again.');
    }
    
    // Create on server
    await withTimeout(
      createModel({
        id: modelId,
        organization_id: organizationId,
        name: name.trim(),
        normalized_name: normalizedName,
      }),
      10000,
      'Failed to create model. Please try again.'
    );
    
    // Cache locally for read
    await cacheModels([{
      id: modelId,
      name: name.trim(),
      normalized_name: normalizedName,
    }]);
    
    return modelId;
    
  } catch (error) {
    console.error('Failed to create model:', error);
    throw error;
  }
}

/**
 * @typedef {Object} ProcurementItem
 * @property {string} supplierId
 * @property {string} supplierName
 * @property {string} [modelId]
 * @property {string} [modelName]
 * @property {number} price
 * @property {number} [quantity]
 * @property {Blob} imageBlob
 */

/**
 * Save procurement item using optimistic queue (Online-Only)
 * Adds to upload queue for background processing
 * @param {ProcurementItem} item - Procurement item data
 * @returns {string} - Temp ID for tracking
 */
export async function saveProcurementItem(item) {
  const { supplierId, supplierName, modelId, modelName, price, quantity = 1, imageBlob } = item;

  if (!supplierId || !supplierName || !price) {
    throw new Error('Missing required fields: supplierId, supplierName, price');
  }

  // Check if online
  if (!isOnline()) {
    throw new Error('Koneksi internet diperlukan untuk menyimpan data');
  }

  // Add to upload queue (optimistic - returns immediately)
  const tempId = addToQueue({
    imageBlob,
    supplierId,
    supplierName,
    modelId,
    modelName,
    price,
    quantity,
  });

  return tempId;
}

/**
 * Save multiple procurement items (batch)
 * @param {ProcurementItem[]} items - Array of procurement items
 * @returns {string[]} - Array of temp IDs
 */
export async function saveBatchItems(items) {
  // Process all items in parallel
  const results = await Promise.all(
    items.map(item => saveProcurementItem(item))
  );

  return results;
}

/**
 * Create procurement item data without saving
 * Use this when you need to prepare data for batch processing
 * @param {Object} params
 * @param {string} params.supplierId
 * @param {string} params.supplierName
 * @param {string} [params.modelId]
 * @param {string} [params.modelName]
 * @param {number} params.price
 * @param {number} [params.quantity]
 * @param {Blob} params.imageBlob
 * @returns {Object} - Item data ready for saveProcurementItem
 */
export function createProcurementItemData({ supplierId, supplierName, modelId, modelName, price, quantity = 1, imageBlob }) {
  return {
    supplierId,
    supplierName,
    modelId,
    modelName,
    price,
    quantity,
    imageBlob,
  };
}
