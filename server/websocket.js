// ============================================
// NEXUS CHAT - WebSocket Handler (Socket.IO)
// Uses unified db.js for PostgreSQL/SQLite support
// ============================================

const { dbGet, dbAll, dbRun } = require('./db');
const { socketAuth } = require('./middleware/auth');
const { formatUser } = require('./routes/auth');

// Track online users: userId -> Set of socket IDs
const onlineUsers = new Map();
// Track which rooms (channels/servers) each socket is in
const socketRooms = new Map();

function initializeWebSocket(io) {
  // Auth middleware
  io.use(socketAuth);

  io.on('connection', async (socket) => {
    const user = socket.user;
    console.log(`[WS] User connected: ${user.display_name} (${user.id}) - socket ${socket.id}`);

    // Track online status
    if (!onlineUsers.has(user.id)) {
      onlineUsers.set(user.id, new Set());
    }
    onlineUsers.get(user.id).add(socket.id);

    // Update user status to online
    try {
      await dbRun('UPDATE users SET status = ? WHERE id = ? AND status = ?', 'online', user.id, 'offline');
    } catch (err) {
      console.error('[WS] Error updating user status:', err.message);
    }

    // Join user's personal room for DMs and notifications
    socket.join(`user:${user.id}`);

    // Auto-join all server rooms the user is a member of
    try {
      const userServers = await dbAll('SELECT server_id FROM server_members WHERE user_id = ?', user.id);
      for (const srv of userServers) {
        socket.join(`server:${srv.server_id}`);
      }
    } catch (err) {
      console.error('[WS] Error joining server rooms:', err.message);
    }

    // Auto-join DM channel rooms
    try {
      const userDMs = await dbAll('SELECT channel_id FROM dm_participants WHERE user_id = ?', user.id);
      for (const dm of userDMs) {
        socket.join(`channel:${dm.channel_id}`);
      }
    } catch (err) {
      console.error('[WS] Error joining DM rooms:', err.message);
    }

    // Broadcast presence update
    broadcastPresence(io, user.id, user.status === 'offline' ? 'online' : user.status);

    // ============ MESSAGE EVENTS ============

    // New message sent (from REST API, broadcast here)
    socket.on('message:send', (data) => {
      const { channelId, message } = data;
      socket.to(`channel:${channelId}`).emit('message:new', message);
    });

    // Message edited
    socket.on('message:edit', (data) => {
      const { channelId, message } = data;
      socket.to(`channel:${channelId}`).emit('message:edited', message);
    });

    // Message deleted
    socket.on('message:delete', (data) => {
      const { channelId, messageId } = data;
      socket.to(`channel:${channelId}`).emit('message:deleted', { channelId, messageId });
    });

    // Reaction added/removed
    socket.on('message:reaction', (data) => {
      const { channelId, messageId, emoji, action, userId } = data;
      socket.to(`channel:${channelId}`).emit('message:reaction', { channelId, messageId, emoji, action, userId });
    });

    // ============ TYPING INDICATORS ============

    socket.on('typing:start', (data) => {
      const { channelId } = data;
      socket.to(`channel:${channelId}`).emit('typing:start', {
        channelId,
        user: {
          id: user.id,
          displayName: user.display_name,
          username: user.username
        }
      });
    });

    socket.on('typing:stop', (data) => {
      const { channelId } = data;
      socket.to(`channel:${channelId}`).emit('typing:stop', {
        channelId,
        userId: user.id
      });
    });

    // ============ CHANNEL SUBSCRIPTION ============

    socket.on('channel:join', (data) => {
      const { channelId } = data;
      socket.join(`channel:${channelId}`);
      if (!socketRooms.has(socket.id)) socketRooms.set(socket.id, new Set());
      socketRooms.get(socket.id).add(`channel:${channelId}`);
    });

    socket.on('channel:leave', (data) => {
      const { channelId } = data;
      socket.leave(`channel:${channelId}`);
      if (socketRooms.has(socket.id)) {
        socketRooms.get(socket.id).delete(`channel:${channelId}`);
      }
    });

    // ============ VOICE STATE ============

    socket.on('voice:join', async (data) => {
      const { channelId } = data;
      try {
        // Leave any existing voice channel
        await dbRun('DELETE FROM voice_state WHERE user_id = ?', user.id);
        // Join new voice channel
        await dbRun('INSERT INTO voice_state (user_id, channel_id) VALUES (?, ?)', user.id, channelId);

        const channel = await dbGet('SELECT * FROM channels WHERE id = ?', channelId);
        if (channel && channel.server_id) {
          io.to(`server:${channel.server_id}`).emit('voice:user_joined', {
            channelId,
            user: formatUser(user)
          });
        }
      } catch (err) {
        console.error('[WS] Voice join error:', err.message);
      }
    });

    socket.on('voice:leave', async (data) => {
      const { channelId } = data;
      try {
        await dbRun('DELETE FROM voice_state WHERE user_id = ? AND channel_id = ?', user.id, channelId);

        const channel = await dbGet('SELECT * FROM channels WHERE id = ?', channelId);
        if (channel && channel.server_id) {
          io.to(`server:${channel.server_id}`).emit('voice:user_left', {
            channelId,
            userId: user.id
          });
        }
      } catch (err) {
        console.error('[WS] Voice leave error:', err.message);
      }
    });

    socket.on('voice:mute', async (data) => {
      const { channelId, muted } = data;
      try {
        await dbRun('UPDATE voice_state SET muted = ? WHERE user_id = ?', muted ? true : false, user.id);

        const channel = await dbGet('SELECT * FROM channels WHERE id = ?', channelId);
        if (channel && channel.server_id) {
          io.to(`server:${channel.server_id}`).emit('voice:state_update', {
            channelId,
            userId: user.id,
            muted: !!muted
          });
        }
      } catch (err) {
        console.error('[WS] Voice mute error:', err.message);
      }
    });

    socket.on('voice:deafen', async (data) => {
      const { channelId, deafened } = data;
      try {
        await dbRun('UPDATE voice_state SET deafened = ? WHERE user_id = ?', deafened ? true : false, user.id);

        const channel = await dbGet('SELECT * FROM channels WHERE id = ?', channelId);
        if (channel && channel.server_id) {
          io.to(`server:${channel.server_id}`).emit('voice:state_update', {
            channelId,
            userId: user.id,
            deafened: !!deafened
          });
        }
      } catch (err) {
        console.error('[WS] Voice deafen error:', err.message);
      }
    });

    // ============ WEBRTC SIGNALING ============

    socket.on('voice:offer', (data) => {
      const { targetUserId, offer, channelId } = data;
      io.to(`user:${targetUserId}`).emit('voice:offer', {
        fromUserId: user.id,
        offer,
        channelId
      });
    });

    socket.on('voice:answer', (data) => {
      const { targetUserId, answer, channelId } = data;
      io.to(`user:${targetUserId}`).emit('voice:answer', {
        fromUserId: user.id,
        answer,
        channelId
      });
    });

    socket.on('voice:ice-candidate', (data) => {
      const { targetUserId, candidate, channelId } = data;
      io.to(`user:${targetUserId}`).emit('voice:ice-candidate', {
        fromUserId: user.id,
        candidate,
        channelId
      });
    });

    // Request list of users currently in a voice channel
    socket.on('voice:get-peers', async (data) => {
      const { channelId } = data;
      try {
        const peers = await dbAll(`
          SELECT vs.user_id, u.display_name, u.username, u.avatar, u.color, u.initials, vs.muted, vs.deafened
          FROM voice_state vs
          JOIN users u ON u.id = vs.user_id
          WHERE vs.channel_id = ?
        `, channelId);
        socket.emit('voice:peers', { channelId, peers });
      } catch (err) {
        console.error('[WS] Get peers error:', err.message);
      }
    });

    // ============ PRESENCE ============

    socket.on('presence:update', async (data) => {
      const { status } = data;
      if (['online', 'idle', 'dnd', 'invisible'].includes(status)) {
        try {
          await dbRun('UPDATE users SET status = ? WHERE id = ?', status, user.id);
          broadcastPresence(io, user.id, status);
        } catch (err) {
          console.error('[WS] Presence update error:', err.message);
        }
      }
    });

    // ============ FRIEND EVENTS ============

    socket.on('friend:request', (data) => {
      const { targetUserId } = data;
      io.to(`user:${targetUserId}`).emit('friend:request_received', {
        from: formatUser(user)
      });
    });

    socket.on('friend:accept', (data) => {
      const { targetUserId } = data;
      io.to(`user:${targetUserId}`).emit('friend:request_accepted', {
        by: formatUser(user)
      });
    });

    // ============ SERVER EVENTS ============

    socket.on('server:join', (data) => {
      const { serverId } = data;
      socket.join(`server:${serverId}`);
      // Notify server members
      socket.to(`server:${serverId}`).emit('server:member_joined', {
        serverId,
        user: formatUser(user)
      });
    });

    socket.on('server:leave', (data) => {
      const { serverId } = data;
      socket.leave(`server:${serverId}`);
      socket.to(`server:${serverId}`).emit('server:member_left', {
        serverId,
        userId: user.id
      });
    });

    // ============ DISCONNECT ============

    socket.on('disconnect', async (reason) => {
      console.log(`[WS] User disconnected: ${user.display_name} (${user.id}) - ${reason}`);

      // Remove socket from tracking
      if (onlineUsers.has(user.id)) {
        onlineUsers.get(user.id).delete(socket.id);
        if (onlineUsers.get(user.id).size === 0) {
          onlineUsers.delete(user.id);

          // User fully offline - update status
          try {
            const currentUser = await dbGet('SELECT status FROM users WHERE id = ?', user.id);
            if (currentUser && currentUser.status !== 'invisible') {
              await dbRun('UPDATE users SET status = ? WHERE id = ?', 'offline', user.id);
            }
            // Clean up voice state
            await dbRun('DELETE FROM voice_state WHERE user_id = ?', user.id);
            // Broadcast offline
            broadcastPresence(io, user.id, 'offline');
          } catch (err) {
            console.error('[WS] Disconnect cleanup error:', err.message);
          }
        }
      }

      // Clean up room tracking
      socketRooms.delete(socket.id);
    });

    // Send initial data to the connected client
    socket.emit('ready', {
      user: formatUser(user),
      onlineUsers: Array.from(onlineUsers.keys())
    });
  });

  console.log('[WS] WebSocket handler initialized');
}

async function broadcastPresence(io, userId, status) {
  // Broadcast to all servers the user is in
  try {
    const userServers = await dbAll('SELECT server_id FROM server_members WHERE user_id = ?', userId);
    for (const srv of userServers) {
      io.to(`server:${srv.server_id}`).emit('presence:update', {
        userId,
        status
      });
    }
    // Also broadcast to DM partners
    const dmPartners = await dbAll(`
      SELECT dp2.user_id FROM dm_participants dp1
      JOIN dm_participants dp2 ON dp2.channel_id = dp1.channel_id AND dp2.user_id != dp1.user_id
      WHERE dp1.user_id = ?
    `, userId);
    for (const partner of dmPartners) {
      io.to(`user:${partner.user_id}`).emit('presence:update', {
        userId,
        status
      });
    }
  } catch (err) {
    console.error('[WS] Broadcast presence error:', err.message);
  }
}

function getOnlineUsers() {
  return Array.from(onlineUsers.keys());
}

module.exports = { initializeWebSocket, getOnlineUsers };