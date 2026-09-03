import { NavLink, Outlet } from 'react-router-dom';

export default function AdminLayout() {
  return (
    <div className="admin-wrap">
      <div className="main-header">
        <h1>Moderation</h1>
      </div>
      <div className="admin-tabs">
        <NavLink to="/admin" end className={({ isActive }) => `admin-tab${isActive ? ' active' : ''}`}>
          Overview
        </NavLink>
        <NavLink to="/admin/reports" className={({ isActive }) => `admin-tab${isActive ? ' active' : ''}`}>
          Reports
        </NavLink>
        <NavLink to="/admin/users" className={({ isActive }) => `admin-tab${isActive ? ' active' : ''}`}>
          Users
        </NavLink>
        <NavLink to="/admin/tickets" className={({ isActive }) => `admin-tab${isActive ? ' active' : ''}`}>
          Support
        </NavLink>
        <NavLink to="/admin/audit-log" className={({ isActive }) => `admin-tab${isActive ? ' active' : ''}`}>
          Audit Log
        </NavLink>
      </div>
      <Outlet />
    </div>
  );
}
