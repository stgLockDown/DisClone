// ============================================
// NEXUS CHAT - Social Features
// Auth, Profile, Friends, Moderation, Encryption
// ============================================

// ============ AUTH SYSTEM ============

const NexusAuth = (() => {
  const SESSION_KEY = 'nexus_session';
  const USERS_KEY = 'nexus_users_db';

  // Initialize user database
  function getUsersDB() {
    try {
      return JSON.parse(localStorage.getItem(USERS_KEY)) || {};
    } catch { return {}; }
  }

  function saveUsersDB(db) {
    localStorage.setItem(USERS_KEY, JSON.stringify(db));
  }

  function getSession() {
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY));
    } catch { return null; }
  }

  function saveSession(session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
  }

  // Generate discriminator
  function generateDiscriminator() {
    return String(Math.floor(Math.random() * 9999)).padStart(4, '0');
  }

  // Simple hash for password (simulated - in production use bcrypt etc.)
  function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return 'h_' + Math.abs(hash).toString(36) + '_' + str.length;
  }

  // Validate email
  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  // Validate username
  function isValidUsername(username) {
    return /^[a-zA-Z0-9_]{3,20}$/.test(username);
  }

  // Sign up
  function signUp(data) {
    const { email, displayName, username, password } = data;
    const errors = {};

    if (!email || !isValidEmail(email)) errors.email = 'Invalid email address';
    if (!displayName || displayName.length < 1 || displayName.length > 32) errors.displayName = 'Must be 1-32 characters';
    if (!username || !isValidUsername(username)) errors.username = '3-20 chars, letters/numbers/underscore';
    if (!password || password.length < 6) errors.password = 'Must be at least 6 characters';

    if (Object.keys(errors).length > 0) return { success: false, errors };

    const db = getUsersDB();
    const lowerEmail = email.toLowerCase();
    const lowerUsername = username.toLowerCase();

    // Check if email exists
    for (const uid in db) {
      if (db[uid].email === lowerEmail) {
        return { success: false, errors: { email: 'Email already registered' } };
      }
      if (db[uid].username === lowerUsername) {
        return { success: false, errors: { username: 'Username already taken' } };
      }
    }

    const discriminator = generateDiscriminator();
    const userId = 'u-' + Date.now().toString(36);
    const colors = ['#0ea5e9', '#f87171', '#a78bfa', '#06d6a0', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6', '#e879f9'];
    const color = colors[Math.floor(Math.random() * colors.length)];

    const user = {
      id: userId,
      email: lowerEmail,
      displayName: displayName,
      username: lowerUsername,
      discriminator: discriminator,
      tag: lowerUsername + '#' + discriminator,
      password: simpleHash(password),
      avatar: null,
      avatarEmoji: null,
      color: color,
      initials: displayName.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase(),
      status: 'online',
      customStatus: '',
      about: 'Hey there! I\'m using Nexus Chat.',
      bannerColor: '#0ea5e9',
      roles: [{ name: 'Member', color: '#0ea5e9' }],
      friends: [],
      friendRequests: { incoming: [], outgoing: [] },
      blocked: [],
      createdAt: new Date().toISOString()
    };

    db[userId] = user;
    saveUsersDB(db);

    const session = { userId, token: 'tok_' + Date.now().toString(36) + Math.random().toString(36).slice(2) };
    saveSession(session);

    return { success: true, user };
  }

  // Sign in
  function signIn(data) {
    const { email, password } = data;
    const errors = {};

    if (!email) errors.email = 'Required';
    if (!password) errors.password = 'Required';

    if (Object.keys(errors).length > 0) return { success: false, errors };

    const db = getUsersDB();
    const lowerEmail = email.toLowerCase();
    const hashedPw = simpleHash(password);

    for (const uid in db) {
      if ((db[uid].email === lowerEmail || db[uid].username === lowerEmail) && db[uid].password === hashedPw) {
        db[uid].status = 'online';
        saveUsersDB(db);
        const session = { userId: uid, token: 'tok_' + Date.now().toString(36) + Math.random().toString(36).slice(2) };
        saveSession(session);
        return { success: true, user: db[uid] };
      }
    }

    return { success: false, errors: { email: 'Invalid email/username or password' } };
  }

  // Logout
  function logout() {
    const session = getSession();
    if (session) {
      const db = getUsersDB();
      if (db[session.userId]) {
        db[session.userId].status = 'offline';
        saveUsersDB(db);
      }
    }
    clearSession();
  }

  // Get current user from session
  function getCurrentUser() {
    const session = getSession();
    if (!session) return null;
    const db = getUsersDB();
    return db[session.userId] || null;
  }

  // Update user profile
  function updateProfile(updates) {
    const session = getSession();
    if (!session) return false;
    const db = getUsersDB();
    if (!db[session.userId]) return false;

    const user = db[session.userId];

    if (updates.displayName !== undefined) {
      if (updates.displayName.length >= 1 && updates.displayName.length <= 32) {
        user.displayName = updates.displayName;
        user.initials = updates.displayName.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
      }
    }
    if (updates.username !== undefined) {
      const lower = updates.username.toLowerCase();
      if (isValidUsername(lower)) {
        // Check uniqueness
        let taken = false;
        for (const uid in db) {
          if (uid !== session.userId && db[uid].username === lower) { taken = true; break; }
        }
        if (!taken) {
          user.username = lower;
          user.tag = lower + '#' + user.discriminator;
        }
      }
    }
    if (updates.about !== undefined) user.about = updates.about.substring(0, 190);
    if (updates.customStatus !== undefined) user.customStatus = updates.customStatus.substring(0, 128);
    if (updates.status !== undefined) user.status = updates.status;
    if (updates.bannerColor !== undefined) user.bannerColor = updates.bannerColor;
    if (updates.color !== undefined) user.color = updates.color;
    if (updates.avatar !== undefined) user.avatar = updates.avatar;
    if (updates.avatarEmoji !== undefined) user.avatarEmoji = updates.avatarEmoji;

    db[session.userId] = user;
    saveUsersDB(db);
    return true;
  }

  return { signUp, signIn, logout, getCurrentUser, getSession, updateProfile, getUsersDB, saveUsersDB };
})();


// ============ AUTH UI ============

