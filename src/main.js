// Procurement System - Main Entry Point
import { initApp } from './modules/app.js';
import { initDB } from './modules/db.js';
import { initTheme } from './modules/theme.js';

// Initialize application
async function bootstrap() {
  try {
    // Initialize theme first (before any UI renders)
    initTheme();
    
    // Initialize IndexedDB first (offline-first)
    await initDB();
    
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
