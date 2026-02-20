// Home Page
import { router } from '../modules/router.js';
import { getAllQueueItems } from '../modules/db.js';
import { appState } from '../modules/app.js';

/**
 * Render home page
 */
export async function renderHome(container) {
  // Get pending sync count
  const queueItems = await getAllQueueItems();
  const pendingCount = queueItems.filter(item => item.status === 'pending').length;
  const failedCount = queueItems.filter(item => item.status === 'failed').length;
  
  container.innerHTML = `
    <div class="min-h-screen bg-gray-50">
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
            <button id="sync-status" class="p-2 hover:bg-gray-100 rounded-lg">
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
          <!-- Single Capture -->
          <button id="btn-capture" class="card hover:border-primary-300 transition-colors text-left">
            <div class="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center mb-3">
              <svg class="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
            </div>
            <h3 class="font-semibold text-gray-900">Single Capture</h3>
            <p class="text-sm text-gray-500 mt-1">Capture one item</p>
          </button>
          
          <!-- Batch Capture -->
          <button id="btn-batch" class="card hover:border-primary-300 transition-colors text-left">
            <div class="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mb-3">
              <svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
              </svg>
            </div>
            <h3 class="font-semibold text-gray-900">Batch Capture</h3>
            <p class="text-sm text-gray-500 mt-1">Fast multi-capture</p>
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
          
          <!-- Settings -->
          <button id="btn-settings" class="card hover:border-primary-300 transition-colors text-left">
            <div class="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mb-3">
              <svg class="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
            </div>
            <h3 class="font-semibold text-gray-900">Settings</h3>
            <p class="text-sm text-gray-500 mt-1">Configure app</p>
          </button>
        </div>
        
        <!-- Recent Activity -->
        <div class="mt-6">
          <h2 class="text-lg font-semibold text-gray-900 mb-3">Recent Activity</h2>
          <div id="recent-list" class="space-y-2">
            <p class="text-gray-500 text-sm">No recent captures</p>
          </div>
        </div>
      </main>
    </div>
  `;
  
  // Setup event listeners
  document.getElementById('btn-capture').addEventListener('click', () => router.navigate('capture'));
  document.getElementById('btn-batch').addEventListener('click', () => router.navigate('batch'));
  document.getElementById('btn-list').addEventListener('click', () => router.navigate('list'));
}
