// Admin Console Page
import { appState } from '../modules/state.js';
import { router } from '../modules/router.js';
import { getCurrentUserRole, hasAdminAccess, isOwner,
  adminGetOrganizations, adminCreateOrganization, adminUpdateOrganization, adminDeleteOrganization,
  adminGetUsers, adminCreateUser, adminUpdateUser, adminDeleteUser,
  adminGetSuppliers, adminCreateSupplier, adminUpdateSupplier, adminDeleteSupplier } from '../modules/api.js';
import { createSidebar, setActiveMenuItem, openSidebar } from '../components/admin/Sidebar.js';
import { createDataTable } from '../components/admin/DataTable.js';
import { showFormModal, showConfirm } from '../components/admin/Modal.js';
import { toastSuccess, toastError } from '../components/admin/Toast.js';

let currentSection = 'suppliers';
let sidebar = null;

/**
 * Render admin console page
 */
export function renderAdmin(container) {
  const role = getCurrentUserRole();
  
  // Check access
  if (!hasAdminAccess()) {
    container.innerHTML = `
      <div class="min-h-screen flex items-center justify-center">
        <div class="text-center">
          <h1 class="text-2xl font-bold text-red-600 mb-4">Access Denied</h1>
          <p class="text-gray-600 mb-4">You don't have permission to access this page.</p>
          <button class="btn btn-primary" onclick="window.appRouter?.navigate('home')">
            Back to Home
          </button>
        </div>
      </div>
    `;
    return;
  }
  
  container.innerHTML = `
    <div class="admin-page min-h-screen bg-gray-50 dark:bg-gray-900 flex">
      <div id="admin-sidebar"></div>
      <main class="flex-1 flex flex-col overflow-hidden">
        <header class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 lg:px-6 py-3 lg:py-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <!-- Mobile menu button -->
              <button id="mobile-menu-btn" class="lg:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 -ml-2">
                <svg class="w-6 h-6 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
                </svg>
              </button>
              <div>
                <h1 class="text-lg lg:text-2xl font-bold text-gray-900 dark:text-white" id="section-title">
                  ${isOwner() ? 'Organizations' : 'Suppliers'}
                </h1>
                <p class="text-xs lg:text-sm text-gray-500 dark:text-gray-400 hidden sm:block" id="section-subtitle">
                  Manage your ${isOwner() ? 'organizations, users and suppliers' : 'suppliers and staff'}
                </p>
              </div>
            </div>
            <button id="admin-add-btn" class="btn btn-primary text-sm lg:text-base py-2 lg:py-2.5">
              <svg class="w-4 h-4 lg:w-5 lg:h-5 mr-1.5 lg:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
              </svg>
              <span class="hidden sm:inline">Add New</span>
              <span class="sm:hidden">Add</span>
            </button>
          </div>
        </header>
        <div id="admin-content" class="flex-1 overflow-auto p-4 lg:p-6">
          <!-- Content loaded here -->
        </div>
      </main>
    </div>
  `;
  
  // Create sidebar
  sidebar = createSidebar(role, (section) => {
    currentSection = section;
    loadSection(section);
  });
  
  document.getElementById('admin-sidebar').appendChild(sidebar);
  
  // Mobile menu button handler
  document.getElementById('mobile-menu-btn')?.addEventListener('click', () => {
    openSidebar();
  });
  
  // Set initial section
  currentSection = isOwner() ? 'organizations' : 'suppliers';
  if (!isOwner()) {
    // Managers don't see organizations in menu
    currentSection = 'suppliers';
  }
  setActiveMenuItem(sidebar, currentSection);
  
  // Add button handler
  document.getElementById('admin-add-btn').addEventListener('click', () => {
    handleAdd();
  });
  
  // Load initial section
  loadSection(currentSection);
}

/**
 * Load section content
 */
