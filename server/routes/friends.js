// ============================================
// NEXUS CHAT - Friends & DM Routes
// ============================================

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { dbGet, dbAll, dbRun, isPostgres } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { formatUser } = require('./auth');

const router = express.Router();

// ============ GET /api/friends ============
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    const friends = await dbAll(`
      SELECT u.id, u.display_name, u.username, u.discriminator, u.avatar, u.avatar_emoji,
             u.color, u.initials, u.status, u.custom_status, u.about, f.created_at as friends_since
      FROM friendships f JOIN users u ON u.id = f.friend_id
      WHERE f.user_id = ? AND f.status = 'accepted' ORDER BY u.display_name ASC
    `, userId);

    const incoming = await dbAll(`
      SELECT u.id, u.display_name, u.username, u.discriminator, u.avatar, u.avatar_emoji,
             u.color, u.initials, u.status, u.about, f.id as request_id, f.created_at as requested_at
      FROM friendships f JOIN users u ON u.id = f.user_id
      WHERE f.friend_id = ? AND f.status = 'pending' ORDER BY f.created_at DESC
    `, userId);

    const outgoing = await dbAll(`
      SELECT u.id, u.display_name, u.username, u.discriminator, u.avatar, u.avatar_emoji,
             u.color, u.initials, u.status, u.about, f.id as request_id, f.created_at as requested_at
      FROM friendships f JOIN users u ON u.id = f.friend_id
      WHERE f.user_id = ? AND f.status = 'pending' ORDER BY f.created_at DESC
    `, userId);

    const blocked = await dbAll(`
      SELECT u.id, u.display_name, u.username, u.discriminator, u.avatar, u.avatar_emoji,
             u.color, u.initials, f.id as block_id, f.created_at as blocked_at
      FROM friendships f JOIN users u ON u.id = f.friend_id
      WHERE f.user_id = ? AND f.status = 'blocked' ORDER BY f.created_at DESC
    `, userId);

    res.json({
      success: true,
      friends: friends.map(f => ({ ...formatUser(f), friendsSince: f.friends_since })),
      incoming: incoming.map(f => ({ ...formatUser(f), requestId: f.request_id, requestedAt: f.requested_at })),
      outgoing: outgoing.map(f => ({ ...formatUser(f), requestId: f.request_id, requestedAt: f.requested_at })),
      blocked: blocked.map(f => ({ ...formatUser(f), blockId: f.block_id, blockedAt: f.blocked_at }))
    });
  } catch (err) {
    console.error('[Friends] List error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ============ POST /api/friends/request ============
router.post('/request', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { tag, targetUserId } = req.body;
    let targetUser;

    if (targetUserId) {
      targetUser = await dbGet('SELECT * FROM users WHERE id = ?', targetUserId);
    } else if (tag) {
      const parts = tag.split('#');
      if (parts.length === 2) {
        targetUser = await dbGet('SELECT * FROM users WHERE username = ? AND discriminator = ?', parts[0].toLowerCase(), parts[1]);
      }
      if (!targetUser) {
        targetUser = await dbGet('SELECT * FROM users WHERE username = ?', tag.toLowerCase().replace(/#.*$/, ''));
      }
    }

    if (!targetUser) return res.status(404).json({ success: false, error: 'User not found. Make sure the tag is correct (e.g., username#1234).' });
    if (targetUser.id === userId) return res.status(400).json({ success: false, error: 'You cannot add yourself as a friend' });

    const existing = await dbGet('SELECT * FROM friendships WHERE user_id = ? AND friend_id = ?', userId, targetUser.id);
    if (existing) {
      if (existing.status === 'accepted') return res.status(409).json({ success: false, error: 'Already friends with this user' });
      if (existing.status === 'pending') return res.status(409).json({ success: false, error: 'Friend request already sent' });
      if (existing.status === 'blocked') return res.status(400).json({ success: false, error: 'You have blocked this user. Unblock them first.' });
    }

    const reverseRequest = await dbGet('SELECT * FROM friendships WHERE user_id = ? AND friend_id = ? AND status = ?', targetUser.id, userId, 'pending');
    if (reverseRequest) {
      await dbRun('UPDATE friendships SET status = ? WHERE id = ?', 'accepted', reverseRequest.id);
      await dbRun('INSERT INTO friendships (id, user_id, friend_id, status) VALUES (?, ?, ?, ?)',
        'fr-' + uuidv4().slice(0, 8), userId, targetUser.id, 'accepted');
      return res.json({ success: true, status: 'accepted', message: 'Friend request accepted!' });
    }

    const blockedByTarget = await dbGet('SELECT * FROM friendships WHERE user_id = ? AND friend_id = ? AND status = ?', targetUser.id, userId, 'blocked');
    if (blockedByTarget) return res.json({ success: true, status: 'pending', message: 'Friend request sent!' });

    await dbRun('INSERT INTO friendships (id, user_id, friend_id, status) VALUES (?, ?, ?, ?)',
      'fr-' + uuidv4().slice(0, 8), userId, targetUser.id, 'pending');

    res.json({ success: true, status: 'pending', message: `Friend request sent to ${targetUser.display_name}!`, targetUser: formatUser(targetUser) });
  } catch (err) {
    console.error('[Friends] Request error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ============ POST /api/friends/accept/:id ============
router.post('/accept/:id', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const requesterId = req.params.id;

    const request = await dbGet('SELECT * FROM friendships WHERE user_id = ? AND friend_id = ? AND status = ?', requesterId, userId, 'pending');
    if (!request) return res.status(404).json({ success: false, error: 'No pending friend request from this user' });

    await dbRun('UPDATE friendships SET status = ? WHERE id = ?', 'accepted', request.id);
    await dbRun('INSERT INTO friendships (id, user_id, friend_id, status) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING',
      'fr-' + uuidv4().slice(0, 8), userId, requesterId, 'accepted');

    res.json({ success: true, message: 'Friend request accepted!' });
  } catch (err) {
    console.error('[Friends] Accept error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ============ POST /api/friends/decline/:id ============
router.post('/decline/:id', requireAuth, async (req, res) => {
  try {
    const request = await dbGet('SELECT * FROM friendships WHERE user_id = ? AND friend_id = ? AND status = ?', req.params.id, req.user.id, 'pending');
    if (!request) return res.status(404).json({ success: false, error: 'No pending friend request from this user' });
    await dbRun('DELETE FROM friendships WHERE id = ?', request.id);
    res.json({ success: true });
  } catch (err) {
    console.error('[Friends] Decline error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ============ DELETE /api/friends/:id ============
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    await dbRun('DELETE FROM friendships WHERE user_id = ? AND friend_id = ? AND status = ?', req.user.id, req.params.id, 'accepted');
    await dbRun('DELETE FROM friendships WHERE user_id = ? AND friend_id = ? AND status = ?', req.params.id, req.user.id, 'accepted');
    res.json({ success: true });
  } catch (err) {
    console.error('[Friends] Remove error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ============ POST /api/friends/block/:id ============
router.post('/block/:id', requireAuth, async (req, res) => {
  try {
    const targetId = req.params.id;
    if (targetId === req.user.id) return res.status(400).json({ success: false, error: 'Cannot block yourself' });

    await dbRun('DELETE FROM friendships WHERE user_id = ? AND friend_id = ?', req.user.id, targetId);
    await dbRun('DELETE FROM friendships WHERE user_id = ? AND friend_id = ?', targetId, req.user.id);
    await dbRun('INSERT INTO friendships (id, user_id, friend_id, status) VALUES (?, ?, ?, ?)',
      'fr-' + uuidv4().slice(0, 8), req.user.id, targetId, 'blocked');

    res.json({ success: true });
  } catch (err) {
    console.error('[Friends] Block error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ============ DELETE /api/friends/block/:id ============
router.delete('/block/:id', requireAuth, async (req, res) => {
  try {
    await dbRun('DELETE FROM friendships WHERE user_id = ? AND friend_id = ? AND status = ?', req.user.id, req.params.id, 'blocked');
    res.json({ success: true });
  } catch (err) {
    console.error('[Friends] Unblock error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ============ GET /api/dms ============
router.get('/dms', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const isDmTrue = isPostgres() ? 'TRUE' : '1';

    const dmChannels = await dbAll(`
      SELECT c.id, c.name, c.created_at, dp2.user_id as other_user_id
      FROM dm_participants dp
      JOIN channels c ON c.id = dp.channel_id
      JOIN dm_participants dp2 ON dp2.channel_id = c.id AND dp2.user_id != ?
      WHERE dp.user_id = ? AND c.is_dm = ${isDmTrue}
    `, userId, userId);

    const result = [];
    for (const dm of dmChannels) {
      const otherUser = await dbGet(
        'SELECT id, display_name, username, discriminator, avatar, avatar_emoji, color, initials, status, custom_status, about FROM users WHERE id = ?',
        dm.other_user_id
      );

      const deletedFalse = isPostgres() ? 'FALSE' : '0';
      const lastMessage = await dbGet(`
        SELECT m.content, m.created_at, u.display_name as sender_name
        FROM messages m JOIN users u ON u.id = m.user_id
        WHERE m.channel_id = ? AND m.deleted = ${deletedFalse}
        ORDER BY m.created_at DESC LIMIT 1
      `, dm.id);

      result.push({
        id: dm.id,
        user: otherUser ? formatUser(otherUser) : null,
        lastMessage: lastMessage ? { content: lastMessage.content, senderName: lastMessage.sender_name, createdAt: lastMessage.created_at } : null,
        createdAt: dm.created_at
      });
    }

    res.json({ success: true, dms: result });
  } catch (err) {
    console.error('[DMs] List error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ============ POST /api/dms ============
router.post('/dms', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { targetUserId } = req.body;
    if (!targetUserId) return res.status(400).json({ success: false, error: 'targetUserId is required' });
    if (targetUserId === userId) return res.status(400).json({ success: false, error: 'Cannot DM yourself' });

    const targetUser = await dbGet('SELECT * FROM users WHERE id = ?', targetUserId);
    if (!targetUser) return res.status(404).json({ success: false, error: 'User not found' });

    const existingDM = await dbGet(`
      SELECT dp1.channel_id FROM dm_participants dp1
      JOIN dm_participants dp2 ON dp2.channel_id = dp1.channel_id
      WHERE dp1.user_id = ? AND dp2.user_id = ?
    `, userId, targetUserId);

    if (existingDM) {
      const channel = await dbGet('SELECT * FROM channels WHERE id = ?', existingDM.channel_id);
      return res.json({ success: true, channel: { id: channel.id, user: formatUser(targetUser), createdAt: channel.created_at }, existing: true });
    }

    const channelId = 'dm-' + uuidv4().slice(0, 12);
    const dmName = `${req.user.display_name} & ${targetUser.display_name}`;
    const isDmTrue = isPostgres() ? 'TRUE' : '1';

    await dbRun(`INSERT INTO channels (id, name, type, is_dm, created_at) VALUES (?, ?, 'dm', ${isDmTrue}, ?)`,
      channelId, dmName, new Date().toISOString());
    await dbRun('INSERT INTO dm_participants (channel_id, user_id) VALUES (?, ?)', channelId, userId);
    await dbRun('INSERT INTO dm_participants (channel_id, user_id) VALUES (?, ?)', channelId, targetUserId);

    res.status(201).json({ success: true, channel: { id: channelId, user: formatUser(targetUser), createdAt: new Date().toISOString() }, existing: false });
  } catch (err) {
    console.error('[DMs] Create error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;