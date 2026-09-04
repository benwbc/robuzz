import { normalizeOrigin } from './normalize.js';

const DISCORD_CLIENT_ID = (process.env.DISCORD_CLIENT_ID || '').trim();
const DISCORD_CLIENT_SECRET = (process.env.DISCORD_CLIENT_SECRET || '').trim();

// The server's own public base URL — needed to build the callback URL
// Discord sends people back to after they approve sign-in, which has to
// exactly match one of the "Redirects" registered on the Discord
// application. This comes from an explicit env var (mirroring how
// CLIENT_ORIGIN is the client's own address) rather than being guessed from
// the incoming request, which isn't reliable behind a host's own proxy.
// Defaults to local dev's address when unset, same as CLIENT_ORIGIN does.
const API_URL = normalizeOrigin(process.env.API_URL) || `http://localhost:${process.env.PORT || 3001}`;

export const discordConfigured = !!(DISCORD_CLIENT_ID && DISCORD_CLIENT_SECRET);
export const DISCORD_REDIRECT_URI = `${API_URL}/api/auth/discord/callback`;

// Overridable ONLY by this project's own integration tests, which run a
// small local stand-in instead of hitting the real Discord — never set,
// mentioned, or expected on an actual deployment.
const API_BASE = process.env.DISCORD_API_BASE_OVERRIDE || 'https://discord.com/api/v10';
const AUTHORIZE_URL = process.env.DISCORD_AUTHORIZE_BASE_OVERRIDE || 'https://discord.com/oauth2/authorize';
const CDN_BASE = process.env.DISCORD_CDN_BASE_OVERRIDE || 'https://cdn.discordapp.com';

// `identify` gets the account's id/username/avatar; `email` gets its
// (Discord-verified) email address. Both are the lowest tier of Discord
// OAuth scope — no special app review or verification needed to use them,
// unlike scopes that touch a person's servers or messages.
export function buildAuthorizeUrl(state) {
  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: DISCORD_REDIRECT_URI,
    response_type: 'code',
    scope: 'identify email',
  });
  if (state) params.set('state', state);
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

export async function exchangeCodeForToken(code) {
  const res = await fetch(`${API_BASE}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: DISCORD_CLIENT_ID,
      client_secret: DISCORD_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: DISCORD_REDIRECT_URI,
    }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.access_token) {
    throw new Error(data?.error_description || 'Discord rejected the sign-in request.');
  }
  return data.access_token;
}

export async function fetchDiscordUser(accessToken) {
  const res = await fetch(`${API_BASE}/users/@me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.id) {
    throw new Error('Could not read your Discord profile.');
  }
  return data;
}

// Only accounts with a custom avatar get a URL back — Discord's default
// (no-avatar) images need a bit of math to pick the right one and aren't
// worth the complexity here; those accounts just start with no avatar,
// same as anyone who signs up the normal way, and can set one any time.
export function discordAvatarUrl(discordUser) {
  if (!discordUser.avatar) return null;
  const ext = discordUser.avatar.startsWith('a_') ? 'gif' : 'png';
  return `${CDN_BASE}/avatars/${discordUser.id}/${discordUser.avatar}.${ext}?size=256`;
}
