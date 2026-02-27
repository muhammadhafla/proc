// Session Manager Module
// Main entry point that integrates all session management features

import {
  initSessionManagement,
  checkSession,
  refreshSession,
  terminateSession,
  clearAllCache,
  redirectToLogin,
  onSessionEvent,
  startPeriodicSessionCheck,
  stopPeriodicSessionCheck,
  setupSessionWarning,
  startIdleDetection,
  stopIdleDetection,
  getSessionState,
  withSessionCheck,
  getSessionConfig,
  isSensitiveRoute,
} from '../services/sessionService.js';

import { showSessionExpiredModal, hideSessionExpiredModal, isSessionExpiredModalVisible } from '../components/session/SessionExpiredModal.js';
import { showSessionWarning, hideSessionWarning, isSessionWarningVisible } from '../components/session/SessionWarning.js';

import { router } from './router.js';

// Session Manager State
let sessionManagerState = {
  isInitialized: false,
  isActive: false,
  currentModal: null,
};

// Timeout reference for forced logout after idle
let idleLogoutTimeout = null;

// Configuration
const SESSION_MANAGER_CONFIG = {
  // Enable/disable features
  features: {
    periodicCheck: true,
    sensitiveRouteCheck: true,
    idleDetection: true,
    multiTabSync: true,
    warningCountdown: true,
  },
  
  // Timing
  checkInterval: 5 * 60 * 1000, // 5 minutes
  warningTime: 2 * 60 * 1000, // 2 minutes before expiry
  idleTimeout: 15 * 60 * 1000, // 15 minutes
  
  // Sensitive routes requiring extra validation
  sensitiveRoutes: ['admin', 'payment', 'settings', 'account', 'billing'],
};

/**
 * Initialize the session manager
 * @param {Object} options - Configuration options
 */
export async function initSessionManager(options = {}) {
  const config = { ...SESSION_MANAGER_CONFIG, ...options };
  
  console.log('[SessionManager] Initializing...');
  
  // Set up event handlers
  setupEventHandlers();
  
  // Initialize session management service
  const sessionInfo = await initSessionManagement({
    checkInterval: config.checkInterval,
    warningTime: config.warningTime,
    idleTimeout: config.idleTimeout,
  });
  
  if (sessionInfo.isValid) {
    // Set up periodic checking
    if (config.features.periodicCheck) {
      startPeriodicSessionCheck();
    }
    
    // Set up warning countdown
    if (config.features.warningCountdown) {
      setupSessionWarning();
    }
    
    // Set up idle detection
    if (config.features.idleDetection) {
      setupIdleDetection(config.idleTimeout);
    }
    
    sessionManagerState.isActive = true;
  }
  
  sessionManagerState.isInitialized = true;
  console.log('[SessionManager] Initialized', sessionInfo);
  
  return sessionInfo;
}

/**
 * Set up event handlers for session events
 */
function setupEventHandlers() {
  // Session expired
  onSessionEvent('sessionExpired', handleSessionExpired);
  
  // Session warning (about to expire)
  onSessionEvent('sessionWarning', handleSessionWarning);
  
  // Session check failed (network error)
  onSessionEvent('sessionCheckFailed', handleSessionCheckFailed);
  
  // Session invalid
  onSessionEvent('sessionInvalid', handleSessionInvalid);
  
  // Session required (for sensitive routes)
  onSessionEvent('sessionRequired', handleSessionRequired);
  
  // Session terminated
  onSessionEvent('sessionTerminated', handleSessionTerminated);
  
  // Cache cleared
  onSessionEvent('cacheCleared', handleCacheCleared);
}

/**
 * Handle session expired event
 * @param {Object} data - Event data
 */
async function handleSessionExpired(data = {}) {
  console.log('[SessionManager] Session expired', data);
  
  // Stop all timers
  stopPeriodicSessionCheck();
  stopIdleDetection();
  hideSessionWarning();
  
  // Show non-dismissible modal
  const sessionInfo = getSessionState();
  showSessionExpiredModal({
    reason: data.reason || sessionInfo?.reason || 'Your session has expired. Please log in again to continue.',
    redirectBack: router.getCurrentRoute(),
    onAction: async () => {
      // Perform cleanup before redirect
      await performCleanup();
    },
  });
}

