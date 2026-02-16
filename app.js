// ============================================
// NEXUS CHAT - Application Logic
// A modern real-time communication platform
// ============================================

// ============ DATA MODELS ============

const currentUser = {
  id: null,
  name: '',
  tag: '',
  avatar: null,
  color: '#dc2626',
  initials: '',
  status: 'online',
  about: '',
  roles: []
};

const users = {};

// Server data
// Server data — populated dynamically from backend
const servers = {
  'home': {
    name: 'Direct Messages',
    channels: { 'dm': [] }
  }
};

// Message storage per channel
const channelMessages = {};
window.channelMessages = channelMessages;

// Pre-populate some channels with messages
function generateTimestamp(hoursAgo) {
  const d = new Date(Date.now() - hoursAgo * 3600000);
  return d;
}

// Ensure any timestamp (ISO string, number, or Date) becomes a valid Date object
function ensureDate(val) {
  if (val instanceof Date) return val;
  if (typeof val === 'string' || typeof val === 'number') {
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d;
  }
  return new Date(); // fallback to now
}

function formatTime(date) {
  date = ensureDate(date);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(date) {
  date = ensureDate(date);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });
}

function formatFullTimestamp(date) {
  date = ensureDate(date);
  return `${formatDate(date)} at ${formatTime(date)}`;
}

let msgIdCounter = 0;
function genMsgId() { return 'msg-' + (++msgIdCounter); }

// No seed messages — all messages loaded from backend

// ============ STATE ============

let activeServer = null;
let activeChannel = null;
let replyingTo = null;
let isMicMuted = false;
let isDeafened = false;
let isVoiceConnected = false;
let voiceChannel = null;
let membersVisible = true;
let pinnedVisible = false;
let collapsedCategories = {};

// ============ INITIALIZATION ============

document.addEventListener('DOMContentLoaded', () => {
  // Don't auto-switch server here — auth.js handles initialization
  // switchServer will be called after successful auth
  setupTooltips();
  setupContextMenu();
  setupClickOutside();
  populateEmojiPicker();
  setupSettingsNav();
  initPluginSystem();

  // Scroll-to-load-more: load older messages when scrolling to top
  const scroller = document.getElementById('messagesScroller');
  if (scroller) {
    let loadingMore = false;
    scroller.addEventListener('scroll', async () => {
      if (scroller.scrollTop < 100 && !loadingMore && activeChannel) {
        if (typeof NexusBackend !== 'undefined' && typeof NexusAPI !== 'undefined' && NexusAPI.isAuthenticated()) {
          loadingMore = true;
          try {
            const prevHeight = scroller.scrollHeight;
            const result = await NexusBackend.loadMoreMessages(activeChannel);
            if (result && result.messages && result.messages.length > 0) {
              renderMessages();
              // Maintain scroll position after prepending older messages
              const newHeight = scroller.scrollHeight;
              scroller.scrollTop = newHeight - prevHeight;
            }
          } catch (err) {
            console.error('[Scroll] Load more error:', err);
          }
          loadingMore = false;
        }
      }
    });
  }
});

// ============ WELCOME LANDING ============

function showWelcomeLanding() {
  // Check if user has any servers (besides 'home')
  const userServers = Object.keys(servers).filter(k => k !== 'home');
  
  if (userServers.length > 0) {
    // User has servers — switch to the first one
    switchServer(userServers[0]);
    return;
  }

  // No servers — show the welcome landing page
  activeServer = 'home';
  activeChannel = null;

  // Update sidebar
  document.querySelectorAll('.server-icon').forEach(el => el.classList.remove('active'));
  const homeEl = document.querySelector('[data-server="home"]');
  if (homeEl) homeEl.classList.add('active');

  document.getElementById('sidebarTitle').textContent = 'Welcome';
  
  // Clear channel list and show welcome content
  const channelList = document.getElementById('channelList');
  if (channelList) channelList.innerHTML = '';

  // Show welcome landing in the main chat area
  const chatMessages = document.getElementById('chatMessages');
  const chatHeader = document.querySelector('.chat-header');
  const messageInput = document.querySelector('.message-input-container');
  
  if (chatHeader) chatHeader.style.display = 'none';
  if (messageInput) messageInput.style.display = 'none';

  if (chatMessages) {
    chatMessages.innerHTML = `
      <div class="welcome-landing">
        <div class="welcome-hero">
          <div class="welcome-logo">
            <div class="welcome-logo-icon">N</div>
            <div class="welcome-logo-glow"></div>
          </div>
          <h1 class="welcome-title">Welcome to Nexus Chat!</h1>
          <p class="welcome-subtitle">Your space for real-time communication. Get started by creating a server or adding friends.</p>
        </div>

        <div class="welcome-actions">
          <div class="welcome-card" onclick="openModal('createServerModal')">
            <div class="welcome-card-icon">🚀</div>
            <h3>Create a Server</h3>
            <p>Start your own community. Invite friends, create channels, and build something awesome.</p>
            <button class="welcome-btn welcome-btn-primary">Create Server</button>
          </div>

          <div class="welcome-card" onclick="if(typeof switchServer==='function'){activeServer='home';document.querySelector('[data-server=\\'home\\']')?.click();}">
            <div class="welcome-card-icon">👥</div>
            <h3>Add Friends</h3>
            <p>Connect with people you know. Send friend requests and start direct messaging.</p>
            <button class="welcome-btn welcome-btn-secondary">Find Friends</button>
          </div>

          <div class="welcome-card" onclick="if(typeof openModal==='function') openModal('joinServerModal')">
            <div class="welcome-card-icon">🔗</div>
            <h3>Join a Server</h3>
            <p>Have an invite link? Join an existing community and start chatting right away.</p>
            <button class="welcome-btn welcome-btn-secondary">Join Server</button>
          </div>
        </div>

        <div class="welcome-tips">
          <h3>💡 Quick Tips</h3>
          <div class="welcome-tips-grid">
            <div class="welcome-tip">
              <span class="welcome-tip-icon">⌨️</span>
              <span>Press <kbd>Ctrl+K</kbd> to quick search</span>
            </div>
            <div class="welcome-tip">
              <span class="welcome-tip-icon">🎤</span>
              <span>Join voice channels to talk with friends</span>
            </div>
            <div class="welcome-tip">
              <span class="welcome-tip-icon">🎨</span>
              <span>Customize your profile in Settings</span>
            </div>
            <div class="welcome-tip">
              <span class="welcome-tip-icon">📱</span>
              <span>Use <kbd>Ctrl+Shift+N</kbd> to toggle the app</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}

// Render server icons in the sidebar from the servers object
function renderServerList() {
  const nav = document.getElementById('serverNav');
  if (!nav) return;

  // Remove existing server items (keep home, separator, add button, etc.)
  nav.querySelectorAll('.server-item').forEach(el => el.remove());

  // Find the first separator to insert servers after it
  const separators = nav.querySelectorAll('.server-separator');
  const insertBefore = separators.length > 1 ? separators[1] : separators[0];

  for (const [serverId, server] of Object.entries(servers)) {
    if (serverId === 'home') continue;

    const icon = document.createElement('div');
    icon.className = 'server-icon server-item';
    icon.dataset.tooltip = server.name;
    icon.dataset.server = serverId;
    
    if (server.iconEmoji) {
      icon.textContent = server.iconEmoji;
    } else if (server.icon) {
      icon.style.backgroundImage = `url(${server.icon})`;
      icon.style.backgroundSize = 'cover';
    } else {
      // Generate initials from server name
      const initials = server.name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
      icon.textContent = initials;
    }

    icon.onclick = () => switchServer(serverId);

    if (insertBefore) {
      nav.insertBefore(icon, insertBefore);
    } else {
      nav.appendChild(icon);
    }
  }

  setupTooltips();
}

// ============ SERVER SWITCHING ============

function switchServer(serverId) {
  activeServer = serverId;

  // Restore chat UI (may have been hidden by welcome landing)
  const chatHeader = document.querySelector('.chat-header');
  const messageInput = document.querySelector('.message-input-container');
  if (chatHeader) chatHeader.style.display = '';
  if (messageInput) messageInput.style.display = '';

  // Update server nav active state
  document.querySelectorAll('.server-icon').forEach(el => el.classList.remove('active'));
  const serverEl = document.querySelector(`[data-server="${serverId}"]`);
  if (serverEl) serverEl.classList.add('active');

  const server = servers[serverId];
  if (!server) {
    // Server not found — show welcome landing
    showWelcomeLanding();
    return;
  }

  document.getElementById('sidebarTitle').textContent = server.name;
  renderChannelList(server);

  // Auto-select first text channel
  const categories = Object.values(server.channels);
  for (const channels of categories) {
    const textChannel = channels.find(c => c.type === 'text' || c.type === 'dm');
    if (textChannel) {
      switchChannel(textChannel.id);
      return;
    }
  }
}

// ============ CHANNEL LIST RENDERING ============

function renderChannelList(server) {
  const container = document.getElementById('channelList');
  container.innerHTML = '';

  if (activeServer === 'home') {
    // Search bar
    const searchDiv = document.createElement('div');
    searchDiv.className = 'dm-search-bar';
    searchDiv.innerHTML = '<input class="dm-search-input" placeholder="Find or start a conversation" onclick="if(typeof showFriendsPage===\'function\') showFriendsPage()">';
    container.appendChild(searchDiv);

    // Nav items: Friends
    const friendsNav = document.createElement('div');
    friendsNav.className = 'dm-nav-item' + (typeof NexusFriends !== 'undefined' && document.getElementById('friendsPage')?.classList.contains('visible') ? ' active' : '');
    friendsNav.onclick = () => { if (typeof showFriendsPage === 'function') showFriendsPage(); };
    const pendingCount = typeof NexusFriends !== 'undefined' ? NexusFriends.getIncoming().length : 0;
    friendsNav.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
      <span>Friends</span>
      ${pendingCount > 0 ? `<span class="dm-nav-badge">${pendingCount}</span>` : ''}
    `;
    container.appendChild(friendsNav);

    // DM header with + button
    const dmHeader = document.createElement('div');
    dmHeader.className = 'dm-section-header';
    dmHeader.innerHTML = `
      <span>DIRECT MESSAGES</span>
      <button class="dm-add-btn" onclick="event.stopPropagation(); if(typeof showFriendsPage==='function'){showFriendsPage(); if(typeof switchFriendsTab==='function') switchFriendsTab('add');}" title="Create DM">+</button>
    `;
    container.appendChild(dmHeader);

    // DM channels list
    const dmChannels = server.channels['dm'] || [];
    if (dmChannels.length > 0) {
      dmChannels.forEach(ch => {
        const item = document.createElement('div');
        item.className = 'dm-item' + (ch.id === activeChannel ? ' active' : '');
        item.dataset.channelId = ch.id;
        item.onclick = async () => {
          hideFriendsPage();
          
          // Make sure chat UI is visible
          const chatHeader = document.querySelector('.chat-header');
          const messageInputContainer = document.querySelector('.message-input-container');
          if (chatHeader) chatHeader.style.display = '';
          if (messageInputContainer) messageInputContainer.style.display = '';

          // Load messages from backend if not cached
          if (typeof NexusBackend !== 'undefined' && NexusBackend.loadMessages) {
            if (!channelMessages[ch.id] || channelMessages[ch.id].length === 0) {
              try {
                await NexusBackend.loadMessages(ch.id);
              } catch(e) {
                console.warn('[DM] Could not load messages:', e);
              }
            }
          }
          if (!channelMessages[ch.id]) channelMessages[ch.id] = [];

          switchChannel(ch.id);
        };

        const u = users[ch.userId] || {};
        const name = ch.name || u.name || 'Unknown';
        const status = u.status || 'offline';
        const color = u.color || '#dc2626';
        const initials = u.initials || name[0]?.toUpperCase() || '?';
        const unread = ch.unreadCount || 0;

        item.innerHTML = `
          <div class="dm-avatar" style="background:${color}">
            ${u.avatar ? `<img src="${u.avatar}" alt="">` : initials}
            <div class="status-dot ${status}"></div>
          </div>
          <div class="dm-info">
            <div class="dm-name">${name}</div>
            <div class="dm-status">${u.customStatus || status}</div>
          </div>
          ${unread > 0 ? `<span class="dm-unread-badge">${unread}</span>` : ''}
          <button class="dm-close-btn" onclick="event.stopPropagation(); closeDM('${ch.id}')" title="Close DM">×</button>
        `;
        container.appendChild(item);
      });
    } else {
      const empty = document.createElement('div');
      empty.className = 'dm-empty';
      empty.textContent = 'No conversations yet';
      container.appendChild(empty);
    }
    return;
  }

  Object.entries(server.channels).forEach(([categoryName, channels]) => {
    const catDiv = document.createElement('div');
    catDiv.className = 'channel-category';

    const catHeader = document.createElement('div');
    catHeader.className = 'category-header' + (collapsedCategories[categoryName] ? ' collapsed' : '');
    catHeader.innerHTML = `
      <span class="category-toggle">▼</span>
      <span class="category-name">${categoryName}</span>
      <span class="category-add" title="Create Channel">+</span>
    `;
    catHeader.onclick = (e) => {
      if (e.target.classList.contains('category-add')) return;
      collapsedCategories[categoryName] = !collapsedCategories[categoryName];
      catHeader.classList.toggle('collapsed');
      channelsDiv.style.display = collapsedCategories[categoryName] ? 'none' : 'block';
    };
    catDiv.appendChild(catHeader);

    const channelsDiv = document.createElement('div');
    channelsDiv.style.display = collapsedCategories[categoryName] ? 'none' : 'block';

    channels.forEach(ch => {
      if (ch.type === 'voice') {
        const voiceItem = createVoiceChannelItem(ch);
        channelsDiv.appendChild(voiceItem);
      } else {
        const item = createChannelItem(ch);
        channelsDiv.appendChild(item);
      }
    });

    catDiv.appendChild(channelsDiv);
    container.appendChild(catDiv);
  });
}

function createChannelItem(ch) {
  const item = document.createElement('div');
  item.className = 'channel-item' + (ch.id === activeChannel ? ' active' : '');
  item.dataset.channelId = ch.id;
  item.onclick = () => switchChannel(ch.id);

  let badgeHtml = ch.badge ? `<span class="channel-badge">${ch.badge}</span>` : '';
  let unreadDot = ch.unread ? '<span class="unread-dot"></span>' : '';

  item.innerHTML = `
    <span class="channel-icon">${ch.icon}</span>
    <span class="channel-name">${ch.name}</span>
    ${badgeHtml}
    ${unreadDot}
    <div class="channel-actions">
      <button class="channel-action-btn" title="Create Invite">👤</button>
      <button class="channel-action-btn" title="Settings">⚙️</button>
    </div>
  `;
  return item;
}

function createVoiceChannelItem(ch) {
  const wrapper = document.createElement('div');
  wrapper.className = 'voice-channel-wrapper';

  const item = document.createElement('div');
  const isInThisChannel = isVoiceConnected && voiceChannel === ch.id;
  item.className = 'channel-item' + (isInThisChannel ? ' voice-active' : '');
  item.dataset.channelId = ch.id;
  item.onclick = () => joinVoiceChannel(ch);

  item.innerHTML = `
    <span class="channel-icon">${ch.icon || '🔊'}</span>
    <span class="channel-name">${ch.name}</span>
    ${isInThisChannel ? '<span class="voice-connected-badge">Connected</span>' : ''}
  `;
  wrapper.appendChild(item);

  if (ch.voiceUsers && ch.voiceUsers.length > 0) {
    const voiceUsersDiv = document.createElement('div');
    voiceUsersDiv.className = 'voice-users';
    ch.voiceUsers.forEach(uid => {
      // uid could be a string ID or an object
      const userId = typeof uid === 'object' ? uid.id : uid;
      const u = users[userId] || (typeof uid === 'object' ? uid : null);
      if (!u) return;
      const isSelf = userId === currentUser.id;
      const isMuted = isSelf ? isMicMuted : false;
      const vu = document.createElement('div');
      vu.className = 'voice-user' + (isSelf ? ' self' : '');
      vu.dataset.userId = userId;
      vu.innerHTML = `
        <div class="voice-user-avatar" style="background:${u.color || '#dc2626'}">${u.initials || u.displayName?.[0] || '?'}</div>
        <span>${u.name || u.displayName || u.display_name || 'User'}</span>
        <div class="voice-user-icons">${isMuted ? '🔇' : '🎤'}</div>
      `;
      voiceUsersDiv.appendChild(vu);
    });
    wrapper.appendChild(voiceUsersDiv);
  }

  return wrapper;
}

// ============ CHANNEL SWITCHING ============

