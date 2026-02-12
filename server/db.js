// ============================================
// NEXUS CHAT - Unified Database Helper
// Wraps SQLite (sync) and PostgreSQL (async)
// All route handlers should use these helpers
// ============================================

const DATABASE_TYPE = process.env.DATABASE_TYPE || 'sqlite';

let pool = null;
let sqliteDb = null;

function isPostgres() {
  return DATABASE_TYPE === 'postgres';
}

function getRawDB() {
  if (isPostgres()) {
    if (!pool) {
      const { Pool } = require('pg');
      pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      });
      pool.on('error', (err) => {
        process.stdout.write('[DB] Pool error: ' + err.message + '\n');
      });
    }
    return pool;
  } else {
    if (!sqliteDb) {
      const Database = require('better-sqlite3');
      const path = require('path');
      const DB_PATH = path.join(__dirname, 'nexus.db');
      sqliteDb = new Database(DB_PATH);
      sqliteDb.pragma('journal_mode = WAL');
      sqliteDb.pragma('foreign_keys = ON');
    }
    return sqliteDb;
  }
}

// Convert ? placeholders to $1, $2, etc for PostgreSQL
function toPg(sql) {
  let idx = 0;
  let pgSql = sql.replace(/\?/g, () => `$${++idx}`);
  // INSERT OR IGNORE -> INSERT ... ON CONFLICT DO NOTHING
  if (/INSERT OR IGNORE/i.test(sql)) {
    pgSql = pgSql.replace(/INSERT OR IGNORE/gi, 'INSERT');
    // Find the closing paren of VALUES(...) and add ON CONFLICT
    const valuesMatch = pgSql.match(/(VALUES\s*\([^)]+\))/i);
    if (valuesMatch) {
      pgSql = pgSql.replace(valuesMatch[0], valuesMatch[0] + ' ON CONFLICT DO NOTHING');
    }
  }
  // datetime('now') -> NOW()
  pgSql = pgSql.replace(/datetime\('now'\)/gi, 'NOW()');
  return pgSql;
}

// ============================================
// Unified async query functions
// These work with both SQLite and PostgreSQL
// ============================================

// Get one row
async function dbGet(sql, ...params) {
  if (isPostgres()) {
    const result = await pool.query(toPg(sql), params);
    return result.rows[0] || null;
  } else {
    return sqliteDb.prepare(sql).get(...params);
  }
}

// Get all rows
async function dbAll(sql, ...params) {
  if (isPostgres()) {
    const result = await pool.query(toPg(sql), params);
    return result.rows;
  } else {
    return sqliteDb.prepare(sql).all(...params);
  }
}

// Run a mutation (INSERT, UPDATE, DELETE)
async function dbRun(sql, ...params) {
  if (isPostgres()) {
    const result = await pool.query(toPg(sql), params);
    return { changes: result.rowCount };
  } else {
    return sqliteDb.prepare(sql).run(...params);
  }
}

// Execute raw SQL (for schema creation etc)
async function dbExec(sql) {
  if (isPostgres()) {
    return pool.query(sql);
  } else {
    return sqliteDb.exec(sql);
  }
}

module.exports = { getRawDB, isPostgres, dbGet, dbAll, dbRun, dbExec, toPg };