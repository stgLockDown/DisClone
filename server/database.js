// ============================================
// NEXUS CHAT - Database Layer (SQLite)
// ============================================

const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = path.join(__dirname, 'nexus.db');
let db;

function getDB() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

// ============ SCHEMA ============

function initializeDatabase() {
  const db = getDB();

  db.exec(`
    -- Users table
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      display_name TEXT NOT NULL,
      username TEXT UNIQUE NOT NULL,
      discriminator TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      avatar TEXT DEFAULT NULL,
      avatar_emoji TEXT DEFAULT NULL,
      color TEXT DEFAULT '#0ea5e9',
      initials TEXT DEFAULT '',
      status TEXT DEFAULT 'online' CHECK(status IN ('online','idle','dnd','invisible','offline')),
      custom_status TEXT DEFAULT '',
      about TEXT DEFAULT 'Hey there! I''m using Nexus Chat.',
      banner_color TEXT DEFAULT '#0ea5e9',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Sessions table
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token TEXT UNIQUE NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL
    );

    -- Servers table
    CREATE TABLE IF NOT EXISTS servers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      icon TEXT DEFAULT NULL,
      icon_emoji TEXT DEFAULT NULL,
      owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      description TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Server members
    CREATE TABLE IF NOT EXISTS server_members (
      server_id TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      nickname TEXT DEFAULT NULL,
      joined_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (server_id, user_id)
    );

    -- Server roles
    CREATE TABLE IF NOT EXISTS roles (
      id TEXT PRIMARY KEY,
      server_id TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      color TEXT DEFAULT '#99aab5',
      position INTEGER DEFAULT 0,
      permissions INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Member roles junction
    CREATE TABLE IF NOT EXISTS member_roles (
      server_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      PRIMARY KEY (server_id, user_id, role_id),
      FOREIGN KEY (server_id, user_id) REFERENCES server_members(server_id, user_id) ON DELETE CASCADE
    );

    -- Categories (channel groups)
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      server_id TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      position INTEGER DEFAULT 0
    );

    -- Channels table
    CREATE TABLE IF NOT EXISTS channels (
      id TEXT PRIMARY KEY,
      server_id TEXT REFERENCES servers(id) ON DELETE CASCADE,
      category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'text' CHECK(type IN ('text','voice','dm')),
      topic TEXT DEFAULT '',
      icon TEXT DEFAULT '#',
      position INTEGER DEFAULT 0,
      is_dm INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- DM participants (for DM channels)
    CREATE TABLE IF NOT EXISTS dm_participants (
      channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      PRIMARY KEY (channel_id, user_id)
    );

    -- Messages table
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      type TEXT DEFAULT 'text' CHECK(type IN ('text','system','join','leave')),
      edited_at TEXT DEFAULT NULL,
      deleted INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Message reactions
    CREATE TABLE IF NOT EXISTS reactions (
      id TEXT PRIMARY KEY,
      message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      emoji TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(message_id, user_id, emoji)
    );

    -- Friends / relationships
    CREATE TABLE IF NOT EXISTS friendships (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      friend_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','blocked')),
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, friend_id)
    );

    -- Voice channel state
    CREATE TABLE IF NOT EXISTS voice_state (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
      muted INTEGER DEFAULT 0,
      deafened INTEGER DEFAULT 0,
      joined_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (user_id)
    );

    -- Typing indicators (ephemeral, but useful for cleanup)
    CREATE TABLE IF NOT EXISTS typing_indicators (
      user_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      started_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, channel_id)
    );

    -- Indexes for performance
    CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channel_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_messages_user ON messages(user_id);
    CREATE INDEX IF NOT EXISTS idx_server_members_user ON server_members(user_id);
    CREATE INDEX IF NOT EXISTS idx_server_members_server ON server_members(server_id);
    CREATE INDEX IF NOT EXISTS idx_friendships_user ON friendships(user_id);
    CREATE INDEX IF NOT EXISTS idx_friendships_friend ON friendships(friend_id);
    CREATE INDEX IF NOT EXISTS idx_channels_server ON channels(server_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_reactions_message ON reactions(message_id);
    CREATE INDEX IF NOT EXISTS idx_dm_participants_user ON dm_participants(user_id);
  `);

  console.log('[DB] Database schema initialized');
}

