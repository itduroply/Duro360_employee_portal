import { useEffect, useMemo, useState } from 'react';
import ModulePage, { KpiStrip, TabBar } from '../../components/ModulePage/ModulePage.jsx';
import EmptyState from '../../components/ModulePage/EmptyState.jsx';
import ChartCard from '../../components/Charts/ChartCard.jsx';
import Alert from '../../components/common/Alert.jsx';
import { NAV_ICONS } from '../../components/Sidebar/navIcons.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { modulesFor } from './liveReports.js';
import ReportChart, { legendFor } from './ReportChart.jsx';
import { downloadCsv } from '../../utils/csv.js';

const RANGES = { '3 Months': 3, '6 Months': 6, '12 Months': 12 };

function DownloadIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
      <path d="M10 3v9m0 0-3.5-3.5M10 12l3.5-3.5M3.5 14.5v1a1.5 1.5 0 0 0 1.5 1.5h10a1.5 1.5 0 0 0 1.5-1.5v-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Left column: only the report groups this person's features allow.
function ReportNav({ modules, active, onSelect }) {
  return (
    <nav className="custom-scrollbar overflow-x-auto rounded-2xl border border-gray-200 bg-white p-2" aria-label="Reports">
      <ul className="flex gap-1">
        {modules.map((m) => {
          const Icon = NAV_ICONS[m.icon];
          const isOpen = m.key === active;
          return (
            <li key={m.key} className="shrink-0">
              <button
                type="button"
                onClick={() => onSelect(m.key)}
                className={`flex w-full items-center gap-3 whitespace-nowrap rounded-lg px-4 py-2.5 text-left text-theme-sm font-medium transition-colors ${
                  isOpen ? 'bg-brand-50 text-brand-600' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <span className={isOpen ? 'text-brand-500' : 'text-gray-400'}>{Icon && <Icon />}</span>
                {m.label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function ChartSkeleton() {
  return (
    <div className="flex flex-col gap-4 md:gap-5" aria-busy="true">
      <div className="h-20 animate-pulse rounded-2xl bg-gray-100" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-72 animate-pulse rounded-2xl bg-gray-100" />
        ))}
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const { user } = useAuth();
  const modules = useMemo(() => modulesFor(user), [user]);
  const [activeKey, setActiveKey] = useState(modules[0]?.key);
  const [range, setRange] = useState('6 Months');
  // key -> { rows } or { error }; a module is fetched once, on first open.
  const [loaded, setLoaded] = useState({});

  const module = modules.find((m) => m.key === activeKey) || modules[0];
  const entry = module ? loaded[module.key] : null;

  useEffect(() => {
    if (!module || loaded[module.key]) return undefined;
    let cancelled = false;
    module
      .load()
      .then((rows) => !cancelled && setLoaded((l) => ({ ...l, [module.key]: { rows } })))
      .catch((err) => !cancelled && setLoaded((l) => ({ ...l, [module.key]: { error: err.message || 'Could not load this report.' } })));
    return () => {
      cancelled = true;
    };
  }, [module, loaded]);

  const view = useMemo(() => (entry?.rows ? module.build(entry.rows, RANGES[range]) : null), [entry, module, range]);

  if (!modules.length) {
    return (
      <ModulePage title="Reports">
        <div className="rounded-2xl border border-gray-200 bg-white">
          <EmptyState icon="reports" title="No reports for your login" hint="Reports follow the features given to you. Ask the Super Admin to give you a feature." />
        </div>
      </ModulePage>
    );
  }

  const allTables = view ? view.charts.filter((c) => c.table) : [];

  return (
    <ModulePage title="Reports">
      <div className="flex flex-col gap-4 md:gap-5">
        <ReportNav modules={modules} active={module.key} onSelect={setActiveKey} />

        <div className="flex min-w-0 flex-col gap-4 md:gap-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-gray-800">{module.label}</h3>
              <p className="mt-0.5 text-theme-sm text-gray-500">{module.about}</p>
            </div>
            <div className="flex items-center gap-2">
              {module.monthly && <TabBar tabs={Object.keys(RANGES)} active={range} onChange={setRange} />}
              <button
                type="button"
                disabled={!allTables.length}
                onClick={() =>
                  // One file: each chart's table under its own title.
                  downloadCsv(`${module.label} report`, {
                    columns: [module.label],
                    rows: allTables.flatMap((c) => [[c.title], c.table.columns, ...c.table.rows, []]),
                  })
                }
                className="inline-flex h-9 items-center gap-2 rounded-lg px-3 text-theme-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <DownloadIcon />
                CSV
              </button>
            </div>
          </div>

          {entry?.error && <Alert variant="error">{entry.error}</Alert>}
          {!entry && <ChartSkeleton />}

          {view && (
            <div key={module.key} className="flex flex-col gap-4 md:gap-5">
              <KpiStrip items={view.summary} />
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5">
                {view.charts.map((chart, i) => (
                  <ChartCard
                    key={chart.id}
                    title={chart.title}
                    subtitle={chart.subtitle}
                    legend={legendFor(chart)}
                    table={chart.table}
                    className={`animate-fade-in-up ${chart.span === 2 ? 'md:col-span-2' : ''}`}
                    style={{ animationDelay: `${150 + i * 90}ms` }}
                  >
                    <ReportChart chart={chart} />
                  </ChartCard>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </ModulePage>
  );
}