function showAuthScreen() {
  // Remove existing
  const existing = document.querySelector('.auth-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'auth-overlay';
  overlay.id = 'authOverlay';
  overlay.innerHTML = `
    <div class="auth-bg-animation">
      <div class="orb"></div>
      <div class="orb"></div>
      <div class="orb"></div>
    </div>
    <div class="auth-container" id="authContainer">
      <!-- Will be populated -->
    </div>
  `;
  document.body.appendChild(overlay);
  showLoginForm();
}

function showLoginForm() {
  const container = document.getElementById('authContainer');
  container.innerHTML = `
    <div class="auth-header">
      <div class="auth-logo">N</div>
      <h1>Welcome back!</h1>
      <p>We're so excited to see you again!</p>
    </div>
    <div class="auth-body">
      <div class="auth-form-group">
        <label>Email or Username <span class="required">*</span><span class="error-text" id="loginEmailError"></span></label>
        <input class="auth-input" id="loginEmail" type="text" autocomplete="email">
      </div>
      <div class="auth-form-group">
        <label>Password <span class="required">*</span><span class="error-text" id="loginPasswordError"></span></label>
        <div class="auth-input-with-icon">
          <input class="auth-input" id="loginPassword" type="password" autocomplete="current-password">
          <button class="auth-input-toggle" onclick="togglePasswordVisibility('loginPassword', this)">👁️</button>
        </div>
      </div>
      <a style="font-size:13px;color:var(--nexus-primary);cursor:pointer;display:block;margin-bottom:8px;">Forgot your password?</a>
      <button class="auth-btn" id="loginBtn" onclick="handleLogin()">Log In</button>
      <div class="auth-switch">
        Need an account? <a onclick="showSignupForm()">Register</a>
      </div>
    </div>
  `;

  // Enter key handler
  setTimeout(() => {
    const emailInput = document.getElementById('loginEmail');
    const pwInput = document.getElementById('loginPassword');
    if (emailInput) emailInput.focus();
    [emailInput, pwInput].forEach(el => {
      if (el) el.addEventListener('keydown', e => { if (e.key === 'Enter') handleLogin(); });
    });
  }, 100);
}

function showSignupForm() {
  const container = document.getElementById('authContainer');
  container.innerHTML = `
    <div class="auth-header">
      <div class="auth-logo">N</div>
      <h1>Create an account</h1>
    </div>
    <div class="auth-body">
      <div class="auth-form-group">
        <label>Email <span class="required">*</span><span class="error-text" id="signupEmailError"></span></label>
        <input class="auth-input" id="signupEmail" type="email" autocomplete="email">
      </div>
      <div class="auth-form-group">
        <label>Display Name <span class="required">*</span><span class="error-text" id="signupDisplayNameError"></span></label>
        <input class="auth-input" id="signupDisplayName" type="text" autocomplete="name">
      </div>
      <div class="auth-form-group">
        <label>Username <span class="required">*</span><span class="error-text" id="signupUsernameError"></span></label>
        <input class="auth-input" id="signupUsername" type="text" autocomplete="username">
      </div>
      <div class="auth-form-group">
        <label>Password <span class="required">*</span><span class="error-text" id="signupPasswordError"></span></label>
        <div class="auth-input-with-icon">
          <input class="auth-input" id="signupPassword" type="password" autocomplete="new-password">
          <button class="auth-input-toggle" onclick="togglePasswordVisibility('signupPassword', this)">👁️</button>
        </div>
      </div>
      <div class="auth-form-group">
        <label>Date of Birth <span class="required">*</span></label>
        <div class="auth-dob-row">
          <select id="signupMonth">
            <option value="">Month</option>
            ${['January','February','March','April','May','June','July','August','September','October','November','December'].map((m,i) => `<option value="${i+1}">${m}</option>`).join('')}
          </select>
          <select id="signupDay">
            <option value="">Day</option>
            ${Array.from({length:31},(_,i) => `<option value="${i+1}">${i+1}</option>`).join('')}
          </select>
          <select id="signupYear">
            <option value="">Year</option>
            ${Array.from({length:50},(_,i) => `<option value="${2010-i}">${2010-i}</option>`).join('')}
          </select>
        </div>
      </div>
      <button class="auth-btn" id="signupBtn" onclick="handleSignup()">Continue</button>
      <div class="auth-tos">
        By registering, you agree to Nexus's <a href="#">Terms of Service</a> and <a href="#">Privacy Policy</a>.
      </div>
      <div class="auth-switch">
        Already have an account? <a onclick="showLoginForm()">Log In</a>
      </div>
    </div>
  `;

  setTimeout(() => {
    const emailInput = document.getElementById('signupEmail');
    if (emailInput) emailInput.focus();
    document.querySelectorAll('#authContainer .auth-input').forEach(el => {
      el.addEventListener('keydown', e => { if (e.key === 'Enter') handleSignup(); });
    });
  }, 100);
}

function togglePasswordVisibility(inputId, btn) {
  const input = document.getElementById(inputId);
  if (input.type === 'password') {
    input.type = 'text';
    btn.textContent = '🙈';
  } else {
    input.type = 'password';
    btn.textContent = '👁️';
  }
}

function handleLogin() {
  const btn = document.getElementById('loginBtn');
  btn.classList.add('loading');
  btn.textContent = 'Logging in...';

  // Clear errors
  document.querySelectorAll('.error-text').forEach(el => el.textContent = '');
  document.querySelectorAll('.auth-input.error').forEach(el => el.classList.remove('error'));

  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  // Use backend API
  NexusBackend.handleLogin(email, password).then(result => {
    if (result.success) {
      // Also update legacy NexusAuth for any code still referencing it
      try { NexusAuth.signIn({ email, password }); } catch(e) {}
      applyUserToApp(result.user);
      const overlay = document.getElementById('authOverlay');
      overlay.style.transition = 'opacity 0.4s';
      overlay.style.opacity = '0';
      setTimeout(() => {
        overlay.remove();
        // Reload server/channel data after login
        if (typeof switchServer === 'function' && typeof activeServer !== 'undefined') {
          NexusBackend.loadServerDetail(activeServer).then(() => {
            switchServer(activeServer);
          });
        }
      }, 400);
      if (typeof showToast === 'function') showToast(`Welcome back, ${result.user.displayName}! 👋`);
    } else {
      btn.classList.remove('loading');
      btn.textContent = 'Log In';
      const errors = result.errors || { email: result.error || 'Login failed' };
      for (const field in errors) {
        const errorEl = document.getElementById(`login${field.charAt(0).toUpperCase() + field.slice(1)}Error`);
        if (errorEl) errorEl.textContent = ' - ' + errors[field];
        const inputEl = document.getElementById(`login${field.charAt(0).toUpperCase() + field.slice(1)}`);
        if (inputEl) inputEl.classList.add('error');
      }
    }
  });
}

function handleSignup() {
  const btn = document.getElementById('signupBtn');
  btn.classList.add('loading');
  btn.textContent = 'Creating account...';

  // Clear errors
  document.querySelectorAll('.error-text').forEach(el => el.textContent = '');
  document.querySelectorAll('.auth-input.error').forEach(el => el.classList.remove('error'));

  const email = document.getElementById('signupEmail').value.trim();
  const displayName = document.getElementById('signupDisplayName').value.trim();
  const username = document.getElementById('signupUsername').value.trim();
  const password = document.getElementById('signupPassword').value;

  // Use backend API
  NexusBackend.handleSignup(email, displayName, username, password).then(result => {
    if (result.success) {
      // Also update legacy NexusAuth for any code still referencing it
      try { NexusAuth.signUp({ email, displayName, username, password }); } catch(e) {}
      applyUserToApp(result.user);
      const overlay = document.getElementById('authOverlay');
      overlay.style.transition = 'opacity 0.4s';
      overlay.style.opacity = '0';
      setTimeout(() => {
        overlay.remove();
        // Load server/channel data after signup
        if (typeof switchServer === 'function' && typeof activeServer !== 'undefined') {
          NexusBackend.loadServerDetail(activeServer).then(() => {
            switchServer(activeServer);
          });
        }
      }, 400);
      if (typeof showToast === 'function') showToast(`Welcome to Nexus, ${result.user.displayName}! 🎉`);
    } else {
      btn.classList.remove('loading');
      btn.textContent = 'Continue';
      const errors = result.errors || { email: result.error || 'Registration failed' };
      for (const field in errors) {
        const errorEl = document.getElementById(`signup${field.charAt(0).toUpperCase() + field.slice(1)}Error`);
        if (errorEl) errorEl.textContent = ' - ' + errors[field];
        const inputEl = document.getElementById(`signup${field.charAt(0).toUpperCase() + field.slice(1)}`);
        if (inputEl) inputEl.classList.add('error');
      }
    }
  });
}

// Apply authenticated user to the app's data model
function applyUserToApp(user) {
  if (typeof currentUser !== 'undefined') {
    currentUser.id = 'u-self';
    currentUser.name = user.displayName;
    currentUser.tag = user.tag;
    currentUser.color = user.color;
    currentUser.initials = user.initials;
    currentUser.status = user.status;
    currentUser.about = user.about;
    currentUser.avatar = user.avatar;
    currentUser.avatarEmoji = user.avatarEmoji;
    currentUser.bannerColor = user.bannerColor || '#0ea5e9';
    currentUser.customStatus = user.customStatus || '';
    currentUser._authId = user.id;
  }

  // Update UI elements
  const panelName = document.querySelector('.user-panel-name');
  if (panelName) panelName.textContent = user.displayName;

  const panelTag = document.querySelector('.user-panel-tag');
  if (panelTag) panelTag.textContent = user.customStatus || user.status.charAt(0).toUpperCase() + user.status.slice(1);

  const panelAvatar = document.querySelector('.user-panel-avatar');
  if (panelAvatar) {
    if (user.avatarEmoji) {
      panelAvatar.innerHTML = user.avatarEmoji + '<div class="status-dot ' + user.status + '"></div>';
    } else if (user.avatar) {
      panelAvatar.innerHTML = '<img src="' + user.avatar + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">' + '<div class="status-dot ' + user.status + '"></div>';
    } else {
      panelAvatar.innerHTML = user.initials + '<div class="status-dot ' + user.status + '"></div>';
    }
    panelAvatar.style.background = user.avatar ? 'transparent' : user.color;
  }

  // Update settings page if visible
  updateSettingsDisplay(user);
}

function updateSettingsDisplay(user) {
  const settingsContent = document.getElementById('settingsContent');
  if (!settingsContent) return;

  // Update account section avatar and name
  const accountAvatar = settingsContent.querySelector('.settings-card div[style*="80px"]');
  if (accountAvatar) {
    accountAvatar.style.background = user.color;
  }
}


// ============ PROFILE CUSTOMIZER ============

function openProfileEditor() {
  let overlay = document.getElementById('profileEditorOverlay');
  if (overlay) {
    overlay.classList.add('visible');
    renderProfileEditor();
    return;
  }

  overlay = document.createElement('div');
  overlay.className = 'profile-editor-overlay visible';
  overlay.id = 'profileEditorOverlay';
  overlay.innerHTML = `
    <div class="profile-editor" id="profileEditorContent">
      <!-- Populated by renderProfileEditor -->
    </div>
  `;
  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeProfileEditor();
  });
  document.body.appendChild(overlay);
  renderProfileEditor();
}

function closeProfileEditor() {
  const overlay = document.getElementById('profileEditorOverlay');
  if (overlay) overlay.classList.remove('visible');
}

