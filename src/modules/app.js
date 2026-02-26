import { supabase } from './api.js';
import { onAuthStateChange, getOrganization } from './api.js';
import { router, routes } from './router.js';
import { syncEngine } from './sync.js';
import { appState } from './state.js';
import {
  initSessionManager,
  checkSessionOnMount,
  setupNavigationGuard,
  resumeSessionManagement,
  pauseSessionManagement,
  forceSessionCheck,
  logout,
  getSessionManagerState,
} from './sessionManager.js';

// Attach to window for backward compatibility
window.appState = appState;
window.appRouter = router;
window.sessionManager = {
  check: forceSessionCheck,
  logout: logout,
  getState: getSessionManagerState,
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
  
  // Initialize session manager
  await initSessionManager({
    features: {
      periodicCheck: true,
      sensitiveRouteCheck: true,
      idleDetection: true,
      multiTabSync: true,
      warningCountdown: true,
    },
  });
  
  // Setup navigation guard for session checks
  setupNavigationGuard();
  
  // Check initial session
  const sessionInfo = await checkSessionOnMount();
  
  if (sessionInfo.isValid) {
    // Session is active, restore state
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      await handleAuthChange('SIGNED_IN', session);
    }
  } else {
    // No active session - could be local session but server session expired
    // Clear any cached session
    console.log('Session expired or invalid, redirecting to login');
    await supabase.auth.signOut();
    
    // Check for token in URL hash (magic link callback)
    const magicLinkProcessed = await handleMagicLinkCallback();
    
    if (!magicLinkProcessed) {
      // Show login page
      router.navigate('login');
    }
  }
  
  // Start sync engine if authenticated
  if (appState.get('user')) {
    syncEngine.start();
  }
}

/**
 * Handle magic link callback from URL hash
 */
async function handleMagicLinkCallback() {
  const hash = window.location.hash;
  
  // First, check for auth errors in the hash
  if (hash && hash.includes('error=')) {
    const params = new URLSearchParams(hash.substring(1));
    const error = params.get('error');
    const errorCode = params.get('error_code');
    const errorDescription = params.get('error_description');
    
    if (error) {
      // Clear the hash from URL
      window.location.hash = '';
      
      // Navigate to login with error
      router.navigate('login', { 
        authError: {
          error,
          errorCode: errorCode || 'unknown',
          errorDescription: errorDescription || 'An authentication error occurred'
        }
      });
      return true;
    }
  }
  
  // Check for valid session (magic link success)
  if (hash && hash.includes('access_token')) {
    // Parse the hash fragment
    const params = new URLSearchParams(hash.substring(1));
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    
    if (accessToken) {
      // Set the session from the URL tokens
      const { data, error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken || '',
      });
      
      if (!error && data.session) {
        // Clear the hash from URL
        window.location.hash = '';
        
        // Handle the auth change
        await handleAuthChange('SIGNED_IN', data.session);
        return true;
      }
    }
  }
  return false;
}

/**
 * Handle authentication changes
 */
async function handleAuthChange(event, session) {
  if (event === 'SIGNED_IN' && session) {
    appState.set('user', session.user);
    // Also persist to localStorage for fallback
    localStorage.setItem('user', JSON.stringify(session.user));
    
    // Resume session management after login
    await resumeSessionManagement();
    
    // Load organization
    try {
      const organization = await getOrganization();
      if (organization) {
        appState.set('organization', organization);
        // Also persist to localStorage for fallback
        localStorage.setItem('organization', JSON.stringify(organization));
        console.log('User logged in:', session.user.email, '| Org:', organization.name, '| Role:', organization.userRole);
      }
    } catch (error) {
      console.error('Failed to load organization:', error.message);
      
      // Sign out user due to invalid access
      await supabase.auth.signOut();
      
      if (error.message === 'USER_NOT_FOUND') {
        showNotification('Access denied. Your account is not registered in the system. Please contact the administrator.', 'error');
      } else if (error.message === 'USER_NO_ORGANIZATION') {
        showNotification('Your account is not assigned to any organization. Please contact your administrator to get access.', 'error');
      } else {
        showNotification('Failed to load organization. Please try again or contact support.', 'error');
      }
      
      // Stay on login page
      router.navigate('login');
      return;
    }
    
    // Start sync engine
    syncEngine.start();
    
    // Navigate to home or stored intended route
    // Priority: 1. sessionRedirect (from session expiry), 2. intendedRoute (from auth guard), 3. home
    const sessionRedirect = sessionStorage.getItem('sessionRedirect');
    const intendedRoute = sessionStorage.getItem('intendedRoute');
    
    if (sessionRedirect) {
      // Clear the redirect param
      sessionStorage.removeItem('sessionRedirect');
      
      // Navigate to the original page user was on before session expired
      if (routes[sessionRedirect]) {
        console.log('[SessionManager] Redirecting to:', sessionRedirect);
        router.navigate(sessionRedirect);
      } else {
        router.navigate('home');
      }
    } else if (intendedRoute && routes[intendedRoute]) {
      sessionStorage.removeItem('intendedRoute');
      router.navigate(intendedRoute);
    } else {
      router.navigate('home');
    }
  } else if (event === 'SIGNED_OUT') {
    appState.set('user', null);
    appState.set('organization', null);
    
    // Clear localStorage backup
    localStorage.removeItem('user');
    localStorage.removeItem('organization');
    
    // Pause session management on logout
    pauseSessionManagement();
    
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
  appState.set('isOnline', true);
  console.log('Network: Online');
  
  // Trigger sync
  if (appState.get('user')) {
    syncEngine.triggerSync();
  }
}

/**
 * Handle going offline
 */
function handleOffline() {
  appState.set('isOnline', false);
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
  indicator.className = 'fixed top-0 left-0 right-0 bg-yellow-500 text-white text-center py-2 text-sm font-medium z-50 cursor-pointer';
  indicator.textContent = 'You are offline. Data will sync when connected. Click to dismiss.';
  
  document.body.appendChild(indicator);
  
  // Click to dismiss
  indicator.addEventListener('click', () => {
    indicator.remove();
  });
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
