// ============================================
// NEXUS CHAT - PostgreSQL Database Layer
// ============================================

const { getRawDB: getDB } = require('./db');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

async function initializeDatabase() {
  try {
    process.stdout.write('[DB] Initializing PostgreSQL schema...\n');
    const db = getDB();
    
    // Test connection first
    process.stdout.write('[DB] Testing PostgreSQL connection...\n');
    const testResult = await db.query('SELECT NOW() as now, current_database() as db, current_user as usr');
    process.stdout.write('[DB] PostgreSQL connected at: ' + testResult.rows[0].now + '\n');
    process.stdout.write('[DB] Database: ' + testResult.rows[0].db + ', User: ' + testResult.rows[0].usr + '\n');

    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        display_name TEXT NOT NULL,
        username TEXT UNIQUE NOT NULL,
        discriminator TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        avatar TEXT DEFAULT NULL,
        avatar_emoji TEXT DEFAULT NULL,
        color TEXT DEFAULT '#dc2626',
        initials TEXT DEFAULT '',
        status TEXT DEFAULT 'online',
        custom_status TEXT DEFAULT '',
        about TEXT DEFAULT 'Hey there! I''m using Nexus Chat.',
        banner_color TEXT DEFAULT '#dc2626',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token TEXT UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        expires_at TIMESTAMP NOT NULL
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS servers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        icon TEXT DEFAULT NULL,
        icon_emoji TEXT DEFAULT NULL,
        owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        description TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS server_members (
        server_id TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        nickname TEXT DEFAULT NULL,
        joined_at TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (server_id, user_id)
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id TEXT PRIMARY KEY,
        server_id TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        color TEXT DEFAULT '#99aab5',
        position INTEGER DEFAULT 0,
        permissions INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS member_roles (
        server_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
        PRIMARY KEY (server_id, user_id, role_id)
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        server_id TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        position INTEGER DEFAULT 0
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS channels (
        id TEXT PRIMARY KEY,
        server_id TEXT REFERENCES servers(id) ON DELETE CASCADE,
        category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'text',
        topic TEXT DEFAULT '',
        icon TEXT DEFAULT '#',
        position INTEGER DEFAULT 0,
        is_dm BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS dm_participants (
        channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        PRIMARY KEY (channel_id, user_id)
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        type TEXT DEFAULT 'text',
        edited_at TIMESTAMP DEFAULT NULL,
        deleted BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS reactions (
        id TEXT PRIMARY KEY,
        message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        emoji TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(message_id, user_id, emoji)
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS friendships (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        friend_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, friend_id)
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS voice_state (
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
        muted BOOLEAN DEFAULT FALSE,
        deafened BOOLEAN DEFAULT FALSE,
        joined_at TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (user_id)
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS typing_indicators (
        user_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        started_at TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (user_id, channel_id)
      )
    `);

    // Indexes
    // Invites table
    await db.query(`
      CREATE TABLE IF NOT EXISTS invites (
        id TEXT PRIMARY KEY,
        code TEXT UNIQUE NOT NULL,
        server_id TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
        creator_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        max_uses INTEGER DEFAULT 0,
        uses INTEGER DEFAULT 0,
        expires_at TIMESTAMP DEFAULT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await db.query(`CREATE INDEX IF NOT EXISTS idx_invites_code ON invites(code)`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_invites_server ON invites(server_id)`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channel_id, created_at DESC)`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_messages_user ON messages(user_id)`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_server_members_user ON server_members(user_id)`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_server_members_server ON server_members(server_id)`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_friendships_user ON friendships(user_id)`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_friendships_friend ON friendships(friend_id)`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_channels_server ON channels(server_id)`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token)`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_reactions_message ON reactions(message_id)`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_dm_participants_user ON dm_participants(user_id)`);
    
    process.stdout.write('[DB] PostgreSQL schema initialized successfully\n');
  } catch (err) {
    process.stdout.write('[DB] FATAL: Schema init failed: ' + err.message + '\n');
    throw err;
  }
}

async function seedDefaultData() {
  try {
    const db = getDB();
    
    // Production mode — no demo data seeded
    // Users create their own accounts, servers, and channels
    process.stdout.write('[DB] Production mode — no seed data needed\n');
    
  } catch (err) {
    process.stdout.write('[DB] FATAL: Seed failed: ' + err.message + '\n');
    process.stdout.write('[DB] Stack: ' + err.stack + '\n');
    throw err;
  }
}

module.exports = { getDB, initializeDatabase, seedDefaultData };