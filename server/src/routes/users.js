import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { requireActive } from '../middleware/roles.js';
import { toPublicUser, toPrivateUser } from '../utils/serialize.js';
import { createNotification } from '../utils/notify.js';
import { uploadProfileImage, fileUrl } from '../utils/upload.js';
import { USERNAME_RE } from './auth.js';

const router = Router();

async function getCounts(userId) {
  const followers = (await db.get('SELECT COUNT(*) c FROM follows WHERE following_id = ?', [userId])).c;
  const following = (await db.get('SELECT COUNT(*) c FROM follows WHERE follower_id = ?', [userId])).c;
  const posts = (await db.get('SELECT COUNT(*) c FROM posts WHERE author_id = ? AND deleted = 0', [userId])).c;
  return { followers, following, posts };
}

async function findUser(username) {
  return await db.get('SELECT * FROM users WHERE username = ?', [String(username || '').toLowerCase()]);
}

router.get('/:username', optionalAuth, async (req, res) => {
  const row = await findUser(req.params.username);
  if (!row) return res.status(404).json({ error: 'User not found.' });

  const isFollowing = req.user
    ? !!(await db.get('SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?', [req.user.id, row.id]))
    : false;

  res.json({
    user: toPublicUser(row),
    counts: await getCounts(row.id),
    isFollowing,
    isSelf: req.user ? req.user.id === row.id : false,
  });
});

router.patch('/me', requireAuth, requireActive, async (req, res) => {
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
    const setClause = keys.map((k) => `${k} = ?`).join(', ');
    await db.run(`UPDATE users SET ${setClause} WHERE id = ?`, [...keys.map((k) => updates[k]), req.user.id]);
  }

  const updated = await db.get('SELECT * FROM users WHERE id = ?', [req.user.id]);
  res.json({ user: toPrivateUser(updated) });
});

router.post('/me/avatar', requireAuth, requireActive, uploadProfileImage.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image uploaded.' });
  const url = await fileUrl(req.file, 'profile');
  await db.run('UPDATE users SET avatar_url = ? WHERE id = ?', [url, req.user.id]);
  const updated = await db.get('SELECT * FROM users WHERE id = ?', [req.user.id]);
  res.json({ user: toPrivateUser(updated) });
});

router.post('/me/banner', requireAuth, requireActive, uploadProfileImage.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image uploaded.' });
  const url = await fileUrl(req.file, 'profile');
  await db.run('UPDATE users SET banner_url = ? WHERE id = ?', [url, req.user.id]);
  const updated = await db.get('SELECT * FROM users WHERE id = ?', [req.user.id]);
  res.json({ user: toPrivateUser(updated) });
});

router.patch('/me/username', requireAuth, requireActive, async (req, res) => {
  const { username, currentPassword } = req.body || {};
  if (!username || !USERNAME_RE.test(username)) {
    return res.status(400).json({ error: 'Username must be 3-20 characters: letters, numbers, underscore.' });
  }
  if (!currentPassword || !bcrypt.compareSync(currentPassword, req.user.password_hash)) {
    return res.status(401).json({ error: 'Current password is incorrect.' });
  }

  const lower = username.toLowerCase();
  if (lower !== req.user.username) {
    const existing = await db.get('SELECT id FROM users WHERE username = ?', [lower]);
    if (existing) return res.status(409).json({ error: 'That username is already taken.' });
  }

  await db.run('UPDATE users SET username = ? WHERE id = ?', [lower, req.user.id]);
  const updated = await db.get('SELECT * FROM users WHERE id = ?', [req.user.id]);
  res.json({ user: toPrivateUser(updated) });
});

router.patch('/me/password', requireAuth, requireActive, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !bcrypt.compareSync(currentPassword, req.user.password_hash)) {
    return res.status(401).json({ error: 'Current password is incorrect.' });
  }
  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters.' });
  }

  const hash = bcrypt.hashSync(newPassword, 10);
  await db.run('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.user.id]);
  res.json({ ok: true });
});

