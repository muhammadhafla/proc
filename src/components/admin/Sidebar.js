// Sidebar Component
import { router } from '../../modules/router.js';
import { signOut } from '../../modules/api.js';

/**
 * Create admin sidebar
 * @param {string} userRole - Current user role ('owner' or 'manager')
 * @param {Function} onNavigate - Navigation callback
 * @returns {HTMLElement} - Sidebar element
 */
export function createSidebar(userRole, onNavigate) {
  const sidebar = document.createElement('aside');
  sidebar.className = 'w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col h-full';
  
  const isOwner = userRole === 'owner';
  
  // Menu items based on role
  const menuItems = [];
  
  if (isOwner) {
    menuItems.push(
      { id: 'organizations', label: 'Organizations', icon: 'building' },
      { id: 'users', label: 'Users', icon: 'users' }
    );
  }
  
  menuItems.push(
    { id: 'suppliers', label: 'Suppliers', icon: 'truck' }
  );
  
  sidebar.innerHTML = `
    <div class="p-4 border-b border-gray-200 dark:border-gray-700">
      <h2 class="text-xl font-bold text-gray-900 dark:text-white">Admin Console</h2>
      <p class="text-sm text-gray-500 dark:text-gray-400 capitalize">${userRole} Panel</p>
    </div>
    
    <nav class="flex-1 p-4 overflow-y-auto">
      <ul class="space-y-1">
        ${menuItems.map(item => `
          <li>
            <button 
              class="sidebar-item w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors"
              data-section="${item.id}"
            >
              ${getIcon(item.icon)}
              <span class="text-gray-700 dark:text-gray-300">${item.label}</span>
            </button>
          </li>
        `).join('')}
      </ul>
    </nav>
    
    <div class="p-4 border-t border-gray-200 dark:border-gray-700">
      <button id="sidebar-logout" class="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
        </svg>
        <span>Logout</span>
      </button>
      <button id="sidebar-back" class="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
        </svg>
        <span>Back to App</span>
      </button>
    </div>
  `;
  
  // Add event listeners
  sidebar.querySelectorAll('.sidebar-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const section = btn.dataset.section;
      
      // Update active state
      sidebar.querySelectorAll('.sidebar-item').forEach(b => {
        b.classList.remove('bg-primary-50', 'dark:bg-primary-900/20', 'text-primary-600', 'dark:text-primary-400');
      });
      btn.classList.add('bg-primary-50', 'dark:bg-primary-900/20', 'text-primary-600', 'dark:text-primary-400');
      
      if (onNavigate) onNavigate(section);
    });
  });
  
  document.getElementById('sidebar-back')?.addEventListener('click', () => {
    router.navigate('home');
  });
  
  document.getElementById('sidebar-logout')?.addEventListener('click', async () => {
    if (confirm('Are you sure you want to logout?')) {
      await signOut();
    }
  });
  
  return sidebar;
}

/**
 * Get SVG icon by name
 */
function getIcon(name) {
  const icons = {
    building: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
    </svg>`,
    users: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/>
    </svg>`,
    truck: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12"/>
    </svg>`
  };
  
  return icons[name] || '';
}

/**
 * Set active menu item
 */
export function setActiveMenuItem(sidebar, sectionId) {
  if (!sidebar) return;
  
  sidebar.querySelectorAll('.sidebar-item').forEach(btn => {
    btn.classList.remove('bg-primary-50', 'dark:bg-primary-900/20', 'text-primary-600', 'dark:text-primary-400');
    if (btn.dataset.section === sectionId) {
      btn.classList.add('bg-primary-50', 'dark:bg-primary-900/20', 'text-primary-600', 'dark:text-primary-400');
    }
  });
}
