import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';
import { uploadProfileImage, uploadAdImage, fileUrl, pagination } from '../utils/upload.js';
import { createNotification } from '../utils/notify.js';
import {
  toPublicUser,
  toPrivateUser,
  toPostDTO,
  toCommentDTO,
  toReportDTO,
  toAuditLogDTO,
  toTicketDTO,
  toTicketMessageDTO,
  toAdDTO,
} from '../utils/serialize.js';
import { BADGES, ROLES, STATUSES, MODERATION_ACTIONS, ADMIN_ONLY_BADGES, BADGE_META } from '../utils/constants.js';
import { USERNAME_RE } from './auth.js';

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
    openTickets: (await db.get("SELECT COUNT(*) c FROM support_tickets WHERE status = 'open'", [])).c,
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

// Moderators may manage regular accounts, but only an admin (or the account
// itself) can change these fields on another staff member — otherwise a
// moderator could take over an admin's (or another moderator's) account.
function canEditAccountDetails(actor, target) {
  const targetIsStaff = target.role === 'moderator' || target.role === 'admin';
  return actor.role === 'admin' || !targetIsStaff || actor.id === target.id;
}

router.patch('/users/:id', async (req, res) => {
  const target = await db.get('SELECT * FROM users WHERE id = ?', [req.params.id]);
  if (!target) return res.status(404).json({ error: 'User not found.' });

  const { role, badge, status, durationDays, reason, username, displayName, bio, newPassword } = req.body || {};

  if (username !== undefined || displayName !== undefined || bio !== undefined || newPassword !== undefined) {
    if (!canEditAccountDetails(req.user, target)) {
      return res.status(403).json({ error: 'Only an admin can edit another staff member’s account.' });
    }
  }

  if (username !== undefined) {
    const lower = String(username).toLowerCase();
    if (!USERNAME_RE.test(lower)) {
      return res.status(400).json({ error: 'Username must be 3-20 characters: letters, numbers, underscore.' });
    }
    if (lower !== target.username) {
      const existing = await db.get('SELECT id FROM users WHERE username = ?', [lower]);
      if (existing) return res.status(409).json({ error: 'That username is already taken.' });
    }
    await db.run('UPDATE users SET username = ? WHERE id = ?', [lower, target.id]);
    await logAction(req.user.id, 'set_username', 'user', target.id, `${target.username} -> ${lower}`);
    if (lower !== target.username) {
      createNotification({ userId: target.id, type: 'moderation', message: `Your username was changed by staff to @${lower}.` });
    }
  }

  if (displayName !== undefined) {
    if (!displayName.trim() || displayName.length > 40) {
      return res.status(400).json({ error: 'Display name must be 1-40 characters.' });
    }
    await db.run('UPDATE users SET display_name = ? WHERE id = ?', [displayName.trim(), target.id]);
    await logAction(req.user.id, 'set_display_name', 'user', target.id, `${target.display_name} -> ${displayName.trim()}`);
  }

  if (bio !== undefined) {
    if (bio.length > 160) return res.status(400).json({ error: 'Bio must be 160 characters or fewer.' });
    await db.run('UPDATE users SET bio = ? WHERE id = ?', [bio, target.id]);
    await logAction(req.user.id, 'set_bio', 'user', target.id, null);
  }

  if (newPassword !== undefined) {
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters.' });
    }
    await db.run('UPDATE users SET password_hash = ? WHERE id = ?', [bcrypt.hashSync(newPassword, 10), target.id]);
    await logAction(req.user.id, 'reset_password', 'user', target.id, null);
    createNotification({ userId: target.id, type: 'moderation', message: 'Your password was reset by staff.' });
  }

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

router.post('/users/:id/avatar', uploadProfileImage.single('image'), async (req, res) => {
  const target = await db.get('SELECT * FROM users WHERE id = ?', [req.params.id]);
  if (!target) return res.status(404).json({ error: 'User not found.' });
  if (!canEditAccountDetails(req.user, target)) {
    return res.status(403).json({ error: 'Only an admin can edit another staff member’s account.' });
  }
  if (!req.file) return res.status(400).json({ error: 'No image uploaded.' });

  let url;
  try {
    url = await fileUrl(req.file, 'avatar');
  } catch (err) {
    console.error('Admin avatar upload failed:', err);
    return res.status(502).json({ error: err.message });
  }
  await db.run('UPDATE users SET avatar_url = ? WHERE id = ?', [url, target.id]);
  await logAction(req.user.id, 'set_avatar', 'user', target.id, null);
  res.json({ user: toPrivateUser(await db.get('SELECT * FROM users WHERE id = ?', [target.id])) });
});

router.post('/users/:id/banner', uploadProfileImage.single('image'), async (req, res) => {
  const target = await db.get('SELECT * FROM users WHERE id = ?', [req.params.id]);
  if (!target) return res.status(404).json({ error: 'User not found.' });
  if (!canEditAccountDetails(req.user, target)) {
    return res.status(403).json({ error: 'Only an admin can edit another staff member’s account.' });
  }
  if (!req.file) return res.status(400).json({ error: 'No image uploaded.' });

  let url;
  try {
    url = await fileUrl(req.file, 'banner');
  } catch (err) {
    console.error('Admin banner upload failed:', err);
    return res.status(502).json({ error: err.message });
  }
  await db.run('UPDATE users SET banner_url = ? WHERE id = ?', [url, target.id]);
  await logAction(req.user.id, 'set_banner', 'user', target.id, null);
  res.json({ user: toPrivateUser(await db.get('SELECT * FROM users WHERE id = ?', [target.id])) });
});

// Removing a picture entirely (rather than just replacing it) matters for
// moderation — an inappropriate avatar/banner needs to come down even when
// no replacement has been provided yet.
router.delete('/users/:id/avatar', async (req, res) => {
  const target = await db.get('SELECT * FROM users WHERE id = ?', [req.params.id]);
  if (!target) return res.status(404).json({ error: 'User not found.' });
  if (!canEditAccountDetails(req.user, target)) {
    return res.status(403).json({ error: 'Only an admin can edit another staff member’s account.' });
  }
  await db.run('UPDATE users SET avatar_url = NULL WHERE id = ?', [target.id]);
  await logAction(req.user.id, 'remove_avatar', 'user', target.id, req.body?.reason || null);
  res.json({ user: toPrivateUser(await db.get('SELECT * FROM users WHERE id = ?', [target.id])) });
});

router.delete('/users/:id/banner', async (req, res) => {
  const target = await db.get('SELECT * FROM users WHERE id = ?', [req.params.id]);
  if (!target) return res.status(404).json({ error: 'User not found.' });
  if (!canEditAccountDetails(req.user, target)) {
    return res.status(403).json({ error: 'Only an admin can edit another staff member’s account.' });
  }
  await db.run('UPDATE users SET banner_url = NULL WHERE id = ?', [target.id]);
  await logAction(req.user.id, 'remove_banner', 'user', target.id, req.body?.reason || null);
  res.json({ user: toPrivateUser(await db.get('SELECT * FROM users WHERE id = ?', [target.id])) });
});

// ---- Support tickets ----
async function loadAdminThread(ticketId) {
  const messages = await db.all('SELECT * FROM support_messages WHERE ticket_id = ? ORDER BY created_at ASC', [ticketId]);
  const authorIds = [...new Set(messages.map((m) => m.author_id))];
  const authors = {};
  for (const id of authorIds) authors[id] = toPublicUser(await getUser(id));
  return messages.map((m) => ({ ...toTicketMessageDTO(m), author: authors[m.author_id] || null }));
}

router.get('/support/tickets', async (req, res) => {
  const status = ['open', 'resolved'].includes(req.query.status) ? req.query.status : null;
  const { limit, offset } = pagination(req, { defaultLimit: 25, maxLimit: 100 });
  const where = status ? 'WHERE status = ?' : '';
  const params = status ? [status] : [];
  const rows = await db.all(
    `SELECT * FROM support_tickets ${where} ORDER BY (status = 'open') DESC, updated_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const tickets = await Promise.all(
    rows.map(async (t) => {
      const last = await db.get('SELECT * FROM support_messages WHERE ticket_id = ? ORDER BY created_at DESC LIMIT 1', [t.id]);
      return { ...toTicketDTO(t), user: toPublicUser(await getUser(t.user_id)), lastMessage: last ? toTicketMessageDTO(last) : null };
    })
  );
  res.json({ tickets, openCount: (await db.get("SELECT COUNT(*) c FROM support_tickets WHERE status = 'open'", [])).c });
});

router.get('/support/tickets/:id', async (req, res) => {
  const ticket = await db.get('SELECT * FROM support_tickets WHERE id = ?', [req.params.id]);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found.' });
  res.json({ ticket: { ...toTicketDTO(ticket), user: toPublicUser(await getUser(ticket.user_id)) }, messages: await loadAdminThread(ticket.id) });
});

router.post('/support/tickets/:id/messages', async (req, res) => {
  const ticket = await db.get('SELECT * FROM support_tickets WHERE id = ?', [req.params.id]);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found.' });

  const message = String((req.body || {}).message || '').trim();
  if (!message || message.length > 2000) return res.status(400).json({ error: 'Message must be 1-2000 characters.' });

  const now = new Date().toISOString();
  await db.run(
    'INSERT INTO support_messages (id, ticket_id, author_id, is_staff, message, created_at) VALUES (?, ?, ?, 1, ?, ?)',
    [randomUUID(), ticket.id, req.user.id, message, now]
  );
  await db.run('UPDATE support_tickets SET updated_at = ? WHERE id = ?', [now, ticket.id]);
  createNotification({ userId: ticket.user_id, type: 'support', message: `Staff replied to your ticket "${ticket.subject}".` });

  const updated = await db.get('SELECT * FROM support_tickets WHERE id = ?', [ticket.id]);
  res.json({ ticket: { ...toTicketDTO(updated), user: toPublicUser(await getUser(ticket.user_id)) }, messages: await loadAdminThread(ticket.id) });
});

router.post('/support/tickets/:id/status', async (req, res) => {
  const ticket = await db.get('SELECT * FROM support_tickets WHERE id = ?', [req.params.id]);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found.' });
  const { status } = req.body || {};
  if (!['open', 'resolved'].includes(status)) return res.status(400).json({ error: 'Invalid status.' });

  await db.run('UPDATE support_tickets SET status = ?, updated_at = ? WHERE id = ?', [status, new Date().toISOString(), ticket.id]);
  if (status === 'resolved') {
    createNotification({ userId: ticket.user_id, type: 'support', message: `Your ticket "${ticket.subject}" was marked resolved.` });
  }
  const updated = await db.get('SELECT * FROM support_tickets WHERE id = ?', [ticket.id]);
  res.json({ ticket: { ...toTicketDTO(updated), user: toPublicUser(await getUser(ticket.user_id)) } });
});

// ---- Ads ----
// Anyone with admin.js access (moderator or admin) can see how the ad
// slots are doing; only an admin can actually add, pause, or remove one —
// this is real advertiser money/relationships, not routine moderation.
function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Only admins can manage ads.' });
  next();
}

router.get('/ads', async (_req, res) => {
  const rows = await db.all('SELECT * FROM ads ORDER BY created_at DESC');
  res.json({ ads: rows.map(toAdDTO) });
});

router.post('/ads', requireAdmin, uploadAdImage.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Choose an image to upload.' });

  const label = String((req.body || {}).label || '').trim().slice(0, 80);
  let linkUrl = String((req.body || {}).linkUrl || '').trim();
  if (linkUrl && !/^https?:\/\//i.test(linkUrl)) linkUrl = `https://${linkUrl}`;
  if (linkUrl) {
    try {
      new URL(linkUrl);
    } catch {
      return res.status(400).json({ error: 'That link doesn’t look like a valid URL.' });
    }
  }

  let imageUrl;
  try {
    imageUrl = await fileUrl(req.file, 'ads');
  } catch (err) {
    console.error('Ad image upload failed:', err);
    return res.status(502).json({ error: err.message });
  }

  const ad = {
    id: randomUUID(),
    image_url: imageUrl,
    link_url: linkUrl || null,
    label,
    created_at: new Date().toISOString(),
  };
  await db.run(
    `INSERT INTO ads (id, image_url, link_url, label, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
    [ad.id, ad.image_url, ad.link_url, ad.label, req.user.id, ad.created_at]
  );
  await logAction(req.user.id, 'create_ad', 'ad', ad.id, null);

  res.status(201).json({ ad: toAdDTO(await db.get('SELECT * FROM ads WHERE id = ?', [ad.id])) });
});

router.patch('/ads/:id', requireAdmin, async (req, res) => {
  const ad = await db.get('SELECT * FROM ads WHERE id = ?', [req.params.id]);
  if (!ad) return res.status(404).json({ error: 'Ad not found.' });

  const { active, label, linkUrl } = req.body || {};
  const updates = {};
  if (active !== undefined) updates.active = active ? 1 : 0;
  if (label !== undefined) updates.label = String(label).trim().slice(0, 80);
  if (linkUrl !== undefined) {
    let next = String(linkUrl).trim();
    if (next && !/^https?:\/\//i.test(next)) next = `https://${next}`;
    if (next) {
      try {
        new URL(next);
      } catch {
        return res.status(400).json({ error: 'That link doesn’t look like a valid URL.' });
      }
    }
    updates.link_url = next || null;
  }

  const keys = Object.keys(updates);
  if (keys.length > 0) {
    const setClause = keys.map((k) => `${k} = ?`).join(', ');
    await db.run(`UPDATE ads SET ${setClause} WHERE id = ?`, [...keys.map((k) => updates[k]), ad.id]);
  }

  res.json({ ad: toAdDTO(await db.get('SELECT * FROM ads WHERE id = ?', [ad.id])) });
});

router.delete('/ads/:id', requireAdmin, async (req, res) => {
  const ad = await db.get('SELECT * FROM ads WHERE id = ?', [req.params.id]);
  if (!ad) return res.status(404).json({ error: 'Ad not found.' });
  await db.run('DELETE FROM ads WHERE id = ?', [ad.id]);
  await logAction(req.user.id, 'delete_ad', 'ad', ad.id, null);
  res.json({ ok: true });
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
