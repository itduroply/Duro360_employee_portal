import { useSimulator } from '../../context/SimulatorContext.jsx';

/**
 * Renders nothing outside Simulator Mode. Deliberately loud/high-contrast
 * (amber, not the app's normal brand color) so it can never be mistaken for
 * a real session — brief Section 5 ("must make it impossible to confuse
 * Simulator Mode with a real user session").
 */
export default function SimulatorBanner() {
  const { simulatedUser, isSimulating, exitSimulator } = useSimulator();

  if (!isSimulating) return null;

  const idLabel = simulatedUser?.userType === 'VENDOR' ? 'Vendor ID' : 'Dealer ID';

  return (
    <div className="border-b border-warning-300 bg-warning-50">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-warning-500 px-2.5 py-0.5 text-theme-xs font-semibold uppercase tracking-wide text-white">
            Simulator Mode
          </span>
          <span className="text-theme-sm text-gray-700">
            You are currently viewing the portal as{' '}
            <span className="font-semibold">{simulatedUser?.companyName || simulatedUser?.name}</span>
            {simulatedUser?.code && (
              <>
                {' '}
                &middot; {idLabel}: <span className="font-mono">{simulatedUser.code}</span>
              </>
            )}
            {' '}
            &middot; {simulatedUser?.email}
          </span>
        </div>
        <button
          type="button"
          onClick={() => exitSimulator()}
          className="rounded-lg border border-warning-500 bg-white px-3.5 py-2 text-theme-xs font-medium text-warning-700 shadow-theme-xs hover:bg-warning-100"
        >
          Exit Simulator
        </button>
      </div>
    </div>
  );
}
