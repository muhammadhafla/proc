// Login Page
import { signInWithEmail } from '../modules/api.js';
import { router } from '../modules/router.js';
import { showNotification } from '../modules/app.js';

/**
 * Render login page
 */
export function renderLogin(container) {
  container.innerHTML = `
    <div class="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary-50 to-primary-100">
      <div class="w-full max-w-md">
        <!-- Logo / Header -->
        <div class="text-center mb-8">
          <div class="inline-flex items-center justify-center w-20 h-20 mb-4">
            <img src="/128x128@2x.png" alt="Logo" class="w-full h-full object-contain rounded-2xl">
          </div>
          <h1 class="text-2xl font-bold text-gray-900">Procurement System</h1>
          <p class="text-gray-600 mt-2">Sign in to continue</p>
        </div>
        
        <!-- Login Form -->
        <div class="card">
          <form id="login-form" class="space-y-4">
            <div>
              <label for="email" class="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                name="email"
                class="input"
                placeholder="your@email.com"
                required
                autocomplete="email"
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
          <div class="mt-4 p-3 bg-gray-50 rounded-lg">
            <p class="text-xs text-gray-600 text-center">
              We'll send you a magic link to sign in. No password needed.
            </p>
          </div>
        </div>
        
        <!-- Offline Notice -->
        <p class="text-center text-sm text-gray-500 mt-6">
          Works offline • Syncs automatically
        </p>
      </div>
    </div>
  `;
  
  // Setup form handler
  const form = document.getElementById('login-form');
  form.addEventListener('submit', handleLogin);
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
