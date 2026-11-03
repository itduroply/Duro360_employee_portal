import { useState } from 'react';
import PageHeader from '../../../components/common/PageHeader.jsx';
import { TabBar } from '../../../components/ModulePage/ModulePage.jsx';
import AdminsPanel from './AdminsPanel.jsx';
import DealerLoginsPanel from './DealerLoginsPanel.jsx';
import EmployeesPanel from './EmployeesPanel.jsx';
import { theme } from '../../../theme/themes.js';
import { NAV_ICONS } from '../../../components/Sidebar/navIcons.jsx';

const TAB_ICONS = { Employees: NAV_ICONS.profile, 'Employee Upload': NAV_ICONS.users, Dealers: NAV_ICONS.dealers };

const TABS = {
  Employees: {
    Panel: () => <AdminsPanel embedded />,
  },
  'Employee Upload': {
    description: 'Upload the Employee Excel sheet. Employees sign in with their Employee ID.',
    Panel: EmployeesPanel,
  },
  Dealers: {
    description: 'See which dealers have a login, and activate or deactivate their access.',
    Panel: DealerLoginsPanel,
  },
};

// Super Admin "Users" sidebar item: login access for Admin and Dealer users.
export default function UsersPage() {
  const [activeTab, setActiveTab] = useState('Employees');
  const { description, Panel } = TABS[activeTab];

  return (
    <div className={theme.ui.pageCard}>
      {/* <PageHeader title="Users" description="Create, activate or deactivate, and manage login access." /> */}
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <TabBar tabs={Object.keys(TABS)} active={activeTab} onChange={setActiveTab} icons={TAB_ICONS} />
        <p className="text-theme-sm text-gray-500">{description}</p>
      </div>
      <Panel />
    </div>
  );
}
