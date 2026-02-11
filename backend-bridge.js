// ============================================
// NEXUS CHAT - Backend Bridge
// Connects existing frontend code to the backend API
// Replaces localStorage-based auth/data with real API calls
// ============================================

const NexusBackend = (() => {

  // ============ STATE ============
  let initialized = false;
  let serversCache = {};       // serverId -> server detail data
  let channelMessagesCache = {}; // channelId -> messages array
  let friendsCache = null;
  let dmsCache = null;
  let onlineUsersSet = new Set();

  // ============ INITIALIZATION ============

  async function init() {
    if (initialized) return;

    console.log('[Backend] Initializing...');

    // Try to restore session
    const result = await NexusAPI.init();

    if (result.success) {
      console.log('[Backend] Session restored for:', result.user.displayName);
      applyUserToApp(result.user);
      await loadInitialData();
      initialized = true;
      return { authenticated: true, user: result.user };
    } else {
      console.log('[Backend] No valid session, showing auth screen');
      return { authenticated: false };
    }
  }

  async function loadInitialData() {
    // Load servers
    const serversResult = await NexusAPI.getServers();
    if (serversResult.success) {
      rebuildServersData(serversResult.servers);
    }

    // Setup WebSocket event handlers
    setupRealtimeHandlers();
  }

  // ============ AUTH BRIDGE ============

  async function handleLogin(email, password) {
    const result = await NexusAPI.login({ email, password });
    if (result.success) {
      applyUserToApp(result.user);
      await loadInitialData();
      initialized = true;
    }
    return result;
  }

  async function handleSignup(email, displayName, username, password) {
    const result = await NexusAPI.register({ email, displayName, username, password });
    if (result.success) {
      applyUserToApp(result.user);
      await loadInitialData();
      initialized = true;
    }
    return result;
  }

  async function handleLogout() {
    await NexusAPI.logout();
    initialized = false;
    serversCache = {};
    channelMessagesCache = {};
    friendsCache = null;
    dmsCache = null;
    window.location.reload();
  }

  async function handleUpdateProfile(updates) {
    const result = await NexusAPI.updateProfile(updates);
    if (result.success) {
      applyUserToApp(result.user);
    }
    return result;
  }

  // ============ SERVER DATA BRIDGE ============

  function rebuildServersData(serversList) {
    // Rebuild the global `servers` object that app.js uses
    if (typeof window.servers === 'undefined') return;

    // Keep the 'home' entry for DMs
    const newServers = {
      'home': window.servers['home'] || {
        name: 'Direct Messages',
        channels: { 'dm': [] }
      }
    };

    for (const srv of serversList) {
      // Map backend server ID to frontend key
      const frontendId = mapServerIdToFrontend(srv.id);
      newServers[frontendId] = {
        _backendId: srv.id,
        name: srv.name,
        icon: srv.icon,
        iconEmoji: srv.iconEmoji,
        ownerId: srv.ownerId,
        description: srv.description,
        memberCount: srv.memberCount,
        channels: {} // Will be populated when server is selected
      };
    }

    // Replace global servers
    Object.keys(window.servers).forEach(k => delete window.servers[k]);
    Object.assign(window.servers, newServers);

    // Rebuild server list UI
    if (typeof renderServerList === 'function') {
      renderServerList();
    }
  }

  async function loadServerDetail(serverId) {
    const backendId = mapServerIdToBackend(serverId);
    if (!backendId) return null;

    const result = await NexusAPI.getServer(backendId);
    if (!result.success) return null;

    const serverData = result.server;
    serversCache[serverId] = serverData;

    // Rebuild channels structure for this server
    if (window.servers[serverId]) {
      const channelsObj = {};
      for (const cat of serverData.categories) {
        channelsObj[cat.name] = cat.channels.map(ch => ({
          id: ch.id,
          name: ch.name,
          type: ch.type,
          icon: ch.icon || (ch.type === 'voice' ? '🔊' : '#'),
          topic: ch.topic || '',
          voiceUsers: (ch.voiceUsers || []).map(vu => vu.id),
          _backendId: ch.id
        }));
      }
      window.servers[serverId].channels = channelsObj;

      // Rebuild members list (users object)
      for (const member of serverData.members) {
        if (!window.users[member.id]) {
          window.users[member.id] = {
            id: member.id,
            name: member.displayName,
            tag: member.tag,
            initials: member.initials,
            color: member.color,
            status: member.status,
            avatar: member.avatar,
            avatarEmoji: member.avatarEmoji,
            about: member.about,
            roles: member.roles || [],
            roleClass: member.roles?.[0] ? 'role-' + member.roles[0].name.toLowerCase() : 'role-member'
          };
        } else {
          // Update existing user data
          const u = window.users[member.id];
          u.name = member.displayName;
          u.status = member.status;
          u.color = member.color;
          u.avatar = member.avatar;
          u.roles = member.roles || u.roles;
        }
      }
    }

    return serverData;
  }

  // ============ MESSAGES BRIDGE ============

  async function loadMessages(channelId) {
    const result = await NexusAPI.getMessages(channelId, { limit: 50 });
    if (!result.success) return [];

    const messages = result.messages.map(mapMessageToFrontend);
    channelMessagesCache[channelId] = messages;

    // Update global channelMessages
    if (typeof window.channelMessages !== 'undefined') {
      window.channelMessages[channelId] = messages;
    }

    return messages;
  }

  async function loadMoreMessages(channelId) {
    const existing = channelMessagesCache[channelId] || [];
    const oldestId = existing.length > 0 ? existing[0].id : null;
    if (!oldestId) return [];

    const result = await NexusAPI.getMessages(channelId, { limit: 50, before: oldestId });
    if (!result.success) return [];

    const olderMessages = result.messages.map(mapMessageToFrontend);
    channelMessagesCache[channelId] = [...olderMessages, ...existing];

    if (typeof window.channelMessages !== 'undefined') {
      window.channelMessages[channelId] = channelMessagesCache[channelId];
    }

    return { messages: olderMessages, hasMore: result.hasMore };
  }

  async function sendMessage(channelId, content) {
    const result = await NexusAPI.sendMessage(channelId, content);
    if (!result.success) return null;

    const msg = mapMessageToFrontend(result.message);

    // Add to cache
    if (!channelMessagesCache[channelId]) channelMessagesCache[channelId] = [];
    channelMessagesCache[channelId].push(msg);

    if (typeof window.channelMessages !== 'undefined') {
      if (!window.channelMessages[channelId]) window.channelMessages[channelId] = [];
      window.channelMessages[channelId].push(msg);
    }

    return msg;
  }

  async function editMessage(messageId, content, channelId) {
    const result = await NexusAPI.editMessage(messageId, content);
    if (!result.success) return null;

    const msg = mapMessageToFrontend(result.message);

    // Update in cache
    if (channelMessagesCache[channelId]) {
      const idx = channelMessagesCache[channelId].findIndex(m => m.id === messageId);
      if (idx >= 0) channelMessagesCache[channelId][idx] = msg;
    }
    if (typeof window.channelMessages !== 'undefined' && window.channelMessages[channelId]) {
      const idx = window.channelMessages[channelId].findIndex(m => m.id === messageId);
      if (idx >= 0) window.channelMessages[channelId][idx] = msg;
    }

    return msg;
  }

  async function deleteMessage(messageId, channelId) {
    const result = await NexusAPI.deleteMessage(messageId, channelId);
    if (!result.success) return false;

    // Remove from cache
    if (channelMessagesCache[channelId]) {
      channelMessagesCache[channelId] = channelMessagesCache[channelId].filter(m => m.id !== messageId);
    }
    if (typeof window.channelMessages !== 'undefined' && window.channelMessages[channelId]) {
      window.channelMessages[channelId] = window.channelMessages[channelId].filter(m => m.id !== messageId);
    }

    return true;
  }

  async function toggleReaction(messageId, emoji, channelId) {
    return NexusAPI.addReaction(messageId, emoji, channelId);
  }

  // ============ FRIENDS BRIDGE ============

  async function loadFriends() {
    const result = await NexusAPI.getFriends();
    if (!result.success) return null;
    friendsCache = result;
    return result;
  }

  async function sendFriendRequest(tag) {
    return NexusAPI.sendFriendRequest(tag);
  }

  async function acceptFriendRequest(userId) {
    return NexusAPI.acceptFriendRequest(userId);
  }

  async function declineFriendRequest(userId) {
    return NexusAPI.declineFriendRequest(userId);
  }

  async function removeFriend(userId) {
    return NexusAPI.removeFriend(userId);
  }

  async function blockUser(userId) {
    return NexusAPI.blockUser(userId);
  }

  async function unblockUser(userId) {
    return NexusAPI.unblockUser(userId);
  }

  // ============ DM BRIDGE ============

  async function loadDMs() {
    const result = await NexusAPI.getDMs();
    if (!result.success) return [];

    dmsCache = result.dms;

    // Update the home server DM channels
    if (window.servers && window.servers['home']) {
      window.servers['home'].channels['dm'] = result.dms.map(dm => ({
        id: dm.id,
        name: dm.user ? dm.user.displayName : 'Unknown',
        type: 'dm',
        icon: '💬',
        _userId: dm.user?.id,
        _backendId: dm.id
      }));
    }

    return result.dms;
  }

  async function openDM(targetUserId) {
    const result = await NexusAPI.createDM(targetUserId);
    if (!result.success) return null;

    // Subscribe to the DM channel
    NexusAPI.subscribeChannel(result.channel.id);

    return result.channel;
  }

  // ============ REALTIME HANDLERS ============

  function setupRealtimeHandlers() {
    // New message from another user
    NexusAPI.on('message:new', (msg) => {
      const frontendMsg = mapMessageToFrontend(msg);
      const channelId = msg.channelId;

      if (!channelMessagesCache[channelId]) channelMessagesCache[channelId] = [];
      channelMessagesCache[channelId].push(frontendMsg);

      if (typeof window.channelMessages !== 'undefined') {
        if (!window.channelMessages[channelId]) window.channelMessages[channelId] = [];
        window.channelMessages[channelId].push(frontendMsg);
      }

      // If this channel is currently active, render the new message
      if (typeof window.activeChannel !== 'undefined' && window.activeChannel === channelId) {
        if (typeof window.renderMessages === 'function') {
          window.renderMessages();
        }
      }

      // Show notification badge if not active channel
      if (typeof window.activeChannel !== 'undefined' && window.activeChannel !== channelId) {
        showChannelBadge(channelId);
      }
    });

    // Message edited
    NexusAPI.on('message:edited', (msg) => {
      const frontendMsg = mapMessageToFrontend(msg);
      const channelId = msg.channelId;

      if (channelMessagesCache[channelId]) {
        const idx = channelMessagesCache[channelId].findIndex(m => m.id === msg.id);
        if (idx >= 0) channelMessagesCache[channelId][idx] = frontendMsg;
      }
      if (typeof window.channelMessages !== 'undefined' && window.channelMessages[channelId]) {
        const idx = window.channelMessages[channelId].findIndex(m => m.id === msg.id);
        if (idx >= 0) window.channelMessages[channelId][idx] = frontendMsg;
      }

      if (typeof window.activeChannel !== 'undefined' && window.activeChannel === channelId) {
        if (typeof window.renderMessages === 'function') window.renderMessages();
      }
    });

    // Message deleted
    NexusAPI.on('message:deleted', (data) => {
      const { channelId, messageId } = data;
      if (channelMessagesCache[channelId]) {
        channelMessagesCache[channelId] = channelMessagesCache[channelId].filter(m => m.id !== messageId);
      }
      if (typeof window.channelMessages !== 'undefined' && window.channelMessages[channelId]) {
        window.channelMessages[channelId] = window.channelMessages[channelId].filter(m => m.id !== messageId);
      }
      if (typeof window.activeChannel !== 'undefined' && window.activeChannel === channelId) {
        if (typeof window.renderMessages === 'function') window.renderMessages();
      }
    });

    // Typing indicators
    NexusAPI.on('typing:start', (data) => {
      showTypingIndicator(data.channelId, data.user);
    });

    NexusAPI.on('typing:stop', (data) => {
      hideTypingIndicator(data.channelId, data.userId);
    });

    // Presence updates
    NexusAPI.on('presence:update', (data) => {
      const { userId, status } = data;
      if (window.users && window.users[userId]) {
        window.users[userId].status = status;
      }
      if (status === 'offline') {
        onlineUsersSet.delete(userId);
      } else {
        onlineUsersSet.add(userId);
      }
      // Re-render member list if visible
      if (typeof window.renderMembersList === 'function') {
        window.renderMembersList();
      }
    });

    // Voice events
    NexusAPI.on('voice:user_joined', (data) => {
      updateVoiceChannelUI(data.channelId, data.user, 'join');
    });

    NexusAPI.on('voice:user_left', (data) => {
      updateVoiceChannelUI(data.channelId, data.userId, 'leave');
    });

    // Friend events
    NexusAPI.on('friend:request_received', (data) => {
      if (typeof showToast === 'function') {
        showToast(`${data.from.displayName} sent you a friend request! 👋`);
      }
    });

    NexusAPI.on('friend:request_accepted', (data) => {
      if (typeof showToast === 'function') {
        showToast(`${data.by.displayName} accepted your friend request! 🎉`);
      }
    });

    // Online users from ready event
    NexusAPI.on('ws:ready', (data) => {
      onlineUsersSet = new Set(data.onlineUsers);
    });
  }

  // ============ HELPERS ============

  function mapServerIdToFrontend(backendId) {
    // Map backend IDs like 'srv-nexus-hq' to frontend keys like 'nexus-hq'
    return backendId.replace(/^srv-/, '');
  }

  function mapServerIdToBackend(frontendId) {
    if (frontendId === 'home') return null;
    // Check if server has _backendId
    if (window.servers[frontendId] && window.servers[frontendId]._backendId) {
      return window.servers[frontendId]._backendId;
    }
    return 'srv-' + frontendId;
  }

  function mapMessageToFrontend(msg) {
    return {
      id: msg.id,
      userId: msg.userId || msg.user?.id,
      content: msg.content,
      timestamp: msg.createdAt || msg.timestamp,
      editedAt: msg.editedAt,
      type: msg.type || 'text',
      reactions: (msg.reactions || []).map(r => ({
        emoji: r.emoji,
        count: r.count,
        active: r.active
      })),
      // User info for rendering
      _user: msg.user || null
    };
  }

  function showChannelBadge(channelId) {
    const channelEl = document.querySelector(`[data-channel-id="${channelId}"]`);
    if (channelEl) {
      let badge = channelEl.querySelector('.channel-badge');
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'channel-badge';
        badge.textContent = '1';
        channelEl.appendChild(badge);
      } else {
        badge.textContent = parseInt(badge.textContent || '0') + 1;
      }
    }
  }

  function showTypingIndicator(channelId, user) {
    if (typeof window.activeChannel === 'undefined' || window.activeChannel !== channelId) return;
    const typingArea = document.querySelector('.typing-indicator');
    if (typingArea) {
      typingArea.textContent = `${user.displayName} is typing...`;
      typingArea.style.display = 'block';
    }
  }

  function hideTypingIndicator(channelId, userId) {
    if (typeof window.activeChannel === 'undefined' || window.activeChannel !== channelId) return;
    const typingArea = document.querySelector('.typing-indicator');
    if (typingArea) {
      typingArea.style.display = 'none';
    }
  }

  function updateVoiceChannelUI(channelId, userData, action) {
    // This will be handled by re-rendering the channel list
    if (typeof window.renderChannelList === 'function') {
      window.renderChannelList();
    }
  }

  function isUserOnline(userId) {
    return onlineUsersSet.has(userId);
  }

  // ============ PUBLIC API ============

  return {
    init,
    handleLogin,
    handleSignup,
    handleLogout,
    handleUpdateProfile,

    loadServerDetail,
    loadMessages,
    loadMoreMessages,
    sendMessage,
    editMessage,
    deleteMessage,
    toggleReaction,

    loadFriends,
    sendFriendRequest,
    acceptFriendRequest,
    declineFriendRequest,
    removeFriend,
    blockUser,
    unblockUser,

    loadDMs,
    openDM,

    isUserOnline,
    getServersCache: () => serversCache,
    getFriendsCache: () => friendsCache,

    // Expose for channel subscription
    subscribeChannel: (id) => NexusAPI.subscribeChannel(id),
    unsubscribeChannel: (id) => NexusAPI.unsubscribeChannel(id),
    startTyping: (id) => NexusAPI.startTyping(id),
    stopTyping: (id) => NexusAPI.stopTyping(id),
    updatePresence: (s) => NexusAPI.updatePresence(s),
    joinVoice: (id) => NexusAPI.joinVoice(id),
    leaveVoice: (id) => NexusAPI.leaveVoice(id),
  };
})();

window.NexusBackend = NexusBackend;