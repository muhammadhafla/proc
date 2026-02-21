// Unified Capture Page - Combines single capture and batch capture
import { router } from '../modules/router.js';
import { addToQueue, addSupplier, addModel, saveProcurement, getSuppliers, getModels } from '../modules/db.js';
import { createSupplier, createModel } from '../modules/api.js';
import { showNotification } from '../modules/app.js';
import { compressImage } from '../modules/compression.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Render unified capture page
 * Combines single capture and batch capture in one flow
 */
export function renderCapture(container) {
  container.innerHTML = `
    <div class="min-h-screen bg-gray-900 flex flex-col">
      <!-- Header -->
      <header class="bg-gray-800 p-4 flex items-center justify-between">
        <button id="btn-back" class="p-2 -ml-2 text-white hover:bg-gray-700 rounded-lg">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
          </svg>
        </button>
        <h1 class="text-white font-semibold">Capture</h1>
        <div class="flex items-center gap-2">
          <div id="batch-indicator" class="hidden px-3 py-1 bg-green-600 text-white text-sm font-medium rounded-full">
            <span id="batch-count">0</span> items
          </div>
          <button id="btn-finish" class="hidden px-4 py-2 bg-green-600 text-white rounded-lg font-medium" aria-label="Finish batch capture">
            Finish
          </button>
        </div>
      </header>
      
      <!-- Camera View -->
      <div class="flex-1 relative">
        <video id="camera-preview" class="w-full h-full object-cover" autoplay playsinline></video>
        <canvas id="capture-canvas" class="hidden"></canvas>
        
        <!-- Quick Input Overlay -->
        <div class="absolute bottom-0 left-0 right-0 p-4 bg-gray-800/90">
          <div class="max-w-lg mx-auto space-y-3">
            <!-- Supplier Input -->
            <input 
              type="text" 
              id="supplier-input"
              class="input bg-gray-700 border-gray-600 text-white"
              placeholder="Supplier name"
              aria-label="Supplier name"
            >
            
            <!-- Model Input -->
            <input 
              type="text" 
              id="model-input"
              class="input bg-gray-700 border-gray-600 text-white"
              placeholder="Model (optional)"
              aria-label="Model name"
            >
            
            <!-- Price Input -->
            <div class="flex gap-2">
              <input 
                type="number" 
                id="price-input"
                class="input bg-gray-700 border-gray-600 text-white flex-1"
                placeholder="Price"
                inputmode="numeric"
                aria-label="Price"
              >
              <button id="btn-capture" class="px-6 bg-white text-gray-900 font-bold rounded-lg" aria-label="Capture photo">
                CAPTURE
              </button>
            </div>
          </div>
        </div>
        
        <!-- Captured Image Preview -->
        <div id="preview-container" class="hidden absolute inset-0 bg-gray-900 flex flex-col">
          <img id="captured-image" class="w-full h-48 object-contain bg-black" alt="Captured preview">
          
          <!-- Form (for editing after capture) -->
          <div class="flex-1 bg-gray-800 p-4 space-y-4 overflow-y-auto">
            <div class="flex gap-2 pt-2">
              <button id="btn-retake" class="btn btn-secondary flex-1">Retake</button>
              <button id="btn-save-done" class="btn btn-primary flex-1">Save & Done</button>
              <button id="btn-save-continue" class="btn bg-green-600 hover:bg-green-700 text-white flex-1">Save & Continue</button>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Confirm Dialog Modal (for discard warning) -->
      <div id="confirm-modal" class="hidden fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
        <div class="bg-white rounded-xl max-w-sm w-full overflow-hidden">
          <div class="p-6 text-center">
            <div class="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg class="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
              </svg>
            </div>
            <h3 id="confirm-title" class="text-lg font-semibold text-gray-900 mb-2">Discard Items?</h3>
            <p class="text-gray-600 mb-6">You have <span id="confirm-item-count">0</span> captured items that will be lost.</p>
            <div class="flex gap-3">
              <button id="btn-cancel-discard" class="btn btn-secondary flex-1">Cancel</button>
              <button id="btn-confirm-discard" class="btn btn-danger flex-1">Discard</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  
  // Initialize camera
  initCamera();
  
  // Setup event listeners
  document.getElementById('btn-back').addEventListener('click', handleBack);
  document.getElementById('btn-finish').addEventListener('click', () => finishBatch());
  document.getElementById('btn-capture').addEventListener('click', captureImage);
  document.getElementById('btn-retake').addEventListener('click', retakeImage);
  document.getElementById('btn-save-done').addEventListener('click', () => saveCapture(false));
  document.getElementById('btn-save-continue').addEventListener('click', () => saveCapture(true));
}

// Module-level state
let videoStream = null;
let currentFacingMode = 'environment';
let capturedBlob = null;
let pendingData = null; // Store supplier/model/price for capture-then-edit flow
let batchItems = []; // Store items for batch mode

/**
 * Initialize camera
 */
async function initCamera() {
  const video = document.getElementById('camera-preview');
  
  try {
    videoStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: currentFacingMode,
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
      audio: false,
    });
    
    video.srcObject = videoStream;
    await video.play();
    
  } catch (error) {
    console.error('Camera error:', error);
    // Provide more helpful error message
    if (error.name === 'NotAllowedError' || error.message.includes('Permission')) {
      showNotification('Camera access denied. Please enable camera permissions in your browser settings.', 'error');
    } else if (error.name === 'NotFoundError') {
      showNotification('No camera found on this device', 'error');
    } else {
      showNotification('Failed to access camera', 'error');
    }
  }
}

/**
 * Stop camera
 */
function stopCamera() {
  if (videoStream) {
    videoStream.getTracks().forEach(track => track.stop());
    videoStream = null;
  }
}

/**
 * Update batch counter UI
 */
function updateBatchIndicator() {
  const indicator = document.getElementById('batch-indicator');
  const countEl = document.getElementById('batch-count');
  const finishBtn = document.getElementById('btn-finish');
  
  if (batchItems.length > 0) {
    indicator.classList.remove('hidden');
    countEl.textContent = batchItems.length;
    finishBtn.classList.remove('hidden');
  } else {
    indicator.classList.add('hidden');
    finishBtn.classList.add('hidden');
  }
}

/**
 * Capture image
 */
async function captureImage() {
  const supplierInput = document.getElementById('supplier-input');
  const modelInput = document.getElementById('model-input');
  const priceInput = document.getElementById('price-input');
  
  const supplier = supplierInput.value.trim();
  const model = modelInput.value.trim();
  const price = parseInt(priceInput.value, 10);
  
  // Validation - done BEFORE capture
  if (!supplier) {
    showNotification('Please enter supplier name', 'error');
    supplierInput.focus();
    return;
  }
  
  if (!price || price <= 0) {
    showNotification('Please enter a valid price', 'error');
    priceInput.focus();
    return;
  }
  
  const video = document.getElementById('camera-preview');
  const canvas = document.getElementById('capture-canvas');
  const previewContainer = document.getElementById('preview-container');
  const capturedImage = document.getElementById('captured-image');
  
  // Set canvas dimensions
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  
  // Validate video dimensions before processing
  if (!canvas.width || !canvas.height || canvas.width <= 0 || canvas.height <= 0) {
    showNotification('Video not ready. Please try capturing again.', 'error');
    return;
  }
  
  // Draw video frame to canvas
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0);
  
  // Compress image
  try {
    capturedBlob = await compressImage(canvas, {
      maxWidth: 1200,
      quality: 0.7,
      format: 'jpeg',
    });
    
    // Store data for saving later
    pendingData = { supplier, model, price };
    
    // Show preview with stored data
    const imageUrl = URL.createObjectURL(capturedBlob);
    capturedImage.src = imageUrl;
    previewContainer.classList.remove('hidden');
    
    // Stop camera to save battery
    if (videoStream) {
      videoStream.getTracks().forEach(track => track.stop());
      videoStream = null;
    }
    
  } catch (error) {
    console.error('Compression error:', error);
    showNotification('Failed to process image', 'error');
  }
}

/**
 * Retake image
 */
function retakeImage() {
  const previewContainer = document.getElementById('preview-container');
  const capturedImage = document.getElementById('captured-image');
  
  // Revoke object URL to prevent memory leak
  if (capturedImage.src && capturedImage.src.startsWith('blob:')) {
    URL.revokeObjectURL(capturedImage.src);
  }
  
  previewContainer.classList.add('hidden');
  capturedBlob = null;
  pendingData = null;
  
  // Restart camera
  initCamera();
}

/**
 * Save capture - single or batch
 * @param {boolean} continueBatch - If true, add to batch and continue capturing
 */
async function saveCapture(continueBatch = false) {
  // Use pending data from capture (or current input values)
  const supplierInput = document.getElementById('supplier-input');
  const modelInput = document.getElementById('model-input');
  const priceInput = document.getElementById('price-input');
  
  const supplier = pendingData?.supplier || supplierInput.value.trim();
  const model = pendingData?.model || modelInput.value.trim();
  const price = pendingData?.price || parseInt(priceInput.value, 10);
  
  // Validation
  if (!supplier) {
    showNotification('Please enter supplier name', 'error');
    supplierInput.focus();
    return;
  }
  
  if (!price || price <= 0) {
    showNotification('Please enter a valid price', 'error');
    priceInput.focus();
    return;
  }
  
  const saveBtn = document.getElementById('btn-save-done');
  const continueBtn = document.getElementById('btn-save-continue');
  saveBtn.disabled = true;
  continueBtn.disabled = true;
  saveBtn.textContent = 'Saving...';
  continueBtn.textContent = 'Saving...';
  
  try {
    // Get or create supplier
    let supplierId;
    const suppliers = await getSuppliers();
    const existingSupplier = suppliers.find(s => s.name.toLowerCase() === supplier.toLowerCase());
    
    if (existingSupplier) {
      supplierId = existingSupplier.id;
    } else {
      // Create new supplier locally first
      const newSupplier = await addSupplier({
        id: uuidv4(),
        name: supplier,
        normalized_name: supplier.toLowerCase().trim(),
      });
      supplierId = newSupplier.id;
      
      // Try to sync to server (will be queued if offline)
      try {
        await createSupplier({
          id: supplierId,
          organization_id: window.appState.organization?.id,
          name: supplier,
          normalized_name: supplier.toLowerCase().trim(),
        });
      } catch (e) {
        console.log('Supplier will sync later');
      }
    }
    
    // Get or create model
    let modelId = null;
    if (model) {
      const models = await getModels();
      const existingModel = models.find(m => m.name.toLowerCase() === model.toLowerCase());
      
      if (existingModel) {
        modelId = existingModel.id;
      } else {
        const newModel = await addModel({
          id: uuidv4(),
          name: model,
          normalized_name: model.toLowerCase().trim(),
        });
        modelId = newModel.id;
        
        try {
          await createModel({
            id: modelId,
            organization_id: window.appState.organization?.id,
            name: model,
            normalized_name: model.toLowerCase().trim(),
          });
        } catch (e) {
          console.log('Model will sync later');
        }
      }
    }
    
    // Create item data
    const itemData = {
      id: uuidv4(),
      supplier_id: supplierId,
      supplier_name: supplier,
      model_id: modelId,
      model_name: model || null,
      price,
      quantity: 1,
      captured_at: new Date().toISOString(),
      status: 'pending',
    };
    
    if (continueBatch) {
      // Add to batch instead of saving immediately
      batchItems.push({
        ...itemData,
        blob: capturedBlob,
        supplierId,
        modelId,
      });
      
      // Update batch indicator
      updateBatchIndicator();
      
      // Reset preview and continue
      const previewContainer = document.getElementById('preview-container');
      const capturedImage = document.getElementById('captured-image');
      
      if (capturedImage.src && capturedImage.src.startsWith('blob:')) {
        URL.revokeObjectURL(capturedImage.src);
      }
      
      previewContainer.classList.add('hidden');
      capturedBlob = null;
      pendingData = null;
      
      // Clear inputs for next capture
      document.getElementById('model-input').value = '';
      document.getElementById('price-input').value = '';
      // Keep supplier for convenience in batch mode
      // document.getElementById('supplier-input').value = '';
      
      // Restart camera
      initCamera();
      
      showNotification('Item added to batch', 'success');
      
    } else {
      // Single save - save immediately
      const procurement = await saveProcurement(itemData);
      
      // Add to upload queue
      await addToQueue({
        requestId: procurement.id,
        imageBlob: capturedBlob,
        supplierId,
        supplierName: supplier,
        modelId,
        modelName: model,
        price,
        quantity: 1,
      });
      
      showNotification('Saved! Will sync when online.', 'success');
      
      // Navigate back to home
      stopCamera();
      router.navigate('home');
    }
    
  } catch (error) {
    console.error('Save error:', error);
    showNotification('Failed to save', 'error');
  } finally {
    saveBtn.disabled = false;
    continueBtn.disabled = false;
    saveBtn.textContent = 'Save & Done';
    continueBtn.textContent = 'Save & Continue';
  }
}

/**
 * Handle back button
 */
function handleBack() {
  if (batchItems.length > 0) {
    // Show confirmation modal
    const modal = document.getElementById('confirm-modal');
    document.getElementById('confirm-item-count').textContent = batchItems.length;
    modal.classList.remove('hidden');
    
    // Setup modal buttons
    document.getElementById('btn-cancel-discard').onclick = () => {
      modal.classList.add('hidden');
    };
    
    document.getElementById('btn-confirm-discard').onclick = () => {
      modal.classList.add('hidden');
      batchItems = [];
      stopCamera();
      router.navigate('home');
    };
  } else {
    stopCamera();
    router.navigate('home');
  }
}

/**
 * Finish batch - save all batch items
 * This can be called from outside (e.g., when user clicks "Finish" in header)
 */
export async function finishBatch() {
  if (batchItems.length === 0) {
    showNotification('No items in batch', 'warning');
    return;
  }
  
  // Save all items to queue
  for (const item of batchItems) {
    await saveProcurement({
      id: item.id,
      supplier_id: item.supplierId,
      supplier_name: item.supplierName,
      model_id: item.modelId,
      model_name: item.modelName,
      price: item.price,
      quantity: 1,
      captured_at: item.captured_at,
      status: 'pending',
    });
    
    await addToQueue({
      requestId: item.id,
      imageBlob: item.blob,
      supplierId: item.supplierId,
      supplierName: item.supplierName,
      modelId: item.modelId,
      modelName: item.modelName,
      price: item.price,
      quantity: 1,
    });
  }
  
  const count = batchItems.length;
  batchItems = [];
  stopCamera();
  showNotification(`${count} items saved!`, 'success');
  router.navigate('home');
}

/**
 * Get current batch items count
 */
export function getBatchCount() {
  return batchItems.length;
}
