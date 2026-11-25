import { useEffect, useState } from 'react';
import axiosClient from '../api/axiosClient';
import ConsoleLayout from './ConsoleLayout.jsx';
import { complaintRights, getSidebarForRole, withComplaintPages } from '../components/Sidebar/sidebarConfig.js';
import useComplaintAccess from '../pages/Complaints/useComplaintAccess.js';

/**
 * Super Admin Console -- always gets the full sidebar (every Admin Console
 * feature, plus its own "Admins & Dealers" item), since it's the role that
 * decides what everyone else gets. See components/Sidebar/sidebarConfig.js.
 */
export default function SuperAdminLayout() {
  const [simulatorEnabled, setSimulatorEnabled] = useState(true);
  const { access: complaintAccess, refresh: refreshComplaintAccess } = useComplaintAccess();

  useEffect(() => {
    let cancelled = false;
    axiosClient
      .get('/admin/simulator/config', { useRealToken: true })
      .then(({ data }) => {
        if (!cancelled) setSimulatorEnabled(Boolean(data.enabled));
      })
      .catch(() => {
        if (!cancelled) setSimulatorEnabled(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const rights = complaintRights({ isSuperAdmin: true, access: complaintAccess });
  const navItems = withComplaintPages(getSidebarForRole('SUPERADMIN', { simulatorEnabled }), rights);

  return (
    <ConsoleLayout
      consoleLabel="SUPER ADMIN CONSOLE"
      basePath="/superadmin"
      navItems={navItems}
      outletContext={{ simulatorEnabled, complaintAccess, complaintRights: rights, refreshComplaintAccess }}
    />
  );
}
