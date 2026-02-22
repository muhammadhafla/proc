// Batch Capture Page
import { router } from '../modules/router.js';
import { getSuppliers } from '../modules/db.js';
import { showNotification } from '../modules/app.js';
import { v4 as uuidv4 } from 'uuid';
import { initCamera, captureImage as captureImageFromModule, cleanupCamera, revokeAllBlobUrls, createBlobUrl, revokeBlobUrl } from '../modules/camera.js';
import { getOrCreateSupplier, saveProcurementItem } from '../modules/dataService.js';

// Set up navigation cleanup for blob URLs
window.addEventListener('hashchange', () => {
  revokeAllBlobUrls();
});

/**
 * Render batch capture page
 */
export function renderBatch(container) {
  container.innerHTML = `
    <div class="min-h-screen bg-gray-900 flex flex-col">
      <!-- Header -->
      <header class="bg-gray-800 p-4 flex items-center justify-between">
        <button id="btn-back" class="p-2 -ml-2 text-white hover:bg-gray-700 rounded-lg" aria-label="Go back">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
          </svg>
        </button>
        <div class="text-center">
          <h1 class="text-white font-semibold">Batch Capture</h1>
          <p id="batch-count" class="text-gray-400 text-sm" aria-live="polite">0 items</p>
        </div>
        <button id="btn-finish" class="px-4 py-2 bg-green-600 text-white rounded-lg font-medium" aria-label="Finish batch capture">
          Finish
        </button>
      </header>
      
      <!-- Supplier Selection (shown initially) -->
      <div id="supplier-select" class="flex-1 p-4 overflow-y-auto">
        <div class="max-w-lg mx-auto">
          <h2 class="text-white text-lg font-semibold mb-4">Select Supplier</h2>
          <input 
            type="text" 
            id="supplier-input"
            class="input bg-gray-800 border-gray-700 text-white mb-4"
            placeholder="Search or add supplier..."
            aria-label="Search suppliers"
          >
          <div id="supplier-list" class="space-y-2 max-h-64 overflow-y-auto" role="listbox" aria-label="Supplier list"></div>
          
          <!-- Add new supplier option -->
          <button id="btn-add-supplier" class="w-full mt-4 p-3 border-2 border-dashed border-gray-600 text-gray-400 rounded-lg hover:border-gray-500 hover:text-gray-300">
            + Add New Supplier
          </button>
        </div>
      </div>
      
      <!-- Camera View (shown after supplier selected) -->
      <div id="capture-area" class="hidden flex-1 relative">
        <video id="camera-preview" class="w-full h-full object-cover" autoplay playsinline></video>
        <canvas id="capture-canvas" class="hidden"></canvas>
        
        <!-- Quick Input Overlay -->
        <div class="absolute bottom-0 left-0 right-0 p-4 bg-gray-800/90">
          <div class="max-w-lg mx-auto space-y-3">
            <!-- Model Input -->
            <input 
              type="text" 
              id="model-input"
              class="input bg-gray-700 border-gray-600 text-white"
              placeholder="Model (optional)"
            >
            
            <!-- Price Input -->
            <div class="flex gap-2">
              <input 
                type="number" 
                id="price-input"
                class="input bg-gray-700 border-gray-600 text-white flex-1"
                placeholder="Price"
                inputmode="numeric"
              >
              <button id="btn-capture" class="px-6 bg-white text-gray-900 font-bold rounded-lg">
                CAPTURE
              </button>
            </div>
          </div>
        </div>
        
        <!-- Captured Items Counter -->
        <div class="absolute top-4 right-4 bg-green-600 text-white px-4 py-2 rounded-full font-bold">
          <span id="item-count">0</span> items
        </div>
      </div>
      
      <!-- Preview Modal -->
      <div id="preview-modal" class="hidden fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="preview-title">
        <div class="bg-gray-800 rounded-xl max-w-sm w-full overflow-hidden">
          <img id="preview-image" class="w-full h-48 object-contain bg-black" alt="Preview of captured item">
          <div class="p-4 space-y-2">
            <p id="preview-supplier" class="text-white font-medium"></p>
            <p id="preview-details" class="text-gray-400 text-sm"></p>
            <div class="flex gap-2 pt-2">
              <button id="btn-discard" class="btn btn-secondary flex-1" aria-label="Discard this capture">Discard</button>
              <button id="btn-confirm" class="btn btn-primary flex-1" aria-label="Confirm this capture">Confirm</button>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Confirm Dialog Modal -->
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
  
  // Initialize
  initBatchCapture();
}

let selectedSupplier = null;
let batchItems = [];
let allSuppliers = []; // Store all suppliers for filtering

/**
 * Initialize batch capture
 */
async function initBatchCapture() {
  // Load suppliers
  await loadSuppliers();
  
  // Setup event listeners
  document.getElementById('btn-back').addEventListener('click', handleBack);
  document.getElementById('btn-finish').addEventListener('click', handleFinish);
  document.getElementById('btn-add-supplier').addEventListener('click', handleAddSupplier);
  
  // Setup supplier search/filter
  document.getElementById('supplier-input').addEventListener('input', debounce(filterSuppliers, 200));
  
  // Start camera
  await startCamera();
}

/**
 * Debounce helper
 */
function debounce(fn, delay) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Filter suppliers based on search input
 */
function filterSuppliers() {
  const searchInput = document.getElementById('supplier-input');
  const searchTerm = searchInput.value.toLowerCase().trim();
  
  if (!searchTerm) {
    // Show all suppliers if no search term
    renderSupplierList(allSuppliers);
    return;
  }
  
  // Filter suppliers by name
  const filtered = allSuppliers.filter(s => 
    s.name.toLowerCase().includes(searchTerm)
  );
  
  renderSupplierList(filtered);
}

/**
 * Render supplier list
 */
function renderSupplierList(suppliers) {
  const listEl = document.getElementById('supplier-list');
  
  if (suppliers.length === 0) {
    listEl.innerHTML = '<p class="text-gray-500 text-center py-4">No suppliers found</p>';
    return;
  }
  
  listEl.innerHTML = suppliers.map(s => `
    <button class="supplier-btn w-full p-3 text-left bg-gray-800 hover:bg-gray-700 rounded-lg text-white" data-id="${s.id}" data-name="${s.name}">
      ${s.name}
    </button>
  `).join('');
  
  // Add click handlers
  document.querySelectorAll('.supplier-btn').forEach(btn => {
    btn.addEventListener('click', () => selectSupplier(btn.dataset.id, btn.dataset.name));
  });
}

/**
 * Load suppliers
 */
async function loadSuppliers() {
  const suppliers = await getSuppliers();
  allSuppliers = suppliers; // Store for filtering
  renderSupplierList(suppliers);
}

/**
 * Select supplier
 */
function selectSupplier(id, name) {
  selectedSupplier = { id, name };
  
  document.getElementById('supplier-select').classList.add('hidden');
  document.getElementById('capture-area').classList.remove('hidden');
  
  // Focus on price input
  setTimeout(() => {
    document.getElementById('price-input').focus();
  }, 100);
}

/**
 * Start camera
 */
async function startCamera() {
  try {
    await initCamera({ facingMode: 'environment' });
  } catch (error) {
    console.error('Camera initialization failed:', error);
  }
}

/**
 * Handle capture - uses shared camera module
 */
async function captureImage() {
  const priceInput = document.getElementById('price-input');
  const modelInput = document.getElementById('model-input');
  
  const price = parseInt(priceInput.value, 10);
  const model = modelInput.value.trim();
  
  if (!price || price <= 0) {
    showNotification('Please enter a valid price', 'error');
    priceInput.focus();
    return;
  }
  
  // Prepare overlay text
  const modelDisplay = model || '-';
  const overlayText = `${selectedSupplier.name} | ${modelDisplay} | Rp${price.toLocaleString('id-ID')}`;
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
    
    // Show preview modal
    showPreviewModal(blob, {
      supplier: selectedSupplier.name,
      model: model || '-',
      price: price,
    });
    
  } catch (error) {
    console.error('Capture error:', error);
    if (error.message !== 'Video not ready. Please try capturing again.') {
      showNotification('Failed to process image', 'error');
    }
  }
}

/**
 * Show preview modal
 */
let pendingCapture = null;

function showPreviewModal(blob, data) {
  pendingCapture = { blob, ...data };
  
  const modal = document.getElementById('preview-modal');
  const img = document.getElementById('preview-image');
  const supplier = document.getElementById('preview-supplier');
  const details = document.getElementById('preview-details');
  
  // Revoke previous URL if exists
  if (img.src && img.src.startsWith('blob:')) {
    revokeBlobUrl(img.src);
  }

  img.src = createBlobUrl(blob);
  supplier.textContent = data.supplier;
  details.textContent = `${data.model} - Rp ${data.price.toLocaleString('id-ID')}`;
  
  modal.classList.remove('hidden');
  
  // Setup modal buttons
  document.getElementById('btn-discard').onclick = () => {
    // Revoke URL when discarding
    if (img.src && img.src.startsWith('blob:')) {
      revokeBlobUrl(img.src);
    }
    modal.classList.add('hidden');
    pendingCapture = null;
    document.getElementById('price-input').value = '';
    document.getElementById('model-input').value = '';
    document.getElementById('price-input').focus();
  };
  
  document.getElementById('btn-confirm').onclick = () => confirmCapture();
}

/**
 * Confirm capture
 */
async function confirmCapture() {
  if (!pendingCapture) return;
  
  const { blob, supplier, model, price } = pendingCapture;
  
  // Add to batch
  batchItems.push({
    id: uuidv4(),
    blob,
    supplierId: selectedSupplier.id,
    supplierName: supplier,
    modelName: model,
    price,
  });
  
  // Update UI
  document.getElementById('item-count').textContent = batchItems.length;
  document.getElementById('batch-count').textContent = `${batchItems.length} items`;
  
  // Hide modal and reset
  document.getElementById('preview-modal').classList.add('hidden');
  pendingCapture = null;
  
  document.getElementById('price-input').value = '';
  document.getElementById('model-input').value = '';
  document.getElementById('price-input').focus();
  
  showNotification('Item added to batch', 'success');
}

/**
 * Handle back
 */
function handleBack() {
  if (batchItems.length > 0) {
    // Show custom confirmation modal
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
      batchItems = [];
      cleanupCamera();
      router.navigate('home');
    };
  } else if (pendingCapture) {
    // Show confirmation modal for pending capture
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
      pendingCapture = null;
      cleanupCamera();
      router.navigate('home');
    };
  } else {
    cleanupCamera();
    router.navigate('home');
  }
}

/**
 * Handle finish
 */
async function handleFinish() {
  if (batchItems.length === 0) {
    showNotification('No items to save', 'warning');
    return;
  }
  
  // Show loading state
  const finishBtn = document.getElementById('btn-finish');
  const originalText = finishBtn.textContent;
  finishBtn.disabled = true;
  finishBtn.textContent = 'Saving...';
  
  try {
    // Save all items in parallel
    await Promise.all(
      batchItems.map(item => saveProcurementItem({
        supplierId: item.supplierId,
        supplierName: item.supplierName,
        modelName: item.modelName,
        price: item.price,
        quantity: 1,
        imageBlob: item.blob,
      }))
    );
    
    cleanupCamera();
    showNotification(`${batchItems.length} items saved!`, 'success');
    router.navigate('home');
  } catch (error) {
    console.error('Batch save error:', error);
    showNotification('Failed to save some items', 'error');
  } finally {
    finishBtn.disabled = false;
    finishBtn.textContent = originalText;
  }
}

/**
 * Handle add supplier
 */
async function handleAddSupplier() {
  const input = document.getElementById('supplier-input');
  const name = input.value.trim();
  
  if (!name) {
    input.focus();
    return;
  }

  // Create supplier using shared data service (with sync support)
  await getOrCreateSupplier(name);
  
  // Refresh list
  await loadSuppliers();
  
  input.value = '';
  showNotification('Supplier added', 'success');
}

// Setup capture button handler
document.addEventListener('click', (e) => {
  if (e.target.id === 'btn-capture' || e.target.closest('#btn-capture')) {
    captureImage();
  }
});
