import ModulePage, { KpiStrip, StatusChip } from '../../components/ModulePage/ModulePage.jsx';
import Panel from '../../components/ModulePage/Panel.jsx';
import DataTable from '../../components/ModulePage/DataTable.jsx';
import EmptyState from '../../components/ModulePage/EmptyState.jsx';
import StackedBar from '../../components/Charts/StackedBar.jsx';
import { SHOW_SAMPLE_DATA, SAMPLE_INVOICES, TODAY } from '../../data/sample/index.js';
import { PERIODS, addDays, formatCount, formatDate, formatLacs, formatLacsWhole, inPeriod } from '../../utils/format.js';

const invoices = SHOW_SAMPLE_DATA ? SAMPLE_INVOICES : [];
const has = invoices.length > 0;
const sum = (rows, key) => rows.reduce((s, r) => s + r[key], 0);

// Status colours are the reserved status set, each shown with its label.
const STATUS_PARTS = [
  { label: 'Paid', color: '#12b76a', value: (rows) => sum(rows, 'paid') },
  { label: 'Unpaid balance', color: '#f04438', value: (rows) => sum(rows, 'balance') },
];

// Invoice value collected vs still unpaid.
function CollectionStatus() {
  return (
    <Panel title="Collection Status" subtitle="Invoice value, Rs Lacs">
      {has ? (
        <StackedBar parts={STATUS_PARTS.map((p) => ({ ...p, value: p.value(invoices) }))} format={formatLacs} />
      ) : (
        <div className="h-2.5 w-full rounded-full bg-gray-100" />
      )}
    </Panel>
  );
}

// Unpaid invoices falling due in the next 7 days.
function DueThisWeek() {
  const weekEnd = addDays(TODAY, 7);
  const due = invoices.filter((inv) => inv.balance > 0 && inv.dueDate >= TODAY && inv.dueDate <= weekEnd);
  return (
    <Panel title="Due This Week" subtitle={has ? `${due.length} invoices` : undefined} flush>
      {due.length === 0 ? (
        <EmptyState compact icon="outstanding" title="Nothing due" hint="Invoices due in the next 7 days show here." />
      ) : (
        <ul className="divide-y divide-gray-100">
          {due.slice(0, 5).map((inv) => (
            <li key={inv.id} className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <p className="truncate text-theme-sm font-medium text-gray-800">{inv.dealerName}</p>
                <p className="text-theme-xs text-gray-500">
                  {inv.id} · due {formatDate(inv.dueDate)}
                </p>
              </div>
              <span className="text-theme-sm font-semibold tabular-nums text-gray-800">{formatLacs(inv.balance)}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

const COLUMNS = [
  { key: 'id', label: 'Invoice No.' },
  { key: 'date', label: 'Date', render: (r) => formatDate(r.date) },
  { key: 'dealerName', label: 'Dealer' },
  { key: 'amount', label: 'Amount', align: 'right', render: (r) => formatLacs(r.amount) },
  { key: 'balance', label: 'Balance', align: 'right', render: (r) => formatLacs(r.balance) },
  { key: 'dueDate', label: 'Due Date', render: (r) => formatDate(r.dueDate) },
  { key: 'status', label: 'Status', render: (r) => <StatusChip status={r.status} /> },
];

// Invoices across all dealers. See components/ModulePage/ for the building blocks.
export default function InvoicesPage() {
  const count = (status) => (has ? formatCount(invoices.filter((i) => i.status === status).length) : undefined);
  return (
    <ModulePage
      title="Invoices"
      description="Invoices raised to all dealers. All amounts in Rs Lacs."
      actions={[{ label: 'Export' }]}
    >
      <KpiStrip
        items={[
          { label: 'Total Invoices', value: has ? formatCount(invoices.length) : undefined, icon: 'invoices', tone: 'brand' },
          { label: 'Invoice Value', unit: 'Rs Lacs', value: has ? formatLacsWhole(sum(invoices, 'amount')) : undefined, icon: 'payments', tone: 'gray' },
          { label: 'Paid', value: count('Paid'), icon: 'auditLogs', tone: 'success' },
          { label: 'Unpaid', value: count('Unpaid'), icon: 'outstanding', tone: 'error' },
        ]}
      />
      <div className="grid grid-cols-1 gap-4 md:gap-5 xl:grid-cols-3">
        <DataTable
          className="xl:col-span-2"
          rows={invoices}
          tabs={['All', 'Paid', 'Partly Paid', 'Unpaid']}
          searchPlaceholder="Search invoice no. or dealer"
          searchFields={['id', 'dealerName', 'orderId']}
          filters={[{ id: 'period', label: 'All Periods', options: PERIODS, match: (r, v) => inPeriod(r.date, v, TODAY) }]}
          columns={COLUMNS}
          empty={{ icon: 'invoices', title: 'No invoices yet', hint: 'Invoices raised to dealers will be listed here.' }}
        />
        <div className="flex flex-col gap-4 md:gap-5">
          <CollectionStatus />
          <DueThisWeek />
        </div>
      </div>
    </ModulePage>
  );
}
