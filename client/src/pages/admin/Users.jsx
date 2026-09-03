import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Avatar from '../../components/Avatar';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../api';
import { BADGES, ROLES, STATUSES, ADMIN_ONLY_BADGES, BADGE_META } from '../../constants';

export default function Users() {
  const { user: me } = useAuth();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

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
                  <td>
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
                  <td>
                    <select value={u.role} onChange={(e) => handleRoleChange(u, e.target.value)} disabled={me.role !== 'admin' || u.id === me.id}>
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select value={u.badge} onChange={(e) => handleBadgeChange(u, e.target.value)}>
                      {BADGES.map((b) => (
                        <option key={b} value={b} disabled={ADMIN_ONLY_BADGES.includes(b) && me.role !== 'admin'}>
                          {b === 'none' ? 'No badge' : BADGE_META[b]?.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <span className={`pill pill-status-${u.status}`}>{u.status}</span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
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
    </div>
  );
}
