// Toast Notification Component
let toastContainer = null;

/**
 * Create toast container if not exists
 */
function getToastContainer() {
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.className = 'fixed top-4 right-4 z-50 flex flex-col gap-2';
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
}

/**
 * Show toast notification
 * @param {string} message - Toast message
 * @param {string} type - Toast type: 'success', 'error', 'warning', 'info'
 * @param {number} duration - Duration in ms (default: 3000)
 */
export function showToast(message, type = 'info', duration = 3000) {
  const container = getToastContainer();
  
  const toast = document.createElement('div');
  toast.className = `toast flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg transform transition-all duration-300 animate-slide-in min-w-[280px] max-w-md`;
  
  // Style based on type
  const styles = {
    success: 'bg-green-600 text-white',
    error: 'bg-red-600 text-white',
    warning: 'bg-yellow-600 text-white',
    info: 'bg-blue-600 text-white'
  };
  
  const icons = {
    success: '<svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>',
    error: '<svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>',
    warning: '<svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>',
    info: '<svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>'
  };
  
  toast.classList.add(...styles[type].split(' '));
  toast.innerHTML = `
    <span>${icons[type]}</span>
    <span class="flex-1">${message}</span>
    <button class="toast-close opacity-70 hover:opacity-100" aria-label="Close">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
      </svg>
    </button>
  `;
  
  // Close button handler
  const closeBtn = toast.querySelector('.toast-close');
  closeBtn.addEventListener('click', () => removeToast(toast));
  
  container.appendChild(toast);
  
  // Auto remove after duration
  setTimeout(() => removeToast(toast), duration);
  
  return toast;
}

/**
 * Remove toast from DOM
 */
function removeToast(toast) {
  if (toast && toast.parentNode) {
    toast.classList.add('opacity-0', 'translate-x-full');
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }
}

/**
 * Show success toast
 */
export const toastSuccess = (message, duration) => showToast(message, 'success', duration);

/**
 * Show error toast
 */
export const toastError = (message, duration) => showToast(message, 'error', duration);

/**
 * Show warning toast
 */
export const toastWarning = (message, duration) => showToast(message, 'warning', duration);

/**
 * Show info toast
 */
export const toastInfo = (message, duration) => showToast(message, 'info', duration);
