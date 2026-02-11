// ============================================
// NEXUS CHAT - Friends & DM Routes
// ============================================

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../database');
const { requireAuth } = require('../middleware/auth');
const { formatUser } = require('./auth');

const router = express.Router();

// ============ GET /api/friends ============
// List all friends, pending requests, blocked
router.get('/', requireAuth, (req, res) => {
  try {
    const db = getDB();
    const userId = req.user.id;

    // Accepted friends
    const friends = db.prepare(`
      SELECT u.id, u.display_name, u.username, u.discriminator, u.avatar, u.avatar_emoji,
             u.color, u.initials, u.status, u.custom_status, u.about,
             f.created_at as friends_since
      FROM friendships f
      JOIN users u ON u.id = f.friend_id
      WHERE f.user_id = ? AND f.status = 'accepted'
      ORDER BY u.display_name ASC
    `).all(userId);

    // Incoming requests (someone sent to me)
    const incoming = db.prepare(`
      SELECT u.id, u.display_name, u.username, u.discriminator, u.avatar, u.avatar_emoji,
             u.color, u.initials, u.status, u.about,
             f.id as request_id, f.created_at as requested_at
      FROM friendships f
      JOIN users u ON u.id = f.user_id
      WHERE f.friend_id = ? AND f.status = 'pending'
      ORDER BY f.created_at DESC
    `).all(userId);

    // Outgoing requests (I sent to someone)
    const outgoing = db.prepare(`
      SELECT u.id, u.display_name, u.username, u.discriminator, u.avatar, u.avatar_emoji,
             u.color, u.initials, u.status, u.about,
             f.id as request_id, f.created_at as requested_at
      FROM friendships f
      JOIN users u ON u.id = f.friend_id
      WHERE f.user_id = ? AND f.status = 'pending'
      ORDER BY f.created_at DESC
    `).all(userId);

    // Blocked users
    const blocked = db.prepare(`
      SELECT u.id, u.display_name, u.username, u.discriminator, u.avatar, u.avatar_emoji,
             u.color, u.initials,
             f.id as block_id, f.created_at as blocked_at
      FROM friendships f
      JOIN users u ON u.id = f.friend_id
      WHERE f.user_id = ? AND f.status = 'blocked'
      ORDER BY f.created_at DESC
    `).all(userId);

    res.json({
      success: true,
      friends: friends.map(f => ({
        ...formatUser(f),
        friendsSince: f.friends_since
      })),
      incoming: incoming.map(f => ({
        ...formatUser(f),
        requestId: f.request_id,
        requestedAt: f.requested_at
      })),
      outgoing: outgoing.map(f => ({
        ...formatUser(f),
        requestId: f.request_id,
        requestedAt: f.requested_at
      })),
      blocked: blocked.map(f => ({
        ...formatUser(f),
        blockId: f.block_id,
        blockedAt: f.blocked_at
      }))
    });
  } catch (err) {
    console.error('[Friends] List error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ============ POST /api/friends/request ============
// Send a friend request (by tag like "username#1234" or by userId)
router.post('/request', requireAuth, (req, res) => {
  try {
    const db = getDB();
    const userId = req.user.id;
    const { tag, targetUserId } = req.body;

    let targetUser;

    if (targetUserId) {
      targetUser = db.prepare('SELECT * FROM users WHERE id = ?').get(targetUserId);
    } else if (tag) {
      // Parse tag: "username#1234"
      const parts = tag.split('#');
      if (parts.length === 2) {
        targetUser = db.prepare('SELECT * FROM users WHERE username = ? AND discriminator = ?').get(parts[0].toLowerCase(), parts[1]);
      }
      if (!targetUser) {
        // Try just username
        targetUser = db.prepare('SELECT * FROM users WHERE username = ?').get(tag.toLowerCase().replace(/#.*$/, ''));
      }
    }

    if (!targetUser) {
      return res.status(404).json({ success: false, error: 'User not found. Make sure the tag is correct (e.g., username#1234).' });
    }

    if (targetUser.id === userId) {
      return res.status(400).json({ success: false, error: 'You cannot add yourself as a friend' });
    }

    // Check if already friends
    const existing = db.prepare('SELECT * FROM friendships WHERE user_id = ? AND friend_id = ?').get(userId, targetUser.id);
    if (existing) {
      if (existing.status === 'accepted') {
        return res.status(409).json({ success: false, error: 'Already friends with this user' });
      }
      if (existing.status === 'pending') {
        return res.status(409).json({ success: false, error: 'Friend request already sent' });
      }
      if (existing.status === 'blocked') {
        return res.status(400).json({ success: false, error: 'You have blocked this user. Unblock them first.' });
      }
    }

    // Check if they sent us a request - auto-accept
    const reverseRequest = db.prepare('SELECT * FROM friendships WHERE user_id = ? AND friend_id = ? AND status = ?').get(targetUser.id, userId, 'pending');
    if (reverseRequest) {
      // Auto-accept both directions
      db.prepare('UPDATE friendships SET status = ? WHERE id = ?').run('accepted', reverseRequest.id);
      db.prepare('INSERT INTO friendships (id, user_id, friend_id, status) VALUES (?, ?, ?, ?)').run(
        'fr-' + uuidv4().slice(0, 8), userId, targetUser.id, 'accepted'
      );
      return res.json({ success: true, status: 'accepted', message: 'Friend request accepted!' });
    }

    // Check if they blocked us
    const blockedByTarget = db.prepare('SELECT * FROM friendships WHERE user_id = ? AND friend_id = ? AND status = ?').get(targetUser.id, userId, 'blocked');
    if (blockedByTarget) {
      // Don't reveal they blocked us, just say request sent
      return res.json({ success: true, status: 'pending', message: 'Friend request sent!' });
    }

    // Create pending request
    db.prepare('INSERT INTO friendships (id, user_id, friend_id, status) VALUES (?, ?, ?, ?)').run(
      'fr-' + uuidv4().slice(0, 8), userId, targetUser.id, 'pending'
    );

    res.json({
      success: true,
      status: 'pending',
      message: `Friend request sent to ${targetUser.display_name}!`,
      targetUser: formatUser(targetUser)
    });
  } catch (err) {
    console.error('[Friends] Request error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ============ POST /api/friends/accept/:id ============
// Accept a friend request (id = userId of requester)
router.post('/accept/:id', requireAuth, (req, res) => {
  try {
    const db = getDB();
    const userId = req.user.id;
    const requesterId = req.params.id;

    // Find the pending request from requester to me
    const request = db.prepare('SELECT * FROM friendships WHERE user_id = ? AND friend_id = ? AND status = ?').get(requesterId, userId, 'pending');
    if (!request) {
      return res.status(404).json({ success: false, error: 'No pending friend request from this user' });
    }

    const acceptTransaction = db.transaction(() => {
      // Update their request to accepted
      db.prepare('UPDATE friendships SET status = ? WHERE id = ?').run('accepted', request.id);
      // Create reverse friendship
      db.prepare('INSERT OR REPLACE INTO friendships (id, user_id, friend_id, status) VALUES (?, ?, ?, ?)').run(
        'fr-' + uuidv4().slice(0, 8), userId, requesterId, 'accepted'
      );
    });

    acceptTransaction();

    res.json({ success: true, message: 'Friend request accepted!' });
  } catch (err) {
    console.error('[Friends] Accept error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ============ POST /api/friends/decline/:id ============
// Decline a friend request
router.post('/decline/:id', requireAuth, (req, res) => {
  try {
    const db = getDB();
    const userId = req.user.id;
    const requesterId = req.params.id;

    const request = db.prepare('SELECT * FROM friendships WHERE user_id = ? AND friend_id = ? AND status = ?').get(requesterId, userId, 'pending');
    if (!request) {
      return res.status(404).json({ success: false, error: 'No pending friend request from this user' });
    }

    db.prepare('DELETE FROM friendships WHERE id = ?').run(request.id);
    res.json({ success: true });
  } catch (err) {
    console.error('[Friends] Decline error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ============ DELETE /api/friends/:id ============
// Remove a friend
router.delete('/:id', requireAuth, (req, res) => {
  try {
    const db = getDB();
    const userId = req.user.id;
    const friendId = req.params.id;

    db.prepare('DELETE FROM friendships WHERE user_id = ? AND friend_id = ? AND status = ?').run(userId, friendId, 'accepted');
    db.prepare('DELETE FROM friendships WHERE user_id = ? AND friend_id = ? AND status = ?').run(friendId, userId, 'accepted');

    res.json({ success: true });
  } catch (err) {
    console.error('[Friends] Remove error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ============ POST /api/friends/block/:id ============
// Block a user
router.post('/block/:id', requireAuth, (req, res) => {
  try {
    const db = getDB();
    const userId = req.user.id;
    const targetId = req.params.id;

    if (targetId === userId) {
      return res.status(400).json({ success: false, error: 'Cannot block yourself' });
    }

    const blockTransaction = db.transaction(() => {
      // Remove any existing friendship
      db.prepare('DELETE FROM friendships WHERE user_id = ? AND friend_id = ?').run(userId, targetId);
      db.prepare('DELETE FROM friendships WHERE user_id = ? AND friend_id = ?').run(targetId, userId);

      // Create block entry
      db.prepare('INSERT INTO friendships (id, user_id, friend_id, status) VALUES (?, ?, ?, ?)').run(
        'fr-' + uuidv4().slice(0, 8), userId, targetId, 'blocked'
      );
    });

    blockTransaction();
    res.json({ success: true });
  } catch (err) {
    console.error('[Friends] Block error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ============ DELETE /api/friends/block/:id ============
// Unblock a user
router.delete('/block/:id', requireAuth, (req, res) => {
  try {
    const db = getDB();
    db.prepare('DELETE FROM friendships WHERE user_id = ? AND friend_id = ? AND status = ?').run(req.user.id, req.params.id, 'blocked');
    res.json({ success: true });
  } catch (err) {
    console.error('[Friends] Unblock error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ============ GET /api/dms ============
// List DM channels for current user
router.get('/dms', requireAuth, (req, res) => {
  try {
    const db = getDB();
    const userId = req.user.id;

    const dmChannels = db.prepare(`
      SELECT c.id, c.name, c.created_at,
             dp2.user_id as other_user_id
      FROM dm_participants dp
      JOIN channels c ON c.id = dp.channel_id
      JOIN dm_participants dp2 ON dp2.channel_id = c.id AND dp2.user_id != ?
      WHERE dp.user_id = ? AND c.is_dm = 1
    `).all(userId, userId);

    // Get other user info and last message for each DM
    const result = dmChannels.map(dm => {
      const otherUser = db.prepare(`
        SELECT id, display_name, username, discriminator, avatar, avatar_emoji, color, initials, status, custom_status, about
        FROM users WHERE id = ?
      `).get(dm.other_user_id);

      const lastMessage = db.prepare(`
        SELECT m.content, m.created_at, u.display_name as sender_name
        FROM messages m
        JOIN users u ON u.id = m.user_id
        WHERE m.channel_id = ? AND m.deleted = 0
        ORDER BY m.created_at DESC
        LIMIT 1
      `).get(dm.id);

      return {
        id: dm.id,
        user: otherUser ? formatUser(otherUser) : null,
        lastMessage: lastMessage ? {
          content: lastMessage.content,
          senderName: lastMessage.sender_name,
          createdAt: lastMessage.created_at
        } : null,
        createdAt: dm.created_at
      };
    });

    res.json({ success: true, dms: result });
  } catch (err) {
    console.error('[DMs] List error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ============ POST /api/dms ============
// Create or get existing DM channel with a user
router.post('/dms', requireAuth, (req, res) => {
  try {
    const db = getDB();
    const userId = req.user.id;
    const { targetUserId } = req.body;

    if (!targetUserId) {
      return res.status(400).json({ success: false, error: 'targetUserId is required' });
    }

    if (targetUserId === userId) {
      return res.status(400).json({ success: false, error: 'Cannot DM yourself' });
    }

    const targetUser = db.prepare('SELECT * FROM users WHERE id = ?').get(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Check if DM channel already exists between these two users
    const existingDM = db.prepare(`
      SELECT dp1.channel_id
      FROM dm_participants dp1
      JOIN dm_participants dp2 ON dp2.channel_id = dp1.channel_id
      WHERE dp1.user_id = ? AND dp2.user_id = ?
    `).get(userId, targetUserId);

    if (existingDM) {
      const channel = db.prepare('SELECT * FROM channels WHERE id = ?').get(existingDM.channel_id);
      return res.json({
        success: true,
        channel: {
          id: channel.id,
          user: formatUser(targetUser),
          createdAt: channel.created_at
        },
        existing: true
      });
    }

    // Create new DM channel
    const channelId = 'dm-' + uuidv4().slice(0, 12);
    const dmName = `${req.user.display_name} & ${targetUser.display_name}`;

    const createDM = db.transaction(() => {
      db.prepare(`
        INSERT INTO channels (id, name, type, is_dm, created_at)
        VALUES (?, ?, 'dm', 1, ?)
      `).run(channelId, dmName, new Date().toISOString());

      db.prepare('INSERT INTO dm_participants (channel_id, user_id) VALUES (?, ?)').run(channelId, userId);
      db.prepare('INSERT INTO dm_participants (channel_id, user_id) VALUES (?, ?)').run(channelId, targetUserId);
    });

    createDM();

    res.status(201).json({
      success: true,
      channel: {
        id: channelId,
        user: formatUser(targetUser),
        createdAt: new Date().toISOString()
      },
      existing: false
    });
  } catch (err) {
    console.error('[DMs] Create error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;