function renderProfileEditor() {
  const authUser = NexusAuth.getCurrentUser();
  const user = authUser || currentUser;

  const content = document.getElementById('profileEditorContent');
  if (!content) return;

  const avatarColors = ['#0ea5e9','#f87171','#a78bfa','#06d6a0','#f59e0b','#ec4899','#8b5cf6','#14b8a6','#e879f9','#38bdf8'];
  const avatarEmojis = ['😎','🎮','🎵','🎨','💻','🚀','🌟','🔥','💎','🦊','🐱','🐺','🦁','🐉','🤖','👾','🎭','🌈'];
  const bannerColors = ['#0ea5e9','#f87171','#a78bfa','#06d6a0','#f59e0b','#ec4899','#8b5cf6','#14b8a6','#e879f9','#1e293b','#dc2626','#059669','#7c3aed','#ea580c'];

  const currentAvatar = user.avatarEmoji || user.initials || 'N';
  const currentBanner = user.bannerColor || '#0ea5e9';
  const currentColor = user.color || '#0ea5e9';

  content.innerHTML = `
    <div class="profile-editor-left">
      <h2>Edit Profile</h2>

      <h3>Avatar</h3>
      <div class="avatar-picker">
        <div class="avatar-picker-preview" id="avatarPreviewMain" style="background:${currentColor}">
          ${user.avatarEmoji || user.initials || 'N'}
        </div>
        <div class="avatar-picker-options">
          ${avatarEmojis.map(e => `<div class="avatar-option ${user.avatarEmoji === e ? 'selected' : ''}" style="background:${currentColor}" onclick="selectAvatarEmoji('${e}', this)">${e}</div>`).join('')}
        </div>
      </div>

      <h3>Avatar Color</h3>
      <div class="banner-color-picker" id="avatarColorPicker">
        ${avatarColors.map(c => `<div class="banner-color-option ${currentColor === c ? 'selected' : ''}" style="background:${c}" onclick="selectAvatarColor('${c}', this)"></div>`).join('')}
      </div>

      <div class="profile-field">
        <label>Display Name</label>
        <input id="profileDisplayName" value="${(user.displayName || user.name || '').replace(/"/g, '&quot;')}" maxlength="32">
        <div class="char-count"><span id="displayNameCount">${(user.displayName || user.name || '').length}</span>/32</div>
      </div>

      <div class="profile-field">
        <label>Username</label>
        <input id="profileUsername" value="${(user.username || user.tag?.split('#')[0] || '').replace(/"/g, '&quot;')}" maxlength="20">
      </div>

      <h3>Status</h3>
      <div class="status-selector">
        ${['online','idle','dnd','offline'].map(s => `
          <div class="status-option ${(user.status || 'online') === s ? 'selected' : ''}" onclick="selectStatus('${s}', this)">
            <div class="status-dot-preview" style="background:${s === 'online' ? '#06d6a0' : s === 'idle' ? '#f59e0b' : s === 'dnd' ? '#f87171' : '#64748b'}"></div>
            <div class="status-label">${s === 'dnd' ? 'Do Not Disturb' : s.charAt(0).toUpperCase() + s.slice(1)}</div>
          </div>
        `).join('')}
      </div>

      <div class="profile-field">
        <label>Custom Status</label>
        <input id="profileCustomStatus" value="${(user.customStatus || '').replace(/"/g, '&quot;')}" placeholder="What's on your mind?" maxlength="128">
      </div>

      <div class="profile-field">
        <label>About Me</label>
        <textarea id="profileAbout" maxlength="190" placeholder="Tell us about yourself...">${user.about || ''}</textarea>
        <div class="char-count"><span id="aboutCount">${(user.about || '').length}</span>/190</div>
      </div>

      <h3>Profile Banner Color</h3>
      <div class="banner-color-picker" id="bannerColorPicker">
        ${bannerColors.map(c => `<div class="banner-color-option ${currentBanner === c ? 'selected' : ''}" style="background:${c}" onclick="selectBannerColor('${c}', this)"></div>`).join('')}
      </div>
    </div>

    <div class="profile-editor-right">
      <h3>Preview</h3>
      <div class="profile-preview-card" id="profilePreviewCard">
        <div class="profile-preview-banner" id="previewBanner" style="background:${currentBanner}">
          <div class="profile-preview-avatar-wrap">
            <div class="profile-preview-avatar" id="previewAvatar" style="background:${currentColor}">
              ${currentAvatar}
            </div>
            <div class="profile-preview-status-dot" id="previewStatusDot" style="background:${user.status === 'online' ? '#06d6a0' : user.status === 'idle' ? '#f59e0b' : user.status === 'dnd' ? '#f87171' : '#64748b'}"></div>
          </div>
        </div>
        <div class="profile-preview-body">
          <div class="profile-preview-name" id="previewName">${user.displayName || user.name || 'NexusUser'}</div>
          <div class="profile-preview-tag" id="previewTag">${user.tag || 'nexususer#0000'}</div>
          <div id="previewCustomStatus" style="font-size:12px;color:var(--text-muted);margin-bottom:8px;${user.customStatus ? '' : 'display:none'}">${user.customStatus || ''}</div>
          <div class="profile-preview-divider"></div>
          <div class="profile-preview-section">
            <h4>About Me</h4>
            <p id="previewAbout">${user.about || 'No bio yet.'}</p>
          </div>
          <div class="profile-preview-section">
            <h4>Roles</h4>
            <div class="profile-preview-roles">
              ${(user.roles || [{name:'Member',color:'#0ea5e9'}]).map(r => `<div class="profile-preview-role"><div class="dot" style="background:${r.color}"></div>${r.name}</div>`).join('')}
            </div>
          </div>
        </div>
      </div>

      <div class="profile-editor-actions">
        <button class="btn btn-secondary" onclick="closeProfileEditor()">Cancel</button>
        <button class="btn btn-primary" onclick="saveProfile()">Save Changes</button>
      </div>
    </div>
  `;

  // Live preview bindings
  const displayNameInput = document.getElementById('profileDisplayName');
  const usernameInput = document.getElementById('profileUsername');
  const aboutInput = document.getElementById('profileAbout');
  const customStatusInput = document.getElementById('profileCustomStatus');

  if (displayNameInput) {
    displayNameInput.addEventListener('input', () => {
      document.getElementById('previewName').textContent = displayNameInput.value || 'NexusUser';
      document.getElementById('displayNameCount').textContent = displayNameInput.value.length;
    });
  }
  if (usernameInput) {
    usernameInput.addEventListener('input', () => {
      const disc = user.discriminator || user.tag?.split('#')[1] || '0000';
      document.getElementById('previewTag').textContent = (usernameInput.value || 'nexususer') + '#' + disc;
    });
  }
  if (aboutInput) {
    aboutInput.addEventListener('input', () => {
      document.getElementById('previewAbout').textContent = aboutInput.value || 'No bio yet.';
      document.getElementById('aboutCount').textContent = aboutInput.value.length;
    });
  }
  if (customStatusInput) {
    customStatusInput.addEventListener('input', () => {
      const el = document.getElementById('previewCustomStatus');
      el.textContent = customStatusInput.value;
      el.style.display = customStatusInput.value ? 'block' : 'none';
    });
  }
}

// Profile editor helpers
let _selectedAvatarEmoji = null;
let _selectedAvatarColor = null;
let _selectedBannerColor = null;
let _selectedStatus = null;

function selectAvatarEmoji(emoji, el) {
  _selectedAvatarEmoji = emoji;
  document.querySelectorAll('.avatar-option').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
  document.getElementById('avatarPreviewMain').textContent = emoji;
  document.getElementById('previewAvatar').textContent = emoji;
}

function selectAvatarColor(color, el) {
  _selectedAvatarColor = color;
  document.querySelectorAll('#avatarColorPicker .banner-color-option').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
  document.getElementById('avatarPreviewMain').style.background = color;
  document.getElementById('previewAvatar').style.background = color;
  document.querySelectorAll('.avatar-option').forEach(o => o.style.background = color);
}

function selectBannerColor(color, el) {
  _selectedBannerColor = color;
  document.querySelectorAll('#bannerColorPicker .banner-color-option').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
  document.getElementById('previewBanner').style.background = color;
}

function selectStatus(status, el) {
  _selectedStatus = status;
  document.querySelectorAll('.status-option').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
  const colors = { online: '#06d6a0', idle: '#f59e0b', dnd: '#f87171', offline: '#64748b' };
  document.getElementById('previewStatusDot').style.background = colors[status];
}

function saveProfile() {
  const displayName = document.getElementById('profileDisplayName')?.value.trim();
  const username = document.getElementById('profileUsername')?.value.trim();
  const about = document.getElementById('profileAbout')?.value;
  const customStatus = document.getElementById('profileCustomStatus')?.value.trim();

  const updates = {};
  if (displayName) updates.displayName = displayName;
  if (username) updates.username = username;
  if (about !== undefined) updates.about = about;
  if (customStatus !== undefined) updates.customStatus = customStatus;
  if (_selectedAvatarEmoji) updates.avatarEmoji = _selectedAvatarEmoji;
  if (_selectedAvatarColor) updates.color = _selectedAvatarColor;
  if (_selectedBannerColor) updates.bannerColor = _selectedBannerColor;
  if (_selectedStatus) updates.status = _selectedStatus;

  // Update auth DB
  NexusBackend.handleUpdateProfile(updates);

  // Apply to app
  const authUser = NexusAuth.getCurrentUser();
  if (authUser) {
    applyUserToApp(authUser);
  } else {
    // Fallback: update currentUser directly
    if (displayName) { currentUser.name = displayName; currentUser.initials = displayName.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase(); }
    if (about !== undefined) currentUser.about = about;
    if (_selectedAvatarEmoji) currentUser.avatarEmoji = _selectedAvatarEmoji;
    if (_selectedAvatarColor) currentUser.color = _selectedAvatarColor;
    if (_selectedBannerColor) currentUser.bannerColor = _selectedBannerColor;
    if (_selectedStatus) currentUser.status = _selectedStatus;
    if (customStatus !== undefined) currentUser.customStatus = customStatus;

    const panelName = document.querySelector('.user-panel-name');
    if (panelName) panelName.textContent = currentUser.name;
    const panelAvatar = document.querySelector('.user-panel-avatar');
    if (panelAvatar) {
      panelAvatar.style.background = currentUser.color;
      panelAvatar.innerHTML = (currentUser.avatarEmoji || currentUser.initials) + '<div class="status-dot ' + (currentUser.status || 'online') + '"></div>';
    }
  }

  // Reset temp vars
  _selectedAvatarEmoji = null;
  _selectedAvatarColor = null;
  _selectedBannerColor = null;
  _selectedStatus = null;

  closeProfileEditor();
  if (typeof showToast === 'function') showToast('Profile updated! ✨');
}


// ============ FRIENDS SYSTEM ============

