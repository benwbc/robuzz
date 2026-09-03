import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';
import { pagination } from '../utils/upload.js';
import { createNotification } from '../utils/notify.js';
import { toPublicUser, toPrivateUser, toPostDTO, toCommentDTO, toReportDTO, toAuditLogDTO } from '../utils/serialize.js';
import { BADGES, ROLES, STATUSES, MODERATION_ACTIONS, ADMIN_ONLY_BADGES, BADGE_META } from '../utils/constants.js';

const router = Router();

// Everything below requires staff (moderator or admin). A handful of
// sensitive fields (role changes, staff/official badges) are further
// restricted to admin only inside their handlers.
router.use(requireAuth, requireRole('moderator', 'admin'));

async function logAction(moderatorId, action, targetType, targetId, reason) {
  await db.run(
    `INSERT INTO audit_log (id, moderator_id, action, target_type, target_id, reason, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [randomUUID(), moderatorId, action, targetType, targetId, reason || null, new Date().toISOString()]
  );
}

async function getUser(id) {
  return await db.get('SELECT * FROM users WHERE id = ?', [id]);
}

// ---- Overview stats ----
router.get('/stats', async (_req, res) => {
  res.json({
    totalUsers: (await db.get('SELECT COUNT(*) c FROM users', [])).c,
    totalPosts: (await db.get('SELECT COUNT(*) c FROM posts WHERE deleted = 0', [])).c,
    pendingReports: (await db.get("SELECT COUNT(*) c FROM reports WHERE status = 'pending'", [])).c,
    bannedUsers: (await db.get("SELECT COUNT(*) c FROM users WHERE status = 'banned'", [])).c,
    suspendedUsers: (await db.get("SELECT COUNT(*) c FROM users WHERE status = 'suspended'", [])).c,
    flaggedPosts: (await db.get('SELECT COUNT(*) c FROM posts WHERE flagged = 1 AND deleted = 0', [])).c,
  });
});

// ---- Reports queue ----
async function buildReportPreview(r) {
  let target = null;

  if (r.target_type === 'post') {
    const post = await db.get('SELECT * FROM posts WHERE id = ?', [r.target_id]);
    if (post) {
      const author = await getUser(post.author_id);
      target = { kind: 'post', ...toPostDTO(post, { author }) };
    }
  } else if (r.target_type === 'comment') {
    const comment = await db.get('SELECT * FROM comments WHERE id = ?', [r.target_id]);
    if (comment) {
      const author = await getUser(comment.author_id);
      target = { kind: 'comment', ...toCommentDTO(comment, { author }), postId: comment.post_id };
    }
  } else if (r.target_type === 'user') {
    const user = await getUser(r.target_id);
    if (user) target = { kind: 'user', ...toPublicUser(user) };
  }

  return {
    ...toReportDTO(r),
    reporter: r.reporter_id ? toPublicUser(await getUser(r.reporter_id)) : null,
    target,
  };
}

router.get('/reports', async (req, res) => {
  const status = ['pending', 'actioned', 'dismissed'].includes(req.query.status) ? req.query.status : null;
  const { limit, offset } = pagination(req, { defaultLimit: 25, maxLimit: 100 });
  const where = status ? 'WHERE status = ?' : '';
  const params = status ? [status] : [];
  const rows = await db.all(
    `SELECT * FROM reports ${where} ORDER BY (status = 'pending') DESC, created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  res.json({
    reports: await Promise.all(rows.map(buildReportPreview)),
    pendingCount: (await db.get("SELECT COUNT(*) c FROM reports WHERE status = 'pending'", [])).c,
  });
});

