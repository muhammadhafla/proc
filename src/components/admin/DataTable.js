// DataTable Component

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
  if (text == null) return '';
  const div = document.createElement('div');
  div.textContent = String(text);
  return div.innerHTML;
}

/**
 * Create a data table
 * @param {Object} options - Table options
 * @param {Array} options.columns - Column definitions [{key, label, render?}]
 * @param {Array} options.data - Data rows
 * @param {Object} options.actions - Action buttons config
 * @param {Function} options.onEdit - Edit handler
 * @param {Function} options.onDelete - Delete handler
 * @param {Function} options.onAction - Custom action handler
 * @returns {HTMLElement} - Table element
 */
export function createDataTable({ columns, data, actions = {}, onEdit, onDelete, onAction, useCardsOnMobile = true }) {
  const container = document.createElement('div');
  
  // Use card view on mobile by default
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const shouldUseCards = useCardsOnMobile && isMobile;
  
  if (!data || data.length === 0) {
    container.className = 'text-center py-12 text-gray-500 dark:text-gray-400';
    container.innerHTML = `
      <svg class="w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/>
      </svg>
      <p>No data available</p>
    `;
    return container;
  }
  
  // If mobile and useCardsOnMobile is true, render card view
  if (shouldUseCards) {
    return createCardView({ columns, data, actions, onEdit, onDelete, onAction });
  }
  
  container.className = 'overflow-x-auto -mx-4 sm:mx-0';
  
  // Make table scrollable horizontally with better touch support
  container.innerHTML = `
    <div class="overflow-x-auto touch-scroll">
      <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead class="bg-gray-50 dark:bg-gray-900">
          <tr>
            ${columns.map(col => `
              <th class="px-4 lg:px-6 py-3 text-left text-xs lg:text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                ${col.label}
              </th>
            `).join('')}
            ${Object.keys(actions).length > 0 ? `
              <th class="px-4 lg:px-6 py-3 text-right text-xs lg:text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Actions
              </th>
            ` : ''}
          </tr>
        </thead>
        <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
          ${data.map((row, index) => `
            <tr class="hover:bg-gray-50 dark:hover:bg-gray-700/50">
              ${columns.map(col => `
                <td class="px-4 lg:px-6 py-3 lg:py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100" data-key="${col.key}">
                  <!-- Content set via JavaScript to prevent XSS -->
                </td>
              `).join('')}
              ${Object.keys(actions).length > 0 ? `
                <td class="px-4 lg:px-6 py-3 lg:py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div class="flex items-center justify-end gap-1 lg:gap-2">
                    ${actions.edit && onEdit ? `
                      <button class="edit-btn p-2 lg:p-1.5 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors" title="Edit" data-index="${index}">
                        <svg class="w-4 h-4 lg:w-4 lg:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                        </svg>
                      </button>
                    ` : ''}
                    ${actions.delete && onDelete ? `
                      <button class="delete-btn p-2 lg:p-1.5 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" title="Delete" data-index="${index}">
                        <svg class="w-4 h-4 lg:w-4 lg:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                        </svg>
                      </button>
                    ` : ''}
                  </div>
                </td>
              ` : ''}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
  
  // Add event handlers
  if (onEdit) {
    container.querySelectorAll('.edit-btn').forEach((btn, idx) => {
      btn.addEventListener('click', () => onEdit(data[idx]));
    });
  }
  
  if (onDelete) {
    container.querySelectorAll('.delete-btn').forEach((btn, idx) => {
      btn.addEventListener('click', () => onDelete(data[idx]));
    });
  }
  
  // Populate cell content safely to prevent XSS
  container.querySelectorAll('tbody tr').forEach((row, rowIndex) => {
    const rowData = data[rowIndex];
    columns.forEach(col => {
      const cell = row.querySelector(`td[data-key="${col.key}"]`);
      if (cell) {
        const value = rowData[col.key];
        if (col.render) {
          // Render function may return HTML - trust it since it's intentional
          cell.innerHTML = col.render(value, rowData);
        } else {
          // Use textContent for raw data to prevent XSS
          cell.textContent = value ?? '-';
        }
      }
    });
  });
  
  return container;
}

/**
 * Create card view for mobile
 */
