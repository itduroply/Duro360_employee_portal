import { useCallback, useEffect, useRef, useState } from 'react';
import ModulePage, { KpiStrip, TabBar, StatusChip } from '../../components/ModulePage/ModulePage.jsx';
import EmptyState from '../../components/ModulePage/EmptyState.jsx';
import Button from '../../components/common/Button.jsx';
import Alert from '../../components/common/Alert.jsx';
import { SearchIcon } from '../../components/common/icons.jsx';
import { queriesApi } from '../../api/queriesApi';
import { formatCount } from '../../utils/format.js';
import { ChatComposer, ChatMessages, formatStamp } from '../../components/Queries/QueryChat.jsx';

const TABS = ['Open', 'In Progress', 'Resolved', 'Closed'];
const REFRESH_MS = 30000;

function QueryListItem({ query, isActive, onSelect }) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={`flex w-full flex-col gap-1 border-l-2 px-4 py-3 text-left transition-colors ${
          isActive ? 'border-brand-500 bg-brand-25' : 'border-transparent hover:bg-gray-50'
        }`}
      >
        <span className="flex items-center justify-between gap-2">
          <span className="truncate text-theme-sm font-medium text-gray-800">{query.dealerName}</span>
          <span className="shrink-0 text-theme-xs text-gray-400">{query.ticketNo}</span>
        </span>
        <span className="truncate text-theme-xs text-gray-600">{query.subject}</span>
        <span className="flex items-center gap-2 text-theme-xs text-gray-400">
          <span className={query.type === 'Complaint' ? 'text-error-600' : 'text-gray-500'}>{query.type}</span>·
          <span>{formatStamp(query.raisedOn)}</span>
        </span>
      </button>
    </li>
  );
}

// Status buttons that make sense from the query's current status.
const NEXT_STATUS = {
  Open: [['In Progress', 'Mark In Progress', 'secondary'], ['Resolved', 'Mark Resolved', 'primary']],
  'In Progress': [['Resolved', 'Mark Resolved', 'primary']],
  Resolved: [['Closed', 'Close', 'secondary'], ['Open', 'Reopen', 'secondary']],
  Closed: [['Open', 'Reopen', 'secondary']],
};

