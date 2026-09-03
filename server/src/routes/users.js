import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { requireActive } from '../middleware/roles.js';
import { toPublicUser, toPrivateUser } from '../utils/serialize.js';
import { createNotification } from '../utils/notify.js';
import { uploadProfileImage, toPublicPath } from '../utils/upload.js';

const router = Router();

function getCounts(userId) {
  const followers = db.prepare('SELECT COUNT(*) c FROM follows WHERE following_id = ?').get(userId).c;
  const following = db.prepare('SELECT COUNT(*) c FROM follows WHERE follower_id = ?').get(userId).c;
  const posts = db.prepare('SELECT COUNT(*) c FROM posts WHERE author_id = ? AND deleted = 0').get(userId).c;
  return { followers, following, posts };
}

function findUser(username) {
  return db.prepare('SELECT * FROM users WHERE username = ?').get(String(username || '').toLowerCase());
}

router.get('/:username', optionalAuth, (req, res) => {
  const row = findUser(req.params.username);
  if (!row) return res.status(404).json({ error: 'User not found.' });

  const isFollowing = req.user
    ? !!db.prepare('SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?').get(req.user.id, row.id)
    : false;

  res.json({
    user: toPublicUser(row),
    counts: getCounts(row.id),
    isFollowing,
    isSelf: req.user ? req.user.id === row.id : false,
  });
});

router.patch('/me', requireAuth, requireActive, (req, res) => {
  const { displayName, bio, avatarColor } = req.body || {};
  const updates = {};

  if (displayName !== undefined) {
    if (!displayName.trim() || displayName.length > 40) {
      return res.status(400).json({ error: 'Display name must be 1-40 characters.' });
    }
    updates.display_name = displayName.trim();
  }
  if (bio !== undefined) {
    if (bio.length > 160) return res.status(400).json({ error: 'Bio must be 160 characters or fewer.' });
    updates.bio = bio;
  }
  if (avatarColor !== undefined) updates.avatar_color = avatarColor;

  const keys = Object.keys(updates);
  if (keys.length > 0) {
    const setClause = keys.map((k) => `${k} = @${k}`).join(', ');
    db.prepare(`UPDATE users SET ${setClause} WHERE id = @id`).run({ ...updates, id: req.user.id });
  }

  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  res.json({ user: toPrivateUser(updated) });
});

router.post('/me/avatar', requireAuth, requireActive, uploadProfileImage.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image uploaded.' });
  const url = toPublicPath(req.file);
  db.prepare('UPDATE users SET avatar_url = ? WHERE id = ?').run(url, req.user.id);
  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  res.json({ user: toPrivateUser(updated) });
});

router.post('/me/banner', requireAuth, requireActive, uploadProfileImage.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image uploaded.' });
  const url = toPublicPath(req.file);
  db.prepare('UPDATE users SET banner_url = ? WHERE id = ?').run(url, req.user.id);
  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  res.json({ user: toPrivateUser(updated) });
});

router.post('/:username/follow', requireAuth, requireActive, (req, res) => {
  const target = findUser(req.params.username);
  if (!target) return res.status(404).json({ error: 'User not found.' });
  if (target.id === req.user.id) return res.status(400).json({ error: "You can't follow yourself." });

  const already = db
    .prepare('SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?')
    .get(req.user.id, target.id);

  if (!already) {
    db.prepare('INSERT INTO follows (follower_id, following_id, created_at) VALUES (?, ?, ?)').run(
      req.user.id,
      target.id,
      new Date().toISOString()
    );
    createNotification({
      userId: target.id,
      type: 'follow',
      actorId: req.user.id,
      message: `@${req.user.username} followed you.`,
    });
  }
  res.json({ isFollowing: true, counts: getCounts(target.id) });
});

router.delete('/:username/follow', requireAuth, requireActive, (req, res) => {
  const target = findUser(req.params.username);
  if (!target) return res.status(404).json({ error: 'User not found.' });
  db.prepare('DELETE FROM follows WHERE follower_id = ? AND following_id = ?').run(req.user.id, target.id);
  res.json({ isFollowing: false, counts: getCounts(target.id) });
});

router.get('/:username/followers', optionalAuth, (req, res) => {
  const target = findUser(req.params.username);
  if (!target) return res.status(404).json({ error: 'User not found.' });
  const rows = db
    .prepare(
      `SELECT u.* FROM follows f JOIN users u ON u.id = f.follower_id
       WHERE f.following_id = ? ORDER BY f.created_at DESC`
    )
    .all(target.id);
  res.json({ users: rows.map(toPublicUser) });
});

router.get('/:username/following', optionalAuth, (req, res) => {
  const target = findUser(req.params.username);
  if (!target) return res.status(404).json({ error: 'User not found.' });
  const rows = db
    .prepare(
      `SELECT u.* FROM follows f JOIN users u ON u.id = f.following_id
       WHERE f.follower_id = ? ORDER BY f.created_at DESC`
    )
    .all(target.id);
  res.json({ users: rows.map(toPublicUser) });
});

export default router;
