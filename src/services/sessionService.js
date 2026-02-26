// Session Management Service
// Comprehensive session validation and management for database sessions

import { supabase } from '../modules/api.js';
import { appState } from '../modules/state.js';
import { router } from '../modules/router.js';

// Session configuration
const SESSION_CONFIG = {
  // Check interval in milliseconds (default: 5 minutes)
  checkInterval: 5 * 60 * 1000,
  
  // Warning time before expiry in milliseconds (default: 2 minutes)
  warningTime: 2 * 60 * 1000,
  
  // Retry configuration
  maxRetryAttempts: 3,
  retryDelays: [1000, 2000, 4000], // Exponential backoff: 1s, 2s, 4s
  
  // Idle timeout in milliseconds (default: 15 minutes)
  idleTimeout: 15 * 60 * 1000,
  
  // Percentage of session lifetime to trigger periodic check (default: 50%)
  checkThresholdPercent: 50,
  
  // Sensitive routes that require session validation
  sensitiveRoutes: ['admin', 'payment', 'settings', 'account'],
};

// Session state
let sessionState = {
  isValid: false,
  userId: null,
  email: null,
  expiresAt: null,
  expiresInSeconds: 0,
  lastChecked: null,
  isChecking: false,
  retryCount: 0,
};

// Timer references
let sessionCheckTimer = null;
let sessionWarningTimer = null;
let idleTimer = null;
let lastActivityTime = Date.now();

// Event listeners storage
const eventListeners = new Map();

// Broadcast channel for multi-tab sync
let broadcastChannel = null;

// Request queue for race condition handling
let requestQueue = [];
let isProcessingQueue = false;

// Initialize broadcast channel
function initBroadcastChannel() {
  if (typeof BroadcastChannel !== 'undefined') {
    broadcastChannel = new BroadcastChannel('session_sync');
    
    broadcastChannel.onmessage = (event) => {
      const { type, data } = event.data;
      
      switch (type) {
        case 'SESSION_EXPIRED':
        case 'LOGOUT':
          handleSessionExpiredFromOtherTab(data);
          break;
        case 'SESSION_REFRESHED':
          handleSessionRefreshedFromOtherTab(data);
          break;
        case 'SESSION_CHECK':
          // Respond to session check request from other tabs
          if (sessionState.isValid) {
            broadcastSessionEvent('SESSION_REFRESHED', {
              userId: sessionState.userId,
              expiresAt: sessionState.expiresAt,
              expiresInSeconds: sessionState.expiresInSeconds,
            });
          }
          break;
      }
    };
  }
  
  // Also listen to localStorage events for broader compatibility
  window.addEventListener('storage', handleStorageEvent);
}

// Handle storage events from other tabs
function handleStorageEvent(event) {
  if (event.key === 'session_action' && event.newValue) {
    try {
      const data = JSON.parse(event.newValue);
      if (data) {
        switch (data.type) {
          case 'SESSION_EXPIRED':
          case 'LOGOUT':
            handleSessionExpiredFromOtherTab(data);
            break;
        }
      }
    } catch (e) {
      console.warn('Failed to parse storage event:', e);
    }
  }
}

// Broadcast session event to other tabs
function broadcastSessionEvent(type, data) {
  if (broadcastChannel) {
    broadcastChannel.postMessage({ type, data });
  }
  
  // Also use localStorage for broader compatibility
  localStorage.setItem('session_action', JSON.stringify({ type, data }));
  // Clear immediately after to avoid re-triggering
  setTimeout(() => localStorage.removeItem('session_action'), 100);
}

// Handle session expired from another tab
function handleSessionExpiredFromOtherTab(data) {
  if (data.userId === sessionState.userId) {
    clearAllTimers();
    sessionState.isValid = false;
    emitEvent('sessionExpired', { reason: data.reason, fromOtherTab: true });
  }
}

// Handle session refreshed from another tab
function handleSessionRefreshedFromOtherTab(data) {
  if (data.userId === sessionState.userId) {
    sessionState.expiresAt = data.expiresAt;
    sessionState.expiresInSeconds = data.expiresInSeconds;
    sessionState.isValid = true;
    emitEvent('sessionRefreshed', data);
  }
}

// Request queue processing
function processRequestQueue() {
  if (isProcessingQueue || requestQueue.length === 0) return;
  
  isProcessingQueue = true;
  
  const processNext = async () => {
    if (requestQueue.length === 0) {
      isProcessingQueue = false;
      return;
    }
    
    const { request, resolve, reject } = requestQueue[0];
    
    try {
      // Check if session is still valid before processing
      if (!sessionState.isValid) {
        // Reject all queued requests
        requestQueue.forEach(item => {
          item.reject(new Error('Session expired'));
        });
        requestQueue = [];
        isProcessingQueue = false;
        return;
      }
      
      const result = await request();
      resolve(result);
      requestQueue.shift();
      processNext();
    } catch (error) {
      reject(error);
      requestQueue.shift();
      processNext();
    }
  };
  
  processNext();
}

