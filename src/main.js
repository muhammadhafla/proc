// Procurement System - Main Entry Point
import { initApp } from './modules/app.js';
import { initDB } from './modules/db.js';
import { initTheme } from './modules/theme.js';

// Register Service Worker for offline support
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        console.log('Service Worker registered:', registration.scope);
        
        // Listen for SW updates - auto reload when new version available
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          console.log('New Service Worker found, installing...');
          
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'activated') {
              console.log('New Service Worker activated, reloading...');
              window.location.reload();
            }
          });
        });
      } catch (error) {
        console.error('Service Worker registration failed:', error);
      }
    });
  }
}

// Initialize application
async function bootstrap() {
  try {
    // Register service worker first
    registerServiceWorker();
    
    // Initialize theme first (before any UI renders)
    initTheme();
    
    // Initialize IndexedDB first (offline-first)
    try {
      await initDB();
    } catch (dbError) {
      // Handle version mismatch error - clear old database and retry
      if (dbError.name === 'VersionError') {
        console.warn('[DB] Version mismatch detected, old version exists in browser');
        
        // Delete the old database to allow fresh start
        await window.indexedDB.deleteDatabase('procurement-db');
        console.log('[DB] Old database deleted, retrying initialization...');
        
        // Re-initialize after clearing
        await initDB();
        console.log('[DB] DB re-initialization successful after clearing old version');
      } else {
        throw dbError; // Re-throw other errors
      }
    }
    
    // Initialize the app
    await initApp();
    
    console.log('Procurement System initialized');
  } catch (error) {
    console.error('Failed to initialize app:', error);
    // Show error to user
    document.getElementById('app').innerHTML = `
      <div class="flex items-center justify-center min-h-screen p-4">
        <div class="text-center">
          <h1 class="text-xl font-bold text-red-600 mb-2">Initialization Error</h1>
          <p class="text-gray-600">Please refresh the page</p>
        </div>
      </div>
    `;
  }
}

// Start the app
bootstrap();
