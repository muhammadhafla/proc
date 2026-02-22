// DataTable Component

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
export function createDataTable({ columns, data, actions = {}, onEdit, onDelete, onAction }) {
  const container = document.createElement('div');
  container.className = 'overflow-x-auto';
  
  if (!data || data.length === 0) {
    container.innerHTML = `
      <div class="text-center py-12 text-gray-500 dark:text-gray-400">
        <svg class="w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/>
        </svg>
        <p>No data available</p>
      </div>
    `;
    return container;
  }
  
  const table = document.createElement('table');
  table.className = 'min-w-full divide-y divide-gray-200 dark:divide-gray-700';
  
  // Table header
  const thead = document.createElement('thead');
  thead.className = 'bg-gray-50 dark:bg-gray-900';
  
  const headerRow = document.createElement('tr');
  columns.forEach(col => {
    const th = document.createElement('th');
    th.className = 'px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider';
    th.textContent = col.label;
    headerRow.appendChild(th);
  });
  
  // Add actions column header if actions are defined
  if (Object.keys(actions).length > 0) {
    const th = document.createElement('th');
    th.className = 'px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider';
    th.textContent = 'Actions';
    headerRow.appendChild(th);
  }
  
  thead.appendChild(headerRow);
  table.appendChild(thead);
  
  // Table body
  const tbody = document.createElement('tbody');
  tbody.className = 'bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700';
  
  data.forEach((row, index) => {
    const tr = document.createElement('tr');
    tr.className = index % 2 === 0 ? 'hover:bg-gray-50 dark:hover:bg-gray-700/50' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50';
    
    columns.forEach(col => {
      const td = document.createElement('td');
      td.className = 'px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100';
      
      if (col.render) {
        td.innerHTML = col.render(row[col.key], row);
      } else {
        td.textContent = row[col.key] ?? '-';
      }
      
      tr.appendChild(td);
    });
    
    // Add actions
    if (Object.keys(actions).length > 0) {
      const td = document.createElement('td');
      td.className = 'px-6 py-4 whitespace-nowrap text-right text-sm font-medium';
      
      const actionBtns = document.createElement('div');
      actionBtns.className = 'flex items-center justify-end gap-2';
      
      if (actions.edit && onEdit) {
        const editBtn = document.createElement('button');
        editBtn.className = 'p-2 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors';
        editBtn.title = 'Edit';
        editBtn.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>`;
        editBtn.addEventListener('click', () => onEdit(row));
        actionBtns.appendChild(editBtn);
      }
      
      if (actions.delete && onDelete) {
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'p-2 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors';
        deleteBtn.title = 'Delete';
        deleteBtn.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>`;
        deleteBtn.addEventListener('click', () => onDelete(row));
        actionBtns.appendChild(deleteBtn);
      }
      
      // Custom actions
      if (actions.custom && onAction) {
        actions.custom.forEach(action => {
          const btn = document.createElement('button');
          btn.className = `p-2 ${action.class || 'text-gray-600 hover:text-gray-800'} rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors`;
          btn.title = action.label;
          btn.innerHTML = action.icon || '';
          btn.addEventListener('click', () => onAction(action.id, row));
          actionBtns.appendChild(btn);
        });
      }
      
      td.appendChild(actionBtns);
      tr.appendChild(td);
    }
    
    tbody.appendChild(tr);
  });
  
  table.appendChild(tbody);
  container.appendChild(table);
  
  return container;
}

/**
 * Create card list view (alternative to table)
 */
export function createCardList({ items, renderCard, onEdit, onDelete }) {
  const container = document.createElement('div');
  container.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4';
  
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
        editBtn.className = 'btn btn-secondary flex-1';
        editBtn.textContent = 'Edit';
        editBtn.addEventListener('click', () => onEdit(item));
        actions.appendChild(editBtn);
      }
      
      if (onDelete) {
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn btn-danger flex-1';
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
  container.className = 'flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700';
  
  container.innerHTML = `
    <div class="text-sm text-gray-700 dark:text-gray-300">
      Page <span class="font-medium">${currentPage}</span> of <span class="font-medium">${totalPages}</span>
    </div>
    <div class="flex gap-2">
      <button class="pagination-prev btn btn-secondary" ${currentPage === 1 ? 'disabled' : ''}>
        Previous
      </button>
      <button class="pagination-next btn btn-secondary" ${currentPage >= totalPages ? 'disabled' : ''}>
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
