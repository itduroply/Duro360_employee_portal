import SuperAdminOverview from '../SuperAdmin/SuperAdminOverview.jsx';

/**
 * Admin Console landing page. It is the same dashboard the Super Admin sees,
 * so every login gets one home page whatever features it was given.
 */
export default function AdminOverview() {
  return <SuperAdminOverview basePath="/admin" />;
}