function switchChannel(channelId) {
  // Don't re-switch to the same channel
  if (activeChannel === channelId) return;

  activeChannel = channelId;

  // Update active state in sidebar — only one text channel active at a time
  document.querySelectorAll('.channel-item').forEach(el => {
    const isThis = el.dataset.channelId === channelId;
    el.classList.toggle('active', isThis);
  });

  // Also update DM item active state
  document.querySelectorAll('.dm-item').forEach(el => {
    const isThis = el.dataset.channelId === channelId;
    el.classList.toggle('active', isThis);
  });

  // Find channel data
  const ch = findChannel(channelId);
  if (!ch) {
    console.warn('[switchChannel] Channel not found:', channelId);
    return;
  }

  const isDM = ch.type === 'dm';

  // Update header
  if (isDM) {
    const dmUser = ch.userId ? (users[ch.userId] || {}) : {};
    const dmName = dmUser.name || ch.name || 'Direct Message';
    document.getElementById('chatHeaderIcon').textContent = '💬';
    document.getElementById('chatHeaderName').textContent = dmName;
    document.getElementById('chatHeaderTopic').textContent = '';
    document.getElementById('messageInput').placeholder = `Message @${dmName}`;
  } else {
    document.getElementById('chatHeaderIcon').textContent = ch.icon || '#';
    document.getElementById('chatHeaderName').textContent = ch.name;
    document.getElementById('chatHeaderTopic').textContent = ch.topic || '';
    document.getElementById('messageInput').placeholder = `Message #${ch.name}`;
  }

  // Update welcome
  const welcome = document.getElementById('channelWelcome');
  if (isDM) {
    const dmUser = ch.userId ? (users[ch.userId] || {}) : {};
    const dmName = dmUser.name || ch.name || 'Direct Message';
    welcome.querySelector('.channel-welcome-icon').textContent = '💬';
    welcome.querySelector('h1').textContent = dmName;
    welcome.querySelector('p').textContent = `This is the beginning of your direct message history with ${dmName}.`;
  } else {
    welcome.querySelector('.channel-welcome-icon').textContent = ch.icon || '#';
    welcome.querySelector('h1').textContent = `Welcome to #${ch.name}`;
    welcome.querySelector('p').textContent = `This is the start of the #${ch.name} channel. ${ch.topic || ''}`;
  }

  // Make sure chat area is visible
  const chatHeader = document.querySelector('.chat-header');
  const messageInputContainer = document.querySelector('.message-input-container');
  if (chatHeader) chatHeader.style.display = '';
  if (messageInputContainer) messageInputContainer.style.display = '';

  // Render messages
  renderMessages();

  // Close pinned panel
  pinnedVisible = false;
  document.getElementById('pinnedPanel').classList.remove('visible');
}

function closeDM(channelId) {
  const homeServer = servers['home'];
  if (!homeServer) return;
  const dmChannels = homeServer.channels['dm'] || [];
  const idx = dmChannels.findIndex(ch => ch.id === channelId);
  if (idx !== -1) dmChannels.splice(idx, 1);
  if (activeChannel === channelId) {
    activeChannel = null;
    if (typeof showFriendsPage === 'function') showFriendsPage();
  }
  renderChannelList(homeServer);
}

function findChannel(channelId) {
  for (const server of Object.values(servers)) {
    for (const channels of Object.values(server.channels)) {
      const ch = channels.find(c => c.id === channelId);
      if (ch) return ch;
    }
  }
  return null;
}

// ============ MESSAGE RENDERING ============

function renderMessages() {
  const container = document.getElementById('messagesContainer');
  container.innerHTML = '';

  const messages = channelMessages[activeChannel] || [];
  let lastDate = null;
  let lastUserId = null;
  let lastTimestamp = null;

  messages.forEach((msg, idx) => {
    const msgDate = formatDate(msg.timestamp);

    // Date divider
    if (msgDate !== lastDate) {
      const divider = document.createElement('div');
      divider.className = 'date-divider';
      divider.innerHTML = `<span>${msgDate}</span>`;
      container.appendChild(divider);
      lastDate = msgDate;
      lastUserId = null;
    }

    // System message
    if (msg.isSystem) {
      const sysEl = document.createElement('div');
      sysEl.className = 'system-message';
      sysEl.innerHTML = `
        <span class="system-message-icon">→</span>
        <span>${msg.content}</span>
      `;
      container.appendChild(sysEl);
      lastUserId = null;
      return;
    }

    // Look up user - check _user from backend, then users map, then fallback
    let user;
    if (msg._user) {
      user = { name: msg._user.displayName, initials: msg._user.initials, color: msg._user.color, status: msg._user.status, avatar: msg._user.avatar, avatarEmoji: msg._user.avatarEmoji, roleClass: '', id: msg._user.id, tag: msg._user.tag, about: msg._user.about };
      // Also populate users map for future lookups
      if (!users[msg.userId]) users[msg.userId] = user;
    } else {
      user = users[msg.userId] || { name: 'Unknown', initials: '?', color: '#666', roleClass: '' };
    }
    // Map current user's backend ID to currentUser display
    if (typeof currentUser !== 'undefined' && currentUser.id && msg.userId === currentUser.id) {
      user = { name: currentUser.name, initials: currentUser.initials, color: currentUser.color, status: currentUser.status, avatar: currentUser.avatar, avatarEmoji: currentUser.avatarEmoji, roleClass: '', id: currentUser.id, tag: currentUser.tag, about: currentUser.about };
    }
    const timeDiff = lastTimestamp ? (ensureDate(msg.timestamp).getTime() - ensureDate(lastTimestamp).getTime()) / 60000 : 999;
    const showAvatar = msg.userId !== lastUserId || timeDiff > 5;

    const msgEl = document.createElement('div');
    msgEl.className = 'message' + (showAvatar ? ' has-avatar' : '');
    msgEl.dataset.msgId = msg.id;
    msgEl.oncontextmenu = (e) => showContextMenu(e, msg);

    if (showAvatar) {
      msgEl.innerHTML = `
        <div class="message-avatar-col">
          <div class="message-avatar" style="background:${user.color}" onclick="showUserPopup(users['${msg.userId}'], event)">${user.initials}</div>
        </div>
        <div class="message-content-col">
          <div class="message-header">
            <span class="message-author ${user.roleClass || ''}" onclick="showUserPopup(users['${msg.userId}'], event)">${user.name}</span>
            ${user.isBot ? '<span class="message-bot-tag">BOT</span>' : ''}
            <span class="message-timestamp">${formatFullTimestamp(msg.timestamp)}</span>
            ${(msg.edited || msg.editedAt) ? '<span class="message-edited">(edited)</span>' : ''}
          </div>
          <div class="message-body">${formatMessageContent(msg.content)}</div>
          ${renderReactions(msg)}
        </div>
        <div class="message-action-bar">
          <button class="msg-action-btn" title="Add Reaction" onclick="addQuickReaction('${msg.id}')">😊</button>
          <button class="msg-action-btn" title="Reply" onclick="startReply('${msg.id}')">💬</button>
          <button class="msg-action-btn" title="Create Thread">🧵</button>
          <button class="msg-action-btn" title="More" onclick="showContextMenu(event, findMsgById('${msg.id}'))">⋯</button>
        </div>
      `;
    } else {
      msgEl.innerHTML = `
        <div class="message-timestamp-col">
          <span class="message-hover-time">${formatTime(msg.timestamp)}</span>
        </div>
        <div class="message-content-col">
          <div class="message-body">${formatMessageContent(msg.content)}</div>
          ${renderReactions(msg)}
        </div>
        <div class="message-action-bar">
          <button class="msg-action-btn" title="Add Reaction" onclick="addQuickReaction('${msg.id}')">😊</button>
          <button class="msg-action-btn" title="Reply" onclick="startReply('${msg.id}')">💬</button>
          <button class="msg-action-btn" title="Create Thread">🧵</button>
          <button class="msg-action-btn" title="More" onclick="showContextMenu(event, findMsgById('${msg.id}'))">⋯</button>
        </div>
      `;
    }

    container.appendChild(msgEl);
    lastUserId = msg.userId;
    lastTimestamp = msg.timestamp;
  });

  // Scroll to bottom
  const scroller = document.getElementById('messagesScroller');
  scroller.scrollTop = scroller.scrollHeight;

  // Render members
  renderMembers();
}

