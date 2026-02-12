// ============================================
// NEXUS CHAT - Message Routes
// ============================================

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { dbGet, dbAll, dbRun, isPostgres } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// ============ GET /api/channels/:id/messages ============
router.get('/channels/:id/messages', requireAuth, async (req, res) => {
  try {
    const channelId = req.params.id;
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const before = req.query.before;

    const channel = await dbGet('SELECT * FROM channels WHERE id = ?', channelId);
    if (!channel) return res.status(404).json({ success: false, error: 'Channel not found' });

    if (channel.is_dm) {
      const participant = await dbGet('SELECT * FROM dm_participants WHERE channel_id = ? AND user_id = ?', channelId, req.user.id);
      if (!participant) return res.status(403).json({ success: false, error: 'Not a participant in this DM' });
    } else if (channel.server_id) {
      const membership = await dbGet('SELECT * FROM server_members WHERE server_id = ? AND user_id = ?', channel.server_id, req.user.id);
      if (!membership) return res.status(403).json({ success: false, error: 'Not a member of this server' });
    }

    // Use FALSE for postgres, 0 for sqlite
    const deletedFalse = isPostgres() ? 'FALSE' : '0';

    let messages;
    if (before) {
      messages = await dbAll(`
        SELECT m.*, u.display_name, u.username, u.discriminator, u.avatar, u.avatar_emoji,
               u.color, u.initials, u.status
        FROM messages m
        JOIN users u ON u.id = m.user_id
        WHERE m.channel_id = ? AND m.deleted = ${deletedFalse} AND m.created_at < (SELECT created_at FROM messages WHERE id = ?)
        ORDER BY m.created_at DESC
        LIMIT ?
      `, channelId, before, limit);
    } else {
      messages = await dbAll(`
        SELECT m.*, u.display_name, u.username, u.discriminator, u.avatar, u.avatar_emoji,
               u.color, u.initials, u.status
        FROM messages m
        JOIN users u ON u.id = m.user_id
        WHERE m.channel_id = ? AND m.deleted = ${deletedFalse}
        ORDER BY m.created_at DESC
        LIMIT ?
      `, channelId, limit);
    }

    messages.reverse();

    // Get reactions
    const messageIds = messages.map(m => m.id);
    let reactions = [];
    if (messageIds.length > 0) {
      const placeholders = messageIds.map((_, i) => isPostgres() ? `$${i + 1}` : '?').join(',');
      if (isPostgres()) {
        const { getRawDB } = require('../db');
        const result = await getRawDB().query(
          `SELECT r.message_id, r.emoji, r.user_id FROM reactions r WHERE r.message_id IN (${placeholders}) ORDER BY r.created_at ASC`,
          messageIds
        );
        reactions = result.rows;
      } else {
        const Database = require('better-sqlite3');
        const path = require('path');
        const db = require('../db').getRawDB();
        reactions = db.prepare(
          `SELECT r.message_id, r.emoji, r.user_id FROM reactions r WHERE r.message_id IN (${placeholders}) ORDER BY r.created_at ASC`
        ).all(...messageIds);
      }
    }

    const reactionsByMessage = {};
    for (const r of reactions) {
      if (!reactionsByMessage[r.message_id]) reactionsByMessage[r.message_id] = {};
      if (!reactionsByMessage[r.message_id][r.emoji]) {
        reactionsByMessage[r.message_id][r.emoji] = { emoji: r.emoji, count: 0, users: [], active: false };
      }
      reactionsByMessage[r.message_id][r.emoji].count++;
      reactionsByMessage[r.message_id][r.emoji].users.push(r.user_id);
      if (r.user_id === req.user.id) reactionsByMessage[r.message_id][r.emoji].active = true;
    }

    res.json({
      success: true,
      messages: messages.map(m => formatMessage(m, reactionsByMessage[m.id] || {})),
      hasMore: messages.length === limit
    });
  } catch (err) {
    console.error('[Messages] Get error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ============ POST /api/channels/:id/messages ============
router.post('/channels/:id/messages', requireAuth, async (req, res) => {
  try {
    const channelId = req.params.id;
    const { content, type } = req.body;

    if (!content || content.trim().length === 0) return res.status(400).json({ success: false, error: 'Message content is required' });
    if (content.length > 4000) return res.status(400).json({ success: false, error: 'Message too long (max 4000 characters)' });

    const channel = await dbGet('SELECT * FROM channels WHERE id = ?', channelId);
    if (!channel) return res.status(404).json({ success: false, error: 'Channel not found' });

    if (channel.is_dm) {
      const participant = await dbGet('SELECT * FROM dm_participants WHERE channel_id = ? AND user_id = ?', channelId, req.user.id);
      if (!participant) return res.status(403).json({ success: false, error: 'Not a participant in this DM' });
    } else if (channel.server_id) {
      const membership = await dbGet('SELECT * FROM server_members WHERE server_id = ? AND user_id = ?', channel.server_id, req.user.id);
      if (!membership) return res.status(403).json({ success: false, error: 'Not a member of this server' });
    }

    const messageId = 'msg-' + uuidv4().slice(0, 12);
    const now = new Date().toISOString();

    await dbRun('INSERT INTO messages (id, channel_id, user_id, content, type, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      messageId, channelId, req.user.id, content.trim(), type || 'text', now);

    const message = await dbGet(`
      SELECT m.*, u.display_name, u.username, u.discriminator, u.avatar, u.avatar_emoji,
             u.color, u.initials, u.status
      FROM messages m JOIN users u ON u.id = m.user_id WHERE m.id = ?
    `, messageId);

    res.status(201).json({ success: true, message: formatMessage(message, {}) });
  } catch (err) {
    console.error('[Messages] Send error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ============ PATCH /api/messages/:id ============
router.patch('/messages/:id', requireAuth, async (req, res) => {
  try {
    const messageId = req.params.id;
    const { content } = req.body;
    if (!content || content.trim().length === 0) return res.status(400).json({ success: false, error: 'Message content is required' });

    const deletedFalse = isPostgres() ? 'FALSE' : '0';
    const message = await dbGet(`SELECT * FROM messages WHERE id = ? AND deleted = ${deletedFalse}`, messageId);
    if (!message) return res.status(404).json({ success: false, error: 'Message not found' });
    if (message.user_id !== req.user.id) return res.status(403).json({ success: false, error: 'Can only edit your own messages' });

    const now = new Date().toISOString();
    await dbRun('UPDATE messages SET content = ?, edited_at = ? WHERE id = ?', content.trim(), now, messageId);

    const updated = await dbGet(`
      SELECT m.*, u.display_name, u.username, u.discriminator, u.avatar, u.avatar_emoji,
             u.color, u.initials, u.status
      FROM messages m JOIN users u ON u.id = m.user_id WHERE m.id = ?
    `, messageId);

    res.json({ success: true, message: formatMessage(updated, {}) });
  } catch (err) {
    console.error('[Messages] Edit error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ============ DELETE /api/messages/:id ============
router.delete('/messages/:id', requireAuth, async (req, res) => {
  try {
    const messageId = req.params.id;
    const deletedFalse = isPostgres() ? 'FALSE' : '0';
    const deletedTrue = isPostgres() ? 'TRUE' : '1';

    const message = await dbGet(`SELECT * FROM messages WHERE id = ? AND deleted = ${deletedFalse}`, messageId);
    if (!message) return res.status(404).json({ success: false, error: 'Message not found' });

    if (message.user_id !== req.user.id) {
      const channel = await dbGet('SELECT * FROM channels WHERE id = ?', message.channel_id);
      if (channel && channel.server_id) {
        const server = await dbGet('SELECT * FROM servers WHERE id = ?', channel.server_id);
        const isAdmin = await dbGet(`
          SELECT r.id FROM member_roles mr JOIN roles r ON r.id = mr.role_id
          WHERE mr.server_id = ? AND mr.user_id = ? AND r.name IN ('Admin', 'Moderator')
        `, channel.server_id, req.user.id);
        if (server.owner_id !== req.user.id && !isAdmin) {
          return res.status(403).json({ success: false, error: 'Insufficient permissions' });
        }
      } else {
        return res.status(403).json({ success: false, error: 'Can only delete your own messages' });
      }
    }

    await dbRun(`UPDATE messages SET deleted = ${deletedTrue} WHERE id = ?`, messageId);
    res.json({ success: true, messageId });
  } catch (err) {
    console.error('[Messages] Delete error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ============ POST /api/messages/:id/reactions ============
router.post('/messages/:id/reactions', requireAuth, async (req, res) => {
  try {
    const messageId = req.params.id;
    const { emoji } = req.body;
    if (!emoji) return res.status(400).json({ success: false, error: 'Emoji is required' });

    const deletedFalse = isPostgres() ? 'FALSE' : '0';
    const message = await dbGet(`SELECT * FROM messages WHERE id = ? AND deleted = ${deletedFalse}`, messageId);
    if (!message) return res.status(404).json({ success: false, error: 'Message not found' });

    const existing = await dbGet('SELECT * FROM reactions WHERE message_id = ? AND user_id = ? AND emoji = ?', messageId, req.user.id, emoji);
    if (existing) {
      await dbRun('DELETE FROM reactions WHERE id = ?', existing.id);
      return res.json({ success: true, action: 'removed' });
    }

    const reactionId = 'react-' + uuidv4().slice(0, 8);
    await dbRun('INSERT INTO reactions (id, message_id, user_id, emoji) VALUES (?, ?, ?, ?)', reactionId, messageId, req.user.id, emoji);
    res.status(201).json({ success: true, action: 'added', reactionId });
  } catch (err) {
    console.error('[Messages] Reaction error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ============ DELETE /api/messages/:id/reactions/:emoji ============
router.delete('/messages/:id/reactions/:emoji', requireAuth, async (req, res) => {
  try {
    const emoji = decodeURIComponent(req.params.emoji);
    await dbRun('DELETE FROM reactions WHERE message_id = ? AND user_id = ? AND emoji = ?', req.params.id, req.user.id, emoji);
    res.json({ success: true });
  } catch (err) {
    console.error('[Messages] Remove reaction error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

function formatMessage(m, reactionsMap) {
  return {
    id: m.id, channelId: m.channel_id, userId: m.user_id, content: m.content,
    type: m.type, editedAt: m.edited_at, createdAt: m.created_at, timestamp: m.created_at,
    reactions: Object.values(reactionsMap).map(r => ({ emoji: r.emoji, count: r.count, active: r.active, users: r.users })),
    user: {
      id: m.user_id, displayName: m.display_name, username: m.username, discriminator: m.discriminator,
      tag: m.username + '#' + m.discriminator, avatar: m.avatar, avatarEmoji: m.avatar_emoji,
      color: m.color, initials: m.initials, status: m.status,
    }
  };
}

module.exports = router;
module.exports.formatMessage = formatMessage;