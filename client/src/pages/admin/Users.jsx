import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Avatar from '../../components/Avatar';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../api';
import { BADGES, ROLES, STATUSES, ADMIN_ONLY_BADGES, BADGE_META } from '../../constants';

// Moderators can manage regular accounts; editing another staff member's
// account details (username/password/etc.) is admin-only, mirrored from
// the same rule the server enforces.
function canEditDetails(me, u) {
  const targetIsStaff = u.role === 'moderator' || u.role === 'admin';
  return me.role === 'admin' || !targetIsStaff || u.id === me.id;
}

export default function Users() {
  const { user: me } = useAuth();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);

  const load = () => {
    setLoading(true);
    api
      .adminUsers({ query, status: statusFilter })
      .then((d) => setUsers(d.users))
      .finally(() => setLoading(false));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [statusFilter]);

  const submitSearch = (e) => {
    e.preventDefault();
    load();
  };

  const patch = async (id, payload) => {
    try {
      const { user } = await api.updateAdminUser(id, payload);
      setUsers((us) => us.map((u) => (u.id === id ? user : u)));
    } catch (err) {
      alert(err.message);
    }
  };

  const handleBadgeChange = (u, badge) => {
    if (ADMIN_ONLY_BADGES.includes(badge) && me.role !== 'admin') {
      alert('Only admins can grant that badge.');
      return;
    }
    patch(u.id, { badge });
  };

  const handleRoleChange = (u, role) => {
    if (me.role !== 'admin') {
      alert('Only admins can change roles.');
      return;
    }
    patch(u.id, { role });
  };

  const handleStatusChange = (u, status) => {
    if (status === 'suspended') {
      const daysInput = prompt('Suspend for how many days?', '3');
      if (!daysInput) return;
      const reason = prompt('Reason (shown to the user):', '') || '';
      patch(u.id, { status, durationDays: Number(daysInput), reason });
    } else if (status === 'banned') {
      if (!confirm(`Ban @${u.username}? This blocks them from logging in.`)) return;
      const reason = prompt('Reason (shown to the user):', '') || '';
      patch(u.id, { status, reason });
    } else {
      patch(u.id, { status });
    }
  };

  return (
    <div>
      <form className="admin-search-bar" onSubmit={submitSearch}>
        <input type="text" placeholder="Search username, name, email…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button className="btn btn-secondary btn-sm" type="submit">
          Search
        </button>
      </form>

      {loading ? (
        <div className="spinner-wrap">Loading…</div>
      ) : (
        <div className="table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Badge</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td data-label="User">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Avatar user={u} size={32} linkToProfile={false} />
                      <div style={{ minWidth: 0 }}>
                        <Link to={`/u/${u.username}`} style={{ fontWeight: 700 }}>
                          @{u.username}
                        </Link>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td data-label="Role">
                    <select value={u.role} onChange={(e) => handleRoleChange(u, e.target.value)} disabled={me.role !== 'admin' || u.id === me.id}>
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td data-label="Badge">
                    <select value={u.badge} onChange={(e) => handleBadgeChange(u, e.target.value)}>
                      {BADGES.map((b) => (
                        <option key={b} value={b} disabled={ADMIN_ONLY_BADGES.includes(b) && me.role !== 'admin'}>
                          {b === 'none' ? 'No badge' : BADGE_META[b]?.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td data-label="Status">
                    <span className={`pill pill-status-${u.status}`}>{u.status}</span>
                  </td>
                  <td data-label="Actions">
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      {canEditDetails(me, u) && (
                        <button className="btn btn-sm btn-secondary" onClick={() => setEditing(u)}>
                          Edit
                        </button>
                      )}
                      {u.status !== 'active' && (
                        <button className="btn btn-sm btn-secondary" onClick={() => handleStatusChange(u, 'active')}>
                          Restore
                        </button>
                      )}
                      {u.status !== 'suspended' && u.id !== me.id && (
                        <button className="btn btn-sm btn-secondary" onClick={() => handleStatusChange(u, 'suspended')}>
                          Suspend
                        </button>
                      )}
                      {u.status !== 'banned' && u.id !== me.id && (
                        <button className="btn btn-sm btn-danger" onClick={() => handleStatusChange(u, 'banned')}>
                          Ban
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <EditUserModal
          user={editing}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            setUsers((us) => us.map((u) => (u.id === updated.id ? updated : u)));
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function EditUserModal({ user, onClose, onSaved }) {
  const [displayName, setDisplayName] = useState(user.displayName);
  const [username, setUsername] = useState(user.username);
  const [bio, setBio] = useState(user.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl);
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const avatarInput = useRef(null);

  const uploadAvatar = async (file) => {
    const fd = new FormData();
    fd.append('image', file);
    try {
      const { user: u } = await api.uploadAdminUserAvatar(user.id, fd);
      setAvatarUrl(u.avatarUrl);
    } catch (err) {
      alert(err.message);
    }
  };

  const genPassword = () => {
    setNewPassword(
      Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 6).toUpperCase()
    );
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const payload = { displayName, username, bio };
      if (newPassword) payload.newPassword = newPassword;
      const { user: updated } = await api.updateAdminUser(user.id, payload);
      onSaved({ ...updated, avatarUrl });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Edit @{user.username}</h2>
        {error && <div className="alert alert-error">{error}</div>}

        <div className="field">
          <label>Avatar</label>
          <div style={{ cursor: 'pointer', width: 64 }} onClick={() => avatarInput.current?.click()}>
            <Avatar user={{ ...user, avatarUrl, displayName }} size={64} linkToProfile={false} />
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
          <label>Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase())}
            pattern="[a-zA-Z0-9_]{3,20}"
          />
        </div>
        <div className="field">
          <label>Bio</label>
          <textarea rows={3} value={bio} onChange={(e) => setBio(e.target.value)} maxLength={160} />
        </div>
        <div className="field">
          <label>Reset password</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              placeholder="Leave blank to keep current password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <button type="button" className="btn btn-secondary btn-sm" onClick={genPassword}>
              Generate
            </button>
          </div>
          {newPassword && (
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, margin: '8px 0 0' }}>
              New password: <b>{newPassword}</b> — share this with the user, it won't be shown again after saving.
            </p>
          )}
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