function formatMessageContent(content) {
  // Bold
  content = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  // Italic
  content = content.replace(/\*(.*?)\*/g, '<em>$1</em>');
  // Inline code
  content = content.replace(/`([^`]+)`/g, '<code>$1</code>');
  // Mentions
  content = content.replace(/@(\w[\w\s]*\w)/g, '<span class="mention">@$1</span>');
  // Links
  content = content.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank">$1</a>');
  // Newlines
  content = content.replace(/\n/g, '<br>');
  // Headers
  content = content.replace(/^# (.+)$/gm, '<strong style="font-size:18px;">$1</strong>');
  // Bullet points
  content = content.replace(/^• (.+)$/gm, '&nbsp;&nbsp;• $1');

  return content;
}

function renderReactions(msg) {
  if (!msg.reactions || msg.reactions.length === 0) return '';

  let html = '<div class="message-reactions">';
  msg.reactions.forEach((r, i) => {
    html += `<div class="reaction${r.active ? ' active' : ''}" onclick="toggleReaction('${msg.id}', ${i})">
      <span>${r.emoji}</span>
      <span class="reaction-count">${r.count}</span>
    </div>`;
  });
  html += '<div class="reaction-add" title="Add Reaction">+</div>';
  html += '</div>';
  return html;
}

function findMsgById(msgId) {
  const messages = channelMessages[activeChannel] || [];
  return messages.find(m => m.id === msgId);
}

// ============ SCROLL HELPER ============

function scrollToBottom() {
  const scroller = document.getElementById('messagesScroller');
  if (scroller) {
    scroller.scrollTop = scroller.scrollHeight;
  }
}

// ============ SENDING MESSAGES ============

function handleInputKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

async function sendMessage() {
  const input = document.getElementById('messageInput');
  const content = input.value.trim();
  if (!content) return;

  // Check for slash commands first
  if (content.startsWith('/')) {
    input.value = '';
    input.style.height = 'auto';
    cancelReply();
    processSlashCommand(content);
    return;
  }

  // Clear input immediately for responsiveness
  input.value = '';
  input.style.height = 'auto';
  cancelReply();

  // Send via backend
  if (typeof NexusBackend !== 'undefined') {
    try {
      const msg = await NexusBackend.sendMessage(activeChannel, content);
      if (msg) {
        renderMessages();
        scrollToBottom();
      } else {
        showToast('Failed to send message', 'error');
      }
    } catch (err) {
      console.error('sendMessage error:', err);
      showToast('Failed to send message', 'error');
    }
  }
}

// ============ REACTIONS ============

async function toggleReaction(msgId, reactionIdx) {
  const messages = channelMessages[activeChannel] || [];
  const msg = messages.find(m => m.id === msgId);
  if (!msg || !msg.reactions[reactionIdx]) return;

  const emoji = msg.reactions[reactionIdx].emoji;

  // Use backend API
  if (typeof NexusBackend !== 'undefined') {
    try {
      await NexusBackend.toggleReaction(msgId, emoji, activeChannel);
    } catch (err) {
      console.error('toggleReaction error:', err);
    }
  }

  // Optimistic local update
  const reaction = msg.reactions[reactionIdx];
  reaction.active = !reaction.active;
  reaction.count += reaction.active ? 1 : -1;
  if (reaction.count <= 0) {
    msg.reactions.splice(reactionIdx, 1);
  }
  renderMessages();
}

async function addQuickReaction(msgId) {
  const emojis = ['👍', '❤️', '😂', '😮', '😢', '🔥', '👀', '🎉'];
  const emoji = emojis[Math.floor(Math.random() * emojis.length)];

  const messages = channelMessages[activeChannel] || [];
  const msg = messages.find(m => m.id === msgId);
  if (!msg) return;

  // Use backend API
  if (typeof NexusBackend !== 'undefined') {
    try {
      await NexusBackend.toggleReaction(msgId, emoji, activeChannel);
    } catch (err) {
      console.error('addQuickReaction error:', err);
    }
  }

  // Optimistic local update
  const existing = msg.reactions.find(r => r.emoji === emoji);
  if (existing) {
    existing.count++;
    existing.active = true;
  } else {
    msg.reactions.push({ emoji, count: 1, active: true });
  }
  renderMessages();
}

// ============ REPLY ============

function startReply(msgId) {
  const msg = findMsgById(msgId);
  if (!msg) return;
  const user = users[msg.userId];
  replyingTo = msgId;

  const replyBar = document.getElementById('replyBar');
  replyBar.classList.add('visible');
  document.getElementById('replyTarget').textContent = user ? user.name : 'Unknown';
  document.getElementById('messageInput').focus();
}

function cancelReply() {
  replyingTo = null;
  document.getElementById('replyBar').classList.remove('visible');
}

// ============ MEMBERS SIDEBAR ============

function renderMembers() {
  const container = document.getElementById('membersList');
  container.innerHTML = '';

  // Get members for the current server — use backend data if available
  let serverMembers = [];
  const serverData = typeof NexusBackend !== 'undefined' ? NexusBackend.getServersCache()?.[activeServer] : null;
  
  if (serverData && serverData.members) {
    // Use actual server members from backend
    serverMembers = serverData.members
      .filter(m => m.id !== (currentUser._authId || currentUser.id))
      .map(m => users[m.id] || m);
  } else {
    // Fallback: filter users but exclude bots
    serverMembers = Object.values(users).filter(u => 
      u.id && u.id !== currentUser.id && u.id !== (currentUser._authId || currentUser.id) && !u.id.startsWith('bot-') && !u.isBot
    );
  }
  
  const onlineMembers = serverMembers.filter(u => u.status === 'online');
  const idleMembers = serverMembers.filter(u => u.status === 'idle');
  const dndMembers = serverMembers.filter(u => u.status === 'dnd');
  const offlineMembers = serverMembers.filter(u => u.status === 'offline' || !u.status);

  // Invite button at top
  if (activeServer && activeServer !== 'home') {
    const inviteDiv = document.createElement('div');
    inviteDiv.className = 'members-invite-btn';
    inviteDiv.onclick = () => showInviteModal(activeServer);
    inviteDiv.innerHTML = `<span>👥</span> Invite People`;
    container.appendChild(inviteDiv);
  }

  // Current user first
  const youLabel = document.createElement('div');
  youLabel.className = 'members-category';
  youLabel.textContent = 'You — 1';
  container.appendChild(youLabel);
  container.appendChild(createMemberItem(currentUser));

  if (onlineMembers.length > 0) {
    const label = document.createElement('div');
    label.className = 'members-category';
    label.textContent = `Online — ${onlineMembers.length}`;
    container.appendChild(label);
    onlineMembers.forEach(u => container.appendChild(createMemberItem(u)));
  }

  if (idleMembers.length > 0) {
    const label = document.createElement('div');
    label.className = 'members-category';
    label.textContent = `Idle — ${idleMembers.length}`;
    container.appendChild(label);
    idleMembers.forEach(u => container.appendChild(createMemberItem(u)));
  }

  if (dndMembers.length > 0) {
    const label = document.createElement('div');
    label.className = 'members-category';
    label.textContent = `Do Not Disturb — ${dndMembers.length}`;
    container.appendChild(label);
    dndMembers.forEach(u => container.appendChild(createMemberItem(u)));
  }

  if (offlineMembers.length > 0) {
    container.innerHTML += `<div class="members-category">Offline — ${offlineMembers.length}</div>`;
    offlineMembers.forEach(u => {
      const el = createMemberItem(u);
      el.classList.add('offline');
      container.appendChild(el);
    });
  }
}

function createMemberItem(user) {
  const item = document.createElement('div');
  item.className = 'member-item';
  item.onclick = (e) => showUserPopup(user, e);

  const statusTexts = {
    'online': '',
    'idle': 'Idle',
    'dnd': 'Do Not Disturb',
    'offline': 'Offline'
  };

  item.innerHTML = `
    <div class="member-avatar" style="background:${user.color}">
      ${user.initials}
      <div class="status-dot ${user.status}"></div>
    </div>
    <div class="member-info">
      <div class="member-name" style="color:${user.roles && user.roles[0] ? user.roles[0].color : 'var(--text-primary)'}">${user.name}</div>
      ${user.about ? `<div class="member-status-text">${user.about.substring(0, 30)}${user.about.length > 30 ? '...' : ''}</div>` : ''}
    </div>
  `;
  return item;
}

function toggleMembers() {
  membersVisible = !membersVisible;
  const sidebar = document.getElementById('membersSidebar');
  sidebar.classList.toggle('hidden', !membersVisible);
  document.getElementById('membersToggleBtn').classList.toggle('active', membersVisible);
}

// ============ VOICE CHANNELS ============

async function joinVoiceChannel(ch) {
  // Toggle off if already in this channel
  if (isVoiceConnected && voiceChannel === ch.id) {
    disconnectVoice();
    return;
  }

  // Leave previous voice channel if in one
  if (isVoiceConnected && voiceChannel) {
    await VoiceEngine.leaveChannel();
    const oldCh = findChannel(voiceChannel);
    if (oldCh && oldCh.voiceUsers) {
      oldCh.voiceUsers = oldCh.voiceUsers.filter(id => id !== currentUser.id);
    }
  }

  // Join new voice channel via WebRTC
  const success = await VoiceEngine.joinChannel(ch.id, currentUser.id);
  if (!success) {
    showToast('Could not access microphone. Check your browser permissions.', 'error');
    return;
  }

  isVoiceConnected = true;
  voiceChannel = ch.id;
  isMicMuted = false;
  isDeafened = false;

  const bar = document.getElementById('voiceBar');
  bar.classList.add('visible');
  document.getElementById('voiceChannelName').textContent = ch.name;

  // Update mute/deafen buttons
  const muteBtn = document.getElementById('vcMute');
  const deafenBtn = document.getElementById('vcDeafen');
  if (muteBtn) { muteBtn.textContent = '🎤'; muteBtn.style.color = ''; }
  if (deafenBtn) { deafenBtn.textContent = '🎧'; deafenBtn.style.color = ''; }

  // Add self to voice users for UI
  if (!ch.voiceUsers) ch.voiceUsers = [];
  if (!ch.voiceUsers.find(u => u === currentUser.id || u.id === currentUser.id)) {
    ch.voiceUsers.push(currentUser.id);
  }

  // Set up speaking detection
  VoiceEngine.createSpeakingDetector((speaking) => {
    const voiceUsers = document.querySelectorAll('.voice-user');
    voiceUsers.forEach(el => {
      if (el.dataset.userId === currentUser.id) {
        el.classList.toggle('speaking', speaking);
      }
    });
  });

  // Highlight the voice channel in sidebar
  document.querySelectorAll('.channel-item').forEach(el => {
    el.classList.toggle('voice-active', el.dataset.channelId === ch.id);
  });

  renderChannelList(servers[activeServer]);
  showToast(`Connected to ${ch.name}`, 'success');
}

async function disconnectVoice() {
  if (voiceChannel) {
    const ch = findChannel(voiceChannel);
    if (ch && ch.voiceUsers) {
      ch.voiceUsers = ch.voiceUsers.filter(id => id !== currentUser.id && id?.id !== currentUser.id);
    }
  }

  await VoiceEngine.leaveChannel();

  isVoiceConnected = false;
  voiceChannel = null;
  isMicMuted = false;
  isDeafened = false;
  document.getElementById('voiceBar').classList.remove('visible');

  document.querySelectorAll('.channel-item').forEach(el => {
    el.classList.remove('voice-active');
  });

  if (activeServer && servers[activeServer]) {
    renderChannelList(servers[activeServer]);
  }
  showToast('Disconnected from voice', 'info');
}

function toggleVoiceMute() {
  const muted = VoiceEngine.toggleMute();
  isMicMuted = muted;
  const btn = document.getElementById('vcMute');
  btn.textContent = muted ? '🔇' : '🎤';
  btn.style.color = muted ? 'var(--nexus-danger)' : '';
}

function toggleVoiceDeafen() {
  const deafened = VoiceEngine.toggleDeafen();
  isDeafened = deafened;
  isMicMuted = VoiceEngine.isMuted;
  const deafBtn = document.getElementById('vcDeafen');
  const muteBtn = document.getElementById('vcMute');
  deafBtn.textContent = deafened ? '🔇' : '🎧';
  deafBtn.style.color = deafened ? 'var(--nexus-danger)' : '';
  muteBtn.textContent = isMicMuted ? '🔇' : '🎤';
  muteBtn.style.color = isMicMuted ? 'var(--nexus-danger)' : '';
}

// ============ USER PANEL CONTROLS ============

function toggleMic() {
  if (VoiceEngine.isConnected) {
    const muted = VoiceEngine.toggleMute();
    isMicMuted = muted;
  } else {
    isMicMuted = !isMicMuted;
  }
  const btn = document.getElementById('micBtn');
  btn.classList.toggle('muted', isMicMuted);
  btn.textContent = isMicMuted ? '🔇' : '🎤';
  // Sync voice bar button
  const vcMute = document.getElementById('vcMute');
  if (vcMute) {
    vcMute.textContent = isMicMuted ? '🔇' : '🎤';
    vcMute.style.color = isMicMuted ? 'var(--nexus-danger)' : '';
  }
}

function toggleDeafen() {
  if (VoiceEngine.isConnected) {
    const deafened = VoiceEngine.toggleDeafen();
    isDeafened = deafened;
    isMicMuted = VoiceEngine.isMuted;
  } else {
    isDeafened = !isDeafened;
  }
  const btn = document.getElementById('deafenBtn');
  btn.classList.toggle('muted', isDeafened);
  btn.textContent = isDeafened ? '🔇' : '🎧';
  // Sync voice bar buttons
  const vcDeafen = document.getElementById('vcDeafen');
  const vcMute = document.getElementById('vcMute');
  if (vcDeafen) {
    vcDeafen.textContent = isDeafened ? '🔇' : '🎧';
    vcDeafen.style.color = isDeafened ? 'var(--nexus-danger)' : '';
  }
  if (vcMute) {
    vcMute.textContent = isMicMuted ? '🔇' : '🎤';
    vcMute.style.color = isMicMuted ? 'var(--nexus-danger)' : '';
  }
  const micBtn = document.getElementById('micBtn');
  if (micBtn) {
    micBtn.classList.toggle('muted', isMicMuted);
    micBtn.textContent = isMicMuted ? '🔇' : '🎤';
  }
}

// ============ TOOLTIPS ============

function setupTooltips() {
  const tooltip = document.getElementById('tooltip');

  document.querySelectorAll('[data-tooltip]').forEach(el => {
    el.addEventListener('mouseenter', (e) => {
      const text = el.getAttribute('data-tooltip');
      tooltip.textContent = text;
      tooltip.classList.add('visible');

      const rect = el.getBoundingClientRect();
      tooltip.style.left = (rect.right + 12) + 'px';
      tooltip.style.top = (rect.top + rect.height / 2 - 16) + 'px';
    });

    el.addEventListener('mouseleave', () => {
      tooltip.classList.remove('visible');
    });
  });
}

// ============ CONTEXT MENU ============

function setupContextMenu() {
  document.addEventListener('click', () => {
    document.getElementById('contextMenu').classList.remove('visible');
  });
}

function showContextMenu(e, msg) {
  e.preventDefault();
  e.stopPropagation();

  const menu = document.getElementById('contextMenu');
  menu.classList.add('visible');
  menu.style.left = e.clientX + 'px';
  menu.style.top = e.clientY + 'px';

  // Ensure menu stays in viewport
  const rect = menu.getBoundingClientRect();
  if (rect.right > window.innerWidth) {
    menu.style.left = (e.clientX - rect.width) + 'px';
  }
  if (rect.bottom > window.innerHeight) {
    menu.style.top = (e.clientY - rect.height) + 'px';
  }

  // Setup actions
  menu.querySelectorAll('.context-menu-item').forEach(item => {
    item.onclick = () => {
      const action = item.dataset.action;
      handleContextAction(action, msg);
      menu.classList.remove('visible');
    };
  });
}

function handleContextAction(action, msg) {
  if (!msg) return;

  switch (action) {
    case 'reply':
      startReply(msg.id);
      break;
    case 'edit':
      if (msg.userId === currentUser.id || msg.userId === (currentUser._authId || '')) {
        const newContent = prompt('Edit message:', msg.content);
        if (newContent !== null && newContent.trim()) {
          if (typeof editMessageBackend === 'function') {
            editMessageBackend(msg.id, newContent.trim());
          } else {
            msg.content = newContent.trim();
            msg.edited = true;
            renderMessages();
          }
        }
      }
      break;
    case 'pin':
      showToast('Message pinned! 📌');
      break;
    case 'react':
      addQuickReaction(msg.id);
      break;
    case 'thread':
      showToast('Threads coming soon! 🧵');
      break;
    case 'copy':
      navigator.clipboard.writeText(msg.content).then(() => {
        showToast('Copied to clipboard!');
      });
      break;
    case 'copyid':
      navigator.clipboard.writeText(msg.id).then(() => {
        showToast('Message ID copied!');
      });
      break;
    case 'delete':
      if (msg.userId === currentUser.id || msg.userId === (currentUser._authId || '') || confirm('Are you sure you want to delete this message?')) {
        if (typeof deleteMessageBackend === 'function') {
          deleteMessageBackend(msg.id);
        } else {
          const messages = channelMessages[activeChannel];
          const idx = messages.findIndex(m => m.id === msg.id);
          if (idx !== -1) {
            messages.splice(idx, 1);
            renderMessages();
          }
        }
      }
      break;
  }
}

// ============ USER POPUP ============

function showUserPopup(user, event) {
  if (!user) return;
  event.stopPropagation();

  const popup = document.getElementById('userPopup');
  const banner = document.getElementById('popupBanner');
  const avatar = document.getElementById('popupAvatar');
  const nameEl = document.getElementById('popupName');
  const tagEl = document.getElementById('popupTag');
  const aboutEl = document.getElementById('popupAbout');
  const rolesEl = document.getElementById('popupRoles');
  const msgInput = document.getElementById('popupMsgInput');

  banner.style.background = `linear-gradient(135deg, ${user.color}, ${user.color}88)`;
  avatar.style.background = user.color;
  avatar.textContent = user.initials;
  nameEl.textContent = user.name;
  tagEl.textContent = user.tag;
  aboutEl.textContent = user.about || 'No bio set.';
  msgInput.placeholder = `Message @${user.name}`;

  rolesEl.innerHTML = '';
  if (user.roles) {
    user.roles.forEach(role => {
      rolesEl.innerHTML += `<div class="role-tag"><span class="role-dot" style="background:${role.color}"></span> ${role.name}</div>`;
    });
  }

  // Setup message input handler for DMs
  msgInput.value = '';
  msgInput.onkeydown = async (e) => {
    if (e.key === 'Enter' && msgInput.value.trim()) {
      const content = msgInput.value.trim();
      msgInput.value = '';
      popup.classList.remove('visible');
      // Open DM with this user and send message
      if (typeof NexusBackend !== 'undefined' && user.id) {
        try {
          const result = await NexusBackend.openDM(user.id);
          if (result && result.success && result.channel) {
            switchServer('home');
            switchChannel(result.channel.id);
            // Send the message after switching
            setTimeout(async () => {
              await NexusBackend.sendMessage(result.channel.id, content);
              renderMessages();
              scrollToBottom();
            }, 300);
          }
        } catch (err) {
          console.error('DM send error:', err);
          showToast('Failed to send DM', 'error');
        }
      }
    }
  };

  popup.classList.add('visible');

  // Position popup
  const rect = event.target.getBoundingClientRect();
  let left = rect.right + 12;
  let top = rect.top - 50;

  if (left + 300 > window.innerWidth) {
    left = rect.left - 312;
  }
  if (top + 350 > window.innerHeight) {
    top = window.innerHeight - 360;
  }
  if (top < 10) top = 10;

  popup.style.left = left + 'px';
  popup.style.top = top + 'px';
}

function setupClickOutside() {
  document.addEventListener('click', (e) => {
    const popup = document.getElementById('userPopup');
    if (popup.classList.contains('visible') && !popup.contains(e.target)) {
      popup.classList.remove('visible');
    }
  });
}

// ============ EMOJI PICKER ============

const emojiList = [
  '😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩',
  '😘','😗','😚','😙','🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🫡',
  '🤐','🤨','😐','😑','😶','🫥','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴',
  '😷','🤒','🤕','🤢','🤮','🥵','🥶','🥴','😵','🤯','🤠','🥳','🥸','😎','🤓','🧐',
  '😕','🫤','😟','🙁','😮','😯','😲','😳','🥺','🥹','😦','😧','😨','😰','😥','😢',
  '😭','😱','😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬','😈','👿','💀',
  '👋','🤚','🖐️','✋','🖖','🫱','🫲','🫳','🫴','👌','🤌','🤏','✌️','🤞','🫰','🤟',
  '🤘','🤙','👈','👉','👆','🖕','👇','☝️','🫵','👍','👎','✊','👊','🤛','🤜','👏',
  '❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❤️‍🔥','❤️‍🩹','💕','💞','💓','💗',
  '💖','💘','💝','💟','🔥','⭐','🌟','✨','💫','🎉','🎊','🎈','🎁','🏆','🥇','🎮',
  '🎵','🎶','🎹','🎸','🎺','🥁','🎨','🖌️','📸','🎬','📱','💻','⌨️','🖥️','🔧','⚡',
  '🚀','🌍','🌙','☀️','🌈','☁️','🌊','🍕','🍔','🍟','🌮','🍩','☕','🍺','🥂','🍷'
];

function populateEmojiPicker() {
  const grid = document.getElementById('emojiGrid');
  grid.innerHTML = '';
  emojiList.forEach(emoji => {
    const item = document.createElement('div');
    item.className = 'emoji-item';
    item.textContent = emoji;
    item.onclick = (e) => {
      e.stopPropagation();
      insertEmoji(emoji);
    };
    grid.appendChild(item);
  });
}

function filterEmojis(query) {
  const items = document.querySelectorAll('.emoji-item');
  if (!query) {
    items.forEach(item => item.style.display = '');
    return;
  }
  const q = query.toLowerCase();
  items.forEach(item => {
    const emoji = item.textContent.trim();
    const title = (item.title || item.dataset.name || '').toLowerCase();
    // Show if the title/name contains the query, or if query matches the emoji itself
    item.style.display = (title.includes(q) || emoji.includes(q)) ? '' : 'none';
  });
}

function insertEmoji(emoji) {
  const input = document.getElementById('messageInput');
  input.value += emoji;
  input.focus();
  toggleEmojiPicker();
}

function toggleEmojiPicker() {
  const picker = document.getElementById('emojiPicker');
  picker.classList.toggle('visible');
}

// ============ MEDIA PICKER ============

function toggleMediaPicker() {
  // Simple toggle for demo
  showToast('GIF & Sticker picker coming soon! 🎁');
}

// ============ PINNED MESSAGES ============

function togglePinned() {
  pinnedVisible = !pinnedVisible;
  document.getElementById('pinnedPanel').classList.toggle('visible', pinnedVisible);
}

// ============ SEARCH ============

function handleSearch(e) {
  if (e.key === 'Enter') {
    const query = e.target.value.trim().toLowerCase();
    if (!query) return;

    const messages = channelMessages[activeChannel] || [];
    const results = messages.filter(m => m.content.toLowerCase().includes(query));

    if (results.length > 0) {
      showToast(`Found ${results.length} message(s) matching "${query}"`);
      // Highlight first result
      const msgEl = document.querySelector(`[data-msg-id="${results[results.length - 1].id}"]`);
      if (msgEl) {
        msgEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        msgEl.style.background = 'rgba(14,165,233,0.15)';
        setTimeout(() => { msgEl.style.background = ''; }, 2000);
      }
    } else {
      showToast(`No messages found for "${query}"`);
    }
    e.target.value = '';
  }
}

// ============ FILE UPLOAD ============

async function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  // Upload via backend API if available
  if (typeof NexusAPI !== 'undefined' && NexusAPI.isAuthenticated()) {
    try {
      showToast('Uploading file...');
      const content = `📎 Uploaded: **${file.name}** (${(file.size / 1024).toFixed(1)} KB)`;
      // Send as a message with file attachment info
      if (typeof NexusBackend !== 'undefined') {
        const msg = await NexusBackend.sendMessage(activeChannel, content);
        if (msg) {
          renderMessages();
          scrollToBottom();
        }
      }
    } catch (err) {
      console.error('File upload error:', err);
      showToast('Failed to upload file', 'error');
    }
  } else {
    showToast('Not connected to backend', 'error');
  }
  event.target.value = '';
}

// ============ SETTINGS ============

function openSettings() {
  document.getElementById('settingsOverlay').classList.add('visible');
}

document.getElementById('settingsClose').onclick = () => {
  document.getElementById('settingsOverlay').classList.remove('visible');
};

function setupSettingsNav() {
  document.querySelectorAll('.settings-nav-item').forEach(item => {
    item.onclick = () => {
      document.querySelectorAll('.settings-nav-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');

      const section = item.dataset.section;
      renderSettingsContent(section);
    };
  });
}

function renderSettingsContent(section) {
  const content = document.getElementById('settingsContent');

  const sections = {
    account: `
      <div class="settings-section">
        <h2>My Account</h2>
        <div class="settings-card">
          <div style="display:flex;align-items:center;gap:16px;margin-bottom:16px;">
            <div style="width:80px;height:80px;border-radius:50%;background:var(--nexus-primary);display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:800;color:#fff;">N</div>
            <div>
              <div style="font-size:18px;font-weight:700;color:var(--text-primary);">NexusUser</div>
              <div style="font-size:13px;color:var(--text-muted);">nexususer#7842</div>
            </div>
            <button class="btn btn-primary" style="margin-left:auto;">Edit Profile</button>
          </div>
          <div class="settings-row"><div><div class="settings-row-label">Username</div><div class="settings-row-desc">NexusUser#7842</div></div><button class="btn btn-secondary">Edit</button></div>
          <div class="settings-row"><div><div class="settings-row-label">Email</div><div class="settings-row-desc">n****r@email.com</div></div><button class="btn btn-secondary">Reveal</button></div>
          <div class="settings-row"><div><div class="settings-row-label">Phone Number</div><div class="settings-row-desc">Not added</div></div><button class="btn btn-secondary">Add</button></div>
        </div>
      </div>`,
    appearance: (typeof NexusThemes !== 'undefined') ? NexusThemes.renderAppearanceSection() : `<div class="settings-section"><h2>Appearance</h2><p style="color:var(--text-muted)">Loading theme settings...</p></div>`,
    notifications: `
      <div class="settings-section">
        <h2>Notifications</h2>
        <div class="settings-card">
          <div class="settings-row"><div><div class="settings-row-label">Enable Desktop Notifications</div><div class="settings-row-desc">Show notifications on your desktop</div></div><div class="toggle active" onclick="this.classList.toggle('active')"></div></div>
          <div class="settings-row"><div><div class="settings-row-label">Enable Notification Sounds</div><div class="settings-row-desc">Play a sound when you receive a notification</div></div><div class="toggle active" onclick="this.classList.toggle('active')"></div></div>
          <div class="settings-row"><div><div class="settings-row-label">Enable Unread Badge</div><div class="settings-row-desc">Show unread message count on the app icon</div></div><div class="toggle active" onclick="this.classList.toggle('active')"></div></div>
          <div class="settings-row"><div><div class="settings-row-label">Notification for All Messages</div><div class="settings-row-desc">Get notified for every message, not just mentions</div></div><div class="toggle" onclick="this.classList.toggle('active')"></div></div>
        </div>
      </div>`,
    voice: `
      <div class="settings-section">
        <h2>Voice & Video</h2>
        <div class="settings-card">
          <div class="settings-row"><div><div class="settings-row-label">Input Device</div><div class="settings-row-desc">Default Microphone</div></div><button class="btn btn-secondary">Change</button></div>
          <div class="settings-row"><div><div class="settings-row-label">Output Device</div><div class="settings-row-desc">Default Speakers</div></div><button class="btn btn-secondary">Change</button></div>
          <div class="settings-row"><div><div class="settings-row-label">Input Volume</div></div><input type="range" min="0" max="100" value="80" style="width:150px;accent-color:var(--nexus-primary);"></div>
          <div class="settings-row"><div><div class="settings-row-label">Output Volume</div></div><input type="range" min="0" max="100" value="100" style="width:150px;accent-color:var(--nexus-primary);"></div>
          <div class="settings-row"><div><div class="settings-row-label">Noise Suppression</div><div class="settings-row-desc">Reduce background noise</div></div><div class="toggle active" onclick="this.classList.toggle('active')"></div></div>
          <div class="settings-row"><div><div class="settings-row-label">Echo Cancellation</div><div class="settings-row-desc">Prevent echo in voice calls</div></div><div class="toggle active" onclick="this.classList.toggle('active')"></div></div>
        </div>
      </div>`,
    profile: `
      <div class="settings-section">
        <h2>Profile</h2>
        <div class="settings-card">
          <div style="display:flex;gap:24px;">
            <div style="flex:1;">
              <div class="form-group"><label class="form-label">Display Name</label><input class="form-input" value="NexusUser"></div>
              <div class="form-group"><label class="form-label">About Me</label><textarea class="form-input" rows="3" style="resize:vertical;">Building cool things with Nexus Chat!</textarea></div>
              <div class="form-group"><label class="form-label">Banner Color</label><div style="display:flex;gap:8px;"><div style="width:32px;height:32px;border-radius:50%;background:var(--nexus-primary);cursor:pointer;border:2px solid var(--text-primary);"></div><div style="width:32px;height:32px;border-radius:50%;background:#f43f5e;cursor:pointer;"></div><div style="width:32px;height:32px;border-radius:50%;background:#f87171;cursor:pointer;"></div><div style="width:32px;height:32px;border-radius:50%;background:#a78bfa;cursor:pointer;"></div><div style="width:32px;height:32px;border-radius:50%;background:#f59e0b;cursor:pointer;"></div></div></div>
            </div>
            <div style="width:260px;">
              <div style="background:var(--bg-floating);border-radius:12px;overflow:hidden;">
                <div style="height:60px;background:linear-gradient(135deg,var(--nexus-primary),var(--nexus-accent));"></div>
                <div style="margin:-24px 16px 0 16px;"><div style="width:64px;height:64px;border-radius:50%;background:var(--nexus-primary);border:4px solid var(--bg-floating);display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:800;color:#fff;">N</div></div>
                <div style="padding:8px 16px 16px 16px;"><div style="font-size:16px;font-weight:700;">NexusUser</div><div style="font-size:12px;color:var(--text-muted);">nexususer#7842</div><div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border-subtle);font-size:12px;color:var(--text-secondary);">Building cool things with Nexus Chat!</div></div>
              </div>
              <div style="text-align:center;margin-top:8px;font-size:11px;color:var(--text-muted);">Preview</div>
            </div>
          </div>
        </div>
      </div>`,
    privacy: `
      <div class="settings-section">
        <h2>Privacy & Safety</h2>
        <div class="settings-card">
          <div class="settings-row"><div><div class="settings-row-label">Direct Messages from Server Members</div><div class="settings-row-desc">Allow DMs from people in shared servers</div></div><div class="toggle active" onclick="this.classList.toggle('active')"></div></div>
          <div class="settings-row"><div><div class="settings-row-label">Message Requests</div><div class="settings-row-desc">Require approval before receiving DMs from strangers</div></div><div class="toggle active" onclick="this.classList.toggle('active')"></div></div>
          <div class="settings-row"><div><div class="settings-row-label">Explicit Content Filter</div><div class="settings-row-desc">Scan and block explicit images in DMs</div></div><div class="toggle active" onclick="this.classList.toggle('active')"></div></div>
        </div>
      </div>`,
    pro: `
      <div class="settings-section">
        <h2>Nexus Pro</h2>
        <div style="background:linear-gradient(135deg,rgba(14,165,233,0.2),rgba(6,214,160,0.2));border-radius:16px;padding:32px;text-align:center;margin-bottom:24px;">
          <div style="font-size:48px;margin-bottom:12px;">✨</div>
          <h3 style="font-size:24px;font-weight:800;color:var(--text-primary);margin-bottom:8px;">Upgrade to Nexus Pro</h3>
          <p style="color:var(--text-secondary);margin-bottom:20px;max-width:400px;margin-left:auto;margin-right:auto;">Get custom profiles, animated avatars, bigger file uploads, HD streaming, and exclusive badges!</p>
          <button class="btn btn-primary" style="padding:12px 32px;font-size:16px;border-radius:24px;">Subscribe — $4.99/month</button>
        </div>
        <div class="settings-card">
          <h3 style="font-size:16px;font-weight:700;margin-bottom:16px;">Pro Features</h3>
          <div class="settings-row"><div><div class="settings-row-label">🎨 Custom Profiles</div><div class="settings-row-desc">Animated avatars, banners, and custom themes</div></div></div>
          <div class="settings-row"><div><div class="settings-row-label">📁 100MB File Uploads</div><div class="settings-row-desc">Upload files up to 100MB per message</div></div></div>
          <div class="settings-row"><div><div class="settings-row-label">🎥 HD Streaming</div><div class="settings-row-desc">Stream in 1080p 60fps to your friends</div></div></div>
          <div class="settings-row"><div><div class="settings-row-label">😎 Exclusive Badge</div><div class="settings-row-desc">Show off your Pro status with a special badge</div></div></div>
          <div class="settings-row"><div><div class="settings-row-label">🚀 Early Access</div><div class="settings-row-desc">Be the first to try new features</div></div></div>
        </div>
      </div>`,
    logout: `
      <div class="settings-section">
        <h2>Log Out</h2>
        <div class="settings-card" style="text-align:center;padding:40px;">
          <p style="font-size:16px;color:var(--text-secondary);margin-bottom:20px;">Are you sure you want to log out?</p>
          <div style="display:flex;gap:12px;justify-content:center;">
            <button class="btn btn-secondary" onclick="document.getElementById('settingsOverlay').classList.remove('visible')">Cancel</button>
            <button class="btn btn-danger" onclick="if(typeof NexusBackend!=='undefined'){NexusBackend.handleLogout();}else{localStorage.clear();sessionStorage.clear();location.reload();}">Log Out</button>
          </div>
        </div>
      </div>`
  };

  content.innerHTML = sections[section] || `<div class="settings-section"><h2>${section.charAt(0).toUpperCase() + section.slice(1)}</h2><div class="settings-card"><p style="color:var(--text-muted);padding:20px;text-align:center;">Settings for this section coming soon!</p></div></div>`;
}

// ============ MODALS ============

function openModal(id) {
  document.getElementById(id).classList.add('visible');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('visible');
}

async function createServer() {
  const name = document.getElementById('newServerName').value.trim();
  if (!name) return;

  // Use backend API to create the server
  if (typeof NexusAPI !== 'undefined' && NexusAPI.isAuthenticated()) {
    try {
      const result = await NexusAPI.createServer({ name });
      if (result.success) {
        const srv = result.server;
        // Use same ID mapping as rebuildServersData for consistency
        const serverId = srv.id.replace(/^srv-/, '');
        const initials = name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();

        // Build channels structure from backend response
        const channelsObj = {};
        if (srv.categories) {
          for (const cat of srv.categories) {
            channelsObj[cat.name] = (cat.channels || []).map(ch => ({
              id: ch.id,
              name: ch.name,
              type: ch.type || 'text',
              icon: ch.icon || (ch.type === 'voice' ? '🔊' : '#'),
              topic: ch.topic || '',
              voiceUsers: []
            }));
          }
        }
        if (Object.keys(channelsObj).length === 0) {
          channelsObj['Text Channels'] = [
            { id: srv.id + '-general', name: 'general', type: 'text', icon: '#', topic: `Welcome to ${name}!` }
          ];
        }

        servers[serverId] = { _backendId: srv.id, name: name, channels: channelsObj };

        // Add server icon to nav
        const nav = document.getElementById('serverNav');
        const separator = nav.querySelectorAll('.server-separator')[1];
        const icon = document.createElement('div');
        icon.className = 'server-icon server-item';
        icon.dataset.tooltip = name;
        icon.dataset.server = serverId;
        icon.textContent = initials;
        icon.onclick = () => switchServer(serverId);
        nav.insertBefore(icon, separator);

        closeModal('createServerModal');
        document.getElementById('newServerName').value = '';
        switchServer(serverId);
        setupTooltips();
        showToast(`Space "${name}" created! 🎉`);
      } else {
        showToast('Failed to create space: ' + (result.error || 'Unknown error'), 'error');
      }
    } catch (err) {
      console.error('createServer error:', err);
      showToast('Failed to create space', 'error');
    }
  } else {
    showToast('Not connected to backend', 'error');
  }
}

// ============ TOAST NOTIFICATIONS ============

// ============ INVITE SYSTEM ============

async function showInviteModal(serverId) {
  openModal('inviteModal');
  const linkInput = document.getElementById('inviteLinkInput');
  const statusDiv = document.getElementById('inviteStatus');
  linkInput.value = 'Generating invite...';
  statusDiv.innerHTML = '';

  if (typeof NexusAPI !== 'undefined' && NexusAPI.isAuthenticated()) {
    try {
      // Resolve backend ID from frontend server ID
      const backendId = (servers[serverId] && servers[serverId]._backendId) ? servers[serverId]._backendId : (serverId.startsWith('srv-') ? serverId : 'srv-' + serverId);
      const result = await NexusAPI.createInvite(backendId);
      if (result.success) {
        const baseUrl = window.location.origin;
        linkInput.value = `${baseUrl}/invite/${result.invite.code}`;
        statusDiv.innerHTML = `<span style="color:var(--nexus-success)">✓ Invite created! Share this link with friends.</span>`;
      } else {
        linkInput.value = '';
        statusDiv.innerHTML = `<span style="color:var(--nexus-danger)">${result.error || 'Failed to create invite'}</span>`;
      }
    } catch (err) {
      linkInput.value = '';
      statusDiv.innerHTML = `<span style="color:var(--nexus-danger)">Error creating invite</span>`;
    }
  }
}

function copyInviteLink() {
  const input = document.getElementById('inviteLinkInput');
  if (input.value && !input.value.startsWith('Generating')) {
    navigator.clipboard.writeText(input.value).then(() => {
      showToast('Invite link copied! 📋');
    }).catch(() => {
      input.select();
      document.execCommand('copy');
      showToast('Invite link copied! 📋');
    });
  }
}

async function joinServerViaInvite() {
  const input = document.getElementById('joinInviteCode');
  const resultDiv = document.getElementById('joinServerResult');
  let code = input.value.trim();
  if (!code) return;

  // Extract code from URL if full URL pasted
  const urlMatch = code.match(/invite\/([A-Za-z0-9]+)/);
  if (urlMatch) code = urlMatch[1];

  if (typeof NexusAPI !== 'undefined' && NexusAPI.isAuthenticated()) {
    try {
      resultDiv.innerHTML = '<span style="color:var(--text-muted)">Joining...</span>';
      const result = await NexusAPI.joinViaInvite(code);
      if (result.success) {
        resultDiv.innerHTML = `<span style="color:var(--nexus-success)">✓ ${result.message}</span>`;
        showToast(`Joined ${result.serverName}! 🎉`);
        closeModal('joinServerModal');
        input.value = '';
        // Refresh server list without full page reload
        if (typeof NexusBackend !== 'undefined' && typeof NexusAPI !== 'undefined') {
          const serversResult = await NexusAPI.getServers();
          if (serversResult.success) {
            NexusBackend.rebuildServersData(serversResult.servers);
            renderServerList();
            // Switch to the newly joined server
            const newServer = serversResult.servers.find(s => s.name === result.serverName);
            if (newServer) {
              switchServer(newServer.id);
            }
          }
        }
      } else {
        resultDiv.innerHTML = `<span style="color:var(--nexus-danger)">${result.error || 'Failed to join'}</span>`;
      }
    } catch (err) {
      resultDiv.innerHTML = `<span style="color:var(--nexus-danger)">Error joining server</span>`;
    }
  }
}

// ============ TOAST NOTIFICATIONS ============

function showToast(message, type) {
  const toast = document.createElement('div');
  let borderColor = 'var(--border-default)';
  let bgColor = 'var(--bg-floating)';
  if (type === 'error') {
    borderColor = 'var(--nexus-danger, #ef4444)';
    bgColor = 'rgba(239, 68, 68, 0.15)';
  } else if (type === 'success') {
    borderColor = 'var(--nexus-success, #22c55e)';
    bgColor = 'rgba(34, 197, 94, 0.15)';
  }
  toast.style.cssText = `
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%) translateY(20px);
    background: ${bgColor};
    color: var(--text-primary);
    padding: 10px 20px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    box-shadow: 0 8px 24px rgba(0,0,0,0.5);
    z-index: 9999;
    opacity: 0;
    transition: opacity 0.2s, transform 0.2s;
    border: 1px solid ${borderColor};
    pointer-events: none;
  `;
  toast.textContent = message;
  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(0)';
  });

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(20px)';
    setTimeout(() => toast.remove(), 200);
  }, 2500);
}

// ============ AUTO RESIZE TEXTAREA ============

function autoResize(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
}

// ============ SERVER DROPDOWN ============

function toggleServerDropdown() {
  showToast('Server settings menu');
}

// ============ KEYBOARD SHORTCUTS ============

document.addEventListener('keydown', (e) => {
  // Escape to close overlays
  if (e.key === 'Escape') {
    document.getElementById('settingsOverlay').classList.remove('visible');
    document.getElementById('userPopup').classList.remove('visible');
    document.getElementById('contextMenu').classList.remove('visible');
    document.getElementById('emojiPicker').classList.remove('visible');
    document.getElementById('pinnedPanel').classList.remove('visible');
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('visible'));
    document.getElementById('lightbox').classList.remove('visible');
  }

  // Ctrl+K for search focus
  if (e.ctrlKey && e.key === 'k') {
    e.preventDefault();
    document.getElementById('searchInput').focus();
  }

  // Focus message input when typing (if not in another input)
  if (!e.ctrlKey && !e.altKey && !e.metaKey && e.key.length === 1) {
    const active = document.activeElement;
    const tag = active.tagName.toLowerCase();
    if (tag !== 'input' && tag !== 'textarea') {
      document.getElementById('messageInput').focus();
    }
  }
});

// ============ WINDOW CLICK HANDLERS ============

window.addEventListener('click', (e) => {
  // Close emoji picker when clicking outside
  const picker = document.getElementById('emojiPicker');
  if (picker.classList.contains('visible') && !picker.contains(e.target) && !e.target.closest('.input-btn')) {
    picker.classList.remove('visible');
  }

  // Close pinned panel when clicking outside
  const pinned = document.getElementById('pinnedPanel');
  if (pinnedVisible && !pinned.contains(e.target) && !e.target.closest('.header-action-btn')) {
    pinnedVisible = false;
    pinned.classList.remove('visible');
  }
});

// Status updates come from backend via WebSocket — no local simulation

// ============ STREAMING SYSTEM ============

let currentStream = null;
let streamMediaStream = null;
let isStreamMuted = false;
let streamViewerCount = 0;
let streamViewerInterval = null;

function openStreamPicker() {
  if (!isVoiceConnected) {
    showToast('Join a voice channel first to go live! 🔊');
    return;
  }
  document.getElementById('streamPickerOverlay').classList.add('visible');
}

function closeStreamPicker() {
  document.getElementById('streamPickerOverlay').classList.remove('visible');
}

function switchStreamTab(btn, tab) {
  document.querySelectorAll('.stream-picker-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');

  const body = document.getElementById('streamPickerBody');
  if (tab === 'screens') {
    body.innerHTML = `
      <div class="stream-source-card selected" onclick="selectStreamSource(this)">
        <div class="stream-source-preview">🖥️</div>
        <div class="stream-source-name">Entire Screen</div>
      </div>
      <div class="stream-source-card" onclick="selectStreamSource(this)">
        <div class="stream-source-preview">🖥️</div>
        <div class="stream-source-name">Screen 2</div>
      </div>
    `;
  } else if (tab === 'windows') {
    body.innerHTML = `
      <div class="stream-source-card selected" onclick="selectStreamSource(this)">
        <div class="stream-source-preview">🎮</div>
        <div class="stream-source-name">Game Window</div>
      </div>
      <div class="stream-source-card" onclick="selectStreamSource(this)">
        <div class="stream-source-preview">🌐</div>
        <div class="stream-source-name">Browser — Nexus Chat</div>
      </div>
      <div class="stream-source-card" onclick="selectStreamSource(this)">
        <div class="stream-source-preview">📝</div>
        <div class="stream-source-name">VS Code</div>
      </div>
      <div class="stream-source-card" onclick="selectStreamSource(this)">
        <div class="stream-source-preview">📁</div>
        <div class="stream-source-name">File Explorer</div>
      </div>
    `;
  } else if (tab === 'camera') {
    body.innerHTML = `
      <div class="stream-source-card selected" onclick="selectStreamSource(this)">
        <div class="stream-source-preview">📷</div>
        <div class="stream-source-name">Default Camera</div>
      </div>
    `;
  }
}

function selectStreamSource(card) {
  document.querySelectorAll('.stream-source-card').forEach(c => c.classList.remove('selected'));
  card.classList.add('selected');
}

async function startScreenStream() {
  closeStreamPicker();

  const quality = document.getElementById('streamQualitySelect').value;
  const fps = parseInt(document.getElementById('streamFpsSelect').value);
  const includeAudio = document.getElementById('streamAudioCheck').checked;

  const constraints = {
    video: {
      width: quality === '1080p' ? 1920 : quality === 'source' ? { ideal: 2560 } : 1280,
      height: quality === '1080p' ? 1080 : quality === 'source' ? { ideal: 1440 } : 720,
      frameRate: fps
    },
    audio: includeAudio
  };

  try {
    streamMediaStream = await navigator.mediaDevices.getDisplayMedia(constraints);

    const video = document.getElementById('streamVideo');
    video.srcObject = streamMediaStream;
    video.style.display = 'block';

    const streamContainer = document.getElementById('streamContainer');
    streamContainer.classList.add('active');

    document.getElementById('streamInfoName').textContent = currentUser.name;
    document.getElementById('streamInfoDetail').textContent = `Screen — ${quality} ${fps}fps`;

    // Update Go Live button
    const goLiveBtn = document.getElementById('goLiveBtn');
    goLiveBtn.classList.add('is-live');
    goLiveBtn.innerHTML = '🔴 Live';

    currentStream = {
      id: 'stream-' + Date.now(),
      quality, fps, includeAudio,
      startedAt: Date.now()
    };

    // Simulate viewers joining
    streamViewerCount = 0;
    streamViewerInterval = setInterval(() => {
      if (!currentStream) { clearInterval(streamViewerInterval); return; }
      if (streamViewerCount < 8 && Math.random() > 0.4) {
        streamViewerCount += Math.floor(Math.random() * 2) + 1;
        streamViewerCount = Math.min(streamViewerCount, 8);
      }
      document.getElementById('streamViewerCount').textContent = streamViewerCount;
    }, 4000);

    // Notify SDK
    if (typeof NexusSDK !== 'undefined') {
      NexusSDK.events.emit('stream:starting', currentStream);
    }

    // Handle stream ending externally (user clicks browser stop)
    streamMediaStream.getVideoTracks()[0].onended = () => {
      stopScreenStream();
    };

    showToast('You are now live! 🔴');

    // Add system message
    if (!channelMessages[activeChannel]) channelMessages[activeChannel] = [];
    channelMessages[activeChannel].push({
      id: genMsgId(),
      userId: (currentUser.id || 'unknown'),
      content: '',
      timestamp: new Date(),
      isSystem: true,
      systemContent: `**${currentUser.name}** started streaming`
    });
    renderMessages();

  } catch (err) {
    console.log('Stream cancelled or not supported:', err);
    showToast('Stream cancelled');
  }
}

function stopScreenStream() {
  if (streamMediaStream) {
    streamMediaStream.getTracks().forEach(track => track.stop());
    streamMediaStream = null;
  }

  const video = document.getElementById('streamVideo');
  video.srcObject = null;

  document.getElementById('streamContainer').classList.remove('active');
  document.getElementById('pipPlayer').classList.remove('visible');

  const goLiveBtn = document.getElementById('goLiveBtn');
  goLiveBtn.classList.remove('is-live');
  goLiveBtn.innerHTML = '🖥️ Go Live';

  if (streamViewerInterval) clearInterval(streamViewerInterval);
  streamViewerCount = 0;

  if (currentStream && typeof NexusSDK !== 'undefined') {
    NexusSDK.events.emit('stream:stopped', currentStream);
  }
  currentStream = null;

  showToast('Stream ended');
}

function minimizeStream() {
  document.getElementById('streamContainer').classList.remove('active');

  const pipPlayer = document.getElementById('pipPlayer');
  const pipVideo = document.getElementById('pipVideo');

  if (streamMediaStream) {
    pipVideo.srcObject = streamMediaStream;
    pipPlayer.classList.add('visible');
    document.getElementById('pipName').textContent = `${currentUser.name}'s stream`;
  }
}

