import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { usersApi } from '../../api/usersApi';
import Alert from '../../components/common/Alert.jsx';
import { getSidebarForRole } from '../../components/Sidebar/sidebarConfig.js';
import WelcomeBanner from '../SuperAdmin/WelcomeBanner.jsx';
import { StatCard } from '../SuperAdmin/StatCards.jsx';
import { ArrowRightIcon } from '../SuperAdmin/dashboardIcons.jsx';

const BASE = '/admin';
const TONES = ['solid', 'peach', 'mint', 'mint', 'peach'];

// What the credit figures mean for each Dealer Unlocking role.
const CREDIT_COPY = {
  Requester: { label: 'My Open Requests', note: (n) => `${n} decided this month` },
  Approver: { label: 'Waiting For You', note: (n) => `${n} actioned this month` },
  EDP: { label: 'Open Requests', note: (n) => `${n} approved this month` },
};

// One card per figure the Admin's features allow. Nothing is shown for a
// feature the Admin does not hold, and the server sends none for it either.
function buildCards(f) {
  const cards = [];
  if (f.dealers) {
    cards.push({
      key: 'dealers', label: 'Dealers', value: f.dealers.total, icon: 'dealers', to: `${BASE}/dealers`,
      note: `${f.dealers.withLogin} with login · ${f.dealers.withoutLogin} without`,
    });
  }
  if (f.schemes) {
    cards.push({
      key: 'schemes', label: 'Active Schemes', value: f.schemes.active, icon: 'schemes', to: `${BASE}/schemes`,
      note: `${f.schemes.upcoming} upcoming · ${f.schemes.total} in all`,
    });
  }
  if (f.credit) {
    const copy = CREDIT_COPY[f.credit.role];
    cards.push({
      key: 'credit', label: copy.label, value: f.credit.open, icon: 'unlock', to: `${BASE}/dealer-unlocking`,
      note: copy.note(f.credit.decidedMonth),
    });
  }
  if (f.warranty) {
    cards.push({
      key: 'warranty', label: 'Pending Certificates', value: f.warranty.pending, icon: 'warranty', to: `${BASE}/warranty`,
      note: `${f.warranty.issuedMonth} issued this month · ${f.warranty.issued} in all`,
    });
  }
  if (f.queries) {
    cards.push({
      key: 'queries', label: 'Open Queries', value: f.queries.open, icon: 'queries', to: `${BASE}/queries`,
      note: `${f.queries.inProgress} in progress · ${f.queries.resolvedMonth} resolved this month`,
    });
  }
  return cards;
}

/**
 * Admin Console landing page. A welcome banner, one figure card for each
 * feature a Super Admin granted this Admin.
 * The figures come from manage-users (admin_dashboard), which sends only what
 * the Admin's permissions allow.
 */
export default function AdminOverview() {
  const { user } = useAuth();
  const [figures, setFigures] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    usersApi
      .adminDashboard()
      .then(({ figures: f }) => !cancelled && setFigures(f))
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Could not load your dashboard figures.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // The features this Admin holds, as the sidebar lists them (no Dashboard).
  const shortcuts = useMemo(
    () => getSidebarForRole('ADMIN', { permissions: user?.permissions }).filter((item) => item.key !== 'dashboard' && item.implemented),
    [user?.permissions]
  );
  const cards = figures ? buildCards(figures) : [];

  return (
    <div className="flex flex-col gap-5 md:gap-6">
      {error && <Alert variant="error">{error}</Alert>}

      <WelcomeBanner
        name={user?.name}
        subtitle={shortcuts.length ? `You manage ${shortcuts.map((s) => s.label).join(', ')}.` : 'No features are assigned to you yet.'}
        actions={
          shortcuts.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-3">
              {shortcuts.slice(0, 2).map((item, i) => (
                <Link
                  key={item.key}
                  to={`${BASE}/${item.path}`}
                  className={
                    i === 0
                      ? 'inline-flex items-center gap-2.5 rounded-lg bg-gradient-to-b from-brand-500 to-brand-600 px-6 py-3 text-theme-sm font-semibold text-white shadow-theme-md transition-transform duration-200 hover:-translate-y-0.5'
                      : 'inline-flex items-center gap-2.5 rounded-lg border border-brand-300 bg-white/60 px-6 py-3 text-theme-sm font-semibold text-brand-600 transition-colors hover:bg-white'
                  }
                >
                  {item.label}
                  <ArrowRightIcon />
                </Link>
              ))}
            </div>
          )
        }
      />

      {shortcuts.length === 0 && (
        <Alert variant="info">No features are assigned to your login yet. Ask the Super Admin to give you access.</Alert>
      )}

      {cards.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 md:gap-5">
          {cards.map((card, i) => (
            <StatCard key={card.key} {...card} tone={TONES[i % TONES.length]} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
