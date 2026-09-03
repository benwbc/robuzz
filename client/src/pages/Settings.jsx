import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Avatar from '../components/Avatar';
import Icon from '../components/Icon';
import { useAuth } from '../context/AuthContext';
import { api, mediaUrl } from '../api';

export default function Settings() {
  const { user, updateUser, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  return (
    <div>
      <div className="main-header">
        <h1>Settings</h1>
      </div>

      <ProfileSection user={user} updateUser={updateUser} />
      <RobloxSection user={user} updateUser={updateUser} />
      <AccountSection user={user} updateUser={updateUser} />

      <div className="settings-section" style={{ border: 'none' }}>
        <button
          className="btn btn-secondary"
          onClick={() => {
            logout();
            navigate('/login');
          }}
        >
          <Icon name="logout" size={16} style={{ marginRight: 8, verticalAlign: -3 }} />
          Log out
        </button>
      </div>
    </div>
  );
}

function ProfileSection({ user, updateUser }) {
  const [displayName, setDisplayName] = useState(user.displayName);
  const [bio, setBio] = useState(user.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl);
  const [bannerUrl, setBannerUrl] = useState(user.bannerUrl);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const avatarInput = useRef(null);
  const bannerInput = useRef(null);

  const uploadAvatar = async (file) => {
    const fd = new FormData();
    fd.append('image', file);
    try {
      const { user: u } = await api.uploadAvatar(fd);
      setAvatarUrl(u.avatarUrl);
      updateUser(u);
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
      updateUser(u);
    } catch (err) {
      alert(err.message);
    }
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess(false);
    try {
      const { user: u } = await api.updateMe({ displayName, bio });
      updateUser(u);
      setSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="settings-section" onSubmit={save}>
      <h3>Profile</h3>
      <p className="hint">This is what other people see on your posts and profile.</p>
      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">Saved.</div>}

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
        <textarea rows={3} value={bio} onChange={(e) => setBio(e.target.value)} maxLength={160} />
      </div>

      <button className="btn btn-primary" type="submit" disabled={saving}>
        {saving ? 'Saving…' : 'Save profile'}
      </button>
    </form>
  );
}

function RobloxSection({ user, updateUser }) {
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const link = async (e) => {
    e.preventDefault();
    if (!username.trim()) return;
    setBusy(true);
    setError('');
    try {
      const { user: u } = await api.linkRoblox(username.trim());
      updateUser(u);
      setUsername('');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const unlink = async () => {
    if (!confirm('Unlink your Roblox account?')) return;
    setBusy(true);
    setError('');
    try {
      const { user: u } = await api.unlinkRoblox();
      updateUser(u);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="settings-section">
      <h3>Roblox account</h3>
      <p className="hint">
        Link your Roblox username to show your real Roblox avatar here. This looks up your public Roblox profile —
        it doesn't verify you own the account or sign you in with Roblox.
      </p>
      {error && <div className="alert alert-error">{error}</div>}

      {user.robloxUsername ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="avatar" style={{ width: 48, height: 48, background: '#555' }}>
            {user.robloxAvatarUrl && <img src={user.robloxAvatarUrl} alt="" />}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700 }}>{user.robloxDisplayName}</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>@{user.robloxUsername} on Roblox</div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={unlink} disabled={busy}>
            Unlink
          </button>
        </div>
      ) : (
        <form style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }} onSubmit={link}>
          <input
            type="text"
            placeholder="Your Roblox username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={{ flex: 1, minWidth: 160 }}
          />
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? 'Linking…' : 'Link account'}
          </button>
        </form>
      )}
    </div>
  );
}

function AccountSection({ user, updateUser }) {
  const [username, setUsername] = useState(user.username);
  const [usernamePassword, setUsernamePassword] = useState('');
  const [usernameBusy, setUsernameBusy] = useState(false);
  const [usernameError, setUsernameError] = useState('');
  const [usernameSuccess, setUsernameSuccess] = useState(false);

  const saveUsername = async (e) => {
    e.preventDefault();
    setUsernameBusy(true);
    setUsernameError('');
    setUsernameSuccess(false);
    try {
      const { user: u } = await api.updateUsername({ username, currentPassword: usernamePassword });
      updateUser(u);
      setUsernamePassword('');
      setUsernameSuccess(true);
    } catch (err) {
      setUsernameError(err.message);
    } finally {
      setUsernameBusy(false);
    }
  };

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const savePassword = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess(false);
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords don't match.");
      return;
    }
    setPasswordBusy(true);
    try {
      await api.updatePassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordSuccess(true);
    } catch (err) {
      setPasswordError(err.message);
    } finally {
      setPasswordBusy(false);
    }
  };

  return (
    <>
      <form className="settings-section" onSubmit={saveUsername}>
        <h3>Username</h3>
        <p className="hint">Changing this changes your @handle everywhere. Old profile links will stop working.</p>
        {usernameError && <div className="alert alert-error">{usernameError}</div>}
        {usernameSuccess && <div className="alert alert-success">Username updated.</div>}
        <div className="field">
          <label>Username</label>
          <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} maxLength={20} />
        </div>
        <div className="field">
          <label>Current password</label>
          <input
            type="password"
            value={usernamePassword}
            onChange={(e) => setUsernamePassword(e.target.value)}
            placeholder="Confirm it's you"
          />
        </div>
        <button className="btn btn-primary" type="submit" disabled={usernameBusy}>
          {usernameBusy ? 'Saving…' : 'Save username'}
        </button>
      </form>

      <form className="settings-section" onSubmit={savePassword}>
        <h3>Password</h3>
        {passwordError && <div className="alert alert-error">{passwordError}</div>}
        {passwordSuccess && <div className="alert alert-success">Password updated.</div>}
        <div className="field">
          <label>Current password</label>
          <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
        </div>
        <div className="field">
          <label>New password</label>
          <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
        </div>
        <div className="field">
          <label>Confirm new password</label>
          <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
        </div>
        <button className="btn btn-primary" type="submit" disabled={passwordBusy}>
          {passwordBusy ? 'Saving…' : 'Change password'}
        </button>
      </form>
    </>
  );
}
