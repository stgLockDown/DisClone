// ============================================
// NEXUS CHAT - Server & Channel Routes
// ============================================

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../database');
const { requireAuth } = require('../middleware/auth');
const { formatUser } = require('./auth');

const router = express.Router();

// ============ GET /api/servers ============
// List servers the current user is a member of
router.get('/', requireAuth, (req, res) => {
  try {
    const db = getDB();
    const servers = db.prepare(`
      SELECT s.id, s.name, s.icon, s.icon_emoji, s.owner_id, s.description, s.created_at,
             (SELECT COUNT(*) FROM server_members WHERE server_id = s.id) as member_count
      FROM servers s
      JOIN server_members sm ON sm.server_id = s.id
      WHERE sm.user_id = ?
      ORDER BY sm.joined_at ASC
    `).all(req.user.id);

    res.json({
      success: true,
      servers: servers.map(formatServer)
    });
  } catch (err) {
    console.error('[Servers] List error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ============ POST /api/servers ============
// Create a new server
router.post('/', requireAuth, (req, res) => {
  try {
    const { name, icon, iconEmoji, description } = req.body;

    if (!name || name.length < 1 || name.length > 100) {
      return res.status(400).json({ success: false, error: 'Server name must be 1-100 characters' });
    }

    const db = getDB();
    const serverId = 'srv-' + uuidv4().slice(0, 12);

    const createTransaction = db.transaction(() => {
      // Create server
      db.prepare(`
        INSERT INTO servers (id, name, icon, icon_emoji, owner_id, description)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(serverId, name, icon || null, iconEmoji || null, req.user.id, description || '');

      // Add owner as member
      db.prepare('INSERT INTO server_members (server_id, user_id) VALUES (?, ?)').run(serverId, req.user.id);

      // Create default roles
      const adminRoleId = 'role-' + uuidv4().slice(0, 8);
      const memberRoleId = 'role-' + uuidv4().slice(0, 8);
      db.prepare('INSERT INTO roles (id, server_id, name, color, position) VALUES (?, ?, ?, ?, ?)').run(adminRoleId, serverId, 'Admin', '#f87171', 2);
      db.prepare('INSERT INTO roles (id, server_id, name, color, position) VALUES (?, ?, ?, ?, ?)').run(memberRoleId, serverId, 'Member', '#0ea5e9', 1);

      // Assign admin role to owner
      db.prepare('INSERT INTO member_roles (server_id, user_id, role_id) VALUES (?, ?, ?)').run(serverId, req.user.id, adminRoleId);

      // Create default category and channels
      const catId = 'cat-' + uuidv4().slice(0, 8);
      db.prepare('INSERT INTO categories (id, server_id, name, position) VALUES (?, ?, ?, ?)').run(catId, serverId, 'General', 0);

      const generalChId = 'ch-' + uuidv4().slice(0, 8);
      db.prepare('INSERT INTO channels (id, server_id, category_id, name, type, topic, icon, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
        generalChId, serverId, catId, 'general', 'text', 'General discussion', '#', 0
      );

      const vcId = 'vc-' + uuidv4().slice(0, 8);
      db.prepare('INSERT INTO channels (id, server_id, category_id, name, type, icon, position) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
        vcId, serverId, catId, 'General Voice', 'voice', '🔊', 1
      );

      // System message
      db.prepare('INSERT INTO messages (id, channel_id, user_id, content, type, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
        'msg-' + uuidv4().slice(0, 8), generalChId, req.user.id, `Welcome to **${name}**! This is the beginning of this server.`, 'system', new Date().toISOString()
      );
    });

    createTransaction();

    const server = db.prepare(`
      SELECT s.id, s.name, s.icon, s.icon_emoji, s.owner_id, s.description, s.created_at,
             (SELECT COUNT(*) FROM server_members WHERE server_id = s.id) as member_count
      FROM servers s WHERE s.id = ?
    `).get(serverId);

    res.status(201).json({
      success: true,
      server: formatServer(server)
    });
  } catch (err) {
    console.error('[Servers] Create error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ============ GET /api/servers/:id ============
// Get server details with channels, categories, members, roles
router.get('/:id', requireAuth, (req, res) => {
  try {
    const db = getDB();
    const serverId = req.params.id;

    // Check membership
    const membership = db.prepare('SELECT * FROM server_members WHERE server_id = ? AND user_id = ?').get(serverId, req.user.id);
    if (!membership) {
      return res.status(403).json({ success: false, error: 'Not a member of this server' });
    }

    const server = db.prepare(`
      SELECT s.id, s.name, s.icon, s.icon_emoji, s.owner_id, s.description, s.created_at,
             (SELECT COUNT(*) FROM server_members WHERE server_id = s.id) as member_count
      FROM servers s WHERE s.id = ?
    `).get(serverId);

    if (!server) {
      return res.status(404).json({ success: false, error: 'Server not found' });
    }

    // Get categories
    const categories = db.prepare('SELECT * FROM categories WHERE server_id = ? ORDER BY position ASC').all(serverId);

    // Get channels grouped by category
    const channels = db.prepare(`
      SELECT c.*, 
             (SELECT COUNT(*) FROM voice_state vs WHERE vs.channel_id = c.id) as voice_user_count
      FROM channels c 
      WHERE c.server_id = ? 
      ORDER BY c.position ASC
    `).all(serverId);

    // Get voice users for voice channels
    const voiceChannels = channels.filter(c => c.type === 'voice');
    const voiceStates = {};
    for (const vc of voiceChannels) {
      const voiceUsers = db.prepare(`
        SELECT u.id, u.display_name, u.username, u.discriminator, u.avatar, u.color, u.initials, u.status,
               vs.muted, vs.deafened
        FROM voice_state vs
        JOIN users u ON u.id = vs.user_id
        WHERE vs.channel_id = ?
      `).all(vc.id);
      voiceStates[vc.id] = voiceUsers.map(u => ({
        ...formatUser(u),
        muted: !!u.muted,
        deafened: !!u.deafened
      }));
    }

    // Get members with roles
    const members = db.prepare(`
      SELECT u.id, u.display_name, u.username, u.discriminator, u.avatar, u.avatar_emoji,
             u.color, u.initials, u.status, u.custom_status, u.about,
             sm.nickname, sm.joined_at
      FROM server_members sm
      JOIN users u ON u.id = sm.user_id
      WHERE sm.server_id = ?
      ORDER BY u.display_name ASC
    `).all(serverId);

    // Get roles
    const roles = db.prepare('SELECT * FROM roles WHERE server_id = ? ORDER BY position DESC').all(serverId);

    // Get member roles
    const memberRolesRaw = db.prepare(`
      SELECT mr.user_id, r.id as role_id, r.name, r.color, r.position
      FROM member_roles mr
      JOIN roles r ON r.id = mr.role_id
      WHERE mr.server_id = ?
    `).all(serverId);

    const memberRolesMap = {};
    for (const mr of memberRolesRaw) {
      if (!memberRolesMap[mr.user_id]) memberRolesMap[mr.user_id] = [];
      memberRolesMap[mr.user_id].push({ id: mr.role_id, name: mr.name, color: mr.color, position: mr.position });
    }

    // Build category->channels structure
    const categoryChannels = categories.map(cat => ({
      id: cat.id,
      name: cat.name,
      position: cat.position,
      channels: channels
        .filter(ch => ch.category_id === cat.id)
        .map(ch => ({
          id: ch.id,
          name: ch.name,
          type: ch.type,
          topic: ch.topic,
          icon: ch.icon,
          position: ch.position,
          voiceUsers: voiceStates[ch.id] || []
        }))
    }));

    res.json({
      success: true,
      server: {
        ...formatServer(server),
        categories: categoryChannels,
        members: members.map(m => ({
          ...formatUser(m),
          nickname: m.nickname,
          joinedAt: m.joined_at,
          roles: memberRolesMap[m.id] || []
        })),
        roles: roles.map(r => ({
          id: r.id,
          name: r.name,
          color: r.color,
          position: r.position
        }))
      }
    });
  } catch (err) {
    console.error('[Servers] Get error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ============ PATCH /api/servers/:id ============
router.patch('/:id', requireAuth, (req, res) => {
  try {
    const db = getDB();
    const serverId = req.params.id;

    const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(serverId);
    if (!server) return res.status(404).json({ success: false, error: 'Server not found' });
    if (server.owner_id !== req.user.id) return res.status(403).json({ success: false, error: 'Only the owner can update the server' });

    const allowed = ['name', 'icon', 'icon_emoji', 'description'];
    const updates = {};
    const fieldMap = { iconEmoji: 'icon_emoji' };

    for (const [key, value] of Object.entries(req.body)) {
      const dbField = fieldMap[key] || key;
      if (allowed.includes(dbField)) updates[dbField] = value;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, error: 'No valid fields to update' });
    }

    updates.updated_at = new Date().toISOString();
    const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    db.prepare(`UPDATE servers SET ${setClauses} WHERE id = ?`).run(...Object.values(updates), serverId);

    const updated = db.prepare(`
      SELECT s.id, s.name, s.icon, s.icon_emoji, s.owner_id, s.description, s.created_at,
             (SELECT COUNT(*) FROM server_members WHERE server_id = s.id) as member_count
      FROM servers s WHERE s.id = ?
    `).get(serverId);

    res.json({ success: true, server: formatServer(updated) });
  } catch (err) {
    console.error('[Servers] Update error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ============ DELETE /api/servers/:id ============
router.delete('/:id', requireAuth, (req, res) => {
  try {
    const db = getDB();
    const serverId = req.params.id;

    const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(serverId);
    if (!server) return res.status(404).json({ success: false, error: 'Server not found' });
    if (server.owner_id !== req.user.id) return res.status(403).json({ success: false, error: 'Only the owner can delete the server' });

    db.prepare('DELETE FROM servers WHERE id = ?').run(serverId);
    res.json({ success: true });
  } catch (err) {
    console.error('[Servers] Delete error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ============ POST /api/servers/:id/join ============
router.post('/:id/join', requireAuth, (req, res) => {
  try {
    const db = getDB();
    const serverId = req.params.id;

    const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(serverId);
    if (!server) return res.status(404).json({ success: false, error: 'Server not found' });

    const existing = db.prepare('SELECT * FROM server_members WHERE server_id = ? AND user_id = ?').get(serverId, req.user.id);
    if (existing) return res.status(409).json({ success: false, error: 'Already a member' });

    db.prepare('INSERT INTO server_members (server_id, user_id) VALUES (?, ?)').run(serverId, req.user.id);

    // Assign default member role
    const memberRole = db.prepare('SELECT id FROM roles WHERE server_id = ? AND name = ? ORDER BY position ASC LIMIT 1').get(serverId, 'Member');
    if (memberRole) {
      db.prepare('INSERT OR IGNORE INTO member_roles (server_id, user_id, role_id) VALUES (?, ?, ?)').run(serverId, req.user.id, memberRole.id);
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[Servers] Join error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ============ POST /api/servers/:id/leave ============
router.post('/:id/leave', requireAuth, (req, res) => {
  try {
    const db = getDB();
    const serverId = req.params.id;

    const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(serverId);
    if (!server) return res.status(404).json({ success: false, error: 'Server not found' });
    if (server.owner_id === req.user.id) return res.status(400).json({ success: false, error: 'Owner cannot leave. Transfer ownership or delete the server.' });

    db.prepare('DELETE FROM server_members WHERE server_id = ? AND user_id = ?').run(serverId, req.user.id);
    res.json({ success: true });
  } catch (err) {
    console.error('[Servers] Leave error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ============ POST /api/servers/:id/channels ============
router.post('/:id/channels', requireAuth, (req, res) => {
  try {
    const db = getDB();
    const serverId = req.params.id;
    const { name, type, topic, icon, categoryId } = req.body;

    const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(serverId);
    if (!server) return res.status(404).json({ success: false, error: 'Server not found' });

    // Check if user has permission (owner or admin role)
    if (server.owner_id !== req.user.id) {
      const adminRole = db.prepare(`
        SELECT r.id FROM member_roles mr
        JOIN roles r ON r.id = mr.role_id
        WHERE mr.server_id = ? AND mr.user_id = ? AND r.name = 'Admin'
      `).get(serverId, req.user.id);
      if (!adminRole) return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    if (!name || name.length < 1 || name.length > 100) {
      return res.status(400).json({ success: false, error: 'Channel name must be 1-100 characters' });
    }

    const channelType = type || 'text';
    if (!['text', 'voice'].includes(channelType)) {
      return res.status(400).json({ success: false, error: 'Invalid channel type' });
    }

    // Get or create category
    let catId = categoryId;
    if (!catId) {
      const defaultCat = db.prepare('SELECT id FROM categories WHERE server_id = ? ORDER BY position ASC LIMIT 1').get(serverId);
      catId = defaultCat ? defaultCat.id : null;
      if (!catId) {
        catId = 'cat-' + uuidv4().slice(0, 8);
        db.prepare('INSERT INTO categories (id, server_id, name, position) VALUES (?, ?, ?, ?)').run(catId, serverId, 'General', 0);
      }
    }

    const channelId = (channelType === 'voice' ? 'vc-' : 'ch-') + uuidv4().slice(0, 8);
    const maxPos = db.prepare('SELECT MAX(position) as max FROM channels WHERE server_id = ? AND category_id = ?').get(serverId, catId);
    const position = (maxPos?.max ?? -1) + 1;

    db.prepare(`
      INSERT INTO channels (id, server_id, category_id, name, type, topic, icon, position)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(channelId, serverId, catId, name, channelType, topic || '', icon || (channelType === 'voice' ? '🔊' : '#'), position);

    const channel = db.prepare('SELECT * FROM channels WHERE id = ?').get(channelId);

    res.status(201).json({
      success: true,
      channel: formatChannel(channel)
    });
  } catch (err) {
    console.error('[Servers] Create channel error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ============ PATCH /api/channels/:id ============
router.patch('/channels/:id', requireAuth, (req, res) => {
  try {
    const db = getDB();
    const channelId = req.params.id;

    const channel = db.prepare('SELECT * FROM channels WHERE id = ?').get(channelId);
    if (!channel) return res.status(404).json({ success: false, error: 'Channel not found' });

    const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(channel.server_id);
    if (server.owner_id !== req.user.id) {
      const adminRole = db.prepare(`
        SELECT r.id FROM member_roles mr
        JOIN roles r ON r.id = mr.role_id
        WHERE mr.server_id = ? AND mr.user_id = ? AND r.name = 'Admin'
      `).get(channel.server_id, req.user.id);
      if (!adminRole) return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    const allowed = ['name', 'topic', 'icon', 'position'];
    const updates = {};
    for (const [key, value] of Object.entries(req.body)) {
      if (allowed.includes(key)) updates[key] = value;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, error: 'No valid fields to update' });
    }

    const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    db.prepare(`UPDATE channels SET ${setClauses} WHERE id = ?`).run(...Object.values(updates), channelId);

    const updated = db.prepare('SELECT * FROM channels WHERE id = ?').get(channelId);
    res.json({ success: true, channel: formatChannel(updated) });
  } catch (err) {
    console.error('[Channels] Update error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ============ DELETE /api/channels/:id ============
router.delete('/channels/:id', requireAuth, (req, res) => {
  try {
    const db = getDB();
    const channelId = req.params.id;

    const channel = db.prepare('SELECT * FROM channels WHERE id = ?').get(channelId);
    if (!channel) return res.status(404).json({ success: false, error: 'Channel not found' });

    const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(channel.server_id);
    if (server.owner_id !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Only the owner can delete channels' });
    }

    db.prepare('DELETE FROM channels WHERE id = ?').run(channelId);
    res.json({ success: true });
  } catch (err) {
    console.error('[Channels] Delete error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ============ GET /api/servers/:id/members ============
router.get('/:id/members', requireAuth, (req, res) => {
  try {
    const db = getDB();
    const serverId = req.params.id;

    const membership = db.prepare('SELECT * FROM server_members WHERE server_id = ? AND user_id = ?').get(serverId, req.user.id);
    if (!membership) return res.status(403).json({ success: false, error: 'Not a member' });

    const members = db.prepare(`
      SELECT u.id, u.display_name, u.username, u.discriminator, u.avatar, u.avatar_emoji,
             u.color, u.initials, u.status, u.custom_status, u.about,
             sm.nickname, sm.joined_at
      FROM server_members sm
      JOIN users u ON u.id = sm.user_id
      WHERE sm.server_id = ?
      ORDER BY u.display_name ASC
    `).all(serverId);

    const memberRolesRaw = db.prepare(`
      SELECT mr.user_id, r.id as role_id, r.name, r.color, r.position
      FROM member_roles mr
      JOIN roles r ON r.id = mr.role_id
      WHERE mr.server_id = ?
    `).all(serverId);

    const memberRolesMap = {};
    for (const mr of memberRolesRaw) {
      if (!memberRolesMap[mr.user_id]) memberRolesMap[mr.user_id] = [];
      memberRolesMap[mr.user_id].push({ id: mr.role_id, name: mr.name, color: mr.color });
    }

    res.json({
      success: true,
      members: members.map(m => ({
        ...formatUser(m),
        nickname: m.nickname,
        joinedAt: m.joined_at,
        roles: memberRolesMap[m.id] || []
      }))
    });
  } catch (err) {
    console.error('[Servers] Members error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ============ HELPERS ============

function formatServer(s) {
  return {
    id: s.id,
    name: s.name,
    icon: s.icon,
    iconEmoji: s.icon_emoji,
    ownerId: s.owner_id,
    description: s.description,
    memberCount: s.member_count,
    createdAt: s.created_at,
  };
}

function formatChannel(ch) {
  return {
    id: ch.id,
    serverId: ch.server_id,
    categoryId: ch.category_id,
    name: ch.name,
    type: ch.type,
    topic: ch.topic,
    icon: ch.icon,
    position: ch.position,
    isDm: !!ch.is_dm,
  };
}

module.exports = router;
module.exports.formatServer = formatServer;
module.exports.formatChannel = formatChannel;