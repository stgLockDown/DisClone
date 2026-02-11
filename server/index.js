// ============================================
// NEXUS CHAT - Backend Server
// Express + Socket.IO + SQLite
// ============================================

const express = require('express');
const http = require('http');
const { Server: SocketIO } = require('socket.io');
const cors = require('cors');
const path = require('path');

const { initializeDatabase, seedDefaultData } = require('./database');
const { initializeWebSocket } = require('./websocket');

// Route imports
const authRoutes = require('./routes/auth');
const serverRoutes = require('./routes/servers');
const messageRoutes = require('./routes/messages');
const friendRoutes = require('./routes/friends');

// ============ APP SETUP ============

const app = express();
const server = http.createServer(app);

const io = new SocketIO(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PATCH', 'DELETE']
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

// Make io accessible to routes
app.set('io', io);

// ============ MIDDLEWARE ============

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    console.log(`[API] ${req.method} ${req.path}`);
  }
  next();
});

// ============ API ROUTES ============

app.use('/api/auth', authRoutes);
app.use('/api/servers', serverRoutes);
app.use('/api/servers', serverRoutes);  // Also handles /api/servers/channels/:id via sub-routes
app.use('/api', messageRoutes);         // Handles /api/channels/:id/messages AND /api/messages/:id
app.use('/api/friends', friendRoutes);
app.use('/api', friendRoutes);          // For /api/dms

// Channel update/delete routes (mounted at /api for /api/channels/:id)
const { requireAuth } = require('./middleware/auth');
const { getDB } = require('./database');

// PATCH /api/channels/:id
app.patch('/api/channels/:id', requireAuth, (req, res) => {
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
    res.json({ success: true, channel: updated });
  } catch (err) {
    console.error('[Channels] Update error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// DELETE /api/channels/:id
app.delete('/api/channels/:id', requireAuth, (req, res) => {
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

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============ STATIC FILES ============

// Serve the frontend from the parent directory
app.use(express.static(path.join(__dirname, '..')));

// SPA fallback - serve index.html for all non-API routes
app.use((req, res, next) => {
  if (!req.path.startsWith('/api/') && req.method === 'GET' && req.accepts('html')) {
    res.sendFile(path.join(__dirname, '..', 'index.html'));
  } else {
    next();
  }
});

// ============ ERROR HANDLING ============

app.use((err, req, res, next) => {
  console.error('[Server] Error:', err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

// ============ INITIALIZE ============

const PORT = process.env.PORT || 8080;

// Initialize database
initializeDatabase();
seedDefaultData();

// Initialize WebSocket
initializeWebSocket(io);

// Start server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n========================================`);
  console.log(`  NEXUS CHAT Backend Server`);
  console.log(`  Running on http://localhost:${PORT}`);
  console.log(`  API: http://localhost:${PORT}/api`);
  console.log(`  WebSocket: ws://localhost:${PORT}`);
  console.log(`========================================\n`);
});

module.exports = { app, server, io };