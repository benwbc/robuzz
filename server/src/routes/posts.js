import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { db } from '../db.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { requireActive } from '../middleware/roles.js';
import { toPostDTO, toCommentDTO } from '../utils/serialize.js';
import { uploadPostImages, toPublicPath, pagination } from '../utils/upload.js';
import { createNotification } from '../utils/notify.js';
import { scanContent } from '../utils/contentFilter.js';
import { extractMentions } from '../utils/text.js';

const router = Router();

const MAX_TEXT_LENGTH = 500;
const MAX_COMMENT_LENGTH = 300;

function getUserById(id) {
  return id ? db.prepare('SELECT * FROM users WHERE id = ?').get(id) : null;
}

function hydratePost(row, viewerId) {
  const author = getUserById(row.author_id);
  const likedByMe = viewerId
    ? !!db.prepare('SELECT 1 FROM likes WHERE user_id = ? AND post_id = ?').get(viewerId, row.id)
    : false;
  const likeCount = db.prepare('SELECT COUNT(*) c FROM likes WHERE post_id = ?').get(row.id).c;
  const commentCount = db.prepare('SELECT COUNT(*) c FROM comments WHERE post_id = ? AND deleted = 0').get(row.id).c;
  const repostCount = db.prepare('SELECT COUNT(*) c FROM posts WHERE repost_of = ? AND deleted = 0').get(row.id).c;
  const repostedByMe = viewerId
    ? !!db.prepare("SELECT 1 FROM posts WHERE repost_of = ? AND author_id = ? AND deleted = 0").get(row.id, viewerId)
    : false;

  let repostedPost = null;
  if (row.repost_of) {
    const orig = db.prepare('SELECT * FROM posts WHERE id = ?').get(row.repost_of);
    if (orig) {
      repostedPost = {
        ...toPostDTO(orig, { author: getUserById(orig.author_id) }),
        removed: !!orig.deleted,
      };
    } else {
      repostedPost = { removed: true };
    }
  }

  return {
    ...toPostDTO(row, { author, likedByMe }),
    likeCount,
    commentCount,
    repostCount,
    repostedByMe,
    repostedPost,
  };
}

function flagIfNeeded(postId, text) {
  const { flagged, reason } = scanContent(text);
  if (flagged) {
    db.prepare('UPDATE posts SET flagged = 1, flag_reason = ? WHERE id = ?').run(reason, postId);
    db.prepare(
      `INSERT INTO reports (id, reporter_id, target_type, target_id, reason, details, status, created_at)
       VALUES (?, NULL, 'post', ?, 'auto-flagged', ?, 'pending', ?)`
    ).run(randomUUID(), postId, reason, new Date().toISOString());
  }
  return flagged;
}

function notifyMentions(text, actor, postId) {
  const usernames = extractMentions(text);
  for (const uname of usernames) {
    const target = db.prepare('SELECT * FROM users WHERE username = ?').get(uname);
    if (target && target.id !== actor.id) {
      createNotification({
        userId: target.id,
        type: 'mention',
        actorId: actor.id,
        postId,
        message: `@${actor.username} mentioned you.`,
      });
    }
  }
}

// ---- Create a post (multipart form: text + up to 4 images) ----
router.post('/', requireAuth, requireActive, uploadPostImages.array('images', 4), (req, res) => {
  const text = (req.body?.text || '').trim();
  const files = req.files || [];

  if (!text && files.length === 0) {
    return res.status(400).json({ error: "A post needs text or at least one image." });
  }
  if (text.length > MAX_TEXT_LENGTH) {
    return res.status(400).json({ error: `Posts are limited to ${MAX_TEXT_LENGTH} characters.` });
  }

  const post = {
    id: randomUUID(),
    author_id: req.user.id,
    text,
    images: JSON.stringify(files.map(toPublicPath)),
    created_at: new Date().toISOString(),
  };

  db.prepare(
    `INSERT INTO posts (id, author_id, text, images, created_at) VALUES (@id, @author_id, @text, @images, @created_at)`
  ).run(post);

  flagIfNeeded(post.id, text);
  notifyMentions(text, req.user, post.id);

  const row = db.prepare('SELECT * FROM posts WHERE id = ?').get(post.id);
  res.status(201).json({ post: hydratePost(row, req.user.id) });
});

