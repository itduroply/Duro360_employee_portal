import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import axiosClient from '../api/axiosClient';
import ConsoleLayout from './ConsoleLayout.jsx';
import { getSidebarForRole } from '../components/Sidebar/sidebarConfig.js';

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

  const navItems = getSidebarForRole('ADMIN', { permissions: user?.permissions, simulatorEnabled });

  return (
    <ConsoleLayout
      consoleLabel="ADMIN CONSOLE"
      basePath="/admin"
      navItems={navItems}
      outletContext={{ simulatorEnabled }}
    />
  );
}