function QueryThread({ query, onChanged }) {
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  async function setStatus(status) {
    setBusy(status);
    setError('');
    try {
      await queriesApi.setStatus(query.id, status);
      await onChanged();
    } catch (err) {
      setError(err.message || 'Could not save this change.');
    } finally {
      setBusy('');
    }
  }

  async function reply(text) {
    setBusy('reply');
    try {
      await queriesApi.reply(query.id, text);
      await onChanged();
    } finally {
      setBusy('');
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 bg-white px-5 py-4">
        <div className="min-w-0">
          <p className="text-theme-xs text-gray-500">
            {query.ticketNo} · {query.type} · {query.related}
            {query.reference && ` ${query.reference}`}
          </p>
          <h3 className="mt-0.5 text-base font-semibold text-gray-800">{query.subject}</h3>
          <p className="mt-0.5 text-theme-xs text-gray-500">
            {query.dealerName} ({query.dealerCode})
          </p>
        </div>
        <StatusChip status={query.status} />
      </header>
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 bg-white px-5 py-2.5">
        <span className="text-theme-xs text-gray-500">Change status:</span>
        {NEXT_STATUS[query.status].map(([status, label, variant]) => (
          <Button
            key={status}
            type="button"
            size="sm"
            variant={variant}
            isLoading={busy === status}
            disabled={Boolean(busy)}
            onClick={() => setStatus(status)}
          >
            {label}
          </Button>
        ))}
        {error && <span className="text-theme-xs text-error-500">{error}</span>}
      </div>
      <ChatMessages
        messages={query.thread}
        mine="DUROPLY"
        note={query.resolvedOn && ['Resolved', 'Closed'].includes(query.status) ? `${query.status} on ${formatStamp(query.resolvedOn)}` : undefined}
      />
      {query.status === 'Closed' ? (
        <p className="border-t border-gray-100 bg-white px-5 py-4 text-theme-sm text-gray-500">This query is closed. Reopen it to reply.</p>
      ) : (
        <ChatComposer onSend={reply} isSending={busy === 'reply'} placeholder="Write a reply…" />
      )}
    </div>
  );
}

// Inbox layout: ticket list on the left, the selected ticket and reply box on the right.
function QueryInbox({ queries, isLoading, reload }) {
  const [tab, setTab] = useState(TABS[0]);
  const [type, setType] = useState('');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const didAutoSelect = useRef(false);

  // On first load, select the latest query or complaint and open its status
  // tab. Later refreshes do not change what the user picked.
  useEffect(() => {
    if (didAutoSelect.current || queries.length === 0) return;
    didAutoSelect.current = true;
    const latest = queries.reduce((a, b) => (new Date(b.raisedOn) > new Date(a.raisedOn) ? b : a));
    setSelectedId(latest.id);
    if (TABS.includes(latest.status)) setTab(latest.status);
  }, [queries]);

  const q = search.trim().toLowerCase();
  const shown = queries.filter(
    (x) =>
      x.status === tab &&
      (!type || x.type === type) &&
      (!q || [x.ticketNo, x.dealerName, x.dealerCode, x.subject].some((v) => v.toLowerCase().includes(q)))
  );
  const selected = queries.find((x) => x.id === selectedId);

  return (
    <div className="grid min-h-[520px] grid-cols-1 overflow-hidden rounded-2xl border border-gray-200 bg-white lg:h-[680px] lg:grid-cols-5">
      <aside className="custom-scrollbar flex flex-col overflow-y-auto border-b border-gray-100 lg:col-span-2 lg:border-b-0 lg:border-r">
        <div className="flex flex-col gap-3 border-b border-gray-100 p-4">
          <TabBar tabs={TABS} active={tab} onChange={setTab} />
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                <SearchIcon />
              </span>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search ticket no., dealer or subject"
                className="h-10 w-full rounded-lg border border-gray-300 pl-10 pr-3 text-sm shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10"
              />
            </div>
            <select
              aria-label="Type"
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="h-10 cursor-pointer rounded-lg border border-gray-300 px-3 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-none"
            >
              <option value="">All Types</option>
              <option>Query</option>
              <option>Complaint</option>
            </select>
          </div>
        </div>
        {shown.length === 0 ? (
          <EmptyState
            compact
            icon="queries"
            title={isLoading ? 'Loading queries…' : `No ${tab.toLowerCase()} queries`}
            hint={isLoading ? undefined : 'Queries and complaints from dealers will be listed here.'}
          />
        ) : (
          <ul className="divide-y divide-gray-100">
            {shown.map((x) => (
              <QueryListItem key={x.id} query={x} isActive={x.id === selectedId} onSelect={() => setSelectedId(x.id)} />
            ))}
          </ul>
        )}
      </aside>
      <div className="min-h-0 bg-white lg:col-span-3">
        {selected ? (
          <QueryThread key={selected.id} query={selected} onChanged={reload} />
        ) : (
          <div className="flex h-full items-center justify-center">
            <EmptyState icon="documents" title="Select a query" hint="Open a query from the list to read it and reply." />
          </div>
        )}
      </div>
    </div>
  );
}

// Hours from a query being raised to the first reply from the Duro team.
function averageReplyHours(queries) {
  const gaps = queries
    .map((x) => {
      const first = x.thread.find((m) => m.sender === 'DUROPLY');
      return first ? (new Date(first.at) - new Date(x.raisedOn)) / 3600000 : null;
    })
    .filter((h) => h !== null);
  if (gaps.length === 0) return undefined;
  return (gaps.reduce((a, b) => a + b, 0) / gaps.length).toFixed(1);
}

// Dealer queries and complaints, and the replies to them. Reloads every 30
// seconds, so a new query or a Dealer reply shows up without a page refresh.
export default function QueriesPage() {
  const [queries, setQueries] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    try {
      setQueries(await queriesApi.list());
      setError('');
    } catch (err) {
      setError(err.message || 'Could not load the queries.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
    const timer = setInterval(reload, REFRESH_MS);
    return () => clearInterval(timer);
  }, [reload]);

  const has = queries.length > 0;
  const count = (status) => (has ? formatCount(queries.filter((x) => x.status === status).length) : undefined);
  const thisMonth = new Date().toISOString().slice(0, 7);
  const avg = averageReplyHours(queries);

  return (
    <ModulePage title="Queries" description="Queries and complaints raised by dealers." live>
      {error && <Alert variant="error">{error}</Alert>}
      <KpiStrip
        items={[
          { label: 'Open', value: count('Open'), icon: 'queries', tone: 'warning' },
          { label: 'In Progress', value: count('In Progress'), icon: 'outstanding', tone: 'brand' },
          {
            label: 'Resolved This Month',
            value: has ? formatCount(queries.filter((x) => x.status === 'Resolved' && x.resolvedOn?.slice(0, 7) === thisMonth).length) : undefined,
            icon: 'auditLogs',
            tone: 'success',
          },
          { label: 'Average Reply Time', value: avg ? `${avg} hrs` : undefined, icon: 'notifications', tone: 'gray' },
        ]}
      />
      <QueryInbox queries={queries} isLoading={isLoading} reload={reload} />
    </ModulePage>
  );
}
