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

// Build PostgreSQL connection string from Railway environment variables
function getPostgresConnectionString() {
  // Try DATABASE_URL first (most common)
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }
  
  // Try DATABASE_PUBLIC_URL (Railway public URL)
  if (process.env.DATABASE_PUBLIC_URL) {
    return process.env.DATABASE_PUBLIC_URL;
  }

  // Try POSTGRES_URL (another Railway convention)
  if (process.env.POSTGRES_URL) {
    return process.env.POSTGRES_URL;
  }

  // Try building from individual Railway PostgreSQL variables
  const host = process.env.PGHOST || process.env.POSTGRES_HOST;
  const port = process.env.PGPORT || process.env.POSTGRES_PORT || '5432';
  const user = process.env.PGUSER || process.env.POSTGRES_USER;
  const password = process.env.PGPASSWORD || process.env.POSTGRES_PASSWORD;
  const database = process.env.PGDATABASE || process.env.POSTGRES_DB;

  if (host && user && password && database) {
    return `postgresql://${user}:${password}@${host}:${port}/${database}`;
  }

  // Log all PG-related env vars for debugging (masked)
  const pgVars = Object.keys(process.env).filter(k => 
    k.includes('PG') || k.includes('POSTGRES') || k.includes('DATABASE')
  );
  process.stdout.write('[DB] Available database env vars: ' + pgVars.join(', ') + '\n');
  
  return null;
}

function getRawDB() {
  if (isPostgres()) {
    if (!pool) {
      const { Pool } = require('pg');
      const connectionString = getPostgresConnectionString();
      
      if (!connectionString) {
        process.stdout.write('[DB] ERROR: No PostgreSQL connection string found!\n');
        process.stdout.write('[DB] Set DATABASE_URL or individual PG* variables.\n');
        throw new Error('No PostgreSQL connection string configured');
      }

      // Mask password in log output
      const maskedUrl = connectionString.replace(/:([^@]+)@/, ':****@');
      process.stdout.write('[DB] Connecting to PostgreSQL: ' + maskedUrl + '\n');

      pool = new Pool({
        connectionString: connectionString,
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