function expandStream() {
  document.getElementById('pipPlayer').classList.remove('visible');
  document.getElementById('pipVideo').srcObject = null;

  if (streamMediaStream) {
    document.getElementById('streamVideo').srcObject = streamMediaStream;
    document.getElementById('streamContainer').classList.add('active');
  }
}

function closePip() {
  document.getElementById('pipPlayer').classList.remove('visible');
  document.getElementById('pipVideo').srcObject = null;
}

function toggleStreamMute() {
  isStreamMuted = !isStreamMuted;
  const btn = document.getElementById('streamMuteBtn');
  btn.textContent = isStreamMuted ? '🔇' : '🎤';
  btn.classList.toggle('active', isStreamMuted);
}

function toggleStreamAudio() {
  if (streamMediaStream) {
    const audioTracks = streamMediaStream.getAudioTracks();
    audioTracks.forEach(track => { track.enabled = !track.enabled; });
  }
}

function changeStreamQuality(quality) {
  if (currentStream) {
    currentStream.quality = quality;
    document.getElementById('streamInfoDetail').textContent =
      `Screen — ${quality} ${currentStream.fps}fps`;
    showToast(`Stream quality changed to ${quality}`);
  }
}

function toggleStreamFullscreen() {
  const container = document.getElementById('streamContainer');
  if (document.fullscreenElement) {
    document.exitFullscreen();
  } else {
    container.requestFullscreen().catch(() => {});
  }
}

