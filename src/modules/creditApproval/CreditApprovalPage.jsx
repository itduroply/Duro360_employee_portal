import { useEffect, useState } from 'react';
import PageHeader from '../../components/common/PageHeader.jsx';
import TabBar from '../../components/ModulePage/TabBar.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { theme } from '../../theme/themes.js';
import { CREDIT_ROLES } from './lib/format.js';
import { creditApi } from './api/creditApi.js';
import ApproverPanel from './ApproverPanel.jsx';
import CreditUsersPanel from './CreditUsersPanel.jsx';
import EdpPanel from './EdpPanel.jsx';
import PermanentApproversPanel from './PermanentApproversPanel.jsx';
import RequesterPanel from './RequesterPanel.jsx';

// What each credit role sees. Credit Users is added for a Super Admin.
const ROLE_TABS = {
  requester: ['All Requests', 'Add Request'],
  approver: ['Inbox', 'History'],
  edp: ['All Requests'],
};
const USERS_TAB = 'Credit Users';

// Dealer Unlocking: credit approval for dealers. Requester, Approver and EDP
// each get their own tabs. The role comes from the person's credit approval
// record. The rules behind every action live in the credit Edge Functions.
export default function CreditApprovalPage() {
  const { user } = useAuth();
  const isSuperAdmin = Boolean(user?.roles?.includes('SUPERADMIN'));

  const [role, setRole] = useState(null);
  const [loadingRole, setLoadingRole] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('');
  const [userRole, setUserRole] = useState(CREDIT_ROLES[0]);

  useEffect(() => {
    let cancelled = false;
    creditApi
      .getUserRole()
      .then(({ role: r }) => {
        if (cancelled) return;
        setRole(r);
        setTab(ROLE_TABS[r]?.[0] ?? USERS_TAB);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message || 'Could not find your credit approval role.');
        setTab(USERS_TAB);
      })
      .finally(() => !cancelled && setLoadingRole(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const tabs = [...(ROLE_TABS[role] ?? []), ...(isSuperAdmin ? [USERS_TAB] : [])];

  let body = null;
  if (tab === USERS_TAB && isSuperAdmin) body = (
    <>
      <div className="mb-5">
        <p className="mb-2 text-theme-xs font-semibold uppercase tracking-wide text-gray-500">Add and manage</p>
        <TabBar tabs={CREDIT_ROLES} active={userRole} onChange={setUserRole} />
      </div>
      {userRole === 'Approver' && <PermanentApproversPanel />}
      <CreditUsersPanel key={userRole} role={userRole} />
    </>
  );
  else if (role === 'requester') body = <RequesterPanel tab={tab} onTab={setTab} />;
  else if (role === 'approver') body = <ApproverPanel tab={tab} />;
  else if (role === 'edp') body = <EdpPanel />;

  return (
    <div className={theme.ui.pageCard}>
      <PageHeader title="Dealer Unlocking" description="Credit limit requests for dealers, from request to approval." />

      {loadingRole && <p className="text-theme-sm text-gray-500">Loading…</p>}

      {!loadingRole && error && !role && (
        <div className="mb-5 rounded-xl border border-warning-300 bg-warning-50 p-4 text-sm text-gray-700">
          {isSuperAdmin
            ? 'You have no credit approval role yourself. You can still add and manage employees under Credit Users.'
            : `${error} Ask the administrator to add you to credit approval.`}
        </div>
      )}

      {tabs.length > 0 && (
        <div className="mb-5">
          <TabBar tabs={tabs} active={tab} onChange={setTab} />
        </div>
      )}

      {body}
    </div>
  );
}
