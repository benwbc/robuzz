const TOKEN_KEY = 'blockfeed_token';

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

export function getStoredToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* ignore (private browsing etc.) */
  }
}

export function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

async function request(path, { method = 'GET', body, isForm = false } = {}) {
  const headers = {};
  if (!isForm) headers['Content-Type'] = 'application/json';
  const token = getStoredToken();
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
  auditLog: (page = 1) => request(`/api/admin/audit-log${qs({ page })}`),
};
