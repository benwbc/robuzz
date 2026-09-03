import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { requireActive } from '../middleware/roles.js';
import { REPORT_REASONS, REPORT_TARGET_TYPES } from '../utils/constants.js';
import { toReportDTO } from '../utils/serialize.js';

const router = Router();

function targetExists(targetType, targetId) {
  if (targetType === 'post') return !!db.prepare('SELECT 1 FROM posts WHERE id = ?').get(targetId);
  if (targetType === 'comment') return !!db.prepare('SELECT 1 FROM comments WHERE id = ?').get(targetId);
  if (targetType === 'user') return !!db.prepare('SELECT 1 FROM users WHERE id = ?').get(targetId);
  return false;
}

// ---- File a report (any signed-in, active user) ----
router.post('/', requireAuth, requireActive, (req, res) => {
  const { targetType, targetId, reason, details } = req.body || {};

  if (!REPORT_TARGET_TYPES.includes(targetType)) {
    return res.status(400).json({ error: 'Invalid report target type.' });
  }
  if (!REPORT_REASONS.includes(reason)) {
    return res.status(400).json({ error: 'Invalid report reason.' });
  }
  if (!targetId || !targetExists(targetType, targetId)) {
    return res.status(404).json({ error: 'The thing you are trying to report no longer exists.' });
  }
  if (targetType === 'user' && targetId === req.user.id) {
    return res.status(400).json({ error: "You can't report yourself." });
  }

  const existing = db
    .prepare(
      `SELECT * FROM reports WHERE reporter_id = ? AND target_type = ? AND target_id = ? AND status = 'pending'`
    )
    .get(req.user.id, targetType, targetId);
  if (existing) {
    return res.status(200).json({ report: toReportDTO(existing), alreadyReported: true });
  }

  const report = {
    id: randomUUID(),
    reporter_id: req.user.id,
    target_type: targetType,
    target_id: targetId,
    reason,
    details: (details || '').slice(0, 500),
    created_at: new Date().toISOString(),
  };
  db.prepare(
    `INSERT INTO reports (id, reporter_id, target_type, target_id, reason, details, status, created_at)
     VALUES (@id, @reporter_id, @target_type, @target_id, @reason, @details, 'pending', @created_at)`
  ).run(report);

  res.status(201).json({
    report: toReportDTO(db.prepare('SELECT * FROM reports WHERE id = ?').get(report.id)),
  });
});

// ---- A user's own report history ----
router.get('/mine', requireAuth, (req, res) => {
  const rows = db
    .prepare('SELECT * FROM reports WHERE reporter_id = ? ORDER BY created_at DESC LIMIT 50')
    .all(req.user.id);
  res.json({ reports: rows.map(toReportDTO) });
});

export default router;
