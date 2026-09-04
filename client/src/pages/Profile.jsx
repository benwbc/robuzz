import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Avatar from '../components/Avatar';
import PostCard from '../components/PostCard';
import ReportModal from '../components/ReportModal';
import BadgeIcon from '../components/BadgeIcon';
import Icon from '../components/Icon';
import RichText from '../components/RichText';
import MentionTextarea from '../components/MentionTextarea';
import { useAuth } from '../context/AuthContext';
import { api, mediaUrl } from '../api';

export default function Profile() {
  const { username } = useParams();
  const { user: me, updateUser } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [following, setFollowing] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const load = () => {
    setLoading(true);
    setError('');
    Promise.all([api.getUser(username), api.postsByUser(username)])
      .then(([u, p]) => {
        setData(u);
        setFollowing(u.isFollowing);
        setPosts(p.posts);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [username]);

  const toggleFollow = async () => {
    try {
      const res = following ? await api.unfollow(username) : await api.follow(username);
      setFollowing(res.isFollowing);
      setData((d) => ({ ...d, counts: res.counts }));
    } catch (err) {
      alert(err.message);
    }
  };

  const handleRemoved = (id) => setPosts((p) => p.filter((x) => x.id !== id && x.repostedPost?.id !== id));

  if (loading) return <div className="spinner-wrap">Loading…</div>;
  if (error || !data) {
    return (
      <div className="empty-state">
        <h3>User not found</h3>
        <p>{error}</p>
      </div>
    );
  }

  const { user, counts, isSelf } = data;

  return (
    <div>
      <div className="main-header" style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <button className="icon-btn" onClick={() => navigate(-1)}>
          <Icon name="arrowLeft" />
        </button>
        <div>
          <div style={{ fontWeight: 800, fontSize: 17, display: 'flex', alignItems: 'center', gap: 4 }}>
            {user.displayName}
            <BadgeIcon badge={user.badge} size={15} />
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{counts.posts} posts</div>
        </div>
      </div>

      <div className="profile-banner">
        {user.bannerUrl && <img src={mediaUrl(user.bannerUrl)} alt="" loading="lazy" decoding="async" />}
      </div>
      <div className="profile-header">
        <div className="profile-actions">
          {isSelf ? (
            <button className="btn btn-secondary" onClick={() => setEditOpen(true)}>
              Edit profile
            </button>
          ) : me ? (
            <>
              <button className="btn btn-secondary" onClick={() => setReportOpen(true)}>
                Report
              </button>
              <button className={`btn ${following ? 'btn-following' : 'btn-follow'}`} onClick={toggleFollow}>
                {following ? 'Following' : 'Follow'}
              </button>
            </>
          ) : null}
        </div>

        <div className="profile-avatar-wrap">
          <Avatar user={user} size={120} linkToProfile={false} />
        </div>

        <div className="profile-name-row">
          <h2>{user.displayName}</h2>
          <BadgeIcon badge={user.badge} size={19} />
        </div>
        <div className="profile-handle">@{user.username}</div>

        {user.status === 'suspended' && <div className="alert alert-warning">This account is temporarily suspended.</div>}
        {user.status === 'banned' && <div className="alert alert-error">This account has been banned.</div>}

        {user.bio && (
          <div className="profile-bio">
            <RichText text={user.bio} />
          </div>
        )}
        {user.robloxUsername && (
          <a
            href={`https://www.roblox.com/users/${user.robloxId}/profile`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-secondary)', margin: '8px 0' }}
          >
            {user.robloxAvatarUrl && (
              <img src={user.robloxAvatarUrl} alt="" style={{ width: 18, height: 18, borderRadius: '50%' }} />
            )}
            Plays as @{user.robloxUsername} on Roblox
          </a>
        )}
        <div className="profile-stats">
          <span>
            <b>{counts.following}</b> Following
          </span>
          <span>
            <b>{counts.followers}</b> Followers
          </span>
        </div>
      </div>

      <div className="profile-tabs">
        <div className="profile-tab active">Posts</div>
      </div>

      {posts.length === 0 ? (
        <div className="empty-state">
          <h3>No posts yet</h3>
        </div>
      ) : (
        posts.map((p) => <PostCard key={p.id} post={p} onRemoved={handleRemoved} />)
      )}

      {editOpen && (
        <EditProfileModal
          user={user}
          onClose={() => setEditOpen(false)}
          onSaved={(u) => {
            setData((d) => ({ ...d, user: { ...d.user, ...u } }));
            updateUser(u);
          }}
        />
      )}
      {reportOpen && <ReportModal targetType="user" targetId={user.id} targetLabel="user" onClose={() => setReportOpen(false)} />}
    </div>
  );
}

function EditProfileModal({ user, onClose, onSaved }) {
  const [displayName, setDisplayName] = useState(user.displayName);
  const [bio, setBio] = useState(user.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl);
  const [bannerUrl, setBannerUrl] = useState(user.bannerUrl);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const avatarInput = useRef(null);
  const bannerInput = useRef(null);

  const uploadAvatar = async (file) => {
    const fd = new FormData();
    fd.append('image', file);
    try {
      const { user: u } = await api.uploadAvatar(fd);
      setAvatarUrl(u.avatarUrl);
    } catch (err) {
      alert(err.message);
    }
  };

  const uploadBanner = async (file) => {
    const fd = new FormData();
    fd.append('image', file);
    try {
      const { user: u } = await api.uploadBanner(fd);
      setBannerUrl(u.bannerUrl);
    } catch (err) {
      alert(err.message);
    }
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const { user: u } = await api.updateMe({ displayName, bio });
      onSaved({ ...u, avatarUrl, bannerUrl });
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Edit profile</h2>
        {error && <div className="alert alert-error">{error}</div>}

        <div className="field">
          <label>Banner</label>
          <div
            className="profile-banner"
            style={{ height: 100, borderRadius: 12, cursor: 'pointer', position: 'static' }}
            onClick={() => bannerInput.current?.click()}
          >
            {bannerUrl && <img src={mediaUrl(bannerUrl)} alt="" style={{ borderRadius: 12 }} />}
          </div>
          <input
            ref={bannerInput}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => e.target.files[0] && uploadBanner(e.target.files[0])}
          />
        </div>

        <div className="field">
          <label>Avatar</label>
          <div style={{ cursor: 'pointer', width: 72 }} onClick={() => avatarInput.current?.click()}>
            <Avatar user={{ ...user, avatarUrl, displayName }} size={72} linkToProfile={false} />
          </div>
          <input
            ref={avatarInput}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => e.target.files[0] && uploadAvatar(e.target.files[0])}
          />
        </div>

        <div className="field">
          <label>Display name</label>
          <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={40} />
        </div>
        <div className="field">
          <label>Bio</label>
          <MentionTextarea
            as="textarea"
            rows={3}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={160}
            placeholder="Tell people about yourself — @mention friends if you'd like"
          />
        </div>

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
