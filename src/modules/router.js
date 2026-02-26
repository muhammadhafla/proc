// Simple Router Module
import { renderLogin } from '../pages/login.js';
import { renderHome } from '../pages/home.js';
import { renderCapture } from '../pages/capture.js';
import { renderList } from '../pages/list.js';
import { renderDetail } from '../pages/detail.js';
import { renderAdmin } from '../pages/admin.js';
import { appState } from './state.js';

// Route definitions
const routes = {
  login: {
    render: renderLogin,
    requiresAuth: false,
  },
  home: {
    render: renderHome,
    requiresAuth: true,
  },
  capture: {
    render: renderCapture,
    requiresAuth: true,
  },
  batch: {
    render: () => router.navigate('capture'),
    requiresAuth: true,
  },
  list: {
    render: renderList,
    requiresAuth: true,
  },
  detail: {
    render: renderDetail,
    requiresAuth: true,
  },
  admin: {
    render: renderAdmin,
    requiresAuth: true,
  },
};

// Current route
let currentRoute = null;

// Store previous route for back navigation
let previousRoute = null;

/**
 * Parse query parameters from hash
 * @param {string} hash - Full hash including query string
 * @returns {Object} Parsed query parameters
 */
function parseQueryParams(hash) {
  const params = {};
  const queryString = hash.split('?')[1];
  
  if (queryString) {
    const searchParams = new URLSearchParams(queryString);
    searchParams.forEach((value, key) => {
      params[key] = value;
    });
  }
  
  return params;
}

/**
 * Navigate to a route
 */
export function navigate(routeName, params = {}) {
  const route = routes[routeName];
  if (!route) {
    console.error(`Route not found: ${routeName}`);
    return;
  }
  
  // Store previous route for back navigation
  if (currentRoute && currentRoute !== routeName) {
    previousRoute = currentRoute;
  }
  
  // Check authentication
  const appElement = document.getElementById('app');
  const isAuthenticated = !!appState.get('user');
  
  if (route.requiresAuth && !isAuthenticated) {
    // Store intended route for redirect after login
    if (routeName !== 'login') {
      sessionStorage.setItem('intendedRoute', routeName);
    }
    navigate('login');
    return;
  }
  
  // Render the route
  currentRoute = routeName;
  route.render(appElement, params);
  
  // Update URL (optional - for PWA without full routing)
  const queryString = Object.keys(params).length > 0 
    ? '?' + new URLSearchParams(params).toString()
    : '';
  window.history.pushState({ route: routeName, params }, '', `#${routeName}${queryString}`);
}

/**
 * Navigate back to previous route
 */
export function navigateBack(defaultRoute = 'home') {
  if (previousRoute) {
    const route = previousRoute;
    previousRoute = null;
    navigate(route);
  } else {
    navigate(defaultRoute);
  }
}

/**
 * Get current route
 */
export function getCurrentRoute() {
  return currentRoute;
}

/**
 * Handle back button
 */
window.addEventListener('popstate', (event) => {
  if (event.state?.route) {
    navigate(event.state.route, event.state.params);
  }
});

/**
 * Initialize router from URL
 */
export function initRouter() {
  const hash = window.location.hash.slice(1) || 'login';
  const [routeName] = hash.split('?');
  
  // Parse query parameters
  const queryParams = parseQueryParams(hash);
  
  // Note: Auth errors are handled in app.js handleMagicLinkCallback()
  // This is just for regular route navigation
  
  if (routes[routeName]) {
    // Pass query params to route render function
    navigate(routeName, queryParams);
  } else {
    navigate('login', queryParams);
  }
}

// Export router
export const router = {
  navigate,
  navigateBack,
  getCurrentRoute,
};

// Export routes for use in app.js
export { routes };
