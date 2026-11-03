import ModulePage, { KpiStrip, StatusChip } from '../../components/ModulePage/ModulePage.jsx';
import Panel from '../../components/ModulePage/Panel.jsx';
import DataTable from '../../components/ModulePage/DataTable.jsx';
import { SHOW_SAMPLE_DATA, SAMPLE_PAYMENTS, PAYMENT_MODES, TODAY } from '../../data/sample/index.js';
import { PERIODS, formatCount, formatDate, formatLacs, formatLacsWhole, inPeriod } from '../../utils/format.js';

const payments = SHOW_SAMPLE_DATA ? SAMPLE_PAYMENTS : [];
const has = payments.length > 0;
const received = payments.filter((p) => p.status !== 'Returned');
const total = (rows) => rows.reduce((s, p) => s + p.amount, 0);

// Amount received this month per payment mode.
function ModeBreakdown() {
  const thisMonth = received.filter((p) => inPeriod(p.date, 'This Month', TODAY));
  const byMode = PAYMENT_MODES.map((mode) => ({ mode, value: total(thisMonth.filter((p) => p.mode === mode)) }));
  const max = Math.max(1, ...byMode.map((m) => m.value));
  return (
    <Panel title="By Payment Mode" subtitle="This month, Rs Lacs">
      <ul className="flex flex-col gap-4">
        {byMode.map(({ mode, value }) => (
          <li key={mode}>
            <div className="mb-1.5 flex items-center justify-between text-theme-sm">
              <span className="text-gray-600">{mode}</span>
              <span className="font-medium tabular-nums text-gray-800">{has ? formatLacs(value) : '—'}</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-gray-100">
              <div className="h-full rounded-full bg-brand-500" style={{ width: `${(value / max) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

const COLUMNS = [
  { key: 'id', label: 'Payment Ref.' },
  { key: 'date', label: 'Date', render: (r) => formatDate(r.date) },
  { key: 'dealerName', label: 'Dealer' },
  { key: 'mode', label: 'Mode' },
  { key: 'amount', label: 'Amount', align: 'right', render: (r) => formatLacs(r.amount) },
  { key: 'invoiceId', label: 'Against Invoice' },
  { key: 'status', label: 'Status', render: (r) => <StatusChip status={r.status} /> },
];

// Payments received from all dealers. See components/ModulePage/ for the building blocks.
export default function PaymentsPage() {
  const whole = (rows) => (has ? formatLacsWhole(total(rows)) : undefined);
  return (
    <ModulePage
      title="Payments"
      description="Payments received from all dealers. All amounts in Rs Lacs."
      actions={[{ label: 'Export' }]}
    >
      <KpiStrip
        items={[
          { label: 'Received This Month', unit: 'Rs Lacs', value: whole(received.filter((p) => inPeriod(p.date, 'This Month', TODAY))), icon: 'payments', tone: 'success' },
          { label: 'Received This Year', unit: 'Rs Lacs', value: whole(received), icon: 'reports', tone: 'brand' },
          { label: 'Pending Confirmation', value: has ? formatCount(payments.filter((p) => p.status === 'Pending').length) : undefined, icon: 'outstanding', tone: 'warning' },
          { label: 'Returned', value: has ? formatCount(payments.filter((p) => p.status === 'Returned').length) : undefined, icon: 'queries', tone: 'error' },
        ]}
      />
      <div className="grid grid-cols-1 gap-4 md:gap-5 xl:grid-cols-3">
        <ModeBreakdown />
        <DataTable
          className="xl:col-span-2"
          rows={payments}
          tabs={['All', 'Confirmed', 'Pending', 'Returned']}
          searchPlaceholder="Search reference or dealer"
          searchFields={['id', 'dealerName', 'invoiceId']}
          filters={[
            { id: 'mode', label: 'All Modes', options: PAYMENT_MODES },
            { id: 'period', label: 'All Periods', options: PERIODS, match: (r, v) => inPeriod(r.date, v, TODAY) },
          ]}
          columns={COLUMNS}
          empty={{ icon: 'payments', title: 'No payments yet', hint: 'Payments received from dealers will be listed here.' }}
        />
      </div>
    </ModulePage>
  );
}
