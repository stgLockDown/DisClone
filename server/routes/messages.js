// ============================================
// NEXUS CHAT - Message Routes
// ============================================

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../database');
const { requireAuth } = require('../middleware/auth');
const { formatUser } = require('./auth');

const router = express.Router();

// ============ GET /api/channels/:id/messages ============
// Get messages for a channel (paginated)
router.get('/channels/:id/messages', requireAuth, (req, res) => {
  try {
    const db = getDB();
    const channelId = req.params.id;
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const before = req.query.before; // cursor-based pagination (message ID or timestamp)

    // Verify access - check if channel is DM or user is member of server
    const channel = db.prepare('SELECT * FROM channels WHERE id = ?').get(channelId);
    if (!channel) return res.status(404).json({ success: false, error: 'Channel not found' });

    if (channel.is_dm) {
      const participant = db.prepare('SELECT * FROM dm_participants WHERE channel_id = ? AND user_id = ?').get(channelId, req.user.id);
      if (!participant) return res.status(403).json({ success: false, error: 'Not a participant in this DM' });
    } else if (channel.server_id) {
      const membership = db.prepare('SELECT * FROM server_members WHERE server_id = ? AND user_id = ?').get(channel.server_id, req.user.id);
      if (!membership) return res.status(403).json({ success: false, error: 'Not a member of this server' });
    }

    let messages;
    if (before) {
      messages = db.prepare(`
        SELECT m.*, u.display_name, u.username, u.discriminator, u.avatar, u.avatar_emoji,
               u.color, u.initials, u.status
        FROM messages m
        JOIN users u ON u.id = m.user_id
        WHERE m.channel_id = ? AND m.deleted = 0 AND m.created_at < (SELECT created_at FROM messages WHERE id = ?)
        ORDER BY m.created_at DESC
        LIMIT ?
      `).all(channelId, before, limit);
    } else {
      messages = db.prepare(`
        SELECT m.*, u.display_name, u.username, u.discriminator, u.avatar, u.avatar_emoji,
               u.color, u.initials, u.status
        FROM messages m
        JOIN users u ON u.id = m.user_id
        WHERE m.channel_id = ? AND m.deleted = 0
        ORDER BY m.created_at DESC
        LIMIT ?
      `).all(channelId, limit);
    }

    // Reverse to get chronological order
    messages.reverse();

    // Get reactions for these messages
    const messageIds = messages.map(m => m.id);
    const reactions = messageIds.length > 0
      ? db.prepare(`
          SELECT r.message_id, r.emoji, r.user_id, COUNT(*) OVER (PARTITION BY r.message_id, r.emoji) as count
          FROM reactions r
          WHERE r.message_id IN (${messageIds.map(() => '?').join(',')})
          ORDER BY r.created_at ASC
        `).all(...messageIds)
      : [];

    // Group reactions by message
    const reactionsByMessage = {};
    for (const r of reactions) {
      if (!reactionsByMessage[r.message_id]) reactionsByMessage[r.message_id] = {};
      if (!reactionsByMessage[r.message_id][r.emoji]) {
        reactionsByMessage[r.message_id][r.emoji] = { emoji: r.emoji, count: 0, users: [], active: false };
      }
      reactionsByMessage[r.message_id][r.emoji].count++;
      reactionsByMessage[r.message_id][r.emoji].users.push(r.user_id);
      if (r.user_id === req.user.id) {
        reactionsByMessage[r.message_id][r.emoji].active = true;
      }
    }

    const hasMore = messages.length === limit;

    res.json({
      success: true,
      messages: messages.map(m => formatMessage(m, reactionsByMessage[m.id] || {})),
      hasMore
    });
  } catch (err) {
    console.error('[Messages] Get error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ============ POST /api/channels/:id/messages ============
// Send a message
router.post('/channels/:id/messages', requireAuth, (req, res) => {
  try {
    const db = getDB();
    const channelId = req.params.id;
    const { content, type } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Message content is required' });
    }

    if (content.length > 4000) {
      return res.status(400).json({ success: false, error: 'Message too long (max 4000 characters)' });
    }

    // Verify access
    const channel = db.prepare('SELECT * FROM channels WHERE id = ?').get(channelId);
    if (!channel) return res.status(404).json({ success: false, error: 'Channel not found' });

    if (channel.is_dm) {
      const participant = db.prepare('SELECT * FROM dm_participants WHERE channel_id = ? AND user_id = ?').get(channelId, req.user.id);
      if (!participant) return res.status(403).json({ success: false, error: 'Not a participant in this DM' });
    } else if (channel.server_id) {
      const membership = db.prepare('SELECT * FROM server_members WHERE server_id = ? AND user_id = ?').get(channel.server_id, req.user.id);
      if (!membership) return res.status(403).json({ success: false, error: 'Not a member of this server' });
    }

    const messageId = 'msg-' + uuidv4().slice(0, 12);
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO messages (id, channel_id, user_id, content, type, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(messageId, channelId, req.user.id, content.trim(), type || 'text', now);

    // Fetch the full message with user info
    const message = db.prepare(`
      SELECT m.*, u.display_name, u.username, u.discriminator, u.avatar, u.avatar_emoji,
             u.color, u.initials, u.status
      FROM messages m
      JOIN users u ON u.id = m.user_id
      WHERE m.id = ?
    `).get(messageId);

    const formatted = formatMessage(message, {});

    res.status(201).json({
      success: true,
      message: formatted
    });
  } catch (err) {
    console.error('[Messages] Send error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ============ PATCH /api/messages/:id ============
// Edit a message
router.patch('/messages/:id', requireAuth, (req, res) => {
  try {
    const db = getDB();
    const messageId = req.params.id;
    const { content } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Message content is required' });
    }

    const message = db.prepare('SELECT * FROM messages WHERE id = ? AND deleted = 0').get(messageId);
    if (!message) return res.status(404).json({ success: false, error: 'Message not found' });
    if (message.user_id !== req.user.id) return res.status(403).json({ success: false, error: 'Can only edit your own messages' });

    const now = new Date().toISOString();
    db.prepare('UPDATE messages SET content = ?, edited_at = ? WHERE id = ?').run(content.trim(), now, messageId);

    const updated = db.prepare(`
      SELECT m.*, u.display_name, u.username, u.discriminator, u.avatar, u.avatar_emoji,
             u.color, u.initials, u.status
      FROM messages m
      JOIN users u ON u.id = m.user_id
      WHERE m.id = ?
    `).get(messageId);

    res.json({ success: true, message: formatMessage(updated, {}) });
  } catch (err) {
    console.error('[Messages] Edit error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ============ DELETE /api/messages/:id ============
// Delete a message (soft delete)
router.delete('/messages/:id', requireAuth, (req, res) => {
  try {
    const db = getDB();
    const messageId = req.params.id;

    const message = db.prepare('SELECT * FROM messages WHERE id = ? AND deleted = 0').get(messageId);
    if (!message) return res.status(404).json({ success: false, error: 'Message not found' });

    // Allow deletion by author or server owner/admin
    if (message.user_id !== req.user.id) {
      const channel = db.prepare('SELECT * FROM channels WHERE id = ?').get(message.channel_id);
      if (channel && channel.server_id) {
        const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(channel.server_id);
        const isAdmin = db.prepare(`
          SELECT r.id FROM member_roles mr
          JOIN roles r ON r.id = mr.role_id
          WHERE mr.server_id = ? AND mr.user_id = ? AND r.name IN ('Admin', 'Moderator')
        `).get(channel.server_id, req.user.id);
        if (server.owner_id !== req.user.id && !isAdmin) {
          return res.status(403).json({ success: false, error: 'Insufficient permissions' });
        }
      } else {
        return res.status(403).json({ success: false, error: 'Can only delete your own messages' });
      }
    }

    db.prepare('UPDATE messages SET deleted = 1 WHERE id = ?').run(messageId);
    res.json({ success: true, messageId });
  } catch (err) {
    console.error('[Messages] Delete error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ============ POST /api/messages/:id/reactions ============
// Add a reaction
router.post('/messages/:id/reactions', requireAuth, (req, res) => {
  try {
    const db = getDB();
    const messageId = req.params.id;
    const { emoji } = req.body;

    if (!emoji) return res.status(400).json({ success: false, error: 'Emoji is required' });

    const message = db.prepare('SELECT * FROM messages WHERE id = ? AND deleted = 0').get(messageId);
    if (!message) return res.status(404).json({ success: false, error: 'Message not found' });

    const existing = db.prepare('SELECT * FROM reactions WHERE message_id = ? AND user_id = ? AND emoji = ?').get(messageId, req.user.id, emoji);
    if (existing) {
      // Toggle off - remove reaction
      db.prepare('DELETE FROM reactions WHERE id = ?').run(existing.id);
      return res.json({ success: true, action: 'removed' });
    }

    const reactionId = 'react-' + uuidv4().slice(0, 8);
    db.prepare('INSERT INTO reactions (id, message_id, user_id, emoji) VALUES (?, ?, ?, ?)').run(reactionId, messageId, req.user.id, emoji);

    res.status(201).json({ success: true, action: 'added', reactionId });
  } catch (err) {
    console.error('[Messages] Reaction error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ============ DELETE /api/messages/:id/reactions/:emoji ============
// Remove a reaction
router.delete('/messages/:id/reactions/:emoji', requireAuth, (req, res) => {
  try {
    const db = getDB();
    const messageId = req.params.id;
    const emoji = decodeURIComponent(req.params.emoji);

    db.prepare('DELETE FROM reactions WHERE message_id = ? AND user_id = ? AND emoji = ?').run(messageId, req.user.id, emoji);
    res.json({ success: true });
  } catch (err) {
    console.error('[Messages] Remove reaction error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ============ HELPERS ============

function formatMessage(m, reactionsMap) {
  const reactions = Object.values(reactionsMap).map(r => ({
    emoji: r.emoji,
    count: r.count,
    active: r.active,
    users: r.users
  }));

  return {
    id: m.id,
    channelId: m.channel_id,
    userId: m.user_id,
    content: m.content,
    type: m.type,
    editedAt: m.edited_at,
    createdAt: m.created_at,
    timestamp: m.created_at,
    reactions,
    user: {
      id: m.user_id,
      displayName: m.display_name,
      username: m.username,
      discriminator: m.discriminator,
      tag: m.username + '#' + m.discriminator,
      avatar: m.avatar,
      avatarEmoji: m.avatar_emoji,
      color: m.color,
      initials: m.initials,
      status: m.status,
    }
  };
}

module.exports = router;
module.exports.formatMessage = formatMessage;