async function loadSection(section) {
  const titleEl = document.getElementById('section-title');
  const subtitleEl = document.getElementById('section-subtitle');
  const contentEl = document.getElementById('admin-content');
  const addBtn = document.getElementById('admin-add-btn');
  
  // Update UI
  setActiveMenuItem(sidebar, section);
  
  contentEl.innerHTML = `
    <div class="flex items-center justify-center h-full">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
    </div>
  `;
  
  try {
    switch (section) {
      case 'organizations':
        if (!isOwner()) {
          router.navigate('home');
          return;
        }
        titleEl.textContent = 'Organizations';
        subtitleEl.textContent = 'Manage organizations in the system';
        addBtn.style.display = 'block';
        await renderOrganizations();
        break;
        
      case 'users':
        if (!isOwner()) {
          router.navigate('home');
          return;
        }
        titleEl.textContent = 'Users';
        subtitleEl.textContent = 'Manage users and their roles';
        addBtn.style.display = isOwner() ? 'block' : 'none';
        await renderUsers();
        break;
        
      case 'suppliers':
        titleEl.textContent = 'Suppliers';
        subtitleEl.textContent = 'Manage suppliers in your organization';
        addBtn.style.display = 'block';
        await renderSuppliers();
        break;
        
      default:
        router.navigate('home');
    }
  } catch (error) {
    console.error('Error loading section:', error);
    contentEl.innerHTML = `
      <div class="text-center py-12">
        <p class="text-red-600 dark:text-red-400">Error loading data: ${error.message}</p>
      </div>
    `;
  }
}

/**
 * Handle add button click
 */
function handleAdd() {
  switch (currentSection) {
    case 'organizations':
      showOrganizationForm();
      break;
    case 'users':
      showUserForm();
      break;
    case 'suppliers':
      showSupplierForm();
      break;
  }
}

// ==================== Organizations ====================

async function renderOrganizations() {
  const contentEl = document.getElementById('admin-content');
  
  try {
    const organizations = await adminGetOrganizations();
    
    const table = createDataTable({
      columns: [
        { key: 'name', label: 'Name' },
        { 
          key: 'created_at', 
          label: 'Created',
          render: (val) => val ? new Date(val).toLocaleDateString() : '-'
        },
        {
          key: 'id',
          label: 'ID',
          render: (val) => `<code class="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">${val?.substring(0, 8)}...</code>`
        }
      ],
      data: organizations,
      actions: { edit: true, delete: true }
    });
    
    contentEl.innerHTML = '';
    contentEl.appendChild(table);
    
    // Add event handlers
    table.querySelectorAll('button[title="Edit"]').forEach((btn, idx) => {
      btn.addEventListener('click', () => showOrganizationForm(organizations[idx]));
    });
    
    table.querySelectorAll('button[title="Delete"]').forEach((btn, idx) => {
      btn.addEventListener('click', () => deleteOrganization(organizations[idx]));
    });
    
  } catch (error) {
    toastError(error.message);
    contentEl.innerHTML = '<p class="text-red-500">Failed to load organizations</p>';
  }
}

function showOrganizationForm(data = null) {
  showFormModal({
    title: data ? 'Edit Organization' : 'New Organization',
    fields: [
      { id: 'org-name', name: 'name', label: 'Organization Name', required: true, placeholder: 'Enter organization name' }
    ],
    initialData: data ? { name: data.name } : {},
    onSubmit: async (formData) => {
      try {
        if (data) {
          await adminUpdateOrganization(data.id, formData);
          toastSuccess('Organization updated successfully');
        } else {
          await adminCreateOrganization(formData);
          toastSuccess('Organization created successfully');
        }
        loadSection('organizations');
      } catch (error) {
        toastError(error.message);
      }
    }
  });
}

async function deleteOrganization(org) {
  const confirmed = await showConfirm(
    'Delete Organization',
    `Are you sure you want to delete "${org.name}"? This action cannot be undone.`,
    'Delete',
    'btn btn-danger'
  );
  
  if (confirmed) {
    try {
      await adminDeleteOrganization(org.id);
      toastSuccess('Organization deleted successfully');
      loadSection('organizations');
    } catch (error) {
      toastError(error.message);
    }
  }
}

// ==================== Users ====================

