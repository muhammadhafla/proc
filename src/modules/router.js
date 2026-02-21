// Simple Router Module
import { renderLogin } from '../pages/login.js';
import { renderHome } from '../pages/home.js';
import { renderCapture } from '../pages/capture.js';
import { renderList } from '../pages/list.js';
import { renderDetail } from '../pages/detail.js';

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
    render: renderCapture, // Unified capture page (previously separate batch.js)
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
};

// Current route
let currentRoute = null;

// Store previous route for back navigation
let previousRoute = null;

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
  const isAuthenticated = !!window.appState?.user;
  
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
  window.history.pushState({ route: routeName, params }, '', `#${routeName}`);
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
  
  if (routes[routeName]) {
    navigate(routeName);
  } else {
    navigate('login');
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
