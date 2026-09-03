export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission to do that.' });
    }
    next();
  };
}

// Blocks write actions (posting, liking, following, reporting, etc.) for
// suspended/banned accounts. Suspensions that have expired are lifted
// automatically on the next authenticated request.
export function requireActive(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });

  if (req.user.status === 'banned') {
    return res.status(403).json({
      error: 'Your account has been banned.',
      reason: req.user.status_reason || null,
      status: 'banned',
    });
  }

  if (req.user.status === 'suspended') {
    const until = req.user.suspended_until ? new Date(req.user.suspended_until) : null;
    if (!until || until.getTime() > Date.now()) {
      return res.status(403).json({
        error: 'Your account is temporarily suspended.',
        reason: req.user.status_reason || null,
        suspendedUntil: req.user.suspended_until || null,
        status: 'suspended',
      });
    }
  }

  next();
}
