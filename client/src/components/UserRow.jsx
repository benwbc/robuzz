import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Avatar from './Avatar';
import { NameWithBadge } from './BadgeIcon';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

export default function UserRow({ user, showFollow = true, right = null }) {
  const { user: me } = useAuth();
  const navigate = useNavigate();
  const [following, setFollowing] = useState(!!user.isFollowing);
  const [busy, setBusy] = useState(false);

  const toggleFollow = async (e) => {
    e.stopPropagation();
    if (busy || !me) return;
    setBusy(true);
    try {
      const res = following ? await api.unfollow(user.username) : await api.follow(user.username);
      setFollowing(res.isFollowing);
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="user-row" onClick={() => navigate(`/u/${user.username}`)} style={{ cursor: 'pointer' }}>
      <Avatar user={user} size={44} linkToProfile={false} />
      <div className="user-row-info">
        <div className="user-row-name">
          <NameWithBadge user={user} />
        </div>
        <div className="user-row-handle">
          @{user.username}
          {user.status && user.status !== 'active' ? ` · ${user.status}` : ''}
        </div>
        {user.bio ? <div className="user-row-bio">{user.bio}</div> : null}
      </div>
      {right}
      {showFollow && me && me.username !== user.username && (
        <button className={`btn btn-sm ${following ? 'btn-following' : 'btn-follow'}`} onClick={toggleFollow} disabled={busy}>
          {following ? 'Following' : 'Follow'}
        </button>
      )}
    </div>
  );
}