async function renderUsers() {
  const contentEl = document.getElementById('admin-content');
  const org = appState.get('organization');
  
  try {
    const users = await adminGetUsers(org.id);
    
    const table = createDataTable({
      columns: [
        { key: 'name', label: 'Name' },
        { key: 'role', label: 'Role', render: (val) => getRoleBadge(val) },
        ...(isOwner() ? [{ 
          key: 'organization_id', 
          label: 'Organization',
          render: (val) => val ? `<span class="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">${val.substring(0, 8)}...</span>` : '-'
        }] : []),
        { 
          key: 'created_at', 
          label: 'Joined',
          render: (val) => val ? new Date(val).toLocaleDateString() : '-'
        },
        {
          key: 'id',
          label: 'User ID',
          render: (val) => `<code class="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">${val?.substring(0, 8)}...</code>`
        }
      ],
      data: users,
      actions: { edit: true, delete: true }
    });
    
    contentEl.innerHTML = '';
    contentEl.appendChild(table);
    
    // Add event handlers
    table.querySelectorAll('button[title="Edit"]').forEach((btn, idx) => {
      btn.addEventListener('click', () => showUserForm(users[idx]));
    });
    
    table.querySelectorAll('button[title="Delete"]').forEach((btn, idx) => {
      btn.addEventListener('click', () => deleteUser(users[idx]));
    });
    
  } catch (error) {
    toastError(error.message);
    contentEl.innerHTML = '<p class="text-red-500">Failed to load users</p>';
  }
}

function showUserForm(data = null) {
  const org = appState.get('organization');
  const isCurrentUserOwner = isOwner();
  const isEditMode = !!data;
  
  // For owner: can select any organization
  // For manager: can only add users to their own organization
  const loadOrganizations = isCurrentUserOwner ? adminGetOrganizations() : Promise.resolve([org]);
  
  loadOrganizations.then(organizations => {
    const orgOptions = organizations.map(o => ({ value: o.id, label: o.name }));
    
    // Determine if we should show role field
    // Owner: always show role field
    // Manager: only show role field when creating new user (not editing)
    const showRoleField = isCurrentUserOwner || (!isEditMode);
    
    // Build fields array
    const fields = [
      { id: 'user-name', name: 'name', label: 'Name', required: true, placeholder: 'Enter user name' },
      { id: 'user-email', name: 'email', label: 'Email (for new user)', required: !data, placeholder: 'user@example.com', type: 'email' }
    ];
    
    // Add organization field for owner
    if (isCurrentUserOwner) {
      fields.push({
        id: 'user-org',
        name: 'organization_id',
        label: 'Organization',
        type: 'select',
        required: true,
        options: orgOptions
      });
    }
    
    // Add role field for owner OR when manager is creating new user
    if (showRoleField) {
      fields.push({
        id: 'user-role',
        name: 'role',
        label: 'Role',
        type: 'select',
        required: true,
        options: [
          { value: 'staff', label: 'Staff' },
          { value: 'manager', label: 'Manager' },
          { value: 'owner', label: 'Owner' }
        ]
      });
    }
    
    showFormModal({
      title: data ? 'Edit User' : 'New User',
      fields: fields,
      initialData: data ? { 
        name: data.name,
        role: data.role,
        organization_id: data.organization_id
      } : { role: 'staff', organization_id: isCurrentUserOwner ? '' : org.id },
      onSubmit: async (formData) => {
        try {
          // Validate organization_id for all users
          if (!formData.organization_id) {
            toastError('Please select an organization');
            return;
          }
          
          if (data) {
            // Preserve role if it was hidden (for managers editing users)
            const updateData = showRoleField ? formData : { ...formData, role: data.role };
            // For managers, they can only update users in their organization
            await adminUpdateUser(data.id, updateData);
            toastSuccess('User updated successfully');
          } else {
            // For new user, ensure organization_id is set
            const userData = isCurrentUserOwner ? formData : { ...formData, organization_id: org.id };
            await adminCreateUser(userData);
            toastSuccess('User created successfully');
          }
          loadSection('users');
        } catch (error) {
          toastError(error.message);
        }
      }
    });
  });
}

async function deleteUser(user) {
  const confirmed = await showConfirm(
    'Delete User',
    `Are you sure you want to delete "${user.name}"? This action cannot be undone.`,
    'Delete',
    'btn btn-danger'
  );
  
  if (confirmed) {
    try {
      await adminDeleteUser(user.id);
      toastSuccess('User deleted successfully');
      loadSection('users');
    } catch (error) {
      toastError(error.message);
    }
  }
}

// ==================== Suppliers ====================

