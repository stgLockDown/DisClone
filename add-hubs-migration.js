// ============================================
// Add 5 Standard Hubs to All Servers
// ============================================

require('dotenv').config();
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false
});

const STANDARD_HUBS = [
  {
    name: 'Gaming Hub',
    emoji: '🎮',
    channels: [
      { name: 'gaming-general', icon: '#', topic: 'General gaming discussions' },
      { name: 'game-night', icon: '#', topic: 'Organize game nights and events' },
      { name: 'lfg', icon: '#', topic: 'Looking for group - find teammates!' },
      { name: 'Gaming Voice', type: 'voice', icon: '🔊', topic: '' },
    ]
  },
  {
    name: 'Music Vibes',
    emoji: '🎵',
    channels: [
      { name: 'music-chat', icon: '#', topic: 'Talk about music' },
      { name: 'share-tracks', icon: '#', topic: 'Share your favorite songs' },
      { name: 'Music Lounge', type: 'voice', icon: '🔊', topic: '' },
    ]
  },
  {
    name: 'Dev Hub',
    emoji: '⚡',
    channels: [
      { name: 'dev-chat', icon: '#', topic: 'Developer discussions' },
      { name: 'code-help', icon: '#', topic: 'Get help with coding' },
      { name: 'project-showcase', icon: '#', topic: 'Show off your projects' },
    ]
  },
  {
    name: 'Art Hub',
    emoji: '🎨',
    channels: [
      { name: 'art-chat', icon: '#', topic: 'Art community discussions' },
      { name: 'art-showcase', icon: '#', topic: 'Share your artwork' },
      { name: 'feedback', icon: '#', topic: 'Get constructive feedback' },
    ]
  },
  {
    name: 'Streamer Hub',
    emoji: '📺',
    channels: [
      { name: 'stream-chat', icon: '#', topic: 'Talk about streaming' },
      { name: 'stream-schedule', icon: '#', topic: 'Post your stream schedules' },
      { name: 'watch-party', icon: '#', topic: 'Organize watch parties' },
      { name: 'Stream Room', type: 'voice', icon: '🔊', topic: '' },
    ]
  }
];

async function addHubsToAllServers() {
  try {
    console.log('[Migration] Starting hub addition...');
    
    // Get all servers
    const serversResult = await pool.query('SELECT id, name FROM servers ORDER BY name');
    const servers = serversResult.rows;
    
    console.log(`[Migration] Found ${servers.length} servers`);
    
    for (const server of servers) {
      console.log(`\n[Migration] Processing server: ${server.name} (${server.id})`);
      
      // Get current max position for categories
      const maxPosResult = await pool.query(
        'SELECT COALESCE(MAX(position), -1) as max_pos FROM categories WHERE server_id = $1',
        [server.id]
      );
      let categoryPosition = maxPosResult.rows[0].max_pos + 1;
      
      for (const hub of STANDARD_HUBS) {
        // Check if this hub already exists
        const existingHub = await pool.query(
          'SELECT id FROM categories WHERE server_id = $1 AND name = $2',
          [server.id, hub.name]
        );
        
        if (existingHub.rows.length > 0) {
          console.log(`  ✓ ${hub.name} already exists, skipping`);
          continue;
        }
        
        // Create category
        const categoryId = 'cat-' + uuidv4().slice(0, 8);
        await pool.query(
          'INSERT INTO categories (id, server_id, name, position) VALUES ($1, $2, $3, $4)',
          [categoryId, server.id, hub.name, categoryPosition]
        );
        console.log(`  + Created category: ${hub.name}`);
        
        // Create channels
        for (let i = 0; i < hub.channels.length; i++) {
          const ch = hub.channels[i];
          const channelId = (ch.type === 'voice' ? 'vc-' : 'ch-') + uuidv4().slice(0, 8);
          await pool.query(
            'INSERT INTO channels (id, server_id, category_id, name, type, topic, icon, position, is_dm) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
            [channelId, server.id, categoryId, ch.name, ch.type || 'text', ch.topic || '', ch.icon || '#', i, false]
          );
          console.log(`    - Added channel: ${ch.name} (${ch.type || 'text'})`);
        }
        
        categoryPosition++;
      }
    }
    
    console.log('\n[Migration] ✅ Hub addition complete!');
    
    // Show final stats
    const statsResult = await pool.query(`
      SELECT s.name, COUNT(DISTINCT c.id) as categories, COUNT(DISTINCT ch.id) as channels
      FROM servers s
      LEFT JOIN categories c ON c.server_id = s.id
      LEFT JOIN channels ch ON ch.server_id = s.id
      GROUP BY s.id, s.name
      ORDER BY s.name
    `);
    
    console.log('\n[Migration] Final server stats:');
    for (const row of statsResult.rows) {
      console.log(`  ${row.name}: ${row.categories} categories, ${row.channels} channels`);
    }
    
  } catch (err) {
    console.error('[Migration] Error:', err);
    throw err;
  } finally {
    await pool.end();
  }
}

addHubsToAllServers().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});