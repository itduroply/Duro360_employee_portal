import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useSimulator } from '../context/SimulatorContext.jsx';
import PageLoader from '../components/common/PageLoader.jsx';
import { roleHome } from './roleHome.js';

/**
 * Frontend route guarding is a UX convenience only — it stops an
 * unauthenticated user from seeing a flash of a page they can't use. It is
 * NOT the security boundary; every API call this page makes is independently
 * checked by the backend's `authenticate`/`authorize` middleware regardless
 * of what this component does. See docs/ARCHITECTURE.md Section 6.
 */
export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, isLoading } = useAuth();
  const { isSimulating } = useSimulator();
  const location = useLocation();

  if (isLoading) {
    return <PageLoader />;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // While an Admin/Super Admin is running the Simulator, /dashboard is
  // deliberately reached with the REAL user's own role (Admin/Super Admin),
  // not the simulated Dealer/Vendor's — SimulatorContext swaps only the
  // token axiosClient sends, never this session (see
  // context/SimulatorContext.jsx). Skip the role check in that case instead
  // of bouncing them straight back out of the session they just launched.
  if (allowedRoles && !isSimulating && !allowedRoles.some((role) => user.roles.includes(role))) {
    // Already authenticated, just the wrong role for this route (e.g. a
    // Super Admin/Admin hitting /dashboard, or a Dealer/Vendor hitting
    // /admin) — send them to their own home rather than back to /login,
    // which would be a confusing dead end for someone who is, in fact,
    // correctly logged in.
    return <Navigate to={roleHome(user.roles)} replace />;
  }

  return children;
}
