// ============================================
// NEXUS CHAT - API Client
// Bridges frontend to backend REST API + WebSocket
// ============================================

const NexusAPI = (() => {
  const BASE_URL = window.location.origin + '/api';
  // Check both localStorage and sessionStorage for token
  let authToken = localStorage.getItem('nexus_token') || sessionStorage.getItem('nexus_token') || null;
  let socket = null;
  let currentUser = null;
  const eventHandlers = {};

  // Helper: save token based on "stay signed in" preference
  function saveToken(token) {
    authToken = token;
    const remember = localStorage.getItem('nexus_remember_me') === 'true';
    if (remember) {
      localStorage.setItem('nexus_token', token);
    } else {
      // Only persist for this browser session
      sessionStorage.setItem('nexus_token', token);
      localStorage.setItem('nexus_token', token); // still needed for api-client init
    }
  }

  function clearToken() {
    authToken = null;
    localStorage.removeItem('nexus_token');
    sessionStorage.removeItem('nexus_token');
  }

  // ============ HTTP HELPERS ============

  async function request(method, path, body = null) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (authToken) {
      opts.headers['Authorization'] = 'Bearer ' + authToken;
    }
    if (body) {
      opts.body = JSON.stringify(body);
    }
    try {
      const res = await fetch(BASE_URL + path, opts);
      const data = await res.json();
      if (!res.ok && !data.errors) {
        data.error = data.error || `HTTP ${res.status}`;
      }
      return data;
    } catch (err) {
      console.error('[API] Request failed:', method, path, err);
      return { success: false, error: 'Network error. Please check your connection.' };
    }
  }

  function get(path) { return request('GET', path); }
  function post(path, body) { return request('POST', path, body); }
  function patch(path, body) { return request('PATCH', path, body); }
  function del(path, body) { return request('DELETE', path, body); }

  // ============ AUTH ============

  async function register(data) {
    const result = await post('/auth/register', data);
    if (result.success) {
      saveToken(result.token);
      currentUser = result.user;
      connectWebSocket();
    }
    return result;
  }

  async function login(data) {
    const result = await post('/auth/login', data);
    if (result.success) {
      saveToken(result.token);
      currentUser = result.user;
      connectWebSocket();
    }
    return result;
  }

  async function logout() {
    const result = await post('/auth/logout');
    clearToken();
    currentUser = null;
    localStorage.removeItem('nexus_remember_me');
    sessionStorage.removeItem('nexus_session_active');
    disconnectWebSocket();
    return result;
  }

  async function getMe() {
    if (!authToken) return { success: false, error: 'Not authenticated' };
    const result = await get('/auth/me');
    if (result.success) {
      currentUser = result.user;
    }
    return result;
  }

  async function updateProfile(data) {
    const result = await patch('/auth/me', data);
    if (result.success) {
      currentUser = result.user;
    }
    return result;
  }

  function getCurrentUser() {
    return currentUser;
  }

  function isAuthenticated() {
    return !!authToken;
  }

  // ============ SERVERS ============

  async function getServers() {
    return get('/servers');
  }

  async function getServer(serverId) {
    return get('/servers/' + serverId);
  }

  async function createServer(data) {
    return post('/servers', data);
  }

  async function updateServer(serverId, data) {
    return patch('/servers/' + serverId, data);
  }

  async function deleteServer(serverId) {
    return del('/servers/' + serverId);
  }

  async function joinServer(serverId) {
    const result = await post('/servers/' + serverId + '/join');
    if (result.success && socket) {
      socket.emit('server:join', { serverId });
    }
    return result;
  }

  async function leaveServer(serverId) {
    const result = await post('/servers/' + serverId + '/leave');
    if (result.success && socket) {
      socket.emit('server:leave', { serverId });
    }
    return result;
  }

  async function createChannel(serverId, data) {
    return post('/servers/' + serverId + '/channels', data);
  }

  async function updateChannel(channelId, data) {
    return patch('/channels/' + channelId, data);
  }

  async function deleteChannel(channelId) {
    return del('/channels/' + channelId);
  }

  async function getServerMembers(serverId) {
    return get('/servers/' + serverId + '/members');
  }

  // ============ MESSAGES ============

  async function getMessages(channelId, opts = {}) {
    let path = '/channels/' + channelId + '/messages?limit=' + (opts.limit || 50);
    if (opts.before) path += '&before=' + opts.before;
    return get(path);
  }

  async function sendMessage(channelId, content, type = 'text') {
    const result = await post('/channels/' + channelId + '/messages', { content, type });
    if (result.success && socket) {
      socket.emit('message:send', { channelId, message: result.message });
    }
    return result;
  }

  async function editMessage(messageId, content) {
    const result = await patch('/messages/' + messageId, { content });
    if (result.success && socket) {
      socket.emit('message:edit', { channelId: result.message.channelId, message: result.message });
    }
    return result;
  }

  async function deleteMessage(messageId, channelId) {
    const result = await del('/messages/' + messageId);
    if (result.success && socket) {
      socket.emit('message:delete', { channelId, messageId });
    }
    return result;
  }

  async function addReaction(messageId, emoji, channelId) {
    const result = await post('/messages/' + messageId + '/reactions', { emoji });
    if (result.success && socket) {
      socket.emit('message:reaction', {
        channelId,
        messageId,
        emoji,
        action: result.action,
        userId: currentUser?.id
      });
    }
    return result;
  }

  async function removeReaction(messageId, emoji, channelId) {
    const result = await del('/messages/' + messageId + '/reactions/' + encodeURIComponent(emoji));
    if (result.success && socket) {
      socket.emit('message:reaction', {
        channelId,
        messageId,
        emoji,
        action: 'removed',
        userId: currentUser?.id
      });
    }
    return result;
  }

  // ============ FRIENDS ============

  async function getFriends() {
    return get('/friends');
  }

  async function sendFriendRequest(tag) {
    const result = await post('/friends/request', { tag });
    if (result.success && result.targetUser && socket) {
      socket.emit('friend:request', { targetUserId: result.targetUser.id });
    }
    return result;
  }

  async function acceptFriendRequest(userId) {
    const result = await post('/friends/accept/' + userId);
    if (result.success && socket) {
      socket.emit('friend:accept', { targetUserId: userId });
    }
    return result;
  }

  async function declineFriendRequest(userId) {
    return post('/friends/decline/' + userId);
  }

  async function removeFriend(userId) {
    return del('/friends/' + userId);
  }

  async function blockUser(userId) {
    return post('/friends/block/' + userId);
  }

  async function unblockUser(userId) {
    return del('/friends/block/' + userId);
  }

  // ============ DMs ============

  async function getDMs() {
    return get('/dms');
  }

  async function createDM(targetUserId) {
    return post('/dms', { targetUserId });
  }

  // ============ WEBSOCKET ============

  function connectWebSocket() {
    if (socket) return;
    if (!authToken) return;

    // Load Socket.IO client if not loaded
    if (typeof io === 'undefined') {
      console.warn('[WS] Socket.IO client not loaded yet');
      return;
    }

    socket = io(window.location.origin, {
      auth: { token: authToken },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10
    });

    socket.on('connect', () => {
      console.log('[WS] Connected:', socket.id);
      emit('ws:connected');
    });

    socket.on('disconnect', (reason) => {
      console.log('[WS] Disconnected:', reason);
      emit('ws:disconnected', { reason });
    });

    socket.on('ready', (data) => {
      console.log('[WS] Ready:', data.user.displayName, '| Online users:', data.onlineUsers.length);
      emit('ws:ready', data);
    });

    // Message events
    socket.on('message:new', (msg) => emit('message:new', msg));
    socket.on('message:edited', (msg) => emit('message:edited', msg));
    socket.on('message:deleted', (data) => emit('message:deleted', data));
    socket.on('message:reaction', (data) => emit('message:reaction', data));

    // Typing events
    socket.on('typing:start', (data) => emit('typing:start', data));
    socket.on('typing:stop', (data) => emit('typing:stop', data));

    // Presence events
    socket.on('presence:update', (data) => emit('presence:update', data));

    // Voice events
    socket.on('voice:user_joined', (data) => emit('voice:user_joined', data));
    socket.on('voice:user_left', (data) => emit('voice:user_left', data));
    socket.on('voice:state_update', (data) => emit('voice:state_update', data));

    // Friend events
    socket.on('friend:request_received', (data) => emit('friend:request_received', data));
    socket.on('friend:request_accepted', (data) => emit('friend:request_accepted', data));

    // Server events
    socket.on('server:member_joined', (data) => emit('server:member_joined', data));
    socket.on('server:member_left', (data) => emit('server:member_left', data));
  }

  function disconnectWebSocket() {
    if (socket) {
      socket.disconnect();
      socket = null;
    }
  }

  // Join a channel room for real-time updates
  function subscribeChannel(channelId) {
    if (socket) socket.emit('channel:join', { channelId });
  }

  function unsubscribeChannel(channelId) {
    if (socket) socket.emit('channel:leave', { channelId });
  }

  // Typing indicators
  function startTyping(channelId) {
    if (socket) socket.emit('typing:start', { channelId });
  }

  function stopTyping(channelId) {
    if (socket) socket.emit('typing:stop', { channelId });
  }

  // Presence
  function updatePresence(status) {
    if (socket) socket.emit('presence:update', { status });
  }

  // Voice
  function joinVoice(channelId) {
    if (socket) socket.emit('voice:join', { channelId });
  }

  function leaveVoice(channelId) {
    if (socket) socket.emit('voice:leave', { channelId });
  }

  function setVoiceMute(channelId, muted) {
    if (socket) socket.emit('voice:mute', { channelId, muted });
  }

  function setVoiceDeafen(channelId, deafened) {
    if (socket) socket.emit('voice:deafen', { channelId, deafened });
  }

  // ============ EVENT SYSTEM ============

  function on(event, handler) {
    if (!eventHandlers[event]) eventHandlers[event] = [];
    eventHandlers[event].push(handler);
    return () => off(event, handler);
  }

  function off(event, handler) {
    if (!eventHandlers[event]) return;
    eventHandlers[event] = eventHandlers[event].filter(h => h !== handler);
  }

  function emit(event, data) {
    if (!eventHandlers[event]) return;
    for (const handler of eventHandlers[event]) {
      try { handler(data); } catch (err) { console.error('[API] Event handler error:', event, err); }
    }
  }

  // ============ INITIALIZATION ============

  async function init() {
    if (authToken) {
      const result = await getMe();
      if (result.success) {
        // Wait for Socket.IO to be available then connect
        if (typeof io !== 'undefined') {
          connectWebSocket();
        } else {
          // Retry after script loads
          const checkIO = setInterval(() => {
            if (typeof io !== 'undefined') {
              clearInterval(checkIO);
              connectWebSocket();
            }
          }, 200);
          setTimeout(() => clearInterval(checkIO), 10000);
        }
        return { success: true, user: currentUser };
      } else {
        // Token expired or invalid
        authToken = null;
        localStorage.removeItem('nexus_token');
        return { success: false, error: 'Session expired' };
      }
    }
    return { success: false, error: 'Not authenticated' };
  }

  // ============ PUBLIC API ============

  return {
    // Auth
    register,
    login,
    logout,
    getMe,
    updateProfile,
    getCurrentUser,
    isAuthenticated,
    init,

    // Servers
    getServers,
    getServer,
    createServer,
    updateServer,
    deleteServer,
    joinServer,
    leaveServer,
    createChannel,
    updateChannel,
    deleteChannel,
    getServerMembers,

    // Messages
    getMessages,
    sendMessage,
    editMessage,
    deleteMessage,
    addReaction,
    removeReaction,

    // Friends
    getFriends,
    sendFriendRequest,
    acceptFriendRequest,
    declineFriendRequest,
    removeFriend,
    blockUser,
    unblockUser,

    // DMs
    getDMs,
    createDM,

    // WebSocket
    connectWebSocket,
    disconnectWebSocket,
    subscribeChannel,
    unsubscribeChannel,
    startTyping,
    stopTyping,
    updatePresence,
    joinVoice,
    leaveVoice,
    setVoiceMute,
    setVoiceDeafen,

    // Events
    on,
    off,
  };
})();

// Export globally
window.NexusAPI = NexusAPI;