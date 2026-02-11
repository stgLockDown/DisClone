// ============================================
// NEXUS CHAT - Auth Middleware (JWT)
// ============================================

const jwt = require('jsonwebtoken');
const { getDB } = require('../database');

const JWT_SECRET = process.env.JWT_SECRET || 'nexus-chat-secret-key-change-in-production';
const JWT_EXPIRES_IN = '7d';

function generateToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

// Express middleware - attaches req.user
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.split(' ')[1];
  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const db = getDB();
  const user = db.prepare(`
    SELECT id, email, display_name, username, discriminator, avatar, avatar_emoji,
           color, initials, status, custom_status, about, banner_color, created_at
    FROM users WHERE id = ?
  `).get(decoded.userId);

  if (!user) {
    return res.status(401).json({ error: 'User not found' });
  }

  req.user = user;
  req.token = token;
  next();
}

// Optional auth - doesn't fail if no token, but attaches user if present
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split(' ')[1];
  const decoded = verifyToken(token);
  if (decoded) {
    const db = getDB();
    const user = db.prepare(`
      SELECT id, email, display_name, username, discriminator, avatar, avatar_emoji,
             color, initials, status, custom_status, about, banner_color, created_at
      FROM users WHERE id = ?
    `).get(decoded.userId);
    if (user) {
      req.user = user;
      req.token = token;
    }
  }
  next();
}

// Socket.IO auth middleware
function socketAuth(socket, next) {
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  if (!token) {
    return next(new Error('Authentication required'));
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return next(new Error('Invalid or expired token'));
  }

  const db = getDB();
  const user = db.prepare(`
    SELECT id, email, display_name, username, discriminator, avatar, avatar_emoji,
           color, initials, status, custom_status, about, banner_color, created_at
    FROM users WHERE id = ?
  `).get(decoded.userId);

  if (!user) {
    return next(new Error('User not found'));
  }

  socket.user = user;
  next();
}

module.exports = {
  JWT_SECRET,
  generateToken,
  verifyToken,
  requireAuth,
  optionalAuth,
  socketAuth
};