// Theme Manager - Consistent theming across the app

/**
 * Theme definitions for consistent UI
 */
export const themes = {
  light: {
    name: 'light',
    bg: 'bg-gray-50',
    bgWhite: 'bg-white',
    text: 'text-gray-900',
    textMuted: 'text-gray-500',
    textLight: 'text-gray-400',
    border: 'border-gray-200',
    header: 'bg-white border-b border-gray-200',
    card: 'bg-white',
    input: 'bg-white border-gray-300',
    overlay: 'bg-gray-800/90',
    icon: 'text-gray-600',
  },
  dark: {
    name: 'dark',
    bg: 'bg-gray-900',
    bgWhite: 'bg-gray-800',
    text: 'text-white',
    textMuted: 'text-gray-400',
    textLight: 'text-gray-500',
    border: 'border-gray-700',
    header: 'bg-gray-800',
    card: 'bg-gray-800',
    input: 'bg-gray-700 border-gray-600',
    overlay: 'bg-gray-800/90',
    icon: 'text-white',
  },
};

// Current theme state
let currentTheme = themes.light;

/**
 * Get current theme
 */
export function getCurrentTheme() {
  // Check localStorage first
  const saved = localStorage.getItem('app-theme');
  if (saved === 'dark') return themes.dark;
  if (saved === 'light') return themes.light;
  return currentTheme;
}

/**
 * Toggle theme
 */
export function toggleTheme() {
  currentTheme = currentTheme.name === 'light' ? themes.dark : themes.light;
  localStorage.setItem('app-theme', currentTheme.name);
  applyThemeToDocument();
  return currentTheme;
}

/**
 * Apply theme to document
 */
export function applyThemeToDocument() {
  const theme = getCurrentTheme();
  document.documentElement.classList.remove('light', 'dark');
  document.documentElement.classList.add(theme.name);
}

/**
 * Initialize theme on app load
 */
export function initTheme() {
  applyThemeToDocument();
}

/**
 * Get theme by page type
 */
export function getThemeForPage(pageName) {
  // Camera pages use dark theme for better camera preview
  if (pageName === 'capture' || pageName === 'batch') {
    return themes.dark;
  }
  return getCurrentTheme();
}

/**
 * Apply theme classes to an element
 */
export function applyTheme(container, pageName) {
  const theme = getThemeForPage(pageName);
  
  // Remove any existing theme classes
  container.classList.remove('bg-gray-50', 'bg-gray-900', 'bg-white', 'bg-gray-800');
  
  // Apply theme background
  container.classList.add(theme.bg);
  
  return theme;
}

/**
 * Create bottom navigation HTML
 */
export function renderBottomNav(currentPage) {
  const navItems = [
    { id: 'home', label: 'Home', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { id: 'capture', label: 'Capture', icon: 'M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z M15 13a3 3 0 11-6 0 3 3 0 016 0z' },
    { id: 'list', label: 'History', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
  ];

  return `
    <nav class="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 z-40 safe-area-bottom">
      <div class="max-w-lg mx-auto flex justify-around py-2">
        ${navItems.map(item => `
          <button 
            class="nav-btn flex flex-col items-center justify-center p-2 rounded-lg transition-colors w-16 ${currentPage === item.id ? 'text-primary-600' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}"
            data-page="${item.id}"
            aria-label="${item.label}"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${item.icon}"/>
            </svg>
            <span class="text-xs mt-1">${item.label}</span>
          </button>
        `).join('')}
      </div>
    </nav>
  `;
}

/**
 * Create skeleton loader HTML
 */
export function renderSkeleton(type = 'card') {
  if (type === 'card') {
    return `
      <div class="card animate-pulse">
        <div class="flex gap-3">
          <div class="w-16 h-16 bg-gray-200 rounded-lg"></div>
          <div class="flex-1 space-y-2">
            <div class="h-4 bg-gray-200 rounded w-3/4"></div>
            <div class="h-3 bg-gray-200 rounded w-1/2"></div>
            <div class="h-3 bg-gray-200 rounded w-1/4"></div>
          </div>
        </div>
      </div>
    `;
  }
  
  if (type === 'list') {
    return `
      <div class="space-y-3">
        ${Array(5).fill(`
          <div class="card animate-pulse">
            <div class="flex gap-3">
              <div class="w-16 h-16 bg-gray-200 rounded-lg"></div>
              <div class="flex-1 space-y-2">
                <div class="h-4 bg-gray-200 rounded w-3/4"></div>
                <div class="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  if (type === 'detail') {
    return `
      <div class="space-y-4 animate-pulse">
        <div class="h-64 bg-gray-200 rounded-xl"></div>
        <div class="card space-y-3">
          <div class="h-8 bg-gray-200 rounded w-1/3 mx-auto"></div>
          <div class="grid grid-cols-2 gap-4">
            <div class="h-4 bg-gray-200 rounded"></div>
            <div class="h-4 bg-gray-200 rounded"></div>
            <div class="h-4 bg-gray-200 rounded"></div>
            <div class="h-4 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    `;
  }

  return '';
}

/**
 * Create empty state HTML
 */
export function renderEmptyState(title = 'No data', actionLabel = 'Start Capturing', actionPage = 'capture') {
  return `
    <div class="text-center py-12">
      <div class="w-24 h-24 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
        <svg class="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/>
        </svg>
      </div>
      <p class="text-gray-500 mb-4">${title}</p>
      <button class="btn btn-primary" data-nav="${actionPage}">
        ${actionLabel}
      </button>
    </div>
  `;
}

/**
 * Create theme toggle button HTML
 */
export function renderThemeToggle(currentThemeName) {
  const isDark = currentThemeName === 'dark';
  return `
    <button id="theme-toggle" class="p-2 hover:bg-gray-100 rounded-lg" aria-label="Toggle theme">
      ${isDark ? `
        <svg class="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clip-rule="evenodd"/>
        </svg>
      ` : `
        <svg class="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
          <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"/>
        </svg>
      `}
    </button>
  `;
}

/**
 * ARIA helpers for accessibility
 */
export const a11y = {
  /**
   * Create accessible button label
   */
  buttonLabel: (action, label) => `Go to ${label}`,
  
  /**
   * Create loading aria-label
   */
  loadingLabel: (element) => `Loading ${element}`,
  
  /**
   * Focus trap for modal
   */
  trapFocus: (modalElement) => {
    const focusableElements = modalElement.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    modalElement.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
      if (e.key === 'Escape') {
        modalElement.classList.add('hidden');
      }
    });

    // Focus first element
    if (firstElement) firstElement.focus();
  },
};
