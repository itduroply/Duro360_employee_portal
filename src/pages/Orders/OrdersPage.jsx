import ModulePage, { KpiStrip, StatusChip } from '../../components/ModulePage/ModulePage.jsx';
import Panel from '../../components/ModulePage/Panel.jsx';
import DataTable from '../../components/ModulePage/DataTable.jsx';
import { SHOW_SAMPLE_DATA, SAMPLE_ORDERS, TODAY } from '../../data/sample/index.js';
import { PERIODS, formatCount, formatDate, formatLacs, formatLacsWhole, inPeriod } from '../../utils/format.js';

const PIPELINE = ['Pending', 'Approved', 'Dispatched', 'Delivered'];
const orders = SHOW_SAMPLE_DATA ? SAMPLE_ORDERS : [];
const has = orders.length > 0;
const countOf = (status) => (has ? orders.filter((o) => o.status === status).length : undefined);

// Order flow from placed to delivered, one step per stage.
function OrderPipeline() {
  return (
    <Panel title="Order Pipeline" subtitle="Orders at each stage right now">
      <ol className="grid grid-cols-2 gap-4 md:flex md:items-center md:gap-0">
        {PIPELINE.map((stage, i) => (
          <li key={stage} className={`flex items-center gap-3 ${i < PIPELINE.length - 1 ? 'md:flex-1' : ''}`}>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-brand-500 bg-white text-theme-xs font-semibold text-brand-500">
              {i + 1}
            </span>
            <div className="shrink-0">
              <p className="text-theme-xs font-medium text-gray-500">{stage}</p>
              <p className="text-lg font-semibold leading-6 text-gray-800">{formatCount(countOf(stage))}</p>
            </div>
            {i < PIPELINE.length - 1 && <span className="mx-4 hidden h-px flex-1 bg-gray-200 md:block" aria-hidden="true" />}
          </li>
        ))}
      </ol>
    </Panel>
  );
}

const COLUMNS = [
  { key: 'id', label: 'Order No.' },
  { key: 'date', label: 'Order Date', render: (r) => formatDate(r.date) },
  { key: 'dealerName', label: 'Dealer' },
  { key: 'dealerCode', label: 'Customer Code' },
  { key: 'items', label: 'Items', align: 'right' },
  { key: 'amount', label: 'Amount', align: 'right', render: (r) => formatLacs(r.amount) },
  { key: 'status', label: 'Status', render: (r) => <StatusChip status={r.status} /> },
];

// Orders across all dealers. See components/ModulePage/ for the building blocks.
export default function OrdersPage() {
  const live = orders.filter((o) => o.status !== 'Cancelled');
  return (
    <ModulePage
      title="Orders"
      description="Orders from all dealers, not limited to one account. All amounts in Rs Lacs."
      actions={[{ label: 'Export' }]}
    >
      <KpiStrip
        items={[
          { label: 'Total Orders', value: has ? formatCount(live.length) : undefined, icon: 'orders', tone: 'brand' },
          { label: 'Pending Approval', value: formatCount(countOf('Pending')), icon: 'outstanding', tone: 'warning' },
          { label: 'Dispatched', value: formatCount(countOf('Dispatched')), icon: 'dealers', tone: 'success' },
          {
            label: 'Order Value',
            unit: 'Rs Lacs',
            value: has ? formatLacsWhole(live.reduce((s, o) => s + o.amount, 0)) : undefined,
            icon: 'payments',
            tone: 'gray',
          },
        ]}
      />
      <OrderPipeline />
      <DataTable
        rows={orders}
        tabs={['All', 'Pending', 'Approved', 'Dispatched', 'Delivered', 'Cancelled']}
        searchPlaceholder="Search order no., dealer or code"
        searchFields={['id', 'dealerName', 'dealerCode']}
        filters={[{ id: 'period', label: 'All Periods', options: PERIODS, match: (r, v) => inPeriod(r.date, v, TODAY) }]}
        columns={COLUMNS}
        empty={{ icon: 'orders', title: 'No orders yet', hint: 'Orders placed by dealers will be listed here.' }}
      />
    </ModulePage>
  );
}
