// Very small, easily-extended automated filter. Real deployments would
// swap this for a proper trust & safety pipeline; this exists to show
// the moderation queue receiving system-generated reports as well as
// user-generated ones (a lot of real Roblox-adjacent spam is exactly
// this kind of "free Robux generator" scam link).
const FLAGGED_PATTERNS = [
  { pattern: /free\s*robux/i, reason: 'Possible Robux scam ("free robux")' },
  { pattern: /robux\s*generator/i, reason: 'Possible Robux scam ("generator")' },
  { pattern: /\bphishing\b/i, reason: 'Mentions phishing' },
  { pattern: /\bgive\s*away\b.{0,20}\bpassword\b/i, reason: 'Possible credential harvesting' },
  { pattern: /\bscam\b/i, reason: 'Contains the word "scam"' },
];

export function scanContent(text) {
  if (!text) return { flagged: false, reason: null };
  for (const { pattern, reason } of FLAGGED_PATTERNS) {
    if (pattern.test(text)) {
      return { flagged: true, reason };
    }
  }
  return { flagged: false, reason: null };
}
