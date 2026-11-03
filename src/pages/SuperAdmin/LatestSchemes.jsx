import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { schemesApi } from '../../api/schemesApi';
import StatusChip from '../../components/ModulePage/StatusChip.jsx';
import NewBadge from '../../components/Motion/NewBadge.jsx';
import { isNewScheme, schemeStatus } from '../../utils/schemes.js';
import { formatDate } from '../../utils/format.js';
import { ArrowRightIcon, ChevronRightIcon, GiftIcon, StarBadgeIcon, TagIcon, TrendIcon, UserPlusIcon } from './dashboardIcons.jsx';

const SHOWN = 4;

// One icon per scheme type (utils/schemes.js SCHEME_TYPES).
const TYPE_ICONS = {
  Festive: GiftIcon,
  Payment: TagIcon,
  Target: TagIcon,
  Loyalty: StarBadgeIcon,
  Volume: TrendIcon,
  Onboarding: UserPlusIcon,
};

/**
 * Dashboard card: the most recently created schemes. A scheme created in
 * the last 3 days gets a "New" badge and a pulsing dot, so a new scheme is
 * easy to spot. Each row opens the Schemes page.
 */
export default function LatestSchemes({ basePath, className = '' }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    schemesApi
      .list()
      .then((data) => {
        if (cancelled) return;
        const byCreated = [...data].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
        setRows(byCreated.slice(0, SHOWN));
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Could not load schemes.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className={`rounded-2xl border border-gray-200/80 bg-white p-5 shadow-theme-sm sm:p-6 ${className}`}>
      <header className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">Latest Schemes</h3>
          <p className="mt-1 text-theme-sm text-gray-500">Most recently created first</p>
        </div>
        <Link to={`${basePath}/schemes`} className="flex items-center gap-1.5 text-theme-sm font-medium text-brand-600 hover:text-brand-700">
          View all
          <ArrowRightIcon />
        </Link>
      </header>

      {error ? (
        <p className="rounded-xl border border-gray-200 px-5 py-8 text-center text-theme-sm text-error-600">{error}</p>
      ) : rows === null ? (
        <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200" aria-label="Loading schemes">
          {[0, 1, 2].map((i) => (
            <li key={i} className="flex items-center gap-4 px-5 py-5">
              <span className="h-12 w-12 animate-pulse rounded-xl bg-gray-100" />
              <span className="h-3 flex-1 animate-pulse rounded bg-gray-100" />
            </li>
          ))}
        </ul>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 px-5 py-10 text-center">
          <p className="text-theme-sm font-medium text-gray-700">No schemes yet</p>
          <Link to={`${basePath}/schemes`} state={{ openCreate: true }} className="mt-2 inline-block text-theme-sm font-medium text-brand-600">
            + Create the first scheme
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200">
          {rows.map((row, i) => {
            const fresh = isNewScheme(row);
            const Icon = TYPE_ICONS[row.type] || GiftIcon;
            return (
              <li key={row.id} className="animate-fade-in-up" style={{ animationDelay: `${200 + i * 90}ms` }}>
                <Link
                  to={`${basePath}/schemes`}
                  className={`group flex items-center gap-4 px-4 py-4 transition-colors hover:bg-gray-50 sm:px-5 ${fresh ? 'bg-brand-25' : ''}`}
                >
                  <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                    <Icon />
                    {fresh && (
                      <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3" aria-hidden="true">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-75" />
                        <span className="relative inline-flex h-3 w-3 rounded-full bg-brand-500" />
                      </span>
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-[15px] font-semibold text-gray-800" title={row.name}>
                        {row.name}
                      </p>
                      {fresh && <NewBadge />}
                    </div>
                    <p className="mt-1 truncate text-theme-sm text-gray-500">
                      {row.type} • {formatDate(row.start_date)} – {formatDate(row.end_date)}
                    </p>
                  </div>
                  <StatusChip status={schemeStatus(row)} />
                  <span className="text-gray-400 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-600">
                    <ChevronRightIcon className="h-5 w-5" />
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
