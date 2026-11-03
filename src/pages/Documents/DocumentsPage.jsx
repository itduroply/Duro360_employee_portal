import { useMemo, useState } from 'react';
import ModulePage, { KpiStrip, StatusChip } from '../../components/ModulePage/ModulePage.jsx';
import DataTable from '../../components/ModulePage/DataTable.jsx';
import { SHOW_SAMPLE_DATA, SAMPLE_DOCUMENTS, DOCUMENT_CATEGORIES, TODAY } from '../../data/sample/index.js';
import { formatCount, formatDate, inPeriod } from '../../utils/format.js';

const ALL = 'All Documents';
const CATEGORIES = [ALL, ...DOCUMENT_CATEGORIES];
const documents = SHOW_SAMPLE_DATA ? SAMPLE_DOCUMENTS : [];
const has = documents.length > 0;

function FolderIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
      <path d="M2.5 5.5a1 1 0 0 1 1-1h4l1.5 2h7.5a1 1 0 0 1 1 1v7.5a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1V5.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

// Left column: document categories, like folders.
function CategoryList({ active, onChange }) {
  return (
    <nav className="self-start rounded-2xl border border-gray-200 bg-white p-2" aria-label="Document categories">
      <p className="px-3 pb-1 pt-2 text-theme-xs font-medium uppercase tracking-wide text-gray-400">Categories</p>
      <ul>
        {CATEGORIES.map((c) => {
          const count = c === ALL ? documents.length : documents.filter((d) => d.category === c).length;
          return (
            <li key={c}>
              <button
                type="button"
                onClick={() => onChange(c)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-theme-sm font-medium transition-colors ${
                  active === c ? 'bg-brand-50 text-brand-500' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <FolderIcon />
                <span className="flex-1 truncate">{c}</span>
                <span className="text-theme-xs text-gray-400">{has ? count : '—'}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

const COLUMNS = [
  { key: 'name', label: 'Document' },
  { key: 'category', label: 'Category' },
  { key: 'dealerName', label: 'Dealer' },
  { key: 'date', label: 'Date', render: (r) => formatDate(r.date) },
  { key: 'by', label: 'By' },
  { key: 'status', label: 'Status', render: (r) => <StatusChip status={r.status} /> },
];

// Documents shared with dealers, and documents dealers have asked for. See components/ModulePage/.
export default function DocumentsPage() {
  const [category, setCategory] = useState(ALL);
  const rows = useMemo(() => documents.filter((d) => category === ALL || d.category === category), [category]);
  const requests = documents.filter((d) => d.kind === 'Requested');
  const count = (list) => (has ? formatCount(list.length) : undefined);

  return (
    <ModulePage
      title="Documents"
      description="Documents shared with dealers, and document requests from dealers."
      actions={[{ label: '+ Share Document', variant: 'primary' }]}
    >
      <KpiStrip
        items={[
          { label: 'Documents Shared', value: count(documents.filter((d) => d.kind === 'Shared')), icon: 'documents', tone: 'brand' },
          { label: 'Open Requests', value: count(requests.filter((d) => d.status === 'Open')), icon: 'queries', tone: 'warning' },
          { label: 'Closed Requests', value: count(requests.filter((d) => d.status === 'Closed')), icon: 'auditLogs', tone: 'success' },
          { label: 'Shared This Month', value: count(documents.filter((d) => d.kind === 'Shared' && inPeriod(d.date, 'This Month', TODAY))), icon: 'notifications', tone: 'gray' },
        ]}
      />
      <div className="grid grid-cols-1 gap-4 md:gap-5 lg:grid-cols-4">
        <CategoryList active={category} onChange={setCategory} />
        <DataTable
          className="lg:col-span-3"
          rows={rows}
          tabs={['Shared', 'Requested']}
          tabField="kind"
          searchPlaceholder="Search document or dealer"
          searchFields={['name', 'dealerName', 'by']}
          columns={COLUMNS}
          empty={{ icon: 'documents', title: `No documents in ${category}`, hint: 'Shared files and dealer requests will be listed here.' }}
        />
      </div>
    </ModulePage>
  );
}
