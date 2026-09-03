import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import { timeAgo } from '../../utils';

const ACTION_LABEL = {
  delete_post: 'removed a post',
  delete_comment: 'removed a comment',
  warn_user: 'warned',
  suspend_user: 'suspended',
  ban_user: 'banned',
  unban_user: 'restored',
  reactivate_user: 'restored',
  set_role: 'changed the role of',
  set_badge: 'changed the badge of',
};

export default function AuditLog() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .auditLog()
      .then((d) => setEntries(d.entries))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="spinner-wrap">Loading…</div>;
  if (entries.length === 0) {
    return (
      <div className="empty-state">
        <h3>No actions yet</h3>
        <p>Moderator and admin actions will be logged here.</p>
      </div>
    );
  }

  return (
    <div>
      {entries.map((e) => (
        <div className="audit-item" key={e.id}>
          <div className="action">
            <Link to={`/u/${e.moderator?.username}`}>@{e.moderator?.username}</Link> {ACTION_LABEL[e.action] || e.action}{' '}
            {e.target ? <Link to={`/u/${e.target.username}`}>@{e.target.username}</Link> : `a ${e.targetType}`}
          </div>
          {e.reason && <div className="meta">"{e.reason}"</div>}
          <div className="meta">{timeAgo(e.createdAt)}</div>
        </div>
      ))}
    </div>
  );
}
