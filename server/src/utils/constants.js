export const BADGES = ['none', 'verified', 'staff', 'official', 'content_creator'];
export const ROLES = ['user', 'moderator', 'admin'];
export const STATUSES = ['active', 'suspended', 'banned'];
export const REPORT_REASONS = ['spam', 'harassment', 'inappropriate', 'impersonation', 'scam', 'other'];
export const REPORT_TARGET_TYPES = ['post', 'comment', 'user'];
export const MODERATION_ACTIONS = [
  'dismiss',
  'delete_post',
  'delete_comment',
  'warn_user',
  'suspend_user',
  'ban_user',
  'unban_user',
  'no_action',
];

// Badges are shown next to a display name across the app. `role` (below)
// is a separate, internal permission level — a user can hold the
// "official" badge for display purposes without having moderator powers,
// and vice versa.
export const BADGE_META = {
  verified: { label: 'Verified', description: 'Verified account', color: '#1d9bf0' },
  staff: { label: 'Staff', description: 'BlockFeed staff member', color: '#00ba7c' },
  official: { label: 'Official', description: 'Official account (game studio or Roblox staff)', color: '#f2b90c' },
  content_creator: { label: 'Content Creator', description: 'Content creator', color: '#f4212e' },
};

// Only admins may grant these badges/roles; moderators are limited to the
// lighter-touch ones. Enforced in routes/admin.js.
export const ADMIN_ONLY_BADGES = ['staff', 'official'];
