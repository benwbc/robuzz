export function timeAgo(iso) {
  const date = new Date(iso);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 5) return 'now';
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
}

export function initialsFor(name) {
  return (name || '?').trim().slice(0, 1).toUpperCase();
}

// Strips a username input down to exactly what the server will accept
// (letters, numbers, underscore — see USERNAME_RE on the server) as the
// person types, instead of letting them type e.g. a space and only finding
// out it's invalid when the form is submitted.
export function sanitizeUsername(raw) {
  return (raw || '').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20);
}

// Splits post/comment text into plain strings and {mention|hashtag} tokens
// so the caller can render links without dangerouslySetInnerHTML.
export function tokenizeRichText(text) {
  if (!text) return [];
  const parts = [];
  const re = /([@#][a-zA-Z0-9_]{2,30})/g;
  let lastIndex = 0;
  let match;
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push({ type: 'text', value: text.slice(lastIndex, match.index) });
    const token = match[0];
    parts.push({ type: token[0] === '@' ? 'mention' : 'hashtag', value: token.slice(1) });
    lastIndex = match.index + token.length;
  }
  if (lastIndex < text.length) parts.push({ type: 'text', value: text.slice(lastIndex) });
  return parts;
}
