import ModulePage, { KpiStrip, StatusChip } from '../../components/ModulePage/ModulePage.jsx';
import DataTable from '../../components/ModulePage/DataTable.jsx';
import { SHOW_SAMPLE_DATA, SAMPLE_AUDIT_LOGS, TODAY } from '../../data/sample/index.js';
import { formatCount, formatDateTime, inPeriod } from '../../utils/format.js';

const ROLES = ['Super Admin', 'Admin', 'Dealer'];
const PERIODS = ['Today', 'Last 7 Days', 'Last 30 Days'];
const logs = SHOW_SAMPLE_DATA ? SAMPLE_AUDIT_LOGS : [];
const has = logs.length > 0;

const COLUMNS = [
  { key: 'at', label: 'Date & Time', render: (r) => formatDateTime(r.at) },
  { key: 'user', label: 'User' },
  { key: 'role', label: 'Role' },
  {
    key: 'action',
    label: 'Action',
    render: (r) => (r.kind === 'Logins' ? <StatusChip status={r.action} /> : <span className="text-gray-700">{r.action}</span>),
  },
  { key: 'details', label: 'Details' },
  { key: 'ip', label: 'IP Address' },
];

// Trail of logins and administrative actions. See components/ModulePage/.
export default function AuditLogsPage() {
  const today = logs.filter((l) => inPeriod(l.at, 'Today', TODAY));
  const count = (list) => (has ? formatCount(list.length) : undefined);
  return (
    <ModulePage
      title="Audit Logs"
      description="Record of logins and administrative actions."
      actions={[{ label: 'Export' }]}
    >
      <KpiStrip
        items={[
          { label: 'Logins Today', value: count(today.filter((l) => l.action === 'Login')), icon: 'users', tone: 'brand' },
          { label: 'Failed Logins Today', value: count(today.filter((l) => l.action === 'Failed login')), icon: 'queries', tone: 'error' },
          { label: 'Admin Actions Today', value: count(today.filter((l) => l.kind === 'Admin Actions')), icon: 'settings', tone: 'warning' },
          { label: 'Active Users This Week', value: count([...new Set(logs.filter((l) => inPeriod(l.at, 'Last 7 Days', TODAY)).map((l) => l.user))]), icon: 'dealers', tone: 'success' },
        ]}
      />
      <DataTable
        rows={logs}
        tabs={['All', 'Logins', 'Admin Actions']}
        tabField="kind"
        searchPlaceholder="Search user or action"
        searchFields={['user', 'action', 'details']}
        filters={[
          { id: 'role', label: 'All Roles', options: ROLES },
          { id: 'period', label: 'All Periods', options: PERIODS, match: (r, v) => inPeriod(r.at, v, TODAY) },
        ]}
        columns={COLUMNS}
        pageSize={10}
        empty={{ icon: 'auditLogs', title: 'No log entries yet', hint: 'Logins and admin actions will be recorded here.' }}
      />
    </ModulePage>
  );
}
