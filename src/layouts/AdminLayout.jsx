import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import axiosClient from '../api/axiosClient';
import ConsoleLayout from './ConsoleLayout.jsx';
import { complaintRights, getSidebarForRole, withComplaintPages } from '../components/Sidebar/sidebarConfig.js';
import useComplaintAccess from '../pages/Complaints/useComplaintAccess.js';

/**
 * Admin Console -- role-gated on the frontend (UX only) AND, for every API
 * call it makes, independently enforced by the backend. A Dealer/Vendor
 * navigating here directly is bounced straight back to /dashboard, never
 * shown so much as a flash of this layout (see routes/ProtectedRoute.jsx).
 *
 * Which sidebar items actually show up is decided by getSidebarForRole
 * (components/Sidebar/sidebarConfig.js), cut down to whatever the signed-in
 * Admin's `permissions` a Super Admin granted it (see
 * pages/SuperAdmin/UsersManagement) -- unlike SuperAdminLayout, which always
 * gets the full sidebar.
 */
export default function AdminLayout() {
  const { user } = useAuth();
  const [simulatorEnabled, setSimulatorEnabled] = useState(true);
  // A manager or accounts member with complaints to approve sees Complaints
  // even without the permission; the submenu then only holds My Approvals.
  const { access: complaintAccess, refresh: refreshComplaintAccess } = useComplaintAccess();
  const complaintApprover = Boolean(complaintAccess?.isAccounts || complaintAccess?.isCoordinator || complaintAccess?.pending > 0 || complaintAccess?.hasHistory);

  useEffect(() => {
    let cancelled = false;
    axiosClient
      .get('/admin/simulator/config', { useRealToken: true })
      .then(({ data }) => {
        if (!cancelled) setSimulatorEnabled(Boolean(data.enabled));
      })
      .catch(() => {
        // If the config check itself fails, default to hiding the menu
        // item rather than assuming it's available.
        if (!cancelled) setSimulatorEnabled(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const permissions = complaintApprover && !(user?.permissions ?? []).includes('complaints')
    ? [...(user?.permissions ?? []), 'complaints']
    : user?.permissions;
  const rights = complaintRights({
    access: complaintAccess,
    fallbackCanFile: (user?.permissions ?? []).includes('complaints'),
  });
  const navItems = withComplaintPages(getSidebarForRole('ADMIN', { permissions, simulatorEnabled }), rights);

  return (
    <ConsoleLayout
      consoleLabel="ADMIN CONSOLE"
      basePath="/admin"
      navItems={navItems}
      outletContext={{ simulatorEnabled, complaintAccess, complaintRights: rights, refreshComplaintAccess }}
    />
  );
}
