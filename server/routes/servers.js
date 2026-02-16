// ============================================
// NEXUS CHAT - Server & Channel Routes
// ============================================

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { dbGet, dbAll, dbRun } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { formatUser } = require('./auth');

const router = express.Router();

// ============ GET /api/servers ============
router.get('/', requireAuth, async (req, res) => {
  try {
    const servers = await dbAll(`
      SELECT s.id, s.name, s.icon, s.icon_emoji, s.owner_id, s.description, s.created_at,
             (SELECT COUNT(*) FROM server_members WHERE server_id = s.id) as member_count
      FROM servers s
      JOIN server_members sm ON sm.server_id = s.id
      WHERE sm.user_id = ?
      ORDER BY sm.joined_at ASC
    `, req.user.id);

    res.json({ success: true, servers: servers.map(formatServer) });
  } catch (err) {
    console.error('[Servers] List error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ============ POST /api/servers ============
router.post('/', requireAuth, async (req, res) => {
  try {
    const { name, icon, iconEmoji, description } = req.body;
    if (!name || name.length < 1 || name.length > 100) {
      return res.status(400).json({ success: false, error: 'Server name must be 1-100 characters' });
    }

    const serverId = 'srv-' + uuidv4().slice(0, 12);
    await dbRun(`INSERT INTO servers (id, name, icon, icon_emoji, owner_id, description) VALUES (?, ?, ?, ?, ?, ?)`,
      serverId, name, icon || null, iconEmoji || null, req.user.id, description || '');

    await dbRun('INSERT INTO server_members (server_id, user_id) VALUES (?, ?)', serverId, req.user.id);

    const adminRoleId = 'role-' + uuidv4().slice(0, 8);
    const memberRoleId = 'role-' + uuidv4().slice(0, 8);
    await dbRun('INSERT INTO roles (id, server_id, name, color, position) VALUES (?, ?, ?, ?, ?)', adminRoleId, serverId, 'Admin', '#f87171', 2);
    await dbRun('INSERT INTO roles (id, server_id, name, color, position) VALUES (?, ?, ?, ?, ?)', memberRoleId, serverId, 'Member', '#dc2626', 1);
    await dbRun('INSERT INTO member_roles (server_id, user_id, role_id) VALUES (?, ?, ?)', serverId, req.user.id, adminRoleId);

    // Create General category
    const catId = 'cat-' + uuidv4().slice(0, 8);
    await dbRun('INSERT INTO categories (id, server_id, name, position) VALUES (?, ?, ?, ?)', catId, serverId, 'General', 0);

    const generalChId = 'ch-' + uuidv4().slice(0, 8);
    await dbRun('INSERT INTO channels (id, server_id, category_id, name, type, topic, icon, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      generalChId, serverId, catId, 'general', 'text', 'General discussion', '#', 0);

    const vcId = 'vc-' + uuidv4().slice(0, 8);
    await dbRun('INSERT INTO channels (id, server_id, category_id, name, type, icon, position) VALUES (?, ?, ?, ?, ?, ?, ?)',
      vcId, serverId, catId, 'General Voice', 'voice', '🔊', 1);

    await dbRun('INSERT INTO messages (id, channel_id, user_id, content, type, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      'msg-' + uuidv4().slice(0, 8), generalChId, req.user.id, `Welcome to **${name}**! This is the beginning of this server.`, 'system', new Date().toISOString());

    // Add standard hubs to every new server
    const STANDARD_HUBS = [
      { name: 'Gaming Hub', channels: [
        { name: 'gaming-general', type: 'text', icon: '#', topic: 'General gaming discussions' },
        { name: 'game-night', type: 'text', icon: '#', topic: 'Organize game nights and events' },
        { name: 'lfg', type: 'text', icon: '#', topic: 'Looking for group - find teammates!' },
        { name: 'Gaming Voice', type: 'voice', icon: '🔊', topic: '' },
      ]},
      { name: 'Music Vibes', channels: [
        { name: 'music-chat', type: 'text', icon: '#', topic: 'Talk about music' },
        { name: 'share-tracks', type: 'text', icon: '#', topic: 'Share your favorite songs' },
        { name: 'Music Lounge', type: 'voice', icon: '🔊', topic: '' },
      ]},
      { name: 'Dev Hub', channels: [
        { name: 'dev-chat', type: 'text', icon: '#', topic: 'Developer discussions' },
        { name: 'code-help', type: 'text', icon: '#', topic: 'Get help with coding' },
        { name: 'project-showcase', type: 'text', icon: '#', topic: 'Show off your projects' },
      ]},
      { name: 'Art Hub', channels: [
        { name: 'art-chat', type: 'text', icon: '#', topic: 'Art community discussions' },
        { name: 'art-showcase', type: 'text', icon: '#', topic: 'Share your artwork' },
        { name: 'feedback', type: 'text', icon: '#', topic: 'Get constructive feedback' },
      ]},
      { name: 'Streamer Hub', channels: [
        { name: 'stream-chat', type: 'text', icon: '#', topic: 'Talk about streaming' },
        { name: 'stream-schedule', type: 'text', icon: '#', topic: 'Post your stream schedules' },
        { name: 'watch-party', type: 'text', icon: '#', topic: 'Organize watch parties' },
        { name: 'Stream Room', type: 'voice', icon: '🔊', topic: '' },
      ]}
    ];

    let hubPosition = 1;
    for (const hub of STANDARD_HUBS) {
      const hubCatId = 'cat-' + uuidv4().slice(0, 8);
      await dbRun('INSERT INTO categories (id, server_id, name, position) VALUES (?, ?, ?, ?)', hubCatId, serverId, hub.name, hubPosition++);
      
      for (let i = 0; i < hub.channels.length; i++) {
        const ch = hub.channels[i];
        const chId = (ch.type === 'voice' ? 'vc-' : 'ch-') + uuidv4().slice(0, 8);
        await dbRun('INSERT INTO channels (id, server_id, category_id, name, type, topic, icon, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          chId, serverId, hubCatId, ch.name, ch.type, ch.topic || '', ch.icon || '#', i);
      }
    }

    const server = await dbGet(`
      SELECT s.id, s.name, s.icon, s.icon_emoji, s.owner_id, s.description, s.created_at,
             (SELECT COUNT(*) FROM server_members WHERE server_id = s.id) as member_count
      FROM servers s WHERE s.id = ?
    `, serverId);

    res.status(201).json({ success: true, server: formatServer(server) });
  } catch (err) {
    console.error('[Servers] Create error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ============ GET /api/servers/:id ============
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const serverId = req.params.id;

    const membership = await dbGet('SELECT * FROM server_members WHERE server_id = ? AND user_id = ?', serverId, req.user.id);
    if (!membership) return res.status(403).json({ success: false, error: 'Not a member of this server' });

    const server = await dbGet(`
      SELECT s.id, s.name, s.icon, s.icon_emoji, s.owner_id, s.description, s.created_at,
             (SELECT COUNT(*) FROM server_members WHERE server_id = s.id) as member_count
      FROM servers s WHERE s.id = ?
    `, serverId);
    if (!server) return res.status(404).json({ success: false, error: 'Server not found' });

    const categories = await dbAll('SELECT * FROM categories WHERE server_id = ? ORDER BY position ASC', serverId);
    const channels = await dbAll('SELECT * FROM channels WHERE server_id = ? ORDER BY position ASC', serverId);

    const members = await dbAll(`
      SELECT u.id, u.display_name, u.username, u.discriminator, u.avatar, u.avatar_emoji,
             u.color, u.initials, u.status, u.custom_status, u.about,
             sm.nickname, sm.joined_at
      FROM server_members sm
      JOIN users u ON u.id = sm.user_id
      WHERE sm.server_id = ?
      ORDER BY u.display_name ASC
    `, serverId);

    const roles = await dbAll('SELECT * FROM roles WHERE server_id = ? ORDER BY position DESC', serverId);

    const memberRolesRaw = await dbAll(`
      SELECT mr.user_id, r.id as role_id, r.name, r.color, r.position
      FROM member_roles mr
      JOIN roles r ON r.id = mr.role_id
      WHERE mr.server_id = ?
    `, serverId);

    const memberRolesMap = {};
    for (const mr of memberRolesRaw) {
      if (!memberRolesMap[mr.user_id]) memberRolesMap[mr.user_id] = [];
      memberRolesMap[mr.user_id].push({ id: mr.role_id, name: mr.name, color: mr.color, position: mr.position });
    }

    const categoryChannels = categories.map(cat => ({
      id: cat.id, name: cat.name, position: cat.position,
      channels: channels.filter(ch => ch.category_id === cat.id).map(ch => ({
        id: ch.id, name: ch.name, type: ch.type, topic: ch.topic, icon: ch.icon, position: ch.position, voiceUsers: []
      }))
    }));

    res.json({
      success: true,
      server: {
        ...formatServer(server),
        categories: categoryChannels,
        members: members.map(m => ({
          ...formatUser(m), nickname: m.nickname, joinedAt: m.joined_at, roles: memberRolesMap[m.id] || []
        })),
        roles: roles.map(r => ({ id: r.id, name: r.name, color: r.color, position: r.position }))
      }
    });
  } catch (err) {
    console.error('[Servers] Get error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ============ PATCH /api/servers/:id ============
router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const serverId = req.params.id;
    const server = await dbGet('SELECT * FROM servers WHERE id = ?', serverId);
    if (!server) return res.status(404).json({ success: false, error: 'Server not found' });
    if (server.owner_id !== req.user.id) return res.status(403).json({ success: false, error: 'Only the owner can update the server' });

    const allowed = ['name', 'icon', 'icon_emoji', 'description'];
    const fieldMap = { iconEmoji: 'icon_emoji' };
    const updates = {};
    for (const [key, value] of Object.entries(req.body)) {
      const dbField = fieldMap[key] || key;
      if (allowed.includes(dbField)) updates[dbField] = value;
    }
    if (Object.keys(updates).length === 0) return res.status(400).json({ success: false, error: 'No valid fields to update' });

    updates.updated_at = new Date().toISOString();
    const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    await dbRun(`UPDATE servers SET ${setClauses} WHERE id = ?`, ...Object.values(updates), serverId);

    const updated = await dbGet(`
      SELECT s.id, s.name, s.icon, s.icon_emoji, s.owner_id, s.description, s.created_at,
             (SELECT COUNT(*) FROM server_members WHERE server_id = s.id) as member_count
      FROM servers s WHERE s.id = ?
    `, serverId);
    res.json({ success: true, server: formatServer(updated) });
  } catch (err) {
    console.error('[Servers] Update error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ============ DELETE /api/servers/:id ============
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const server = await dbGet('SELECT * FROM servers WHERE id = ?', req.params.id);
    if (!server) return res.status(404).json({ success: false, error: 'Server not found' });
    if (server.owner_id !== req.user.id) return res.status(403).json({ success: false, error: 'Only the owner can delete the server' });
    await dbRun('DELETE FROM servers WHERE id = ?', req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('[Servers] Delete error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ============ POST /api/servers/:id/join ============
router.post('/:id/join', requireAuth, async (req, res) => {
  try {
    const serverId = req.params.id;
    const server = await dbGet('SELECT * FROM servers WHERE id = ?', serverId);
    if (!server) return res.status(404).json({ success: false, error: 'Server not found' });

    const existing = await dbGet('SELECT * FROM server_members WHERE server_id = ? AND user_id = ?', serverId, req.user.id);
    if (existing) return res.status(409).json({ success: false, error: 'Already a member' });

    await dbRun('INSERT INTO server_members (server_id, user_id) VALUES (?, ?)', serverId, req.user.id);

    const memberRole = await dbGet("SELECT id FROM roles WHERE server_id = ? AND name = 'Member' ORDER BY position ASC LIMIT 1", serverId);
    if (memberRole) {
      await dbRun('INSERT INTO member_roles (server_id, user_id, role_id) VALUES (?, ?, ?) ON CONFLICT DO NOTHING', serverId, req.user.id, memberRole.id);
    }
    res.json({ success: true });
  } catch (err) {
    console.error('[Servers] Join error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ============ POST /api/servers/:id/leave ============
router.post('/:id/leave', requireAuth, async (req, res) => {
  try {
    const server = await dbGet('SELECT * FROM servers WHERE id = ?', req.params.id);
    if (!server) return res.status(404).json({ success: false, error: 'Server not found' });
    if (server.owner_id === req.user.id) return res.status(400).json({ success: false, error: 'Owner cannot leave.' });
    await dbRun('DELETE FROM server_members WHERE server_id = ? AND user_id = ?', req.params.id, req.user.id);
    res.json({ success: true });
  } catch (err) {
    console.error('[Servers] Leave error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ============ POST /api/servers/:id/channels ============
router.post('/:id/channels', requireAuth, async (req, res) => {
  try {
    const serverId = req.params.id;
    const { name, type, topic, icon, categoryId } = req.body;

    const server = await dbGet('SELECT * FROM servers WHERE id = ?', serverId);
    if (!server) return res.status(404).json({ success: false, error: 'Server not found' });
    if (server.owner_id !== req.user.id) return res.status(403).json({ success: false, error: 'Insufficient permissions' });

    if (!name || name.length < 1 || name.length > 100) return res.status(400).json({ success: false, error: 'Channel name must be 1-100 characters' });

    const channelType = type || 'text';
    if (!['text', 'voice'].includes(channelType)) return res.status(400).json({ success: false, error: 'Invalid channel type' });

    let catId = categoryId;
    if (!catId) {
      const defaultCat = await dbGet('SELECT id FROM categories WHERE server_id = ? ORDER BY position ASC LIMIT 1', serverId);
      catId = defaultCat ? defaultCat.id : null;
      if (!catId) {
        catId = 'cat-' + uuidv4().slice(0, 8);
        await dbRun('INSERT INTO categories (id, server_id, name, position) VALUES (?, ?, ?, ?)', catId, serverId, 'General', 0);
      }
    }

    const channelId = (channelType === 'voice' ? 'vc-' : 'ch-') + uuidv4().slice(0, 8);
    const maxPos = await dbGet('SELECT MAX(position) as max FROM channels WHERE server_id = ? AND category_id = ?', serverId, catId);
    const position = ((maxPos && maxPos.max) || 0) + 1;

    await dbRun('INSERT INTO channels (id, server_id, category_id, name, type, topic, icon, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      channelId, serverId, catId, name, channelType, topic || '', icon || (channelType === 'voice' ? '🔊' : '#'), position);

    const channel = await dbGet('SELECT * FROM channels WHERE id = ?', channelId);
    res.status(201).json({ success: true, channel: formatChannel(channel) });
  } catch (err) {
    console.error('[Servers] Create channel error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ============ PATCH /api/servers/:id/channels/:channelId ============
router.patch('/:id/channels/:channelId', requireAuth, async (req, res) => {
  try {
    const serverId = req.params.id;
    const channelId = req.params.channelId;
    const { name, topic, icon } = req.body;

    const server = await dbGet('SELECT * FROM servers WHERE id = ?', serverId);
    if (!server) return res.status(404).json({ success: false, error: 'Server not found' });
    if (server.owner_id !== req.user.id) return res.status(403).json({ success: false, error: 'Insufficient permissions' });

    const channel = await dbGet('SELECT * FROM channels WHERE id = ? AND server_id = ?', channelId, serverId);
    if (!channel) return res.status(404).json({ success: false, error: 'Channel not found' });

    const updates = [];
    const values = [];
    if (name !== undefined) { updates.push('name = ?'); values.push(name); }
    if (topic !== undefined) { updates.push('topic = ?'); values.push(topic); }
    if (icon !== undefined) { updates.push('icon = ?'); values.push(icon); }

    if (updates.length === 0) return res.status(400).json({ success: false, error: 'No fields to update' });

    values.push(channelId);
    await dbRun(`UPDATE channels SET ${updates.join(', ')} WHERE id = ?`, ...values);

    const updated = await dbGet('SELECT * FROM channels WHERE id = ?', channelId);
    res.json({ success: true, channel: formatChannel(updated) });
  } catch (err) {
    console.error('[Servers] Update channel error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ============ GET /api/servers/:id/members ============
router.get('/:id/members', requireAuth, async (req, res) => {
  try {
    const serverId = req.params.id;
    const membership = await dbGet('SELECT * FROM server_members WHERE server_id = ? AND user_id = ?', serverId, req.user.id);
    if (!membership) return res.status(403).json({ success: false, error: 'Not a member' });

    const members = await dbAll(`
      SELECT u.id, u.display_name, u.username, u.discriminator, u.avatar, u.avatar_emoji,
             u.color, u.initials, u.status, u.custom_status, u.about, sm.nickname, sm.joined_at
      FROM server_members sm JOIN users u ON u.id = sm.user_id
      WHERE sm.server_id = ? ORDER BY u.display_name ASC
    `, serverId);

    const memberRolesRaw = await dbAll(`
      SELECT mr.user_id, r.id as role_id, r.name, r.color, r.position
      FROM member_roles mr JOIN roles r ON r.id = mr.role_id WHERE mr.server_id = ?
    `, serverId);

    const memberRolesMap = {};
    for (const mr of memberRolesRaw) {
      if (!memberRolesMap[mr.user_id]) memberRolesMap[mr.user_id] = [];
      memberRolesMap[mr.user_id].push({ id: mr.role_id, name: mr.name, color: mr.color });
    }

    res.json({
      success: true,
      members: members.map(m => ({ ...formatUser(m), nickname: m.nickname, joinedAt: m.joined_at, roles: memberRolesMap[m.id] || [] }))
    });
  } catch (err) {
    console.error('[Servers] Members error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

function formatServer(s) {
  return { id: s.id, name: s.name, icon: s.icon, iconEmoji: s.icon_emoji, ownerId: s.owner_id, description: s.description, memberCount: parseInt(s.member_count), createdAt: s.created_at };
}

function formatChannel(ch) {
  return { id: ch.id, serverId: ch.server_id, categoryId: ch.category_id, name: ch.name, type: ch.type, topic: ch.topic, icon: ch.icon, position: ch.position, isDm: !!ch.is_dm };
}

// ============ INVITE SYSTEM ============

// Generate a random invite code
function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let code = '';
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// POST /api/servers/:id/invites — Create an invite
router.post('/:id/invites', requireAuth, async (req, res) => {
  try {
    const serverId = req.params.id;
    const membership = await dbGet('SELECT * FROM server_members WHERE server_id = ? AND user_id = ?', serverId, req.user.id);
    if (!membership) return res.status(403).json({ success: false, error: 'Not a member of this server' });

    const { maxUses = 0, expiresIn = null } = req.body; // expiresIn in hours, 0 = never
    const inviteId = 'inv-' + uuidv4().slice(0, 8);
    const code = generateInviteCode();
    const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 3600000).toISOString() : null;

    await dbRun(
      'INSERT INTO invites (id, code, server_id, creator_id, max_uses, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
      inviteId, code, serverId, req.user.id, maxUses, expiresAt
    );

    const server = await dbGet('SELECT name, icon, icon_emoji FROM servers WHERE id = ?', serverId);

    res.json({
      success: true,
      invite: {
        id: inviteId,
        code,
        serverId,
        serverName: server?.name,
        serverIcon: server?.icon,
        serverEmoji: server?.icon_emoji,
        maxUses,
        uses: 0,
        expiresAt,
        createdBy: req.user.id
      }
    });
  } catch (err) {
    console.error('[Servers] Create invite error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/servers/:id/invites — List invites for a server
router.get('/:id/invites', requireAuth, async (req, res) => {
  try {
    const serverId = req.params.id;
    const membership = await dbGet('SELECT * FROM server_members WHERE server_id = ? AND user_id = ?', serverId, req.user.id);
    if (!membership) return res.status(403).json({ success: false, error: 'Not a member' });

    const invites = await dbAll(`
      SELECT i.*, u.display_name as creator_name, u.username as creator_username
      FROM invites i JOIN users u ON u.id = i.creator_id
      WHERE i.server_id = ? ORDER BY i.created_at DESC
    `, serverId);

    res.json({ success: true, invites });
  } catch (err) {
    console.error('[Servers] List invites error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/invites/:code — Get invite info (public)
router.get('/invite/:code', async (req, res) => {
  try {
    const invite = await dbGet(`
      SELECT i.*, s.name as server_name, s.icon as server_icon, s.icon_emoji as server_emoji, s.description as server_description,
             (SELECT COUNT(*) FROM server_members WHERE server_id = s.id) as member_count
      FROM invites i JOIN servers s ON s.id = i.server_id
      WHERE i.code = ?
    `, req.params.code);

    if (!invite) return res.status(404).json({ success: false, error: 'Invalid or expired invite' });

    // Check expiry
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return res.status(410).json({ success: false, error: 'This invite has expired' });
    }

    // Check max uses
    if (invite.max_uses > 0 && invite.uses >= invite.max_uses) {
      return res.status(410).json({ success: false, error: 'This invite has reached its max uses' });
    }

    res.json({
      success: true,
      invite: {
        code: invite.code,
        serverName: invite.server_name,
        serverIcon: invite.server_icon,
        serverEmoji: invite.server_emoji,
        serverDescription: invite.server_description,
        memberCount: invite.member_count,
        serverId: invite.server_id
      }
    });
  } catch (err) {
    console.error('[Servers] Get invite error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/invites/:code/join — Join a server via invite
router.post('/invite/:code/join', requireAuth, async (req, res) => {
  try {
    const invite = await dbGet(`
      SELECT i.*, s.name as server_name FROM invites i JOIN servers s ON s.id = i.server_id WHERE i.code = ?
    `, req.params.code);

    if (!invite) return res.status(404).json({ success: false, error: 'Invalid invite code' });

    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return res.status(410).json({ success: false, error: 'This invite has expired' });
    }

    if (invite.max_uses > 0 && invite.uses >= invite.max_uses) {
      return res.status(410).json({ success: false, error: 'This invite has reached its max uses' });
    }

    // Check if already a member
    const existing = await dbGet('SELECT * FROM server_members WHERE server_id = ? AND user_id = ?', invite.server_id, req.user.id);
    if (existing) {
      return res.json({ success: true, message: 'Already a member', serverId: invite.server_id, serverName: invite.server_name });
    }

    // Join the server
    await dbRun('INSERT INTO server_members (server_id, user_id) VALUES (?, ?)', invite.server_id, req.user.id);

    // Assign Member role
    const memberRole = await dbGet("SELECT id FROM roles WHERE server_id = ? AND name = 'Member' ORDER BY position ASC LIMIT 1", invite.server_id);
    if (memberRole) {
      await dbRun('INSERT INTO member_roles (server_id, user_id, role_id) VALUES (?, ?, ?) ON CONFLICT DO NOTHING', invite.server_id, req.user.id, memberRole.id);
    }

    // Increment uses
    await dbRun('UPDATE invites SET uses = uses + 1 WHERE id = ?', invite.id);

    res.json({ success: true, message: `Joined ${invite.server_name}!`, serverId: invite.server_id, serverName: invite.server_name });
  } catch (err) {
    console.error('[Servers] Join via invite error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;
module.exports.formatServer = formatServer;
module.exports.formatChannel = formatChannel;