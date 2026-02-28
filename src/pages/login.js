// Login Page
import { signInWithEmail } from '../modules/api.js';
import { showNotification } from '../modules/app.js';
import { getCurrentTheme, toggleTheme } from '../modules/theme.js';

/**
 * Render login page
 * @param {HTMLElement} container - Container element
 * @param {Object} params - Route parameters including authError
 */
export function renderLogin(container, params = {}) {
  // Get current theme
  const currentTheme = getCurrentTheme();
  const isDark = currentTheme.name === 'dark';
  
  // Get auth error if present
  const authError = params?.authError;
  
  // Get redirect parameter (from session expiry)
  const redirectParam = params?.redirect || null;
  const sessionExpiredReason = params?.reason === 'session_expired';
  
  // Map error codes to user-friendly messages
  const errorMessages = {
    'otp_expired': {
      title: 'Link Expired',
      message: 'The login link has expired. Magic links are valid for 1 hour. Please request a new one.',
      icon: 'clock'
    },
    'access_denied': {
      title: 'Access Denied',
      message: 'The login link is invalid or has already been used. Please request a new magic link.',
      icon: 'lock'
    },
    'invalid_token': {
      title: 'Invalid Link',
      message: 'The login link is invalid. Please request a new magic link.',
      icon: 'x-circle'
    },
    'expired_token': {
      title: 'Link Expired',
      message: 'Your session has expired. Please request a new magic link.',
      icon: 'clock'
    }
  };
  
  // Get the appropriate error message
  let errorDisplay = null;
  if (authError?.errorCode && errorMessages[authError.errorCode]) {
    errorDisplay = errorMessages[authError.errorCode];
  } else if (authError?.errorDescription) {
    errorDisplay = {
      title: 'Login Failed',
      message: authError.errorDescription,
      icon: 'alert-circle'
    };
  }
  
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
        
        <!-- Error Alert -->
        ${errorDisplay ? `
        <div class="mb-6 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg" role="alert">
          <div class="flex items-start gap-3">
            <svg class="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <div>
              <h3 class="text-sm font-semibold text-red-800 dark:text-red-400">${errorDisplay.title}</h3>
              <p class="text-sm text-red-700 dark:text-red-300 mt-1">${errorDisplay.message}</p>
            </div>
          </div>
        </div>
        ` : ''}
        
        <!-- Session Expired Notice -->
        ${sessionExpiredReason ? `
        <div class="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg" role="alert">
          <div class="flex items-start gap-3">
            <svg class="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>
            <div>
              <h3 class="text-sm font-semibold text-yellow-800 dark:text-yellow-400">Session Ended</h3>
              <p class="text-sm text-yellow-700 dark:text-yellow-300 mt-1">Your previous session has expired. Please log in again to continue working.</p>
              ${redirectParam ? `<p class="text-xs text-yellow-600 dark:text-yellow-400 mt-2">You will be redirected to <strong>${redirectParam}</strong> after logging in.</p>` : ''}
            </div>
          </div>
        </div>
        ` : ''}
        
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
          Works Smart • Syncs automatically
        </p>
      </div>
    </div>
  `;
  
  // Store redirect param in sessionStorage for post-login redirect
  if (redirectParam) {
    sessionStorage.setItem('sessionRedirect', redirectParam);
  }
  
  // Setup form handler
  const form = document.getElementById('login-form');
  form.addEventListener('submit', handleLogin);
  
  // Theme toggle handler
  document.getElementById('theme-toggle-login')?.addEventListener('click', () => {
    const newTheme = toggleTheme();
    applyThemeDynamicallyLogin(newTheme);
  });
}

/**
 * Handle login form submission
 */
async function handleLogin(event) {
  event.preventDefault();
  
  const form = event.target;
  const email = document.getElementById('email').value.trim();
  const button = form.querySelector('button');
  
  // Prevent duplicate submissions
  if (button.disabled || button.dataset.submitting === 'true') {
    return;
  }
  
  if (!email) {
    showNotification('Please enter your email', 'error');
    return;
  }
  
  // Show loading state and prevent duplicate clicks
  button.disabled = true;
  button.dataset.submitting = 'true';
  button.textContent = 'Sending...';
  
  try {
    await signInWithEmail(email);
    
    // Mark as successfully submitted to prevent re-submission
    button.dataset.submitted = 'true';
    button.textContent = 'Email Sent!';
    
    // Disable the email input as well
    const emailInput = document.getElementById('email');
    if (emailInput) {
      emailInput.disabled = true;
    }
    
    showNotification('Magic link sent! Check your email.', 'success');
    
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
    
    // Reset button on error so user can try again
    button.disabled = false;
    button.dataset.submitting = 'false';
    button.textContent = 'Send Magic Link';
  }
}

/**
 * Apply theme dynamically without page re-render
 */
function applyThemeDynamicallyLogin(theme) {
  const isDark = theme.name === 'dark';
  const container = document.querySelector('.min-h-screen');
  if (!container) return;
  
  // Use class toggle for theme - let CSS handle child elements
  container.classList.toggle('dark-theme', isDark);
  container.classList.toggle('light-theme', !isDark);
  
  // Update background - use separate class names
  container.classList.remove('bg-gradient-to-br', 'from-primary-50', 'to-primary-100', 'bg-gray-900');
  if (isDark) {
    container.classList.add('bg-gray-900');
  } else {
    container.classList.add('bg-gradient-to-br', 'from-primary-50', 'to-primary-100');
  }
  
  // Update theme toggle button - use separate class names
  const themeToggle = document.getElementById('theme-toggle-login');
  if (themeToggle) {
    themeToggle.classList.remove('bg-white', 'text-gray-600', 'bg-gray-800', 'text-yellow-400');
    if (isDark) {
      themeToggle.classList.add('bg-gray-800', 'text-yellow-400');
    } else {
      themeToggle.classList.add('bg-white', 'text-gray-600');
    }
    
    // Update icon
    themeToggle.innerHTML = isDark ? `
      <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clip-rule="evenodd"/>
      </svg>
    ` : `
      <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
        <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"/>
      </svg>
    `;
  }
  
  // Update heading
  const heading = document.querySelector('h1');
  if (heading) {
    heading.classList.remove('text-white', 'text-gray-900');
    heading.classList.add(isDark ? 'text-white' : 'text-gray-900');
  }
  
  // Update subheading
  const subheading = document.querySelector('p');
  if (subheading) {
    subheading.classList.remove('text-gray-400', 'text-gray-600');
    subheading.classList.add(isDark ? 'text-gray-400' : 'text-gray-600');
  }
  
  // Update card
  const card = document.querySelector('.card');
  if (card) {
    card.classList.remove('bg-gray-800', 'border-gray-700');
    if (isDark) card.classList.add('bg-gray-800', 'border-gray-700');
  }
  
  // Update labels
  const labels = document.querySelectorAll('label');
  labels.forEach(label => {
    label.classList.remove('text-gray-300', 'text-gray-700');
    label.classList.add(isDark ? 'text-gray-300' : 'text-gray-700');
  });
  
  // Update inputs
  const inputs = document.querySelectorAll('input');
  inputs.forEach(input => {
    input.classList.remove('bg-gray-700', 'border-gray-600', 'text-white', 'placeholder-gray-400');
    if (isDark) input.classList.add('bg-gray-700', 'border-gray-600', 'text-white', 'placeholder-gray-400');
  });
  
  // Update info div
  const infoDiv = document.querySelector('.bg-gray-50, .bg-gray-700');
  if (infoDiv) {
    infoDiv.classList.remove('bg-gray-50', 'bg-gray-700');
    infoDiv.classList.add(isDark ? 'bg-gray-700' : 'bg-gray-50');
    
    const infoText = infoDiv.querySelectorAll('p');
    infoText.forEach(p => {
      p.classList.remove('text-gray-400', 'text-gray-600');
      p.classList.add(isDark ? 'text-gray-400' : 'text-gray-600');
    });
  }
  
  // Update offline notice
  const offlineNotice = document.querySelector('.text-gray-500');
  if (offlineNotice) {
    offlineNotice.classList.add('text-gray-500');
  }
}
