import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';

export default function Overview() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.adminStats().then(setStats).catch(() => {});
  }, []);

  if (!stats) return <div className="spinner-wrap">Loading…</div>;

  const cards = [
    ['Total users', stats.totalUsers],
    ['Total posts', stats.totalPosts],
    ['Pending reports', stats.pendingReports],
    ['Suspended users', stats.suspendedUsers],
    ['Banned users', stats.bannedUsers],
    ['Auto-flagged posts', stats.flaggedPosts],
  ];

  return (
    <div>
      {stats.pendingReports > 0 && (
        <div className="alert alert-warning" style={{ margin: 16 }}>
          {stats.pendingReports} report{stats.pendingReports === 1 ? '' : 's'} waiting for review.{' '}
          <Link to="/admin/reports" style={{ fontWeight: 700 }}>
            Go to queue →
          </Link>
        </div>
      )}
      <div className="stat-grid">
        {cards.map(([label, value]) => (
          <div className="stat-card" key={label}>
            <div className="value">{value}</div>
            <div className="label">{label}</div>
          </div>
        ))}
      </div>
      <div style={{ padding: '0 16px 16px', fontSize: 13, color: 'var(--text-secondary)' }}>
        Signed in as <b>@{user.username}</b> ({user.role}). {user.role === 'moderator' && 'Only admins can grant Staff/Official badges or change roles.'}
      </div>
    </div>
  );
}