// ---- Home feed: following, or a simple "for you" discovery feed ----
router.get('/feed', requireAuth, (req, res) => {
  const { limit, offset } = pagination(req);
  const tab = req.query.tab === 'foryou' ? 'foryou' : 'following';

  let rows;
  if (tab === 'following') {
    rows = db
      .prepare(
        `SELECT p.* FROM posts p
         JOIN users u ON u.id = p.author_id
         WHERE p.deleted = 0 AND u.status != 'banned'
           AND (p.author_id = ? OR p.author_id IN (
             SELECT following_id FROM follows WHERE follower_id = ?
           ))
         ORDER BY p.created_at DESC
         LIMIT ? OFFSET ?`
      )
      .all(req.user.id, req.user.id, limit, offset);
  } else {
    rows = db
      .prepare(
        `SELECT p.* FROM posts p
         JOIN users u ON u.id = p.author_id
         WHERE p.deleted = 0 AND u.status != 'banned'
         ORDER BY p.created_at DESC
         LIMIT ? OFFSET ?`
      )
      .all(limit, offset);
  }

  res.json({ posts: rows.map((r) => hydratePost(r, req.user.id)) });
});

// ---- Explore: image posts only, Instagram-grid style, public ----
router.get('/explore', optionalAuth, (req, res) => {
  const { limit, offset } = pagination(req, { defaultLimit: 24, maxLimit: 60 });
  const rows = db
    .prepare(
      `SELECT p.* FROM posts p
       JOIN users u ON u.id = p.author_id
       WHERE p.deleted = 0 AND u.status != 'banned' AND p.images != '[]'
       ORDER BY p.created_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(limit, offset);
  res.json({ posts: rows.map((r) => hydratePost(r, req.user?.id)) });
});

// ---- Posts by a specific user (their profile grid/timeline) ----
router.get('/by/:username', optionalAuth, (req, res) => {
  const author = db.prepare('SELECT * FROM users WHERE username = ?').get(req.params.username.toLowerCase());
  if (!author) return res.status(404).json({ error: 'User not found.' });
  const { limit, offset } = pagination(req);
  const rows = db
    .prepare('SELECT * FROM posts WHERE author_id = ? AND deleted = 0 ORDER BY created_at DESC LIMIT ? OFFSET ?')
    .all(author.id, limit, offset);
  res.json({ posts: rows.map((r) => hydratePost(r, req.user?.id)) });
});

// ---- Single post + its comments ----
router.get('/:id', optionalAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  if (!row || row.deleted) return res.status(404).json({ error: 'Post not found.' });
  const comments = db
    .prepare('SELECT * FROM comments WHERE post_id = ? AND deleted = 0 ORDER BY created_at ASC')
    .all(row.id)
    .map((c) => toCommentDTO(c, { author: getUserById(c.author_id) }));
  res.json({ post: hydratePost(row, req.user?.id), comments });
});

// ---- Delete a post (owner, or moderator/admin) ----
router.delete('/:id', requireAuth, requireActive, (req, res) => {
  const row = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  if (!row || row.deleted) return res.status(404).json({ error: 'Post not found.' });

  const isOwner = row.author_id === req.user.id;
  const isModerator = ['moderator', 'admin'].includes(req.user.role);
  if (!isOwner && !isModerator) return res.status(403).json({ error: 'You cannot delete this post.' });

  const reason = isOwner ? 'removed_by_author' : `removed_by_moderator: ${req.body?.reason || 'no reason given'}`;
  db.prepare('UPDATE posts SET deleted = 1, deleted_reason = ? WHERE id = ?').run(reason, row.id);

  if (!isOwner) {
    db.prepare(
      `INSERT INTO audit_log (id, moderator_id, action, target_type, target_id, reason, created_at)
       VALUES (?, ?, 'delete_post', 'post', ?, ?, ?)`
    ).run(randomUUID(), req.user.id, row.id, req.body?.reason || null, new Date().toISOString());
    createNotification({
      userId: row.author_id,
      type: 'moderation',
      message: 'One of your posts was removed for violating community guidelines.',
    });
  }

  res.json({ ok: true });
});

// ---- Like / unlike ----
router.post('/:id/like', requireAuth, requireActive, (req, res) => {
  const row = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  if (!row || row.deleted) return res.status(404).json({ error: 'Post not found.' });

  const already = db.prepare('SELECT 1 FROM likes WHERE user_id = ? AND post_id = ?').get(req.user.id, row.id);
  if (!already) {
    db.prepare('INSERT INTO likes (user_id, post_id, created_at) VALUES (?, ?, ?)').run(
      req.user.id,
      row.id,
      new Date().toISOString()
    );
    createNotification({
      userId: row.author_id,
      type: 'like',
      actorId: req.user.id,
      postId: row.id,
      message: `@${req.user.username} liked your post.`,
    });
  }
  const likeCount = db.prepare('SELECT COUNT(*) c FROM likes WHERE post_id = ?').get(row.id).c;
  res.json({ likedByMe: true, likeCount });
});

router.delete('/:id/like', requireAuth, requireActive, (req, res) => {
  const row = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Post not found.' });
  db.prepare('DELETE FROM likes WHERE user_id = ? AND post_id = ?').run(req.user.id, row.id);
  const likeCount = db.prepare('SELECT COUNT(*) c FROM likes WHERE post_id = ?').get(row.id).c;
  res.json({ likedByMe: false, likeCount });
});

// ---- Repost (toggle) ----
router.post('/:id/repost', requireAuth, requireActive, (req, res) => {
  const original = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  if (!original || original.deleted) return res.status(404).json({ error: 'Post not found.' });

  const existing = db
    .prepare("SELECT * FROM posts WHERE repost_of = ? AND author_id = ? AND deleted = 0")
    .get(original.id, req.user.id);

  if (existing) {
    db.prepare('UPDATE posts SET deleted = 1, deleted_reason = ? WHERE id = ?').run('unreposted', existing.id);
    const repostCount = db.prepare('SELECT COUNT(*) c FROM posts WHERE repost_of = ? AND deleted = 0').get(original.id).c;
    return res.json({ reposted: false, repostCount });
  }

  const repost = {
    id: randomUUID(),
    author_id: req.user.id,
    text: '',
    images: '[]',
    repost_of: original.id,
    created_at: new Date().toISOString(),
  };
  db.prepare(
    `INSERT INTO posts (id, author_id, text, images, repost_of, created_at)
     VALUES (@id, @author_id, @text, @images, @repost_of, @created_at)`
  ).run(repost);

  createNotification({
    userId: original.author_id,
    type: 'repost',
    actorId: req.user.id,
    postId: original.id,
    message: `@${req.user.username} reposted your post.`,
  });

  const repostCount = db.prepare('SELECT COUNT(*) c FROM posts WHERE repost_of = ? AND deleted = 0').get(original.id).c;
  res.json({ reposted: true, repostCount });
});

// ---- Comments ----
router.post('/:id/comments', requireAuth, requireActive, (req, res) => {
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  if (!post || post.deleted) return res.status(404).json({ error: 'Post not found.' });

  const text = (req.body?.text || '').trim();
  if (!text) return res.status(400).json({ error: 'Comment cannot be empty.' });
  if (text.length > MAX_COMMENT_LENGTH) {
    return res.status(400).json({ error: `Comments are limited to ${MAX_COMMENT_LENGTH} characters.` });
  }

  const comment = {
    id: randomUUID(),
    post_id: post.id,
    author_id: req.user.id,
    text,
    created_at: new Date().toISOString(),
  };
  db.prepare(
    `INSERT INTO comments (id, post_id, author_id, text, created_at) VALUES (@id, @post_id, @author_id, @text, @created_at)`
  ).run(comment);

  const { flagged, reason } = scanContent(text);
  if (flagged) {
    db.prepare(
      `INSERT INTO reports (id, reporter_id, target_type, target_id, reason, details, status, created_at)
       VALUES (?, NULL, 'comment', ?, 'auto-flagged', ?, 'pending', ?)`
    ).run(randomUUID(), comment.id, reason, new Date().toISOString());
  }

  createNotification({
    userId: post.author_id,
    type: 'comment',
    actorId: req.user.id,
    postId: post.id,
    message: `@${req.user.username} commented on your post.`,
  });
  notifyMentions(text, req.user, post.id);

  const row = db.prepare('SELECT * FROM comments WHERE id = ?').get(comment.id);
  res.status(201).json({ comment: toCommentDTO(row, { author: req.user }) });
});

router.delete('/comments/:commentId', requireAuth, requireActive, (req, res) => {
  const row = db.prepare('SELECT * FROM comments WHERE id = ?').get(req.params.commentId);
  if (!row || row.deleted) return res.status(404).json({ error: 'Comment not found.' });

  const isOwner = row.author_id === req.user.id;
  const isModerator = ['moderator', 'admin'].includes(req.user.role);
  if (!isOwner && !isModerator) return res.status(403).json({ error: 'You cannot delete this comment.' });

  db.prepare('UPDATE comments SET deleted = 1, deleted_reason = ? WHERE id = ?').run(
    isOwner ? 'removed_by_author' : 'removed_by_moderator',
    row.id
  );

  if (!isOwner) {
    db.prepare(
      `INSERT INTO audit_log (id, moderator_id, action, target_type, target_id, reason, created_at)
       VALUES (?, ?, 'delete_comment', 'comment', ?, ?, ?)`
    ).run(randomUUID(), req.user.id, row.id, req.body?.reason || null, new Date().toISOString());
  }

  res.json({ ok: true });
});

export default router;
