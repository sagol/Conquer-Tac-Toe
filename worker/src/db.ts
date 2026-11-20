// All SQL (plan 5, "SQL"): plain statements, every value bound. No triggers and no upserts (4.3).
export type User = { id: number; handle: string; name: string; created_at: number; google_sub: string | null };
export type Account = User & { banned_until: number | null; deleted_at: number | null };
export type Session = Account & { expires_at: number; started: number };
export type NewUser = Pick<User, 'google_sub' | 'name'> & { email: string | null };

const sql = (db: D1Database, query: string, ...values: unknown[]) => db.prepare(query).bind(...values);
const USER = 'id, handle, name, created_at, google_sub, banned_until, deleted_at';
const SESSION = `SELECT u.id, u.handle, u.name, u.created_at, u.google_sub, u.banned_until, u.deleted_at, s.expires_at,
  s.created_at AS started FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id_hash = ?`;
const ADD_SESSION = 'INSERT INTO sessions (id_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)';
const ADD_USER = `INSERT INTO users (id, google_sub, email, handle, name, created_at) VALUES (?, ?, ?, ?, ?, ?) RETURNING ${USER}`;
const AUDIT = "INSERT INTO audit_log (actor, action, data, at) VALUES (?, 'settings', ?, ?)";

export const session = (db: D1Database, hash: string) => sql(db, SESSION, hash).first<Session>();

export const addSession = (db: D1Database, hash: string, uid: number, now: number, expires: number) =>
  sql(db, ADD_SESSION, hash, uid, now, expires).run();

export const slide = (db: D1Database, hash: string, expires: number) =>
  sql(db, 'UPDATE sessions SET expires_at = ? WHERE id_hash = ?', expires, hash).run();

export const endSession = (db: D1Database, hash: string) =>
  sql(db, 'DELETE FROM sessions WHERE id_hash = ?', hash).run();

export const expireSessions = async (db: D1Database, now: number) =>
  (await sql(db, 'DELETE FROM sessions WHERE expires_at <= ?', now).run()).meta.changes;

export const userBySub = (db: D1Database, sub: string) =>
  sql(db, `SELECT ${USER} FROM users WHERE google_sub = ?`, sub).first<Account>();

export const userByHandle = (db: D1Database, handle: string) =>
  sql(db, `SELECT ${USER} FROM users WHERE handle = ?`, handle).first<Account>();

// D-25: a deleted account gives up its Google subject, so the same Google account signs up afresh.
export const releaseSub = (db: D1Database, sub: string) =>
  sql(db, 'UPDATE users SET google_sub = NULL WHERE google_sub = ? AND deleted_at IS NOT NULL', sub).run();

export const addUser = (db: D1Database, id: number, handle: string, u: NewUser, now: number) =>
  sql(db, ADD_USER, id, u.google_sub, u.email, handle, u.name, now).first<Account>();

export const settingRows = async (db: D1Database) =>
  (await db.prepare('SELECT key, value FROM settings').all<{ key: string; value: string }>()).results;

// One transaction: each key's row replaced by DELETE then INSERT, and one audit row naming the Access subject.
export const writeSettings = (db: D1Database, values: Record<string, unknown>, actor: string, now: number) =>
  db.batch([
    ...Object.entries(values).flatMap(([key, value]) => [
      sql(db, 'DELETE FROM settings WHERE key = ?', key),
      sql(db, 'INSERT INTO settings (key, value) VALUES (?, ?)', key, JSON.stringify(value)),
    ]),
    sql(db, AUDIT, actor, JSON.stringify(values), now),
  ]);

export const ping = async (db: D1Database) => db.prepare('SELECT 1').first();