const NexusFriends = (() => {
  // Friend data loaded from backend
  let friendsData = {
    friends: [],
    incoming: [],
    outgoing: [],
    blocked: []
  };

  let activeTab = 'online';

  function getFriends() { return friendsData.friends; }
  function getIncoming() { return friendsData.incoming; }
  function getOutgoing() { return friendsData.outgoing; }
  function getBlocked() { return friendsData.blocked; }

  function acceptRequest(userId) {
    const idx = friendsData.incoming.findIndex(r => r.userId === userId);
    if (idx !== -1) {
      friendsData.incoming.splice(idx, 1);
      friendsData.friends.push({ userId, since: new Date().toISOString() });
      return true;
    }
    return false;
  }

  function declineRequest(userId) {
    const idx = friendsData.incoming.findIndex(r => r.userId === userId);
    if (idx !== -1) {
      friendsData.incoming.splice(idx, 1);
      return true;
    }
    return false;
  }

  function removeFriend(userId) {
    const idx = friendsData.friends.findIndex(f => f.userId === userId);
    if (idx !== -1) {
      friendsData.friends.splice(idx, 1);
      return true;
    }
    return false;
  }

  function blockUser(userId) {
    removeFriend(userId);
    declineRequest(userId);
    const outIdx = friendsData.outgoing.findIndex(r => r.userId === userId);
    if (outIdx !== -1) friendsData.outgoing.splice(outIdx, 1);
    if (!friendsData.blocked.find(b => b.userId === userId)) {
      friendsData.blocked.push({ userId, timestamp: new Date().toISOString() });
    }
    return true;
  }

  function unblockUser(userId) {
    const idx = friendsData.blocked.findIndex(b => b.userId === userId);
    if (idx !== -1) {
      friendsData.blocked.splice(idx, 1);
      return true;
    }
    return false;
  }

  function sendRequest(usernameOrTag) {
    const lower = usernameOrTag.toLowerCase();
    // Find user by tag or username
    for (const uid in users) {
      const u = users[uid];
      if (uid === 'u-self') continue;
      if (u.tag?.toLowerCase() === lower || u.name?.toLowerCase() === lower || u.tag?.split('#')[0]?.toLowerCase() === lower) {
        // Check if already friends
        if (friendsData.friends.find(f => f.userId === uid)) return { success: false, message: 'Already friends!' };
        if (friendsData.outgoing.find(r => r.userId === uid)) return { success: false, message: 'Request already sent!' };
        if (friendsData.blocked.find(b => b.userId === uid)) return { success: false, message: 'User is blocked.' };
        // Check if they sent us a request
        const inIdx = friendsData.incoming.findIndex(r => r.userId === uid);
        if (inIdx !== -1) {
          acceptRequest(uid);
          return { success: true, message: `You are now friends with ${u.name}!`, accepted: true };
        }
        friendsData.outgoing.push({ userId: uid, timestamp: new Date().toISOString() });
        return { success: true, message: `Friend request sent to ${u.name}!` };
      }
    }
    return { success: false, message: 'User not found. Make sure the username is correct.' };
  }

  function getMutualServers(userId) {
    const mutuals = [];
    if (typeof servers !== 'undefined') {
      for (const sid in servers) {
        if (sid === 'home') continue;
        mutuals.push({ id: sid, name: servers[sid].name });
        if (mutuals.length >= 3) break;
      }
    }
    return mutuals;
  }

  return {
    getFriends, getIncoming, getOutgoing, getBlocked,
    acceptRequest, declineRequest, removeFriend, blockUser, unblockUser,
    sendRequest, getMutualServers,
    get activeTab() { return activeTab; },
    set activeTab(v) { activeTab = v; }
  };
})();


// ============ FRIENDS UI ============

function showFriendsPage() {
  // Hide normal chat content, show friends page
  const chatWrapper = document.querySelector('.chat-content-wrapper');
  const chatHeader = document.querySelector('.chat-header');
  const messageBar = document.querySelector('.message-bar, .chat-input-container');

  // Create or show friends page
  let friendsPage = document.getElementById('friendsPage');
  if (!friendsPage) {
    friendsPage = document.createElement('div');
    friendsPage.className = 'friends-page';
    friendsPage.id = 'friendsPage';
    const mainContent = document.querySelector('.main-content');
    if (mainContent) mainContent.appendChild(friendsPage);
  }

  friendsPage.classList.add('visible');
  if (chatWrapper) chatWrapper.style.display = 'none';

  // Replace header
  if (chatHeader) {
    chatHeader.innerHTML = `
      <div class="friends-header">
        <div class="friends-header-title">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
          Friends
        </div>
        <div class="friends-header-divider"></div>
        <div class="friends-tab ${NexusFriends.activeTab === 'online' ? 'active' : ''}" onclick="switchFriendsTab('online')">Online</div>
        <div class="friends-tab ${NexusFriends.activeTab === 'all' ? 'active' : ''}" onclick="switchFriendsTab('all')">All</div>
        <div class="friends-tab ${NexusFriends.activeTab === 'pending' ? 'active' : ''}" onclick="switchFriendsTab('pending')">
          Pending
          ${(NexusFriends.getIncoming().length > 0) ? `<span class="tab-badge">${NexusFriends.getIncoming().length}</span>` : ''}
        </div>
        <div class="friends-tab ${NexusFriends.activeTab === 'blocked' ? 'active' : ''}" onclick="switchFriendsTab('blocked')">Blocked</div>
        <button class="friends-tab-add" onclick="switchFriendsTab('add')">Add Friend</button>
      </div>
    `;
  }

  renderFriendsContent();
}

function hideFriendsPage() {
  const friendsPage = document.getElementById('friendsPage');
  if (friendsPage) friendsPage.classList.remove('visible');
  const chatWrapper = document.querySelector('.chat-content-wrapper');
  if (chatWrapper) chatWrapper.style.display = '';
}

function switchFriendsTab(tab) {
  NexusFriends.activeTab = tab;
  document.querySelectorAll('.friends-tab').forEach(t => t.classList.remove('active'));
  const tabs = document.querySelectorAll('.friends-tab');
  tabs.forEach(t => {
    if (t.textContent.trim().toLowerCase().startsWith(tab)) t.classList.add('active');
  });
  renderFriendsContent();
}

function renderFriendsContent() {
  const friendsPage = document.getElementById('friendsPage');
  if (!friendsPage) return;

  const tab = NexusFriends.activeTab;

  if (tab === 'add') {
    friendsPage.innerHTML = `
      <div class="add-friend-section visible">
        <h2>Add Friend</h2>
        <p>You can add friends with their Nexus username.</p>
        <div class="add-friend-input-row" id="addFriendRow">
          <input id="addFriendInput" placeholder="Enter a username#0000" onkeydown="if(event.key==='Enter')sendFriendRequest()">
          <button onclick="sendFriendRequest()" id="addFriendBtn">Send Friend Request</button>
        </div>
        <div id="addFriendResult" style="margin-top:12px;font-size:13px;"></div>
      </div>
      <div style="padding:20px;">
        <div class="friends-section-label">OTHER PLACES TO MAKE FRIENDS</div>
        <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:8px;">
          ${getQuickAddSuggestions()}
        </div>
      </div>
    `;
    setTimeout(() => document.getElementById('addFriendInput')?.focus(), 100);
    return;
  }

  let items = [];

  if (tab === 'online') {
    items = NexusFriends.getFriends().filter(f => {
      const u = users[f.userId];
      return u && u.status !== 'offline';
    });
  } else if (tab === 'all') {
    items = NexusFriends.getFriends();
  } else if (tab === 'pending') {
    const incoming = NexusFriends.getIncoming();
    const outgoing = NexusFriends.getOutgoing();

    friendsPage.innerHTML = `
      <div class="friends-body">
        <div class="friends-search">
          <input placeholder="Search pending requests" oninput="filterFriendsList(this.value)">
        </div>
        ${incoming.length > 0 ? `
          <div class="friends-section-label">INCOMING — ${incoming.length}</div>
          ${incoming.map(r => renderPendingItem(r, 'incoming')).join('')}
        ` : ''}
        ${outgoing.length > 0 ? `
          <div class="friends-section-label" style="margin-top:16px;">OUTGOING — ${outgoing.length}</div>
          ${outgoing.map(r => renderPendingItem(r, 'outgoing')).join('')}
        ` : ''}
        ${incoming.length === 0 && outgoing.length === 0 ? `
          <div class="friends-empty">
            <div class="friends-empty-icon">📭</div>
            <h3>No pending requests</h3>
            <p>When someone sends you a friend request, it'll show up here.</p>
          </div>
        ` : ''}
      </div>
    `;
    return;
  } else if (tab === 'blocked') {
    const blocked = NexusFriends.getBlocked();
    friendsPage.innerHTML = `
      <div class="friends-body">
        ${blocked.length > 0 ? `
          <div class="friends-section-label">BLOCKED — ${blocked.length}</div>
          ${blocked.map(b => renderBlockedItem(b)).join('')}
        ` : `
          <div class="friends-empty">
            <div class="friends-empty-icon">🚫</div>
            <h3>No blocked users</h3>
            <p>You haven't blocked anyone. Good vibes only!</p>
          </div>
        `}
      </div>
    `;
    return;
  }

  const label = tab === 'online' ? 'ONLINE' : 'ALL FRIENDS';

  friendsPage.innerHTML = `
    <div class="friends-body">
      <div class="friends-search">
        <input placeholder="Search friends" oninput="filterFriendsList(this.value)">
      </div>
      ${items.length > 0 ? `
        <div class="friends-section-label">${label} — ${items.length}</div>
        <div id="friendsList">
          ${items.map(f => renderFriendItem(f)).join('')}
        </div>
      ` : `
        <div class="friends-empty">
          <div class="friends-empty-icon">${tab === 'online' ? '😴' : '👥'}</div>
          <h3>${tab === 'online' ? 'No friends online' : 'No friends yet'}</h3>
          <p>${tab === 'online' ? 'Looks like everyone is away. Check back later!' : 'Add some friends to get started!'}</p>
        </div>
      `}
    </div>
  `;
}

