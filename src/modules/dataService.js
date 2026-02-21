// Shared Data Service Module
// Reusable supplier/model/procurement handling for capture and batch pages
import { v4 as uuidv4 } from 'uuid';
import { addSupplier, addModel, saveProcurement, addToQueue, getSuppliers, getModels } from './db.js';
import { createSupplier, createModel } from './api.js';

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
  
  // Check existing
  const suppliers = await getSuppliers();
  const existingSupplier = suppliers.find(s => s.name.toLowerCase() === normalizedName);

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

  // Try to sync to server
  try {
    await createSupplier({
      id: supplierId,
      organization_id: window.appState?.organization?.id,
      name: name.trim(),
      normalized_name: normalizedName,
    });
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

  // Check existing
  const models = await getModels();
  const existingModel = models.find(m => m.name.toLowerCase() === normalizedName);

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

  // Try to sync to server
  try {
    await createModel({
      id: modelId,
      organization_id: window.appState?.organization?.id,
      name: name.trim(),
      normalized_name: normalizedName,
    });
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
  const ids = [];
  
  for (const item of items) {
    const id = await saveProcurementItem(item);
    ids.push(id);
  }

  return ids;
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
