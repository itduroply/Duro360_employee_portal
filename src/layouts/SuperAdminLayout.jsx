import { useEffect, useState } from 'react';
import axiosClient from '../api/axiosClient';
import ConsoleLayout from './ConsoleLayout.jsx';
import { getSidebarForRole } from '../components/Sidebar/sidebarConfig.js';

/**
 * Super Admin Console -- always gets the full sidebar (every Admin Console
 * feature, plus its own "Admins & Dealers" item), since it's the role that
 * decides what everyone else gets. See components/Sidebar/sidebarConfig.js.
 */
export default function SuperAdminLayout() {
  const [simulatorEnabled, setSimulatorEnabled] = useState(true);

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

  const navItems = getSidebarForRole('SUPERADMIN', { simulatorEnabled });

  return (
    <ConsoleLayout
      consoleLabel="SUPER ADMIN CONSOLE"
      basePath="/superadmin"
      navItems={navItems}
      outletContext={{ simulatorEnabled }}
    />
  );
}