function renderFriendItem(friend) {
  const u = users[friend.userId];
  if (!u) return '';

  const statusColors = { online: '#06d6a0', idle: '#f59e0b', dnd: '#f87171', offline: '#64748b' };
  const statusText = u.status === 'dnd' ? 'Do Not Disturb' : u.status ? u.status.charAt(0).toUpperCase() + u.status.slice(1) : 'Offline';
  const mutuals = NexusFriends.getMutualServers(friend.userId);

  return `
    <div class="friend-item" data-user="${friend.userId}">
      <div class="friend-avatar" style="background:${u.color}">
        ${u.initials || '?'}
        <div class="friend-status-dot" style="background:${statusColors[u.status] || '#64748b'}"></div>
      </div>
      <div class="friend-info">
        <div class="friend-name">${u.name}</div>
        <div class="friend-status-text">${u.about || statusText}</div>
        ${mutuals.length > 0 ? `
          <div class="friend-mutual-servers">
            ${mutuals.map(s => `<div class="friend-mutual-server" style="background:var(--nexus-primary)" title="${s.name}">${s.name[0]}</div>`).join('')}
            <span style="font-size:10px;color:var(--text-muted);margin-left:2px;">${mutuals.length} mutual server${mutuals.length > 1 ? 's' : ''}</span>
          </div>
        ` : ''}
      </div>
      <div class="friend-actions">
        <button class="friend-action-btn" title="Message" onclick="openDMFromFriend('${friend.userId}')">💬</button>
        <button class="friend-action-btn" title="Voice Call" onclick="startCallFromFriend('${friend.userId}', 'voice')">📞</button>
        <button class="friend-action-btn" title="More" onclick="showFriendContextMenu(event, '${friend.userId}')">⋮</button>
      </div>
    </div>
  `;
}

function renderPendingItem(request, type) {
  const u = users[request.userId];
  if (!u) return '';

  return `
    <div class="friend-item" data-user="${request.userId}">
      <div class="friend-avatar" style="background:${u.color}">
        ${u.initials || '?'}
      </div>
      <div class="friend-info">
        <div class="friend-name">${u.name}</div>
        <div class="friend-status-text">${type === 'incoming' ? 'Incoming Friend Request' : 'Outgoing Friend Request'}</div>
      </div>
      <div class="friend-actions">
        ${type === 'incoming' ? `
          <button class="friend-action-btn accept" title="Accept" onclick="acceptFriendRequest('${request.userId}')">✓</button>
          <button class="friend-action-btn decline" title="Decline" onclick="declineFriendRequest('${request.userId}')">✕</button>
        ` : `
          <button class="friend-action-btn decline" title="Cancel" onclick="cancelFriendRequest('${request.userId}')">✕</button>
        `}
      </div>
    </div>
  `;
}

function renderBlockedItem(blocked) {
  const u = users[blocked.userId];
  if (!u) return '';

  return `
    <div class="friend-item" data-user="${blocked.userId}">
      <div class="friend-avatar" style="background:${u.color};opacity:0.5">
        ${u.initials || '?'}
      </div>
      <div class="friend-info">
        <div class="friend-name" style="opacity:0.7">${u.name}</div>
        <div class="friend-status-text">Blocked</div>
      </div>
      <div class="friend-actions">
        <button class="friend-action-btn" title="Unblock" onclick="unblockFriendUser('${blocked.userId}')">Unblock</button>
      </div>
    </div>
  `;
}

function getQuickAddSuggestions() {
  const friendIds = NexusFriends.getFriends().map(f => f.userId);
  const selfId = currentUser.id || currentUser._authId || 'u-self';
  const suggestions = Object.values(users).filter(u => u.id !== selfId && !u.isBot && !friendIds.includes(u.id));

  return suggestions.slice(0, 4).map(u => `
    <div style="background:var(--bg-primary);border-radius:8px;padding:12px;flex:1;min-width:140px;text-align:center;">
      <div style="width:48px;height:48px;border-radius:50%;background:${u.color};display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;color:#fff;margin:0 auto 8px;">${u.initials}</div>
      <div style="font-size:13px;font-weight:600;color:var(--text-primary);">${u.name}</div>
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:8px;">${u.tag || ''}</div>
      <button class="btn btn-primary" style="font-size:12px;padding:4px 12px;" onclick="quickAddFriend('${u.id}')">Add Friend</button>
    </div>
  `).join('');
}

// Friend actions
function sendFriendRequest() {
  const input = document.getElementById('addFriendInput');
  const resultDiv = document.getElementById('addFriendResult');
  if (!input || !input.value.trim()) return;

  // Use backend API
  if (typeof NexusBackend !== 'undefined' && typeof NexusAPI !== 'undefined' && NexusAPI.isAuthenticated()) {
    NexusBackend.sendFriendRequest(input.value.trim()).then(result => {
      const msg = result.message || (result.success ? 'Friend request sent!' : (result.error || 'Failed to send request'));
      resultDiv.innerHTML = `<span style="color:${result.success ? 'var(--nexus-success)' : 'var(--nexus-danger)'}">${msg}</span>`;
      if (result.success) {
        input.value = '';
        if (typeof showToast === 'function') showToast(msg);
        setTimeout(() => renderFriendsContent(), 1000);
      }
    });
  } else {
    const result = NexusFriends.sendRequest(input.value.trim());
    resultDiv.innerHTML = `<span style="color:${result.success ? 'var(--nexus-success)' : 'var(--nexus-danger)'}">${result.message}</span>`;
    if (result.success) {
      input.value = '';
      if (typeof showToast === 'function') showToast(result.message);
      setTimeout(() => renderFriendsContent(), 1000);
    }
  }
}

function quickAddFriend(userId) {
  const u = users[userId];
  if (!u) return;
  const result = NexusFriends.sendRequest(u.tag || u.name);
  if (typeof showToast === 'function') showToast(result.message);
  renderFriendsContent();
}

function acceptFriendRequest(userId) {
  if (typeof NexusBackend !== 'undefined' && typeof NexusAPI !== 'undefined' && NexusAPI.isAuthenticated()) {
    NexusBackend.acceptFriendRequest(userId).then(() => { showFriendsPage(); });
  } else {
    NexusFriends.acceptRequest(userId);
  }
  const u = users[userId];
  if (typeof showToast === 'function') showToast(`You are now friends with ${u?.name || 'user'}! 🎉`);
  showFriendsPage();
}

function declineFriendRequest(userId) {
  if (typeof NexusBackend !== 'undefined' && typeof NexusAPI !== 'undefined' && NexusAPI.isAuthenticated()) {
    NexusBackend.declineFriendRequest(userId).then(() => { showFriendsPage(); });
  } else {
    NexusFriends.declineRequest(userId);
  }
  if (typeof showToast === 'function') showToast('Friend request declined.');
  showFriendsPage();
}

function cancelFriendRequest(userId) {
  const outgoing = NexusFriends.getOutgoing();
  const idx = outgoing.findIndex(r => r.userId === userId);
  if (idx !== -1) outgoing.splice(idx, 1);
  if (typeof showToast === 'function') showToast('Friend request cancelled.');
  showFriendsPage();
}

function unblockFriendUser(userId) {
  if (typeof NexusBackend !== 'undefined' && typeof NexusAPI !== 'undefined' && NexusAPI.isAuthenticated()) {
    NexusBackend.unblockUser(userId).then(() => { showFriendsPage(); });
  } else {
    NexusFriends.unblockUser(userId);
  }
  const u = users[userId];
  if (typeof showToast === 'function') showToast(`${u?.name || 'User'} has been unblocked.`);
  showFriendsPage();
}

function openDMFromFriend(userId) {
  const u = users[userId];
  if (!u) return;

  // Check if DM channel exists
  const homeServer = servers['home'];
  const dmChannels = homeServer?.channels?.['dm'] || [];
  let dmChannel = dmChannels.find(ch => ch.id === 'dm-' + userId.replace('u-', ''));

  if (!dmChannel) {
    // Create DM channel
    dmChannel = {
      id: 'dm-' + userId.replace('u-', ''),
      name: u.name,
      type: 'dm',
      icon: '💬'
    };
    if (!homeServer.channels['dm']) homeServer.channels['dm'] = [];
    homeServer.channels['dm'].push(dmChannel);
  }

  hideFriendsPage();
  if (typeof switchServer === 'function') switchServer('home');
  if (typeof switchChannel === 'function') switchChannel(dmChannel.id);
}

function startCallFromFriend(userId, type) {
  openDMFromFriend(userId);
  setTimeout(() => {
    if (typeof NexusCalls !== 'undefined' && typeof NexusCalls.startCall === 'function') {
      NexusCalls.startCall(userId, type);
    }
  }, 300);
}

function showFriendContextMenu(event, userId) {
  event.stopPropagation();
  const u = users[userId];
  if (!u) return;

  // Remove existing
  const existing = document.querySelector('.friend-context-menu');
  if (existing) existing.remove();

  const menu = document.createElement('div');
  menu.className = 'friend-context-menu';
  menu.style.cssText = `
    position: fixed;
    top: ${event.clientY}px;
    left: ${event.clientX}px;
    background: var(--bg-primary);
    border: 1px solid var(--border-subtle);
    border-radius: 8px;
    padding: 6px;
    z-index: 10000;
    min-width: 180px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.3);
  `;

  const items = [
    { label: '💬 Message', action: () => openDMFromFriend(userId) },
    { label: '📞 Voice Call', action: () => startCallFromFriend(userId, 'voice') },
    { label: '📹 Video Call', action: () => startCallFromFriend(userId, 'video') },
    { separator: true },
    { label: '❌ Remove Friend', action: () => { NexusFriends.removeFriend(userId); showToast(`Removed ${u.name} from friends.`); showFriendsPage(); }, danger: true },
    { label: '🚫 Block', action: () => { NexusFriends.blockUser(userId); showToast(`Blocked ${u.name}.`); showFriendsPage(); }, danger: true }
  ];

  items.forEach(item => {
    if (item.separator) {
      const sep = document.createElement('div');
      sep.style.cssText = 'height:1px;background:var(--border-subtle);margin:4px 0;';
      menu.appendChild(sep);
    } else {
      const el = document.createElement('div');
      el.style.cssText = `padding:8px 12px;font-size:13px;color:${item.danger ? 'var(--nexus-danger)' : 'var(--text-primary)'};cursor:pointer;border-radius:4px;`;
      el.textContent = item.label;
      el.onmouseenter = () => el.style.background = 'var(--bg-tertiary)';
      el.onmouseleave = () => el.style.background = 'none';
      el.onclick = () => { menu.remove(); item.action(); };
      menu.appendChild(el);
    }
  });

  document.body.appendChild(menu);
  setTimeout(() => {
    document.addEventListener('click', function handler() {
      menu.remove();
      document.removeEventListener('click', handler);
    });
  }, 10);
}

