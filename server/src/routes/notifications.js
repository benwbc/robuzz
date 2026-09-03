import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { toPublicUser } from '../utils/serialize.js';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
  const rows = await db.all(
    'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 100',
    [req.user.id]
  );

  const notifications = await Promise.all(
    rows.map(async (n) => ({
      id: n.id,
      type: n.type,
      message: n.message,
      postId: n.post_id,
      read: !!n.read,
      createdAt: n.created_at,
      actor: n.actor_id ? toPublicUser(await db.get('SELECT * FROM users WHERE id = ?', [n.actor_id])) : null,
    }))
  );

  const unreadCount = (
    await db.get('SELECT COUNT(*) c FROM notifications WHERE user_id = ? AND read = 0', [req.user.id])
  ).c;

  res.json({ notifications, unreadCount });
});

router.post('/:id/read', requireAuth, async (req, res) => {
  await db.run('UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  res.json({ ok: true });
});

router.post('/read-all', requireAuth, async (req, res) => {
  await db.run('UPDATE notifications SET read = 1 WHERE user_id = ?', [req.user.id]);
  res.json({ ok: true });
});

export default router;
