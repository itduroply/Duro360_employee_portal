import { Link } from 'react-router-dom';
import CountUp from '../../components/Motion/CountUp.jsx';
import { NAV_ICONS } from '../../components/Sidebar/navIcons.jsx';
import { ChevronRightIcon } from './dashboardIcons.jsx';

// Peach for totals, mint for "active" figures. Solid is the red featured card.
const TONES = {
  solid: {
    tile: 'bg-white/20 text-white', wave: '#ffffff', card: 'border-transparent bg-gradient-to-br from-brand-600 to-brand-400 shadow-theme-md',
    label: 'text-white', value: 'text-white', note: 'text-white/85', chevron: 'bg-white/20 text-white group-hover:bg-white group-hover:text-brand-600', waveOpacity: '0.15',
  },
  peach: { tile: 'bg-brand-50 text-brand-600', wave: '#fbd5d3' },
  mint: { tile: 'bg-success-50 text-success-600', wave: '#dcf3e5' },
};

const ICONS = {
  outstanding: NAV_ICONS.outstanding,
  ageing: NAV_ICONS.transactions,
  sales: NAV_ICONS.invoices,
  receipts: NAV_ICONS.payments,
  dealers: NAV_ICONS.dealers,
  schemes: NAV_ICONS.schemes,
  warranty: NAV_ICONS.warranty,
  queries: NAV_ICONS.queries,
  unlock: NAV_ICONS.dealerUnlocking,
};

/**
 * One dashboard figure: icon tile, label, a large number that counts up,
 * a short note under it, and on the right either a link chevron (`to`) or a
 * small percentage pill (`pill`). A soft wave fills the bottom edge.
 */
export function StatCard({ label, value, note, icon, tone, to, pill, index }) {
  const Icon = ICONS[icon];
  const colors = TONES[tone];
  const body = (
    <>
      <svg viewBox="0 0 300 40" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 h-8 w-full" aria-hidden="true">
        <path d="M0 28 C 60 6 120 40 190 22 S 280 10 300 18 L 300 40 L 0 40 Z" fill={colors.wave} opacity={colors.waveOpacity || '0.7'} />
      </svg>
      <div className="relative flex items-start gap-4">
        <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl [&_svg]:h-7 [&_svg]:w-7 ${colors.tile}`}>
          {Icon && <Icon />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className={`truncate text-theme-sm font-medium ${colors.label || 'text-gray-800'}`}>{label}</p>
            {to && (
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors ${colors.chevron || 'bg-gray-100 text-gray-500 group-hover:bg-brand-500 group-hover:text-white'}`}>
                <ChevronRightIcon className="h-3.5 w-3.5" />
              </span>
            )}
            {pill && (
              <span className="shrink-0 rounded-full bg-success-50 px-2.5 py-0.5 text-theme-xs font-semibold text-success-600">{pill}</span>
            )}
          </div>
          <p className={`mt-1.5 text-[32px] font-semibold leading-none ${colors.value || 'text-gray-900'}`}>
            <CountUp value={value} />
          </p>
          <p className={`mt-2.5 truncate text-theme-xs ${colors.note || 'text-gray-500'}`}>{note}</p>
        </div>
      </div>
    </>
  );

  const card = `group relative block h-full overflow-hidden rounded-2xl border p-5 pb-7 transition-all duration-200 ${
    colors.card || 'border-gray-200/80 bg-white shadow-theme-sm'
  }`;
  return (
    // The entrance animation sits on the wrapper so the hover lift on the
    // card is not overridden by it.
    <div className="animate-fade-in-up" style={{ animationDelay: `${120 + index * 80}ms` }}>
      {to ? (
        <Link to={to} className={`${card} hover:-translate-y-0.5 hover:shadow-theme-md`}>
          {body}
        </Link>
      ) : (
        <div className={card}>{body}</div>
      )}
    </div>
  );
}

// Rupees to Rs Lacs, whole number. Undefined until the figures load.
const lacs = (rupees) => (rupees === undefined || rupees === null ? undefined : Math.round(Number(rupees) / 100000));

/** The four dealer money figures at the top of the Super Admin dashboard, in Rs Lacs. */
export default function StatCards({ money }) {
  const m = money || {};
  const total = Number(m.outstandingTotal) || 0;
  const share = total > 0 ? `${Math.round((Number(m.outstandingOver90) / total) * 100)}% of total outstanding` : 'Rs Lacs';
  const fy = m.financialYearStart ? `FY ${String(m.financialYearStart).slice(2)}-${String(m.financialYearStart + 1).slice(2)}` : '';
  const cards = [
    { label: 'Total Outstanding', value: lacs(m.outstandingTotal), note: 'Rs Lacs · all open items', icon: 'outstanding', tone: 'solid' },
    { label: 'Above 90 Days', value: lacs(m.outstandingOver90), note: m.outstandingTotal === undefined ? 'Rs Lacs' : `Rs Lacs · ${share}`, icon: 'ageing', tone: 'peach' },
    { label: 'Sales This FY', value: lacs(m.salesFy), note: `Rs Lacs · ${fy}`, icon: 'sales', tone: 'mint' },
    { label: 'Receipts This Month', value: lacs(m.receiptsMonth), note: `Rs Lacs · ${m.month ?? ''}`, icon: 'receipts', tone: 'mint' },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 md:gap-5">
      {cards.map((card, i) => (
        <StatCard key={card.label} {...card} index={i} />
      ))}
    </div>
  );
}
