// Shared Data Service Module
// Reusable supplier/model/procurement handling for capture and batch pages
import { v4 as uuidv4 } from 'uuid';
import { addSupplier, addModel, saveProcurement, addToQueue, getSupplierByName, getModelByName } from './db.js';
import { createSupplier, createModel } from './api.js';

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
 * Get or create a supplier (local + sync)
 * @param {string} name - Supplier name
 * @returns {Promise<string>} - Supplier ID
 */
export async function getOrCreateSupplier(name) {
  if (!name || !name.trim()) {
    throw new Error('Supplier name is required');
  }

  const normalizedName = name.toLowerCase().trim();
  
  // Check existing - EFFICIENT using indexed lookup
  const existingSupplier = await getSupplierByName(normalizedName);

  if (existingSupplier) {
    return existingSupplier.id;
  }

  // Create new locally first
  const supplierId = uuidv4();
  await addSupplier({
    id: supplierId,
    name: name.trim(),
    normalized_name: normalizedName,
  });

  // Try to sync to server with timeout
  try {
    const organizationId = window.appState?.organization?.id;
    if (organizationId) {
      await withTimeout(
        createSupplier({
          id: supplierId,
          organization_id: organizationId,
          name: name.trim(),
          normalized_name: normalizedName,
        }),
        5000,
        'Supplier sync timeout'
      );
    }
  } catch (error) {
    console.log('Supplier will sync later:', error.message);
    // Silently fails - will be synced later via sync.js
  }

  return supplierId;
}

/**
 * Get or create a model (local + sync)
 * @param {string} name - Model name
 * @returns {Promise<string|null>} - Model ID or null if name not provided
 */
export async function getOrCreateModel(name) {
  if (!name || !name.trim()) {
    return null;
  }

  const normalizedName = name.toLowerCase().trim();

  // Check existing - EFFICIENT using indexed lookup
  const existingModel = await getModelByName(normalizedName);

  if (existingModel) {
    return existingModel.id;
  }

  // Create new locally first
  const modelId = uuidv4();
  await addModel({
    id: modelId,
    name: name.trim(),
    normalized_name: normalizedName,
  });

  // Try to sync to server with timeout
  try {
    const organizationId = window.appState?.organization?.id;
    if (organizationId) {
      await withTimeout(
        createModel({
          id: modelId,
          organization_id: organizationId,
          name: name.trim(),
          normalized_name: normalizedName,
        }),
        5000,
        'Model sync timeout'
      );
    }
  } catch (error) {
    console.log('Model will sync later:', error.message);
    // Silently fails - will be synced later via sync.js
  }

  return modelId;
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
 * Save procurement item to local database and queue
 * @param {ProcurementItem} item - Procurement item data
 * @returns {Promise<string>} - Procurement ID
 */
export async function saveProcurementItem(item) {
  const { supplierId, supplierName, modelId, modelName, price, quantity = 1, imageBlob } = item;

  if (!supplierId || !supplierName || !price) {
    throw new Error('Missing required fields: supplierId, supplierName, price');
  }

  const procurementId = uuidv4();

  // Save to procurements store
  await saveProcurement({
    id: procurementId,
    supplier_id: supplierId,
    supplier_name: supplierName,
    model_id: modelId,
    model_name: modelName,
    price,
    quantity,
    captured_at: new Date().toISOString(),
    status: 'pending',
  });

  // Add to upload queue
  await addToQueue({
    requestId: procurementId,
    imageBlob,
    supplierId,
    supplierName,
    modelName,
    price,
    quantity,
  });

  return procurementId;
}

/**
 * Save multiple procurement items (batch)
 * @param {ProcurementItem[]} items - Array of procurement items
 * @returns {Promise<string[]>} - Array of procurement IDs
 */
export async function saveBatchItems(items) {
  // Process all items in parallel for maximum performance
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
