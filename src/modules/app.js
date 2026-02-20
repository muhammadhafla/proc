// Main Application Module
import { onAuthStateChange, getSession } from './api.js';
import { router } from './router.js';
import { syncEngine } from './sync.js';

// App state
export const appState = {
  user: null,
  organization: null,
  isOnline: navigator.onLine,
  isSyncing: false,
};

/**
 * Initialize the application
 */
export async function initApp() {
  // Setup network listeners
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  
  // Listen for auth changes
  onAuthStateChange(handleAuthChange);
  
  // Check initial session
  const { data: { session } } = await getSession();
  if (session) {
    await handleAuthChange('SIGNED_IN', session);
  } else {
    // Show login page
    router.navigate('login');
  }
  
  // Start sync engine if authenticated
  if (appState.user) {
    syncEngine.start();
  }
}

/**
 * Handle authentication changes
 */
async function handleAuthChange(event, session) {
  if (event === 'SIGNED_IN' && session) {
    appState.user = session.user;
    
    // Start sync engine
    syncEngine.start();
    
    // Navigate to home
    router.navigate('home');
  } else if (event === 'SIGNED_OUT') {
    appState.user = null;
    appState.organization = null;
    
    // Stop sync engine
    syncEngine.stop();
    
    // Navigate to login
    router.navigate('login');
  }
}

/**
 * Handle coming online
 */
function handleOnline() {
  appState.isOnline = true;
  console.log('Network: Online');
  
  // Trigger sync
  if (appState.user) {
    syncEngine.triggerSync();
  }
}

/**
 * Handle going offline
 */
function handleOffline() {
  appState.isOnline = false;
  console.log('Network: Offline');
  
  // Show offline indicator
  showOfflineIndicator();
}

/**
 * Show offline indicator
 */
function showOfflineIndicator() {
  const existing = document.getElementById('offline-indicator');
  if (existing) return;
  
  const indicator = document.createElement('div');
  indicator.id = 'offline-indicator';
  indicator.className = 'fixed top-0 left-0 right-0 bg-yellow-500 text-white text-center py-2 text-sm font-medium z-50';
  indicator.textContent = 'You are offline. Data will sync when connected.';
  
  document.body.appendChild(indicator);
  
  // Auto hide after 3 seconds
  setTimeout(() => {
    indicator.remove();
  }, 3000);
}

/**
 * Show notification
 */
export function showNotification(message, type = 'info') {
  const colors = {
    info: 'bg-blue-500',
    success: 'bg-green-500',
    error: 'bg-red-500',
    warning: 'bg-yellow-500',
  };
  
  const notification = document.createElement('div');
  notification.className = `fixed bottom-20 left-1/2 transform -translate-x-1/2 ${colors[type]} text-white px-4 py-2 rounded-lg shadow-lg text-sm font-medium z-50 animate-fade-in`;
  notification.textContent = message;
  
  document.body.appendChild(notification);
  
  // Auto remove after 3 seconds
  setTimeout(() => {
    notification.remove();
  }, 3000);
}

/**
 * Format currency
 */
export function formatCurrency(amount, currency = 'IDR') {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format date
 */
export function formatDate(date) {
  return new Intl.DateTimeFormat('id-ID', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}
