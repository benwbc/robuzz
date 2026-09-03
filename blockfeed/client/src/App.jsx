import { Routes, Route } from 'react-router-dom';
import Sidebar, { MobileTabBar } from './components/Sidebar';
import { ProtectedRoute, StaffRoute, GuestRoute } from './components/RouteGuards';
import { useAuth } from './context/AuthContext';

import Login from './pages/Login';
import Signup from './pages/Signup';
import Home from './pages/Home';
import Explore from './pages/Explore';
import PostDetail from './pages/PostDetail';
import Profile from './pages/Profile';
import Notifications from './pages/Notifications';
import Search from './pages/Search';
import Settings from './pages/Settings';
import NotFound from './pages/NotFound';

import AdminLayout from './pages/admin/AdminLayout';
import Overview from './pages/admin/Overview';
import Reports from './pages/admin/Reports';
import Users from './pages/admin/Users';
import AuditLog from './pages/admin/AuditLog';

function RightPanel() {
  return (
    <div className="panel-box">
      <h3>About BlockFeed</h3>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
        A fan-made social platform for the Roblox community — post, follow, and discover, with real moderation tools
        behind the scenes.
      </p>
      <p style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>Not affiliated with Roblox Corporation.</p>
    </div>
  );
}

function Shell({ children }) {
  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-content">{children}</main>
      <div className="right-panel">
        <RightPanel />
      </div>
      <MobileTabBar />
    </div>
  );
}

export default function App() {
  const { loading } = useAuth();
  if (loading) return <div className="spinner-wrap">Loading…</div>;

  return (
    <Routes>
      <Route element={<GuestRoute />}>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route
          path="/"
          element={
            <Shell>
              <Home />
            </Shell>
          }
        />
        <Route
          path="/explore"
          element={
            <Shell>
              <Explore />
            </Shell>
          }
        />
        <Route
          path="/notifications"
          element={
            <Shell>
              <Notifications />
            </Shell>
          }
        />
        <Route
          path="/search"
          element={
            <Shell>
              <Search />
            </Shell>
          }
        />
        <Route
          path="/post/:id"
          element={
            <Shell>
              <PostDetail />
            </Shell>
          }
        />
        <Route
          path="/u/:username"
          element={
            <Shell>
              <Profile />
            </Shell>
          }
        />
        <Route
          path="/settings"
          element={
            <Shell>
              <Settings />
            </Shell>
          }
        />

        <Route element={<StaffRoute />}>
          <Route
            path="/admin"
            element={
              <Shell>
                <AdminLayout />
              </Shell>
            }
          >
            <Route index element={<Overview />} />
            <Route path="reports" element={<Reports />} />
            <Route path="users" element={<Users />} />
            <Route path="audit-log" element={<AuditLog />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
