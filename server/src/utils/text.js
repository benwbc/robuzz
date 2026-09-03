export function extractMentions(text) {
  if (!text) return [];
  const matches = text.match(/@([a-zA-Z0-9_]{3,20})/g) || [];
  return [...new Set(matches.map((m) => m.slice(1).toLowerCase()))];
}

export function extractHashtags(text) {
  if (!text) return [];
  const matches = text.match(/#([a-zA-Z0-9_]{2,30})/g) || [];
  return [...new Set(matches.map((m) => m.slice(1).toLowerCase()))];
}
