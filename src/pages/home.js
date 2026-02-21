// Home Page
import { router } from '../modules/router.js';
import { getAllQueueItems } from '../modules/db.js';
import { appState } from '../modules/app.js';
import { renderBottomNav, renderSkeleton, renderEmptyState, getCurrentTheme, toggleTheme, renderThemeToggle, initTheme, applyTheme } from '../modules/theme.js';

/**
 * Render home page
 */
export async function renderHome(container) {
  // Get pending sync count
  const queueItems = await getAllQueueItems();
  const pendingCount = queueItems.filter(item => item.status === 'pending').length;
  const failedCount = queueItems.filter(item => item.status === 'failed').length;
  
  // Initialize theme on first load
  initTheme();
  
  // Get current theme
  const currentTheme = getCurrentTheme();
  
  container.innerHTML = `
    <div id="home-container" class="min-h-screen bg-gray-50">
      <!-- Header -->
      <header class="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div class="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <img src="/128x128@2x.png" alt="Logo" class="w-8 h-8 object-contain">
            <h1 class="text-lg font-bold text-gray-900">Procurement</h1>
          </div>
          <div class="flex items-center gap-2">
            ${!appState.isOnline ? `
              <span class="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                Offline
              </span>
            ` : ''}
            ${renderThemeToggle(currentTheme.name)}
            <button id="sync-status" class="p-2 hover:bg-gray-100 rounded-lg" aria-label="Sync status">
              <svg class="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
              </svg>
            </button>
          </div>
        </div>
      </header>
      
      <!-- Main Content -->
      <main class="max-w-lg mx-auto p-4 space-y-4">
        <!-- Sync Status Card -->
        ${pendingCount > 0 || failedCount > 0 ? `
          <div class="card ${failedCount > 0 ? 'border-red-300 bg-red-50' : 'bg-yellow-50'}">
            <div class="flex items-center gap-3">
              ${failedCount > 0 ? `
                <svg class="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                </svg>
              ` : `
                <svg class="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              `}
              <div>
                <p class="font-medium ${failedCount > 0 ? 'text-red-800' : 'text-yellow-800'}">
                  ${failedCount > 0 ? `${failedCount} items failed to sync` : `${pendingCount} items pending sync`}
                </p>
                <p class="text-sm ${failedCount > 0 ? 'text-red-600' : 'text-yellow-600'}">
                  ${failedCount > 0 ? 'Tap to retry' : 'Will sync when online'}
                </p>
              </div>
            </div>
          </div>
        ` : ''}
        
        <!-- Quick Actions -->
        <div class="grid grid-cols-2 gap-4">
          <!-- Capture (Unified) -->
          <button id="btn-capture" class="card hover:border-primary-300 transition-colors text-left">
            <div class="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center mb-3">
              <svg class="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
            </div>
            <h3 class="font-semibold text-gray-900">Capture</h3>
            <p class="text-sm text-gray-500 mt-1">Single or batch</p>
          </button>
          
          <!-- View History -->
          <button id="btn-list" class="card hover:border-primary-300 transition-colors text-left">
            <div class="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-3">
              <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
              </svg>
            </div>
            <h3 class="font-semibold text-gray-900">History</h3>
            <p class="text-sm text-gray-500 mt-1">View past captures</p>
          </button>
        </div>
        
        <!-- Recent Activity -->
        <div class="mt-6 pb-20">
          <h2 class="text-lg font-semibold text-gray-900 mb-3">Recent Activity</h2>
          <div id="recent-list" class="space-y-2">
            <p class="text-gray-500 text-sm">No recent captures</p>
          </div>
        </div>
      </main>

      <!-- Bottom Navigation -->
      ${renderBottomNav('home')}
    </div>
  `;
  
  // Setup event listeners
  document.getElementById('btn-capture').addEventListener('click', () => router.navigate('capture'));
  document.getElementById('btn-list').addEventListener('click', () => router.navigate('list'));
  
  // Theme toggle
  document.getElementById('theme-toggle')?.addEventListener('click', () => {
    const newTheme = toggleTheme();
    updateThemeToggle(newTheme);
    // Apply theme to the main container
    const homeContainer = document.getElementById('home-container');
    if (homeContainer) {
      applyTheme(homeContainer, 'home');
    }
    // Apply theme to header
    const header = document.querySelector('header');
    if (header) {
      header.classList.remove('bg-white', 'bg-gray-800', 'border-gray-200', 'border-gray-700');
      header.classList.add(newTheme.header, newTheme.border);
    }
    // Apply theme to cards and text
    document.querySelectorAll('.card').forEach(card => {
      card.classList.remove('bg-white', 'bg-gray-800', 'border-gray-200', 'border-gray-300');
      card.classList.add(newTheme.card, newTheme.border);
    });
    document.querySelectorAll('.text-gray-900').forEach(el => {
      el.classList.remove('text-gray-900', 'text-white');
      el.classList.add(newTheme.text);
    });
    document.querySelectorAll('.text-gray-500').forEach(el => {
      el.classList.remove('text-gray-500', 'text-gray-400');
      el.classList.add(newTheme.textMuted);
    });
  });
  
  // Bottom navigation
  setupBottomNav();
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

/**
 * Update theme toggle button after theme change
 */
function updateThemeToggle(theme) {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;
  
  const isDark = theme.name === 'dark';
  btn.innerHTML = isDark ? `
    <svg class="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
      <path fill-rule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clip-rule="evenodd"/>
    </svg>
  ` : `
    <svg class="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
      <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"/>
    </svg>
  `;
}