// ============ PLUGIN SYSTEM INTEGRATION ============

function initPluginSystem() {
  if (typeof NexusSDK === 'undefined') return;

  // Register core slash commands
  NexusSDK.commands.register({
    name: 'help',
    description: 'Show available commands',
    execute: () => {
      const cmds = NexusSDK.commands.getAll();
      let msg = '📖 **Available Commands:**\n\n';
      cmds.forEach(cmd => {
        msg += `\`/${cmd.name}\` — ${cmd.description}\n`;
      });
      return msg;
    }
  });

  NexusSDK.commands.register({
    name: 'plugins',
    description: 'List installed plugins',
    execute: () => {
      const plugins = NexusSDK.plugins.getAll();
      if (plugins.length === 0) return '🔌 No plugins installed. Visit the Developer Portal to get started!';
      let msg = '🔌 **Installed Plugins:**\n\n';
      plugins.forEach(p => {
        msg += `• **${p.name}** v${p.version} by ${p.author} ${p.enabled ? '✅' : '❌'}\n`;
      });
      return msg;
    }
  });

  NexusSDK.commands.register({
    name: 'stream',
    description: 'Start or stop screen streaming',
    execute: () => {
      if (currentStream) {
        stopScreenStream();
        return '⏹️ Stream ended.';
      } else {
        openStreamPicker();
        return null;
      }
    }
  });

  NexusSDK.commands.register({
    name: 'poll',
    description: 'Create a quick poll',
    usage: '/poll <question>',
    execute: (ctx) => {
      const question = ctx.args || 'No question provided';
      return `📊 **Poll:** ${question}\n\n👍 Yes  |  👎 No  |  🤷 Maybe`;
    }
  });

  NexusSDK.commands.register({
    name: 'flip',
    description: 'Flip a coin',
    execute: () => {
      return Math.random() > 0.5 ? '🪙 **Heads!**' : '🪙 **Tails!**';
    }
  });

  NexusSDK.commands.register({
    name: 'roll',
    description: 'Roll a dice (default d6)',
    usage: '/roll [sides]',
    execute: (ctx) => {
      const sides = parseInt(ctx.args) || 6;
      const result = Math.floor(Math.random() * sides) + 1;
      return `🎲 Rolled a **d${sides}** and got **${result}**!`;
    }
  });

  NexusSDK.commands.register({
    name: 'serverinfo',
    description: 'Show server information',
    execute: () => {
      const server = servers[activeServer];
      if (!server) return 'No server selected.';
      const channelCount = Object.values(server.channels).flat().length;
      return `🏠 **${server.name}**\n\n• Channels: ${channelCount}\n• Members: ${Object.keys(users).length}\n• Plugins: ${NexusSDK.plugins.getAll().length}`;
    }
  });

  NexusSDK.commands.register({
    name: 'devportal',
    description: 'Open the Developer Portal',
    execute: () => {
      window.open('dev-portal.html', '_blank');
      return '🔧 Opening Developer Portal...';
    }
  });

  // Register example plugins
  registerExamplePlugins();

  console.log(`[NexusSDK] Plugin system initialized. ${NexusSDK.commands.getAll().length} commands registered.`);
}

function registerExamplePlugins() {
  // Welcome Bot Plugin
  NexusSDK.createPlugin({
    id: 'welcome-bot',
    name: 'Welcome Bot',
    version: '1.0.0',
    author: 'NexusTeam',
    description: 'Greets new members automatically'
  }, (ctx) => {
    ctx.createBot({
      id: 'bot-welcome',
      name: 'Welcome Bot',
      color: '#22c55e',
      prefix: '!',
      description: 'Welcomes new members'
    });

    NexusSDK.bots.addCommand('bot-welcome', {
      name: 'greet',
      description: 'Send a greeting',
      execute: ({ args }) => {
        const name = args.join(' ') || 'everyone';
        return `👋 Welcome to the server, **${name}**! Make yourself at home and check out our channels.`;
      }
    });
  });

  // Stats Plugin
  NexusSDK.createPlugin({
    id: 'server-stats',
    name: 'Server Stats',
    version: '1.0.0',
    author: 'NexusTeam',
    description: 'Server analytics and statistics'
  }, (ctx) => {
    ctx.registerCommand({
      name: 'stats',
      description: 'Show server statistics',
      execute: () => {
        const totalMessages = Object.values(channelMessages).reduce((sum, msgs) => sum + msgs.length, 0);
        const onlineCount = Object.values(users).filter(u => u.status === 'online').length;
        return `📊 **Server Stats**\n\n• Total Messages: ${totalMessages}\n• Online Members: ${onlineCount}\n• Total Members: ${Object.keys(users).length}\n• Active Streams: ${currentStream ? 1 : 0}\n• Plugins Loaded: ${NexusSDK.plugins.getAll().length}`;
      }
    });
  });

  // Fun Plugin
  NexusSDK.createPlugin({
    id: 'fun-commands',
    name: 'Fun Commands',
    version: '1.0.0',
    author: 'Community',
    description: 'Fun and utility commands'
  }, (ctx) => {
    ctx.registerCommand({
      name: '8ball',
      description: 'Ask the magic 8-ball',
      execute: (context) => {
        const answers = [
          'It is certain.', 'Without a doubt.', 'Yes, definitely.',
          'You may rely on it.', 'Most likely.', 'Outlook good.',
          'Signs point to yes.', 'Reply hazy, try again.',
          'Ask again later.', 'Better not tell you now.',
          'Cannot predict now.', 'Concentrate and ask again.',
          'Don\'t count on it.', 'My reply is no.',
          'My sources say no.', 'Outlook not so good.', 'Very doubtful.'
        ];
        const answer = answers[Math.floor(Math.random() * answers.length)];
        return `🎱 **Magic 8-Ball:** ${answer}`;
      }
    });

    ctx.registerCommand({
      name: 'hug',
      description: 'Send a virtual hug',
      execute: (context) => {
        const target = context.args || 'everyone';
        return `🤗 **${currentUser.name}** gives **${target}** a big warm hug!`;
      }
    });
  });
}

// Process slash commands from message input
function processSlashCommand(content) {
  if (!content.startsWith('/')) return false;

  const parts = content.slice(1).split(/\s+/);
  const cmdName = parts[0];
  const args = parts.slice(1).join(' ');

  if (typeof NexusSDK !== 'undefined') {
    NexusSDK.commands.execute(cmdName, { args, channelId: activeChannel, userId: (currentUser.id || 'unknown') })
      .then(result => {
        if (result.success && result.result) {
          if (!channelMessages[activeChannel]) channelMessages[activeChannel] = [];
          channelMessages[activeChannel].push({
            id: genMsgId(),
            userId: currentUser.id || 'system',
            content: result.result,
            timestamp: new Date(),
            reactions: [],
            isSystem: true
          });
          renderMessages();
        } else if (!result.success) {
          showToast(result.error || 'Command failed');
        }
      });
    return true;
  }
  return false;
}

// Process bot prefix commands
function processBotCommands(content, msg) {
  if (typeof NexusSDK !== 'undefined') {
    NexusSDK.bots.processMessage({ content, userId: (currentUser.id || 'unknown'), channelId: activeChannel })
      .then(response => {
        if (response) {
          if (!channelMessages[activeChannel]) channelMessages[activeChannel] = [];
          channelMessages[activeChannel].push(response);
          renderMessages();
        }
      });
  }
}

// ============ INIT ============

// ============ TWITCH HUB SYSTEM ============

let twitchConnected = false;
let currentHubTab = 'live';
let watchingStream = null;
let chatSyncEnabled = true;
let twitchChatUnsubscribe = null;
let twitchAlertUnsubscribe = null;

// No hardcoded servers — all servers loaded from backend
// Twitch Hub is disabled in production (no hardcoded servers)

function toggleTwitchConnect() {
  const btn = document.getElementById('twitchConnectBtn');

  if (!twitchConnected) {
    NexusTwitch.connect('NexusUser').then(() => {
      twitchConnected = true;
      btn.className = 'hub-connect-btn connected';
      btn.innerHTML = '<span>✓</span> Connected';

      NexusTwitch.startAlerts();
      NexusTwitch.startViewerSimulation();

      // Subscribe to alerts
      twitchAlertUnsubscribe = NexusTwitch.onAlert((alert) => {
        showAlertPopup(alert);
      });

      renderHubContent();
      showToast('Twitch connected! 💜');
    });
  } else {
    NexusTwitch.disconnect();
    twitchConnected = false;
    btn.className = 'hub-connect-btn connect';
    btn.innerHTML = '<span>🔗</span> Connect Twitch';

    if (twitchAlertUnsubscribe) twitchAlertUnsubscribe();
    renderHubContent();
    showToast('Twitch disconnected');
  }
}