function filterFriendsList(query) {
  const items = document.querySelectorAll('.friend-item');
  const lower = query.toLowerCase();
  items.forEach(item => {
    const name = item.querySelector('.friend-name')?.textContent.toLowerCase() || '';
    item.style.display = name.includes(lower) ? '' : 'none';
  });
}


// ============ SERVER WORD FILTER / MODERATION ============

const NexusModeration = (() => {
  // Per-server moderation settings
  const serverFilters = {};

  function getFilter(serverId) {
    if (!serverFilters[serverId]) {
      serverFilters[serverId] = {
        enabled: false,
        mode: 'censor', // 'delete', 'warn', 'censor'
        words: [],
        presets: { profanity: false, slurs: false, spam: false },
        log: [],
        bypassDetection: true
      };
    }
    return serverFilters[serverId];
  }

  const presetWords = {
    profanity: ['damn', 'hell', 'crap', 'ass'],
    slurs: ['[slur-placeholder-1]', '[slur-placeholder-2]'],
    spam: ['free nitro', 'click here', 'discord.gift', 'free robux', 'earn money fast']
  };

  function addWord(serverId, word) {
    const filter = getFilter(serverId);
    const lower = word.toLowerCase().trim();
    if (lower && !filter.words.includes(lower)) {
      filter.words.push(lower);
      return true;
    }
    return false;
  }

  function removeWord(serverId, word) {
    const filter = getFilter(serverId);
    const idx = filter.words.indexOf(word.toLowerCase());
    if (idx !== -1) {
      filter.words.splice(idx, 1);
      return true;
    }
    return false;
  }

  function togglePreset(serverId, preset) {
    const filter = getFilter(serverId);
    filter.presets[preset] = !filter.presets[preset];
    return filter.presets[preset];
  }

  function getAllFilteredWords(serverId) {
    const filter = getFilter(serverId);
    let words = [...filter.words];
    for (const preset in filter.presets) {
      if (filter.presets[preset] && presetWords[preset]) {
        words = words.concat(presetWords[preset]);
      }
    }
    return [...new Set(words)];
  }

  // Normalize text for bypass detection
  function normalizeText(text) {
    const leetMap = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's' };
    let normalized = text.toLowerCase();
    // Remove spaces between single chars
    normalized = normalized.replace(/(\w)\s+(?=\w\s)/g, '$1');
    // Replace leet speak
    for (const [k, v] of Object.entries(leetMap)) {
      normalized = normalized.split(k).join(v);
    }
    // Remove repeated chars
    normalized = normalized.replace(/(.)\1{2,}/g, '$1$1');
    return normalized;
  }

  function filterMessage(serverId, content) {
    const filter = getFilter(serverId);
    if (!filter.enabled) return { filtered: false, content };

    const words = getAllFilteredWords(serverId);
    if (words.length === 0) return { filtered: false, content };

    let filtered = false;
    let newContent = content;
    const normalizedContent = filter.bypassDetection ? normalizeText(content) : content.toLowerCase();

    for (const word of words) {
      const normalizedWord = filter.bypassDetection ? normalizeText(word) : word.toLowerCase();
      if (normalizedContent.includes(normalizedWord)) {
        filtered = true;

        if (filter.mode === 'delete') {
          return { filtered: true, content: null, action: 'delete', word };
        } else if (filter.mode === 'warn') {
          return { filtered: true, content, action: 'warn', word };
        } else {
          // Censor mode
          const regex = new RegExp(escapeRegex(word), 'gi');
          newContent = newContent.replace(regex, '*'.repeat(word.length));
        }
      }
    }

    return { filtered, content: newContent, action: filtered ? 'censor' : null };
  }

  function addLogEntry(serverId, entry) {
    const filter = getFilter(serverId);
    filter.log.unshift({
      ...entry,
      timestamp: new Date().toISOString()
    });
    if (filter.log.length > 50) filter.log.pop();
  }

  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  return { getFilter, addWord, removeWord, togglePreset, getAllFilteredWords, filterMessage, addLogEntry, presetWords };
})();


// ============ MODERATION UI (Server Settings Integration) ============

function renderModerationTab(serverId) {
  const filter = NexusModeration.getFilter(serverId);
  const server = servers[serverId];

  return `
    <div class="mod-section">
      <h3>🛡️ Word Filter</h3>
      <p>Automatically filter messages containing restricted words in this server.</p>

      <div class="mod-toggle-row">
        <div class="mod-toggle-info">
          <h4>Enable Word Filter</h4>
          <p>Filter messages based on your word list and presets</p>
        </div>
        <div class="toggle-switch ${filter.enabled ? 'active' : ''}" onclick="toggleWordFilter('${serverId}', this)"></div>
      </div>

      <div id="modFilterSettings" style="${filter.enabled ? '' : 'opacity:0.5;pointer-events:none;'}">
        <h3 style="margin-top:20px;">Filter Mode</h3>
        <div class="mod-filter-mode">
          <div class="mod-filter-mode-option ${filter.mode === 'censor' ? 'selected' : ''}" onclick="setFilterMode('${serverId}', 'censor', this)">
            <div class="mode-icon">✱✱✱</div>
            <div class="mode-name">Censor</div>
            <div class="mode-desc">Replace with ***</div>
          </div>
          <div class="mod-filter-mode-option ${filter.mode === 'delete' ? 'selected' : ''}" onclick="setFilterMode('${serverId}', 'delete', this)">
            <div class="mode-icon">🗑️</div>
            <div class="mode-name">Delete</div>
            <div class="mode-desc">Remove message</div>
          </div>
          <div class="mod-filter-mode-option ${filter.mode === 'warn' ? 'selected' : ''}" onclick="setFilterMode('${serverId}', 'warn', this)">
            <div class="mode-icon">⚠️</div>
            <div class="mode-name">Warn</div>
            <div class="mode-desc">Send warning</div>
          </div>
        </div>

        <h3>Preset Filter Lists</h3>
        <div class="mod-presets">
          <button class="mod-preset-btn ${filter.presets.profanity ? 'active' : ''}" onclick="toggleModPreset('${serverId}', 'profanity', this)">🤬 Profanity</button>
          <button class="mod-preset-btn ${filter.presets.slurs ? 'active' : ''}" onclick="toggleModPreset('${serverId}', 'slurs', this)">🚫 Slurs</button>
          <button class="mod-preset-btn ${filter.presets.spam ? 'active' : ''}" onclick="toggleModPreset('${serverId}', 'spam', this)">📧 Spam Links</button>
        </div>

        <div class="mod-toggle-row" style="margin-bottom:16px;">
          <div class="mod-toggle-info">
            <h4>Bypass Detection</h4>
            <p>Detect l33t speak, spacing tricks, and character substitution</p>
          </div>
          <div class="toggle-switch ${filter.bypassDetection ? 'active' : ''}" onclick="toggleBypassDetection('${serverId}', this)"></div>
        </div>

        <h3>Custom Word List</h3>
        <div class="mod-add-word-row">
          <input id="modNewWord" placeholder="Add a word to filter..." onkeydown="if(event.key==='Enter')addFilterWord('${serverId}')">
          <button onclick="addFilterWord('${serverId}')">Add</button>
        </div>

        <div class="mod-word-list">
          <div class="mod-word-tags" id="modWordTags">
            ${filter.words.length > 0 ? filter.words.map(w => `
              <div class="mod-word-tag">
                ${w}
                <span class="remove-word" onclick="removeFilterWord('${serverId}', '${w}')">&times;</span>
              </div>
            `).join('') : '<span style="font-size:13px;color:var(--text-muted);">No custom words added yet.</span>'}
          </div>
        </div>

        <h3 style="margin-top:20px;">Moderation Log</h3>
        <div class="mod-log" id="modLog">
          ${filter.log.length > 0 ? filter.log.map(entry => `
            <div class="mod-log-item">
              <span class="mod-log-icon">${entry.action === 'delete' ? '🗑️' : entry.action === 'warn' ? '⚠️' : '✱'}</span>
              <span class="mod-log-text"><strong>${entry.user || 'Unknown'}</strong> — ${entry.action === 'delete' ? 'Message deleted' : entry.action === 'warn' ? 'Warning sent' : 'Message censored'} (matched: "${entry.word}")</span>
              <span class="mod-log-time">${new Date(entry.timestamp).toLocaleTimeString()}</span>
            </div>
          `).join('') : '<div style="padding:16px;text-align:center;font-size:13px;color:var(--text-muted);">No moderation actions yet.</div>'}
        </div>
      </div>
    </div>
  `;
}

function toggleWordFilter(serverId, el) {
  const filter = NexusModeration.getFilter(serverId);
  filter.enabled = !filter.enabled;
  el.classList.toggle('active');
  const settings = document.getElementById('modFilterSettings');
  if (settings) {
    settings.style.opacity = filter.enabled ? '' : '0.5';
    settings.style.pointerEvents = filter.enabled ? '' : 'none';
  }
  showToast(filter.enabled ? 'Word filter enabled 🛡️' : 'Word filter disabled');
}

