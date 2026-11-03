import { useEffect, useMemo, useState } from 'react';
import { useLocation, useOutletContext } from 'react-router-dom';
import axiosClient from '../../../api/axiosClient';
import { useSimulator } from '../../../context/SimulatorContext.jsx';
import Button from '../../../components/common/Button.jsx';
import Select from '../../../components/common/Select.jsx';
import Alert from '../../../components/common/Alert.jsx';
import Badge from '../../../components/common/Badge.jsx';
import PageHeader from '../../../components/common/PageHeader.jsx';
import { LABEL, INPUT, INPUT_OK } from '../../../components/common/formStyles.js';

const USER_TYPES = [
  { value: 'DEALER', label: 'Dealer' },
  { value: 'VENDOR', label: 'Vendor' },
];

/**
 * Stage 1–4 of the Simulator (see docs/ARCHITECTURE.md "Simulator"): pick a
 * demo Dealer/Vendor, launch a simulated session, and land on the EXACT
 * same Dashboard component a real Dealer/Vendor sees (brief Section 23) —
 * this page never renders a copy of the portal UI itself, only the picker.
 */
export default function SimulatorDashboard() {
  const { simulatorEnabled } = useOutletContext();
  const { launchSimulator } = useSimulator();
  const location = useLocation();

  const [userType, setUserType] = useState('DEALER');
  const [users, setUsers] = useState([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [isLaunching, setIsLaunching] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!simulatorEnabled) return;
    let cancelled = false;
    setIsLoadingUsers(true);
    setSelectedUserId(null);
    setErrorMessage('');

    axiosClient
      .get('/admin/simulator/users', { params: { userType }, useRealToken: true })
      .then(({ data }) => {
        if (!cancelled) setUsers(data);
      })
      .catch(() => {
        if (!cancelled) setErrorMessage('Could not load the demo user list. Please try again.');
      })
      .finally(() => {
        if (!cancelled) setIsLoadingUsers(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userType, simulatorEnabled]);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) => u.companyName?.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.code?.toLowerCase().includes(q)
    );
  }, [users, search]);

  const selectedUser = users.find((u) => u.userId === selectedUserId) || null;

  async function handleLaunch() {
    if (!selectedUser) return;
    setIsLaunching(true);
    setErrorMessage('');
    try {
      await launchSimulator(selectedUser.userId);
    } catch (err) {
      setErrorMessage(err.response?.data?.message || 'Could not launch the Simulator. Please try again.');
      setIsLaunching(false);
    }
  }

  if (!simulatorEnabled) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-theme-sm text-gray-500">
        The Simulator is disabled in this environment (<code className="font-mono">ENABLE_SIMULATOR=false</code>).
        Enable it in <code className="font-mono">backend/.env</code> for local development/testing.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Portal Simulator" description="Test the Dealer/Vendor experience using different user profiles." />

      {location.state?.simulatorExpired && (
        <Alert variant="warning" className="mb-4">
          Your simulated session expired. Select a user below to relaunch.
        </Alert>
      )}

      {/* Quick access cards */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setUserType('DEALER')}
          className={`rounded-2xl border p-5 text-left transition-colors ${
            userType === 'DEALER' ? 'border-brand-300 bg-brand-50' : 'border-gray-200 bg-white hover:bg-gray-50'
          }`}
        >
          <p className="font-semibold text-gray-800">Dealer Simulator</p>
          <p className="mt-1 text-theme-sm text-gray-500">Test the portal as a Dealer.</p>
        </button>
        <button
          type="button"
          onClick={() => setUserType('VENDOR')}
          className={`rounded-2xl border p-5 text-left transition-colors ${
            userType === 'VENDOR' ? 'border-brand-300 bg-brand-50' : 'border-gray-200 bg-white hover:bg-gray-50'
          }`}
        >
          <p className="font-semibold text-gray-800">Vendor Simulator</p>
          <p className="mt-1 text-theme-sm text-gray-500">Test the portal as a Vendor.</p>
        </button>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select id="userType" label="User Type" value={userType} onChange={(e) => setUserType(e.target.value)}>
            {USER_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
          <div>
            <label className={LABEL} htmlFor="search">
              Select User
            </label>
            <input
              id="search"
              type="text"
              placeholder="Search by company name, email, or code…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`${INPUT} ${INPUT_OK}`}
            />
          </div>
        </div>

        <div className="custom-scrollbar mb-4 max-h-64 overflow-y-auto rounded-xl border border-gray-200">
          {isLoadingUsers && <p className="p-4 text-theme-sm text-gray-500">Loading…</p>}
          {!isLoadingUsers && filteredUsers.length === 0 && (
            <p className="p-4 text-theme-sm text-gray-500">No {userType.toLowerCase()} profiles found.</p>
          )}
          {!isLoadingUsers &&
            filteredUsers.map((u) => (
              <button
                type="button"
                key={u.userId}
                onClick={() => setSelectedUserId(u.userId)}
                className={`flex w-full items-center justify-between border-b border-gray-100 px-4 py-3 text-left text-theme-sm last:border-0 ${
                  selectedUserId === u.userId ? 'bg-brand-50 text-brand-500' : 'text-gray-800 hover:bg-gray-50'
                }`}
              >
                <span className="font-medium">{u.companyName || u.name}</span>
                <span className="text-theme-xs text-gray-500">{u.code}</span>
              </button>
            ))}
        </div>

        {selectedUser && (
          <dl className="mb-4 grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl bg-gray-50 p-4 text-theme-sm sm:grid-cols-4">
            <div>
              <dt className="text-theme-xs text-gray-500">User ID</dt>
              <dd className="truncate font-mono text-xs font-medium text-gray-800">{selectedUser.userId}</dd>
            </div>
            <div>
              <dt className="text-theme-xs text-gray-500">Email</dt>
              <dd className="font-medium text-gray-800">{selectedUser.email}</dd>
            </div>
            <div>
              <dt className="text-theme-xs text-gray-500">Company Name</dt>
              <dd className="font-medium text-gray-800">{selectedUser.companyName}</dd>
            </div>
            <div>
              <dt className="text-theme-xs text-gray-500">{userType === 'DEALER' ? 'Dealer ID' : 'Vendor ID'}</dt>
              <dd className="font-mono font-medium text-gray-800">{selectedUser.code || '—'}</dd>
            </div>
            <div className="col-span-2 sm:col-span-4">
              <dt className="text-theme-xs text-gray-500">Status</dt>
              <dd>
                <Badge color={selectedUser.status === 'ACTIVE' ? 'success' : 'error'}>{selectedUser.status}</Badge>
              </dd>
            </div>
          </dl>
        )}

        {errorMessage && (
          <Alert variant="error" className="mb-4">
            {errorMessage}
          </Alert>
        )}

        <Button onClick={handleLaunch} isLoading={isLaunching} disabled={!selectedUser}>
          Launch Simulator
        </Button>
      </div>
    </div>
  );
}
