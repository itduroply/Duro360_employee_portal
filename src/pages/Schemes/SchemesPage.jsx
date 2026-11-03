import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ModulePage, { KpiStrip, TabBar, StatusChip } from '../../components/ModulePage/ModulePage.jsx';
import Panel from '../../components/ModulePage/Panel.jsx';
import EmptyState from '../../components/ModulePage/EmptyState.jsx';
import Button from '../../components/common/Button.jsx';
import Alert from '../../components/common/Alert.jsx';
import { schemesApi } from '../../api/schemesApi';
import { usersApi } from '../../api/usersApi';
import { isNewScheme, schemeStatus } from '../../utils/schemes.js';
import { formatCount, formatDate, formatLacs, formatLacsWhole } from '../../utils/format.js';
import CreateSchemeModal from './CreateSchemeModal.jsx';
import Confetti from '../../components/Motion/Confetti.jsx';
import NewBadge from '../../components/Motion/NewBadge.jsx';
import SchemeArt from './SchemeArt.jsx';

// How long a just-created scheme stays highlighted.
const HIGHLIGHT_MS = 6000;

const STEPS = [
  {
    title: 'Create the scheme',
    text: 'Set the name, type, dates and payout rule.',
    icon: <path d="M12 5v14M5 12h14" />,
  },
  {
    title: 'Assign dealers',
    text: 'Pick dealers one by one, or by zone or branch.',
    icon: (
      <>
        <circle cx="9" cy="8" r="3.2" />
        <path d="M3 19c.6-3.2 3-5 6-5s5.4 1.8 6 5" />
        <path d="M16 5.2a3 3 0 0 1 0 5.6M18 14.3c1.6.7 2.6 2.3 3 4.7" />
      </>
    ),
  },
  {
    title: 'Track and pay out',
    text: 'Follow each dealer’s progress and approve the payout.',
    icon: (
      <>
        <path d="M4 19h16" />
        <path d="M5 15l4-4 3 3 7-7" />
        <path d="M15 7h4v4" />
      </>
    ),
  },
];