function switchHubTab(btn, tab) {
  currentHubTab = tab;
  document.querySelectorAll('.hub-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  renderHubContent();
}

function renderHubContent() {
  const container = document.getElementById('hubContent');

  if (!twitchConnected) {
    container.innerHTML = `
      <div class="hub-empty">
        <div class="hub-empty-icon">📺</div>
        <div class="hub-empty-text">Connect your Twitch account</div>
        <div class="hub-empty-sub">Link your Twitch to see live streams, get alerts, and sync chat.</div>
        <button class="hub-connect-btn connect" style="margin:16px auto;display:flex;" onclick="toggleTwitchConnect()">
          <span>🔗</span> Connect Twitch
        </button>
      </div>
    `;
    return;
  }

  switch (currentHubTab) {
    case 'live': renderLiveTab(container); break;
    case 'following': renderFollowingTab(container); break;
    case 'alerts': renderAlertsTab(container); break;
    case 'dashboard': renderDashboardTab(container); break;
  }
}

function renderLiveTab(container) {
  const liveStreams = NexusTwitch.getLiveStreams();
  document.getElementById('liveCount').textContent = liveStreams.length;

  const gameIcons = {
    'VALORANT': '🎯', 'Art': '🎨', 'Software and Game Development': '💻',
    'Celeste': '🍓', 'Music': '🎵', 'League of Legends': '⚔️',
    'Stardew Valley': '🌾', 'Retro': '👾'
  };

  let html = `
    <div class="hub-quick-actions">
      <button class="hub-quick-action" onclick="openStreamPicker()">🖥️ Go Live</button>
      <button class="hub-quick-action" onclick="showToast('Opening Twitch dashboard...')">📊 Stream Manager</button>
      <button class="hub-quick-action" onclick="showToast('Raid feature coming soon!')">🚀 Quick Raid</button>
      <button class="hub-quick-action" onclick="window.open('dev-portal.html#streaming','_blank')">🔌 Stream API</button>
    </div>
    <div class="hub-section-header">
      <div class="hub-section-title">🔴 Live Now</div>
      <button class="hub-section-action" onclick="renderHubContent()">↻ Refresh</button>
    </div>
  `;

  if (liveStreams.length === 0) {
    html += '<div class="hub-empty"><div class="hub-empty-icon">😴</div><div class="hub-empty-text">No one is live right now</div></div>';
  } else {
    html += '<div class="stream-cards-grid">';
    liveStreams.forEach(stream => {
      const icon = gameIcons[stream.game] || '🎮';
      html += `
        <div class="stream-card is-live" onclick="openTwitchViewer('${stream.id}')">
          <div class="stream-card-thumbnail" style="background:${stream.thumbnailColor}">
            <div class="stream-card-thumbnail-bg">${icon}</div>
            <div class="stream-card-overlay"></div>
            <div class="stream-card-live-badge"><span style="width:6px;height:6px;border-radius:50%;background:#fff;display:inline-block;"></span> LIVE</div>
            <div class="stream-card-viewers">👁️ ${NexusTwitch.formatViewerCount(stream.viewers)}</div>
            <div class="stream-card-uptime">${NexusTwitch.formatUptime(stream.startedAt)}</div>
            <div class="stream-card-play-overlay"><div class="stream-card-play-btn">▶</div></div>
          </div>
          <div class="stream-card-info">
            <div class="stream-card-avatar" style="background:${stream.color}">${stream.displayName.substring(0, 2).toUpperCase()}</div>
            <div class="stream-card-details">
              <div class="stream-card-title">${stream.title}</div>
              <div class="stream-card-streamer">${stream.displayName} ${stream.isPartner ? '<span class="partner-badge">✓</span>' : ''}</div>
              <div class="stream-card-game">${stream.game}</div>
              <div class="stream-card-tags">${stream.tags.map(t => `<span class="stream-tag">${t}</span>`).join('')}</div>
            </div>
          </div>
        </div>
      `;
    });
    html += '</div>';
  }

  container.innerHTML = html;
}

function renderFollowingTab(container) {
  const all = NexusTwitch.getAllFollowing();
  const live = all.filter(s => s.isLive);
  const offline = all.filter(s => !s.isLive);

  let html = '';

  if (live.length > 0) {
    html += `<div class="hub-section-header"><div class="hub-section-title">🔴 Live — ${live.length}</div></div>`;
    html += '<div class="stream-cards-grid">';
    live.forEach(stream => {
      html += buildStreamCard(stream, true);
    });
    html += '</div>';
  }

  if (offline.length > 0) {
    html += `<div class="hub-section-header" style="margin-top:24px;"><div class="hub-section-title">⚫ Offline — ${offline.length}</div></div>`;
    html += '<div class="stream-cards-grid">';
    offline.forEach(stream => {
      html += `
        <div class="stream-card offline">
          <div class="stream-card-thumbnail" style="background:${stream.thumbnailColor}">
            <div class="stream-card-thumbnail-bg" style="font-size:36px;">📺</div>
            <div class="stream-card-offline-label">Offline</div>
          </div>
          <div class="stream-card-info">
            <div class="stream-card-avatar" style="background:${stream.color}">${stream.displayName.substring(0, 2).toUpperCase()}</div>
            <div class="stream-card-details">
              <div class="stream-card-title">${stream.title}</div>
              <div class="stream-card-streamer">${stream.displayName} ${stream.isPartner ? '<span class="partner-badge">✓</span>' : ''}</div>
              <div class="stream-card-game">${NexusTwitch.formatFollowerCount(stream.followers)}</div>
            </div>
          </div>
        </div>
      `;
    });
    html += '</div>';
  }

  container.innerHTML = html;
}

function buildStreamCard(stream, isLive) {
  const gameIcons = { 'VALORANT': '🎯', 'Art': '🎨', 'Software and Game Development': '💻', 'Celeste': '🍓', 'Music': '🎵', 'League of Legends': '⚔️', 'Stardew Valley': '🌾', 'Retro': '👾' };
  const icon = gameIcons[stream.game] || '🎮';
  return `
    <div class="stream-card ${isLive ? 'is-live' : 'offline'}" onclick="openTwitchViewer('${stream.id}')">
      <div class="stream-card-thumbnail" style="background:${stream.thumbnailColor}">
        <div class="stream-card-thumbnail-bg">${icon}</div>
        <div class="stream-card-overlay"></div>
        ${isLive ? `<div class="stream-card-live-badge"><span style="width:6px;height:6px;border-radius:50%;background:#fff;display:inline-block;"></span> LIVE</div>
        <div class="stream-card-viewers">👁️ ${NexusTwitch.formatViewerCount(stream.viewers)}</div>
        <div class="stream-card-uptime">${NexusTwitch.formatUptime(stream.startedAt)}</div>` : ''}
        <div class="stream-card-play-overlay"><div class="stream-card-play-btn">▶</div></div>
      </div>
      <div class="stream-card-info">
        <div class="stream-card-avatar" style="background:${stream.color}">${stream.displayName.substring(0, 2).toUpperCase()}</div>
        <div class="stream-card-details">
          <div class="stream-card-title">${stream.title}</div>
          <div class="stream-card-streamer">${stream.displayName} ${stream.isPartner ? '<span class="partner-badge">✓</span>' : ''}</div>
          <div class="stream-card-game">${stream.game}</div>
        </div>
      </div>
    </div>
  `;
}

function renderAlertsTab(container) {
  const alerts = NexusTwitch.getRecentAlerts(20);

  let html = `<div class="hub-section-header"><div class="hub-section-title">🔔 Recent Alerts</div></div>`;

  if (alerts.length === 0) {
    html += '<div class="hub-empty"><div class="hub-empty-icon">🔔</div><div class="hub-empty-text">No alerts yet</div><div class="hub-empty-sub">Alerts will appear here when you get follows, subs, raids, and more.</div></div>';
  } else {
    html += '<div class="alert-feed">';
    alerts.forEach(alert => {
      let detail = '';
      if (alert.type === 'SUBSCRIBE') detail = `${alert.months} month${alert.months > 1 ? 's' : ''}`;
      else if (alert.type === 'BITS') detail = `${alert.amount} bits`;
      else if (alert.type === 'RAID') detail = `${alert.viewers} viewers`;
      else if (alert.type === 'GIFT_SUB') detail = `${alert.giftCount} gift sub${alert.giftCount > 1 ? 's' : ''}`;

      const timeAgo = Math.floor((Date.now() - alert.timestamp) / 60000);
      const timeStr = timeAgo < 1 ? 'Just now' : timeAgo < 60 ? `${timeAgo}m ago` : `${Math.floor(timeAgo / 60)}h ago`;

      html += `
        <div class="alert-item">
          <div class="alert-icon" style="background:${alert.color}22;">${alert.icon}</div>
          <div class="alert-content">
            <div class="alert-title">${alert.username}</div>
            <div class="alert-detail">${alert.label}${detail ? ' — ' + detail : ''}</div>
          </div>
          <div class="alert-time">${timeStr}</div>
        </div>
      `;
    });
    html += '</div>';
  }

  container.innerHTML = html;
}

function renderDashboardTab(container) {
  const user = NexusTwitch.user;
  if (!user) return;

  container.innerHTML = `
    <div class="hub-section-header"><div class="hub-section-title">📊 Your Dashboard</div></div>
    <div class="dashboard-stats">
      <div class="dashboard-stat-card">
        <div class="dashboard-stat-icon">👥</div>
        <div class="dashboard-stat-value">${NexusTwitch.formatViewerCount(user.followers)}</div>
        <div class="dashboard-stat-label">Followers</div>
        <div class="dashboard-stat-change positive">↑ +23 this week</div>
      </div>
      <div class="dashboard-stat-card">
        <div class="dashboard-stat-icon">⭐</div>
        <div class="dashboard-stat-value">47</div>
        <div class="dashboard-stat-label">Subscribers</div>
        <div class="dashboard-stat-change positive">↑ +5 this month</div>
      </div>
      <div class="dashboard-stat-card">
        <div class="dashboard-stat-icon">👁️</div>
        <div class="dashboard-stat-value">89</div>
        <div class="dashboard-stat-label">Avg Viewers</div>
        <div class="dashboard-stat-change positive">↑ +12%</div>
      </div>
      <div class="dashboard-stat-card">
        <div class="dashboard-stat-icon">⏱️</div>
        <div class="dashboard-stat-value">24h</div>
        <div class="dashboard-stat-label">Stream Time</div>
        <div class="dashboard-stat-change">This month</div>
      </div>
      <div class="dashboard-stat-card">
        <div class="dashboard-stat-icon">💬</div>
        <div class="dashboard-stat-value">1.2K</div>
        <div class="dashboard-stat-label">Chat Messages</div>
        <div class="dashboard-stat-change positive">↑ +18%</div>
      </div>
      <div class="dashboard-stat-card">
        <div class="dashboard-stat-icon">💎</div>
        <div class="dashboard-stat-value">8.4K</div>
        <div class="dashboard-stat-label">Bits Received</div>
        <div class="dashboard-stat-change positive">↑ +2.1K</div>
      </div>
    </div>

    <div class="hub-section-header"><div class="hub-section-title">🎯 Quick Actions</div></div>
    <div class="hub-quick-actions">
      <button class="hub-quick-action" onclick="openStreamPicker()">🖥️ Start Streaming</button>
      <button class="hub-quick-action" onclick="showToast('Stream title updated!')">✏️ Edit Stream Info</button>
      <button class="hub-quick-action" onclick="showToast('Running ad break...')">📺 Run Ad Break</button>
      <button class="hub-quick-action" onclick="showToast('Creating clip...')">🎬 Create Clip</button>
      <button class="hub-quick-action" onclick="showToast('Creating marker...')">📍 Add Marker</button>
      <button class="hub-quick-action" onclick="showToast('Opening mod view...')">🛡️ Mod View</button>
    </div>

    <div class="hub-section-header" style="margin-top:24px;"><div class="hub-section-title">📈 Recent Stream Summary</div></div>
    <div style="background:var(--bg-secondary);border:1px solid var(--border-subtle);border-radius:10px;padding:20px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:16px;">
        <div><strong>Last Stream:</strong> 2 days ago</div>
        <div style="color:var(--text-muted);">Duration: 3h 42m</div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;text-align:center;">
        <div><div style="font-size:20px;font-weight:800;">142</div><div style="font-size:11px;color:var(--text-muted);">Peak Viewers</div></div>
        <div><div style="font-size:20px;font-weight:800;">89</div><div style="font-size:11px;color:var(--text-muted);">Avg Viewers</div></div>
        <div><div style="font-size:20px;font-weight:800;">847</div><div style="font-size:11px;color:var(--text-muted);">Chat Messages</div></div>
      </div>
      <div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap;">
        <span style="font-size:11px;padding:3px 8px;border-radius:4px;background:rgba(145,70,255,0.12);color:#a78bfa;">+12 new followers</span>
        <span style="font-size:11px;padding:3px 8px;border-radius:4px;background:rgba(34,197,94,0.12);color:#22c55e;">+3 new subs</span>
        <span style="font-size:11px;padding:3px 8px;border-radius:4px;background:rgba(245,158,11,0.12);color:#f59e0b;">1,200 bits</span>
        <span style="font-size:11px;padding:3px 8px;border-radius:4px;background:rgba(239,68,68,0.12);color:#ef4444;">2 raids received</span>
      </div>
    </div>
  `;
}

// === Twitch Stream Viewer ===

function openTwitchViewer(streamId) {
  const stream = NexusTwitch.watchStream(streamId);
  if (!stream) return;

  watchingStream = stream;

  // Hide hub, show viewer
  document.getElementById('streamerHub').classList.remove('active');
  document.getElementById('twitchViewer').classList.add('active');

  // Populate header
  document.getElementById('tvAvatar').style.background = stream.color;
  document.getElementById('tvAvatar').textContent = stream.displayName.substring(0, 2).toUpperCase();
  document.getElementById('tvName').innerHTML = `${stream.displayName} ${stream.isPartner ? '<span class="partner-badge" style="color:#9146FF;">✓</span>' : ''}`;
  document.getElementById('tvTitle').textContent = stream.title;
  document.getElementById('tvViewers').textContent = NexusTwitch.formatViewerCount(stream.viewers);
  document.getElementById('tvUptime').textContent = NexusTwitch.formatUptime(stream.startedAt);

  // Set game visuals
  const gameIcons = { 'VALORANT': '🎯', 'Art': '🎨', 'Software and Game Development': '💻', 'Celeste': '🍓', 'Music': '🎵', 'League of Legends': '⚔️', 'Stardew Valley': '🌾', 'Retro': '👾' };
  const icon = gameIcons[stream.game] || '🎮';
  document.getElementById('tvStreamBg').textContent = icon;
  document.getElementById('tvGameIcon').textContent = icon;
  document.getElementById('tvGameName').textContent = stream.game;
  document.getElementById('tvGameDetail').textContent = `${NexusTwitch.formatViewerCount(stream.viewers)} watching`;
  document.getElementById('tvStream').style.background = stream.thumbnailColor;

  // Start chat sync
  document.getElementById('twitchChatMessages').innerHTML = '';
  if (twitchChatUnsubscribe) twitchChatUnsubscribe();
  twitchChatUnsubscribe = NexusTwitch.onChatMessage((msg) => {
    if (chatSyncEnabled) appendTwitchChatMessage(msg);
  });

  // Update viewer count periodically
  const viewerInterval = setInterval(() => {
    if (!watchingStream) { clearInterval(viewerInterval); return; }
    const s = NexusTwitch.getStream(streamId);
    if (s) {
      document.getElementById('tvViewers').textContent = NexusTwitch.formatViewerCount(s.viewers);
      document.getElementById('tvUptime').textContent = NexusTwitch.formatUptime(s.startedAt);
    }
  }, 5000);
}

function closeTwitchViewer() {
  document.getElementById('twitchViewer').classList.remove('active');
  if (twitchChatUnsubscribe) { twitchChatUnsubscribe(); twitchChatUnsubscribe = null; }
  NexusTwitch.stopWatching();
  watchingStream = null;

  // Show hub again if on twitch server
  if (activeServer === 'twitch-hub') {
    document.getElementById('streamerHub').classList.add('active');
  }
}

function appendTwitchChatMessage(msg) {
  const container = document.getElementById('twitchChatMessages');
  const el = document.createElement('div');
  el.className = 'twitch-chat-msg';

  let badges = '';
  if (msg.badges && msg.badges.length > 0) {
    badges = '<span class="chat-badges">';
    msg.badges.forEach(b => {
      const badgeIcons = { mod: '🛡️', sub: '⭐', vip: '💎', nexus: '🌟' };
      badges += `<span class="chat-badge">${badgeIcons[b] || ''}</span>`;
    });
    badges += '</span>';
  }

  el.innerHTML = `${badges}<span class="chat-user" style="color:${msg.color}">${msg.user}</span>: <span class="chat-text">${msg.message}</span>`;
  container.appendChild(el);

  // Auto-scroll
  container.scrollTop = container.scrollHeight;

  // Limit messages
  while (container.children.length > 100) {
    container.removeChild(container.firstChild);
  }
}

function sendTwitchChat() {
  const input = document.getElementById('twitchChatInput');
  const message = input.value.trim();
  if (!message) return;

  NexusTwitch.sendChatMessage(message);
  input.value = '';
}

function toggleChatSync() {
  chatSyncEnabled = !chatSyncEnabled;
  const btn = document.getElementById('chatSyncToggle');
  btn.classList.toggle('active', chatSyncEnabled);
  btn.textContent = chatSyncEnabled ? 'Sync' : 'Paused';
}

function toggleTwitchFollow() {
  const btn = document.getElementById('tvFollowBtn');
  btn.classList.toggle('following');
  btn.innerHTML = btn.classList.contains('following') ? '✓ Following' : '💜 Follow';
}

function shareTwitchStream() {
  if (watchingStream) {
    const shareText = `Check out ${watchingStream.displayName} playing ${watchingStream.game}! 📺`;
    if (!channelMessages[activeChannel]) channelMessages[activeChannel] = [];
    channelMessages[activeChannel].push({
      id: genMsgId(),
      userId: (currentUser.id || 'unknown'),
      content: shareText,
      timestamp: new Date(),
      reactions: []
    });
    showToast('Stream shared to chat! 📺');
  }
}

// === Alert Popups ===

function showAlertPopup(alert) {
  const container = document.getElementById('alertPopupContainer');
  if (!container) return;

  let detail = '';
  if (alert.type === 'FOLLOW') detail = 'just followed!';
  else if (alert.type === 'SUBSCRIBE') detail = `subscribed for ${alert.months} month${alert.months > 1 ? 's' : ''}!`;
  else if (alert.type === 'BITS') detail = `cheered ${alert.amount} bits!`;
  else if (alert.type === 'RAID') detail = `is raiding with ${alert.viewers} viewers!`;
  else if (alert.type === 'GIFT_SUB') detail = `gifted ${alert.giftCount} sub${alert.giftCount > 1 ? 's' : ''}!`;
  else if (alert.type === 'HOST') detail = 'is now hosting you!';
  else if (alert.type === 'HYPE_TRAIN') detail = 'Hype Train is rolling! 🚂';

  const popup = document.createElement('div');
  popup.className = 'alert-popup';
  popup.innerHTML = `
    <div class="alert-popup-header" style="background:${alert.color}11;">
      <div class="alert-popup-icon">${alert.icon}</div>
      <div class="alert-popup-title" style="color:${alert.color}">${alert.username}</div>
      <div class="alert-popup-detail">${detail}</div>
    </div>
    <div class="alert-popup-bar" style="background:${alert.color}"></div>
  `;

  container.appendChild(popup);

  // Auto-remove after 5 seconds
  setTimeout(() => {
    popup.style.opacity = '0';
    popup.style.transform = 'translateY(-20px)';
    popup.style.transition = 'all 0.3s ease';
    setTimeout(() => popup.remove(), 300);
  }, 5000);
}

// === Show/Hide Hub based on server ===

const originalSwitchServer = switchServer;
switchServer = function(serverId) {
  // Hide twitch-specific UI
  document.getElementById('streamerHub').classList.remove('active');
  document.getElementById('twitchViewer').classList.remove('active');

  if (serverId === 'twitch-hub') {
    activeServer = serverId;

    document.querySelectorAll('.server-icon').forEach(el => el.classList.remove('active'));
    const serverEl = document.querySelector(`[data-server="${serverId}"]`);
    if (serverEl) serverEl.classList.add('active');

    const server = servers[serverId];
    document.getElementById('sidebarTitle').textContent = server.name;
    renderChannelList(server);

    // Show streamer hub by default
    document.getElementById('streamerHub').classList.add('active');
    document.getElementById('messagesAreaWrapper').style.display = 'none';

    // Update live count
    if (twitchConnected) {
      document.getElementById('liveCount').textContent = NexusTwitch.getLiveStreams().length;
    }
    renderHubContent();
    renderMembers();
    return;
  }

  document.getElementById('messagesAreaWrapper').style.display = '';
  originalSwitchServer(serverId);
};

// Override channel switching for twitch hub
const originalSwitchChannel = switchChannel;
switchChannel = function(channelId) {
  if (activeServer === 'twitch-hub') {
    // If clicking a text channel, show messages instead of hub
    const ch = findChannel(channelId);
    if (ch && (ch.type === 'text' || ch.type === 'dm')) {
      document.getElementById('streamerHub').classList.remove('active');
      document.getElementById('twitchViewer').classList.remove('active');
      document.getElementById('messagesAreaWrapper').style.display = '';
    }
  }
  originalSwitchChannel(channelId);
};

// ============ SERVER CREATION WIZARD ============

let wizardStep = 0;
let wizardTemplate = null;
let wizardServerName = '';
let newChannelType = 'text';
let wpSourceType = 'twitch';
let activeWatchParty = null;
let wpPlaybackState = 'paused';

function openServerWizard() {
  wizardStep = 0;
  wizardTemplate = null;
  wizardServerName = '';
  document.getElementById('serverWizard').classList.add('visible');
  renderWizardStep();
}

function closeWizard() {
  document.getElementById('serverWizard').classList.remove('visible');
}

function renderWizardStep() {
  const body = document.getElementById('wizardBody');
  const title = document.getElementById('wizardTitle');
  const desc = document.getElementById('wizardDesc');
  const nextBtn = document.getElementById('wizardNextBtn');
  const backBtn = document.getElementById('wizardBackBtn');
  const dots = document.querySelectorAll('.wizard-step-dot');

  dots.forEach((d, i) => {
    d.className = 'wizard-step-dot' + (i === wizardStep ? ' active' : i < wizardStep ? ' done' : '');
  });
  backBtn.style.display = wizardStep > 0 ? '' : 'none';

  if (wizardStep === 0) {
    title.textContent = 'Create Your Space';
    desc.textContent = 'Choose a template to get started quickly, or start from scratch.';
    nextBtn.textContent = 'Next';

    const templates = typeof NexusServerManager !== 'undefined' ? NexusServerManager.getTemplates() : [];
    let html = '<div class="template-grid">';
    html += `<div class="template-card${!wizardTemplate ? ' selected' : ''}" onclick="selectTemplate(this, null)">
      <div class="template-card-icon">✨</div>
      <div class="template-card-name">Start Fresh</div>
      <div class="template-card-desc">Create from scratch</div>
    </div>`;
    templates.forEach(t => {
      html += `<div class="template-card${wizardTemplate === t.id ? ' selected' : ''}" onclick="selectTemplate(this, '${t.id}')">
        <div class="template-card-icon">${t.icon}</div>
        <div class="template-card-name">${t.name}</div>
        <div class="template-card-desc">${t.folders ? t.folders.length + ' categories' : ''}</div>
      </div>`;
    });
    html += '</div>';
    body.innerHTML = html;

  } else if (wizardStep === 1) {
    title.textContent = 'Customize Your Space';
    desc.textContent = 'Give your server a name and personality.';
    nextBtn.textContent = 'Next';

    body.innerHTML = `
      <div class="form-group">
        <label class="form-label">Server Name</label>
        <input class="form-input" id="wizardServerName" placeholder="My Awesome Server" value="${wizardServerName}" oninput="wizardServerName=this.value">
      </div>
      <div class="form-group">
        <label class="form-label">Description (optional)</label>
        <input class="form-input" id="wizardServerDesc" placeholder="What's this server about?">
      </div>
      <div class="privacy-toggle-row">
        <div>
          <div class="privacy-toggle-label">🌐 Public Server</div>
          <div class="privacy-toggle-desc">Anyone can find and join this server</div>
        </div>
        <div class="toggle" id="wizardPublicToggle" onclick="this.classList.toggle('active')"></div>
      </div>
    `;

  } else if (wizardStep === 2) {
    title.textContent = 'Ready to Go!';
    desc.textContent = 'Your server will be created with the following setup.';
    nextBtn.textContent = 'Create Server';

    const templateName = wizardTemplate ?
      (NexusServerManager.getTemplates().find(t => t.id === wizardTemplate)?.name || 'Custom') : 'Default';

    body.innerHTML = `
      <div style="text-align:center;padding:20px;">
        <div style="width:72px;height:72px;border-radius:16px;background:var(--nexus-primary);display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:800;color:#fff;margin:0 auto 12px auto;">
          ${(wizardServerName || 'S').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()}
        </div>
        <div style="font-size:20px;font-weight:800;margin-bottom:4px;">${wizardServerName || 'My Server'}</div>
        <div style="font-size:13px;color:var(--text-muted);margin-bottom:20px;">Template: ${templateName}</div>
        <div style="display:flex;gap:16px;justify-content:center;font-size:13px;color:var(--text-secondary);">
          <div>📁 Auto-generated channels</div>
          <div>🛡️ Default roles</div>
          <div>⚙️ Full admin control</div>
        </div>
      </div>
    `;
  }
}

function selectTemplate(el, templateId) {
  document.querySelectorAll('.template-card').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  wizardTemplate = templateId;
}

function wizardNext() {
  if (wizardStep === 1) {
    wizardServerName = document.getElementById('wizardServerName')?.value || wizardServerName;
  }

  if (wizardStep < 2) {
    wizardStep++;
    renderWizardStep();
  } else {
    // Create the server
    finalizeServerCreation();
  }
}

function wizardBack() {
  if (wizardStep > 0) {
    wizardStep--;
    renderWizardStep();
  }
}

function finalizeServerCreation() {
  const name = wizardServerName || 'My Server';
  closeWizard();

  if (typeof NexusServerManager !== 'undefined') {
    const managed = NexusServerManager.create({ name, ownerId: (currentUser.id || 'unknown') }, wizardTemplate);

    // Convert to app server format
    const sidebarData = managed.toSidebarData();
    const serverId = managed.id;

    servers[serverId] = {
      name: managed.name,
      managedId: managed.id,
      channels: sidebarData
    };

    // Add server icon to nav
    const nav = document.getElementById('serverNav');
    const addBtn = nav.querySelector('.add-server');
    const icon = document.createElement('div');
    icon.className = 'server-icon server-item';
    icon.dataset.tooltip = name;
    icon.dataset.server = serverId;
    icon.textContent = managed.initials;
    icon.onclick = () => switchServer(serverId);
    nav.insertBefore(icon, addBtn);

    switchServer(serverId);
    setupTooltips();
    showToast(`"${name}" created! 🎉`);
  }
}

// ============ CHANNEL CREATION ============

function openChannelCreate(folderId) {
  newChannelType = 'text';
  document.querySelectorAll('.channel-type-option').forEach(o => o.classList.remove('selected'));
  document.querySelector('.channel-type-option[data-type="text"]')?.classList.add('selected');
  document.getElementById('newChannelName').value = '';
  document.getElementById('newChannelTopic').value = '';
  document.getElementById('channelPrivateToggle').classList.remove('active');

  // Populate folder dropdown
  const select = document.getElementById('newChannelFolder');
  select.innerHTML = '<option value="">No folder</option>';
  const server = servers[activeServer];
  if (server && server.managedId) {
    const managed = NexusServerManager.get(server.managedId);
    if (managed) {
      managed.folders.forEach(f => {
        select.innerHTML += `<option value="${f.id}" ${f.id === folderId ? 'selected' : ''}>${f.name}</option>`;
      });
    }
  }

  openModal('channelCreateModal');
}

function selectChannelType(el, type) {
  document.querySelectorAll('.channel-type-option').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
  newChannelType = type;
}

function createNewChannel() {
  const name = document.getElementById('newChannelName').value.trim().toLowerCase().replace(/\s+/g, '-');
  if (!name) { showToast('Please enter a channel name'); return; }

  const topic = document.getElementById('newChannelTopic').value.trim();
  const folderId = document.getElementById('newChannelFolder').value || null;
  const isPrivate = document.getElementById('channelPrivateToggle').classList.contains('active');

  const server = servers[activeServer];
  if (server && server.managedId) {
    const managed = NexusServerManager.get(server.managedId);
    if (managed) {
      managed.createChannel({
        name, type: newChannelType, topic, parentId: folderId, isPrivate,
        icon: isPrivate ? '🔒' : (newChannelType === 'voice' ? '🔊' : newChannelType === 'announcement' ? '📢' : '#')
      });

      // Refresh sidebar
      servers[activeServer].channels = managed.toSidebarData();
      renderChannelList(servers[activeServer]);
      closeModal('channelCreateModal');
      showToast(`#${name} created! ${isPrivate ? '🔒' : ''}` );
    }
  }
}

// ============ SERVER SETTINGS ============

function openServerSettings() {
  document.getElementById('serverSettingsOverlay').classList.add('visible');
  const server = servers[activeServer];
  if (server) {
    document.getElementById('ssServerName').textContent = server.name + ' Settings';
  }
  renderSSContent('overview');
}

function closeServerSettings() {
  document.getElementById('serverSettingsOverlay').classList.remove('visible');
}

function switchSSTab(el, tab) {
  document.querySelectorAll('.ss-nav-item').forEach(i => i.classList.remove('active'));
  el.classList.add('active');
  renderSSContent(tab);
}

function renderSSContent(tab) {
  const content = document.getElementById('ssContent');
  const server = servers[activeServer];
  const managed = server?.managedId ? NexusServerManager.get(server.managedId) : null;

  switch (tab) {
    case 'overview':
      content.innerHTML = `
        <div class="ss-section"><h2>Server Overview</h2>
        <div class="ss-card">
          <div style="display:flex;align-items:center;gap:16px;margin-bottom:16px;">
            <div style="width:72px;height:72px;border-radius:16px;background:var(--nexus-primary);display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:800;color:#fff;">${server?.name?.substring(0,2).toUpperCase() || 'S'}</div>
            <div style="flex:1;">
              <div class="form-group" style="margin:0;"><label class="form-label">Server Name</label><input class="form-input" value="${server?.name || ''}" onchange="updateServerName(this.value)"></div>
            </div>
          </div>
          <div class="settings-row"><div><div class="settings-row-label">Server ID</div><div class="settings-row-desc">${managed?.id || activeServer}</div></div></div>
          <div class="settings-row"><div><div class="settings-row-label">Owner</div><div class="settings-row-desc">NexusUser</div></div></div>
          <div class="settings-row"><div><div class="settings-row-label">Created</div><div class="settings-row-desc">${managed ? new Date(managed.createdAt).toLocaleDateString() : 'Unknown'}</div></div></div>
          <div class="settings-row"><div><div class="settings-row-label">Members</div><div class="settings-row-desc">${managed ? managed.members.length : Object.keys(users).length}</div></div></div>
        </div></div>`;
      break;

    case 'roles':
      let rolesHtml = '<div class="ss-section"><h2>Roles</h2><div class="ss-card">';
      rolesHtml += '<button class="btn btn-primary" style="margin-bottom:16px;" onclick="createNewRole()">+ Create Role</button>';
      rolesHtml += '<div class="role-list">';
      if (managed) {
        managed.getRolesSorted().forEach(role => {
          const memberCount = managed.members.filter(m => m.roleIds.includes(role.id) || role.isDefault).length;
          rolesHtml += `
            <div class="role-item" onclick="editRole('${role.id}')">
              <div class="role-color-dot" style="background:${role.color}"></div>
              <div class="role-item-name">${role.name}</div>
              <div class="role-item-count">${memberCount} members</div>
              <div class="role-item-actions">
                ${!role.isDefault ? `<button class="role-action-btn" onclick="event.stopPropagation();deleteRole('${role.id}')" title="Delete">🗑️</button>` : ''}
              </div>
            </div>`;
        });
      }
      rolesHtml += '</div></div></div>';

      // Role editor area
      rolesHtml += '<div id="roleEditorArea"></div>';
      content.innerHTML = rolesHtml;
      break;

    case 'channels':
      let chHtml = '<div class="ss-section"><h2>Channels</h2>';
      chHtml += '<div style="display:flex;gap:8px;margin-bottom:16px;"><button class="btn btn-primary" onclick="openChannelCreate()">+ Channel</button><button class="btn btn-secondary" onclick="createNewFolder()">📁 New Folder</button></div>';
      chHtml += '<div class="ss-card">';
      if (managed) {
        managed.folders.sort((a, b) => a.position - b.position).forEach(folder => {
          chHtml += `<div style="margin-bottom:12px;">
            <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border-subtle);">
              <span style="font-size:12px;color:var(--text-muted);">📁</span>
              <strong style="font-size:13px;flex:1;">${folder.name}</strong>
              ${folder.isPrivate ? '<span style="font-size:10px;color:var(--text-muted);">🔒 Private</span>' : ''}
              <button class="role-action-btn" onclick="openChannelCreate('${folder.id}')" title="Add channel">+</button>
            </div>`;
          managed.getChannelsInFolder(folder.id).forEach(ch => {
            chHtml += `<div style="display:flex;align-items:center;gap:8px;padding:6px 8px 6px 24px;font-size:13px;">
              <span>${ch.icon}</span><span style="flex:1;">${ch.name}</span>
              <span style="font-size:10px;color:var(--text-muted);">${ch.type}${ch.isPrivate ? ' 🔒' : ''}</span>
              <button class="role-action-btn" onclick="deleteServerChannel('${ch.id}')" title="Delete">🗑️</button>
            </div>`;
          });
          chHtml += '</div>';
        });
      }
      chHtml += '</div></div>';
      content.innerHTML = chHtml;
      break;

    case 'permissions':
      let permHtml = '<div class="ss-section"><h2>Permissions</h2><p style="color:var(--text-secondary);margin-bottom:20px;">Configure what each role can do across the server.</p>';
      permHtml += '<div class="ss-card"><div class="perm-grid">';
      const permDefs = [
        { cat: 'General', perms: [
          { flag: 'VIEW_CHANNEL', name: 'View Channels', desc: 'Allows members to view channels' },
          { flag: 'MANAGE_CHANNELS', name: 'Manage Channels', desc: 'Create, edit, and delete channels' },
          { flag: 'MANAGE_ROLES', name: 'Manage Roles', desc: 'Create and edit roles below theirs' },
          { flag: 'MANAGE_SERVER', name: 'Manage Server', desc: 'Change server name, icon, and settings' },
          { flag: 'CREATE_INVITE', name: 'Create Invite', desc: 'Create invite links' },
        ]},
        { cat: 'Text', perms: [
          { flag: 'SEND_MESSAGES', name: 'Send Messages', desc: 'Send messages in text channels' },
          { flag: 'ATTACH_FILES', name: 'Attach Files', desc: 'Upload files and images' },
          { flag: 'ADD_REACTIONS', name: 'Add Reactions', desc: 'React to messages with emoji' },
          { flag: 'MENTION_EVERYONE', name: 'Mention @everyone', desc: 'Mention everyone in the server' },
          { flag: 'MANAGE_MESSAGES', name: 'Manage Messages', desc: 'Delete and pin other members\' messages' },
        ]},
        { cat: 'Voice', perms: [
          { flag: 'CONNECT_VOICE', name: 'Connect', desc: 'Join voice channels' },
          { flag: 'SPEAK', name: 'Speak', desc: 'Talk in voice channels' },
          { flag: 'STREAM', name: 'Stream', desc: 'Share screen in voice channels' },
          { flag: 'MUTE_MEMBERS', name: 'Mute Members', desc: 'Mute other members in voice' },
          { flag: 'MOVE_MEMBERS', name: 'Move Members', desc: 'Move members between voice channels' },
        ]},
        { cat: 'Admin', perms: [
          { flag: 'KICK_MEMBERS', name: 'Kick Members', desc: 'Remove members from the server' },
          { flag: 'BAN_MEMBERS', name: 'Ban Members', desc: 'Permanently ban members' },
          { flag: 'ADMINISTRATOR', name: 'Administrator', desc: 'Full access to everything (dangerous!)' },
        ]}
      ];

      permDefs.forEach(cat => {
        permHtml += `<div class="perm-category-header">${cat.cat} Permissions</div>`;
        cat.perms.forEach(p => {
          permHtml += `<div class="perm-row">
            <div class="perm-info"><div class="perm-name">${p.name}</div><div class="perm-desc">${p.desc}</div></div>
            <div class="toggle active" onclick="this.classList.toggle('active')" title="Toggle ${p.name}"></div>
          </div>`;
        });
      });
      permHtml += '</div></div></div>';
      content.innerHTML = permHtml;
      break;

    case 'members':
      let memHtml = '<div class="ss-section"><h2>Members</h2><div class="ss-card">';
      if (managed) {
        managed.members.forEach(member => {
          const u = users[member.userId];
          if (!u) return;
          const highestRole = managed.getMemberHighestRole(member.userId);
          memHtml += `<div class="settings-row">
            <div style="display:flex;align-items:center;gap:10px;">
              <div style="width:32px;height:32px;border-radius:50%;background:${u.color};display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#fff;">${u.initials}</div>
              <div><div class="settings-row-label" style="color:${highestRole?.color || 'inherit'}">${u.name}</div>
              <div class="settings-row-desc">Joined ${new Date(member.joinedAt).toLocaleDateString()}</div></div>
            </div>
            <div style="display:flex;gap:4px;">
              ${member.roleIds.map(rid => {
                const r = managed.getRole(rid);
                return r ? `<span style="font-size:10px;padding:2px 6px;border-radius:4px;border:1px solid ${r.color}33;color:${r.color};">${r.name}</span>` : '';
              }).join('')}
              <button class="btn btn-secondary" style="padding:2px 8px;font-size:11px;" onclick="showToast('Role assignment panel')">+ Role</button>
            </div>
          </div>`;
        });
      }
      memHtml += '</div></div>';
      content.innerHTML = memHtml;
      break;

    case 'audit':
      let auditHtml = '<div class="ss-section"><h2>Audit Log</h2><div class="ss-card">';
      if (managed && managed.auditLog.length > 0) {
        managed.auditLog.slice().reverse().forEach(entry => {
          const time = new Date(entry.timestamp).toLocaleString();
          auditHtml += `<div class="settings-row"><div>
            <div class="settings-row-label">${entry.action.replace(/_/g, ' ')}</div>
            <div class="settings-row-desc">${JSON.stringify(entry.details)} — ${time}</div>
          </div></div>`;
        });
      } else {
        auditHtml += '<p style="color:var(--text-muted);text-align:center;padding:20px;">No audit log entries yet.</p>';
      }
      auditHtml += '</div></div>';
      content.innerHTML = auditHtml;
      break;

    default:
      content.innerHTML = `<div class="ss-section"><h2>${tab}</h2><div class="ss-card"><p style="color:var(--text-muted);text-align:center;padding:20px;">Coming soon!</p></div></div>`;
  }
}

function updateServerName(name) {
  if (servers[activeServer]) {
    servers[activeServer].name = name;
    document.getElementById('sidebarTitle').textContent = name;
    document.getElementById('ssServerName').textContent = name + ' Settings';
  }
}

function createNewRole() {
  const server = servers[activeServer];
  const managed = server?.managedId ? NexusServerManager.get(server.managedId) : null;
  if (!managed) return;

  const role = managed.createRole({ name: 'New Role', color: '#99aab5' });
  renderSSContent('roles');
  editRole(role.id);
  showToast('Role created!');
}

function deleteRole(roleId) {
  const server = servers[activeServer];
  const managed = server?.managedId ? NexusServerManager.get(server.managedId) : null;
  if (!managed) return;
  managed.deleteRole(roleId);
  renderSSContent('roles');
  showToast('Role deleted');
}

function editRole(roleId) {
  const server = servers[activeServer];
  const managed = server?.managedId ? NexusServerManager.get(server.managedId) : null;
  if (!managed) return;

  const role = managed.getRole(roleId);
  if (!role) return;

  const colors = ['#f87171','#ef4444','#f59e0b','#eab308','#22c55e','#f43f5e','#14b8a6','#dc2626','#3b82f6','#6366f1','#8b5cf6','#a78bfa','#d946ef','#ec4899','#99aab5','#fff'];

  const area = document.getElementById('roleEditorArea');
  area.innerHTML = `
    <div class="role-editor">
      <div class="role-editor-header">
        <div class="role-color-dot" style="background:${role.color};width:20px;height:20px;"></div>
        <input class="form-input" value="${role.name}" style="font-size:16px;font-weight:700;flex:1;" onchange="renameRole('${roleId}',this.value)" ${role.isDefault ? 'disabled' : ''}>
      </div>
      <label class="form-label">Role Color</label>
      <div class="role-color-picker">
        ${colors.map(c => `<div class="role-color-swatch${c === role.color ? ' selected' : ''}" style="background:${c}" onclick="setRoleColor('${roleId}','${c}',this)"></div>`).join('')}
      </div>
      <div class="privacy-toggle-row">
        <div><div class="privacy-toggle-label">Display separately</div><div class="privacy-toggle-desc">Show this role's members in a separate group</div></div>
        <div class="toggle${role.hoisted ? ' active' : ''}" onclick="this.classList.toggle('active');toggleRoleHoist('${roleId}')"></div>
      </div>
      <div class="privacy-toggle-row">
        <div><div class="privacy-toggle-label">Allow mentioning</div><div class="privacy-toggle-desc">Members can @mention this role</div></div>
        <div class="toggle${role.mentionable ? ' active' : ''}" onclick="this.classList.toggle('active');toggleRoleMention('${roleId}')"></div>
      </div>
    </div>`;
}

function renameRole(roleId, name) {
  const managed = NexusServerManager.get(servers[activeServer]?.managedId);
  if (!managed) return;
  const role = managed.getRole(roleId);
  if (role) { role.name = name; renderSSContent('roles'); editRole(roleId); }
}

function setRoleColor(roleId, color, el) {
  const managed = NexusServerManager.get(servers[activeServer]?.managedId);
  if (!managed) return;
  const role = managed.getRole(roleId);
  if (role) { role.color = color; renderSSContent('roles'); editRole(roleId); }
}

function toggleRoleHoist(roleId) {
  const managed = NexusServerManager.get(servers[activeServer]?.managedId);
  const role = managed?.getRole(roleId);
  if (role) role.hoisted = !role.hoisted;
}

function toggleRoleMention(roleId) {
  const managed = NexusServerManager.get(servers[activeServer]?.managedId);
  const role = managed?.getRole(roleId);
  if (role) role.mentionable = !role.mentionable;
}

function createNewFolder() {
  const managed = NexusServerManager.get(servers[activeServer]?.managedId);
  if (!managed) return;
  const name = prompt('Folder name:');
  if (!name) return;
  managed.createFolder({ name });
  servers[activeServer].channels = managed.toSidebarData();
  renderChannelList(servers[activeServer]);
  renderSSContent('channels');
  showToast(`📁 "${name}" folder created`);
}

function deleteServerChannel(channelId) {
  const managed = NexusServerManager.get(servers[activeServer]?.managedId);
  if (!managed) return;
  managed.deleteChannel(channelId);
  servers[activeServer].channels = managed.toSidebarData();
  renderChannelList(servers[activeServer]);
  renderSSContent('channels');
  showToast('Channel deleted');
}

// Hook into sidebar header for server settings
function toggleServerDropdown() {
  if (activeServer === 'home') {
    showToast('Server settings');
    return;
  }
  openServerSettings();
}

// Hook category add button to channel creation
const origRenderChannelList = renderChannelList;
renderChannelList = function(server) {
  origRenderChannelList(server);

  // Re-bind category add buttons
  document.querySelectorAll('.category-add').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const catHeader = btn.closest('.category-header');
      const catName = catHeader?.querySelector('.category-name')?.textContent;
      // Find folder ID
      const managed = NexusServerManager.get(servers[activeServer]?.managedId);
      if (managed) {
        const folder = managed.folders.find(f => f.name === catName);
        openChannelCreate(folder?.id);
      } else {
        openChannelCreate();
      }
    };
  });
};

