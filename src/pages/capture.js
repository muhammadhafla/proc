// Unified Capture Page - Combines single capture and batch capture
import { router } from '../modules/router.js';
import { showNotification } from '../modules/app.js';
import { v4 as uuidv4 } from 'uuid';
import { initCamera, cleanupCamera, stopCamera, captureImage as captureImageFromModule, showPreview, hidePreview, getCurrentFacingMode, revokeAllBlobUrls, revokeBlobUrl } from '../modules/camera.js';
import { getOrCreateSupplier, getOrCreateModel, saveProcurementItem } from '../modules/dataService.js';
import { saveProcurement, addToQueue, getSuppliers } from '../modules/db.js';

// Set up navigation cleanup for blob URLs
window.addEventListener('hashchange', () => {
  revokeAllBlobUrls();
});

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
            <!-- Supplier Selection -->
            <div class="relative">
              <div class="flex gap-2">
                <div class="relative flex-1">
                  <input 
                    type="text" 
                    id="supplier-input"
                    class="input bg-gray-700 border-gray-600 text-white pr-10"
                    placeholder="Supplier name"
                    aria-label="Supplier name"
                    autocomplete="off"
                  >
                  <button 
                    type="button"
                    id="btn-show-suppliers"
                    class="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-white"
                    aria-label="Show existing suppliers"
                  >
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                    </svg>
                  </button>
                </div>
              </div>
              <!-- Supplier Dropdown -->
              <div id="supplier-dropdown" class="hidden absolute z-10 mt-1 w-full bg-gray-700 border border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                <div id="supplier-list" class="py-1">
                  <!-- Supplier items will be populated here -->
                </div>
              </div>
            </div>
            
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
        <div id="preview-container" class="hidden absolute inset-0 bg-gray-900 flex flex-col z-20">
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
  initializeCamera();
  
  // Setup event listeners
  document.getElementById('btn-back').addEventListener('click', handleBack);
  document.getElementById('btn-finish').addEventListener('click', () => finishBatch());
  document.getElementById('btn-capture').addEventListener('click', captureImage);
  document.getElementById('btn-retake').addEventListener('click', retakeImage);
  document.getElementById('btn-save-done').addEventListener('click', () => saveCapture(false));
  document.getElementById('btn-save-continue').addEventListener('click', () => saveCapture(true));
  
  // Setup supplier dropdown
  setupSupplierDropdown();
}

// Module-level state
let capturedBlob = null;
let pendingData = null; // Store supplier/model/price for capture-then-edit flow
let batchItems = []; // Store items for batch mode

// Supplier cache
let cachedSuppliers = null;
let suppliersCacheTime = 0;
const SUPPLIERS_CACHE_DURATION = 60000; // 1 minute

/**
 * Initialize camera - wrapper that uses shared module
 */
async function initializeCamera() {
  try {
    await initCamera({ facingMode: getCurrentFacingMode() });
  } catch (error) {
    console.error('Camera initialization failed:', error);
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
 * Setup supplier dropdown functionality
 */
function setupSupplierDropdown() {
  const supplierInput = document.getElementById('supplier-input');
  const dropdownBtn = document.getElementById('btn-show-suppliers');
  const dropdown = document.getElementById('supplier-dropdown');
  const supplierList = document.getElementById('supplier-list');
  let suppliers = [];
  let isDropdownOpen = false;
  
  // Load suppliers from database with caching
  async function loadSuppliers() {
    const now = Date.now();
    
    // Return cached suppliers if still valid
    if (cachedSuppliers && (now - suppliersCacheTime) < SUPPLIERS_CACHE_DURATION) {
      suppliers = cachedSuppliers;
      return cachedSuppliers;
    }
    
    try {
      cachedSuppliers = await getSuppliers();
      suppliersCacheTime = now;
      suppliers = cachedSuppliers;
    } catch (error) {
      console.error('Failed to load suppliers:', error);
      cachedSuppliers = [];
      suppliers = [];
    }
    
    return cachedSuppliers;
  }
  
  // Render supplier list
  function renderSupplierList(filter = '') {
    const normalizedFilter = filter.toLowerCase().trim();
    const filtered = normalizedFilter 
      ? suppliers.filter(s => s.name.toLowerCase().includes(normalizedFilter))
      : suppliers;
    
    if (filtered.length === 0) {
      supplierList.innerHTML = `
        <div class="px-4 py-3 text-gray-400 text-sm">
          ${suppliers.length === 0 ? 'Belum ada supplier' : 'Tidak ada hasil'}
        </div>
      `;
      return;
    }
    
    supplierList.innerHTML = filtered.map(supplier => `
      <button 
        type="button"
        class="w-full px-4 py-2 text-left text-white hover:bg-gray-600 focus:outline-none focus:bg-gray-600 supplier-item"
        data-supplier-id="${supplier.id}"
        data-supplier-name="${supplier.name}"
      >
        ${supplier.name}
      </button>
    `).join('');
    
    // Add click listeners to items
    supplierList.querySelectorAll('.supplier-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const name = item.dataset.supplierName;
        const id = item.dataset.supplierId;
        supplierInput.value = name;
        supplierInput.dataset.supplierId = id;
        
        // Close dropdown immediately
        dropdown.classList.add('hidden');
        isDropdownOpen = false;
        
        supplierInput.focus();
      });
    });
  }
  
  // Close dropdown
  function closeDropdown() {
    dropdown.classList.add('hidden');
    isDropdownOpen = false;
  }
  
  // Event: Button click to show dropdown
  dropdownBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    await loadSuppliers();
    renderSupplierList('');
    dropdown.classList.remove('hidden');
    isDropdownOpen = true;
  });
  
  // Event: Input change - filter suppliers
  supplierInput.addEventListener('input', () => {
    // Clear selected supplier ID when typing
    delete supplierInput.dataset.supplierId;
    
    if (isDropdownOpen) {
      renderSupplierList(supplierInput.value);
    }
  });
  
  // Event: Input focus - show dropdown with current filter
  supplierInput.addEventListener('focus', async () => {
    await loadSuppliers();
    renderSupplierList(supplierInput.value);
    dropdown.classList.remove('hidden');
    isDropdownOpen = true;
  });
  
  // Event: Click outside to close
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.relative')) {
      closeDropdown();
    }
  });
  
  // Prevent dropdown close when clicking inside
  dropdown.addEventListener('click', (e) => {
    e.stopPropagation();
  });
}

