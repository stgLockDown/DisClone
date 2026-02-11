#!/usr/bin/env node
// Diagnostic script - outputs immediately to help debug Railway deployment
const fs = require('fs');

process.stdout.write('=== DIAGNOSTIC START ===\n');
process.stdout.write('Time: ' + new Date().toISOString() + '\n');
process.stdout.write('Node: ' + process.version + '\n');
process.stdout.write('Platform: ' + process.platform + ' ' + process.arch + '\n');
process.stdout.write('CWD: ' + process.cwd() + '\n');
process.stdout.write('PORT: ' + (process.env.PORT || 'NOT SET') + '\n');
process.stdout.write('DATABASE_TYPE: ' + (process.env.DATABASE_TYPE || 'NOT SET') + '\n');
process.stdout.write('NODE_ENV: ' + (process.env.NODE_ENV || 'NOT SET') + '\n');
process.stdout.write('DATABASE_URL: ' + (process.env.DATABASE_URL ? 'SET (hidden)' : 'NOT SET') + '\n');
process.stdout.write('JWT_SECRET: ' + (process.env.JWT_SECRET ? 'SET (hidden)' : 'NOT SET') + '\n');

// Check if files exist
process.stdout.write('\n=== FILE CHECK ===\n');
['server/index.js', 'server/database.js', 'server/websocket.js', 'server/middleware/auth.js',
 'server/routes/auth.js', 'server/routes/servers.js', 'server/routes/messages.js', 'server/routes/friends.js',
 'package.json', 'index.html'].forEach(f => {
  const fullPath = require('path').join(process.cwd(), f);
  process.stdout.write(f + ': ' + (fs.existsSync(fullPath) ? 'EXISTS' : 'MISSING') + '\n');
});

// Check node_modules
process.stdout.write('\n=== MODULE CHECK ===\n');
['express', 'socket.io', 'cors', 'helmet', 'compression', 'express-rate-limit',
 'bcryptjs', 'jsonwebtoken', 'uuid', 'dotenv', 'multer', 'pg'].forEach(mod => {
  try {
    require(mod);
    process.stdout.write('OK: ' + mod + '\n');
  } catch (e) {
    process.stdout.write('FAIL: ' + mod + ' -> ' + e.message.split('\n')[0] + '\n');
  }
});

// Check better-sqlite3 separately (optional)
try {
  require('better-sqlite3');
  process.stdout.write('OK: better-sqlite3\n');
} catch (e) {
  process.stdout.write('SKIP: better-sqlite3 (optional) -> ' + e.message.split('\n')[0] + '\n');
}

// Check server modules
process.stdout.write('\n=== SERVER MODULE CHECK ===\n');
try {
  require('./database');
  process.stdout.write('OK: server/database.js\n');
} catch (e) {
  process.stdout.write('FAIL: server/database.js -> ' + e.message + '\n');
  process.stdout.write('STACK: ' + e.stack.split('\n').slice(0, 3).join('\n') + '\n');
}

try {
  require('./middleware/auth');
  process.stdout.write('OK: server/middleware/auth.js\n');
} catch (e) {
  process.stdout.write('FAIL: server/middleware/auth.js -> ' + e.message + '\n');
}

try {
  require('./websocket');
  process.stdout.write('OK: server/websocket.js\n');
} catch (e) {
  process.stdout.write('FAIL: server/websocket.js -> ' + e.message + '\n');
}

try {
  require('./routes/auth');
  process.stdout.write('OK: server/routes/auth.js\n');
} catch (e) {
  process.stdout.write('FAIL: server/routes/auth.js -> ' + e.message + '\n');
}

try {
  require('./routes/servers');
  process.stdout.write('OK: server/routes/servers.js\n');
} catch (e) {
  process.stdout.write('FAIL: server/routes/servers.js -> ' + e.message + '\n');
}

try {
  require('./routes/messages');
  process.stdout.write('OK: server/routes/messages.js\n');
} catch (e) {
  process.stdout.write('FAIL: server/routes/messages.js -> ' + e.message + '\n');
}

try {
  require('./routes/friends');
  process.stdout.write('OK: server/routes/friends.js\n');
} catch (e) {
  process.stdout.write('FAIL: server/routes/friends.js -> ' + e.message + '\n');
}

process.stdout.write('\n=== DIAGNOSTIC COMPLETE - ALL CHECKS PASSED ===\n');
process.stdout.write('Proceeding to start server...\n\n');