// ============ SEED DATA ============

function seedDefaultData() {
  const db = getDB();

  // Check if already seeded
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
  if (userCount.count > 0) {
    console.log('[DB] Database already seeded, skipping');
    return;
  }

  console.log('[DB] Seeding default data...');

  const defaultPassword = bcrypt.hashSync('password123', 10);
  const colors = ['#f87171', '#a78bfa', '#38bdf8', '#06d6a0', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6', '#e879f9'];

  // Create demo users
  const demoUsers = [
    { id: 'u-alex', email: 'alex@nexus.chat', display_name: 'Alex Rivera', username: 'alexr', discriminator: '1234', color: '#f87171', initials: 'AR', about: 'Server admin. DMs open for questions!' },
    { id: 'u-maya', email: 'maya@nexus.chat', display_name: 'Maya Chen', username: 'mayac', discriminator: '5678', color: '#a78bfa', initials: 'MC', about: 'Moderator | Cat lover 🐱' },
    { id: 'u-jordan', email: 'jordan@nexus.chat', display_name: 'Jordan Lee', username: 'jordanl', discriminator: '9012', color: '#38bdf8', initials: 'JL', about: 'Just vibing ✌️', status: 'idle' },
    { id: 'u-sam', email: 'sam@nexus.chat', display_name: 'Sam Torres', username: 'samt', discriminator: '3456', color: '#06d6a0', initials: 'ST', about: 'Do not disturb — deep work mode.', status: 'dnd' },
    { id: 'u-riley', email: 'riley@nexus.chat', display_name: 'Riley Kim', username: 'rileyk', discriminator: '7890', color: '#f59e0b', initials: 'RK', about: 'Designer & pixel pusher 🎨' },
    { id: 'u-casey', email: 'casey@nexus.chat', display_name: 'Casey Morgan', username: 'caseym', discriminator: '2345', color: '#ec4899', initials: 'CM', about: 'Offline — catch me later!', status: 'offline' },
    { id: 'u-drew', email: 'drew@nexus.chat', display_name: 'Drew Parker', username: 'drewp', discriminator: '6789', color: '#8b5cf6', initials: 'DP', about: 'Full-stack dev 🚀' },
    { id: 'u-avery', email: 'avery@nexus.chat', display_name: 'Avery Brooks', username: 'averyb', discriminator: '0123', color: '#14b8a6', initials: 'AB', about: 'Music is life 🎵' },
    { id: 'u-taylor', email: 'taylor@nexus.chat', display_name: 'Taylor Swift Fan', username: 'taylorf', discriminator: '4567', color: '#e879f9', initials: 'TF', about: 'Swiftie forever 💜' },
  ];

  const insertUser = db.prepare(`
    INSERT INTO users (id, email, display_name, username, discriminator, password_hash, color, initials, status, about)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const u of demoUsers) {
    insertUser.run(u.id, u.email, u.display_name, u.username, u.discriminator, defaultPassword, u.color, u.initials, u.status || 'online', u.about);
  }

  // Create default servers
  const defaultServers = [
    { id: 'srv-nexus-hq', name: 'Nexus HQ', owner_id: 'u-alex', description: 'The official Nexus community server' },
    { id: 'srv-gaming', name: 'Gaming Lounge', owner_id: 'u-jordan', description: 'A place for gamers' },
    { id: 'srv-music', name: 'Music Vibes', owner_id: 'u-avery', description: 'Share and discover music' },
    { id: 'srv-devhub', name: 'Dev Hub', owner_id: 'u-drew', description: 'Developer community' },
    { id: 'srv-art', name: 'Art Studio', owner_id: 'u-riley', description: 'Art community' },
  ];

  const insertServer = db.prepare(`
    INSERT INTO servers (id, name, owner_id, description) VALUES (?, ?, ?, ?)
  `);

  const insertMember = db.prepare(`
    INSERT INTO server_members (server_id, user_id) VALUES (?, ?)
  `);

  const insertCategory = db.prepare(`
    INSERT INTO categories (id, server_id, name, position) VALUES (?, ?, ?, ?)
  `);

  const insertChannel = db.prepare(`
    INSERT INTO channels (id, server_id, category_id, name, type, topic, icon, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertRole = db.prepare(`
    INSERT INTO roles (id, server_id, name, color, position) VALUES (?, ?, ?, ?, ?)
  `);

  const insertMemberRole = db.prepare(`
    INSERT INTO member_roles (server_id, user_id, role_id) VALUES (?, ?, ?)
  `);

  // Seed servers with channels
  const serverChannels = {
    'srv-nexus-hq': {
      categories: [
        { id: 'cat-info', name: 'Information', channels: [
          { id: 'ch-welcome', name: 'welcome', type: 'text', icon: '#', topic: 'Welcome to Nexus HQ! Read the rules and have fun.' },
          { id: 'ch-rules', name: 'rules', type: 'text', icon: '📋', topic: 'Server rules — please read before posting.' },
          { id: 'ch-announcements', name: 'announcements', type: 'text', icon: '📢', topic: 'Important announcements from the admin team.' },
        ]},
        { id: 'cat-general', name: 'General', channels: [
          { id: 'ch-general', name: 'general', type: 'text', icon: '#', topic: 'Welcome to the general channel — say hi!' },
          { id: 'ch-memes', name: 'memes', type: 'text', icon: '#', topic: 'Share your best memes here 😂' },
          { id: 'ch-introductions', name: 'introductions', type: 'text', icon: '#', topic: 'New here? Introduce yourself!' },
        ]},
        { id: 'cat-voice', name: 'Voice Channels', channels: [
          { id: 'vc-general', name: 'General Voice', type: 'voice', icon: '🔊', topic: '' },
          { id: 'vc-music', name: 'Music Lounge', type: 'voice', icon: '🔊', topic: '' },
          { id: 'vc-gaming', name: 'Gaming Room', type: 'voice', icon: '🔊', topic: '' },
        ]},
        { id: 'cat-community', name: 'Community', channels: [
          { id: 'ch-art', name: 'art-showcase', type: 'text', icon: '#', topic: 'Share your artwork!' },
          { id: 'ch-music-share', name: 'music-share', type: 'text', icon: '#', topic: 'Drop your favorite tracks 🎵' },
          { id: 'ch-dev', name: 'dev-talk', type: 'text', icon: '#', topic: 'Programming discussions and help.' },
        ]},
      ],
      roles: [
        { id: 'role-admin-hq', name: 'Admin', color: '#f87171', position: 3 },
        { id: 'role-mod-hq', name: 'Moderator', color: '#a78bfa', position: 2 },
        { id: 'role-member-hq', name: 'Member', color: '#0ea5e9', position: 1 },
      ],
      members: ['u-alex', 'u-maya', 'u-jordan', 'u-sam', 'u-riley', 'u-casey', 'u-drew', 'u-avery', 'u-taylor'],
      memberRoles: {
        'u-alex': ['role-admin-hq', 'role-mod-hq'],
        'u-maya': ['role-mod-hq'],
        'u-jordan': ['role-member-hq'],
        'u-sam': ['role-member-hq'],
        'u-riley': ['role-member-hq'],
        'u-casey': ['role-member-hq'],
        'u-drew': ['role-member-hq'],
        'u-avery': ['role-member-hq'],
        'u-taylor': ['role-member-hq'],
      }
    },
    'srv-gaming': {
      categories: [
        { id: 'cat-g-general', name: 'General', channels: [
          { id: 'g-general', name: 'general', type: 'text', icon: '#', topic: 'General gaming chat' },
          { id: 'g-lfg', name: 'looking-for-group', type: 'text', icon: '#', topic: 'Find teammates here!' },
        ]},
        { id: 'cat-g-games', name: 'Games', channels: [
          { id: 'g-fps', name: 'fps-games', type: 'text', icon: '#', topic: 'FPS game discussions' },
          { id: 'g-rpg', name: 'rpg-games', type: 'text', icon: '#', topic: 'RPG game discussions' },
          { id: 'g-indie', name: 'indie-games', type: 'text', icon: '#', topic: 'Indie game recommendations' },
        ]},
        { id: 'cat-g-voice', name: 'Voice', channels: [
          { id: 'g-vc1', name: 'Game Room 1', type: 'voice', icon: '🔊', topic: '' },
          { id: 'g-vc2', name: 'Game Room 2', type: 'voice', icon: '🔊', topic: '' },
        ]},
      ],
      roles: [
        { id: 'role-admin-g', name: 'Admin', color: '#f87171', position: 2 },
        { id: 'role-member-g', name: 'Member', color: '#38bdf8', position: 1 },
      ],
      members: ['u-jordan', 'u-alex', 'u-sam', 'u-drew', 'u-riley'],
      memberRoles: { 'u-jordan': ['role-admin-g'], 'u-alex': ['role-member-g'], 'u-sam': ['role-member-g'], 'u-drew': ['role-member-g'], 'u-riley': ['role-member-g'] }
    },
    'srv-music': {
      categories: [
        { id: 'cat-m-general', name: 'General', channels: [
          { id: 'm-general', name: 'general', type: 'text', icon: '#', topic: 'Music chat' },
          { id: 'm-recs', name: 'recommendations', type: 'text', icon: '#', topic: 'Share music recommendations' },
        ]},
        { id: 'cat-m-genres', name: 'Genres', channels: [
          { id: 'm-electronic', name: 'electronic', type: 'text', icon: '#', topic: 'Electronic music' },
          { id: 'm-hiphop', name: 'hip-hop', type: 'text', icon: '#', topic: 'Hip-hop and rap' },
          { id: 'm-rock', name: 'rock', type: 'text', icon: '#', topic: 'Rock and alternative' },
        ]},
        { id: 'cat-m-listen', name: 'Listening', channels: [
          { id: 'm-vc', name: 'Listening Party', type: 'voice', icon: '🔊', topic: '' },
        ]},
      ],
      roles: [
        { id: 'role-admin-m', name: 'Admin', color: '#14b8a6', position: 2 },
        { id: 'role-member-m', name: 'Member', color: '#0ea5e9', position: 1 },
      ],
      members: ['u-avery', 'u-maya', 'u-taylor', 'u-casey'],
      memberRoles: { 'u-avery': ['role-admin-m'], 'u-maya': ['role-member-m'], 'u-taylor': ['role-member-m'], 'u-casey': ['role-member-m'] }
    },
    'srv-devhub': {
      categories: [
        { id: 'cat-d-general', name: 'General', channels: [
          { id: 'd-general', name: 'general', type: 'text', icon: '#', topic: 'Developer chat' },
          { id: 'd-help', name: 'help', type: 'text', icon: '#', topic: 'Ask for coding help' },
        ]},
        { id: 'cat-d-langs', name: 'Languages', channels: [
          { id: 'd-js', name: 'javascript', type: 'text', icon: '#', topic: 'JavaScript discussions' },
          { id: 'd-python', name: 'python', type: 'text', icon: '#', topic: 'Python discussions' },
          { id: 'd-rust', name: 'rust', type: 'text', icon: '#', topic: 'Rust discussions' },
        ]},
        { id: 'cat-d-projects', name: 'Projects', channels: [
          { id: 'd-showcase', name: 'project-showcase', type: 'text', icon: '#', topic: 'Show off your projects!' },
          { id: 'd-collab', name: 'collaboration', type: 'text', icon: '#', topic: 'Find collaborators' },
        ]},
      ],
      roles: [
        { id: 'role-admin-d', name: 'Admin', color: '#8b5cf6', position: 2 },
        { id: 'role-member-d', name: 'Member', color: '#0ea5e9', position: 1 },
      ],
      members: ['u-drew', 'u-alex', 'u-maya', 'u-jordan', 'u-sam'],
      memberRoles: { 'u-drew': ['role-admin-d'], 'u-alex': ['role-member-d'], 'u-maya': ['role-member-d'], 'u-jordan': ['role-member-d'], 'u-sam': ['role-member-d'] }
    },
    'srv-art': {
      categories: [
        { id: 'cat-a-general', name: 'General', channels: [
          { id: 'a-general', name: 'general', type: 'text', icon: '#', topic: 'Art community chat' },
          { id: 'a-feedback', name: 'feedback', type: 'text', icon: '#', topic: 'Get feedback on your work' },
        ]},
        { id: 'cat-a-showcase', name: 'Showcase', channels: [
          { id: 'a-digital', name: 'digital-art', type: 'text', icon: '#', topic: 'Digital art showcase' },
          { id: 'a-traditional', name: 'traditional-art', type: 'text', icon: '#', topic: 'Traditional art showcase' },
          { id: 'a-photo', name: 'photography', type: 'text', icon: '#', topic: 'Photography showcase' },
        ]},
      ],
      roles: [
        { id: 'role-admin-a', name: 'Admin', color: '#f59e0b', position: 2 },
        { id: 'role-member-a', name: 'Member', color: '#0ea5e9', position: 1 },
      ],
      members: ['u-riley', 'u-maya', 'u-casey', 'u-taylor'],
      memberRoles: { 'u-riley': ['role-admin-a'], 'u-maya': ['role-member-a'], 'u-casey': ['role-member-a'], 'u-taylor': ['role-member-a'] }
    },
  };

  // Insert everything in a transaction
  const seedTransaction = db.transaction(() => {
    for (const srv of defaultServers) {
      insertServer.run(srv.id, srv.name, srv.owner_id, srv.description);

      const sc = serverChannels[srv.id];
      if (!sc) continue;

      // Roles
      for (const role of sc.roles) {
        insertRole.run(role.id, srv.id, role.name, role.color, role.position);
      }

      // Members
      for (const uid of sc.members) {
        insertMember.run(srv.id, uid);
        // Assign roles
        if (sc.memberRoles[uid]) {
          for (const roleId of sc.memberRoles[uid]) {
            insertMemberRole.run(srv.id, uid, roleId);
          }
        }
      }

      // Categories & channels
      for (let ci = 0; ci < sc.categories.length; ci++) {
        const cat = sc.categories[ci];
        insertCategory.run(cat.id, srv.id, cat.name, ci);
        for (let chi = 0; chi < cat.channels.length; chi++) {
          const ch = cat.channels[chi];
          insertChannel.run(ch.id, srv.id, cat.id, ch.name, ch.type, ch.topic || '', ch.icon || '#', chi);
        }
      }
    }

    // Seed some messages in ch-general
    const insertMessage = db.prepare(`
      INSERT INTO messages (id, channel_id, user_id, content, type, created_at) VALUES (?, ?, ?, ?, ?, ?)
    `);

    const now = new Date();
    const msgs = [
      { user: 'u-alex', content: 'Hey everyone! Welcome to Nexus HQ 🎉', mins: 60 },
      { user: 'u-maya', content: 'This server is looking great! Love the new features.', mins: 55 },
      { user: 'u-jordan', content: 'Just joined, this is awesome!', mins: 50 },
      { user: 'u-drew', content: 'Been working on a new open-source project. It\'s a real-time collaboration tool built with WebSockets. Would love some feedback!', mins: 45 },
      { user: 'u-riley', content: 'The UI design is so clean 🎨', mins: 40 },
      { user: 'u-sam', content: 'Can we get a dark mode? Oh wait, it already has one 😎', mins: 35 },
      { user: 'u-avery', content: 'Anyone want to hop in voice chat later?', mins: 30 },
      { user: 'u-alex', content: 'Sure! I\'ll be free in about an hour.', mins: 25 },
      { user: 'u-maya', content: 'Count me in! 🙋‍♀️', mins: 20 },
      { user: 'u-taylor', content: 'This is giving me major Discord vibes but better ✨', mins: 15 },
    ];

    for (const msg of msgs) {
      const ts = new Date(now.getTime() - msg.mins * 60000).toISOString();
      insertMessage.run('msg-' + uuidv4().slice(0, 8), 'ch-general', msg.user, msg.content, 'text', ts);
    }

    // Seed welcome channel
    insertMessage.run('msg-' + uuidv4().slice(0, 8), 'ch-welcome', 'u-alex', 'Welcome to **Nexus HQ**! Please read the rules and enjoy your stay. 🎉', 'text', new Date(now.getTime() - 120 * 60000).toISOString());

    // Seed announcements
    insertMessage.run('msg-' + uuidv4().slice(0, 8), 'ch-announcements', 'u-alex', '📢 **Server Update v3.0** — We\'ve added voice channels, streaming, and a brand new theme system! Check it out in Settings → Appearance.', 'text', new Date(now.getTime() - 90 * 60000).toISOString());
    insertMessage.run('msg-' + uuidv4().slice(0, 8), 'ch-announcements', 'u-alex', '🎮 **Game Night this Friday!** Join us in the Gaming Room voice channel at 8 PM EST. All are welcome!', 'text', new Date(now.getTime() - 30 * 60000).toISOString());

    // Seed dev-talk
    insertMessage.run('msg-' + uuidv4().slice(0, 8), 'ch-dev', 'u-drew', 'Anyone here familiar with WebRTC? Trying to implement screen sharing.', 'text', new Date(now.getTime() - 70 * 60000).toISOString());
    insertMessage.run('msg-' + uuidv4().slice(0, 8), 'ch-dev', 'u-alex', 'Yeah! I\'ve worked with it before. The getUserMedia API is your friend. Happy to help!', 'text', new Date(now.getTime() - 65 * 60000).toISOString());
    insertMessage.run('msg-' + uuidv4().slice(0, 8), 'ch-dev', 'u-maya', 'There\'s a great tutorial on MDN. Let me find the link...', 'text', new Date(now.getTime() - 60 * 60000).toISOString());

    // Seed memes channel
    insertMessage.run('msg-' + uuidv4().slice(0, 8), 'ch-memes', 'u-jordan', 'When the code works on the first try 🤯', 'text', new Date(now.getTime() - 80 * 60000).toISOString());
    insertMessage.run('msg-' + uuidv4().slice(0, 8), 'ch-memes', 'u-sam', 'That never happens and you know it 😂', 'text', new Date(now.getTime() - 75 * 60000).toISOString());
    insertMessage.run('msg-' + uuidv4().slice(0, 8), 'ch-memes', 'u-riley', 'CSS is my passion 🎨 *proceeds to center a div for 3 hours*', 'text', new Date(now.getTime() - 50 * 60000).toISOString());

    // Seed some friendships
    const insertFriendship = db.prepare(`
      INSERT INTO friendships (id, user_id, friend_id, status) VALUES (?, ?, ?, ?)
    `);

    // Alex and Maya are friends
    insertFriendship.run('fr-' + uuidv4().slice(0, 8), 'u-alex', 'u-maya', 'accepted');
    insertFriendship.run('fr-' + uuidv4().slice(0, 8), 'u-maya', 'u-alex', 'accepted');

    // Alex and Drew are friends
    insertFriendship.run('fr-' + uuidv4().slice(0, 8), 'u-alex', 'u-drew', 'accepted');
    insertFriendship.run('fr-' + uuidv4().slice(0, 8), 'u-drew', 'u-alex', 'accepted');

    // Jordan sent request to Riley (pending)
    insertFriendship.run('fr-' + uuidv4().slice(0, 8), 'u-jordan', 'u-riley', 'pending');
  });

  seedTransaction();
  console.log('[DB] Default data seeded successfully');
}

module.exports = { getDB, initializeDatabase, seedDefaultData };