/**
 * Capture image - uses shared camera module
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
  
  // Prepare overlay text
  const overlayText = `${supplier}${model ? ' | ' + model : ''} | Rp${price.toLocaleString('id-ID')}`;
  const timestamp = new Date().toLocaleString('id-ID', { 
    day: '2-digit', 
    month: '2-digit', 
    year: 'numeric', 
    hour: '2-digit', 
    minute: '2-digit' 
  });
  
  try {
    // Use shared camera module for capture
    const { blob } = await captureImageFromModule({
      maxWidth: 1200,
      quality: 0.7,
      format: 'jpeg',
      overlayText,
      timestamp,
    });
    
    // Store data for saving later
    capturedBlob = blob;
    pendingData = { supplier, model, price };
    
    // Show preview using shared module
    showPreview(blob, 'captured-image', 'preview-container');
    
    // Stop camera to save battery
    stopCamera();
    
  } catch (error) {
    console.error('Capture error:', error);
    showNotification(error.message || 'Failed to process image', 'error');
  }
}

/**
 * Retake image
 */
function retakeImage() {
  // Use shared hidePreview to clean up blob URL
  hidePreview('captured-image', 'preview-container');
  
  capturedBlob = null;
  pendingData = null;
  
  // Restart camera using shared module
  initCamera({ facingMode: getCurrentFacingMode() });
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
    // Get or create supplier using shared data service
    const supplierId = await getOrCreateSupplier(supplier);
    
    // Get or create model using shared data service
    const modelId = await getOrCreateModel(model);
    
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
      initializeCamera();
      
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
    // Show confirmation modal for batch items
    const modal = document.getElementById('confirm-modal');
    const titleEl = document.getElementById('confirm-title');
    const msgEl = modal.querySelector('p.text-gray-600');
    titleEl.textContent = 'Discard Items?';
    msgEl.innerHTML = 'You have <span id="confirm-item-count">' + batchItems.length + '</span> captured items that will be lost.';
    modal.classList.remove('hidden');
    
    // Setup modal buttons
    document.getElementById('btn-cancel-discard').onclick = () => {
      modal.classList.add('hidden');
    };
    
    document.getElementById('btn-confirm-discard').onclick = () => {
      modal.classList.add('hidden');
      // Cleanup blobs first
      batchItems.forEach(item => {
        if (item.blob) {
          const url = URL.createObjectURL(item.blob);
          revokeBlobUrl(url);
        }
      });
      batchItems = [];
      cleanupCamera();
      router.navigate('home');
    };
  } else if (capturedBlob || pendingData) {
    // Show confirmation modal for single capture in progress
    const modal = document.getElementById('confirm-modal');
    const titleEl = document.getElementById('confirm-title');
    const msgEl = modal.querySelector('p.text-gray-600');
    titleEl.textContent = 'Discard Capture?';
    msgEl.textContent = 'If you go back, the captured data will be lost.';
    modal.classList.remove('hidden');
    
    // Setup modal buttons
    document.getElementById('btn-cancel-discard').onclick = () => {
      modal.classList.add('hidden');
    };
    
    document.getElementById('btn-confirm-discard').onclick = () => {
      modal.classList.add('hidden');
      capturedBlob = null;
      pendingData = null;
      cleanupCamera();
      router.navigate('home');
    };
  } else {
    cleanupCamera();
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
  
  // Save all items using shared data service
  for (const item of batchItems) {
    await saveProcurementItem({
      supplierId: item.supplierId,
      supplierName: item.supplierName,
      modelId: item.modelId,
      modelName: item.modelName,
      price: item.price,
      quantity: 1,
      imageBlob: item.blob,
    });
  }
  
  const count = batchItems.length;
  
  // Revoke all blob URLs before clearing
  batchItems.forEach(item => {
    if (item.blob) {
      const url = URL.createObjectURL(item.blob);
      revokeBlobUrl(url);
    }
  });
  
  batchItems = [];
  cleanupCamera();
  showNotification(`${count} items saved!`, 'success');
  router.navigate('home');
}

/**
 * Get current batch items count
 */
export function getBatchCount() {
  return batchItems.length;
}

/**
 * Invalidate suppliers cache - call this when sync completes to refresh cache
 */
export function invalidateSuppliersCache() {
  cachedSuppliers = null;
  suppliersCacheTime = 0;
}
