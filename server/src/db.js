import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
// better-sqlite3 is a native module — fine on your own machine, but not
// something a production deploy should ever need to compile. It's loaded
// lazily below, only on the local (no DATABASE_URL) path, so a Postgres
// deployment never touches it at all.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '..', 'data.db');

// Two backends, one interface. Locally (no DATABASE_URL) this runs on a
// zero-setup SQLite file, exactly as before. Given a DATABASE_URL (a hosted
// Postgres, e.g. from Supabase) it talks to that instead — which is what
// makes a real deployment possible, since most free hosts wipe local disk
// files on every restart/redeploy.
//
// Every query in this codebase is written with plain `?` positional
// placeholders (SQLite's native style). The only thing that changes for
// Postgres is rewriting `?` -> `$1, $2, ...` before running it — Postgres
// doesn't understand `?` — so the SQL text itself never has to be
// duplicated or maintained twice.
export const isPostgres = !!process.env.DATABASE_URL;

function toPgSql(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

let pool;
let sqlite;

if (isPostgres) {
  // A local Postgres (used only to test this code path) normally has no TLS
  // set up at all, while a real hosted one (Supabase, Render, etc.) requires
  // it. Skip TLS only for localhost so both work without extra config.
  const isLocalHost = /(^|@)(localhost|127\.0\.0\.1)([:/]|$)/.test(process.env.DATABASE_URL);
  pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    // Supabase (and most hosted Postgres) terminate TLS with a cert chain
    // that isn't always in Node's default trust store — this is the
    // standard way every Postgres hosting guide has you connect from a
    // simple Node app. The connection itself is still encrypted; this only
    // skips validating the certificate chain.
    ssl: isLocalHost ? false : { rejectUnauthorized: false },
  });
} else {
  const { default: Database } = await import('better-sqlite3');
  sqlite = new Database(dbPath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
}

async function get(sql, params = []) {
  if (isPostgres) {
    const { rows } = await pool.query(toPgSql(sql), params);
    return rows[0];
  }
  return sqlite.prepare(sql).get(...params);
}

async function all(sql, params = []) {
  if (isPostgres) {
    const { rows } = await pool.query(toPgSql(sql), params);
    return rows;
  }
  return sqlite.prepare(sql).all(...params);
}

async function run(sql, params = []) {
  if (isPostgres) {
    await pool.query(toPgSql(sql), params);
    return;
  }
  sqlite.prepare(sql).run(...params);
}

// For raw scripts (schema setup, seeding) with no `?` placeholders to worry about.
async function exec(sql) {
  if (isPostgres) {
    await pool.query(sql);
    return;
  }
  sqlite.exec(sql);
}

// The running server (index.js) never calls this — it stays connected for
// the life of the process. One-off scripts (seed.js) call it when they're
// done so Node can exit instead of hanging on an open Postgres connection.
async function close() {
  if (isPostgres) {
    await pool.end();
  } else {
    sqlite.close();
  }
}

// Adds a column to an already-existing table if it's not there yet, so a
// database created before a schema change picks up new columns without
// anyone having to delete/reseed their data.
async function ensureColumn(table, column, definition) {
  if (isPostgres) {
    const { rows } = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND column_name = $2`,
      [table, column]
    );
    if (rows.length === 0) await pool.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  } else {
    const cols = sqlite.prepare(`PRAGMA table_info(${table})`).all();
    if (!cols.some((c) => c.name === column)) sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

export const db = { get, all, run, exec, close, isPostgres };

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  bio TEXT NOT NULL DEFAULT '',
  avatar_color TEXT NOT NULL DEFAULT '#E2231A',
  avatar_url TEXT,
  banner_url TEXT,
  roblox_id TEXT,
  roblox_username TEXT,
  roblox_display_name TEXT,
  roblox_avatar_url TEXT,
  badge TEXT NOT NULL DEFAULT 'none',
  role TEXT NOT NULL DEFAULT 'user',
  status TEXT NOT NULL DEFAULT 'active',
  suspended_until TEXT,
  status_reason TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS follows (
  follower_id TEXT NOT NULL,
  following_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (follower_id, following_id)
);

CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  author_id TEXT NOT NULL,
  text TEXT NOT NULL DEFAULT '',
  images TEXT NOT NULL DEFAULT '[]',
  repost_of TEXT,
  created_at TEXT NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0,
  deleted_reason TEXT,
  flagged INTEGER NOT NULL DEFAULT 0,
  flag_reason TEXT
);

CREATE TABLE IF NOT EXISTS likes (
  user_id TEXT NOT NULL,
  post_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, post_id)
);

CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0,
  deleted_reason TEXT
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  actor_id TEXT,
  post_id TEXT,
  message TEXT NOT NULL,
  read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  reporter_id TEXT,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  resolved_by TEXT,
  resolution_note TEXT,
  created_at TEXT NOT NULL,
  resolved_at TEXT
);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  moderator_id TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  reason TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_posts_author ON posts(author_id);
CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at);
CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);
`;

export async function initDb() {
  await exec(SCHEMA);
  // Migrations for databases created before roblox account linking existed.
  await ensureColumn('users', 'roblox_id', 'TEXT');
  await ensureColumn('users', 'roblox_username', 'TEXT');
  await ensureColumn('users', 'roblox_display_name', 'TEXT');
  await ensureColumn('users', 'roblox_avatar_url', 'TEXT');
}

export default db;