function setFilterMode(serverId, mode, el) {
  const filter = NexusModeration.getFilter(serverId);
  filter.mode = mode;
  document.querySelectorAll('.mod-filter-mode-option').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
}

function toggleModPreset(serverId, preset, el) {
  const active = NexusModeration.togglePreset(serverId, preset);
  el.classList.toggle('active', active);
  showToast(`${preset.charAt(0).toUpperCase() + preset.slice(1)} filter ${active ? 'enabled' : 'disabled'}`);
}

function toggleBypassDetection(serverId, el) {
  const filter = NexusModeration.getFilter(serverId);
  filter.bypassDetection = !filter.bypassDetection;
  el.classList.toggle('active');
}

function addFilterWord(serverId) {
  const input = document.getElementById('modNewWord');
  if (!input || !input.value.trim()) return;

  if (NexusModeration.addWord(serverId, input.value.trim())) {
    showToast(`Added "${input.value.trim()}" to filter`);
    input.value = '';
    // Re-render word tags
    const filter = NexusModeration.getFilter(serverId);
    const tagsEl = document.getElementById('modWordTags');
    if (tagsEl) {
      tagsEl.innerHTML = filter.words.map(w => `
        <div class="mod-word-tag">
          ${w}
          <span class="remove-word" onclick="removeFilterWord('${serverId}', '${w}')">&times;</span>
        </div>
      `).join('');
    }
  }
}

function removeFilterWord(serverId, word) {
  NexusModeration.removeWord(serverId, word);
  const filter = NexusModeration.getFilter(serverId);
  const tagsEl = document.getElementById('modWordTags');
  if (tagsEl) {
    tagsEl.innerHTML = filter.words.length > 0 ? filter.words.map(w => `
      <div class="mod-word-tag">
        ${w}
        <span class="remove-word" onclick="removeFilterWord('${serverId}', '${w}')">&times;</span>
      </div>
    `).join('') : '<span style="font-size:13px;color:var(--text-muted);">No custom words added yet.</span>';
  }
}


// ============ END-TO-END ENCRYPTION ============

const NexusEncryption = (() => {
  // Simulated encryption system
  const keyPairs = {};
  const sessionKeys = {};

  function generateKeyPair() {
    const chars = '0123456789abcdef';
    let pub = '', priv = '';
    for (let i = 0; i < 64; i++) {
      pub += chars[Math.floor(Math.random() * 16)];
      priv += chars[Math.floor(Math.random() * 16)];
    }
    return { publicKey: pub, privateKey: priv };
  }

  function getOrCreateKeyPair(userId) {
    if (!keyPairs[userId]) {
      keyPairs[userId] = generateKeyPair();
    }
    return keyPairs[userId];
  }

  function deriveSessionKey(userId1, userId2) {
    const key = [userId1, userId2].sort().join(':');
    if (!sessionKeys[key]) {
      const chars = '0123456789abcdef';
      let sk = '';
      for (let i = 0; i < 32; i++) sk += chars[Math.floor(Math.random() * 16)];
      sessionKeys[key] = {
        key: sk,
        established: new Date().toISOString(),
        algorithm: 'AES-256-GCM',
        protocol: 'Signal Protocol (simulated)'
      };
    }
    return sessionKeys[key];
  }

  function encryptMessage(content, fromId, toId) {
    // Simulated encryption - in production, use actual crypto
    const session = deriveSessionKey(fromId, toId);
    return {
      encrypted: true,
      content: content, // In real app, this would be ciphertext
      fingerprint: session.key.substring(0, 8),
      algorithm: session.algorithm
    };
  }

  function getFingerprint(userId1, userId2) {
    const session = deriveSessionKey(userId1, userId2);
    // Format fingerprint as blocks
    const fp = session.key;
    return fp.match(/.{1,4}/g).join(' ');
  }

  function isEncrypted(channelId) {
    // DMs are always encrypted
    return channelId && channelId.startsWith('dm-');
  }

  function getEncryptionInfo(channelId) {
    if (!isEncrypted(channelId)) {
      return {
        encrypted: false,
        type: 'server',
        protocol: 'TLS 1.3',
        description: 'Messages are encrypted in transit using TLS 1.3 between your device and Nexus servers.'
      };
    }

    return {
      encrypted: true,
      type: 'e2e',
      protocol: 'Signal Protocol (simulated)',
      algorithm: 'AES-256-GCM',
      keyExchange: 'X25519',
      description: 'Messages are end-to-end encrypted. Only you and the recipient can read them.'
    };
  }

  return { getOrCreateKeyPair, deriveSessionKey, encryptMessage, getFingerprint, isEncrypted, getEncryptionInfo };
})();


// ============ ENCRYPTION UI ============

function renderEncryptionBanner(channelId) {
  const info = NexusEncryption.getEncryptionInfo(channelId);

  if (info.type === 'e2e') {
    return `
      <div class="encryption-banner">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>
        <span class="enc-text">Messages are <strong>end-to-end encrypted</strong>. No one outside of this chat can read them.</span>
        <span class="enc-verify" onclick="openEncryptionPanel('${channelId}')">Verify</span>
      </div>
    `;
  }

  return `
    <div class="encryption-banner" style="background:rgba(14,165,233,0.08);border-color:rgba(14,165,233,0.15);color:var(--nexus-primary);">
      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/></svg>
      <span class="enc-text">Messages are encrypted in transit with <strong>TLS 1.3</strong></span>
      <span class="enc-verify" onclick="openEncryptionPanel('${channelId}')" style="color:var(--nexus-primary);">Details</span>
    </div>
  `;
}

function getEncryptionHeaderBadge(channelId) {
  const info = NexusEncryption.getEncryptionInfo(channelId);
  if (info.type === 'e2e') {
    return `<span class="encryption-badge" onclick="openEncryptionPanel('${channelId}')" style="cursor:pointer;">
      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>
      E2E Encrypted
    </span>`;
  }
  return `<span class="encryption-badge" style="background:rgba(14,165,233,0.1);border-color:rgba(14,165,233,0.2);color:var(--nexus-primary);cursor:pointer;" onclick="openEncryptionPanel('${channelId}')">
    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/></svg>
    TLS Encrypted
  </span>`;
}

function openEncryptionPanel(channelId) {
  let panel = document.getElementById('encryptionPanel');
  if (panel) {
    panel.remove();
  }

  const info = NexusEncryption.getEncryptionInfo(channelId);
  const isE2E = info.type === 'e2e';

  // Get other user for DMs
  let otherUserId = null;
  let otherUser = null;
  if (channelId && channelId.startsWith('dm-')) {
    const userKey = channelId.replace('dm-', '');
    otherUserId = 'u-' + userKey;
    otherUser = users[otherUserId];
  }

  const fingerprint = otherUserId ? NexusEncryption.getFingerprint('u-self', otherUserId) : '';

  panel = document.createElement('div');
  panel.className = 'encryption-panel visible';
  panel.id = 'encryptionPanel';
  panel.innerHTML = `
    <div class="encryption-panel-header">
      <h3>${isE2E ? '🔒 End-to-End Encryption' : '🛡️ Transport Encryption'}</h3>
      <button class="encryption-panel-close" onclick="closeEncryptionPanel()">&times;</button>
    </div>
    <div class="encryption-panel-body">
      <div class="enc-status-card">
        <div class="enc-status-icon">${isE2E ? '🔐' : '🛡️'}</div>
        <div class="enc-status-title">${isE2E ? 'End-to-End Encrypted' : 'Encrypted in Transit'}</div>
        <div class="enc-status-desc">${info.description}</div>
      </div>

      <div class="enc-detail-row">
        <span class="enc-detail-label">Protocol</span>
        <span class="enc-detail-value">${info.protocol}</span>
      </div>
      ${isE2E ? `
        <div class="enc-detail-row">
          <span class="enc-detail-label">Algorithm</span>
          <span class="enc-detail-value">${info.algorithm}</span>
        </div>
        <div class="enc-detail-row">
          <span class="enc-detail-label">Key Exchange</span>
          <span class="enc-detail-value">${info.keyExchange}</span>
        </div>
      ` : ''}
      <div class="enc-detail-row">
        <span class="enc-detail-label">Status</span>
        <span class="enc-detail-value" style="color:#06d6a0;">✓ Active</span>
      </div>

      ${isE2E && otherUser ? `
        <h4 style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-secondary);margin-top:20px;margin-bottom:8px;">Security Verification</h4>
        <p style="font-size:13px;color:var(--text-muted);margin-bottom:12px;">
          To verify encryption with <strong style="color:var(--text-primary);">${otherUser.name}</strong>, compare these safety numbers in person or over a trusted channel.
        </p>
        <div class="enc-fingerprint">${fingerprint}</div>
        <button class="enc-verify-btn" onclick="verifyEncryption('${channelId}')">✓ Mark as Verified</button>
      ` : `
        <div style="margin-top:20px;padding:16px;background:var(--bg-primary);border-radius:8px;">
          <p style="font-size:13px;color:var(--text-muted);line-height:1.6;">
            Server messages are encrypted between your device and Nexus servers using industry-standard TLS 1.3 encryption. 
            For end-to-end encryption, use Direct Messages.
          </p>
        </div>
      `}
    </div>
  `;

  document.body.appendChild(panel);
}

function closeEncryptionPanel() {
  const panel = document.getElementById('encryptionPanel');
  if (panel) {
    panel.classList.remove('visible');
    setTimeout(() => panel.remove(), 300);
  }
}

