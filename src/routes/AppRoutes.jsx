import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute.jsx';
import PageLoader from '../components/common/PageLoader.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { roleHome } from './roleHome.js';

const EmployeeLogin = lazy(() => import('../pages/Login/EmployeeLogin.jsx'));
const EmailLinkLanding = lazy(() => import('../pages/EmailLinks/EmailLinkLanding.jsx'));
const Dashboard = lazy(() => import('../pages/Dashboard/Dashboard.jsx'));

const AdminLayout = lazy(() => import('../layouts/AdminLayout.jsx'));
const AdminOverview = lazy(() => import('../pages/Admin/AdminOverview.jsx'));
const SimulatorDashboard = lazy(() => import('../pages/Admin/Simulator/SimulatorDashboard.jsx'));
const ComingSoon = lazy(() => import('../pages/Admin/ComingSoon.jsx'));

const SuperAdminLayout = lazy(() => import('../layouts/SuperAdminLayout.jsx'));
const SuperAdminOverview = lazy(() => import('../pages/SuperAdmin/SuperAdminOverview.jsx'));
const UsersPage = lazy(() => import('../pages/SuperAdmin/UsersManagement/UsersPage.jsx'));

const DealersDirectory = lazy(() => import('../pages/Dealers/DealersDirectory.jsx'));
const OrdersPage = lazy(() => import('../pages/Orders/OrdersPage.jsx'));
const InvoicesPage = lazy(() => import('../pages/Invoices/InvoicesPage.jsx'));
const PaymentsPage = lazy(() => import('../pages/Payments/PaymentsPage.jsx'));
const OutstandingPage = lazy(() => import('../pages/Outstanding/OutstandingPage.jsx'));
const SchemesPage = lazy(() => import('../pages/Schemes/SchemesPage.jsx'));
const CreditApprovalPage = lazy(() => import('../modules/creditApproval/CreditApprovalPage.jsx'));
const WarrantyPage = lazy(() => import('../pages/Warranty/WarrantyPage.jsx'));
const CertificatePrintPage = lazy(() => import('../pages/Warranty/CertificatePrintPage.jsx'));
// const DocumentsPage = lazy(() => import('../pages/Documents/DocumentsPage.jsx'));
const QueriesPage = lazy(() => import('../pages/Queries/QueriesPage.jsx'));
const ComplaintsPage = lazy(() => import('../pages/Complaints/ComplaintsPage.jsx'));
const NotificationsPage = lazy(() => import('../pages/Notifications/NotificationsPage.jsx'));
const ReportsPage = lazy(() => import('../pages/Reports/ReportsPage.jsx'));
const AuditLogsPage = lazy(() => import('../pages/AuditLogs/AuditLogsPage.jsx'));


// Module pages shared by both consoles; paths match `path` in
// components/Sidebar/sidebarConfig.js SIDEBAR_FEATURES.
function moduleRoutes() {
  return [
    <Route key="dealers" path="dealers" element={<DealersDirectory />} />,
    <Route key="orders" path="orders" element={<OrdersPage />} />,
    <Route key="invoices" path="invoices" element={<InvoicesPage />} />,
    <Route key="payments" path="payments" element={<PaymentsPage />} />,
    <Route key="outstanding" path="outstanding" element={<OutstandingPage />} />,
    <Route key="schemes" path="schemes" element={<SchemesPage />} />,
    <Route key="dealer-unlocking" path="dealer-unlocking" element={<CreditApprovalPage />} />,
    <Route key="warranty" path="warranty" element={<WarrantyPage />} />,
    // <Route key="documents" path="documents" element={<DocumentsPage />} />,
    <Route key="queries" path="queries" element={<QueriesPage />} />,
    <Route key="complaints" path="complaints" element={<ComplaintsPage />} />,
    <Route key="notifications" path="notifications" element={<NotificationsPage />} />,
    <Route key="reports" path="reports" element={<ReportsPage />} />,
    <Route key="audit-logs" path="audit-logs" element={<AuditLogsPage />} />,
    <Route key="simulator" path="simulator" element={<SimulatorDashboard />} />,
    <Route key="coming-soon" path="coming-soon" element={<ComingSoon />} />,
  ];
}


// session is confirmed to exist (the ProtectedRoute wrapping it already sent
// anyone unauthenticated to /login before this ever renders).
function RoleHomeRedirect() {
  const { user } = useAuth();
  return <Navigate to={roleHome(user?.roles)} replace />;
}

// The address "/" is also where the links in credit approval emails land
// (/?approval_token=... and /?query_token=...). Those open without a sign-in,
// so they are checked before the normal "go to your home page" redirect.
function RootEntry() {
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const kind = params.get('approval_token') ? 'approval' : params.get('query_token') ? 'reply' : null;
  if (kind) {
    const link = kind === 'approval'
      ? { kind, token: params.get('approval_token'), action: params.get('action') }
      : { kind, token: params.get('query_token') };
    return <EmailLinkLanding link={link} />;
  }
  return (
    <ProtectedRoute>
      <RoleHomeRedirect />
    </ProtectedRoute>
  );
}

// Employee app routes. Dealers use the separate dealer-frontend app; both
// apps share the same Supabase backend.
export default function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/login" element={<EmployeeLogin />} />

       
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute allowedRoles={['VENDOR']}>
              <Dashboard />
            </ProtectedRoute>
          }
        />


      
        {/* Printable certificate, outside the portal frame. Row Level Security
            decides which certificates each role can open. Dealers print from the
            dealer-frontend app. */}
        <Route
          path="/print/warranty/:id"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'SUPERADMIN']}>
              <CertificatePrintPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<AdminOverview />} />
          {moduleRoutes()}
        </Route>

        <Route
          path="/superadmin"
          element={
            <ProtectedRoute allowedRoles={['SUPERADMIN']}>
              <SuperAdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<SuperAdminOverview />} />
          <Route path="users" element={<UsersPage />} />
          {moduleRoutes()}
        </Route>

      
        <Route path="/" element={<RootEntry />} />
        <Route
          path="*"
          element={
            <ProtectedRoute>
              <RoleHomeRedirect />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Suspense>
  );
}