// Add request to queue
function queueRequest(request) {
  return new Promise((resolve, reject) => {
    requestQueue.push({ request, resolve, reject });
    processRequestQueue();
  });
}

// Exponential backoff retry
async function retryWithBackoff(fn, maxAttempts = SESSION_CONFIG.maxRetryAttempts) {
  let lastError;
  
  // Supabase auth error codes that should not be retried
  const nonRetryableErrors = [
    'session',
    'expired', 
    'invalid',
    'unauthorized',
    'JWT',
    'token',
    'auth',
    'SWR',  // Supabase WebSocket error prefix
    'PGRST'  // PostgREST error prefix
  ];
  
  function isRetryableError(error) {
    const msg = error.message?.toLowerCase() || '';
    // Check if error message contains any non-retryable error pattern
    return !nonRetryableErrors.some(pattern => msg.includes(pattern.toLowerCase()));
  }
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Don't retry on session/auth-specific errors
      if (!isRetryableError(error)) {
        throw error;
      }
      
      // Check if more attempts remaining
      if (attempt < maxAttempts - 1) {
        const delay = SESSION_CONFIG.retryDelays[attempt] || SESSION_CONFIG.retryDelays[SESSION_CONFIG.retryDelays.length - 1];
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}

// Validate session with backend
async function validateSession() {
  return retryWithBackoff(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return {
        isValid: false,
        userId: null,
        email: null,
        expiresAt: null,
        expiresInSeconds: 0,
        reason: 'No session found',
      };
    }
    
    // Call the Supabase function to validate session
    const { data, error } = await supabase.rpc('get_session_status');
    
    if (error) {
      console.warn('Session validation RPC failed, using local check:', error);
      // Fallback to local session check
      const { data: { user } } = await supabase.auth.getUser();
      
      return {
        isValid: !!user,
        userId: user?.id || null,
        email: user?.email || null,
        expiresAt: session.expires_at ? new Date(session.expires_at * 1000) : null,
        expiresInSeconds: session.expires_in || 0,
        reason: user ? 'Session valid (local check)' : 'User not found',
      };
    }
    
    // Process RPC response
    if (data && data.length > 0) {
      const sessionInfo = data[0];
      return {
        isValid: sessionInfo.is_authenticated,
        userId: sessionInfo.user_id,
        email: sessionInfo.email,
        expiresAt: sessionInfo.expires_at,
        expiresInSeconds: sessionInfo.expires_in_seconds,
        reason: 'Session validated via server',
      };
    }
    
    return {
      isValid: false,
      userId: null,
      email: null,
      expiresAt: null,
      expiresInSeconds: 0,
      reason: 'Session validation returned no data',
    };
  });
}

// Check session status
export async function checkSession() {
  // If already checking, wait for it to complete instead of returning stale state
  if (sessionState.isChecking) {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (!sessionState.isChecking) {
          clearInterval(checkInterval);
          resolve({ ...sessionState });
        }
      }, 100);
      
      // Timeout after 10 seconds to prevent infinite waiting
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve({ ...sessionState, isChecking: false, isValid: false, reason: 'Session check timeout' });
      }, 10000);
    });
  }
  
  sessionState.isChecking = true;
  
  try {
    const result = await validateSession();
    
    sessionState = {
      ...sessionState,
      isValid: result.isValid,
      userId: result.userId,
      email: result.email,
      expiresAt: result.expiresAt ? new Date(result.expiresAt) : null,
      expiresInSeconds: result.expiresInSeconds,
      lastChecked: new Date(),
      isChecking: false,
      retryCount: 0,
    };
    
    // Broadcast to other tabs
    if (sessionState.isValid) {
      broadcastSessionEvent('SESSION_REFRESHED', {
        userId: sessionState.userId,
        expiresAt: sessionState.expiresAt,
        expiresInSeconds: sessionState.expiresInSeconds,
      });
    }
    
    // Emit events
    if (sessionState.isValid) {
      emitEvent('sessionValid', sessionState);
    } else {
      emitEvent('sessionInvalid', { reason: result.reason });
    }
    
    return sessionState;
  } catch (error) {
    sessionState.isChecking = false;
    sessionState.retryCount++;
    
    const errorInfo = {
      isValid: false,
      error: error.message,
      retryCount: sessionState.retryCount,
      maxRetries: SESSION_CONFIG.maxRetryAttempts,
    };
    
    if (sessionState.retryCount >= SESSION_CONFIG.maxRetryAttempts) {
      emitEvent('sessionCheckFailed', errorInfo);
    }
    
    return { ...sessionState, ...errorInfo };
  }
}

