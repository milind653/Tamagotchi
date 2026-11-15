import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { query } from './db.js';
import { GameError } from './engine.js';

const scrypt = promisify(crypto.scrypt);
export const COOKIE = 'tama_session';
const SESSION_MS = 30 * 24 * 3600_000;

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

export function validateCredentials(username, password) {
  if (typeof username !== 'string' || !/^[A-Za-z0-9_]{3,20}$/.test(username)) {
    throw new GameError('Username must be 3-20 letters, numbers or underscores.');
  }
  if (typeof password !== 'string' || password.length < 6 || password.length > 128) {
    throw new GameError('Password must be 6-128 characters.');
  }
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt, 64);
  return `${salt.toString('hex')}:${key.toString('hex')}`;
}

async function verifyPassword(password, stored) {
  const [saltHex, keyHex] = stored.split(':');
  const expected = Buffer.from(keyHex, 'hex');
  const actual = await scrypt(password, Buffer.from(saltHex, 'hex'), expected.length);
  return crypto.timingSafeEqual(expected, actual);
}

export async function register(username, password) {
  validateCredentials(username, password);
  const existing = await query('SELECT id FROM users WHERE username = ?', username);
  if (existing.length) throw new GameError('That username is taken.', 409);
  const hash = await hashPassword(password);
  try {
    const res = await query(
      'INSERT INTO users (username, pass_hash, created_at) VALUES (?, ?, ?)',
      username, hash, Date.now(),
    );
    return { id: res.lastID, username };
  } catch (err) {
    if (/unique|constraint/i.test(String(err?.message))) throw new GameError('That username is taken.', 409);
    throw err;
  }
}

export async function login(username, password) {
  if (typeof username !== 'string' || typeof password !== 'string') {
    throw new GameError('Enter your username and password.');
  }
  const rows = await query('SELECT id, username, pass_hash FROM users WHERE username = ?', username);
  const bad = new GameError('Wrong username or password.', 401);
  if (!rows.length) {
    await hashPassword(password); // keep timing similar for unknown users
    throw bad;
  }
  if (!(await verifyPassword(password, rows[0].pass_hash))) throw bad;
  return { id: rows[0].id, username: rows[0].username };
}

export async function createSession(userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const now = Date.now();
  await query(
    'INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
    sha256(token), userId, now, now + SESSION_MS,
  );
  return { token, maxAge: SESSION_MS };
}

export async function destroySession(token) {
  if (token) await query('DELETE FROM sessions WHERE token_hash = ?', sha256(token));
}

export async function userForToken(token) {
  if (typeof token !== 'string' || token.length > 100) return null;
  const rows = await query(
    `SELECT u.id, u.username, s.expires_at FROM sessions s
     JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?`,
    sha256(token),
  );
  if (!rows.length) return null;
  if (rows[0].expires_at < Date.now()) {
    await destroySession(token);
    return null;
  }
  return { id: rows[0].id, username: rows[0].username };
}