router.post('/reports/:id/resolve', async (req, res) => {
  const report = await db.get('SELECT * FROM reports WHERE id = ?', [req.params.id]);
  if (!report) return res.status(404).json({ error: 'Report not found.' });

  const { action, note, durationDays } = req.body || {};
  if (!MODERATION_ACTIONS.includes(action)) {
    return res.status(400).json({ error: 'Invalid moderation action.' });
  }

  let targetUserId = null;
  if (report.target_type === 'user') targetUserId = report.target_id;
  if (report.target_type === 'post') {
    targetUserId = (await db.get('SELECT author_id FROM posts WHERE id = ?', [report.target_id]))?.author_id || null;
  }
  if (report.target_type === 'comment') {
    targetUserId = (await db.get('SELECT author_id FROM comments WHERE id = ?', [report.target_id]))?.author_id || null;
  }

  switch (action) {
    case 'delete_post': {
      if (report.target_type !== 'post') return res.status(400).json({ error: 'This report is not about a post.' });
      await db.run('UPDATE posts SET deleted = 1, deleted_reason = ? WHERE id = ?', [
        `removed_by_moderator: ${note || 'violated guidelines'}`,
        report.target_id,
      ]);
      await logAction(req.user.id, 'delete_post', 'post', report.target_id, note);
      if (targetUserId) {
        createNotification({ userId: targetUserId, type: 'moderation', message: 'One of your posts was removed for violating community guidelines.' });
      }
      break;
    }
    case 'delete_comment': {
      if (report.target_type !== 'comment') return res.status(400).json({ error: 'This report is not about a comment.' });
      await db.run('UPDATE comments SET deleted = 1, deleted_reason = ? WHERE id = ?', [
        `removed_by_moderator: ${note || 'violated guidelines'}`,
        report.target_id,
      ]);
      await logAction(req.user.id, 'delete_comment', 'comment', report.target_id, note);
      if (targetUserId) {
        createNotification({ userId: targetUserId, type: 'moderation', message: 'One of your comments was removed for violating community guidelines.' });
      }
      break;
    }
    case 'warn_user': {
      if (!targetUserId) return res.status(400).json({ error: 'Could not determine which user to warn.' });
      await logAction(req.user.id, 'warn_user', 'user', targetUserId, note);
      createNotification({ userId: targetUserId, type: 'moderation', message: `You received a warning from staff: ${note || 'please review the community guidelines.'}` });
      break;
    }
    case 'suspend_user': {
      if (!targetUserId) return res.status(400).json({ error: 'Could not determine which user to suspend.' });
      const days = Math.min(Math.max(parseInt(durationDays, 10) || 3, 1), 365);
      const until = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
      await db.run("UPDATE users SET status = 'suspended', suspended_until = ?, status_reason = ? WHERE id = ?", [
        until,
        note || null,
        targetUserId,
      ]);
      await logAction(req.user.id, 'suspend_user', 'user', targetUserId, `${days}d — ${note || ''}`);
      createNotification({
        userId: targetUserId,
        type: 'moderation',
        message: `Your account was suspended for ${days} day(s): ${note || 'community guideline violation.'}`,
      });
      break;
    }
    case 'ban_user': {
      if (!targetUserId) return res.status(400).json({ error: 'Could not determine which user to ban.' });
      await db.run("UPDATE users SET status = 'banned', status_reason = ?, suspended_until = NULL WHERE id = ?", [
        note || null,
        targetUserId,
      ]);
      await logAction(req.user.id, 'ban_user', 'user', targetUserId, note);
      createNotification({
        userId: targetUserId,
        type: 'moderation',
        message: `Your account was banned: ${note || 'community guideline violation.'}`,
      });
      break;
    }
    case 'unban_user': {
      if (!targetUserId) return res.status(400).json({ error: 'Could not determine which user to restore.' });
      await db.run("UPDATE users SET status = 'active', suspended_until = NULL, status_reason = NULL WHERE id = ?", [targetUserId]);
      await logAction(req.user.id, 'unban_user', 'user', targetUserId, note);
      break;
    }
    case 'dismiss':
    case 'no_action':
    default:
      break;
  }

  const finalStatus = action === 'dismiss' || action === 'no_action' ? 'dismissed' : 'actioned';
  await db.run('UPDATE reports SET status = ?, resolved_by = ?, resolution_note = ?, resolved_at = ? WHERE id = ?', [
    finalStatus,
    req.user.id,
    note || null,
    new Date().toISOString(),
    report.id,
  ]);

  res.json({ report: toReportDTO(await db.get('SELECT * FROM reports WHERE id = ?', [report.id])) });
});

