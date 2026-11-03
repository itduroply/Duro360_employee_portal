import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { usersApi } from '../../api/usersApi';
import Alert from '../../components/common/Alert.jsx';
import WelcomeBanner from './WelcomeBanner.jsx';
import StatCards from './StatCards.jsx';
import LatestSchemes from './LatestSchemes.jsx';
import QuickAccess from './QuickAccess.jsx';
import RecentActivity from './RecentActivity.jsx';

const BASE = '/superadmin';

/**
 * Super Admin Console landing page: welcome banner, login figures, the
 * latest schemes, shortcuts and recent activity.
 *
 * The top cards are dealer money figures (manage-users, dealer_money_summary). Latest Schemes reads the
 * schemes table; Recent Activity shows sample audit rows until audit
 * logging is connected.
 */
export default function SuperAdminOverview() {
  const { user } = useAuth();
  const [money, setMoney] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    usersApi
      .dealerMoneySummary()
      .then(({ summary }) => !cancelled && setMoney(summary))
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Could not load the dealer figures.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-col gap-5 md:gap-6">
      {error && <Alert variant="error">{error}</Alert>}

      <WelcomeBanner name={user?.name} />

      <StatCards money={money} basePath={BASE} />

      <div className="grid grid-cols-1 gap-5 md:gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <LatestSchemes basePath={BASE} className="animate-fade-in-up [animation-delay:200ms]" />
        <div className="flex flex-col gap-5 md:gap-6">
          <QuickAccess basePath={BASE} className="animate-fade-in-up [animation-delay:250ms]" />
          <RecentActivity basePath={BASE} className="animate-fade-in-up [animation-delay:320ms]" />
        </div>
      </div>
    </div>
  );
}