function createCardView({ columns, data, actions, onEdit, onDelete, onAction }) {
  const container = document.createElement('div');
  container.className = 'space-y-4';
  
  data.forEach((row, index) => {
    const card = document.createElement('div');
    card.className = 'bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4';
    
    let cardContent = '';
    
    columns.forEach((col, colIndex) => {
      // Use escapeHtml for non-rendered values to prevent XSS
      let value = col.render ? col.render(row[col.key], row) : escapeHtml(row[col.key] ?? '-');
      
      // Wrap ID columns in code tags if not already
      if (col.key === 'id' && !value.includes('<')) {
        value = `<code class="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">${value?.substring(0, 8)}...</code>`;
      }
      
      cardContent += `
        <div class="${colIndex === 0 ? '' : 'mt-2'}">
          <span class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">${escapeHtml(col.label)}</span>
          <div class="text-sm text-gray-900 dark:text-gray-100 mt-0.5">${value}</div>
        </div>
      `;
    });
    
    // Add action buttons
    if (Object.keys(actions).length > 0) {
      cardContent += `
        <div class="flex items-center gap-2 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          ${actions.edit && onEdit ? `
            <button class="edit-btn flex-1 btn btn-secondary text-sm py-2.5" data-index="${index}">
              <svg class="w-4 h-4 mr-1.5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
              </svg>
              Edit
            </button>
          ` : ''}
          ${actions.delete && onDelete ? `
            <button class="delete-btn flex-1 btn btn-danger text-sm py-2.5" data-index="${index}">
              <svg class="w-4 h-4 mr-1.5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
              </svg>
              Delete
            </button>
          ` : ''}
        </div>
      `;
    }
    
    card.innerHTML = cardContent;
    container.appendChild(card);
  });
  
  // Add event handlers
  if (onEdit) {
    container.querySelectorAll('.edit-btn').forEach((btn) => {
      const idx = parseInt(btn.dataset.index);
      btn.addEventListener('click', () => onEdit(data[idx]));
    });
  }
  
  if (onDelete) {
    container.querySelectorAll('.delete-btn').forEach((btn) => {
      const idx = parseInt(btn.dataset.index);
      btn.addEventListener('click', () => onDelete(data[idx]));
    });
  }
  
  return container;
}
export function createCardList({ items, renderCard, onEdit, onDelete }) {
  const container = document.createElement('div');
  container.className = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4';
  
  if (!items || items.length === 0) {
    container.innerHTML = `
      <div class="col-span-full text-center py-12 text-gray-500 dark:text-gray-400">
        <p>No data available</p>
      </div>
    `;
    return container;
  }
  
  items.forEach(item => {
    const card = renderCard(item);
    
    // Add action buttons if needed
    if (onEdit || onDelete) {
      const actions = document.createElement('div');
      actions.className = 'flex items-center gap-2 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700';
      
      if (onEdit) {
        const editBtn = document.createElement('button');
        editBtn.className = 'btn btn-secondary flex-1 text-sm py-2.5';
        editBtn.textContent = 'Edit';
        editBtn.addEventListener('click', () => onEdit(item));
        actions.appendChild(editBtn);
      }
      
      if (onDelete) {
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn btn-danger flex-1 text-sm py-2.5';
        deleteBtn.textContent = 'Delete';
        deleteBtn.addEventListener('click', () => onDelete(item));
        actions.appendChild(deleteBtn);
      }
      
      card.appendChild(actions);
    }
    
    container.appendChild(card);
  });
  
  return container;
}

/**
 * Create pagination controls
 */
export function createPagination({ currentPage, totalPages, onPageChange }) {
  const container = document.createElement('div');
  container.className = 'flex flex-col sm:flex-row items-center justify-between gap-4 px-4 lg:px-6 py-4 border-t border-gray-200 dark:border-gray-700';
  
  container.innerHTML = `
    <div class="text-sm text-gray-700 dark:text-gray-300 order-2 sm:order-1">
      Page <span class="font-medium">${currentPage}</span> of <span class="font-medium">${totalPages}</span>
    </div>
    <div class="flex gap-2 order-1 sm:order-2">
      <button class="pagination-prev btn btn-secondary text-sm py-2" ${currentPage === 1 ? 'disabled' : ''}>
        Previous
      </button>
      <button class="pagination-next btn btn-secondary text-sm py-2" ${currentPage >= totalPages ? 'disabled' : ''}>
        Next
      </button>
    </div>
  `;
  
  container.querySelector('.pagination-prev')?.addEventListener('click', () => {
    if (currentPage > 1) onPageChange(currentPage - 1);
  });
  
  container.querySelector('.pagination-next')?.addEventListener('click', () => {
    if (currentPage < totalPages) onPageChange(currentPage + 1);
  });
  
  return container;
}
