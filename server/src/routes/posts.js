import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { db } from '../db.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { requireActive } from '../middleware/roles.js';
import { toPostDTO, toCommentDTO } from '../utils/serialize.js';
import { uploadPostImages, fileUrl, pagination } from '../utils/upload.js';
import { createNotification } from '../utils/notify.js';
import { scanContent } from '../utils/contentFilter.js';
import { extractMentions } from '../utils/text.js';

const router = Router();

const MAX_TEXT_LENGTH = 500;
const MAX_COMMENT_LENGTH = 300;

async function getUserById(id) {
  return id ? await db.get('SELECT * FROM users WHERE id = ?', [id]) : null;
}

function placeholders(n) {
  return Array(n).fill('?').join(',');
}

// Turns a page of raw post rows into full post DTOs (author, counts,
// viewer-specific flags, repost previews) in a small, fixed number of
// batched queries — instead of the ~6 sequential queries *per post* this
// used to run one at a time. That distinction barely matters on the local
// SQLite file (same process, no network), but on hosted Postgres every one
// of those round trips costs real network latency and competes for a
// limited connection-pool slot, so a 20-post feed used to mean up to ~120
// queued queries; now it's a handful regardless of page size.
async function hydratePosts(rows, viewerId) {
  if (rows.length === 0) return [];

  const postIds = rows.map((r) => r.id);
  const repostOfIds = [...new Set(rows.filter((r) => r.repost_of).map((r) => r.repost_of))];

  let originalsById = new Map();
  if (repostOfIds.length > 0) {
    const originals = await db.all(`SELECT * FROM posts WHERE id IN (${placeholders(repostOfIds.length)})`, repostOfIds);
    originalsById = new Map(originals.map((o) => [o.id, o]));
  }

  // Stats/flags get batched over the union of the page's own post ids AND
  // any reposted originals — not just the page's ids — so a repost-preview
  // card (`repostedPost`) shows the original's real like/comment/repost
  // counts and the viewer's real liked/reposted state instead of always
  // defaulting to zero/false.
  const allIds = [...new Set([...postIds, ...originalsById.keys()])];

  const authorIds = new Set(rows.map((r) => r.author_id));
  for (const orig of originalsById.values()) authorIds.add(orig.author_id);
  const authorIdList = [...authorIds];

  const [users, likeCountRows, commentCountRows, repostCountRows, likedRows, repostedRows] = await Promise.all([
    authorIdList.length
      ? db.all(`SELECT * FROM users WHERE id IN (${placeholders(authorIdList.length)})`, authorIdList)
      : [],
    db.all(`SELECT post_id, COUNT(*) c FROM likes WHERE post_id IN (${placeholders(allIds.length)}) GROUP BY post_id`, allIds),
    db.all(
      `SELECT post_id, COUNT(*) c FROM comments WHERE post_id IN (${placeholders(allIds.length)}) AND deleted = 0 GROUP BY post_id`,
      allIds
    ),
    db.all(
      `SELECT repost_of, COUNT(*) c FROM posts WHERE repost_of IN (${placeholders(allIds.length)}) AND deleted = 0 GROUP BY repost_of`,
      allIds
    ),
    viewerId
      ? db.all(`SELECT post_id FROM likes WHERE user_id = ? AND post_id IN (${placeholders(allIds.length)})`, [viewerId, ...allIds])
      : [],
    viewerId
      ? db.all(
          `SELECT repost_of FROM posts WHERE repost_of IN (${placeholders(allIds.length)}) AND author_id = ? AND deleted = 0`,
          [...allIds, viewerId]
        )
      : [],
  ]);

  const usersById = new Map(users.map((u) => [u.id, u]));
  const likeCountByPost = new Map(likeCountRows.map((r) => [r.post_id, r.c]));
  const commentCountByPost = new Map(commentCountRows.map((r) => [r.post_id, r.c]));
  const repostCountByPost = new Map(repostCountRows.map((r) => [r.repost_of, r.c]));
  const likedSet = new Set(likedRows.map((r) => r.post_id));
  const repostedSet = new Set(repostedRows.map((r) => r.repost_of));

  // Shared so a repost preview gets exactly the same author/counts/viewer-flag
  // treatment as a top-level feed row, instead of a hand-trimmed duplicate.
  const buildDTO = (row) => ({
    ...toPostDTO(row, { author: usersById.get(row.author_id) || null, likedByMe: likedSet.has(row.id) }),
    likeCount: likeCountByPost.get(row.id) || 0,
    commentCount: commentCountByPost.get(row.id) || 0,
    repostCount: repostCountByPost.get(row.id) || 0,
    repostedByMe: repostedSet.has(row.id),
  });

  return rows.map((row) => {
    let repostedPost = null;
    if (row.repost_of) {
      const orig = originalsById.get(row.repost_of);
      repostedPost = orig ? { ...buildDTO(orig), removed: !!orig.deleted } : { removed: true };
    }

    return { ...buildDTO(row), repostedPost };
  });
}

