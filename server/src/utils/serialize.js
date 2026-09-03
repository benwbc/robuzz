export function toPublicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    bio: row.bio,
    avatarUrl: row.avatar_url || null,
    avatarColor: row.avatar_color,
    bannerUrl: row.banner_url || null,
    robloxId: row.roblox_id || null,
    robloxUsername: row.roblox_username || null,
    robloxDisplayName: row.roblox_display_name || null,
    robloxAvatarUrl: row.roblox_avatar_url || null,
    badge: row.badge,
    status: row.status,
    createdAt: row.created_at,
  };
}

// Includes fields only the account owner (or an admin) should see.
export function toPrivateUser(row) {
  if (!row) return null;
  return {
    ...toPublicUser(row),
    email: row.email,
    role: row.role,
    statusReason: row.status_reason || null,
    suspendedUntil: row.suspended_until || null,
  };
}

export function toPostDTO(row, { likedByMe = false, author = null } = {}) {
  return {
    id: row.id,
    authorId: row.author_id,
    author: author ? toPublicUser(author) : undefined,
    text: row.text,
    images: JSON.parse(row.images || '[]'),
    repostOf: row.repost_of || null,
    createdAt: row.created_at,
    deleted: !!row.deleted,
    deletedReason: row.deleted_reason || null,
    flagged: !!row.flagged,
    flagReason: row.flag_reason || null,
    likedByMe,
  };
}

export function toCommentDTO(row, { author = null } = {}) {
  return {
    id: row.id,
    postId: row.post_id,
    authorId: row.author_id,
    author: author ? toPublicUser(author) : undefined,
    text: row.text,
    createdAt: row.created_at,
    deleted: !!row.deleted,
    deletedReason: row.deleted_reason || null,
  };
}

export function toReportDTO(row) {
  return {
    id: row.id,
    reporterId: row.reporter_id,
    targetType: row.target_type,
    targetId: row.target_id,
    reason: row.reason,
    details: row.details,
    status: row.status,
    resolvedBy: row.resolved_by,
    resolutionNote: row.resolution_note,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  };
}

export function toTicketDTO(row) {
  return {
    id: row.id,
    userId: row.user_id,
    subject: row.subject,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toTicketMessageDTO(row) {
  return {
    id: row.id,
    ticketId: row.ticket_id,
    authorId: row.author_id,
    isStaff: !!row.is_staff,
    message: row.message,
    createdAt: row.created_at,
  };
}

export function toAuditLogDTO(row) {
  return {
    id: row.id,
    moderatorId: row.moderator_id,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    reason: row.reason,
    createdAt: row.created_at,
  };
}
