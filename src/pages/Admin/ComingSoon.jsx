import { useLocation, Link } from 'react-router-dom';

/**
 * Shared placeholder for every Admin Console sidebar item that isn't built
 * yet (Users, Dealers, Vendors, Orders, Invoices, ... — see
 * layouts/AdminLayout.jsx). Keeps the full intended sidebar visible and
 * navigable today without pretending any of these modules already work.
 */
export default function ComingSoon() {
  const location = useLocation();
  const moduleName = location.state?.moduleName || 'This module';
  // Shared between /admin/coming-soon and /superadmin/coming-soon (see
  // routes/AppRoutes.jsx), so the back-link has to follow whichever console
  // is actually hosting it rather than always pointing at /admin.
  const consoleHome = location.pathname.startsWith('/superadmin') ? '/superadmin' : '/admin';
  const consoleLabel = consoleHome === '/superadmin' ? 'Super Admin Console' : 'Admin Console';

  return (
    <div className="flex min-h-[60vh] items-center justify-center rounded-2xl border border-gray-200 bg-white px-5 py-10 text-center">
      <div className="max-w-md">
        <h1 className="mb-2 text-xl font-semibold text-gray-800">{moduleName}</h1>
        <p className="mb-6 text-theme-sm text-gray-500">
          {moduleName} is part of the Admin Console roadmap but hasn&apos;t been built yet.
        </p>
        <Link
          to={consoleHome}
          className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-5 py-3 text-sm font-medium text-gray-700 shadow-theme-xs hover:bg-gray-50 hover:text-gray-800"
        >
          ← Back to {consoleLabel}
        </Link>
      </div>
    </div>
  );
}