// Looks up a Roblox username via Roblox's public (unauthenticated) API and
// links its id/name/avatar onto this account for display. This is NOT
// ownership verification or "Sign in with Roblox" — anyone can type any
// Roblox username. Real Roblox OAuth would need a developer app registered
// on Roblox's Creator Hub (its own client ID/secret), which only the account
// owner can create, so it's out of scope for a self-contained local project.
router.post('/me/roblox', requireAuth, requireActive, async (req, res) => {
  const name = String((req.body || {}).robloxUsername || '').trim();
  if (!name) return res.status(400).json({ error: 'Enter a Roblox username.' });

  try {
    const lookupRes = await fetch('https://users.roblox.com/v1/usernames/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usernames: [name], excludeBannedUsers: true }),
    });
    if (!lookupRes.ok) throw new Error(`roblox lookup ${lookupRes.status}`);
    const lookupData = await lookupRes.json();
    const match = lookupData?.data?.[0];
    if (!match) {
      return res.status(404).json({ error: `No Roblox account found for "${name}".` });
    }

    let avatarUrl = null;
    try {
      const thumbRes = await fetch(
        `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${match.id}&size=150x150&format=Png&isCircular=false`
      );
      const thumbData = await thumbRes.json();
      avatarUrl = thumbData?.data?.[0]?.imageUrl || null;
    } catch {
      // Avatar thumbnail is best-effort — a failed fetch shouldn't block linking.
    }

    await db.run(
      'UPDATE users SET roblox_id = ?, roblox_username = ?, roblox_display_name = ?, roblox_avatar_url = ? WHERE id = ?',
      [String(match.id), match.name, match.displayName || match.name, avatarUrl, req.user.id]
    );

    const updated = await db.get('SELECT * FROM users WHERE id = ?', [req.user.id]);
    res.json({ user: toPrivateUser(updated) });
  } catch (err) {
    res.status(502).json({ error: "Couldn't reach Roblox right now. Try again in a moment." });
  }
});

router.delete('/me/roblox', requireAuth, requireActive, async (req, res) => {
  await db.run(
    'UPDATE users SET roblox_id = NULL, roblox_username = NULL, roblox_display_name = NULL, roblox_avatar_url = NULL WHERE id = ?',
    [req.user.id]
  );
  const updated = await db.get('SELECT * FROM users WHERE id = ?', [req.user.id]);
  res.json({ user: toPrivateUser(updated) });
});

router.post('/:username/follow', requireAuth, requireActive, async (req, res) => {
  const target = await findUser(req.params.username);
  if (!target) return res.status(404).json({ error: 'User not found.' });
  if (target.id === req.user.id) return res.status(400).json({ error: "You can't follow yourself." });

  const already = await db.get('SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?', [
    req.user.id,
    target.id,
  ]);

  if (!already) {
    await db.run('INSERT INTO follows (follower_id, following_id, created_at) VALUES (?, ?, ?)', [
      req.user.id,
      target.id,
      new Date().toISOString(),
    ]);
    createNotification({
      userId: target.id,
      type: 'follow',
      actorId: req.user.id,
      message: `@${req.user.username} followed you.`,
    });
  }
  res.json({ isFollowing: true, counts: await getCounts(target.id) });
});

router.delete('/:username/follow', requireAuth, requireActive, async (req, res) => {
  const target = await findUser(req.params.username);
  if (!target) return res.status(404).json({ error: 'User not found.' });
  await db.run('DELETE FROM follows WHERE follower_id = ? AND following_id = ?', [req.user.id, target.id]);
  res.json({ isFollowing: false, counts: await getCounts(target.id) });
});

router.get('/:username/followers', optionalAuth, async (req, res) => {
  const target = await findUser(req.params.username);
  if (!target) return res.status(404).json({ error: 'User not found.' });
  const rows = await db.all(
    `SELECT u.* FROM follows f JOIN users u ON u.id = f.follower_id
     WHERE f.following_id = ? ORDER BY f.created_at DESC`,
    [target.id]
  );
  res.json({ users: rows.map(toPublicUser) });
});

router.get('/:username/following', optionalAuth, async (req, res) => {
  const target = await findUser(req.params.username);
  if (!target) return res.status(404).json({ error: 'User not found.' });
  const rows = await db.all(
    `SELECT u.* FROM follows f JOIN users u ON u.id = f.following_id
     WHERE f.follower_id = ? ORDER BY f.created_at DESC`,
    [target.id]
  );
  res.json({ users: rows.map(toPublicUser) });
});

export default router;