async function renderSuppliers() {
  const contentEl = document.getElementById('admin-content');
  const org = appState.get('organization');
  
  try {
    // For owner: get all organizations to show org names
    // For manager: just use their org
    let suppliers = [];
    let orgMap = {};
    
    if (isOwner()) {
      const organizations = await adminGetOrganizations();
      orgMap = organizations.reduce((acc, o) => ({ ...acc, [o.id]: o.name }), {});
      suppliers = await adminGetSuppliers(null); // Get all for owner
    } else {
      suppliers = await adminGetSuppliers(org.id);
    }
    
    const table = createDataTable({
      columns: [
        { key: 'name', label: 'Name' },
        { key: 'normalized_name', label: 'Normalized Name' },
        ...(isOwner() ? [{
          key: 'organization_id',
          label: 'Organization',
          render: (val) => orgMap[val] || val?.substring(0, 8) || '-'
        }] : []),
        { key: 'phone', label: 'Phone' },
        { key: 'location', label: 'Location' }
      ],
      data: suppliers,
      actions: { edit: true, delete: true }
    });
    
    contentEl.innerHTML = '';
    contentEl.appendChild(table);
    
    // Add event handlers
    table.querySelectorAll('button[title="Edit"]').forEach((btn, idx) => {
      btn.addEventListener('click', () => showSupplierForm(suppliers[idx]));
    });
    
    table.querySelectorAll('button[title="Delete"]').forEach((btn, idx) => {
      btn.addEventListener('click', () => deleteSupplier(suppliers[idx]));
    });
    
  } catch (error) {
    toastError(error.message);
    contentEl.innerHTML = '<p class="text-red-500">Failed to load suppliers</p>';
  }
}

function showSupplierForm(data = null) {
  const org = appState.get('organization');
  const isCurrentUserOwner = isOwner();
  
  // For owner: can select any organization
  // For manager: can only add suppliers to their own organization
  const loadOrganizations = isCurrentUserOwner ? adminGetOrganizations() : Promise.resolve([org]);
  
  loadOrganizations.then(organizations => {
    const orgOptions = organizations.map(o => ({ value: o.id, label: o.name }));
    
    showFormModal({
      title: data ? 'Edit Supplier' : 'New Supplier',
      fields: [
        { id: 'supplier-name', name: 'name', label: 'Supplier Name', required: true, placeholder: 'Enter supplier name' },
        ...(isCurrentUserOwner ? [{
          id: 'supplier-org',
          name: 'organization_id',
          label: 'Organization',
          type: 'select',
          required: true,
          options: orgOptions
        }] : []),
        { id: 'supplier-phone', name: 'phone', label: 'Phone', placeholder: 'Enter phone number' },
        { id: 'supplier-location', name: 'location', label: 'Location', placeholder: 'Enter location' },
        { id: 'supplier-notes', name: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Additional notes' }
      ],
      initialData: data ? {
        name: data.name,
        organization_id: data.organization_id,
        phone: data.phone,
        location: data.location,
        notes: data.notes
      } : { organization_id: isCurrentUserOwner ? '' : org.id },
      onSubmit: async (formData) => {
        try {
          // Add normalized_name
          const supplierData = {
            ...formData,
            normalized_name: formData.name.toLowerCase().trim()
          };
          
          // For managers, ensure they can only add to their organization
          if (!isCurrentUserOwner && !data) {
            supplierData.organization_id = org.id;
          }
          
          if (data) {
            await adminUpdateSupplier(data.id, supplierData);
            toastSuccess('Supplier updated successfully');
          } else {
            await adminCreateSupplier(supplierData);
            toastSuccess('Supplier created successfully');
          }
          loadSection('suppliers');
        } catch (error) {
          toastError(error.message);
        }
      }
    });
  });
}

async function deleteSupplier(supplier) {
  const confirmed = await showConfirm(
    'Delete Supplier',
    `Are you sure you want to delete "${supplier.name}"? This action cannot be undone.`,
    'Delete',
    'btn btn-danger'
  );
  
  if (confirmed) {
    try {
      await adminDeleteSupplier(supplier.id);
      toastSuccess('Supplier deleted successfully');
      loadSection('suppliers');
    } catch (error) {
      toastError(error.message);
    }
  }
}

// ==================== Helpers ====================

function getRoleBadge(role) {
  const badges = {
    owner: '<span class="px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">Owner</span>',
    manager: '<span class="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">Manager</span>',
    staff: '<span class="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">Staff</span>'
  };
  return badges[role] || role;
}
