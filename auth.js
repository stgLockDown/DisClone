// ============================================
// NEXUS CHAT — Auth Screen Controller
// Handles signup/login, "stay signed in", and session restore
// ============================================

(function() {
  'use strict';

  const STORAGE_KEY_REMEMBER = 'nexus_remember_me';
  const STORAGE_KEY_TOKEN = 'nexus_token';

  // ============ TAB SWITCHING ============

  window.switchAuthTab = function(tab) {
    const signupForm = document.getElementById('signupForm');
    const loginForm = document.getElementById('loginForm');
    const tabSignup = document.getElementById('tabSignup');
    const tabLogin = document.getElementById('tabLogin');
    const authTitle = document.getElementById('authTitle');
    const authSubtitle = document.getElementById('authSubtitle');
    const authFooter = document.getElementById('authFooter');
    const globalError = document.getElementById('authGlobalError');

    // Clear errors
    globalError.classList.remove('visible');
    globalError.textContent = '';
    document.querySelectorAll('.auth-error').forEach(el => el.textContent = '');
    document.querySelectorAll('.auth-input.error').forEach(el => el.classList.remove('error'));

    if (tab === 'signup') {
      signupForm.classList.add('active');
      loginForm.classList.remove('active');
      tabSignup.classList.add('active');
      tabLogin.classList.remove('active');
      authTitle.textContent = 'Create an Account';
      authSubtitle.textContent = 'Join Nexus Chat and start connecting with your community';
      authFooter.innerHTML = 'Already have an account? <a onclick="switchAuthTab(\'login\')">Log in</a>';
    } else {
      loginForm.classList.add('active');
      signupForm.classList.remove('active');
      tabLogin.classList.add('active');
      tabSignup.classList.remove('active');
      authTitle.textContent = 'Welcome Back!';
      authSubtitle.textContent = 'Log in to continue to Nexus Chat';
      authFooter.innerHTML = 'Need an account? <a onclick="switchAuthTab(\'signup\')">Sign up</a>';
    }
  };

  // ============ PASSWORD STRENGTH ============

  window.updatePasswordStrength = function(password) {
    const bars = [
      document.getElementById('pwBar1'),
      document.getElementById('pwBar2'),
      document.getElementById('pwBar3'),
      document.getElementById('pwBar4')
    ];

    // Reset
    bars.forEach(b => b.className = 'password-strength-bar');

    if (!password || password.length === 0) return;

    let score = 0;
    if (password.length >= 6) score++;
    if (password.length >= 10) score++;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    const level = score <= 1 ? 'weak' : score <= 3 ? 'medium' : 'strong';
    const fill = score <= 1 ? 1 : score <= 3 ? 2 : score <= 4 ? 3 : 4;

    for (let i = 0; i < fill; i++) {
      bars[i].classList.add(level);
    }
  };

  // ============ FORM SUBMISSION ============

  window.handleAuthSubmit = async function(event, mode) {
    event.preventDefault();

    const globalError = document.getElementById('authGlobalError');
    globalError.classList.remove('visible');
    globalError.textContent = '';

    // Clear field errors
    document.querySelectorAll('.auth-error').forEach(el => el.textContent = '');
    document.querySelectorAll('.auth-input.error').forEach(el => el.classList.remove('error'));

    const btn = mode === 'signup' ? document.getElementById('signupBtn') : document.getElementById('loginBtn');
    btn.classList.add('loading');
    btn.disabled = true;

    try {
      let result;

      if (mode === 'signup') {
        const email = document.getElementById('signupEmail').value.trim();
        const displayName = document.getElementById('signupDisplayName').value.trim();
        const username = document.getElementById('signupUsername').value.trim();
        const password = document.getElementById('signupPassword').value;
        const remember = document.getElementById('signupRemember').checked;

        // Client-side validation
        let hasError = false;
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          showFieldError('signupEmail', 'Please enter a valid email address');
          hasError = true;
        }
        if (!displayName || displayName.length < 1) {
          showFieldError('signupDisplayName', 'Display name is required');
          hasError = true;
        }
        if (!username || !/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
          showFieldError('signupUsername', '3-20 characters, letters, numbers, underscore only');
          hasError = true;
        }
        if (!password || password.length < 6) {
          showFieldError('signupPassword', 'Password must be at least 6 characters');
          hasError = true;
        }
        if (hasError) {
          btn.classList.remove('loading');
          btn.disabled = false;
          return;
        }

        // Set remember preference BEFORE the API call
        setRememberPreference(remember);

        result = await NexusBackend.handleSignup(email, displayName, username, password);

        if (!result.success) {
          if (result.errors) {
            if (result.errors.email) showFieldError('signupEmail', result.errors.email);
            if (result.errors.displayName) showFieldError('signupDisplayName', result.errors.displayName);
            if (result.errors.username) showFieldError('signupUsername', result.errors.username);
            if (result.errors.password) showFieldError('signupPassword', result.errors.password);
          } else {
            showGlobalError(result.error || 'Registration failed. Please try again.');
          }
          btn.classList.remove('loading');
          btn.disabled = false;
          return;
        }
      } else {
        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value;
        const remember = document.getElementById('loginRemember').checked;

        if (!email) {
          showFieldError('loginEmail', 'Email or username is required');
          btn.classList.remove('loading');
          btn.disabled = false;
          return;
        }
        if (!password) {
          showFieldError('loginPassword', 'Password is required');
          btn.classList.remove('loading');
          btn.disabled = false;
          return;
        }

        // Set remember preference BEFORE the API call
        setRememberPreference(remember);

        result = await NexusBackend.handleLogin(email, password);

        if (!result.success) {
          if (result.errors) {
            if (result.errors.email) showFieldError('loginEmail', result.errors.email);
            if (result.errors.password) showFieldError('loginPassword', result.errors.password);
          } else {
            showGlobalError(result.error || 'Login failed. Please check your credentials.');
          }
          btn.classList.remove('loading');
          btn.disabled = false;
          return;
        }
      }

      // SUCCESS — hide auth screen and show app
      completeAuth();

    } catch (err) {
      console.error('[Auth] Error:', err);
      showGlobalError('Something went wrong. Please try again.');
      btn.classList.remove('loading');
      btn.disabled = false;
    }
  };

  // ============ HELPERS ============

  function showFieldError(inputId, message) {
    const input = document.getElementById(inputId);
    const errorEl = document.getElementById(inputId + 'Error');
    if (input) input.classList.add('error');
    if (errorEl) errorEl.textContent = message;
  }

  function showGlobalError(message) {
    const el = document.getElementById('authGlobalError');
    el.textContent = message;
    el.classList.add('visible');
  }

  function setRememberPreference(remember) {
    if (remember) {
      localStorage.setItem(STORAGE_KEY_REMEMBER, 'true');
    } else {
      localStorage.removeItem(STORAGE_KEY_REMEMBER);
      // If not remembering, we'll use sessionStorage instead
      // Move token to sessionStorage on next page load check
    }
  }

  function shouldRemember() {
    return localStorage.getItem(STORAGE_KEY_REMEMBER) === 'true';
  }

  function completeAuth() {
    const overlay = document.getElementById('authOverlay');
    overlay.classList.add('hidden');

    // After transition, remove from DOM flow
    setTimeout(() => {
      overlay.style.display = 'none';
    }, 500);

    // Make sure the app initializes properly
    if (typeof switchServer === 'function') {
      switchServer('nexus-hq');
    }
  }

  // ============ SESSION RESTORE ON PAGE LOAD ============

  async function checkExistingSession() {
    const overlay = document.getElementById('authOverlay');
    const token = localStorage.getItem(STORAGE_KEY_TOKEN);
    const remember = shouldRemember();

    // If no token, or user chose not to stay signed in — show auth screen
    if (!token) {
      overlay.classList.remove('hidden');
      overlay.style.display = '';
      return;
    }

    // If user chose not to stay signed in and this is a new browser session
    // We detect "new session" by checking sessionStorage
    if (!remember) {
      const sessionActive = sessionStorage.getItem('nexus_session_active');
      if (!sessionActive) {
        // New browser session + not remembering = clear token and show auth
        localStorage.removeItem(STORAGE_KEY_TOKEN);
        overlay.classList.remove('hidden');
        overlay.style.display = '';
        return;
      }
    }

    // Try to restore session via backend
    try {
      const result = await NexusBackend.init();
      if (result.authenticated) {
        // Session valid — mark session as active and hide auth
        sessionStorage.setItem('nexus_session_active', 'true');
        completeAuth();
        return;
      }
    } catch (err) {
      console.warn('[Auth] Session restore failed:', err);
    }

    // Session invalid — show auth screen
    localStorage.removeItem(STORAGE_KEY_TOKEN);
    overlay.classList.remove('hidden');
    overlay.style.display = '';
  }

  // ============ INIT ============

  // Hide the app container initially until auth is resolved
  function hideAppUntilAuth() {
    const appContainer = document.querySelector('.app-container');
    if (appContainer) {
      appContainer.style.visibility = 'hidden';
      appContainer.style.opacity = '0';
    }
  }

  function showApp() {
    const appContainer = document.querySelector('.app-container');
    if (appContainer) {
      appContainer.style.visibility = 'visible';
      appContainer.style.opacity = '1';
      appContainer.style.transition = 'opacity 0.3s ease';
    }
  }

  // Override completeAuth to also show the app
  const _originalCompleteAuth = completeAuth;
  window._nexusCompleteAuth = function() {
    showApp();
    _originalCompleteAuth();
  };

  // Patch completeAuth
  completeAuth = function() {
    const overlay = document.getElementById('authOverlay');
    overlay.classList.add('hidden');
    setTimeout(() => { overlay.style.display = 'none'; }, 500);

    showApp();
    sessionStorage.setItem('nexus_session_active', 'true');

    // Initialize app
    if (typeof switchServer === 'function') {
      switchServer('nexus-hq');
    }
  };

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      hideAppUntilAuth();
      checkExistingSession();
    });
  } else {
    hideAppUntilAuth();
    checkExistingSession();
  }

})();