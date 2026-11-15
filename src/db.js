import { Database } from '@sqlitecloud/drivers';

let db = null;

function getDb() {
  if (db) return db;
  const url = process.env.SQLITECLOUD_URL;
  if (!url) throw new Error('SQLITECLOUD_URL is not set. Copy .env.example to .env and fill it in.');
  db = new Database(url);
  return db;
}

function reset() {
  const old = db;
  db = null;
  try { old?.close(); } catch { /* connection already gone */ }
}

const isConnectionError = (err) =>
  /connection|socket|ECONN|ETIMEDOUT|EPIPE|closed|not connected/i.test(String(err?.message ?? err));

// Runs a statement with positional `?` params. Retries once on a dropped connection.
export async function query(sql, ...params) {
  for (let attempt = 0; ; attempt++) {
    try {
      const conn = getDb();
      const res = await conn.sql(sql, ...params);
      return Array.isArray(res) ? res.map((r) => ({ ...r })) : res;
    } catch (err) {
      if (attempt === 0 && isConnectionError(err)) {
        reset();
        continue;
      }
      throw err;
    }
  }
}

export async function closeDb() {
  reset();
}

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    pass_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS pets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    species TEXT NOT NULL,
    stage TEXT NOT NULL,
    form TEXT,
    born_at INTEGER NOT NULL,
    last_tick INTEGER NOT NULL,
    hunger REAL NOT NULL,
    happiness REAL NOT NULL,
    energy REAL NOT NULL,
    hygiene REAL NOT NULL,
    health REAL NOT NULL,
    poop INTEGER NOT NULL DEFAULT 0,
    digest INTEGER NOT NULL DEFAULT 0,
    sleeping INTEGER NOT NULL DEFAULT 0,
    sick INTEGER NOT NULL DEFAULT 0,
    weight REAL NOT NULL DEFAULT 5,
    mistakes INTEGER NOT NULL DEFAULT 0,
    alive INTEGER NOT NULL DEFAULT 1,
    died_at INTEGER,
    cause TEXT,
    games_played INTEGER NOT NULL DEFAULT 0,
    games_won INTEGER NOT NULL DEFAULT 0,
    meals INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE INDEX IF NOT EXISTS idx_pets_user ON pets (user_id, alive)`,
  `CREATE TABLE IF NOT EXISTS pet_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pet_id INTEGER NOT NULL,
    at INTEGER NOT NULL,
    text TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_events_pet ON pet_events (pet_id, at)`,
];

export async function initSchema() {
  for (const stmt of SCHEMA) await query(stmt);
}
