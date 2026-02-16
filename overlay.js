// ============================================
// NEXUS CHAT - Game Overlay Logic
// In-game overlay with compact chat interface
// ============================================

// ============ DATA ============

// Overlay users and friends populated from backend
const overlayUsers = {};
let currentUser = null;
let activeChannel = null;
let friends = [];

// Messages loaded from backend
let overlayMessages = [];

let msgIdCounter = 100;
let currentTab = 'chat';
let isOverlayVisible = false;
let isPinned = false;
let isCompact = false;
let isMuted = false;
let isDeafened = false;

// Backend API base URL
const API_BASE = `http://${window.location.hostname}:8090/api`;
let authToken = localStorage.getItem('nexus_token');

// ============ API HELPERS ============

async function apiCall(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const opts = {
    ...options,
    headers: {
      ...options.headers,
      'Content-Type': 'application/json',
      ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
    }
  };
  
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// ============ INITIALIZATION ============

document.addEventListener('DOMContentLoaded', async () => {
  // Load user data from backend
  await loadUserData();
  
  // Load friends from backend
  await loadFriends();
  
  renderMessages();
  renderFriends();
  setupEventListeners();
  setupIPCListeners();
  showHotkeyHint();
  
  // Subscribe to real-time updates
  if (typeof NexusAPI !== 'undefined') {
    NexusAPI.subscribeChannel(activeChannel);
  }
});

async function loadUserData() {
  try {
    const res = await apiCall('/auth/me');
    if (res.success && res.user) {
      currentUser = res.user;
      // Get active server/channel
      const serversRes = await apiCall('/servers');
      if (serversRes.success && serversRes.servers?.length > 0) {
        const server = serversRes.servers[0];
        const serverRes = await apiCall(`/servers/${server.id}`);
        if (serverRes.success && serverRes.server) {
          const generalCat = serverRes.server.categories?.find(c => c.name === 'General');
          if (generalCat && generalCat.channels?.length > 0) {
            activeChannel = generalCat.channels[0].id;
            document.getElementById('overlayChannelName').textContent = `#${generalCat.channels[0].name}`;
            loadMessages(activeChannel);
          }
        }
      }
    }
  } catch (e) {
    console.error('[Overlay] Failed to load user data:', e);
  }
}

async function loadFriends() {
  try {
    const res = await apiCall('/friends');
    if (res.success) {
      friends = res.friends || [];
      renderFriends();
    }
  } catch (e) {
    console.error('[Overlay] Failed to load friends:', e);
  }
}

async function loadMessages(channelId) {
  if (!channelId) return;
  try {
    const res = await apiCall(`/channels/${channelId}/messages?limit=50`);
    if (res.success && res.messages) {
      overlayMessages = res.messages;
      renderMessages();
    }
  } catch (e) {
    console.error('[Overlay] Failed to load messages:', e);
  }
}

// ============ IPC COMMUNICATION ============

function setupIPCListeners() {
  if (window.nexusOverlay) {
    window.nexusOverlay.onOverlayToggle((state) => {
      if (state) {
        showOverlay();
      } else {
        hideOverlay();
      }
    });

    window.nexusOverlay.onNewMessage((msg) => {
      overlayMessages.push(msg);
      if (currentTab === 'chat') {
        renderMessages();
      }
      if (!isOverlayVisible) {
        showToast(msg);
      }
    });

    window.nexusOverlay.onMessagesUpdate((msgs) => {
      overlayMessages = msgs;
      if (currentTab === 'chat') {
        renderMessages();
      }
    });
  }
}

// ============ EVENT LISTENERS ============

function setupEventListeners() {
  // Send message
  const input = document.getElementById('overlayInput');
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  document.getElementById('overlaySendBtn').addEventListener('click', sendMessage);

  // Close button
  document.getElementById('closeBtn').addEventListener('click', () => {
    hideOverlay();
    if (window.nexusOverlay) {
      window.nexusOverlay.closeOverlay();
    }
  });

  // Compact toggle
  document.getElementById('compactToggle').addEventListener('click', () => {
    isCompact = !isCompact;
    document.getElementById('overlayContainer').classList.toggle('compact', isCompact);
  });

  // Pin toggle
  document.getElementById('pinBtn').addEventListener('click', () => {
    isPinned = !isPinned;
    document.getElementById('pinBtn').textContent = isPinned ? '📍' : '📌';
    document.getElementById('pinBtn').style.color = isPinned ? '#0ea5e9' : '';
  });

  // Tab switching
  document.querySelectorAll('.overlay-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      switchTab(tab.dataset.tab);
    });
  });

  // Voice controls
  document.getElementById('voiceMuteBtn').addEventListener('click', () => {
    isMuted = !isMuted;
    document.getElementById('voiceMuteBtn').textContent = isMuted ? '🔇' : '🎤';
    document.getElementById('voiceMuteBtn').style.color = isMuted ? '#ef4444' : '';
  });

  document.getElementById('voiceDeafenBtn').addEventListener('click', () => {
    isDeafened = !isDeafened;
    document.getElementById('voiceDeafenBtn').textContent = isDeafened ? '🔇' : '🎧';
    document.getElementById('voiceDeafenBtn').style.color = isDeafened ? '#ef4444' : '';
  });

  document.getElementById('voiceDisconnectBtn').addEventListener('click', () => {
    document.getElementById('voiceBar').classList.remove('visible');
  });

  // Keyboard shortcut to toggle overlay (backup for when global shortcut fails)
  document.addEventListener('keydown', (e) => {
    if (e.shiftKey && e.key === '`') {
      e.preventDefault();
      toggleOverlay();
    }
    if (e.key === 'Escape' && isOverlayVisible && !isPinned) {
      hideOverlay();
      if (window.nexusOverlay) {
        window.nexusOverlay.closeOverlay();
      }
    }
  });

  // Click outside to close (if not pinned)
  document.getElementById('overlayContainer').addEventListener('click', (e) => {
    if (e.target === document.getElementById('overlayContainer') && !isPinned) {
      hideOverlay();
      if (window.nexusOverlay) {
        window.nexusOverlay.closeOverlay();
      }
    }
  });
}

