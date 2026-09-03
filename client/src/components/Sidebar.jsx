import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Avatar from './Avatar';
import Icon from './Icon';
import { NameWithBadge } from './BadgeIcon';
import { api } from '../api';

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!user) return undefined;
    let stopped = false;
    const load = () =>
      api
        .notifications()
        .then((d) => {
          if (!stopped) setUnread(d.unreadCount);
        })
        .catch(() => {});
    load();
    const id = setInterval(load, 20000);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [user]);

  if (!user) return null;
  const isStaff = user.role === 'moderator' || user.role === 'admin';

  const links = [
    { to: '/', icon: 'home', label: 'Home', end: true },
    { to: '/explore', icon: 'search', label: 'Explore' },
    { to: '/notifications', icon: 'bell', label: 'Notifications', badge: unread },
    { to: '/support', icon: 'help', label: 'Support' },
    { to: `/u/${user.username}`, icon: 'user', label: 'Profile' },
  ];
  if (isStaff) links.push({ to: '/admin', icon: 'shield', label: 'Moderation' });

  return (
    <nav className="sidebar">
      <div className="sidebar-logo">
        <img className="logo-mark" src="/logo.png" alt="" />
        <span>RoBuzz</span>
      </div>
      <div className="sidebar-nav">
        {links.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
            <span className="icon">
              <Icon name={l.icon} />
            </span>
            <span className="label">{l.label}</span>
            {!!l.badge && <span className="sidebar-badge-dot">{l.badge > 9 ? '9+' : l.badge}</span>}
          </NavLink>
        ))}
      </div>
      <button className="btn btn-primary btn-block sidebar-post-btn" onClick={() => navigate('/', { state: { focusComposer: Date.now() } })}>
        <Icon name="plus" size={18} />
        <span className="label">Post</span>
      </button>
      <div style={{ position: 'relative' }}>
        <div className="sidebar-account" onClick={() => setMenuOpen((v) => !v)}>
          <Avatar user={user} size={40} linkToProfile={false} />
          <div className="sidebar-account-text" style={{ flex: 1, minWidth: 0 }}>
            <div className="sidebar-account-name">
              <NameWithBadge user={user} />
            </div>
            <div className="sidebar-account-handle">@{user.username}</div>
          </div>
          <span className="label">
            <Icon name="dots" size={18} />
          </span>
        </div>
        {menuOpen && (
          <div className="post-menu" style={{ bottom: '100%', top: 'auto', left: 0, right: 0, marginBottom: 6 }}>
            <button
              onClick={() => {
                setMenuOpen(false);
                navigate('/settings');
              }}
            >
              <Icon name="gear" size={16} style={{ marginRight: 8, verticalAlign: -3 }} /> Settings
            </button>
            <button
              onClick={() => {
                setMenuOpen(false);
                logout();
                navigate('/login');
              }}
            >
              <Icon name="logout" size={16} style={{ marginRight: 8, verticalAlign: -3 }} /> Log out
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}

export function MobileTabBar() {
  const { user } = useAuth();
  if (!user) return null;
  const isStaff = user.role === 'moderator' || user.role === 'admin';
  return (
    <div className="tabbar-mobile">
      <NavLink to="/" end>
        <Icon name="home" />
      </NavLink>
      <NavLink to="/explore">
        <Icon name="search" />
      </NavLink>
      <NavLink to="/notifications">
        <Icon name="bell" />
      </NavLink>
      <NavLink to="/support">
        <Icon name="help" />
      </NavLink>
      <NavLink to={`/u/${user.username}`}>
        <Icon name="user" />
      </NavLink>
      {isStaff && (
        <NavLink to="/admin">
          <Icon name="shield" />
        </NavLink>
      )}
      <NavLink to="/settings">
        <Icon name="gear" />
      </NavLink>
    </div>
  );
}