// ============ WATCH PARTY SYSTEM ============

function selectWPSource(el, type) {
  document.querySelectorAll('.wp-source-option').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
  wpSourceType = type;
}

function startWatchParty() {
  const name = document.getElementById('wpName').value.trim() || 'Watch Party';
  const url = document.getElementById('wpSourceUrl').value.trim();
  const isPrivate = document.getElementById('wpPrivateToggle').classList.contains('active');

  closeModal('watchPartyModal');

  const party = NexusWatchParty.create({
    hostId: (currentUser.id || 'unknown'),
    hostName: currentUser.name,
    title: name,
    source: { type: wpSourceType, url },
    isPrivate
  });

  // Viewers join via real-time events from backend

  activeWatchParty = party;
  NexusWatchParty.start(party.id);

  showWatchPartyUI(party);
  showToast('🎬 Watch Party started!');

  // Simulate chat
  simulateWPChat(party.id);
}

function showWatchPartyUI(party) {
  const container = document.getElementById('watchPartyContainer');
  container.classList.add('active');

  // Hide other views
  document.getElementById('messagesAreaWrapper').style.display = 'none';
  document.getElementById('streamerHub')?.classList.remove('active');
  document.getElementById('twitchViewer')?.classList.remove('active');

  document.getElementById('wpTitle').textContent = party.title;
  document.getElementById('wpViewerCount').textContent = party.viewers.length;

  const sourceIcons = { twitch: '📺', screen: '🖥️', youtube: '▶️' };
  document.getElementById('wpIcon').textContent = sourceIcons[party.source?.type] || '🍿';
  document.getElementById('wpBg').textContent = sourceIcons[party.source?.type] || '📺';
  document.getElementById('wpLabel').textContent = party.title;
  document.getElementById('wpSublabel').textContent = party.source?.url || 'Streaming now...';
  document.getElementById('wpVideo').style.background = '#0a0a12';

  renderWPViewers(party);
  wpPlaybackState = 'playing';
  document.getElementById('wpPlayBtn').textContent = '⏸️';

  // Simulate progress
  let progress = 0;
  const progressInterval = setInterval(() => {
    if (!activeWatchParty || wpPlaybackState !== 'playing') return;
    if (!activeWatchParty || activeWatchParty.status === 'ended') { clearInterval(progressInterval); return; }
    progress = Math.min(progress + 0.2, 100);
    document.getElementById('wpProgressFill').style.width = progress + '%';
    const elapsed = Math.floor(progress * 1.2);
    const total = 120;
    document.getElementById('wpTime').textContent = `${Math.floor(elapsed/60)}:${(elapsed%60).toString().padStart(2,'0')} / ${Math.floor(total/60)}:${(total%60).toString().padStart(2,'0')}`;
  }, 1000);
}