async function hydratePost(row, viewerId) {
  const [result] = await hydratePosts([row], viewerId);
  return result;
}

async function flagIfNeeded(postId, text) {
  const { flagged, reason } = scanContent(text);
  if (flagged) {
    await db.run('UPDATE posts SET flagged = 1, flag_reason = ? WHERE id = ?', [reason, postId]);
    await db.run(
      `INSERT INTO reports (id, reporter_id, target_type, target_id, reason, details, status, created_at)
       VALUES (?, NULL, 'post', ?, 'auto-flagged', ?, 'pending', ?)`,
      [randomUUID(), postId, reason, new Date().toISOString()]
    );
  }
  return flagged;
}

async function notifyMentions(text, actor, postId) {
  const usernames = extractMentions(text);
  for (const uname of usernames) {
    const target = await db.get('SELECT * FROM users WHERE username = ?', [uname]);
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
router.post('/', requireAuth, requireActive, uploadPostImages.array('images', 4), async (req, res) => {
  const text = (req.body?.text || '').trim();
  const files = req.files || [];

  if (!text && files.length === 0) {
    return res.status(400).json({ error: "A post needs text or at least one image." });
  }
  if (text.length > MAX_TEXT_LENGTH) {
    return res.status(400).json({ error: `Posts are limited to ${MAX_TEXT_LENGTH} characters.` });
  }

  let imageUrls;
  try {
    imageUrls = await Promise.all(files.map((f) => fileUrl(f, 'posts')));
  } catch (err) {
    console.error('Post image upload failed:', err);
    return res.status(502).json({ error: err.message });
  }
  const post = {
    id: randomUUID(),
    author_id: req.user.id,
    text,
    images: JSON.stringify(imageUrls),
    created_at: new Date().toISOString(),
  };

  await db.run(
    `INSERT INTO posts (id, author_id, text, images, created_at) VALUES (?, ?, ?, ?, ?)`,
    [post.id, post.author_id, post.text, post.images, post.created_at]
  );

  await flagIfNeeded(post.id, text);
  await notifyMentions(text, req.user, post.id);

  const row = await db.get('SELECT * FROM posts WHERE id = ?', [post.id]);
  res.status(201).json({ post: await hydratePost(row, req.user.id) });
});

// ---- Home feed: following, or a simple "for you" discovery feed ----
router.get('/feed', requireAuth, async (req, res) => {
  const { limit, offset } = pagination(req);
  const tab = req.query.tab === 'foryou' ? 'foryou' : 'following';

  let rows;
  if (tab === 'following') {
    rows = await db.all(
      `SELECT p.* FROM posts p
       JOIN users u ON u.id = p.author_id
       WHERE p.deleted = 0 AND u.status != 'banned'
         AND (p.author_id = ? OR p.author_id IN (
           SELECT following_id FROM follows WHERE follower_id = ?
         ))
       ORDER BY p.created_at DESC
       LIMIT ? OFFSET ?`,
      [req.user.id, req.user.id, limit, offset]
    );
  } else {
    rows = await db.all(
      `SELECT p.* FROM posts p
       JOIN users u ON u.id = p.author_id
       WHERE p.deleted = 0 AND u.status != 'banned'
       ORDER BY p.created_at DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );
  }

  res.json({ posts: await hydratePosts(rows, req.user.id) });
});

// ---- Explore: image posts only, Instagram-grid style, public ----
router.get('/explore', optionalAuth, async (req, res) => {
  const { limit, offset } = pagination(req, { defaultLimit: 24, maxLimit: 60 });
  const rows = await db.all(
    `SELECT p.* FROM posts p
     JOIN users u ON u.id = p.author_id
     WHERE p.deleted = 0 AND u.status != 'banned' AND p.images != '[]'
     ORDER BY p.created_at DESC
     LIMIT ? OFFSET ?`,
    [limit, offset]
  );
  res.json({ posts: await hydratePosts(rows, req.user?.id) });
});

// ---- Posts by a specific user (their profile grid/timeline) ----
router.get('/by/:username', optionalAuth, async (req, res) => {
  const author = await db.get('SELECT * FROM users WHERE username = ?', [req.params.username.toLowerCase()]);
  if (!author) return res.status(404).json({ error: 'User not found.' });
  const { limit, offset } = pagination(req);
  const rows = await db.all(
    'SELECT * FROM posts WHERE author_id = ? AND deleted = 0 ORDER BY created_at DESC LIMIT ? OFFSET ?',
    [author.id, limit, offset]
  );
  res.json({ posts: await hydratePosts(rows, req.user?.id) });
});

// ---- Single post + its comments ----
router.get('/:id', optionalAuth, async (req, res) => {
  const row = await db.get('SELECT * FROM posts WHERE id = ?', [req.params.id]);
  if (!row || row.deleted) return res.status(404).json({ error: 'Post not found.' });
  const commentRows = await db.all(
    'SELECT * FROM comments WHERE post_id = ? AND deleted = 0 ORDER BY created_at ASC',
    [row.id]
  );
  const comments = await Promise.all(
    commentRows.map(async (c) => toCommentDTO(c, { author: await getUserById(c.author_id) }))
  );
  res.json({ post: await hydratePost(row, req.user?.id), comments });
});

// ---- Delete a post (owner, or moderator/admin) ----
router.delete('/:id', requireAuth, requireActive, async (req, res) => {
  const row = await db.get('SELECT * FROM posts WHERE id = ?', [req.params.id]);
  if (!row || row.deleted) return res.status(404).json({ error: 'Post not found.' });

  const isOwner = row.author_id === req.user.id;
  const isModerator = ['moderator', 'admin'].includes(req.user.role);
  if (!isOwner && !isModerator) return res.status(403).json({ error: 'You cannot delete this post.' });

  const reason = isOwner ? 'removed_by_author' : `removed_by_moderator: ${req.body?.reason || 'no reason given'}`;
  await db.run('UPDATE posts SET deleted = 1, deleted_reason = ? WHERE id = ?', [reason, row.id]);

  if (!isOwner) {
    await db.run(
      `INSERT INTO audit_log (id, moderator_id, action, target_type, target_id, reason, created_at)
       VALUES (?, ?, 'delete_post', 'post', ?, ?, ?)`,
      [randomUUID(), req.user.id, row.id, req.body?.reason || null, new Date().toISOString()]
    );
    createNotification({
      userId: row.author_id,
      type: 'moderation',
      message: 'One of your posts was removed for violating community guidelines.',
    });
  }

  res.json({ ok: true });
});

// ---- Like / unlike ----
router.post('/:id/like', requireAuth, requireActive, async (req, res) => {
  const row = await db.get('SELECT * FROM posts WHERE id = ?', [req.params.id]);
  if (!row || row.deleted) return res.status(404).json({ error: 'Post not found.' });

  const already = await db.get('SELECT 1 FROM likes WHERE user_id = ? AND post_id = ?', [req.user.id, row.id]);
  if (!already) {
    await db.run('INSERT INTO likes (user_id, post_id, created_at) VALUES (?, ?, ?)', [
      req.user.id,
      row.id,
      new Date().toISOString(),
    ]);
    createNotification({
      userId: row.author_id,
      type: 'like',
      actorId: req.user.id,
      postId: row.id,
      message: `@${req.user.username} liked your post.`,
    });
  }
  const likeCount = (await db.get('SELECT COUNT(*) c FROM likes WHERE post_id = ?', [row.id])).c;
  res.json({ likedByMe: true, likeCount });
});

router.delete('/:id/like', requireAuth, requireActive, async (req, res) => {
  const row = await db.get('SELECT * FROM posts WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Post not found.' });
  await db.run('DELETE FROM likes WHERE user_id = ? AND post_id = ?', [req.user.id, row.id]);
  const likeCount = (await db.get('SELECT COUNT(*) c FROM likes WHERE post_id = ?', [row.id])).c;
  res.json({ likedByMe: false, likeCount });
});

// ---- Repost (toggle) ----
router.post('/:id/repost', requireAuth, requireActive, async (req, res) => {
  const original = await db.get('SELECT * FROM posts WHERE id = ?', [req.params.id]);
  if (!original || original.deleted) return res.status(404).json({ error: 'Post not found.' });

  const existing = await db.get('SELECT * FROM posts WHERE repost_of = ? AND author_id = ? AND deleted = 0', [
    original.id,
    req.user.id,
  ]);

  if (existing) {
    await db.run('UPDATE posts SET deleted = 1, deleted_reason = ? WHERE id = ?', ['unreposted', existing.id]);
    const repostCount = (await db.get('SELECT COUNT(*) c FROM posts WHERE repost_of = ? AND deleted = 0', [original.id])).c;
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
  await db.run(
    `INSERT INTO posts (id, author_id, text, images, repost_of, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [repost.id, repost.author_id, repost.text, repost.images, repost.repost_of, repost.created_at]
  );

  createNotification({
    userId: original.author_id,
    type: 'repost',
    actorId: req.user.id,
    postId: original.id,
    message: `@${req.user.username} reposted your post.`,
  });

  const repostCount = (await db.get('SELECT COUNT(*) c FROM posts WHERE repost_of = ? AND deleted = 0', [original.id])).c;
  res.json({ reposted: true, repostCount });
});

// ---- Comments ----
router.post('/:id/comments', requireAuth, requireActive, async (req, res) => {
  const post = await db.get('SELECT * FROM posts WHERE id = ?', [req.params.id]);
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
  await db.run(
    `INSERT INTO comments (id, post_id, author_id, text, created_at) VALUES (?, ?, ?, ?, ?)`,
    [comment.id, comment.post_id, comment.author_id, comment.text, comment.created_at]
  );

  const { flagged, reason } = scanContent(text);
  if (flagged) {
    await db.run(
      `INSERT INTO reports (id, reporter_id, target_type, target_id, reason, details, status, created_at)
       VALUES (?, NULL, 'comment', ?, 'auto-flagged', ?, 'pending', ?)`,
      [randomUUID(), comment.id, reason, new Date().toISOString()]
    );
  }

  createNotification({
    userId: post.author_id,
    type: 'comment',
    actorId: req.user.id,
    postId: post.id,
    message: `@${req.user.username} commented on your post.`,
  });
  await notifyMentions(text, req.user, post.id);

  const row = await db.get('SELECT * FROM comments WHERE id = ?', [comment.id]);
  res.status(201).json({ comment: toCommentDTO(row, { author: req.user }) });
});

router.delete('/comments/:commentId', requireAuth, requireActive, async (req, res) => {
  const row = await db.get('SELECT * FROM comments WHERE id = ?', [req.params.commentId]);
  if (!row || row.deleted) return res.status(404).json({ error: 'Comment not found.' });

  const isOwner = row.author_id === req.user.id;
  const isModerator = ['moderator', 'admin'].includes(req.user.role);
  if (!isOwner && !isModerator) return res.status(403).json({ error: 'You cannot delete this comment.' });

  await db.run('UPDATE comments SET deleted = 1, deleted_reason = ? WHERE id = ?', [
    isOwner ? 'removed_by_author' : 'removed_by_moderator',
    row.id,
  ]);

  if (!isOwner) {
    await db.run(
      `INSERT INTO audit_log (id, moderator_id, action, target_type, target_id, reason, created_at)
       VALUES (?, ?, 'delete_comment', 'comment', ?, ?, ?)`,
      [randomUUID(), req.user.id, row.id, req.body?.reason || null, new Date().toISOString()]
    );
  }

  res.json({ ok: true });
});

export default router;
