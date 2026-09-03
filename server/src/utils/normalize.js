// Small env-value cleanup helpers. Env vars in a host's dashboard (Render,
// etc.) are hand-typed or copy/pasted by a person, and it's very easy to
// carry over a trailing slash, extra whitespace, or a stray path segment
// without noticing — CLIENT_ORIGIN and SUPABASE_URL have both bitten this
// project that way before. Rather than trust every value to be pasted
// perfectly, normalize the ones that matter so a small paste mistake is
// silently corrected instead of surfacing as a confusing runtime error.

// Reduces a URL-shaped value down to just its origin (protocol + host),
// which is what both CLIENT_ORIGIN (compared against the browser's Origin
// header) and SUPABASE_URL (Supabase's "Project URL") actually are. This
// drops anything a paste accidentally added on top — a trailing slash, an
// extra `/rest/v1` or `/storage/v1` picked up from the wrong field, etc.
// Falls back to a trimmed, trailing-slash-stripped string if the value
// isn't a parseable URL at all, so a bad value still reaches the code that
// uses it (and can log/report it clearly) instead of throwing here.
export function normalizeOrigin(raw) {
  const trimmed = (raw || '').trim();
  if (!trimmed) return '';
  try {
    return new URL(trimmed).origin;
  } catch {
    return trimmed.replace(/\/+$/, '');
  }
}

// Trims whitespace and any leading/trailing slashes from a bare name value
// (a Supabase bucket name, say) — never a URL, just a name.
export function normalizeSlug(raw) {
  return (raw || '').trim().replace(/^\/+|\/+$/g, '');
}