/**
 * Handle session warning event (about to expire)
 * @param {Object} data - Event data with expiresAt and expiresInSeconds
 */
function handleSessionWarning(data) {
  console.log('[SessionManager] Session warning', data);
  
  // Show warning with countdown
  showSessionWarning({
    expiresAt: data.expiresAt,
    expiresInSeconds: data.expiresInSeconds,
    onExtend: async () => {
      // Try to extend session
      const result = await refreshSession();
      
      if (result.success) {
        // Restart periodic checking
        startPeriodicSessionCheck();
        return { success: true };
      }
      
      return { success: false, error: result.error };
    },
    onLogout: async () => {
      // User chose to logout
      await handleLogout();
    },
  });
}

/**
 * Handle session check failed (network error)
 * @param {Object} data - Event data with error info
 */
function handleSessionCheckFailed(data) {
  console.error('[SessionManager] Session check failed:', data);
  
  // Log to console - toast notification can be added if needed
  console.warn(
    `Connection problem. Could not verify session. ${data.retryCount < data.maxRetries ? 'Retrying...' : 'Please try again.'}`
  );
}

/**
 * Handle session invalid event
 * @param {Object} data - Event data
 */
function handleSessionInvalid(data) {
  console.log('[SessionManager] Session invalid', data);
  
  // Could show a warning but not force logout yet
  // The periodic check will handle showing the modal when needed
}

/**
 * Handle session required for sensitive route
 * @param {Object} data - Event data with route
 */
function handleSessionRequired(data) {
  console.log('[SessionManager] Session required for route:', data.route);
  
  // Redirect to login with return URL
  const currentRoute = router.getCurrentRoute();
  redirectToLogin(currentRoute);
}

/**
 * Handle session terminated event
 * @param {Object} data - Event data
 */
function handleSessionTerminated(data) {
  console.log('[SessionManager] Session terminated', data);
  
  // Clear UI
  hideSessionWarning();
  hideSessionExpiredModal();
  
  // Redirect to login
  redirectToLogin();
}

/**
 * Handle cache cleared event
 */
function handleCacheCleared() {
  console.log('[SessionManager] Cache cleared');
}

/**
 * Perform cleanup before logout/redirect
 */
async function performCleanup() {
  console.log('[SessionManager] Performing cleanup...');
  
  try {
    // Clear all cache
    await clearAllCache();
    
    // Terminate session on server
    await terminateSession();
    
    console.log('[SessionManager] Cleanup complete');
  } catch (error) {
    console.error('[SessionManager] Cleanup error:', error);
    // Continue with redirect even if cleanup fails
  }
}

/**
 * Handle user logout
 * @param {boolean} _terminateAll - Whether to terminate all sessions (reserved for future use)
 */
async function handleLogout(_terminateAll = false) {
  await performCleanup();
  
  // Redirect to login
  redirectToLogin();
}

/**
 * Set up idle detection
 * @param {number} timeoutMs - Idle timeout in milliseconds
 */
function setupIdleDetection(timeoutMs) {
  // Clear any existing idle timeout
  if (idleLogoutTimeout) {
    clearTimeout(idleLogoutTimeout);
    idleLogoutTimeout = null;
  }
  
  startIdleDetection(
    // On idle
    async (_data) => {
      console.log('[SessionManager] User idle detected', _data);
      
      // Show warning first
      showSessionWarning({
        expiresInSeconds: 0,
        onExtend: async () => {
          // Refresh session on activity
          const result = await refreshSession();
          return result;
        },
        onLogout: async () => {
          await handleLogout();
        },
      });
      
      // After 1 minute of idle, force logout
      idleLogoutTimeout = setTimeout(async () => {
        if (isSessionWarningVisible()) {
          await handleLogout();
        }
      }, 60000);
    },
    // On active
    (_data) => {
      console.log('[SessionManager] User active again');
      // Clear the idle logout timeout when user becomes active
      if (idleLogoutTimeout) {
        clearTimeout(idleLogoutTimeout);
        idleLogoutTimeout = null;
      }
    },
    timeoutMs
  );
}

