// ============================================
// NEXUS CHAT — Production Server
// Express + Socket.IO + SQLite/PostgreSQL
// ============================================

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const http = require('http');
const { Server: SocketIO } = require('socket.io');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const { initializeDatabase, seedDefaultData } = require('./database');
const { initializeWebSocket } = require('./websocket');
const { requireAuth } = require('./middleware/auth');

// Route imports
const authRoutes = require('./routes/auth');
const serverRoutes = require('./routes/servers');
const messageRoutes = require('./routes/messages');
const friendRoutes = require('./routes/friends');

// ============ APP SETUP ============

const app = express();
const server = http.createServer(app);

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim())
  : [];

const io = new SocketIO(server, {
  cors: {
    origin: allowedOrigins.length > 0 ? allowedOrigins : '*',
    methods: ['GET', 'POST', 'PATCH', 'DELETE']
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['websocket', 'polling']
});

app.set('io', io);
app.set('trust proxy', 1);

// ============ SECURITY MIDDLEWARE ============

// Helmet — sets security headers (CSP relaxed for inline scripts/styles)
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

// Compression
app.use(compression());

// CORS
app.use(cors({
  origin: allowedOrigins.length > 0 ? allowedOrigins : true,
  credentials: true,
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting — general API
const apiLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, please slow down.' },
});

// Stricter rate limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,                   // 20 attempts per 15 min
  message: { success: false, error: 'Too many login attempts. Try again in 15 minutes.' },
});

app.use('/api/', apiLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Request logging (dev only)
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) {
      console.log(`[API] ${req.method} ${req.path}`);
    }
    next();
  });
}

// ============ API ROUTES ============

app.use('/api/auth', authRoutes);
app.use('/api/servers', serverRoutes);
app.use('/api', messageRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api', friendRoutes);

// Channel CRUD (top-level /api/channels/:id)
app.patch('/api/channels/:id', requireAuth, (req, res) => {
  const { getDB } = require('./database');
  try {
    const db = getDB();
    const ch = db.prepare('SELECT * FROM channels WHERE id = ?').get(req.params.id);
    if (!ch) return res.status(404).json({ success: false, error: 'Channel not found' });
    const srv = db.prepare('SELECT * FROM servers WHERE id = ?').get(ch.server_id);
    if (srv.owner_id !== req.user.id) return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    const allowed = ['name', 'topic', 'icon', 'position'];
    const updates = {};
    for (const [k, v] of Object.entries(req.body)) { if (allowed.includes(k)) updates[k] = v; }
    if (!Object.keys(updates).length) return res.status(400).json({ success: false, error: 'Nothing to update' });
    const set = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    db.prepare(`UPDATE channels SET ${set} WHERE id = ?`).run(...Object.values(updates), req.params.id);
    res.json({ success: true, channel: db.prepare('SELECT * FROM channels WHERE id = ?').get(req.params.id) });
  } catch (err) { console.error(err); res.status(500).json({ success: false, error: 'Internal server error' }); }
});

app.delete('/api/channels/:id', requireAuth, (req, res) => {
  const { getDB } = require('./database');
  try {
    const db = getDB();
    const ch = db.prepare('SELECT * FROM channels WHERE id = ?').get(req.params.id);
    if (!ch) return res.status(404).json({ success: false, error: 'Channel not found' });
    const srv = db.prepare('SELECT * FROM servers WHERE id = ?').get(ch.server_id);
    if (srv.owner_id !== req.user.id) return res.status(403).json({ success: false, error: 'Only owner can delete channels' });
    db.prepare('DELETE FROM channels WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ success: false, error: 'Internal server error' }); }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '3.2.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    database: process.env.DATABASE_TYPE || 'sqlite',
    env: process.env.NODE_ENV || 'development',
  });
});

// ============ STATIC FILES ============

const staticDir = path.join(__dirname, '..');
app.use(express.static(staticDir, {
  maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
  etag: true,
}));

// SPA fallback
app.use((req, res, next) => {
  if (!req.path.startsWith('/api/') && req.method === 'GET' && req.accepts('html')) {
    res.sendFile(path.join(staticDir, 'index.html'));
  } else {
    next();
  }
});

// ============ ERROR HANDLING ============

app.use((err, req, res, next) => {
  console.error('[Server] Unhandled error:', err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

// ============ START ============

const PORT = parseInt(process.env.PORT) || 8080;

async function start() {
  try {
    console.log('[Server] Starting Nexus Chat...');
    console.log('[Server] Environment:', process.env.NODE_ENV || 'development');
    console.log('[Server] Database type:', process.env.DATABASE_TYPE || 'sqlite');
    
    // Initialize database (synchronous for SQLite, but wrapped for consistency)
    console.log('[Server] Initializing database...');
    initializeDatabase();
    
    console.log('[Server] Seeding default data...');
    seedDefaultData();
    
    console.log('[Server] Initializing WebSocket...');
    initializeWebSocket(io);

    console.log('[Server] Starting HTTP server on port', PORT);
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`\n========================================`);
      console.log(`  NEXUS CHAT v3.2.0`);
      console.log(`  ${process.env.NODE_ENV === 'production' ? 'PRODUCTION' : 'DEVELOPMENT'}`);
      console.log(`  http://0.0.0.0:${PORT}`);
      console.log(`  DB: ${process.env.DATABASE_TYPE || 'sqlite'}`);
      console.log(`========================================\n`);
    });
  } catch (err) {
    console.error('[Server] FATAL ERROR during startup:', err);
    console.error('[Server] Stack trace:', err.stack);
    process.exit(1);
  }
}

// Handle uncaught errors
process.on('uncaughtException', (err) => {
  console.error('[Server] Uncaught Exception:', err);
  console.error('[Server] Stack:', err.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Server] Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

start();

module.exports = { app, server, io };