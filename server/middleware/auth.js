// ============================================
// NEXUS CHAT — Auth Middleware (JWT)
// ============================================

require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const jwt = require('jsonwebtoken');
const { dbGet } = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'nexus-dev-fallback-secret-CHANGE-ME';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

function generateToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.split(' ')[1];
  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const user = await dbGet(`
    SELECT id, email, display_name, username, discriminator, avatar, avatar_emoji,
           color, initials, status, custom_status, about, banner_color, created_at
    FROM users WHERE id = ?
  `, decoded.userId);

  if (!user) {
    return res.status(401).json({ error: 'User not found' });
  }

  req.user = user;
  req.token = token;
  next();
}

async function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return next();

  const token = authHeader.split(' ')[1];
  const decoded = verifyToken(token);
  if (decoded) {
    const user = await dbGet(`
      SELECT id, email, display_name, username, discriminator, avatar, avatar_emoji,
             color, initials, status, custom_status, about, banner_color, created_at
      FROM users WHERE id = ?
    `, decoded.userId);
    if (user) { req.user = user; req.token = token; }
  }
  next();
}

async function socketAuth(socket, next) {
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  if (!token) return next(new Error('Authentication required'));

  const decoded = verifyToken(token);
  if (!decoded) return next(new Error('Invalid or expired token'));

  const user = await dbGet(`
    SELECT id, email, display_name, username, discriminator, avatar, avatar_emoji,
           color, initials, status, custom_status, about, banner_color, created_at
    FROM users WHERE id = ?
  `, decoded.userId);

  if (!user) return next(new Error('User not found'));

  socket.user = user;
  next();
}

module.exports = { JWT_SECRET, generateToken, verifyToken, requireAuth, optionalAuth, socketAuth };