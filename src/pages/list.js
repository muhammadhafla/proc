// List Page - View procurement history
import { router } from '../modules/router.js';
import { getProcurements, getSuppliers } from '../modules/db.js';
import { fetchProcurements, fetchSuppliers } from '../modules/api.js';
import { formatCurrency, formatDate } from '../modules/app.js';
import { appState } from '../modules/state.js';
import { renderBottomNav } from '../modules/theme.js';

/**
 * Render list page
 */
export async function renderList(container) {
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
          <h1 class="text-lg font-bold text-gray-900">History</h1>
          <div class="w-10"></div>
        </div>
        
        <!-- Filters -->
        <div class="max-w-lg mx-auto px-4 pb-4 space-y-3">
          <div class="flex gap-2">
            <select id="supplier-filter" class="input text-sm">
              <option value="">All Suppliers</option>
            </select>
            <input 
              type="date" 
              id="date-filter" 
              class="input text-sm"
            >
          </div>
          <input 
            type="text" 
            id="search-input"
            class="input text-sm"
            placeholder="Search model..."
          >
        </div>
      </header>
      
      <!-- List -->
      <main class="max-w-lg mx-auto p-4">
        <div id="procurement-list" class="space-y-3">
          <div class="text-center py-8">
            <div class="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full mx-auto"></div>
            <p class="text-gray-500 mt-2">Loading...</p>
          </div>
        </div>
        
        <!-- Load More -->
        <div id="load-more" class="text-center py-4 hidden">
          <button id="btn-load-more" class="btn btn-secondary">
            Load More
          </button>
        </div>
        
        <!-- Empty State -->
        <div id="empty-state" class="text-center py-12 hidden">
          <div class="w-24 h-24 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
            <svg class="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/>
            </svg>
          </div>
          <p class="text-gray-500 mb-4">No procurements yet</p>
          <button id="btn-capture" class="btn btn-primary">
            Start Capturing
          </button>
        </div>
      </main>

      <!-- Bottom Navigation -->
      ${renderBottomNav('list')}
    </div>
  `;
  
  // Initialize
  await initList();
}

let allProcurements = [];
let filteredProcurements = [];
let currentPage = 1;
const PAGE_SIZE = 20;

/**
 * Initialize list
 */
async function initList() {
  // Setup event listeners
  document.getElementById('btn-back').addEventListener('click', () => router.navigate('home'));
  document.getElementById('btn-capture')?.addEventListener('click', () => router.navigate('capture'));
  
  // Setup bottom navigation
  setupBottomNav();
  
  // Load filters
  await loadSupplierFilter();
  
  // Load data
  await loadProcurements();
  
  // Setup filter handlers
  document.getElementById('supplier-filter').addEventListener('change', applyFilters);
  document.getElementById('date-filter').addEventListener('change', applyFilters);
  document.getElementById('search-input').addEventListener('input', debounce(applyFilters, 300));
}

/**
 * Load supplier filter options - optimized to prevent duplicates
 */
async function loadSupplierFilter() {
  const select = document.getElementById('supplier-filter');
  const supplierIds = new Set(); // Track added IDs to prevent duplicates
  
  try {
    // Fetch from server if online
    // First get organization ID with fallback
    let organizationId = appState.get('organization')?.id;
    
    // Try localStorage fallback if not in appState
    if (!organizationId && typeof localStorage !== 'undefined') {
      try {
        const storedOrg = localStorage.getItem('organization');
        if (storedOrg) {
          const org = JSON.parse(storedOrg);
          organizationId = org?.id;
          // Update appState with stored org
          if (organizationId) {
            appState.set('organization', org);
          }
        }
      } catch (e) {
        console.warn('Failed to parse stored organization:', e);
      }
    }
    
    if (appState.get('isOnline') && organizationId) {
      const serverSuppliers = await fetchSuppliers(organizationId);
      serverSuppliers.forEach(s => {
        addSupplierOption(select, s.id, s.name);
        supplierIds.add(s.id);
      });
    }
  } catch (error) {
    console.log('Using local suppliers');
  }
  
  // Load from local (only add if not already added)
  const localSuppliers = await getSuppliers();
  localSuppliers.forEach(s => {
    if (!supplierIds.has(s.id)) {
      addSupplierOption(select, s.id, s.name);
    }
  });
}

function addSupplierOption(select, id, name) {
  const option = document.createElement('option');
  option.value = id;
  option.textContent = name;
  select.appendChild(option);
}

/**
 * Load procurements
 */
async function loadProcurements() {
  try {
    // Try server first
    if (appState.get('isOnline') && appState.get('organization')?.id) {
      const data = await fetchProcurements(appState.get('organization').id);
      allProcurements = data;
    }
  } catch (error) {
    console.log('Using local data');
  }
  
  // Also get local
  const localProcurements = await getProcurements();
  
  // Merge (local first for offline, server overwrites)
  const merged = [...localProcurements];
  allProcurements.forEach(p => {
    const exists = merged.find(m => m.id === p.id);
    if (!exists) {
      merged.push(p);
    }
  });
  
  // Sort by date
  merged.sort((a, b) => new Date(b.captured_at) - new Date(a.captured_at));
  
  allProcurements = merged;
  applyFilters();
}

/**
 * Apply filters
 */
function applyFilters() {
  const supplierId = document.getElementById('supplier-filter').value;
  const date = document.getElementById('date-filter').value;
  const search = document.getElementById('search-input').value.toLowerCase();
  
  filteredProcurements = allProcurements.filter(p => {
    // Supplier filter
    if (supplierId && p.supplier_id !== supplierId) return false;
    
    // Date filter
    if (date) {
      const procDate = new Date(p.captured_at).toISOString().split('T')[0];
      if (procDate !== date) return false;
    }
    
    // Search filter
    if (search) {
      const matchesModel = p.model_name?.toLowerCase().includes(search);
      const matchesSupplier = p.supplier_name?.toLowerCase().includes(search);
      if (!matchesModel && !matchesSupplier) return false;
    }
    
    return true;
  });
  
  currentPage = 1;
  renderListItems();
}

/**
 * Render list items
 */
function renderListItems() {
  const listEl = document.getElementById('procurement-list');
  const emptyState = document.getElementById('empty-state');
  
  if (filteredProcurements.length === 0) {
    listEl.innerHTML = '';
    emptyState.classList.remove('hidden');
    return;
  }
  
  emptyState.classList.add('hidden');
  
  const items = filteredProcurements.slice(0, currentPage * PAGE_SIZE);
  
  listEl.innerHTML = items.map(p => `
    <button class="procurement-item w-full card hover:border-primary-300 text-left" data-id="${p.id}">
      <div class="flex gap-3">
        <div class="w-16 h-16 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0">
          ${p.image_url ? `
            <img src="${p.image_url}" alt="${p.model_name || 'Product'}" class="w-full h-full object-cover">
          ` : `
            <div class="w-full h-full flex items-center justify-center text-gray-400">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
              </svg>
            </div>
          `}
        </div>
        <div class="flex-1 min-w-0">
          <p class="font-medium text-gray-900 truncate">
            ${p.model_name || 'No model'}
          </p>
          <p class="text-sm text-gray-500 truncate">
            ${p.supplier_name || 'Unknown supplier'}
          </p>
          <div class="flex items-center justify-between mt-1">
            <p class="font-semibold text-primary-600">
              ${formatCurrency(p.price)}
            </p>
            <p class="text-xs text-gray-400">
              ${formatDate(p.captured_at)}
            </p>
          </div>
        </div>
      </div>
    </button>
  `).join('');
  
  // Add click handlers
  document.querySelectorAll('.procurement-item').forEach(item => {
    item.addEventListener('click', () => {
      router.navigate('detail', { id: item.dataset.id });
    });
  });
  
  // Show load more if needed
  const loadMore = document.getElementById('load-more');
  if (filteredProcurements.length > currentPage * PAGE_SIZE) {
    loadMore.classList.remove('hidden');
  } else {
    loadMore.classList.add('hidden');
  }
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
 * Setup bottom navigation
 */
function setupBottomNav() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const page = btn.dataset.page;
      router.navigate(page);
    });
  });
}
