// Batch Capture Page
import { router } from '../modules/router.js';
import { addToQueue, addSupplier, addModel, saveProcurement, getSuppliers, getModels } from '../modules/db.js';
import { createSupplier, createModel } from '../modules/api.js';
import { showNotification } from '../modules/app.js';
import { compressImage } from '../modules/compression.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Render batch capture page
 */
export function renderBatch(container) {
  container.innerHTML = `
    <div class="min-h-screen bg-gray-900 flex flex-col">
      <!-- Header -->
      <header class="bg-gray-800 p-4 flex items-center justify-between">
        <button id="btn-back" class="p-2 -ml-2 text-white hover:bg-gray-700 rounded-lg">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
          </svg>
        </button>
        <div class="text-center">
          <h1 class="text-white font-semibold">Batch Capture</h1>
          <p id="batch-count" class="text-gray-400 text-sm">0 items</p>
        </div>
        <button id="btn-finish" class="px-4 py-2 bg-green-600 text-white rounded-lg font-medium">
          Finish
        </button>
      </header>
      
      <!-- Supplier Selection (shown initially) -->
      <div id="supplier-select" class="flex-1 p-4">
        <div class="max-w-lg mx-auto">
          <h2 class="text-white text-lg font-semibold mb-4">Select Supplier</h2>
          <input 
            type="text" 
            id="supplier-input"
            class="input bg-gray-800 border-gray-700 text-white mb-4"
            placeholder="Search or add supplier..."
          >
          <div id="supplier-list" class="space-y-2 max-h-64 overflow-y-auto"></div>
          
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
      <div id="preview-modal" class="hidden fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
        <div class="bg-gray-800 rounded-xl max-w-sm w-full overflow-hidden">
          <img id="preview-image" class="w-full h-48 object-contain bg-black" alt="Preview">
          <div class="p-4 space-y-2">
            <p id="preview-supplier" class="text-white font-medium"></p>
            <p id="preview-details" class="text-gray-400 text-sm"></p>
            <div class="flex gap-2 pt-2">
              <button id="btn-discard" class="btn btn-secondary flex-1">Discard</button>
              <button id="btn-confirm" class="btn btn-primary flex-1">Confirm</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  
  // Initialize
  initBatchCapture();
}

let videoStream = null;
let selectedSupplier = null;
let batchItems = [];

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
  
  // Start camera
  await startCamera();
}

/**
 * Load suppliers
 */
async function loadSuppliers() {
  const suppliers = await getSuppliers();
  const listEl = document.getElementById('supplier-list');
  
  if (suppliers.length === 0) {
    listEl.innerHTML = '<p class="text-gray-500 text-center py-4">No suppliers yet</p>';
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
  const video = document.getElementById('camera-preview');
  
  try {
    videoStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'environment',
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
      audio: false,
    });
    
    video.srcObject = videoStream;
    await video.play();
    
  } catch (error) {
    console.error('Camera error:', error);
    showNotification('Failed to access camera', 'error');
  }
}

/**
 * Handle capture
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
  
  const video = document.getElementById('camera-preview');
  const canvas = document.getElementById('capture-canvas');
  
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0);
  
  try {
    const blob = await compressImage(canvas, {
      maxWidth: 1200,
      quality: 0.7,
    });
    
    // Show preview modal
    showPreview(blob, {
      supplier: selectedSupplier.name,
      model: model || '-',
      price: price,
    });
    
  } catch (error) {
    console.error('Compression error:', error);
    showNotification('Failed to process image', 'error');
  }
}

/**
 * Show preview modal
 */
let pendingCapture = null;

function showPreview(blob, data) {
  pendingCapture = { blob, ...data };
  
  const modal = document.getElementById('preview-modal');
  const img = document.getElementById('preview-image');
  const supplier = document.getElementById('preview-supplier');
  const details = document.getElementById('preview-details');
  
  img.src = URL.createObjectURL(blob);
  supplier.textContent = data.supplier;
  details.textContent = `${data.model} - Rp ${data.price.toLocaleString('id-ID')}`;
  
  modal.classList.remove('hidden');
  
  // Setup modal buttons
  document.getElementById('btn-discard').onclick = () => {
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
    if (confirm('Discard all captured items?')) {
      stopCamera();
      router.navigate('home');
    }
  } else {
    stopCamera();
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
  
  // Save all items to queue
  for (const item of batchItems) {
    await saveProcurement({
      id: item.id,
      supplier_id: item.supplierId,
      supplier_name: item.supplierName,
      model_name: item.modelName,
      price: item.price,
      quantity: 1,
      captured_at: new Date().toISOString(),
      status: 'pending',
    });
    
    await addToQueue({
      requestId: item.id,
      imageBlob: item.blob,
      supplierId: item.supplierId,
      supplierName: item.supplierName,
      modelName: item.modelName,
      price: item.price,
      quantity: 1,
    });
  }
  
  stopCamera();
  showNotification(`${batchItems.length} items saved!`, 'success');
  router.navigate('home');
}

/**
 * Handle add supplier
 */
function handleAddSupplier() {
  const input = document.getElementById('supplier-input');
  const name = input.value.trim();
  
  if (!name) {
    input.focus();
    return;
  }
  
  // Create supplier locally
  addSupplier({
    id: uuidv4(),
    name: name,
    normalized_name: name.toLowerCase().trim(),
  });
  
  // Refresh list
  loadSuppliers();
  
  input.value = '';
  showNotification('Supplier added', 'success');
}

/**
 * Stop camera
 */
function stopCamera() {
  if (videoStream) {
    videoStream.getTracks().forEach(track => track.stop());
  }
}

// Setup capture button handler
document.addEventListener('click', (e) => {
  if (e.target.id === 'btn-capture' || e.target.closest('#btn-capture')) {
    captureImage();
  }
});
