// Login Page
import { signInWithEmail } from '../modules/api.js';
import { router } from '../modules/router.js';
import { showNotification } from '../modules/app.js';
import { getCurrentTheme, toggleTheme, renderThemeToggle } from '../modules/theme.js';

/**
 * Render login page
 */
export function renderLogin(container) {
  // Get current theme
  const currentTheme = getCurrentTheme();
  const isDark = currentTheme.name === 'dark';
  
  container.innerHTML = `
    <div class="min-h-screen flex items-center justify-center p-4 ${isDark ? 'bg-gray-900' : 'bg-gradient-to-br from-primary-50 to-primary-100'}">
      <!-- Theme Toggle (floating) -->
      <button id="theme-toggle-login" class="fixed top-4 right-4 p-2 ${isDark ? 'bg-gray-800 text-yellow-400' : 'bg-white text-gray-600'} rounded-full shadow-lg hover:scale-110 transition-transform" aria-label="Toggle theme">
        ${isDark ? `
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clip-rule="evenodd"/>
          </svg>
        ` : `
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"/>
          </svg>
        `}
      </button>
      
      <div class="w-full max-w-md">
        <!-- Logo / Header -->
        <div class="text-center mb-8">
          <div class="inline-flex items-center justify-center w-20 h-20 mb-4">
            <img src="/128x128@2x.png" alt="Logo" class="w-full h-full object-contain rounded-2xl">
          </div>
          <h1 class="text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}">Procurement System</h1>
          <p class="${isDark ? 'text-gray-400' : 'text-gray-600'} mt-2">Sign in to continue</p>
        </div>
        
        <!-- Login Form -->
        <div class="card ${isDark ? 'bg-gray-800 border-gray-700' : ''}">
          <form id="login-form" class="space-y-4" aria-label="Sign in form">
            <div>
              <label for="email" class="block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-1">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                name="email"
                class="input ${isDark ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : ''}"
                placeholder="your@email.com"
                required
                autocomplete="email"
                aria-describedby="email-hint"
              >
            </div>
            
            <button
              type="submit"
              class="btn btn-primary w-full py-3"
            >
              Send Magic Link
            </button>
          </form>
          
          <!-- Info -->
          <div class="mt-4 p-3 ${isDark ? 'bg-gray-700' : 'bg-gray-50'} rounded-lg" id="email-hint" role="note">
            <p class="text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'} text-center">
              We'll send you a magic link to sign in. No password needed.
            </p>
          </div>
        </div>
        
        <!-- Offline Notice -->
        <p class="text-center text-sm ${isDark ? 'text-gray-500' : 'text-gray-500'} mt-6">
          Works offline • Syncs automatically
        </p>
      </div>
    </div>
  `;
  
  // Setup form handler
  const form = document.getElementById('login-form');
  form.addEventListener('submit', handleLogin);
  
  // Theme toggle handler
  document.getElementById('theme-toggle-login')?.addEventListener('click', () => {
    toggleTheme();
    // Re-render login page with new theme
    router.navigate('login');
  });
}

/**
 * Handle login form submission
 */
async function handleLogin(event) {
  event.preventDefault();
  
  const email = document.getElementById('email').value.trim();
  const button = event.target.querySelector('button');
  
  if (!email) {
    showNotification('Please enter your email', 'error');
    return;
  }
  
  // Show loading state
  button.disabled = true;
  button.textContent = 'Sending...';
  
  try {
    await signInWithEmail(email);
    
    showNotification('Magic link sent! Check your email.', 'success');
    
    // Update button
    button.textContent = 'Email Sent!';
    
    // Show additional message
    const infoDiv = document.querySelector('.bg-gray-50');
    if (infoDiv) {
      infoDiv.innerHTML = `
        <p class="text-sm text-green-600 font-medium">
          ✓ Magic link sent to ${email}
        </p>
        <p class="text-xs text-gray-500 mt-1">
          Click the link in your email to sign in.
        </p>
      `;
    }
    
  } catch (error) {
    console.error('Login error:', error);
    showNotification(error.message || 'Failed to send magic link', 'error');
    
    // Reset button
    button.disabled = false;
    button.textContent = 'Send Magic Link';
  }
}
