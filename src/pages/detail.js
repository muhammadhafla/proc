// Detail Page - View procurement details
import { router } from '../modules/router.js';
import { getProcurement } from '../modules/db.js';
import { getProcurementDetails, getSignedDownloadUrl } from '../modules/api.js';
import { formatCurrency, formatDate } from '../modules/app.js';
import { appState } from '../modules/app.js';

/**
 * Render detail page
 */
export async function renderDetail(container, params) {
  const { id } = params;
  
  container.innerHTML = `
    <div class="min-h-screen bg-gray-50">
      <!-- Header -->
      <header class="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div class="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
          <button id="btn-back" class="p-2 -ml-2 hover:bg-gray-100 rounded-lg">
            <svg class="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
            </svg>
          </button>
          <h1 class="text-lg font-bold text-gray-900">Details</h1>
          <div class="w-10"></div>
        </div>
      </header>
      
      <!-- Content -->
      <main id="detail-content" class="max-w-lg mx-auto p-4">
        <div class="text-center py-8">
          <div class="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full mx-auto"></div>
          <p class="text-gray-500 mt-2">Loading...</p>
        </div>
      </main>
    </div>
  `;
  
  // Setup back button
  document.getElementById('btn-back').addEventListener('click', () => router.navigate('list'));
  
  // Load detail
  await loadDetail(id);
}

/**
 * Load procurement detail
 */
async function loadDetail(id) {
  const contentEl = document.getElementById('detail-content');
  
  try {
    let procurement = null;
    
    // Try server first
    if (appState.isOnline) {
      try {
        procurement = await getProcurementDetails(id);
      } catch (e) {
        console.log('Server fetch failed');
      }
    }
    
    // Fall back to local
    if (!procurement) {
      procurement = await getProcurement(id);
    }
    
    if (!procurement) {
      contentEl.innerHTML = `
        <div class="text-center py-12">
          <p class="text-gray-500">Procurement not found</p>
        </div>
      `;
      return;
    }
    
    // Get image URL
    let imageUrl = null;
    if (procurement.procurement_images?.[0]?.storage_path) {
      try {
        const { downloadUrl } = await getSignedDownloadUrl(procurement.procurement_images[0].storage_path);
        imageUrl = downloadUrl;
      } catch (e) {
        console.log('Failed to get image URL');
      }
    }
    
    // Render detail
    contentEl.innerHTML = `
      <!-- Image -->
      <div class="card p-0 overflow-hidden mb-4">
        ${imageUrl ? `
          <img src="${imageUrl}" alt="Product" class="w-full h-64 object-contain bg-gray-900">
        ` : `
          <div class="w-full h-64 bg-gray-200 flex items-center justify-center">
            <svg class="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
            </svg>
          </div>
        `}
      </div>
      
      <!-- Details -->
      <div class="card space-y-4">
        <!-- Price -->
        <div class="text-center pb-4 border-b border-gray-100">
          <p class="text-sm text-gray-500">Price</p>
          <p class="text-3xl font-bold text-primary-600">
            ${formatCurrency(procurement.price)}
          </p>
        </div>
        
        <!-- Info Grid -->
        <div class="grid grid-cols-2 gap-4">
          <div>
            <p class="text-sm text-gray-500">Supplier</p>
            <p class="font-medium text-gray-900">
              ${procurement.suppliers?.name || procurement.supplier_name || 'Unknown'}
            </p>
          </div>
          
          <div>
            <p class="text-sm text-gray-500">Model</p>
            <p class="font-medium text-gray-900">
              ${procurement.models?.name || procurement.model_name || '-'}
            </p>
          </div>
          
          <div>
            <p class="text-sm text-gray-500">Quantity</p>
            <p class="font-medium text-gray-900">
              ${procurement.quantity || 1}
            </p>
          </div>
          
          <div>
            <p class="text-sm text-gray-500">Total</p>
            <p class="font-medium text-gray-900">
              ${formatCurrency(procurement.price * (procurement.quantity || 1))}
            </p>
          </div>
        </div>
        
        <!-- Timestamps -->
        <div class="pt-4 border-t border-gray-100 space-y-2">
          <div class="flex justify-between text-sm">
            <span class="text-gray-500">Captured</span>
            <span class="text-gray-900">${formatDate(procurement.captured_at)}</span>
          </div>
          
          ${procurement.device_id ? `
            <div class="flex justify-between text-sm">
              <span class="text-gray-500">Device</span>
              <span class="text-gray-900 text-xs">${procurement.device_id.slice(0, 8)}...</span>
            </div>
          ` : ''}
        </div>
        
        <!-- Status -->
        <div class="pt-4">
          <span class="status-badge ${getStatusClass(procurement.status)}">
            ${procurement.status || 'synced'}
          </span>
        </div>
      </div>
    `;
    
  } catch (error) {
    console.error('Error loading detail:', error);
    contentEl.innerHTML = `
      <div class="text-center py-12">
        <p class="text-gray-500">Failed to load details</p>
      </div>
    `;
  }
}

/**
 * Get status badge class
 */
function getStatusClass(status) {
  switch (status) {
    case 'pending':
      return 'status-pending';
    case 'failed':
      return 'status-failed';
    default:
      return 'status-success';
  }
}
