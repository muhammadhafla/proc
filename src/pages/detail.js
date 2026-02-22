// Detail Page - View procurement details
import { router } from '../modules/router.js';
import { getProcurement } from '../modules/db.js';
import { getProcurementDetails, getSignedDownloadUrl, updateProcurement, getAuditLogs, createAuditLog, getUserRole } from '../modules/api.js';
import { formatCurrency, formatDate, showNotification } from '../modules/app.js';
import { appState } from '../modules/state.js';

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
          <button id="btn-back" class="p-2 -ml-2 hover:bg-gray-100 rounded-lg" aria-label="Go back">
            <svg class="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
            </svg>
          </button>
          <h1 class="text-lg font-bold text-gray-900">Details</h1>
          <button id="btn-edit" class="p-2 -mr-2 hover:bg-gray-100 rounded-lg hidden" aria-label="Edit">
            <svg class="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
            </svg>
          </button>
        </div>
      </header>
      
      <!-- Content -->
      <main id="detail-content" class="max-w-lg mx-auto p-4 pb-20">
        <div class="text-center py-8" aria-live="polite">
          <div class="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full mx-auto"></div>
          <p class="text-gray-500 mt-2">Loading...</p>
        </div>
      </main>
    </div>
  `;
  
  // Setup back button - use navigateBack to return to previous page
  document.getElementById('btn-back').addEventListener('click', () => router.navigateBack('list'));
  
  // Load detail
  await loadDetail(id);
}

/**
 * Load procurement detail
 */
async function loadDetail(id) {
  const contentEl = document.getElementById('detail-content');
  const editBtn = document.getElementById('btn-edit');
  
  try {
    let procurement = null;
    let auditLogs = [];
    
    // Try server first
    if (appState.get('isOnline')) {
      try {
        procurement = await getProcurementDetails(id);
        // Fetch audit logs
        try {
          auditLogs = await getAuditLogs(id);
        } catch (e) {
          console.log('Failed to fetch audit logs');
        }
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
    
    // Check if user can edit (manager or owner)
    let userRole = null;
    if (appState.get('isOnline')) {
      try {
        userRole = await getUserRole();
      } catch (e) {
        console.log('Failed to get user role');
      }
    }
    const canEdit = userRole === 'owner' || userRole === 'manager';
    
    // Show edit button if user can edit
    if (canEdit) {
      editBtn.classList.remove('hidden');
      editBtn.addEventListener('click', () => showCorrectionModal(procurement));
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
      
      <!-- Audit Trail -->
      ${auditLogs.length > 0 ? `
        <div class="card mt-4">
          <h3 class="font-semibold text-gray-900 mb-3">Correction History</h3>
          <div class="space-y-3">
            ${auditLogs.map(log => `
              <div class="border-l-2 border-primary-300 pl-3 py-1">
                <div class="text-sm text-gray-500">
                  ${formatDate(log.created_at)}
                </div>
                <div class="text-sm">
                  ${log.action === 'correction' ? 'Correction' : log.action}: 
                  ${log.old_values?.price ? `${formatCurrency(log.old_values.price)} → ${formatCurrency(log.new_values?.price)}` : ''}
                  ${log.old_values?.quantity ? ` (Qty: ${log.old_values.quantity} → ${log.new_values?.quantity})` : ''}
                </div>
                ${log.reason ? `<div class="text-xs text-gray-500 mt-1">"${log.reason}"</div>` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
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

/**
 * Show correction modal
 */
function showCorrectionModal(procurement) {
  const modal = document.createElement('div');
  modal.id = 'correction-modal';
  modal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4';
  modal.innerHTML = `
    <div class="bg-white rounded-xl max-w-md w-full p-6 shadow-xl">
      <h2 class="text-xl font-bold text-gray-900 mb-4">Correct Price/Quantity</h2>
      
      <form id="correction-form" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Price (IDR)</label>
          <input 
            type="number" 
            id="input-price" 
            value="${procurement.price}"
            min="1" 
            step="1"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            required
          >
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
          <input 
            type="number" 
            id="input-quantity" 
            value="${procurement.quantity || 1}"
            min="1" 
            step="1"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            required
          >
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Reason for correction</label>
          <textarea 
            id="input-reason" 
            rows="3"
            placeholder="e.g., Price was entered incorrectly"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          ></textarea>
        </div>
        
        <div class="flex gap-3 pt-2">
          <button 
            type="button" 
            id="btn-cancel"
            class="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button 
            type="submit" 
            id="btn-save"
            class="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Save
          </button>
        </div>
      </form>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Close modal handlers
  const closeModal = () => {
    modal.remove();
  };
  
  document.getElementById('btn-cancel').addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
  
  // Form submission
  document.getElementById('correction-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const price = parseFloat(document.getElementById('input-price').value);
    const quantity = parseInt(document.getElementById('input-quantity').value);
    const reason = document.getElementById('input-reason').value.trim();
    
    if (price === procurement.price && quantity === (procurement.quantity || 1)) {
      showNotification('No changes to save', 'warning');
      closeModal();
      return;
    }
    
    const saveBtn = document.getElementById('btn-save');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
    
    try {
      // Update procurement
      await updateProcurement(procurement.id, { price, quantity });
      
      // Create audit log
      await createAuditLog({
        organization_id: procurement.organization_id,
        user_id: appState.get('user')?.id,
        table_name: 'procurement',
        record_id: procurement.id,
        action: 'correction',
        old_values: { price: procurement.price, quantity: procurement.quantity || 1 },
        new_values: { price, quantity },
        reason: reason || null
      });
      
      showNotification('Correction saved successfully', 'success');
      closeModal();
      
      // Reload detail
      await loadDetail(procurement.id);
      
    } catch (error) {
      console.error('Error saving correction:', error);
      showNotification('Failed to save correction', 'error');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save';
    }
  });
}
