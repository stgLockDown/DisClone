// Simple diagnostic script to test what's failing
process.stdout.write('=== DIAGNOSTIC START ===\n');
process.stdout.write('Node version: ' + process.version + '\n');
process.stdout.write('Platform: ' + process.platform + '\n');
process.stdout.write('Arch: ' + process.arch + '\n');
process.stdout.write('CWD: ' + process.cwd() + '\n');
process.stdout.write('ENV PORT: ' + (process.env.PORT || 'not set') + '\n');
process.stdout.write('ENV DATABASE_TYPE: ' + (process.env.DATABASE_TYPE || 'not set') + '\n');
process.stdout.write('ENV NODE_ENV: ' + (process.env.NODE_ENV || 'not set') + '\n');

process.stdout.write('\n=== TESTING MODULE LOADS ===\n');

try {
  require('dotenv');
  process.stdout.write('✓ dotenv\n');
} catch (e) {
  process.stdout.write('✗ dotenv: ' + e.message + '\n');
}

try {
  require('express');
  process.stdout.write('✓ express\n');
} catch (e) {
  process.stdout.write('✗ express: ' + e.message + '\n');
}

try {
  require('socket.io');
  process.stdout.write('✓ socket.io\n');
} catch (e) {
  process.stdout.write('✗ socket.io: ' + e.message + '\n');
}

try {
  require('better-sqlite3');
  process.stdout.write('✓ better-sqlite3\n');
} catch (e) {
  process.stdout.write('✗ better-sqlite3: ' + e.message + '\n');
}

try {
  require('pg');
  process.stdout.write('✓ pg\n');
} catch (e) {
  process.stdout.write('✗ pg: ' + e.message + '\n');
}

process.stdout.write('\n=== TESTING SERVER MODULES ===\n');

try {
  require('./database');
  process.stdout.write('✓ database.js\n');
} catch (e) {
  process.stdout.write('✗ database.js: ' + e.message + '\n');
  process.stdout.write('Stack: ' + e.stack + '\n');
}

try {
  require('./websocket');
  process.stdout.write('✓ websocket.js\n');
} catch (e) {
  process.stdout.write('✗ websocket.js: ' + e.message + '\n');
}

try {
  require('./middleware/auth');
  process.stdout.write('✓ auth.js\n');
} catch (e) {
  process.stdout.write('✗ auth.js: ' + e.message + '\n');
}

process.stdout.write('\n=== DIAGNOSTIC COMPLETE ===\n');
process.exit(0);