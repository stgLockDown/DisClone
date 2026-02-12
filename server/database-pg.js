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
        color TEXT DEFAULT '#0ea5e9',
        initials TEXT DEFAULT '',
        status TEXT DEFAULT 'online',
        custom_status TEXT DEFAULT '',
        about TEXT DEFAULT 'Hey there! I''m using Nexus Chat.',
        banner_color TEXT DEFAULT '#0ea5e9',
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
    
    const result = await db.query('SELECT COUNT(*) as count FROM users');
    if (parseInt(result.rows[0].count) > 0) {
      process.stdout.write('[DB] Database already seeded, skipping\n');
      return;
    }

    process.stdout.write('[DB] Seeding default data...\n');
    
    const defaultPassword = bcrypt.hashSync('password123', 10);
    
    // ============ USERS ============
    const demoUsers = [
      { id: 'u-alex', email: 'alex@nexus.chat', display_name: 'Alex Rivera', username: 'alexr', discriminator: '1234', color: '#f87171', initials: 'AR', status: 'online', about: 'Server admin. DMs open for questions!' },
      { id: 'u-maya', email: 'maya@nexus.chat', display_name: 'Maya Chen', username: 'mayac', discriminator: '5678', color: '#a78bfa', initials: 'MC', status: 'online', about: 'Moderator | Cat lover 🐱' },
      { id: 'u-jordan', email: 'jordan@nexus.chat', display_name: 'Jordan Lee', username: 'jordanl', discriminator: '9012', color: '#38bdf8', initials: 'JL', status: 'idle', about: 'Just vibing ✌️' },
      { id: 'u-sam', email: 'sam@nexus.chat', display_name: 'Sam Torres', username: 'samt', discriminator: '3456', color: '#06d6a0', initials: 'ST', status: 'dnd', about: 'Do not disturb — deep work mode.' },
      { id: 'u-riley', email: 'riley@nexus.chat', display_name: 'Riley Kim', username: 'rileyk', discriminator: '7890', color: '#f59e0b', initials: 'RK', status: 'online', about: 'Designer & pixel pusher 🎨' },
      { id: 'u-casey', email: 'casey@nexus.chat', display_name: 'Casey Morgan', username: 'caseym', discriminator: '2345', color: '#ec4899', initials: 'CM', status: 'offline', about: 'Offline — catch me later!' },
      { id: 'u-drew', email: 'drew@nexus.chat', display_name: 'Drew Parker', username: 'drewp', discriminator: '6789', color: '#8b5cf6', initials: 'DP', status: 'online', about: 'Full-stack dev 🚀' },
      { id: 'u-avery', email: 'avery@nexus.chat', display_name: 'Avery Brooks', username: 'averyb', discriminator: '0123', color: '#14b8a6', initials: 'AB', status: 'online', about: 'Music is life 🎵' },
      { id: 'u-taylor', email: 'taylor@nexus.chat', display_name: 'Taylor Swift Fan', username: 'taylorf', discriminator: '4567', color: '#e879f9', initials: 'TF', status: 'online', about: 'Swiftie forever 💜' },
    ];

    for (const u of demoUsers) {
      await db.query(
        `INSERT INTO users (id, email, display_name, username, discriminator, password_hash, color, initials, status, about) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [u.id, u.email, u.display_name, u.username, u.discriminator, defaultPassword, u.color, u.initials, u.status, u.about]
      );
    }
    process.stdout.write('[DB] Users seeded\n');

    // ============ SERVERS ============
    const defaultServers = [
      { id: 'srv-nexus-hq', name: 'Nexus HQ', owner_id: 'u-alex', description: 'The official Nexus community server' },
      { id: 'srv-gaming', name: 'Gaming Lounge', owner_id: 'u-jordan', description: 'A place for gamers' },
      { id: 'srv-music', name: 'Music Vibes', owner_id: 'u-avery', description: 'Share and discover music' },
      { id: 'srv-devhub', name: 'Dev Hub', owner_id: 'u-drew', description: 'Developer community' },
      { id: 'srv-art', name: 'Art Studio', owner_id: 'u-riley', description: 'Art community' },
    ];

    for (const s of defaultServers) {
      await db.query(`INSERT INTO servers (id, name, owner_id, description) VALUES ($1, $2, $3, $4)`, [s.id, s.name, s.owner_id, s.description]);
    }
    process.stdout.write('[DB] Servers seeded\n');

    // ============ STANDARD HUBS (added to every server) ============
    const STANDARD_HUBS = [
      {
        name: 'Gaming Hub',
        channels: [
          { name: 'gaming-general', type: 'text', icon: '#', topic: 'General gaming discussions' },
          { name: 'game-night', type: 'text', icon: '#', topic: 'Organize game nights and events' },
          { name: 'lfg', type: 'text', icon: '#', topic: 'Looking for group - find teammates!' },
          { name: 'Gaming Voice', type: 'voice', icon: '🔊', topic: '' },
        ]
      },
      {
        name: 'Music Vibes',
        channels: [
          { name: 'music-chat', type: 'text', icon: '#', topic: 'Talk about music' },
          { name: 'share-tracks', type: 'text', icon: '#', topic: 'Share your favorite songs' },
          { name: 'Music Lounge', type: 'voice', icon: '🔊', topic: '' },
        ]
      },
      {
        name: 'Dev Hub',
        channels: [
          { name: 'dev-chat', type: 'text', icon: '#', topic: 'Developer discussions' },
          { name: 'code-help', type: 'text', icon: '#', topic: 'Get help with coding' },
          { name: 'project-showcase', type: 'text', icon: '#', topic: 'Show off your projects' },
        ]
      },
      {
        name: 'Art Hub',
        channels: [
          { name: 'art-chat', type: 'text', icon: '#', topic: 'Art community discussions' },
          { name: 'art-showcase', type: 'text', icon: '#', topic: 'Share your artwork' },
          { name: 'feedback', type: 'text', icon: '#', topic: 'Get constructive feedback' },
        ]
      },
      {
        name: 'Streamer Hub',
        channels: [
          { name: 'stream-chat', type: 'text', icon: '#', topic: 'Talk about streaming' },
          { name: 'stream-schedule', type: 'text', icon: '#', topic: 'Post your stream schedules' },
          { name: 'watch-party', type: 'text', icon: '#', topic: 'Organize watch parties' },
          { name: 'Stream Room', type: 'voice', icon: '🔊', topic: '' },
        ]
      }
    ];

    // ============ SERVER DATA (roles, members, categories, channels) ============
    const serverData = {
      'srv-nexus-hq': {
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
        },
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
      },
      'srv-gaming': {
        roles: [
          { id: 'role-admin-g', name: 'Admin', color: '#f87171', position: 2 },
          { id: 'role-member-g', name: 'Member', color: '#38bdf8', position: 1 },
        ],
        members: ['u-jordan', 'u-alex', 'u-sam', 'u-drew', 'u-riley'],
        memberRoles: {
          'u-jordan': ['role-admin-g'],
          'u-alex': ['role-member-g'],
          'u-sam': ['role-member-g'],
          'u-drew': ['role-member-g'],
          'u-riley': ['role-member-g'],
        },
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
      },
      'srv-music': {
        roles: [
          { id: 'role-admin-m', name: 'Admin', color: '#14b8a6', position: 2 },
          { id: 'role-member-m', name: 'Member', color: '#0ea5e9', position: 1 },
        ],
        members: ['u-avery', 'u-maya', 'u-taylor', 'u-casey'],
        memberRoles: {
          'u-avery': ['role-admin-m'],
          'u-maya': ['role-member-m'],
          'u-taylor': ['role-member-m'],
          'u-casey': ['role-member-m'],
        },
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
      },
      'srv-devhub': {
        roles: [
          { id: 'role-admin-d', name: 'Admin', color: '#8b5cf6', position: 2 },
          { id: 'role-member-d', name: 'Member', color: '#0ea5e9', position: 1 },
        ],
        members: ['u-drew', 'u-alex', 'u-maya', 'u-jordan', 'u-sam'],
        memberRoles: {
          'u-drew': ['role-admin-d'],
          'u-alex': ['role-member-d'],
          'u-maya': ['role-member-d'],
          'u-jordan': ['role-member-d'],
          'u-sam': ['role-member-d'],
        },
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
      },
      'srv-art': {
        roles: [
          { id: 'role-admin-a', name: 'Admin', color: '#f59e0b', position: 2 },
          { id: 'role-member-a', name: 'Member', color: '#0ea5e9', position: 1 },
        ],
        members: ['u-riley', 'u-maya', 'u-casey', 'u-taylor'],
        memberRoles: {
          'u-riley': ['role-admin-a'],
          'u-maya': ['role-member-a'],
          'u-casey': ['role-member-a'],
          'u-taylor': ['role-member-a'],
        },
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
      },
    };

    // Insert roles, members, member_roles, categories, channels for each server
    for (const srv of defaultServers) {
      const sd = serverData[srv.id];
      if (!sd) continue;

      // Roles
      for (const role of sd.roles) {
        await db.query(`INSERT INTO roles (id, server_id, name, color, position) VALUES ($1, $2, $3, $4, $5)`,
          [role.id, srv.id, role.name, role.color, role.position]);
      }

      // Members
      for (const uid of sd.members) {
        await db.query(`INSERT INTO server_members (server_id, user_id) VALUES ($1, $2)`, [srv.id, uid]);
        // Assign roles
        if (sd.memberRoles[uid]) {
          for (const roleId of sd.memberRoles[uid]) {
            await db.query(`INSERT INTO member_roles (server_id, user_id, role_id) VALUES ($1, $2, $3)`, [srv.id, uid, roleId]);
          }
        }
      }

      // Categories & channels (server-specific)
      let categoryPosition = 0;
      for (let ci = 0; ci < sd.categories.length; ci++) {
        const cat = sd.categories[ci];
        await db.query(`INSERT INTO categories (id, server_id, name, position) VALUES ($1, $2, $3, $4)`,
          [cat.id, srv.id, cat.name, categoryPosition++]);
        for (let chi = 0; chi < cat.channels.length; chi++) {
          const ch = cat.channels[chi];
          await db.query(
            `INSERT INTO channels (id, server_id, category_id, name, type, topic, icon, position, is_dm) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [ch.id, srv.id, cat.id, ch.name, ch.type, ch.topic || '', ch.icon || '#', chi, false]
          );
        }
      }

      // Add standard hubs to every server
      for (const hub of STANDARD_HUBS) {
        const hubCatId = 'cat-' + uuidv4().slice(0, 8);
        await db.query(`INSERT INTO categories (id, server_id, name, position) VALUES ($1, $2, $3, $4)`,
          [hubCatId, srv.id, hub.name, categoryPosition++]);
        
        for (let chi = 0; chi < hub.channels.length; chi++) {
          const ch = hub.channels[chi];
          const channelId = (ch.type === 'voice' ? 'vc-' : 'ch-') + uuidv4().slice(0, 8);
          await db.query(
            `INSERT INTO channels (id, server_id, category_id, name, type, topic, icon, position, is_dm) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [channelId, srv.id, hubCatId, ch.name, ch.type, ch.topic || '', ch.icon || '#', chi, false]
          );
        }
      }
    }
    process.stdout.write('[DB] Servers, roles, members, categories, channels seeded\n');

    // ============ MESSAGES ============
    const now = Date.now();
    const msgs = [
      // Nexus HQ - general
      { user: 'u-alex', channel: 'ch-general', content: 'Hey everyone! Welcome to Nexus HQ 🎉', mins: 60 },
      { user: 'u-maya', channel: 'ch-general', content: 'This server is looking great! Love the new features.', mins: 55 },
      { user: 'u-jordan', channel: 'ch-general', content: 'Just joined, this is awesome!', mins: 50 },
      { user: 'u-drew', channel: 'ch-general', content: "Been working on a new open-source project. It's a real-time collaboration tool built with WebSockets. Would love some feedback!", mins: 45 },
      { user: 'u-riley', channel: 'ch-general', content: 'The UI design is so clean 🎨', mins: 40 },
      { user: 'u-sam', channel: 'ch-general', content: 'Can we get a dark mode? Oh wait, it already has one 😎', mins: 35 },
      { user: 'u-avery', channel: 'ch-general', content: 'Anyone want to hop in voice chat later?', mins: 30 },
      { user: 'u-alex', channel: 'ch-general', content: "Sure! I'll be free in about an hour.", mins: 25 },
      { user: 'u-maya', channel: 'ch-general', content: 'Count me in! 🙋‍♀️', mins: 20 },
      { user: 'u-taylor', channel: 'ch-general', content: 'This is giving me major Discord vibes but better ✨', mins: 15 },
      // Nexus HQ - welcome
      { user: 'u-alex', channel: 'ch-welcome', content: 'Welcome to **Nexus HQ**! Please read the rules and enjoy your stay. 🎉', mins: 120 },
      // Nexus HQ - announcements
      { user: 'u-alex', channel: 'ch-announcements', content: "📢 **Server Update v3.0** — We've added voice channels, streaming, and a brand new theme system! Check it out in Settings → Appearance.", mins: 90 },
      { user: 'u-alex', channel: 'ch-announcements', content: '🎮 **Game Night this Friday!** Join us in the Gaming Room voice channel at 8 PM EST. All are welcome!', mins: 30 },
      // Nexus HQ - dev-talk
      { user: 'u-drew', channel: 'ch-dev', content: 'Anyone here familiar with WebRTC? Trying to implement screen sharing.', mins: 70 },
      { user: 'u-alex', channel: 'ch-dev', content: "Yeah! I've worked with it before. The getUserMedia API is your friend. Happy to help!", mins: 65 },
      { user: 'u-maya', channel: 'ch-dev', content: "There's a great tutorial on MDN. Let me find the link...", mins: 60 },
      // Nexus HQ - memes
      { user: 'u-jordan', channel: 'ch-memes', content: 'When the code works on the first try 🤯', mins: 80 },
      { user: 'u-sam', channel: 'ch-memes', content: 'That never happens and you know it 😂', mins: 75 },
      { user: 'u-riley', channel: 'ch-memes', content: 'CSS is my passion 🎨 *proceeds to center a div for 3 hours*', mins: 50 },
      // Gaming Lounge
      { user: 'u-jordan', channel: 'g-general', content: 'Welcome to the Gaming Lounge! 🎮 What are you all playing?', mins: 100 },
      { user: 'u-alex', channel: 'g-general', content: "Been grinding Elden Ring lately. Can't stop!", mins: 95 },
      { user: 'u-drew', channel: 'g-general', content: 'Anyone up for some Valorant tonight?', mins: 85 },
      { user: 'u-sam', channel: 'g-lfg', content: 'LFG for Destiny 2 raid, need 2 more!', mins: 70 },
      // Music Vibes
      { user: 'u-avery', channel: 'm-general', content: 'Welcome to Music Vibes! 🎵 Share your favorite tracks here.', mins: 110 },
      { user: 'u-taylor', channel: 'm-general', content: "Taylor Swift's new album is absolutely incredible!", mins: 100 },
      { user: 'u-maya', channel: 'm-recs', content: 'If you like indie pop, check out Clairo. Her new stuff is amazing.', mins: 90 },
      // Dev Hub
      { user: 'u-drew', channel: 'd-general', content: 'Welcome to Dev Hub! 🚀 What are you building?', mins: 105 },
      { user: 'u-alex', channel: 'd-js', content: 'Just discovered Bun. The speed is insane compared to Node.', mins: 80 },
      { user: 'u-jordan', channel: 'd-python', content: 'FastAPI is my new favorite framework. So clean!', mins: 75 },
      // Art Studio
      { user: 'u-riley', channel: 'a-general', content: 'Welcome to Art Studio! 🎨 Show us what you create!', mins: 115 },
      { user: 'u-casey', channel: 'a-feedback', content: 'Just finished a new digital painting. Would love some constructive feedback!', mins: 85 },
    ];

    for (const m of msgs) {
      const ts = new Date(now - m.mins * 60000).toISOString();
      await db.query(
        `INSERT INTO messages (id, channel_id, user_id, content, type, created_at) VALUES ($1, $2, $3, $4, $5, $6)`,
        ['msg-' + uuidv4().slice(0, 8), m.channel, m.user, m.content, 'text', ts]
      );
    }
    process.stdout.write('[DB] Messages seeded\n');

    // ============ FRIENDSHIPS ============
    const friendships = [
      ['u-alex', 'u-maya', 'accepted'],
      ['u-maya', 'u-alex', 'accepted'],
      ['u-alex', 'u-drew', 'accepted'],
      ['u-drew', 'u-alex', 'accepted'],
      ['u-jordan', 'u-riley', 'pending'],
    ];
    for (let i = 0; i < friendships.length; i++) {
      const [uid, fid, status] = friendships[i];
      await db.query(`INSERT INTO friendships (id, user_id, friend_id, status) VALUES ($1, $2, $3, $4)`,
        ['fr-' + (i + 1), uid, fid, status]);
    }
    process.stdout.write('[DB] Friendships seeded\n');

    process.stdout.write('[DB] Default data seeded successfully\n');
  } catch (err) {
    process.stdout.write('[DB] FATAL: Seed failed: ' + err.message + '\n');
    process.stdout.write('[DB] Stack: ' + err.stack + '\n');
    throw err;
  }
}

module.exports = { getDB, initializeDatabase, seedDefaultData };