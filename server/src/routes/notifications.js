import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { toPublicUser } from '../utils/serialize.js';

const router = Router();

router.get('/', requireAuth, (req, res) => {
  const rows = db
    .prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 100')
    .all(req.user.id);

  const notifications = rows.map((n) => ({
    id: n.id,
    type: n.type,
    message: n.message,
    postId: n.post_id,
    read: !!n.read,
    createdAt: n.created_at,
    actor: n.actor_id ? toPublicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(n.actor_id)) : null,
  }));

  const unreadCount = db
    .prepare('SELECT COUNT(*) c FROM notifications WHERE user_id = ? AND read = 0')
    .get(req.user.id).c;

  res.json({ notifications, unreadCount });
});

router.post('/:id/read', requireAuth, (req, res) => {
  db.prepare('UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

router.post('/read-all', requireAuth, (req, res) => {
  db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ?').run(req.user.id);
  res.json({ ok: true });
});

export default router;
