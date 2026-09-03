import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from '../components/Icon';
import { NameWithBadge } from '../components/BadgeIcon';
import { api } from '../api';
import { timeAgo } from '../utils';

const ICONS = {
  like: 'heart',
  comment: 'comment',
  follow: 'user',
  repost: 'repost',
  mention: 'flag',
  moderation: 'shield',
};

export default function Notifications() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api
      .notifications()
      .then((d) => setItems(d.notifications))
      .finally(() => setLoading(false));
    api.markAllRead().catch(() => {});
  }, []);

  const go = (n) => {
    if (n.postId) navigate(`/post/${n.postId}`);
    else if (n.type === 'follow' && n.actor) navigate(`/u/${n.actor.username}`);
  };

  return (
    <div>
      <div className="main-header">
        <h1>Notifications</h1>
      </div>
      {loading ? (
        <div className="spinner-wrap">Loading…</div>
      ) : items.length === 0 ? (
        <div className="empty-state">
          <h3>Nothing yet</h3>
          <p>Likes, comments, follows and staff messages show up here.</p>
        </div>
      ) : (
        items.map((n) => (
          <div
            key={n.id}
            className={`notif-item ${n.read ? '' : 'unread'}`}
            onClick={() => go(n)}
            style={{ cursor: n.postId || n.type === 'follow' ? 'pointer' : 'default' }}
          >
            <div className={`notif-icon ${n.type}`}>
              <Icon name={ICONS[n.type] || 'bell'} size={16} filled />
            </div>
            <div style={{ minWidth: 0 }}>
              {n.actor ? (
                <div>
                  <Link to={`/u/${n.actor.username}`} onClick={(e) => e.stopPropagation()}>
                    <NameWithBadge user={n.actor} />
                  </Link>{' '}
                  <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>· {timeAgo(n.createdAt)}</span>
                </div>
              ) : (
                <div>
                  <b>BlockFeed</b> <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>· {timeAgo(n.createdAt)}</span>
                </div>
              )}
              <div style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 2 }}>{n.message}</div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
