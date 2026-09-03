import { BADGE_META } from '../constants';

export default function BadgeIcon({ badge, size = 16 }) {
  if (!badge || badge === 'none' || !BADGE_META[badge]) return null;
  const meta = BADGE_META[badge];
  return (
    <span className="badge">
      <svg width={size} height={size} viewBox="0 0 22 22" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M11 0l2.4 1.4 2.7-.4 1.3 2.4 2.4 1.3-.4 2.7L21 10l-1.4 2.4.4 2.7-2.4 1.3-1.3 2.4-2.7-.4L11 20l-2.4-1.4-2.7.4-1.3-2.4L2.2 15.3l.4-2.7L1 10l1.4-2.4-.4-2.7 2.4-1.3L5.7 1l2.7.4L11 0z"
          fill={meta.color}
        />
        <path d="M6.7 10.6l2.6 2.6 5-5.6" stroke="#0e0f11" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
      <span className="tooltip" role="tooltip">
        {meta.label}
      </span>
    </span>
  );
}

export function NameWithBadge({ user, className = '' }) {
  if (!user) return null;
  return (
    <span className={className} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.displayName}</span>
      <BadgeIcon badge={user.badge} />
    </span>
  );
}
