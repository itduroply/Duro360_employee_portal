import ModulePage, { KpiStrip, StatusChip } from '../../components/ModulePage/ModulePage.jsx';
import Panel from '../../components/ModulePage/Panel.jsx';
import DataTable from '../../components/ModulePage/DataTable.jsx';
import { SHOW_SAMPLE_DATA, SAMPLE_OUTSTANDING, AGEING_BUCKETS } from '../../data/sample/index.js';
import { formatCount, formatLacs, formatLacsWhole } from '../../utils/format.js';

const dealers = SHOW_SAMPLE_DATA ? SAMPLE_OUTSTANDING : [];
const has = dealers.length > 0;

// Debtors ageing buckets; the accent gets stronger as the debt gets older.
const BUCKET_STYLE = { '0–30': 'bg-success-500', '31–60': 'bg-warning-400', '61–90': 'bg-orange-500', '90+': 'bg-error-500' };

function AgeingBuckets() {
  return (
    <Panel title="Debtors Ageing" subtitle="Outstanding by age of invoice, Rs Lacs">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {AGEING_BUCKETS.map((b) => {
          const value = dealers.reduce((s, d) => s + d.buckets[b], 0);
          const count = dealers.filter((d) => d.buckets[b] > 0).length;
          return (
            <div key={b} className="rounded-xl border border-gray-100 bg-gray-50/60 p-4">
              <span className={`mb-3 block h-1 w-10 rounded-full ${BUCKET_STYLE[b]}`} aria-hidden="true" />
              <p className="text-theme-xs font-medium text-gray-500">{b} Days</p>
              <p className="mt-0.5 text-xl font-semibold text-gray-800">{has ? formatLacs(value) : '—'}</p>
              <p className="mt-1 text-theme-xs text-gray-400">{has ? formatCount(count) : '—'} dealers</p>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

const COLUMNS = [
  {
    key: 'name',
    label: 'Dealer',
    render: (r) => (
      <>
        <span className="block">{r.name}</span>
        <span className="text-theme-xs font-normal text-gray-400">{r.code}</span>
      </>
    ),
  },
  { key: 'zone', label: 'Zone' },
  { key: 'creditLimit', label: 'Credit Limit', align: 'right', render: (r) => formatLacs(r.creditLimit) },
  { key: 'outstanding', label: 'Outstanding', align: 'right', render: (r) => formatLacs(r.outstanding) },
  ...AGEING_BUCKETS.map((b) => ({ key: b, label: b, align: 'right', render: (r) => formatLacs(r.buckets[b]) })),
  { key: 'status', label: 'Status', render: (r) => <StatusChip status={r.status} /> },
];

// Dealer-wise outstanding with debtors ageing buckets. See components/ModulePage/.
export default function OutstandingPage() {
  const sum = (key) => (has ? formatLacsWhole(dealers.reduce((s, d) => s + d[key], 0)) : undefined);
  return (
    <ModulePage
      title="Outstanding"
      description="Outstanding and ageing for all dealers. All amounts in Rs Lacs."
      actions={[{ label: 'Export' }]}
    >
      <KpiStrip
        items={[
          { label: 'Total Outstanding', unit: 'Rs Lacs', value: sum('outstanding'), icon: 'outstanding', tone: 'brand' },
          { label: 'Overdue', unit: 'Rs Lacs', value: sum('overdue'), icon: 'queries', tone: 'error' },
          { label: 'Dealers with Overdue', value: has ? formatCount(dealers.filter((d) => d.overdue > 0).length) : undefined, icon: 'dealers', tone: 'warning' },
          { label: 'Dealers over Credit Limit', value: has ? formatCount(dealers.filter((d) => d.outstanding > d.creditLimit).length) : undefined, icon: 'users', tone: 'gray' },
        ]}
      />
      <AgeingBuckets />
      <DataTable
        rows={dealers}
        tabs={['All', 'Overdue', 'Over Credit Limit']}
        tabMatch={(r, tab) => (tab === 'Overdue' ? r.overdue > 0 : r.outstanding > r.creditLimit)}
        searchPlaceholder="Search dealer or code"
        searchFields={['name', 'code', 'zone']}
        columns={COLUMNS}
        pageSize={12}
        empty={{ icon: 'outstanding', title: 'No outstanding data yet', hint: 'Dealer balances and ageing will be listed here.' }}
      />
    </ModulePage>
  );
}
