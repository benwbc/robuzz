import { useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Avatar from './Avatar';
import Icon from './Icon';
import { NameWithBadge } from './BadgeIcon';
import { api } from '../api';

export default function Sidebar() {
  const { user, accounts, maxAccounts, logout, forgetAccount, switchAccount } = useAuth();
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const accountMenuRef = useRef(null);

  // Close the account switcher on an outside click or Escape — with a
  // full account list plus add/settings/log-out actions inside it now,
  // leaving it stuck open until the account row is clicked again would be
  // a real annoyance.
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onPointerDown = (e) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(e.target)) setMenuOpen(false);
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

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
      <div style={{ position: 'relative' }} ref={accountMenuRef}>
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
          <div
            className="post-menu account-switcher-menu"
            style={{ bottom: '100%', top: 'auto', left: 0, right: 0, marginBottom: 6 }}
          >
            <div className="account-switcher-list">
              {accounts.map((a) => {
                const isActive = a.id === user.id;
                return (
                  <div key={a.id} className={`account-switcher-row${isActive ? ' active' : ''}`}>
                    <button
                      className="account-switcher-row-main"
                      disabled={isActive}
                      onClick={() => {
                        setMenuOpen(false);
                        switchAccount(a.id);
                      }}
                    >
                      <Avatar user={a.user} size={32} linkToProfile={false} />
                      <div className="account-switcher-row-text">
                        <div className="account-switcher-row-name">{a.user?.displayName || a.user?.username || 'Account'}</div>
                        <div className="account-switcher-row-handle">@{a.user?.username || '…'}</div>
                      </div>
                      {isActive && <Icon name="check" size={16} />}
                    </button>
                    {!isActive && (
                      <button
                        className="account-switcher-row-remove"
                        title={`Log out @${a.user?.username || ''}`}
                        onClick={() => forgetAccount(a.id)}
                      >
                        <Icon name="close" size={13} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {accounts.length < maxAccounts ? (
              <button
                onClick={() => {
                  setMenuOpen(false);
                  navigate('/accounts/add');
                }}
              >
                <Icon name="plus" size={16} style={{ marginRight: 8, verticalAlign: -3 }} /> Add another account
              </button>
            ) : (
              <div className="account-switcher-cap-note">You've reached the {maxAccounts}-account limit</div>
            )}

            <div className="post-menu-divider" />

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
                const stillSignedIn = logout();
                navigate(stillSignedIn ? '/' : '/login');
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