/**
 * Check session on app mount
 */
export async function checkSessionOnMount() {
  const sessionInfo = await checkSession();
  
  if (!sessionInfo.isValid && !isSessionExpiredModalVisible()) {
    // Show modal if session is invalid
    handleSessionExpired({ reason: sessionInfo.reason });
  }
  
  return sessionInfo;
}

/**
 * Check session on navigation to sensitive route
 * @param {string} routeName - Route being navigated to
 */
async function checkSessionOnNavigation(routeName) {
  if (!SESSION_MANAGER_CONFIG.features.sensitiveRouteCheck) {
    return true;
  }

  // Check if route is sensitive
  if (isSensitiveRoute(routeName)) {
    const sessionInfo = await checkSession();
    
    if (!sessionInfo.isValid) {
      handleSessionExpired({ reason: 'Session required for this page' });
      return false;
    }
  }
  
  return true;
}

/**
 * Set up navigation guard
 * Instead of monkey-patching router.navigate, we wrap at the call sites
 * or use event-based navigation interception
 */
export function setupNavigationGuard() {
  // Note: This function is kept for API compatibility but navigation guard
  // is now handled differently - see checkSessionOnNavigation usage in app.js
  console.log('[SessionManager] Navigation guard setup complete (using call-site wrapping)');
}

/**
 * Force session check (manual trigger)
 */
export async function forceSessionCheck() {
  return await checkSession();
}

/**
 * Extend session manually
 */
export async function extendSession() {
  const result = await refreshSession();
  
  if (result.success) {
    // Restart periodic checking
    startPeriodicSessionCheck();
    setupSessionWarning();
  }
  
  return result;
}

/**
 * Logout user
 * @param {boolean} terminateAll - Whether to terminate all sessions
 */
export async function logout(terminateAll = false) {
  await handleLogout(terminateAll);
}

/**
 * Get session manager state
 */
export function getSessionManagerState() {
  return {
    ...sessionManagerState,
    session: getSessionState(),
    config: getSessionConfig(),
  };
}

/**
 * Resume session management (after login)
 */
export async function resumeSessionManagement() {
  const sessionInfo = await checkSession();
  
  if (sessionInfo.isValid) {
    sessionManagerState.isActive = true;
    
    // Restart periodic checking
    if (SESSION_MANAGER_CONFIG.features.periodicCheck) {
      startPeriodicSessionCheck();
    }
    
    // Setup warning
    if (SESSION_MANAGER_CONFIG.features.warningCountdown) {
      setupSessionWarning();
    }
    
    // Setup idle detection
    if (SESSION_MANAGER_CONFIG.features.idleDetection) {
      setupIdleDetection(SESSION_MANAGER_CONFIG.idleTimeout);
    }
  }
  
  return sessionInfo;
}

/**
 * Pause session management (e.g., when on login page)
 */
export function pauseSessionManagement() {
  sessionManagerState.isActive = false;
  
  stopPeriodicSessionCheck();
  stopIdleDetection();
  hideSessionWarning();
  hideSessionExpiredModal();
}

// Export for use in API calls
export { withSessionCheck };

/**
 * Safe navigation function that checks session before navigating
 * Use this instead of router.navigate when navigating to sensitive routes
 * @param {string} routeName - Route to navigate to
 * @param {Object} params - Route parameters
 * @returns {Promise<boolean>} - True if navigation was allowed
 */
export async function safeNavigate(routeName, params = {}) {
  const canNavigate = await checkSessionOnNavigation(routeName);
  
  if (canNavigate) {
    router.navigate(routeName, params);
    return true;
  }
  
  return false;
}
