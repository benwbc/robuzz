import { Routes, Route, Link } from 'react-router-dom';
import Sidebar, { MobileTabBar } from './components/Sidebar';
import { ProtectedRoute, StaffRoute, GuestRoute } from './components/RouteGuards';
import { useAuth } from './context/AuthContext';

import Login from './pages/Login';
import Signup from './pages/Signup';
import AddAccount from './pages/AddAccount';
import OAuthCallback from './pages/OAuthCallback';
import Home from './pages/Home';
import Explore from './pages/Explore';
import PostDetail from './pages/PostDetail';
import Profile from './pages/Profile';
import Notifications from './pages/Notifications';
import Search from './pages/Search';
import Settings from './pages/Settings';
import Support from './pages/Support';
import NotFound from './pages/NotFound';

import AdminLayout from './pages/admin/AdminLayout';
import Overview from './pages/admin/Overview';
import Reports from './pages/admin/Reports';
import Users from './pages/admin/Users';
import Tickets from './pages/admin/Tickets';
import AuditLog from './pages/admin/AuditLog';
import Ads from './pages/admin/Ads';
import Rules from './pages/Rules';

function RightPanel() {
  return (
    <div className="panel-box">
      <h3>About RoBuzz</h3>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
        A fan-made social platform for the Roblox community — post, follow, and discover, with real moderation tools
        behind the scenes.
      </p>
      <p style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>Not affiliated with Roblox Corporation.</p>
      <p style={{ fontSize: 12 }}>
        <Link to="/rules" style={{ color: 'var(--link)', fontWeight: 600 }}>
          Terms &amp; Community Rules
        </Link>
      </p>
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

      {/* Reachable whether or not you're already signed in — that's the
          whole point: "add another account" only makes sense while at
          least one account is already active, so it can't sit behind
          GuestRoute (which bounces away from /login etc. once signed in)
          or ProtectedRoute (which would bounce away when signed out). */}
      <Route path="/accounts/add" element={<AddAccount />} />

      {/* Standalone for the same reason as /accounts/add above: this is
          where the browser lands mid-sign-in, coming back from Discord, so
          it can't sit behind a guard that only knows about the finished
          state (already signed in, or not). */}
      <Route path="/oauth/discord" element={<OAuthCallback />} />

      {/* Also standalone/reachable either way — a Terms/Rules page has to
          be readable by someone who hasn't signed up yet (linked from the
          signup form) as well as an already-signed-in user (linked from
          Settings), so it can't sit behind GuestRoute or ProtectedRoute
          either. */}
      <Route path="/rules" element={<Rules />} />

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
        <Route
          path="/support"
          element={
            <Shell>
              <Support />
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
            <Route path="tickets" element={<Tickets />} />
            <Route path="ads" element={<Ads />} />
            <Route path="audit-log" element={<AuditLog />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
