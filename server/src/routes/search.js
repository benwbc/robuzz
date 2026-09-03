import { Router } from 'express';
import { db } from '../db.js';
import { optionalAuth } from '../middleware/auth.js';
import { toPublicUser, toPostDTO } from '../utils/serialize.js';

const router = Router();

router.get('/', optionalAuth, (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json({ users: [], posts: [] });

  const like = `%${q.replace(/^[@#]/, '')}%`;

  const users = db
    .prepare(
      `SELECT * FROM users WHERE status != 'banned' AND (username LIKE ? OR display_name LIKE ?)
       ORDER BY username ASC LIMIT 15`
    )
    .all(like, like)
    .map(toPublicUser);

  const postRows = db
    .prepare(
      `SELECT p.* FROM posts p JOIN users u ON u.id = p.author_id
       WHERE p.deleted = 0 AND u.status != 'banned' AND p.text LIKE ?
       ORDER BY p.created_at DESC LIMIT 25`
    )
    .all(like);

  const posts = postRows.map((row) => {
    const author = db.prepare('SELECT * FROM users WHERE id = ?').get(row.author_id);
    return toPostDTO(row, { author });
  });

  res.json({ users, posts });
});

export default router;
