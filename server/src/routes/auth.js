import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { db } from '../db.js';
import { signToken, requireAuth } from '../middleware/auth.js';
import { toPrivateUser } from '../utils/serialize.js';

const router = Router();

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const AVATAR_COLORS = ['#E2231A', '#0074E4', '#00BA7C', '#F2B90C', '#8B5CF6', '#FF6B00'];

router.post('/signup', (req, res) => {
  const { username, displayName, email, password } = req.body || {};

  if (!username || !USERNAME_RE.test(username)) {
    return res.status(400).json({ error: 'Username must be 3-20 characters: letters, numbers, underscore.' });
  }
  if (!displayName || !displayName.trim() || displayName.length > 40) {
    return res.status(400).json({ error: 'Display name is required (max 40 characters).' });
  }
  if (!email || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'A valid email address is required.' });
  }
  if (!password || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  const existing = db
    .prepare('SELECT id FROM users WHERE username = ? OR email = ?')
    .get(username.toLowerCase(), email.toLowerCase());
  if (existing) {
    return res.status(409).json({ error: 'That username or email is already taken.' });
  }

  const user = {
    id: randomUUID(),
    username: username.toLowerCase(),
    display_name: displayName.trim(),
    email: email.toLowerCase(),
    password_hash: bcrypt.hashSync(password, 10),
    avatar_color: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
    created_at: new Date().toISOString(),
  };

  db.prepare(
    `INSERT INTO users (id, username, display_name, email, password_hash, avatar_color, created_at)
     VALUES (@id, @username, @display_name, @email, @password_hash, @avatar_color, @created_at)`
  ).run(user);

  const full = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  const token = signToken(full);
  res.status(201).json({ token, user: toPrivateUser(full) });
});

router.post('/login', (req, res) => {
  const { identifier, password } = req.body || {};
  if (!identifier || !password) {
    return res.status(400).json({ error: 'Username/email and password are required.' });
  }

  const row = db
    .prepare('SELECT * FROM users WHERE username = ? OR email = ?')
    .get(identifier.toLowerCase(), identifier.toLowerCase());

  if (!row || !bcrypt.compareSync(password, row.password_hash)) {
    return res.status(401).json({ error: 'Incorrect username/email or password.' });
  }

  if (row.status === 'banned') {
    return res
      .status(403)
      .json({ error: 'This account has been banned.', reason: row.status_reason || null, status: 'banned' });
  }

  if (row.status === 'suspended') {
    const until = row.suspended_until ? new Date(row.suspended_until) : null;
    if (until && until.getTime() <= Date.now()) {
      db.prepare("UPDATE users SET status = 'active', suspended_until = NULL WHERE id = ?").run(row.id);
      row.status = 'active';
      row.suspended_until = null;
    } else {
      return res.status(403).json({
        error: 'This account is temporarily suspended.',
        reason: row.status_reason || null,
        suspendedUntil: row.suspended_until || null,
        status: 'suspended',
      });
    }
  }

  const token = signToken(row);
  res.json({ token, user: toPrivateUser(row) });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: toPrivateUser(req.user) });
});

export default router;
