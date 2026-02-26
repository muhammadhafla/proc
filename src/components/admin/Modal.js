// Modal Component
let activeModal = null;

/**
 * Create and show a modal
 * @param {Object} options - Modal options
 * @param {string} options.title - Modal title
 * @param {string} options.content - HTML content or element
 * @param {Array} options.buttons - Array of button configs [{label, class, handler}]
 * @param {string} options.size - 'sm', 'md', 'lg', 'xl'
 * @returns {HTMLElement} - The modal element
 */
export function showModal({ title, content, buttons = [], size = 'md' }) {
  // Close existing modal if any
  if (activeModal) {
    closeModal();
  }
  
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in';
  
  const sizes = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    full: 'max-w-4xl'
  };
  
  const modal = document.createElement('div');
  // Mobile: full width at bottom, desktop: centered
  modal.className = `modal-content bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-xl shadow-2xl w-full ${sizes[size]} max-h-[85vh] sm:max-h-[90vh] overflow-hidden flex flex-col`;
  
  // Header
  const header = document.createElement('div');
  header.className = 'flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0';
  header.innerHTML = `
    <h3 class="text-lg font-semibold text-gray-900 dark:text-white">${title}</h3>
    <button class="modal-close p-1.5 sm:p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" aria-label="Close">
      <svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
      </svg>
    </button>
  `;
  
  // Body
  const body = document.createElement('div');
  body.className = 'modal-body flex-1 overflow-y-auto px-4 sm:px-6 py-4';
  if (typeof content === 'string') {
    body.innerHTML = content;
  } else if (content instanceof HTMLElement) {
    body.appendChild(content);
  }
  
  // Footer - stack buttons on mobile
  const footer = document.createElement('div');
  footer.className = 'flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 px-4 sm:px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0';
  
  buttons.forEach(btn => {
    const button = document.createElement('button');
    button.className = btn.class || 'btn btn-secondary w-full sm:w-auto';
    button.textContent = btn.label;
    if (btn.handler) {
      button.addEventListener('click', btn.handler);
    }
    footer.appendChild(button);
  });
  
  modal.appendChild(header);
  modal.appendChild(body);
  if (buttons.length > 0) {
    modal.appendChild(footer);
  }
  
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';
  
  // Event handlers
  const closeHandler = () => closeModal();
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeHandler();
  });
  header.querySelector('.modal-close').addEventListener('click', closeHandler);
  
  activeModal = { overlay, modal, close: closeHandler };
  
  // Focus first input if exists
  setTimeout(() => {
    const firstInput = body.querySelector('input, select, textarea');
    if (firstInput) firstInput.focus();
  }, 100);
  
  return activeModal;
}

/**
 * Close current modal
 */
export function closeModal() {
  if (activeModal) {
    document.body.style.overflow = '';
    activeModal.overlay.classList.add('opacity-0');
    setTimeout(() => {
      if (activeModal.overlay.parentNode) {
        activeModal.overlay.parentNode.removeChild(activeModal.overlay);
      }
      activeModal = null;
    }, 200);
  }
}

/**
 * Show confirm dialog
 * @param {string} title - Dialog title
 * @param {string} message - Dialog message
 * @param {string} confirmText - Confirm button text
 * @param {string} confirmClass - Confirm button class
 * @returns {Promise<boolean>} - True if confirmed
 */
export function showConfirm(title, message, confirmText = 'Confirm', confirmClass = 'btn btn-danger') {
  return new Promise((resolve) => {
    const content = document.createElement('p');
    content.className = 'text-gray-600 dark:text-gray-400';
    content.textContent = message;
    
    showModal({
      title,
      content,
      size: 'sm',
      buttons: [
        {
          label: 'Cancel',
          class: 'btn btn-secondary',
          handler: () => { closeModal(); resolve(false); }
        },
        {
          label: confirmText,
          class: confirmClass,
          handler: () => { closeModal(); resolve(true); }
        }
      ]
    });
  });
}

/**
 * Show form modal
 * @param {Object} options - Form modal options
 * @param {string} options.title - Modal title
 * @param {Array} options.fields - Array of field configs
 * @param {Object} options.initialData - Initial form data
 * @param {Function} options.onSubmit - Submit handler
 * @returns {void}
 */
export function showFormModal({ title, fields, initialData = {}, onSubmit }) {
  const form = document.createElement('form');
  form.className = 'space-y-4';
  
  fields.forEach(field => {
    const fieldContainer = document.createElement('div');
    
    const label = document.createElement('label');
    label.className = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5';
    label.textContent = field.label;
    label.htmlFor = field.id;
    
    let input;
    const value = initialData[field.name] || '';
    
    if (field.type === 'select') {
      input = document.createElement('select');
      input.className = 'input py-2.5 text-base';
      input.id = field.id;
      input.name = field.name;
      input.required = field.required;
      
      field.options.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt.value;
        option.textContent = opt.label;
        if (opt.value === value) option.selected = true;
        input.appendChild(option);
      });
    } else if (field.type === 'textarea') {
      input = document.createElement('textarea');
      input.className = 'input min-h-[100px] py-2.5 text-base';
      input.id = field.id;
      input.name = field.name;
      input.required = field.required;
      input.value = value;
      if (field.placeholder) input.placeholder = field.placeholder;
    } else {
      input = document.createElement('input');
      input.className = 'input py-2.5 text-base';
      input.type = field.type || 'text';
      input.id = field.id;
      input.name = field.name;
      input.required = field.required;
      input.value = value;
      if (field.placeholder) input.placeholder = field.placeholder;
    }
    
    fieldContainer.appendChild(label);
    fieldContainer.appendChild(input);
    form.appendChild(fieldContainer);
  });
  
  showModal({
    title,
    content: form,
    size: 'md',
    buttons: [
      {
        label: 'Cancel',
        class: 'btn btn-secondary w-full sm:w-auto',
        handler: closeModal
      },
      {
        label: 'Save',
        class: 'btn btn-primary w-full sm:w-auto',
        handler: () => {
          const formData = new FormData(form);
          const data = {};
          fields.forEach(field => {
            data[field.name] = formData.get(field.name);
          });
          onSubmit(data);
        }
      }
    ]
  });
}
