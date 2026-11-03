import CultureCarousel from './CultureCarousel.jsx';
import LatestSchemes from './LatestSchemes.jsx';
import QuickAccess from './QuickAccess.jsx';
import RecentActivity from './RecentActivity.jsx';

const BASE = '/superadmin';

/**
 * Super Admin Console landing page: the culture banner carousel, then the
 * latest schemes, shortcuts and recent activity behind a Coming soon board.
 *
 * The dealer money cards (StatCards, dealer_money_summary) are parked until
 * the figures are ready. Latest Schemes reads the schemes table; Recent
 * Activity shows sample audit rows until audit logging is connected.
 */
export default function SuperAdminOverview() {
  return (
    <div className="flex flex-col gap-5 md:gap-6">
      <CultureCarousel />

      {/* Schemes, shortcuts and activity are parked behind a Coming soon board. */}
      <div className="relative">
        <div
          className="pointer-events-none grid select-none grid-cols-1 gap-5 opacity-70 blur-[7px] md:gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]"
          aria-hidden="true"
          inert=""
        >
          <LatestSchemes basePath={BASE} className="animate-fade-in-up [animation-delay:200ms]" />
          <div className="flex flex-col gap-5 md:gap-6">
            <QuickAccess basePath={BASE} className="animate-fade-in-up [animation-delay:250ms]" />
            <RecentActivity basePath={BASE} className="animate-fade-in-up [animation-delay:320ms]" />
          </div>
        </div>
        <div className="absolute inset-0 flex items-start justify-center pt-24 md:pt-32">
          <div className="animate-zoom-in rounded-3xl border border-brand-200 bg-white/95 px-10 py-7 text-center shadow-theme-md">
            <p className="font-['Jost'] text-3xl font-extrabold text-brand-500 sm:text-4xl">Coming Soon</p>
            <p className="mt-1.5 text-theme-sm text-gray-600">This section is being built. It will open here shortly.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
