import { Router } from 'express';
import { db } from '../db.js';
import { toAdDTO } from '../utils/serialize.js';

const router = Router();

// Public: the small set of currently-active ads, shown interleaved into
// the feed. No auth required — the same sponsored slots show whether
// you're signed in or just browsing Explore.
router.get('/', async (_req, res) => {
  const rows = await db.all('SELECT * FROM ads WHERE active = 1 ORDER BY created_at DESC LIMIT 20');
  res.json({ ads: rows.map(toAdDTO) });
});

// Fire-and-forget counters the client calls once per render (impression)
// and once per click, purely for the advertiser-facing stats shown on the
// admin Ads page. Best-effort: an unknown/inactive id just 404s quietly.
router.post('/:id/impression', async (req, res) => {
  await db.run('UPDATE ads SET impressions = impressions + 1 WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

router.post('/:id/click', async (req, res) => {
  await db.run('UPDATE ads SET clicks = clicks + 1 WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

export default router;
