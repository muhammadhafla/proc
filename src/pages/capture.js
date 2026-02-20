// Single Capture Page
import { router } from '../modules/router.js';
import { addToQueue, addSupplier, addModel, saveProcurement, getSuppliers } from '../modules/db.js';
import { createSupplier, createModel } from '../modules/api.js';
import { showNotification, formatCurrency } from '../modules/app.js';
import { compressImage } from '../modules/compression.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Render capture page
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
        <div class="w-10"></div>
      </header>
      
      <!-- Camera View -->
      <div class="flex-1 relative">
        <video id="camera-preview" class="w-full h-full object-cover" autoplay playsinline></video>
        <canvas id="capture-canvas" class="hidden"></canvas>
        
        <!-- Camera Controls -->
        <div class="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/70 to-transparent">
          <div class="flex items-center justify-center gap-8">
            <!-- Switch Camera -->
            <button id="btn-switch" class="p-3 bg-gray-800/80 rounded-full text-white hover:bg-gray-700">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
              </svg>
            </button>
            
            <!-- Capture Button -->
            <button id="btn-capture" class="w-20 h-20 bg-white rounded-full border-4 border-white/30 hover:scale-95 transition-transform">
              <div class="w-16 h-16 bg-white rounded-full border-2 border-gray-300 mx-auto"></div>
            </button>
            
            <!-- Placeholder for balance -->
            <div class="w-12"></div>
          </div>
        </div>
        
        <!-- Captured Image Preview -->
        <div id="preview-container" class="hidden absolute inset-0 bg-gray-900 flex flex-col">
          <img id="captured-image" class="w-full h-64 object-contain bg-black" alt="Captured">
          
          <!-- Form -->
          <div class="flex-1 bg-gray-800 p-4 space-y-4 overflow-y-auto">
            <!-- Supplier -->
            <div>
              <label class="block text-sm text-gray-400 mb-1">Supplier</label>
              <input type="text" id="supplier-input" class="input bg-gray-700 border-gray-600 text-white" placeholder="Supplier name">
            </div>
            
            <!-- Model -->
            <div>
              <label class="block text-sm text-gray-400 mb-1">Model</label>
              <input type="text" id="model-input" class="input bg-gray-700 border-gray-600 text-white" placeholder="Product model">
            </div>
            
            <!-- Price -->
            <div>
              <label class="block text-sm text-gray-400 mb-1">Price</label>
              <input type="number" id="price-input" class="input bg-gray-700 border-gray-600 text-white" placeholder="0" inputmode="numeric">
            </div>
            
            <!-- Actions -->
            <div class="flex gap-3 pt-2">
              <button id="btn-retake" class="btn btn-secondary flex-1">Retake</button>
              <button id="btn-save" class="btn btn-primary flex-1">Save</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  
  // Initialize camera
  initCamera();
  
  // Setup event listeners
  document.getElementById('btn-back').addEventListener('click', () => router.navigate('home'));
  document.getElementById('btn-capture').addEventListener('click', captureImage);
  document.getElementById('btn-retake').addEventListener('click', retakeImage);
  document.getElementById('btn-save').addEventListener('click', saveCapture);
}

let videoStream = null;
let currentFacingMode = 'environment';
let capturedBlob = null;

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
    showNotification('Failed to access camera', 'error');
  }
}

/**
 * Capture image
 */
async function captureImage() {
  const video = document.getElementById('camera-preview');
  const canvas = document.getElementById('capture-canvas');
  const previewContainer = document.getElementById('preview-container');
  const capturedImage = document.getElementById('captured-image');
  
  // Set canvas dimensions
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  
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
    
    // Show preview
    const imageUrl = URL.createObjectURL(capturedBlob);
    capturedImage.src = imageUrl;
    previewContainer.classList.remove('hidden');
    
    // Stop camera
    if (videoStream) {
      videoStream.getTracks().forEach(track => track.stop());
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
  previewContainer.classList.add('hidden');
  capturedBlob = null;
  
  // Restart camera
  initCamera();
}

/**
 * Save capture
 */
async function saveCapture() {
  const supplierInput = document.getElementById('supplier-input');
  const modelInput = document.getElementById('model-input');
  const priceInput = document.getElementById('price-input');
  
  const supplier = supplierInput.value.trim();
  const model = modelInput.value.trim();
  const price = parseInt(priceInput.value, 10);
  
  // Validation
  if (!supplier) {
    showNotification('Please enter supplier name', 'error');
    return;
  }
  
  if (!price || price <= 0) {
    showNotification('Please enter a valid price', 'error');
    return;
  }
  
  const saveBtn = document.getElementById('btn-save');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving...';
  
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
    
    // Create local procurement record
    const procurement = await saveProcurement({
      id: uuidv4(),
      supplier_id: supplierId,
      supplier_name: supplier,
      model_id: modelId,
      model_name: model || null,
      price,
      quantity: 1,
      captured_at: new Date().toISOString(),
      status: 'pending',
    });
    
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
    router.navigate('home');
    
  } catch (error) {
    console.error('Save error:', error);
    showNotification('Failed to save', 'error');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save';
  }
}
