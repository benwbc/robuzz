import { Router } from 'express';
import { db } from '../db.js';
import { optionalAuth } from '../middleware/auth.js';
import { toPublicUser, toPostDTO } from '../utils/serialize.js';

const router = Router();

router.get('/', optionalAuth, async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json({ users: [], posts: [] });

  const like = `%${q.replace(/^[@#]/, '')}%`;

  const users = (
    await db.all(
      `SELECT * FROM users WHERE status != 'banned' AND (username LIKE ? OR display_name LIKE ?)
       ORDER BY username ASC LIMIT 15`,
      [like, like]
    )
  ).map(toPublicUser);

  const postRows = await db.all(
    `SELECT p.* FROM posts p JOIN users u ON u.id = p.author_id
     WHERE p.deleted = 0 AND u.status != 'banned' AND p.text LIKE ?
     ORDER BY p.created_at DESC LIMIT 25`,
    [like]
  );

  const posts = await Promise.all(
    postRows.map(async (row) => {
      const author = await db.get('SELECT * FROM users WHERE id = ?', [row.author_id]);
      return toPostDTO(row, { author });
    })
  );

  res.json({ users, posts });
});

export default router;
