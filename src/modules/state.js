// Centralized State Management Module
// Provides reactive state management with event emission

// Simple event emitter implementation
class EventEmitter {
  constructor() {
    this.listeners = new Map();
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    
    // Return unsubscribe function
    return () => {
      this.listeners.get(event).delete(callback);
    };
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }
}

// Centralized app state
class AppState extends EventEmitter {
  constructor() {
    super();
    this._state = {
      user: null,
      organization: null,
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
      isSyncing: false,
    };
  }

  /**
   * Get a state value
   * @param {string} key - State key
   * @returns {*} State value
   */
  get(key) {
    return this._state[key];
  }

  /**
   * Set a state value
   * @param {string} key - State key
   * @param {*} value - New value
   */
  set(key, value) {
    const oldValue = this._state[key];
    if (oldValue === value) return;
    
    this._state[key] = value;
    this.emit('change', { key, oldValue, newValue: value });
    this.emit(`change:${key}`, { oldValue, newValue: value });
  }

  /**
   * Get all state
   * @returns {Object} Complete state object
   */
  getAll() {
    return { ...this._state };
  }

  /**
   * Set multiple state values at once
   * @param {Object} state - Object with state key-value pairs
   */
  setMultiple(state) {
    Object.entries(state).forEach(([key, value]) => {
      this.set(key, value);
    });
  }
}

// Create singleton instance
export const appState = new AppState();

// Convenience getters for common state
export const getUser = () => appState.get('user');
export const getOrganization = () => appState.get('organization');
export const isOnline = () => appState.get('isOnline');
export const isSyncing = () => appState.get('isSyncing');

// Convenience setters
export const setUser = (user) => appState.set('user', user);
export const setOrganization = (organization) => appState.set('organization', organization);
export const setOnline = (isOnline) => appState.set('isOnline', isOnline);
export const setSyncing = (isSyncing) => appState.set('isSyncing', isSyncing);

// Subscribe to specific state changes
export const onUserChange = (callback) => appState.on('change:user', callback);
export const onOrganizationChange = (callback) => appState.on('change:organization', callback);
export const onOnlineChange = (callback) => appState.on('change:isOnline', callback);
export const onSyncingChange = (callback) => appState.on('change:isSyncing', callback);

// Subscribe to any state change
export const onStateChange = (callback) => appState.on('change', callback);
