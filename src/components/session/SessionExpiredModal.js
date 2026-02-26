// Session Expired Modal Component
// Non-dismissible modal that forces user to login when session expires

let modalElement = null;
let cleanupCallback = null;

/**
 * Create session expired modal
 * @param {Object} options - Modal options
 * @param {string} options.reason - Reason for session expiry
 * @param {string} options.redirectBack - Route to redirect after login
 * @param {Function} options.onAction - Callback when action button is clicked
 */
export function showSessionExpiredModal(options = {}) {
  const { 
    reason = 'Session has expired. Please log in again to continue.', 
    redirectBack = null,
    onAction = null 
  } = options;

  // Remove existing modal if any
  hideSessionExpiredModal();

  // Create modal container
  modalElement = document.createElement('div');
  modalElement.id = 'session-expired-modal';
  modalElement.className = 'fixed inset-0 z-[9999] flex items-center justify-center';
  modalElement.setAttribute('role', 'dialog');
  modalElement.setAttribute('aria-modal', 'true');
  modalElement.setAttribute('aria-labelledby', 'session-expired-title');

  // Get current route for redirect
  const currentRoute = redirectBack || window.location.hash.replace('#', '') || 'home';

  // Modal content
  modalElement.innerHTML = `
    <div class="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>
    <div class="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden animate-modal-in">
      <!-- Header with warning icon -->
      <div class="bg-red-50 dark:bg-red-900/30 px-6 py-4 flex items-center gap-4">
        <div class="flex-shrink-0 w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/50 flex items-center justify-center">
          <svg class="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
          </svg>
        </div>
        <div>
          <h2 id="session-expired-title" class="text-lg font-semibold text-red-800 dark:text-red-200">
            Session Expired
          </h2>
          <p class="text-sm text-red-600 dark:text-red-300">
            Your session has ended
          </p>
        </div>
      </div>

      <!-- Body -->
      <div class="px-6 py-5">
        <p class="text-gray-700 dark:text-gray-300 mb-4">
          ${reason}
        </p>
        
        <div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 mb-4">
          <div class="flex items-start gap-2">
            <svg class="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <p class="text-sm text-gray-600 dark:text-gray-400">
              For security purposes, you will be redirected to the login page. Any unsaved changes may be lost.
            </p>
          </div>
        </div>

        <div class="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
          </svg>
          <span>Redirect to: <strong class="text-gray-700 dark:text-gray-300">${currentRoute}</strong></span>
        </div>
      </div>

      <!-- Footer with action button -->
      <div class="px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-700">
        <button 
          id="session-expired-action-btn"
          class="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-medium rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"/>
          </svg>
          <span>Log In Again</span>
        </button>
      </div>
    </div>
  `;

  // Add animation styles
  const style = document.createElement('style');
  style.textContent = `
    @keyframes modal-in {
      from {
        opacity: 0;
        transform: scale(0.95) translateY(-10px);
      }
      to {
        opacity: 1;
        transform: scale(1) translateY(0);
      }
    }
    .animate-modal-in {
      animation: modal-in 0.3s ease-out forwards;
    }
  `;
  modalElement.appendChild(style);

  // Add to DOM
  document.body.appendChild(modalElement);
  document.body.style.overflow = 'hidden';
  
  // Prevent backdrop click from dismissing modal (security feature)
  const backdrop = modalElement.querySelector('.absolute');
  backdrop.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
  });

  // Add event listener to action button
  const actionBtn = modalElement.querySelector('#session-expired-action-btn');
  
  const handleAction = async () => {
    // Disable button to prevent double clicks
    actionBtn.disabled = true;
    actionBtn.classList.add('opacity-50', 'cursor-not-allowed');
    actionBtn.innerHTML = `
      <svg class="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      <span>Cleaning up...</span>
    `;

    try {
      // Call custom action callback if provided
      if (onAction) {
        await onAction();
      }
    } finally {
      // Redirect to login with redirect back parameter
      const loginUrl = `#login?redirect=${encodeURIComponent(currentRoute)}&reason=session_expired`;
      window.location.hash = loginUrl;
    }
  };

  actionBtn.addEventListener('click', handleAction);

  // Store cleanup callback
  cleanupCallback = () => {
    actionBtn.removeEventListener('click', handleAction);
  };

  // Prevent closing with Escape key or backdrop click
  const handleKeydown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  modalElement.addEventListener('keydown', handleKeydown, true);

  // Store keydown handler for cleanup
  cleanupCallback._keydownHandler = handleKeydown;

  return modalElement;
}

/**
 * Hide session expired modal
 */
export function hideSessionExpiredModal() {
  if (modalElement) {
    // Call cleanup
    if (cleanupCallback) {
      if (cleanupCallback._keydownHandler) {
        modalElement.removeEventListener('keydown', cleanupCallback._keydownHandler, true);
      }
      cleanupCallback();
      cleanupCallback = null;
    }

    // Remove from DOM with animation
    modalElement.classList.add('opacity-0');
    setTimeout(() => {
      if (modalElement && modalElement.parentNode) {
        modalElement.parentNode.removeChild(modalElement);
      }
      modalElement = null;
      document.body.style.overflow = '';
    }, 200);
  }
}

/**
 * Check if session expired modal is visible
 */
export function isSessionExpiredModalVisible() {
  return !!modalElement;
}
