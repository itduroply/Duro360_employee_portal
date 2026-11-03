import { useAuth } from '../../context/AuthContext.jsx';
import { useSimulator } from '../../context/SimulatorContext.jsx';
import Button from '../../components/common/Button.jsx';
import SimulatorBanner from '../../components/common/SimulatorBanner.jsx';

export default function Dashboard() {
  const { user: realUser, logout } = useAuth();
  const { simulatedUser, isSimulating, exitSimulator } = useSimulator();

  const effectiveUser = isSimulating ? simulatedUser : realUser;

  async function handleLogout() {
    if (isSimulating) {
      await exitSimulator({ redirect: false });
    }
    await logout();
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <SimulatorBanner />
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 sm:px-6 lg:py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-500 text-sm font-bold text-white">
            D
          </div>
          <span className="font-semibold text-gray-800">DUROPLY Dealer</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden text-theme-sm font-medium text-gray-700 sm:block">{effectiveUser?.name}</span>
          <Button variant="secondary" onClick={handleLogout}>
            Logout
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl p-4 md:p-6">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center sm:p-8">
          <h1 className="mb-2 text-xl font-semibold text-gray-800">Welcome, {effectiveUser?.name}</h1>
          <p className="mb-1 text-theme-sm text-gray-500">
            Logged in as <span className="font-medium text-gray-800">{effectiveUser?.userType}</span>
            {effectiveUser?.dealerCode && ` (Dealer ${effectiveUser.dealerCode})`}
            {effectiveUser?.vendorId && ' (Vendor)'}
          </p>
          <p className="text-theme-sm text-gray-500">
            This is a Phase 2 placeholder confirming your session, role, and identity were verified by the
            backend. The full dashboard — order/invoice/payment/outstanding cards and trend charts — arrives in
            Phase 4.
          </p>
          {isSimulating && (
            <p className="mt-4 text-theme-xs text-warning-600">
              This is the same Dashboard component real Dealers/Vendors see — only the identity behind the API
              calls has been swapped for testing (Simulator Mode).
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
