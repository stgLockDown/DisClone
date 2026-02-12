// ============================================
// NEXUS CHAT - Auth Routes
// ============================================

const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { dbGet, dbAll, dbRun } = require('../db');
const { generateToken, requireAuth } = require('../middleware/auth');

const router = express.Router();

// ============ POST /api/auth/register ============
router.post('/register', async (req, res) => {
  try {
    const { email, displayName, username, password } = req.body;
    const errors = {};

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Invalid email address';
    if (!displayName || displayName.length < 1 || displayName.length > 32) errors.displayName = 'Must be 1-32 characters';
    if (!username || !/^[a-zA-Z0-9_]{3,20}$/.test(username)) errors.username = '3-20 chars, letters/numbers/underscore';
    if (!password || password.length < 6) errors.password = 'Must be at least 6 characters';

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ success: false, errors });
    }

    const lowerEmail = email.toLowerCase();
    const lowerUsername = username.toLowerCase();

    const existingEmail = await dbGet('SELECT id FROM users WHERE email = ?', lowerEmail);
    if (existingEmail) return res.status(409).json({ success: false, errors: { email: 'Email already registered' } });

    const existingUsername = await dbGet('SELECT id FROM users WHERE username = ?', lowerUsername);
    if (existingUsername) return res.status(409).json({ success: false, errors: { username: 'Username already taken' } });

    const userId = 'u-' + uuidv4().slice(0, 12);
    const discriminator = String(Math.floor(Math.random() * 9999)).padStart(4, '0');
    const passwordHash = bcrypt.hashSync(password, 10);
    const colors = ['#0ea5e9', '#f87171', '#a78bfa', '#06d6a0', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6', '#e879f9'];
    const color = colors[Math.floor(Math.random() * colors.length)];
    const initials = displayName.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();

    await dbRun(
      `INSERT INTO users (id, email, display_name, username, discriminator, password_hash, color, initials, status, about)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'online', 'Hey there! I''m using Nexus Chat.')`,
      userId, lowerEmail, displayName, lowerUsername, discriminator, passwordHash, color, initials
    );

    // Auto-join default servers
    const defaultServers = await dbAll('SELECT id FROM servers');
    for (const srv of defaultServers) {
      await dbRun('INSERT INTO server_members (server_id, user_id) VALUES (?, ?) ON CONFLICT DO NOTHING', srv.id, userId);
    }

    const token = generateToken(userId);

    const user = await dbGet(
      `SELECT id, email, display_name, username, discriminator, avatar, avatar_emoji,
              color, initials, status, custom_status, about, banner_color, created_at
       FROM users WHERE id = ?`, userId
    );

    res.status(201).json({ success: true, token, user: formatUser(user) });
  } catch (err) {
    console.error('[Auth] Register error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ============ POST /api/auth/login ============
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const errors = {};
    if (!email) errors.email = 'Required';
    if (!password) errors.password = 'Required';
    if (Object.keys(errors).length > 0) return res.status(400).json({ success: false, errors });

    const lowerEmail = email.toLowerCase();

    const user = await dbGet('SELECT * FROM users WHERE email = ? OR username = ?', lowerEmail, lowerEmail);
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ success: false, errors: { email: 'Invalid email/username or password' } });
    }

    await dbRun('UPDATE users SET status = ? WHERE id = ?', 'online', user.id);
    const token = generateToken(user.id);

    res.json({ success: true, token, user: formatUser(user) });
  } catch (err) {
    console.error('[Auth] Login error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ============ POST /api/auth/logout ============
router.post('/logout', requireAuth, async (req, res) => {
  try {
    await dbRun('UPDATE users SET status = ? WHERE id = ?', 'offline', req.user.id);
    res.json({ success: true });
  } catch (err) {
    console.error('[Auth] Logout error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ============ GET /api/auth/me ============
router.get('/me', requireAuth, (req, res) => {
  res.json({ success: true, user: formatUser(req.user) });
});

// ============ PATCH /api/auth/me ============
router.patch('/me', requireAuth, async (req, res) => {
  try {
    const updates = {};
    const allowed = ['display_name', 'about', 'status', 'custom_status', 'avatar', 'avatar_emoji', 'banner_color', 'color'];
    const fieldMap = { displayName: 'display_name', customStatus: 'custom_status', avatarEmoji: 'avatar_emoji', bannerColor: 'banner_color' };

    for (const [key, value] of Object.entries(req.body)) {
      const dbField = fieldMap[key] || key;
      if (allowed.includes(dbField)) updates[dbField] = value;
    }

    if (Object.keys(updates).length === 0) return res.status(400).json({ success: false, error: 'No valid fields to update' });

    if (updates.display_name) {
      updates.initials = updates.display_name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
    }
    updates.updated_at = new Date().toISOString();

    const setClauses = Object.keys(updates).map((k, i) => `${k} = ?`).join(', ');
    const values = [...Object.values(updates), req.user.id];

    await dbRun(`UPDATE users SET ${setClauses} WHERE id = ?`, ...values);

    const updatedUser = await dbGet(
      `SELECT id, email, display_name, username, discriminator, avatar, avatar_emoji,
              color, initials, status, custom_status, about, banner_color, created_at
       FROM users WHERE id = ?`, req.user.id
    );

    res.json({ success: true, user: formatUser(updatedUser) });
  } catch (err) {
    console.error('[Auth] Update profile error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

function formatUser(user) {
  return {
    id: user.id, email: user.email, displayName: user.display_name, username: user.username,
    discriminator: user.discriminator, tag: user.username + '#' + user.discriminator,
    avatar: user.avatar, avatarEmoji: user.avatar_emoji, color: user.color, initials: user.initials,
    status: user.status, customStatus: user.custom_status, about: user.about,
    bannerColor: user.banner_color, createdAt: user.created_at,
  };
}

module.exports = router;
module.exports.formatUser = formatUser;