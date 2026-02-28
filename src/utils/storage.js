/**
 * Secure Storage Utility
 * Uses sessionStorage for sensitive data (better XSS protection)
 * Falls back to localStorage for backward compatibility with migration
 */

const STORAGE_KEYS = {
  USER: 'user',
  ORGANIZATION: 'organization',
  SESSION_ACTION: 'session_action',
  INTENDED_ROUTE: 'intendedRoute',
};

/**
 * Get data from secure storage
 * Prioritizes sessionStorage, falls back to localStorage
 * @param {string} key - Storage key
 * @returns {any|null} Parsed data or null
 */
export function getSecure(key) {
  try {
    // Try sessionStorage first (more secure)
    const sessionData = sessionStorage.getItem(key);
    if (sessionData) {
      return JSON.parse(sessionData);
    }

    // Fallback to localStorage for backward compatibility
    const localData = localStorage.getItem(key);
    if (localData) {
      const parsed = JSON.parse(localData);
      // Migrate to sessionStorage
      sessionStorage.setItem(key, localData);
      localStorage.removeItem(key);
      return parsed;
    }
    return null;
  } catch (e) {
    console.warn('Storage read failed:', e);
    return null;
  }
}

/**
 * Set data to secure storage (sessionStorage)
 * @param {string} key - Storage key
 * @param {any} value - Value to store
 */
export function setSecure(key, value) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error('sessionStorage failed for key:', key, e);
    // Do not fall back to localStorage for sensitive data - this defeats XSS protection
  }
}

/**
 * Remove data from all storages
 * @param {string} key - Storage key
 */
export function removeSecure(key) {
  sessionStorage.removeItem(key);
  localStorage.removeItem(key);
}

/**
 * Clear all secure storage
 */
export function clearSecure() {
  sessionStorage.clear();
  // Don't clear localStorage entirely - just known keys
  Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
}

/**
 * Check if running in secure context (HTTPS or localhost)
 */
export function isSecureContext() {
  return window.isSecureContext;
}

// Named exports for specific common operations
export const storage = {
  get: getSecure,
  set: setSecure,
  remove: removeSecure,
  clear: clearSecure,
  keys: STORAGE_KEYS,
};

export default storage;
