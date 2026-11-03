import { Link } from 'react-router-dom';
import { NAV_ICONS } from '../../components/Sidebar/navIcons.jsx';
import { ChevronRightIcon, PlusIcon } from './dashboardIcons.jsx';

// Tile colours: peach (brand), mint (success), lavender.
const TONES = {
  peach: 'bg-brand-50 text-brand-600',
  mint: 'bg-success-50 text-success-600',
  lavender: 'bg-[#efebfb] text-[#6b5bc4]',
};

/** Dashboard card: four shortcuts in a 2 × 2 grid. */
export default function QuickAccess({ basePath, className = '' }) {
  const tiles = [
    { label: 'Create Scheme', to: `${basePath}/schemes`, state: { openCreate: true }, Icon: PlusIcon, tone: 'peach' },
    { label: 'Manage Admins', to: `${basePath}/users`, Icon: NAV_ICONS.users, tone: 'mint' },
    { label: 'View Dealers', to: `${basePath}/dealers`, Icon: NAV_ICONS.dealers, tone: 'peach' },
    { label: 'Dealer Queries', to: `${basePath}/queries`, Icon: NAV_ICONS.queries, tone: 'lavender' },
  ];

  return (
    <section className={`rounded-2xl border border-gray-200/80 bg-white p-5 shadow-theme-sm ${className}`}>
      <h3 className="mb-4 text-lg font-semibold text-gray-900">Quick Access</h3>
      <div className="grid grid-cols-2 gap-3">
        {tiles.map(({ label, to, state, Icon, tone }, i) => (
          <div key={label} className="animate-fade-in-up" style={{ animationDelay: `${250 + i * 70}ms` }}>
            <Link
              to={to}
              state={state}
              className="group flex h-full items-center gap-3 rounded-xl border border-gray-100 bg-gray-50/70 px-3 py-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-200 hover:bg-white hover:shadow-theme-md"
            >
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${TONES[tone]}`}>
                <Icon />
              </span>
              <span className="min-w-0 flex-1 text-theme-sm font-medium text-gray-800">{label}</span>
              <span className="text-gray-400 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-600">
                <ChevronRightIcon />
              </span>
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}
