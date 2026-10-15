import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import AppShell from './components/AppShell.jsx';
import { PageLoader } from './components/ui.jsx';
import { useAuth } from './context/AuthContext.jsx';
import AuthPage from './pages/AuthPage.jsx';
import Discover from './pages/Discover.jsx';
import GroupPreview from './pages/GroupPreview.jsx';
import Home from './pages/Home.jsx';
import NotFound from './pages/NotFound.jsx';

// Heavier screens load on demand so the first screen stays fast (NFR-PERF-03)
const GroupRoom = lazy(() => import('./pages/GroupRoom.jsx'));
const ManageGroup = lazy(() => import('./pages/ManageGroup.jsx'));
const Profile = lazy(() => import('./pages/Profile.jsx'));

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  return children;
}

// Only same-site paths: no protocol-relative "//x" or "/\\x" tricks
const safeNext = (next) => (next && /^\/(?![/\\])[^\s\\]*$/.test(next) ? next : '/');

function GuestOnly({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <PageLoader />;
  if (user) {
    const next = new URLSearchParams(location.search).get('next');
    return <Navigate to={safeNext(next)} replace />;
  }
  return children;
}

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/login" element={<GuestOnly><AuthPage mode="login" /></GuestOnly>} />
        <Route path="/signup" element={<GuestOnly><AuthPage mode="signup" /></GuestOnly>} />
        <Route element={<AppShell />}>
          <Route index element={<RequireAuth><Home /></RequireAuth>} />
          <Route path="discover" element={<Discover />} />
          <Route path="g/:id/preview" element={<GroupPreview />} />
          <Route path="join/:code" element={<GroupPreview byInvite />} />
          <Route path="g/:id" element={<RequireAuth><GroupRoom /></RequireAuth>} />
          <Route path="g/:id/manage" element={<RequireAuth><ManageGroup /></RequireAuth>} />
          <Route path="profile" element={<RequireAuth><Profile /></RequireAuth>} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
