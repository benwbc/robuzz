// ---- Multi-account session storage ----
// Signing in used to store a single token under one key. To let someone be
// signed into several accounts at once and switch between them, storage now
// holds a small list of accounts (each its own token + a cached copy of its
// user, so the switcher UI has something to show instantly) plus a pointer
// to which one is currently active. Every existing helper below
// (getStoredToken, request(), ...) keeps working unchanged because it just
// asks "what's the active token right now" — it doesn't need to know
// there's more than one account sitting alongside it.
const LEGACY_TOKEN_KEY = 'blockfeed_token';
const ACCOUNTS_KEY = 'blockfeed_accounts';
const ACTIVE_ACCOUNT_KEY = 'blockfeed_active_account';
export const MAX_ACCOUNTS = 5;

function readAccounts() {
  try {
    const raw = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function writeAccounts(list) {
  try {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(list));
  } catch {
    /* ignore (private browsing, storage full, etc.) */
  }
}

export function getActiveAccountId() {
  try {
    return localStorage.getItem(ACTIVE_ACCOUNT_KEY);
  } catch {
    return null;
  }
}

export function setActiveAccountId(id) {
  try {
    if (id) localStorage.setItem(ACTIVE_ACCOUNT_KEY, id);
    else localStorage.removeItem(ACTIVE_ACCOUNT_KEY);
  } catch {
    /* ignore */
  }
}

export function getAccounts() {
  return readAccounts();
}

// One-time upgrade from the old single-token scheme: carry an
// already-signed-in session forward as the first entry in the new list
// instead of silently signing the person out when this update ships. The
// placeholder id is resolved to the real user id the first time /api/auth/me
// succeeds for it (see finalizeActiveAccountId below); if the token turns
// out to be expired/invalid, the normal refresh-failure path in
// AuthContext removes it like any other dead account.
export function migrateLegacyToken() {
  try {
    const legacy = localStorage.getItem(LEGACY_TOKEN_KEY);
    if (legacy && readAccounts().length === 0) {
      writeAccounts([{ id: 'pending', token: legacy, user: null }]);
      setActiveAccountId('pending');
    }
    localStorage.removeItem(LEGACY_TOKEN_KEY);
  } catch {
    /* ignore */
  }
}
migrateLegacyToken();

// Adds a signed-in account (or refreshes/re-activates one that's already
// signed in — logging into an account you're already signed into just
// switches to it rather than duplicating it) and makes it the active one.
// Returns { ok: false, reason: 'cap' } instead of adding a genuinely new,
// distinct account past MAX_ACCOUNTS.
export function addAccount({ token, user }) {
  const list = readAccounts();
  const withoutThisOne = list.filter((a) => a.id !== user.id);
  if (withoutThisOne.length >= MAX_ACCOUNTS) {
    return { ok: false, reason: 'cap' };
  }
  writeAccounts([...withoutThisOne, { id: user.id, token, user }]);
  setActiveAccountId(user.id);
  return { ok: true };
}

// Renames a still-placeholder entry (id 'pending', from legacy migration)
// to the real user id once it's known, and keeps that account's cached
// user snapshot fresh on every successful /api/auth/me. A no-op rename is
// harmless, so callers can call this after every refresh without checking
// whether the account was a placeholder first.
export function finalizeActiveAccountId(user) {
  const oldId = getActiveAccountId();
  const list = readAccounts();
  const idx = list.findIndex((a) => a.id === oldId);
  if (idx === -1) return;
  if (oldId === user.id) {
    list[idx] = { ...list[idx], user };
    writeAccounts(list);
    return;
  }
  const dupe = list.some((a) => a.id === user.id);
  if (dupe) {
    list.splice(idx, 1); // already present under its real id — drop the placeholder
  } else {
    list[idx] = { ...list[idx], id: user.id, user };
  }
  writeAccounts(list);
  setActiveAccountId(user.id);
}

// Signs an account out and drops it from the switcher. If it was the
// active one, switches active to whichever account is now first in the
// list (or clears it entirely if none remain) — the caller decides what
// that means for navigation. Returns the accounts remaining afterward.
export function removeAccount(id) {
  const list = readAccounts().filter((a) => a.id !== id);
  writeAccounts(list);
  if (getActiveAccountId() === id) {
    setActiveAccountId(list.length > 0 ? list[0].id : null);
  }
  return list;
}

export function getStoredToken() {
  const list = readAccounts();
  const activeId = getActiveAccountId();
  const entry = (activeId && list.find((a) => a.id === activeId)) || list[0] || null;
  return entry ? entry.token : null;
}

// Patches the cached user snapshot for one signed-in account (e.g. after a
// profile edit) so the account-switcher list reflects it immediately,
// without waiting for that account to be re-activated and re-fetched.
export function updateAccountUser(id, patch) {
  const list = readAccounts();
  const idx = list.findIndex((a) => a.id === id);
  if (idx === -1) return;
  list[idx] = { ...list[idx], user: { ...list[idx].user, ...patch } };
  writeAccounts(list);
}

// In local dev this is empty, so requests go to relative paths like
// "/api/..." which Vite's dev proxy forwards to the server. In production
// (a static build with no proxy) this is set at build time to the real
// deployed API's URL, e.g. VITE_API_URL=https://blockfeed-api.onrender.com
const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

// Turns a URL that came back from the API into something a browser can
// always load. Supabase Storage URLs (and Roblox's) are already absolute
// and pass through untouched; a plain "/uploads/..." path (local disk
// storage) gets the API's origin prepended so it still resolves correctly
// when the page itself is served from a different origin (the static site).
export function mediaUrl(url) {
  if (!url) return url;
  if (/^([a-z][a-z0-9+.-]*:)?\/\//i.test(url) || url.startsWith('data:')) return url;
  return `${API_BASE}${url}`;
}

// Shared between DiscordButton (writes it, right before leaving the app)
// and OAuthCallback (reads and clears it, on the way back in) so both sides
// agree on where the CSRF-guard nonce lives without importing each other.
export const OAUTH_STATE_KEY = 'blockfeed_oauth_state';

// Builds the URL a "Continue with Discord" button sends the browser to —
// this is a real full-page navigation (not a fetch through request()),
// since it has to leave the app entirely to reach Discord's own consent
// screen. `state` is a nonce the caller generated and stashed in
// sessionStorage, checked back against on the way in through OAuthCallback.
export function discordAuthUrl(state) {
  return `${API_BASE}/api/auth/discord${qs({ state })}`;
}

async function request(path, { method = 'GET', body, isForm = false, tokenOverride } = {}) {
  const headers = {};
  if (!isForm) headers['Content-Type'] = 'application/json';
  // tokenOverride lets a caller check a token that isn't (yet) the active
  // stored account — used right after the Discord redirect comes back,
  // before that token has been saved anywhere, to fetch its user profile.
  const token = tokenOverride !== undefined ? tokenOverride : getStoredToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: isForm ? body : body !== undefined ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const err = new Error(data?.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

const qs = (params = {}) => {
  const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''));
  const s = new URLSearchParams(clean).toString();
  return s ? `?${s}` : '';
};

export const api = {
  signup: (payload) => request('/api/auth/signup', { method: 'POST', body: payload }),
  login: (payload) => request('/api/auth/login', { method: 'POST', body: payload }),
  me: () => request('/api/auth/me'),
  meWithToken: (token) => request('/api/auth/me', { tokenOverride: token }),

  getUser: (username) => request(`/api/users/${encodeURIComponent(username)}`),
  updateMe: (payload) => request('/api/users/me', { method: 'PATCH', body: payload }),
  uploadAvatar: (formData) => request('/api/users/me/avatar', { method: 'POST', body: formData, isForm: true }),
  uploadBanner: (formData) => request('/api/users/me/banner', { method: 'POST', body: formData, isForm: true }),
  updateUsername: (payload) => request('/api/users/me/username', { method: 'PATCH', body: payload }),
  updatePassword: (payload) => request('/api/users/me/password', { method: 'PATCH', body: payload }),
  linkRoblox: (robloxUsername) => request('/api/users/me/roblox', { method: 'POST', body: { robloxUsername } }),
  unlinkRoblox: () => request('/api/users/me/roblox', { method: 'DELETE' }),
  follow: (username) => request(`/api/users/${encodeURIComponent(username)}/follow`, { method: 'POST' }),
  unfollow: (username) => request(`/api/users/${encodeURIComponent(username)}/follow`, { method: 'DELETE' }),
  followers: (username) => request(`/api/users/${encodeURIComponent(username)}/followers`),
  following: (username) => request(`/api/users/${encodeURIComponent(username)}/following`),

  createPost: (formData) => request('/api/posts', { method: 'POST', body: formData, isForm: true }),
  feed: (tab = 'following', page = 1) => request(`/api/posts/feed${qs({ tab, page })}`),
  explore: (page = 1) => request(`/api/posts/explore${qs({ page })}`),
  postsByUser: (username, page = 1) => request(`/api/posts/by/${encodeURIComponent(username)}${qs({ page })}`),
  getPost: (id) => request(`/api/posts/${id}`),
  deletePost: (id, reason) => request(`/api/posts/${id}`, { method: 'DELETE', body: reason ? { reason } : {} }),
  like: (id) => request(`/api/posts/${id}/like`, { method: 'POST' }),
  unlike: (id) => request(`/api/posts/${id}/like`, { method: 'DELETE' }),
  repost: (id) => request(`/api/posts/${id}/repost`, { method: 'POST' }),
  addComment: (id, text) => request(`/api/posts/${id}/comments`, { method: 'POST', body: { text } }),
  deleteComment: (id, reason) => request(`/api/posts/comments/${id}`, { method: 'DELETE', body: reason ? { reason } : {} }),

  search: (q) => request(`/api/search${qs({ q })}`),

  notifications: () => request('/api/notifications'),
  markNotifRead: (id) => request(`/api/notifications/${id}/read`, { method: 'POST' }),
  markAllRead: () => request('/api/notifications/read-all', { method: 'POST' }),

  report: (payload) => request('/api/reports', { method: 'POST', body: payload }),
  myReports: () => request('/api/reports/mine'),

  adminStats: () => request('/api/admin/stats'),
  adminReports: (status) => request(`/api/admin/reports${qs({ status })}`),
  resolveReport: (id, payload) => request(`/api/admin/reports/${id}/resolve`, { method: 'POST', body: payload }),
  adminUsers: (params) => request(`/api/admin/users${qs(params)}`),
  updateAdminUser: (id, payload) => request(`/api/admin/users/${id}`, { method: 'PATCH', body: payload }),
  uploadAdminUserAvatar: (id, formData) => request(`/api/admin/users/${id}/avatar`, { method: 'POST', body: formData, isForm: true }),
  removeAdminUserAvatar: (id) => request(`/api/admin/users/${id}/avatar`, { method: 'DELETE' }),
  uploadAdminUserBanner: (id, formData) => request(`/api/admin/users/${id}/banner`, { method: 'POST', body: formData, isForm: true }),
  removeAdminUserBanner: (id) => request(`/api/admin/users/${id}/banner`, { method: 'DELETE' }),
  auditLog: (page = 1) => request(`/api/admin/audit-log${qs({ page })}`),

  myTickets: () => request('/api/support/tickets'),
  createTicket: (payload) => request('/api/support/tickets', { method: 'POST', body: payload }),
  getTicket: (id) => request(`/api/support/tickets/${id}`),
  replyTicket: (id, message) => request(`/api/support/tickets/${id}/messages`, { method: 'POST', body: { message } }),

  adminTickets: (status) => request(`/api/admin/support/tickets${qs({ status })}`),
  adminGetTicket: (id) => request(`/api/admin/support/tickets/${id}`),
  adminReplyTicket: (id, message) => request(`/api/admin/support/tickets/${id}/messages`, { method: 'POST', body: { message } }),
  adminSetTicketStatus: (id, status) => request(`/api/admin/support/tickets/${id}/status`, { method: 'POST', body: { status } }),

  ads: () => request('/api/ads'),
  trackAdImpression: (id) => request(`/api/ads/${id}/impression`, { method: 'POST' }),
  trackAdClick: (id) => request(`/api/ads/${id}/click`, { method: 'POST' }),

  adminAds: () => request('/api/admin/ads'),
  createAd: (formData) => request('/api/admin/ads', { method: 'POST', body: formData, isForm: true }),
  updateAd: (id, payload) => request(`/api/admin/ads/${id}`, { method: 'PATCH', body: payload }),
  deleteAd: (id) => request(`/api/admin/ads/${id}`, { method: 'DELETE' }),
};