// ============ OVERLAY VISIBILITY ============

function toggleOverlay() {
  if (isOverlayVisible) {
    hideOverlay();
  } else {
    showOverlay();
  }
}

function showOverlay() {
  isOverlayVisible = true;
  document.getElementById('overlayContainer').classList.add('visible');
  if (window.nexusOverlay) {
    window.nexusOverlay.setOverlayInteractive(true);
  }
  // Focus input
  setTimeout(() => {
    document.getElementById('overlayInput').focus();
  }, 300);
}

function hideOverlay() {
  isOverlayVisible = false;
  document.getElementById('overlayContainer').classList.remove('visible');
  if (window.nexusOverlay) {
    window.nexusOverlay.setOverlayInteractive(false);
  }
}

function showHotkeyHint() {
  const hint = document.getElementById('hotkeyHint');
  hint.classList.add('visible');
  setTimeout(() => {
    hint.classList.remove('visible');
  }, 3000);
}

// ============ TAB SWITCHING ============

function switchTab(tab) {
  currentTab = tab;

  document.querySelectorAll('.overlay-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tab);
  });

  const messagesEl = document.getElementById('overlayMessages');
  const friendsEl = document.getElementById('friendsList');
  const inputArea = document.getElementById('overlayInputArea');

  if (tab === 'chat' || tab === 'dms') {
    messagesEl.style.display = 'flex';
    friendsEl.classList.remove('visible');
    inputArea.style.display = 'block';
    renderMessages();
  } else if (tab === 'friends') {
    messagesEl.style.display = 'none';
    friendsEl.classList.add('visible');
    inputArea.style.display = 'none';
  }
}

// ============ MESSAGE RENDERING ============

function renderMessages() {
  const container = document.getElementById('overlayMessages');
  container.innerHTML = '';

  let lastUserId = null;
  let lastTime = 0;

  overlayMessages.forEach((msg) => {
    // Support both backend format and legacy format
    const userId = msg.userId || msg.user?.id || 'unknown';
    const content = msg.content;
    const timestamp = msg.createdAt || msg.created_at || msg.timestamp || Date.now();
    const displayName = msg.user?.displayName || msg.user?.username || overlayUsers[userId]?.name || 'Unknown';
    const initials = msg.user?.initials || overlayUsers[userId]?.initials || displayName[0].toUpperCase();
    const color = msg.user?.color || overlayUsers[userId]?.color || '#666';
    
    const timeDiff = timestamp - lastTime;
    const isGrouped = userId === lastUserId && timeDiff < 300000; // 5 min grouping

    const msgEl = document.createElement('div');
    msgEl.className = 'overlay-msg' + (isGrouped ? ' grouped' : '');

    const timeStr = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (isGrouped) {
      msgEl.innerHTML = `
        <div class="overlay-msg-avatar placeholder"></div>
        <div class="overlay-msg-content">
          <div class="overlay-msg-body">${formatContent(content)}</div>
        </div>
      `;
    } else {
      msgEl.innerHTML = `
        <div class="overlay-msg-avatar" style="background:${color}">${initials}</div>
        <div class="overlay-msg-content">
          <div class="overlay-msg-header">
            <span class="overlay-msg-author" style="color:${color}">${displayName}</span>
            <span class="overlay-msg-time">${timeStr}</span>
          </div>
          <div class="overlay-msg-body">${formatContent(content)}</div>
        </div>
      `;
    }

    container.appendChild(msgEl);
    lastUserId = userId;
    lastTime = timestamp;
  });

  // Scroll to bottom
  container.scrollTop = container.scrollHeight;
}

