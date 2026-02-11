// ============================================
// NEXUS CHAT — Production Server
// Express + Socket.IO + SQLite/PostgreSQL
// ============================================

// Force stdout to be unbuffered for Railway logs
process.stdout.write('=== NEXUS CHAT STARTING ===\n');

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

// Health check - must work even before database is ready
app.get('/api/health', (req, res) => {
  process.stdout.write('[Health] Health check requested\n');
  res.json({
    status: 'ok',
    version: '3.2.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    database: process.env.DATABASE_TYPE || 'sqlite',
    env: process.env.NODE_ENV || 'development',
    port: process.env.PORT || 8080,
  });
});

// Root endpoint for quick testing
app.get('/', (req, res) => {
  if (req.accepts('html')) {
    res.sendFile(require('path').join(__dirname, '..', 'index.html'));
  } else {
    res.json({ 
      message: 'Nexus Chat API', 
      version: '3.2.0',
      health: '/api/health' 
    });
  }
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
    process.stdout.write('[Server] Starting Nexus Chat...\n');
    process.stdout.write('[Server] Node version: ' + process.version + '\n');
    process.stdout.write('[Server] Environment: ' + (process.env.NODE_ENV || 'development') + '\n');
    process.stdout.write('[Server] Database type: ' + (process.env.DATABASE_TYPE || 'sqlite') + '\n');
    process.stdout.write('[Server] PORT: ' + PORT + '\n');
    
    // Start HTTP server FIRST so Railway can connect
    process.stdout.write('[Server] Starting HTTP server on port ' + PORT + '...\n');
    await new Promise((resolve, reject) => {
      server.listen(PORT, '0.0.0.0', (err) => {
        if (err) {
          reject(err);
        } else {
          process.stdout.write('[Server] HTTP server listening on 0.0.0.0:' + PORT + '\n');
          resolve();
        }
      });
    });
    
    // Now initialize database
    process.stdout.write('[Server] Initializing database...\n');
    initializeDatabase();
    
    process.stdout.write('[Server] Seeding default data...\n');
    seedDefaultData();
    
    process.stdout.write('[Server] Initializing WebSocket...\n');
    initializeWebSocket(io);

    process.stdout.write('\n========================================\n');
    process.stdout.write('  NEXUS CHAT v3.2.0\n');
    process.stdout.write('  ' + (process.env.NODE_ENV === 'production' ? 'PRODUCTION' : 'DEVELOPMENT') + '\n');
    process.stdout.write('  http://0.0.0.0:' + PORT + '\n');
    process.stdout.write('  DB: ' + (process.env.DATABASE_TYPE || 'sqlite') + '\n');
    process.stdout.write('========================================\n\n');
  } catch (err) {
    process.stdout.write('[Server] FATAL ERROR during startup: ' + err.message + '\n');
    process.stdout.write('[Server] Stack trace: ' + err.stack + '\n');
    process.exit(1);
  }
}

// Handle uncaught errors BEFORE starting
process.on('uncaughtException', (err) => {
  process.stdout.write('[Server] Uncaught Exception: ' + err.message + '\n');
  process.stdout.write('[Server] Stack: ' + err.stack + '\n');
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  process.stdout.write('[Server] Unhandled Rejection: ' + String(reason) + '\n');
  process.exit(1);
});

// Start the server and handle any startup errors
start().catch(err => {
  process.stdout.write('[Server] FATAL: Failed to start: ' + err.message + '\n');
  process.stdout.write('[Server] Stack: ' + err.stack + '\n');
  process.exit(1);
});

module.exports = { app, server, io };