// Refresh session (re-authenticate)
export async function refreshSession() {
  try {
    const { data, error } = await supabase.auth.refreshSession();
    
    if (error) throw error;
    
    if (data.session) {
      sessionState.isValid = true;
      sessionState.expiresAt = new Date(data.session.expires_at * 1000);
      sessionState.expiresInSeconds = data.session.expires_in;
      
      emitEvent('sessionRefreshed', sessionState);
      return { success: true, session: data.session };
    }
    
    return { success: false, error: 'No session returned' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Terminate session (logout)
export async function terminateSession(terminateAll = false) {
  clearAllTimers();
  
  try {
    if (terminateAll && sessionState.userId) {
      // Call server to terminate all sessions
      await supabase.rpc('terminate_all_sessions', { p_user_id: sessionState.userId });
    }
    
    // Sign out locally
    await supabase.auth.signOut();
    
    // Broadcast logout to other tabs
    broadcastSessionEvent('LOGOUT', { userId: sessionState.userId });
    
    // Reset state
    sessionState = {
      isValid: false,
      userId: null,
      email: null,
      expiresAt: null,
      expiresInSeconds: 0,
      lastChecked: null,
      isChecking: false,
      retryCount: 0,
    };
    
    emitEvent('sessionTerminated', { terminateAll });
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Clear all cache and storage
export async function clearAllCache() {
  // Clear localStorage
  const authKeys = ['supabase.auth.token', 'session_action', 'intendedRoute', 'user'];
  authKeys.forEach(key => localStorage.removeItem(key));
  
  // Clear sessionStorage
  sessionStorage.clear();
  
  // Clear cookies
  const cookies = document.cookie.split(';');
  cookies.forEach(cookie => {
    const [name] = cookie.trim().split('=');
    if (name) {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
    }
  });
  
  // Clear IndexedDB (Supabase-specific only)
  // Only clear known Supabase database names to avoid affecting other apps
  try {
    const knownSupabaseDBs = [
      'supabase-auth',
      'sb-local-storage',
      'local-storage'
    ];
    
    for (const dbName of knownSupabaseDBs) {
      try {
        indexedDB.deleteDatabase(dbName);
      } catch (e) {
        // Database may not exist, ignore
      }
    }
  } catch (e) {
    console.warn('IndexedDB clear failed:', e);
  }
  
  // Clear memory variables
  sessionState = {
    isValid: false,
    userId: null,
    email: null,
    expiresAt: null,
    expiresInSeconds: 0,
    lastChecked: null,
    isChecking: false,
    retryCount: 0,
  };
  
  // Clear any cached user data
  appState.set('user', null);
  appState.set('organization', null);
  
  emitEvent('cacheCleared');
}

// Redirect to login with redirect back
export function redirectToLogin(redirectBack = null) {
  // Validate redirect to prevent open redirect attacks
  // Only allow alphanumeric characters, hyphens, and underscores
  let validatedRedirect = 'home';
  
  if (redirectBack && /^[a-zA-Z0-9\-_]+$/.test(redirectBack)) {
    validatedRedirect = redirectBack;
  } else if (redirectBack) {
    // Log suspicious redirect attempt
    console.warn('[SessionService] Invalid redirect path rejected:', redirectBack);
  }
  
  const loginUrl = `#login?redirect=${encodeURIComponent(validatedRedirect)}&reason=session_expired`;
  window.location.hash = loginUrl;
}

// Get current session state
export function getSessionState() {
  return { ...sessionState };
}

// Get session configuration
export function getSessionConfig() {
  return { ...SESSION_CONFIG };
}

// Event emitter functions
function emitEvent(event, data) {
  if (eventListeners.has(event)) {
    eventListeners.get(event).forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in session event listener for ${event}:`, error);
      }
    });
  }
}

export function onSessionEvent(event, callback) {
  if (!eventListeners.has(event)) {
    eventListeners.set(event, new Set());
  }
  eventListeners.get(event).add(callback);
  
  return () => {
    eventListeners.get(event)?.delete(callback);
  };
}

// Clear all timers
function clearAllTimers() {
  if (sessionCheckTimer) {
    clearInterval(sessionCheckTimer);
    sessionCheckTimer = null;
  }
  
  if (sessionWarningTimer) {
    clearTimeout(sessionWarningTimer);
    sessionWarningTimer = null;
  }
  
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
}

// Calculate next check interval based on session expiry
function calculateCheckInterval() {
  if (!sessionState.expiresAt) {
    return SESSION_CONFIG.checkInterval;
  }
  
  const timeUntilExpiry = sessionState.expiresAt.getTime() - Date.now();
  
  // If less than 50% of session time remaining, check more frequently
  if (timeUntilExpiry < SESSION_CONFIG.warningTime) {
    // Check every 30 seconds when close to expiry
    return 30000;
  }
  
  // Default: check every 5 minutes or half of remaining time (whichever is smaller)
  const halfSessionTime = timeUntilExpiry / 2;
  return Math.min(SESSION_CONFIG.checkInterval, halfSessionTime);
}

// Start periodic session checking
export function startPeriodicSessionCheck() {
  // Clear existing timer
  if (sessionCheckTimer) {
    clearInterval(sessionCheckTimer);
  }
  
  // Initial check
  checkSession();
  
  // Set up periodic checking
  const interval = calculateCheckInterval();
  sessionCheckTimer = setInterval(async () => {
    await checkSession();
    
    // Recalculate interval based on current session state
    const newInterval = calculateCheckInterval();
    if (newInterval !== interval) {
      clearInterval(sessionCheckTimer);
      startPeriodicSessionCheck();
    }
  }, interval);
}

// Stop periodic session checking
export function stopPeriodicSessionCheck() {
  if (sessionCheckTimer) {
    clearInterval(sessionCheckTimer);
    sessionCheckTimer = null;
  }
}

// Setup session warning (before expiry)
export function setupSessionWarning() {
  if (!sessionState.expiresAt || sessionWarningTimer) return;
  
  const timeUntilExpiry = sessionState.expiresAt.getTime() - Date.now();
  const warningDelay = Math.max(0, timeUntilExpiry - SESSION_CONFIG.warningTime);
  
  if (warningDelay > 0) {
    sessionWarningTimer = setTimeout(() => {
      emitEvent('sessionWarning', {
        expiresAt: sessionState.expiresAt,
        expiresInSeconds: Math.floor(timeUntilExpiry / 1000),
      });
    }, warningDelay);
  }
}

// User idle detection
let idleEventListeners = {
  onIdle: null,
  onActive: null,
};

function resetIdleTimer() {
  lastActivityTime = Date.now();
  
  // Emit active event if we were idle
  if (idleEventListeners.onActive) {
    idleEventListeners.onActive({
      idleDuration: Date.now() - lastActivityTime,
    });
  }
}

export function startIdleDetection(onIdle, onActive, timeoutMs = SESSION_CONFIG.idleTimeout) {
  idleEventListeners.onIdle = onIdle;
  idleEventListeners.onActive = onActive;
  
  // Reset timer on user activity
  const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart'];
  activityEvents.forEach(event => {
    document.addEventListener(event, resetIdleTimer, { passive: true });
  });
  
  // Check idle status periodically
  idleTimer = setInterval(() => {
    const idleDuration = Date.now() - lastActivityTime;
    
    if (idleDuration >= timeoutMs && idleEventListeners.onIdle) {
      idleEventListeners.onIdle({
        idleDuration,
        timeoutMs,
      });
    }
  }, 30000); // Check every 30 seconds
}

export function stopIdleDetection() {
  if (idleTimer) {
    clearInterval(idleTimer);
    idleTimer = null;
  }
  
  idleEventListeners = {
    onIdle: null,
    onActive: null,
  };
}

// Initialize session management
export async function initSessionManagement(options = {}) {
  // Merge options with default config
  Object.assign(SESSION_CONFIG, options);
  
  // Initialize broadcast channel
  initBroadcastChannel();
  
  // Check initial session
  const sessionInfo = await checkSession();
  
  if (sessionInfo.isValid) {
    // Start periodic checking
    startPeriodicSessionCheck();
    
    // Setup warning timer
    setupSessionWarning();
  }
  
  return sessionInfo;
}

// Check if current route is sensitive
export function isSensitiveRoute(routeName) {
  return SESSION_CONFIG.sensitiveRoutes.some(
    sensitive => routeName?.toLowerCase().includes(sensitive.toLowerCase())
  );
}

// Handle navigation to sensitive route
export async function handleSensitiveRouteNavigation(routeName) {
  if (isSensitiveRoute(routeName)) {
    // Validate session before allowing access
    const sessionInfo = await checkSession();
    
    if (!sessionInfo.isValid) {
      emitEvent('sessionRequired', { route: routeName });
      return false;
    }
  }
  
  return true;
}

// Request queue helper for API calls
export function withSessionCheck(apiCall) {
  return queueRequest(async () => {
    // Check session before making request
    const sessionInfo = await checkSession();
    
    if (!sessionInfo.isValid) {
      throw new Error('Session expired');
    }
    
    return apiCall();
  });
}

// Default session event handlers
export function setupDefaultSessionHandlers(onExpired, onWarning, onError) {
  if (onExpired) {
    onSessionEvent('sessionExpired', onExpired);
  }
  
  if (onWarning) {
    onSessionEvent('sessionWarning', onWarning);
  }
  
  if (onError) {
    onSessionEvent('sessionCheckFailed', onError);
  }
}

// Export session state getter for components
export { sessionState as _sessionState };
