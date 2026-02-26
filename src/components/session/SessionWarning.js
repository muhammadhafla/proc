// Session Warning Component
// Shows countdown before session expires

let warningElement = null;
let countdownInterval = null;
let onExtendSession = null;
let onLogout = null;

/**
 * Format time remaining
 * @param {number} seconds - Seconds remaining
 * @returns {string} Formatted time string
 */
function formatTime(seconds) {
  if (seconds <= 0) return '0:00';
  
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  
  if (mins >= 60) {
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return `${hours}:${remainingMins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Show session warning with countdown
 * @param {Object} options - Warning options
 * @param {number} options.expiresInSeconds - Seconds until expiry
 * @param {Date} options.expiresAt - Expiry timestamp
 * @param {Function} options.onExtend - Callback to extend session
 * @param {Function} options.onLogout - Callback to logout
 */
export function showSessionWarning(options = {}) {
  const { 
    expiresInSeconds = 0,
    expiresAt = null,
    onExtend = null,
    onLogout: handleLogout = null 
  } = options;

  onExtendSession = onExtend;
  onLogout = handleLogout;

  // Remove existing warning if any
  hideSessionWarning();

  // Calculate initial time remaining
  let timeRemaining = expiresInSeconds;
  if (expiresAt) {
    timeRemaining = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
  }

  // Create warning container
  warningElement = document.createElement('div');
  warningElement.id = 'session-warning';
  warningElement.className = 'fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 animate-slide-up';

  // Initial render
  renderWarningContent(timeRemaining);

  // Add to DOM
  document.body.appendChild(warningElement);

  // Start countdown
  countdownInterval = setInterval(() => {
    timeRemaining--;
    
    if (timeRemaining <= 0) {
      // Time's up - session expired, trigger logout
      hideSessionWarning();
      if (onLogout) {
        onLogout();
      }
      return;
    }
    
    updateCountdown(timeRemaining);
  }, 1000);

  // Store time remaining for external access
  warningElement._timeRemaining = timeRemaining;

  return warningElement;
}

/**
 * Render warning content
 * @param {number} timeRemaining - Seconds remaining
 */
function renderWarningContent(timeRemaining) {
  const isUrgent = timeRemaining <= 60;
  const urgentClass = isUrgent ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
  const iconColor = isUrgent ? 'text-red-500' : 'text-yellow-500';
  const timeColor = isUrgent ? 'text-red-600 dark:text-red-400' : 'text-yellow-600 dark:text-yellow-400';

  warningElement.innerHTML = `
    <div class="flex items-center gap-3 px-4 py-3 rounded-lg border ${urgentClass} shadow-lg backdrop-blur-sm max-w-sm">
      <!-- Icon -->
      <div class="flex-shrink-0 ${iconColor}">
        ${isUrgent ? 
          `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>` :
          `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>`
        }
      </div>

      <!-- Content -->
      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium ${isUrgent ? 'text-red-800 dark:text-red-200' : 'text-yellow-800 dark:text-yellow-200'}">
          ${isUrgent ? 'Session expiring soon!' : 'Session will expire'}
        </p>
        <p class="text-xs ${isUrgent ? 'text-red-600 dark:text-red-300' : 'text-yellow-600 dark:text-yellow-300'}">
          Time remaining: <span class="font-mono font-semibold ${timeColor}">${formatTime(timeRemaining)}</span>
        </p>
      </div>

      <!-- Action buttons -->
      <div class="flex-shrink-0 flex gap-2">
        <button 
          id="session-warning-extend"
          class="px-3 py-1.5 text-xs font-medium rounded-md bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          Stay Logged In
        </button>
        <button 
          id="session-warning-logout"
          class="px-3 py-1.5 text-xs font-medium rounded-md text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
        >
          Logout
        </button>
      </div>
    </div>
  `;

  // Add event listeners
  const extendBtn = warningElement.querySelector('#session-warning-extend');
  const logoutBtn = warningElement.querySelector('#session-warning-logout');

  extendBtn?.addEventListener('click', handleExtendClick);
  logoutBtn?.addEventListener('click', handleLogoutClick);
}

/**
 * Update countdown display
 * @param {number} timeRemaining - Seconds remaining
 */
function updateCountdown(timeRemaining) {
  if (!warningElement) return;

  const isUrgent = timeRemaining <= 60;
  const timeDisplay = warningElement.querySelector('span.font-mono');
  
  if (timeDisplay) {
    timeDisplay.textContent = formatTime(timeRemaining);
    
    // Update urgency styling
    if (isUrgent) {
      timeDisplay.classList.add('text-red-600', 'dark:text-red-400');
      timeDisplay.classList.remove('text-yellow-600', 'dark:text-yellow-400');
      
      const container = warningElement.querySelector('.border');
      if (container) {
        container.classList.remove('bg-yellow-50', 'dark:bg-yellow-900/20', 'border-yellow-200', 'dark:border-yellow-800');
        container.classList.add('bg-red-50', 'dark:bg-red-900/20', 'border-red-200', 'dark:border-red-800');
      }
    }
  }

  warningElement._timeRemaining = timeRemaining;
}

/**
 * Handle extend session click
 */
async function handleExtendClick() {
  const extendBtn = warningElement.querySelector('#session-warning-extend');
  extendBtn.disabled = true;
  extendBtn.innerHTML = '<span class="animate-pulse">Extending...</span>';

  try {
    if (onExtendSession) {
      const result = await onExtendSession();
      
      if (result.success) {
        hideSessionWarning();
      } else {
        extendBtn.disabled = false;
        extendBtn.textContent = 'Stay Logged In';
        // Show brief error feedback
        showErrorFeedback(result.error || 'Failed to extend session');
      }
    }
  } catch (error) {
    console.error('Failed to extend session:', error);
    extendBtn.disabled = false;
    extendBtn.textContent = 'Stay Logged In';
    showErrorFeedback(error.message || 'Failed to extend session');
  }
}

/**
 * Show error feedback on the warning
 * @param {string} message - Error message
 */
function showErrorFeedback(message) {
  if (!warningElement) return;
  
  // Add error class to container
  const container = warningElement.querySelector('.border');
  if (container) {
    container.classList.add('border-red-300', 'dark:border-red-700', 'bg-red-50', 'dark:bg-red-900/20');
    container.classList.remove('bg-yellow-50', 'dark:bg-yellow-900/20', 'border-yellow-200', 'dark:border-yellow-800');
  }
  
  // Update message
  const messageEl = warningElement.querySelector('.text-xs');
  if (messageEl) {
    // Use textContent to prevent XSS
    const span = document.createElement('span');
    span.className = 'text-red-600 dark:text-red-400';
    span.textContent = message;
    messageEl.innerHTML = '';
    messageEl.appendChild(span);
  }
  
  // Auto-hide error after 3 seconds
  setTimeout(() => {
    if (warningElement) {
      renderWarningContent(warningElement._timeRemaining || 0);
    }
  }, 3000);
}

/**
 * Handle logout click
 */
function handleLogoutClick() {
  if (onLogout) {
    onLogout();
  }
  hideSessionWarning();
}

/**
 * Hide session warning
 */
export function hideSessionWarning() {
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }

  if (warningElement) {
    warningElement.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => {
      if (warningElement && warningElement.parentNode) {
        warningElement.parentNode.removeChild(warningElement);
      }
      warningElement = null;
    }, 200);
  }
}

/**
 * Get current time remaining
 * @returns {number|null} Seconds remaining
 */
export function getTimeRemaining() {
  return warningElement?._timeRemaining ?? null;
}

/**
 * Check if session warning is visible
 * @returns {boolean}
 */
export function isSessionWarningVisible() {
  return !!warningElement;
}
