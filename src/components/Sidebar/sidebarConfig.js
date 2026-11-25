
export const SIDEBAR_FEATURES = [
  { key: 'dashboard', label: 'Dashboard', path: '', end: true, implemented: true, alwaysVisible: true },
  { key: 'dealers', label: 'Dealers', path: 'dealers', implemented: true },
  // { key: 'orders', label: 'Orders', path: 'orders', implemented: true },
  // { key: 'invoices', label: 'Invoices', path: 'invoices', implemented: true },
  // { key: 'payments', label: 'Payments', path: 'payments', implemented: true },
  // { key: 'outstanding', label: 'Outstanding', path: 'outstanding', implemented: true },
  { key: 'schemes', label: 'Schemes', path: 'schemes', implemented: true },
  { key: 'dealerUnlocking', label: 'Dealer Unlocking', path: 'dealer-unlocking', implemented: true },
  { key: 'warranty', label: 'Duro Certificates', path: 'warranty', implemented: true },
  // { key: 'documents', label: 'Dealer Documents', path: 'documents', implemented: true },
  { key: 'queries', label: 'Dealer Queries', path: 'queries', implemented: true },
  { key: 'complaints', label: 'Complaints', path: 'complaints', implemented: true },
  { key: 'notifications', label: 'Notifications', path: 'notifications', implemented: true },
  { key: 'reports', label: 'Reports', path: 'reports', implemented: true },
  { key: 'auditLogs', label: 'Audit Logs', path: 'audit-logs', implemented: true },
  { key: 'simulator', label: 'Simulator', path: 'simulator', implemented: true, badge: 'Dev/Test' },
  { key: 'settings', label: 'Settings', path: 'coming-soon', state: { moduleName: 'Settings' } },
];


export const DEALER_FEATURES = [
  { key: 'dashboard', label: 'Dashboard', path: '', end: true, implemented: true },
  { key: 'profile', label: 'My Profile', path: 'profile', implemented: true },
  { key: 'invoices', label: 'Invoices', path: 'invoices', implemented: true },
  { key: 'payments', label: 'Payments', path: 'payments', implemented: true },
  { key: 'outstanding', label: 'Outstanding', path: 'outstanding', implemented: true },
  { key: 'transactions', label: 'Transactions', path: 'transactions', implemented: true },
  { key: 'schemes', label: 'Schemes', path: 'schemes', implemented: true },
  { key: 'warranty', label: 'Duro Certificates', path: 'warranty', implemented: true },
  // { key: 'documents', label: 'Documents', path: 'documents', implemented: true },
  { key: 'queries', label: 'Queries', path: 'queries', implemented: true },
  { key: 'notifications', label: 'Notifications', path: 'notifications', implemented: true },
  { key: 'reports', label: 'Reports', path: 'reports', implemented: true },
];

const SUPERADMIN_ONLY_ITEM = {
  key: 'users',
  label: 'Users',
  path: 'users',
  implemented: true,
  alwaysVisible: true,
};

export const ASSIGNABLE_ADMIN_PERMISSIONS = SIDEBAR_FEATURES.filter((item) => !item.alwaysVisible).map(
  ({ key, label }) => ({ key, label })
);
 
export function getSidebarForRole(role, { permissions = [], simulatorEnabled = true } = {}) {
  if (role === 'DEALER') return DEALER_FEATURES;

  // Super Admin gets "Users" straight after Dashboard.
  const items =
    role === 'SUPERADMIN'
      ? [SIDEBAR_FEATURES[0], SUPERADMIN_ONLY_ITEM, ...SIDEBAR_FEATURES.slice(1)]
      : SIDEBAR_FEATURES.filter((item) => item.alwaysVisible || permissions.includes(item.key));

  return items.filter((item) => item.key !== 'simulator' || simulatorEnabled);
}

// The Complaints submenu. `need` says who sees each page: `file` for people
// who may file complaints, `approve` for approvers, `superadmin` for the
// Super Admin only. withComplaintPages() picks the pages for one person.
export const COMPLAINT_PAGES = [
  { key: 'complaintsNew', iconKey: 'complaints', label: 'Register Complaint', path: 'complaints/new', implemented: true, need: 'file' },
  { key: 'complaintsHistory', iconKey: 'complaints', label: 'Complaint History', path: 'complaints/history', implemented: true, need: 'file' },
  { key: 'complaintsApprovals', iconKey: 'complaints', label: 'My Approvals', path: 'complaints/approvals', implemented: true, need: 'approve' },
  { key: 'complaintsSettings', iconKey: 'complaints', label: 'Approval Settings', path: 'complaints/settings', implemented: true, need: 'superadmin' },
  { key: 'complaintsAccess', iconKey: 'complaints', label: 'Assign Users', path: 'complaints/access', implemented: true, need: 'superadmin' },
];

// What one person may do in Complaints, from my_complaint_access(). While
// that is still loading, `fallbackCanFile` (the complaints permission) is used.
export function complaintRights({ isSuperAdmin = false, access = null, fallbackCanFile = false } = {}) {
  const canFile = isSuperAdmin || (access ? Boolean(access.canFile) : fallbackCanFile);
  const canApprove = isSuperAdmin || Boolean(access && (access.isAccounts || access.pending > 0 || access.hasHistory));
  return { canFile, canApprove, isSuperAdmin, pending: access?.pending ?? 0 };
}

// Gives the Complaints item its submenu. My Approvals carries the count of
// complaints waiting on this person.
export function withComplaintPages(navItems, rights) {
  const children = COMPLAINT_PAGES.filter((page) =>
    page.need === 'file' ? rights.canFile : page.need === 'approve' ? rights.canApprove : rights.isSuperAdmin
  ).map((page) => (page.key === 'complaintsApprovals' && rights.pending > 0 ? { ...page, count: rights.pending } : page));
  return navItems.map((item) => (item.key === 'complaints' ? { ...item, children } : item));
}