// `highlight` is set for the scheme that was just created: the card pops in
// with a pulsing ring and a burst of confetti, and scrolls into view.
function SchemeCard({ scheme, index, highlight }) {
  const share = scheme.target ? scheme.dealers / scheme.target : 0;
  const ref = useRef(null);

  useEffect(() => {
    if (highlight) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [highlight]);

  return (
    // The entrance animation sits on the wrapper so the hover lift on the
    // card is not overridden by it.
    <div
      ref={ref}
      className={`relative ${highlight ? 'animate-pop-in' : 'animate-fade-in-up'}`}
      style={highlight ? undefined : { animationDelay: `${index * 70}ms` }}
    >
      {highlight && <Confetti />}
      <article
        className={`flex h-full flex-col gap-4 rounded-xl border bg-white p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-theme-md ${
          highlight ? 'animate-glow-ring border-brand-500' : 'border-gray-200'
        }`}
      >
        <SchemeArt scheme={scheme} seed={index} />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate text-theme-sm font-semibold text-gray-800" title={scheme.name}>
                {scheme.name}
              </p>
              {scheme.isNew && <NewBadge />}
            </div>
            <p className="mt-0.5 text-theme-xs text-gray-500">
              {scheme.type} · {formatDate(scheme.start)} – {formatDate(scheme.end)}
            </p>
          </div>
          <StatusChip status={scheme.status} />
        </div>
        <div>
          <div className="mb-1.5 flex justify-between text-theme-xs">
            <span className="text-gray-500">Dealers enrolled</span>
            <span className="font-medium text-gray-800">
              {scheme.dealers} of {scheme.target}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-gray-100">
            <div
              className="h-full origin-left animate-grow-x rounded-full bg-brand-500"
              style={{ width: `${Math.min(100, share * 100)}%`, animationDelay: `${200 + index * 70}ms` }}
            />
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-gray-100 pt-3 text-theme-xs">
          <span className="text-gray-500">Payout so far</span>
          <span className="font-semibold tabular-nums text-gray-800">Rs {formatLacs(scheme.payout)} Lacs</span>
        </div>
      </article>
    </div>
  );
}

// Schemes are shown as cards (one per scheme), not as a table.
function SchemeCards({ schemes, isLoading, onCreate, highlightId }) {
  const [tab, setTab] = useState('All');

  // Show every scheme when one was just created, so the new card is visible.
  useEffect(() => {
    if (highlightId) setTab('All');
  }, [highlightId]);

  const has = schemes.length > 0;
  const shown = schemes.filter((s) => tab === 'All' || s.status === tab);
  return (
    <Panel
      title="Schemes"
      right={<TabBar tabs={['All', 'Active', 'Upcoming', 'Expired']} active={tab} onChange={setTab} />}
      flush={shown.length === 0}
    >
      {isLoading ? (
        <EmptyState icon="schemes" title="Loading schemes…" />
      ) : shown.length === 0 ? (
        <EmptyState
          icon="schemes"
          title={has ? `No ${tab.toLowerCase()} schemes` : 'No schemes yet'}
          hint="Create a scheme to start assigning it to dealers."
          action={
            <Button size="sm" onClick={onCreate}>
              + Create Scheme
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((s, i) => (
            <SchemeCard key={s.id} scheme={s} index={i} highlight={s.id === highlightId} />
          ))}
        </div>
      )}
    </Panel>
  );
}

// The three steps as one horizontal strip above the list, joined by a line
// with a moving dot. Stacks on narrow screens.
function HowSchemesWork() {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white px-5 py-4">
      <p className="mb-3 text-theme-xs font-semibold uppercase tracking-wider text-gray-500">How schemes work</p>
      <ol className="flex flex-col gap-4 md:flex-row md:items-start md:gap-0">
        {STEPS.map((step, i) => (
          <li key={step.title} className="contents">
            <div className="relative flex flex-1 items-start gap-3 overflow-hidden">
              <span
                className="pointer-events-none absolute -top-3 right-2 select-none text-[56px] font-bold leading-none text-gray-100"
                aria-hidden="true"
              >
                0{i + 1}
              </span>
              <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-500 text-white shadow-theme-xs">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  {step.icon}
                </svg>
              </span>
              <div className="relative min-w-0 pr-10">
                <p className="text-theme-xs font-medium text-brand-500">Step {i + 1}</p>
                <p className="text-theme-sm font-semibold text-gray-800">{step.title}</p>
                <p className="mt-0.5 text-theme-xs text-gray-500">{step.text}</p>
              </div>
            </div>
            {i < STEPS.length - 1 && (
              <div className="relative hidden h-11 w-16 shrink-0 items-center md:flex lg:w-24" aria-hidden="true">
                <span className="h-0 w-full border-t-2 border-dashed border-brand-200" />
                <span className="sa-travel absolute left-0 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-brand-500" style={{ animationDelay: `${i * 0.9}s` }} />
                <svg viewBox="0 0 8 12" className="absolute -right-0.5 top-1/2 h-3 w-2 -translate-y-1/2 text-brand-300" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 2l4 4-4 4" />
                </svg>
              </div>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
// Card fields from a schemes row: enrolled = every Dealer for an ALL scheme,
// else the Dealers picked for it. Payout tracking is not connected yet.
function toCard(row, dealerTotal) {
  const enrolled = row.audience === 'ALL' ? dealerTotal : row.scheme_dealers.length;
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    start: row.start_date,
    end: row.end_date,
    status: schemeStatus(row),
    isNew: isNewScheme(row),
    dealers: enrolled,
    target: dealerTotal || enrolled,
    payout: 0,
  };
}

export default function SchemesPage() {
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [directory, setDirectory] = useState([]);
  const [directoryError, setDirectoryError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [highlightId, setHighlightId] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();

  // Returns the loaded rows (or null on error) so the caller can find a new one.
  const loadSchemes = useCallback(async () => {
    try {
      const data = await schemesApi.list();
      setRows(data);
      setError('');
      return data;
    } catch (err) {
      setError(err.message || 'Could not load schemes.');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // "Create Scheme" on the dashboard links here with { openCreate: true }.
  // Clear that state at once so a page refresh does not reopen the form.
  useEffect(() => {
    if (location.state?.openCreate) {
      setShowCreate(true);
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.state, location.pathname, navigate]);

  useEffect(() => {
    if (!highlightId) return undefined;
    const timer = setTimeout(() => setHighlightId(null), HIGHLIGHT_MS);
    return () => clearTimeout(timer);
  }, [highlightId]);

  useEffect(() => {
    loadSchemes();
    usersApi
      .listDealerDirectory()
      .then(({ dealers }) => setDirectory(dealers))
      .catch((err) => setDirectoryError(err.message || 'Could not load the dealer list.'));
  }, [loadSchemes]);

  const schemes = useMemo(() => rows.map((r) => toCard(r, directory.length)), [rows, directory.length]);
  const has = schemes.length > 0;
  const active = schemes.filter((s) => s.status === 'Active');
  const openCreate = () => {
    setNotice('');
    setShowCreate(true);
  };

  async function handleCreated(name) {
    setShowCreate(false);
    setNotice(`Scheme "${name}" created. Dealers can see it now.`);
    const data = await loadSchemes();
    // The new scheme is the one created last.
    const newest = data?.reduce((a, b) => (String(b.created_at) > String(a.created_at) ? b : a), data[0]);
    if (newest) setHighlightId(newest.id);
  }

  return (
    <ModulePage
      title="Schemes"
      description="Set up schemes and incentive programs and assign them to dealers."
      live
      actions={[{ label: '+ Create Scheme', variant: 'primary', onClick: openCreate }]}
    >
      {error && <Alert variant="error">{error}</Alert>}
      {notice && <Alert variant="success">{notice}</Alert>}
      <KpiStrip
        items={[
          { label: 'Active Schemes', value: has ? formatCount(active.length) : undefined, icon: 'schemes', tone: 'success' },
          { label: 'Upcoming', value: has ? formatCount(schemes.filter((s) => s.status === 'Upcoming').length) : undefined, icon: 'outstanding', tone: 'warning' },
          { label: 'Dealers Enrolled', value: has ? formatCount(active.reduce((s, x) => s + x.dealers, 0)) : undefined, icon: 'dealers', tone: 'brand' },
          { label: 'Payout This Year', unit: 'Rs Lacs', value: has ? formatLacsWhole(schemes.reduce((s, x) => s + x.payout, 0)) : undefined, icon: 'payments', tone: 'gray' },
        ]}
      />
      <HowSchemesWork />
      <SchemeCards schemes={schemes} isLoading={isLoading} onCreate={openCreate} highlightId={highlightId} />
      <CreateSchemeModal
        open={showCreate}
        directory={directory}
        directoryError={directoryError}
        onClose={() => setShowCreate(false)}
        onCreated={handleCreated}
      />
    </ModulePage>
  );
}