function verifyEncryption(channelId) {
  showToast('Encryption verified! ✓ This conversation is secure. 🔒');
  closeEncryptionPanel();
}


// ============ INTEGRATION: Hook into existing app ============

(function initSocialFeatures() {
  // Wait for DOM and app.js to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupSocialFeatures);
  } else {
    // Small delay to ensure app.js has initialized
    setTimeout(setupSocialFeatures, 200);
  }
})();

function setupSocialFeatures() {
  // 1. Check auth state via backend API
  NexusBackend.init().then(result => {
    if (!result.authenticated) {
      // Also check legacy localStorage auth
      const session = NexusAuth.getSession();
      const authUser = NexusAuth.getCurrentUser();
      if (!session || !authUser) {
        showAuthScreen();
      } else {
        applyUserToApp(authUser);
      }
    }
    // If authenticated, NexusBackend.init() already called applyUserToApp
    // Load the current server detail
    if (result.authenticated && typeof activeServer !== 'undefined' && activeServer !== 'home') {
      NexusBackend.loadServerDetail(activeServer).then(() => {
        if (typeof switchServer === 'function') switchServer(activeServer);
      });
    }
  }).catch(err => {
    console.error('[Social] Backend init failed, falling back to localStorage:', err);
    const session = NexusAuth.getSession();
    const authUser = NexusAuth.getCurrentUser();
    if (!session || !authUser) {
      showAuthScreen();
    } else {
      applyUserToApp(authUser);
    }
  });

  // 2. Hook into switchChannel to add encryption banners
  const originalSwitchChannel = window.switchChannel;
  if (originalSwitchChannel) {
    window.switchChannel = function(channelId) {
      // Hide friends page when switching channels
      hideFriendsPage();

      originalSwitchChannel(channelId);

      // Add encryption banner after channel switch
      setTimeout(() => {
        addEncryptionBanner(channelId);
        addEncryptionHeaderBadge(channelId);
      }, 50);
    };
  }

  // 3. Hook into sendMessage to apply word filter
  const originalSendMessage = window.sendMessage;
  if (originalSendMessage) {
    window.sendMessage = function() {
      const input = document.getElementById('messageInput');
      if (!input || !input.value.trim()) {
        originalSendMessage();
        return;
      }

      const content = input.value.trim();

      // Apply word filter for server channels
      if (typeof activeServer !== 'undefined' && activeServer !== 'home') {
        const result = NexusModeration.filterMessage(activeServer, content);

        if (result.filtered) {
          if (result.action === 'delete') {
            input.value = '';
            input.style.height = 'auto';
            showToast('⚠️ Your message was blocked by the word filter.');
            NexusModeration.addLogEntry(activeServer, {
              user: currentUser.name,
              action: 'delete',
              word: result.word
            });
            return;
          } else if (result.action === 'warn') {
            showToast('⚠️ Warning: Your message contains a filtered word.');
            NexusModeration.addLogEntry(activeServer, {
              user: currentUser.name,
              action: 'warn',
              word: result.word
            });
          } else if (result.action === 'censor') {
            input.value = result.content;
            NexusModeration.addLogEntry(activeServer, {
              user: currentUser.name,
              action: 'censor',
              word: 'filtered'
            });
          }
        }
      }

      originalSendMessage();
    };
  }

  // 4. Hook into switchServer to show friends page for home
  const originalSwitchServer = window.switchServer;
  if (originalSwitchServer) {
    window.switchServer = function(serverId) {
      if (serverId === 'home') {
        hideFriendsPage();
      }
      originalSwitchServer(serverId);
    };
  }

  // 5. Add "Friends" button to DM sidebar
  injectFriendsButton();

  // 6. Hook into server settings to add moderation tab
  injectModerationTab();

  // 7. Hook profile editor into settings
  injectProfileEditorHook();

  // 8. Hook logout
  injectLogoutHook();

  // 9. Add encryption banner to current channel
  if (typeof activeChannel !== 'undefined') {
    setTimeout(() => {
      addEncryptionBanner(activeChannel);
      addEncryptionHeaderBadge(activeChannel);
    }, 500);
  }

  // 10. Keyboard shortcuts
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeProfileEditor();
      closeEncryptionPanel();
    }
  });
}

function injectFriendsButton() {
  // Watch for DM sidebar rendering and inject friends button
  const observer = new MutationObserver(() => {
    const channelList = document.getElementById('channelList');
    if (!channelList) return;

    // Check if we're on home/DM server
    if (typeof activeServer !== 'undefined' && activeServer === 'home') {
      // Check if friends button already exists
      if (!channelList.querySelector('.friends-nav-btn')) {
        const firstChild = channelList.firstChild;
        const friendsBtn = document.createElement('div');
        friendsBtn.className = 'friends-nav-btn';
        friendsBtn.style.cssText = 'padding:8px 12px;margin:4px 8px;border-radius:6px;cursor:pointer;display:flex;align-items:center;gap:8px;color:var(--text-secondary);font-weight:600;font-size:14px;transition:all 0.15s;';
        friendsBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg> Friends';

        const pendingCount = NexusFriends.getIncoming().length;
        if (pendingCount > 0) {
          friendsBtn.innerHTML += `<span style="background:var(--nexus-danger);color:#fff;font-size:10px;font-weight:700;min-width:16px;height:16px;border-radius:8px;display:flex;align-items:center;justify-content:center;padding:0 4px;margin-left:auto;">${pendingCount}</span>`;
        }

        friendsBtn.onmouseenter = () => friendsBtn.style.background = 'var(--bg-tertiary)';
        friendsBtn.onmouseleave = () => friendsBtn.style.background = '';
        friendsBtn.onclick = () => showFriendsPage();

        if (firstChild) {
          channelList.insertBefore(friendsBtn, firstChild);
        } else {
          channelList.appendChild(friendsBtn);
        }
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // Also inject immediately if already on home
  if (typeof activeServer !== 'undefined' && activeServer === 'home') {
    setTimeout(injectFriendsButton, 300);
  }
}

function injectModerationTab() {
  // Hook into server settings tab switching
  const originalSwitchSSTab = window.switchSSTab;
  if (originalSwitchSSTab) {
    window.switchSSTab = function(el, tab) {
      if (tab === 'wordfilter') {
        document.querySelectorAll('.ss-nav-item').forEach(i => i.classList.remove('active'));
        el.classList.add('active');
        const content = document.getElementById('ssContent');
        if (content && typeof activeServer !== 'undefined') {
          content.innerHTML = renderModerationTab(activeServer);
        }
        return;
      }
      originalSwitchSSTab(el, tab);
    };
  }

  // Add word filter tab to server settings nav
  const observer = new MutationObserver(() => {
    const ssNav = document.getElementById('ssNavInner');
    if (ssNav && !ssNav.querySelector('[data-ss="wordfilter"]')) {
      const moderationCategory = ssNav.querySelector('.ss-nav-category:last-of-type');
      if (moderationCategory && moderationCategory.textContent.includes('Moderation')) {
        const wordFilterTab = document.createElement('div');
        wordFilterTab.className = 'ss-nav-item';
        wordFilterTab.setAttribute('data-ss', 'wordfilter');
        wordFilterTab.textContent = 'Word Filter';
        wordFilterTab.onclick = function() { switchSSTab(this, 'wordfilter'); };
        moderationCategory.insertAdjacentElement('afterend', wordFilterTab);
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

function injectProfileEditorHook() {
  // Hook into settings "Edit Profile" button
  document.addEventListener('click', e => {
    if (e.target.matches('.btn-primary') && e.target.textContent.trim() === 'Edit Profile') {
      e.preventDefault();
      e.stopPropagation();
      openProfileEditor();
    }
    // Also hook the Profile nav item in settings
    if (e.target.matches('.settings-nav-item') && e.target.textContent.trim() === 'Profile') {
      e.preventDefault();
      e.stopPropagation();
      openProfileEditor();
    }
  });
}

function injectLogoutHook() {
  document.addEventListener('click', e => {
    if (e.target.matches('.settings-nav-item.danger') && e.target.textContent.trim() === 'Log Out') {
      e.preventDefault();
      e.stopPropagation();

      // Close settings
      const settingsOverlay = document.getElementById('settingsOverlay');
      if (settingsOverlay) settingsOverlay.style.display = 'none';

      NexusBackend.handleLogout();
      showToast('Logged out. See you soon! 👋');
      setTimeout(() => showAuthScreen(), 500);
    }
  });
}

function addEncryptionBanner(channelId) {
  // Remove existing banner
  const existing = document.querySelector('.encryption-banner');
  if (existing) existing.remove();

  const messagesArea = document.querySelector('.messages-area');
  if (!messagesArea) return;

  const bannerHTML = renderEncryptionBanner(channelId);
  const temp = document.createElement('div');
  temp.innerHTML = bannerHTML;
  const banner = temp.firstElementChild;

  if (banner) {
    messagesArea.insertBefore(banner, messagesArea.firstChild);
  }
}

function addEncryptionHeaderBadge(channelId) {
  // Add encryption badge to chat header
  const headerTopic = document.querySelector('.chat-header-topic');
  if (!headerTopic) return;

  // Remove existing badge
  const existingBadge = headerTopic.parentElement.querySelector('.encryption-badge');
  if (existingBadge) existingBadge.remove();

  const badgeHTML = getEncryptionHeaderBadge(channelId);
  const temp = document.createElement('div');
  temp.innerHTML = badgeHTML;
  const badge = temp.firstElementChild;

  if (badge && headerTopic.parentElement) {
    headerTopic.insertAdjacentElement('afterend', badge);
  }
}

// ============ UTILITY ============

// Ensure showToast exists
if (typeof showToast === 'undefined') {
  window.showToast = function(message) {
    console.log('[Toast]', message);
  };
}