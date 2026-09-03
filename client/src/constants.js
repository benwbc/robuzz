// Keep in sync with server/src/utils/constants.js
export const BADGE_META = {
  verified: { label: 'Verified', description: 'Verified account', color: '#1d9bf0' },
  staff: { label: 'Staff', description: 'RoBuzz staff member', color: '#00ba7c' },
  official: { label: 'Official', description: 'Official account (game studio or Roblox staff)', color: '#f2b90c' },
  content_creator: { label: 'Content Creator', description: 'Content creator', color: '#f4212e' },
};

export const REPORT_REASONS = [
  { value: 'spam', label: 'Spam' },
  { value: 'harassment', label: 'Harassment or bullying' },
  { value: 'inappropriate', label: 'Inappropriate content' },
  { value: 'impersonation', label: 'Impersonation' },
  { value: 'scam', label: 'Scam or fraud' },
  { value: 'other', label: 'Something else' },
];

export const MODERATION_ACTIONS = [
  { value: 'dismiss', label: 'Dismiss report (no action)' },
  { value: 'delete_post', label: 'Remove the post' },
  { value: 'delete_comment', label: 'Remove the comment' },
  { value: 'warn_user', label: 'Warn the user' },
  { value: 'suspend_user', label: 'Suspend the user' },
  { value: 'ban_user', label: 'Ban the user' },
  { value: 'unban_user', label: 'Restore the user' },
];

export const BADGES = ['none', 'verified', 'staff', 'official', 'content_creator'];
export const ADMIN_ONLY_BADGES = ['staff', 'official'];
export const ROLES = ['user', 'moderator', 'admin'];
export const STATUSES = ['active', 'suspended', 'banned'];