// ---- User management ----
router.get('/users', async (req, res) => {
  const { limit, offset } = pagination(req, { defaultLimit: 25, maxLimit: 100 });
  const clauses = [];
  const params = [];

  if (req.query.query) {
    clauses.push('(username LIKE ? OR display_name LIKE ? OR email LIKE ?)');
    const like = `%${req.query.query}%`;
    params.push(like, like, like);
  }
  if (STATUSES.includes(req.query.status)) {
    clauses.push('status = ?');
    params.push(req.query.status);
  }
  if (ROLES.includes(req.query.role)) {
    clauses.push('role = ?');
    params.push(req.query.role);
  }
  if (BADGES.includes(req.query.badge)) {
    clauses.push('badge = ?');
    params.push(req.query.badge);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = await db.all(`SELECT * FROM users ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
  const total = (await db.get(`SELECT COUNT(*) c FROM users ${where}`, [...params])).c;
  res.json({ users: rows.map(toPrivateUser), total });
});

router.patch('/users/:id', async (req, res) => {
  const target = await db.get('SELECT * FROM users WHERE id = ?', [req.params.id]);
  if (!target) return res.status(404).json({ error: 'User not found.' });

  const { role, badge, status, durationDays, reason } = req.body || {};

  if (role !== undefined) {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Only admins can change roles.' });
    if (!ROLES.includes(role)) return res.status(400).json({ error: 'Invalid role.' });
    await db.run('UPDATE users SET role = ? WHERE id = ?', [role, target.id]);
    await logAction(req.user.id, 'set_role', 'user', target.id, `${target.role} -> ${role}`);
  }

  if (badge !== undefined) {
    if (!BADGES.includes(badge)) return res.status(400).json({ error: 'Invalid badge.' });
    if (ADMIN_ONLY_BADGES.includes(badge) && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can grant that badge.' });
    }
    await db.run('UPDATE users SET badge = ? WHERE id = ?', [badge, target.id]);
    await logAction(req.user.id, 'set_badge', 'user', target.id, `${target.badge} -> ${badge}`);
    if (badge !== 'none') {
      createNotification({
        userId: target.id,
        type: 'moderation',
        message: `You were granted the "${BADGE_META[badge]?.label || badge}" badge.`,
      });
    }
  }

  if (status !== undefined) {
    if (!STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status.' });
    if (status === 'suspended') {
      const days = Math.min(Math.max(parseInt(durationDays, 10) || 3, 1), 365);
      const until = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
      await db.run("UPDATE users SET status = 'suspended', suspended_until = ?, status_reason = ? WHERE id = ?", [
        until,
        reason || null,
        target.id,
      ]);
      await logAction(req.user.id, 'suspend_user', 'user', target.id, `${days}d — ${reason || ''}`);
      createNotification({
        userId: target.id,
        type: 'moderation',
        message: `Your account was suspended for ${days} day(s): ${reason || 'community guideline violation.'}`,
      });
    } else if (status === 'banned') {
      await db.run("UPDATE users SET status = 'banned', status_reason = ?, suspended_until = NULL WHERE id = ?", [reason || null, target.id]);
      await logAction(req.user.id, 'ban_user', 'user', target.id, reason);
      createNotification({
        userId: target.id,
        type: 'moderation',
        message: `Your account was banned: ${reason || 'community guideline violation.'}`,
      });
    } else {
      await db.run("UPDATE users SET status = 'active', suspended_until = NULL, status_reason = NULL WHERE id = ?", [target.id]);
      await logAction(req.user.id, 'reactivate_user', 'user', target.id, reason);
    }
  }

  res.json({ user: toPrivateUser(await db.get('SELECT * FROM users WHERE id = ?', [target.id])) });
});

// ---- Audit log ----
router.get('/audit-log', async (req, res) => {
  const { limit, offset } = pagination(req, { defaultLimit: 50, maxLimit: 200 });
  const rows = await db.all('SELECT * FROM audit_log ORDER BY created_at DESC LIMIT ? OFFSET ?', [limit, offset]);
  res.json({
    entries: await Promise.all(
      rows.map(async (r) => {
        let target = null;
        if (r.target_type === 'user') {
          const u = await getUser(r.target_id);
          if (u) target = { username: u.username, displayName: u.display_name, badge: u.badge };
        }
        return {
          ...toAuditLogDTO(r),
          moderator: toPublicUser(await getUser(r.moderator_id)),
          target,
        };
      })
    ),
  });
});

export default router;
