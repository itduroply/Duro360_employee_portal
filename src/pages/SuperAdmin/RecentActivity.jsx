import { Link } from 'react-router-dom';
import { NAV_ICONS } from '../../components/Sidebar/navIcons.jsx';
import { SHOW_SAMPLE_DATA, SAMPLE_AUDIT_LOGS } from '../../data/sample/index.js';
import { formatDateTime } from '../../utils/format.js';
import { ArrowRightIcon, ChevronRightIcon } from './dashboardIcons.jsx';

const SHOWN = 3;
const entries = SHOW_SAMPLE_DATA ? SAMPLE_AUDIT_LOGS.slice(0, SHOWN) : [];

// Icon by what the entry is about.
function iconFor(entry) {
  if (/dealer/i.test(entry.action)) return NAV_ICONS.dealers;
  if (/document/i.test(entry.action)) return NAV_ICONS.documents;
  if (/query/i.test(entry.action)) return NAV_ICONS.queries;
  if (/report/i.test(entry.action)) return NAV_ICONS.reports;
  return NAV_ICONS.profile;
}

/**
 * Dashboard card: the latest entries from the Audit Logs. Uses the same
 * sample rows as the Audit Logs page until audit logging is connected.
 */
export default function RecentActivity({ basePath, className = '' }) {
  return (
    <section className={`rounded-2xl border border-gray-200/80 bg-white p-5 shadow-theme-sm ${className}`}>
      <header className="mb-2 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
          {SHOW_SAMPLE_DATA && <p className="mt-0.5 text-theme-xs text-gray-400">Sample data</p>}
        </div>
        <Link to={`${basePath}/audit-logs`} className="flex items-center gap-1.5 text-theme-xs font-medium text-brand-600 hover:text-brand-700">
          View all
          <ArrowRightIcon className="h-3.5 w-3.5" />
        </Link>
      </header>

      {entries.length === 0 ? (
        <p className="py-6 text-center text-theme-sm text-gray-500">Activity shows here once audit logging is connected.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {entries.map((entry, i) => {
            const Icon = iconFor(entry);
            const failed = /failed/i.test(entry.action);
            return (
              <li key={`${entry.at}-${entry.user}`} className="animate-fade-in-up" style={{ animationDelay: `${400 + i * 90}ms` }}>
                <Link to={`${basePath}/audit-logs`} className="group flex items-center gap-3 py-3.5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                    <Icon />
                  </span>
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${failed ? 'bg-error-500' : 'bg-success-500'}`} aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-theme-sm font-medium text-gray-800">{entry.action}</p>
                    <p className="mt-0.5 truncate text-theme-xs text-gray-500">
                      {entry.details} • {formatDateTime(entry.at)}
                    </p>
                  </div>
                  <span className="text-gray-400 group-hover:text-brand-600">
                    <ChevronRightIcon />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
