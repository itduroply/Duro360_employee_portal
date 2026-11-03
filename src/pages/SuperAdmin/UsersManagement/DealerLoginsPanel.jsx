import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { usersApi } from '../../../api/usersApi';
import Alert from '../../../components/common/Alert.jsx';
import { SearchIcon } from '../../../components/common/icons.jsx';
import { INPUT, INPUT_OK } from '../../../components/common/formStyles.js';
import {
  TABLE_WRAPPER, TABLE, TABLE_HEAD, TH, TABLE_ROW, TD, TD_PRIMARY, TABLE_EMPTY, CHIP_ACTIVE, CHIP_INACTIVE,
} from '../../../components/common/tableStyles.js';

/**
 * Login access for Dealer accounts: see who has a login and turn it on or
 * off. New Dealer logins are still created on the Dealers page
 * (pages/Dealers/DealersDirectory.jsx), next to the Dealer master data.
 */
export default function DealerLoginsPanel() {
  const [dealers, setDealers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  async function loadDealers() {
    setIsLoading(true);
    setError('');
    try {
      const { users } = await usersApi.listDealers();
      setDealers(users);
    } catch (err) {
      setError(err.message || 'Could not load Dealer logins.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadDealers();
  }, []);

  const visibleDealers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return dealers;
    return dealers.filter((d) => [d.dealer_code, d.name, d.mobile_number].some((v) => v?.toLowerCase().includes(q)));
  }, [dealers, search]);

  async function toggleStatus(dealer) {
    const nextStatus = dealer.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await usersApi.updateStatus(dealer.id, nextStatus);
      await loadDealers();
    } catch (err) {
      setError(err.message || 'Could not update status.');
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-theme-sm text-gray-500">
          To add a Dealer login, go to{' '}
          <Link to="/superadmin/dealers" className="font-medium text-brand-500 hover:text-brand-600">
            Dealers
          </Link>
          .
        </p>
        <div className="relative w-full sm:w-64">
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-gray-500">
            <SearchIcon />
          </span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search code, name or mobile"
            className={`${INPUT} ${INPUT_OK} pl-11`}
          />
        </div>
      </div>

      {error && (
        <Alert variant="error" className="mb-4">
          {error}
        </Alert>
      )}

      <div className={TABLE_WRAPPER}>
        <div className="custom-scrollbar overflow-x-auto">
          <table className={TABLE}>
            <thead className={TABLE_HEAD}>
              <tr>
                <th className={TH}>Code</th>
                <th className={TH}>Name</th>
                <th className={TH}>Mobile</th>
                <th className={TH}>Status</th>
                <th className={TH}>Created</th>
                <th className={TH} />
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={6} className={TABLE_EMPTY}>
                    Loading…
                  </td>
                </tr>
              )}
              {!isLoading && visibleDealers.length === 0 && (
                <tr>
                  <td colSpan={6} className={TABLE_EMPTY}>
                    {dealers.length === 0 ? 'No Dealer logins yet.' : 'No Dealer logins match this search.'}
                  </td>
                </tr>
              )}
              {!isLoading &&
                visibleDealers.map((dealer) => (
                  <tr key={dealer.id} className={TABLE_ROW}>
                    {/* Logins created before Dealer Code sign-in have no code;
                        show their email so they can still be identified. */}
                    <td className={`${TD} whitespace-nowrap`}>{dealer.dealer_code || dealer.email}</td>
                    <td className={`${TD} ${TD_PRIMARY}`}>{dealer.name}</td>
                    <td className={TD}>{dealer.mobile_number || '—'}</td>
                    <td className={TD}>
                      <span className={dealer.status === 'ACTIVE' ? CHIP_ACTIVE : CHIP_INACTIVE}>{dealer.status}</span>
                    </td>
                    <td className={TD}>{new Date(dealer.created_at).toLocaleDateString('en-IN')}</td>
                    <td className={`${TD} text-right`}>
                      <button
                        type="button"
                        onClick={() => toggleStatus(dealer)}
                        className="text-theme-sm font-medium text-gray-500 hover:text-gray-700"
                      >
                        {dealer.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