function leaveWatchParty() {
  if (activeWatchParty) {
    NexusWatchParty.leave(activeWatchParty.id, (currentUser.id || 'unknown'));
    activeWatchParty = null;
  }
  document.getElementById('watchPartyContainer').classList.remove('active');
  document.getElementById('messagesAreaWrapper').style.display = '';
  showToast('Left the watch party');
}

function toggleWPPlayback() {
  if (wpPlaybackState === 'playing') {
    wpPlaybackState = 'paused';
    document.getElementById('wpPlayBtn').textContent = '▶️';
  } else {
    wpPlaybackState = 'playing';
    document.getElementById('wpPlayBtn').textContent = '⏸️';
  }
}

function switchWPSidebarTab(btn, tab) {
  document.querySelectorAll('.wp-sidebar-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('wpChatArea').style.display = tab === 'chat' ? '' : 'none';
  document.getElementById('wpViewerList').style.display = tab === 'viewers' ? '' : 'none';
  if (tab === 'viewers' && activeWatchParty) renderWPViewers(activeWatchParty);
}

function renderWPViewers(party) {
  const container = document.getElementById('wpViewerList');
  container.innerHTML = '';
  party.viewers.forEach(uid => {
    const u = users[uid];
    if (!u) return;
    container.innerHTML += `
      <div class="wp-viewer-item">
        <div class="wp-viewer-avatar" style="background:${u.color}">${u.initials}</div>
        <div class="wp-viewer-name">${u.name}</div>
        ${uid === party.hostId ? '<span class="wp-viewer-badge" style="background:rgba(14,165,233,0.15);color:#dc2626;">Host</span>' : ''}
      </div>`;
  });
}

function sendWPChat() {
  const input = document.getElementById('wpChatInput');
  const msg = input.value.trim();
  if (!msg || !activeWatchParty) return;

  NexusWatchParty.sendChat(activeWatchParty.id, (currentUser.id || 'unknown'), currentUser.name, msg);
  appendWPChatMsg({ userName: currentUser.name, message: msg, color: currentUser.color });
  input.value = '';
}

function appendWPChatMsg(msg) {
  const container = document.getElementById('wpChatArea');
  const el = document.createElement('div');
  el.className = 'wp-chat-msg';
  el.innerHTML = `<span class="wp-chat-user" style="color:${msg.color || '#dc2626'}">${msg.userName}</span>${msg.message}`;
  container.appendChild(el);
  container.scrollTop = container.scrollHeight;
  while (container.children.length > 100) container.removeChild(container.firstChild);
}

function sendWPReaction(emoji) {
  if (!activeWatchParty) return;
  NexusWatchParty.addReaction(activeWatchParty.id, emoji, (currentUser.id || 'unknown'));

  // Float the emoji
  const container = document.getElementById('wpFloatingReactions');
  const el = document.createElement('div');
  el.className = 'wp-floating-emoji';
  el.textContent = emoji;
  el.style.left = Math.random() * 60 + 'px';
  container.appendChild(el);
  setTimeout(() => el.remove(), 2000);
}

function simulateWPChat(partyId) {
  // Watch party chat comes from real users via backend — no simulation
}

// ============ CONSOLE ============

console.log('%c🌟 Nexus Chat', 'font-size:24px;font-weight:800;color:#dc2626;');
console.log('%cA modern real-time communication platform', 'font-size:12px;color:#8b95a8;');
console.log('%c🔌 Developer SDK available: NexusSDK', 'font-size:12px;color:#f43f5e;');
console.log('%c📺 Twitch Integration: NexusTwitch', 'font-size:12px;color:#9146FF;');
console.log('%c📖 Open dev-portal.html for documentation', 'font-size:12px;color:#8b95a8;');

// ============ BACKEND INTEGRATION HOOKS ============
// These override the original functions to use the backend API

(function() {
  // Wait for DOM and backend to be ready
  const originalInit = window.onload;
  
  function setupBackendHooks() {
    console.log('[BackendHooks] Setting up backend integration...');
    
    // Override sendMessage to use backend
    const _originalSendMessage = window.sendMessage;
    window.sendMessage = async function() {
      const input = document.getElementById('messageInput');
      if (!input || !input.value.trim()) return;
      
      const content = input.value.trim();
      input.value = '';
      input.style.height = 'auto';
      
      // Stop typing indicator
      if (typeof NexusBackend !== 'undefined') {
        NexusBackend.stopTyping(activeChannel);
      }
      
      // Check for slash commands first
      if (content.startsWith('/') && typeof NexusSDK !== 'undefined') {
        const parts = content.slice(1).split(' ');
        const cmdName = parts[0];
        const args = parts.slice(1).join(' ');
        const cmd = NexusSDK.commands.getAll().find(c => c.name === cmdName);
        if (cmd) {
          const result = cmd.execute(args);
          if (result) {
            if (!channelMessages[activeChannel]) channelMessages[activeChannel] = [];
            channelMessages[activeChannel].push({
              id: 'msg-sdk-' + Date.now(),
              userId: (currentUser.id || 'unknown'),
              content: result,
              timestamp: new Date().toISOString(),
              reactions: [],
              systemContent: typeof result === 'string' ? null : result.systemContent
            });
            renderMessages();
            scrollToBottom();
          }
          return;
        }
      }
      
      // Use backend API to send message
      if (typeof NexusBackend !== 'undefined' && typeof NexusAPI !== 'undefined' && NexusAPI.isAuthenticated()) {
        try {
          const result = await NexusBackend.sendMessage(activeChannel, content);
          if (result) {
            renderMessages();
            scrollToBottom();
          } else {
            // Fallback: show message locally
            fallbackLocalMessage(content);
          }
        } catch(err) {
          console.error('[BackendHooks] Send message error:', err);
          fallbackLocalMessage(content);
        }
      } else {
        // Fallback to local-only
        fallbackLocalMessage(content);
      }
    };
    
    function fallbackLocalMessage(content) {
      if (!channelMessages[activeChannel]) channelMessages[activeChannel] = [];
      channelMessages[activeChannel].push({
        id: 'msg-local-' + Date.now(),
        userId: (currentUser.id || 'unknown'),
        content: content,
        timestamp: new Date().toISOString(),
        reactions: []
      });
      renderMessages();
      scrollToBottom();
    }
    
    // Override switchServer to load data from backend
    const _originalSwitchServer = window.switchServer;
    window.switchServer = async function(serverId) {
      if (typeof NexusBackend !== 'undefined' && typeof NexusAPI !== 'undefined' && NexusAPI.isAuthenticated() && serverId !== 'home') {
        try {
          await NexusBackend.loadServerDetail(serverId);
        } catch(err) {
          console.error('[BackendHooks] Load server error:', err);
        }
      }
      _originalSwitchServer(serverId);
    };
    
    // Override switchChannel to load messages from backend
    const _originalSwitchChannel = window.switchChannel;
    const _socialSwitchChannel = window.switchChannel; // May have been wrapped by social.js
    
    // We need to hook into the channel switch to load messages
    const currentSwitchChannel = window.switchChannel;
    window.switchChannel = async function(channelId) {
      // Unsubscribe from previous channel
      if (typeof activeChannel !== 'undefined' && activeChannel && typeof NexusBackend !== 'undefined') {
        NexusBackend.unsubscribeChannel(activeChannel);
      }
      
      // Load messages from backend before rendering
      if (typeof NexusBackend !== 'undefined' && typeof NexusAPI !== 'undefined' && NexusAPI.isAuthenticated()) {
        try {
          await NexusBackend.loadMessages(channelId);
          NexusBackend.subscribeChannel(channelId);
        } catch(err) {
          console.error('[BackendHooks] Load messages error:', err);
        }
      }
      
      // Call the current switchChannel (which may be social.js wrapped version)
      currentSwitchChannel(channelId);
    };
    
    // Override deleteMessage to use backend
    window.deleteMessageBackend = async function(messageId) {
      if (typeof NexusBackend !== 'undefined' && typeof NexusAPI !== 'undefined' && NexusAPI.isAuthenticated()) {
        const result = await NexusBackend.deleteMessage(messageId, activeChannel);
        if (result) {
          renderMessages();
          if (typeof showToast === 'function') showToast('Message deleted');
        }
      } else {
        // Fallback local delete
        if (channelMessages[activeChannel]) {
          channelMessages[activeChannel] = channelMessages[activeChannel].filter(m => m.id !== messageId);
          renderMessages();
        }
      }
    };
    
    // Override editMessage to use backend
    window.editMessageBackend = async function(messageId, newContent) {
      if (typeof NexusBackend !== 'undefined' && typeof NexusAPI !== 'undefined' && NexusAPI.isAuthenticated()) {
        const result = await NexusBackend.editMessage(messageId, newContent, activeChannel);
        if (result) {
          renderMessages();
        }
      }
    };
    
    // Add typing indicator on input
    const msgInput = document.getElementById('messageInput');
    if (msgInput) {
      let typingTimeout = null;
      msgInput.addEventListener('input', () => {
        if (typeof NexusBackend !== 'undefined' && typeof NexusAPI !== 'undefined' && NexusAPI.isAuthenticated()) {
          NexusBackend.startTyping(activeChannel);
          clearTimeout(typingTimeout);
          typingTimeout = setTimeout(() => {
            NexusBackend.stopTyping(activeChannel);
          }, 3000);
        }
      });
    }
    
    console.log('[BackendHooks] Backend integration hooks installed');
  }
  
  // Setup hooks when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(setupBackendHooks, 500));
  } else {
    setTimeout(setupBackendHooks, 500);
  }
})();