function scrollToBottom() {
  const container = document.getElementById('overlayMessages');
  if (container) {
    container.scrollTop = container.scrollHeight;
  }
}

function formatContent(content) {
  // Bold
  content = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  // Italic
  content = content.replace(/\*(.*?)\*/g, '<em>$1</em>');
  // Inline code
  content = content.replace(/`([^`]+)`/g, '<code>$1</code>');
  // Mentions
  content = content.replace(/@(\w[\w\s]*\w)/g, '<span class="mention">@$1</span>');
  return content;
}

// ============ SEND MESSAGE ============

async function sendMessage() {
  const input = document.getElementById('overlayInput');
  const content = input.value.trim();
  if (!content || !activeChannel) return;

  try {
    const res = await apiCall(`/channels/${activeChannel}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content })
    });
    
    if (res.success && res.message) {
      overlayMessages.push(res.message);
      input.value = '';
      renderMessages();
      scrollToBottom();
    }
  } catch (e) {
    console.error('[Overlay] Failed to send message:', e);
  }

  // Send to main window via IPC
  if (window.nexusOverlay) {
    window.nexusOverlay.sendMessage(msg);
  }

  // Simulate a reply after a short delay
  // Replies come from real users via backend
}

// ============ FRIENDS LIST ============

function renderFriends() {
  const container = document.getElementById('friendsList');
  container.innerHTML = '';

  // Sort: online first, then idle, dnd, offline
  const statusOrder = { online: 0, idle: 1, dnd: 2, offline: 3 };
  const sorted = [...friends].sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);

  sorted.forEach(friend => {
    const user = overlayUsers[friend.id];
    if (!user) return;

    const item = document.createElement('div');
    item.className = 'overlay-friend-item';
    item.innerHTML = `
      <div class="overlay-friend-avatar" style="background:${user.color}">
        ${user.initials}
        <div class="overlay-friend-status ${friend.status}"></div>
      </div>
      <div style="flex:1;min-width:0;">
        <div class="overlay-friend-name">${user.name}</div>
        ${friend.game ? `<div class="overlay-friend-game">${friend.game}</div>` : ''}
      </div>
    `;

    item.addEventListener('click', () => {
      // Switch to DM tab with this user
      switchTab('dms');
      document.getElementById('overlayInput').placeholder = `Message @${user.name}`;
      document.getElementById('overlayChannelName').textContent = `@ ${user.name}`;
    });

    container.appendChild(item);
  });
}

// ============ TOAST NOTIFICATIONS ============

function showToast(msg) {
  const user = overlayUsers[msg.userId] || { name: 'Unknown', initials: '?', color: '#666' };
  const container = document.getElementById('toastContainer');

  const toast = document.createElement('div');
  toast.className = 'overlay-toast';
  toast.innerHTML = `
    <div class="overlay-toast-avatar" style="background:${user.color}">${user.initials}</div>
    <div class="overlay-toast-content">
      <div class="overlay-toast-author" style="color:${user.color}">${user.name}</div>
      <div class="overlay-toast-body">${msg.content}</div>
    </div>
  `;

  toast.addEventListener('click', () => {
    showOverlay();
    toast.remove();
    if (window.nexusOverlay) {
      window.nexusOverlay.toggleOverlay();
    }
  });

  container.appendChild(toast);

  // Auto-remove after 5 seconds
  setTimeout(() => {
    if (toast.parentNode) {
      toast.remove();
    }
  }, 5000);

  // Limit to 3 toasts
  while (container.children.length > 3) {
    container.removeChild(container.firstChild);
  }
}

// Incoming messages handled via backend WebSocket — no simulation