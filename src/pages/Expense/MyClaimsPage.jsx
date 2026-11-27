import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ModulePage, { KpiStrip, StatusChip } from '../../components/ModulePage/ModulePage.jsx';
import EmptyState from '../../components/ModulePage/EmptyState.jsx';
import Alert from '../../components/common/Alert.jsx';
import Button from '../../components/common/Button.jsx';
import Modal from '../../components/common/Modal.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { expenseApi } from '../../api/expenseApi.js';
import { evaluateClaim, money, TYPES_BY_CARD, lineAmount, dailyAllowance } from '../../utils/expensePolicy.js';
import { TABLE_WRAPPER, TABLE, TABLE_HEAD, TH, TABLE_ROW, TD, TD_PRIMARY } from '../../components/common/tableStyles.js';
import { IssueList, ResultPill, RouteSteps, fmtDate } from './expenseUi.jsx';

const CARD_LABEL = { outstation: 'Outstation Travel', local: 'Local Conveyance', other: 'Other Expenses' };
const FILTERS = [
  { key: 'all', label: 'All', match: () => true },
  { key: 'Draft', label: 'Drafts', match: (c) => c.status === 'Draft' },
  { key: 'Pending', label: 'Pending', match: (c) => c.status === 'Pending' },
  { key: 'Returned', label: 'Returned', match: (c) => c.status === 'Returned' },
  { key: 'Passed', label: 'Passed / Paid', match: (c) => c.status === 'Passed' || c.status === 'Paid' },
  { key: 'Rejected', label: 'Rejected', match: (c) => c.status === 'Rejected' },
];

function ClaimDetail({ claim }) {
  const grade = claim.grade;
  const types = TYPES_BY_CARD[claim.card] ?? [];
  const live = claim.status === 'Draft' ? evaluateClaim(claim, { grade, travelRequests: expenseApi.listTravel(claim.userId ?? '') }) : null;
  const da = dailyAllowance(claim, grade);
  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 text-theme-sm sm:grid-cols-2">
        <p><span className="text-gray-500">Type:</span> {CARD_LABEL[claim.card]}</p>
        <p><span className="text-gray-500">Grade:</span> {grade}</p>
        {claim.card === 'outstation' ? (
          <>
            <p><span className="text-gray-500">Trip:</span> {claim.fromCity} to {claim.toCity}</p>
            <p><span className="text-gray-500">Dates:</span> {fmtDate(claim.departDate)} – {fmtDate(claim.returnDate)}</p>
          </>
        ) : (
          <p><span className="text-gray-500">Claim date:</span> {fmtDate(claim.claimDate)}</p>
        )}
        <p className="sm:col-span-2"><span className="text-gray-500">Purpose:</span> {claim.purpose}</p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-theme-sm">
          <thead className="bg-gray-50 text-left text-theme-xs uppercase text-gray-500">
            <tr><th className="px-3 py-2">Expense</th><th className="px-3 py-2">Date</th><th className="px-3 py-2">Bill</th><th className="px-3 py-2 text-right">Amount</th></tr>
          </thead>
          <tbody>
            {claim.lines.map((l, i) => (
              <tr key={i} className="border-t border-gray-100">
                <td className="px-3 py-2">{types.find((t) => t.key === l.type)?.label ?? l.type}{l.particulars ? <span className="block text-theme-xs text-gray-400">{l.particulars}</span> : null}</td>
                <td className="px-3 py-2 whitespace-nowrap">{fmtDate(l.date)}</td>
                <td className="px-3 py-2">{l.billName || '—'}</td>
                <td className="px-3 py-2 text-right">{money(lineAmount(l, grade))}</td>
              </tr>
            ))}
            {da > 0 && (
              <tr className="border-t border-gray-100"><td className="px-3 py-2">Daily allowance (calculated)</td><td className="px-3 py-2">—</td><td className="px-3 py-2">—</td><td className="px-3 py-2 text-right">{money(da)}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {claim.route && <div><p className="mb-2 text-theme-sm font-semibold text-gray-700">Approval route</p><RouteSteps route={claim.route} stage={claim.stage ?? 0} done={claim.status === 'Passed' || claim.status === 'Paid'} /></div>}
      {claim.late && <Alert variant="warning">This claim was submitted after the 72-hour window and is flagged Late.</Alert>}
      {live && <IssueList issues={live.issues} />}
      {claim.history?.length > 0 && (
        <ul className="text-theme-xs text-gray-500">
          {claim.history.map((h, i) => <li key={i}>{fmtDate(h.at)} · {h.action}{h.note ? ` · ${h.note}` : ''}</li>)}
        </ul>
      )}
    </div>
  );
}

export default function MyClaimsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [claims, setClaims] = useState(() => expenseApi.listClaims(user?.id));
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState(null);
  const [error, setError] = useState('');
  const notice = location.state?.notice;

  const shown = useMemo(() => {
    const f = FILTERS.find((x) => x.key === filter);
    const q = search.trim().toLowerCase();
    return claims.filter((c) => f.match(c) && (!q || `${c.number || ''} ${CARD_LABEL[c.card]} ${c.purpose}`.toLowerCase().includes(q)));
  }, [claims, filter, search]);
  const open = claims.find((c) => c.id === openId) ?? null;
  const count = (key) => claims.filter(FILTERS.find((f) => f.key === key).match).length;
  const pendingAmount = claims.filter((c) => c.status === 'Pending').reduce((s, c) => s + (c.total || 0), 0);

  const removeDraft = (id) => {
    try {
      expenseApi.deleteDraft(user.id, id);
      setClaims(expenseApi.listClaims(user.id));
      setOpenId(null);
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <ModulePage
      title="My Claims"
      description="Claims you have filed, and where each one is."
      live
      actions={[{ label: '+ New Claim', variant: 'primary', onClick: () => navigate('../new', { relative: 'path' }) }]}
    >
      {notice && <Alert variant="success">{notice}</Alert>}
      {error && <Alert variant="error">{error}</Alert>}
      <KpiStrip
        items={[
          { label: 'Drafts', value: String(count('Draft')), icon: 'documents', tone: 'brand' },
          { label: 'Pending', value: String(count('Pending')), icon: 'outstanding', tone: 'warning' },
          { label: 'Passed / Paid', value: String(count('Passed')), icon: 'auditLogs', tone: 'success' },
          { label: 'Amount pending (₹)', value: Math.round(pendingAmount).toLocaleString('en-IN'), icon: 'payments', tone: 'error' },
        ]}
      />
      <div className={TABLE_WRAPPER}>
        <div className="flex flex-col gap-3 px-5 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <button key={f.key} type="button" onClick={() => setFilter(f.key)}
                className={`rounded-full px-3.5 py-1.5 text-theme-sm font-medium transition-colors ${filter === f.key ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {f.label}
              </button>
            ))}
          </div>
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Claim number, type or purpose" aria-label="Search claims"
            className="h-10 w-full rounded-full border border-gray-200 bg-gray-50 px-4 text-theme-sm focus:border-brand-300 focus:bg-white focus:outline-none lg:w-80" />
        </div>
        <div className="custom-scrollbar overflow-x-auto">
          <table className={TABLE}>
            <thead className={TABLE_HEAD}>
              <tr>
                <th className={TH}>Claim No.</th><th className={TH}>Type</th><th className={TH}>Purpose</th><th className={TH}>Date</th>
                <th className={`${TH} text-right`}>Amount</th><th className={TH}>Policy result</th><th className={TH}>Status</th>
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 && (
                <tr><td colSpan={7} className="p-0"><EmptyState icon="documents" title={claims.length ? 'No claim matches' : 'No claims yet'} hint={claims.length ? 'Try another status or search.' : 'Use New Claim to raise your first one.'} /></td></tr>
              )}
              {shown.map((c) => (
                <tr key={c.id} className={`${TABLE_ROW} cursor-pointer`} onClick={() => setOpenId(c.id)}>
                  <td className={`${TD} ${TD_PRIMARY} whitespace-nowrap text-brand-600`}>{c.number || 'Draft'}</td>
                  <td className={TD}>{CARD_LABEL[c.card]}</td>
                  <td className={TD}><span className="block max-w-[260px] truncate" title={c.purpose}>{c.purpose || '—'}</span></td>
                  <td className={`${TD} whitespace-nowrap`}>{fmtDate(c.submittedAt || c.createdAt)}</td>
                  <td className={`${TD} whitespace-nowrap text-right font-semibold text-gray-800`}>{money(c.total)}</td>
                  <td className={TD}>{c.result ? <ResultPill result={c.result} /> : '—'}</td>
                  <td className={TD}><StatusChip status={c.status} />{c.late && <span className="ml-1.5 text-theme-xs text-warning-700">Late</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={Boolean(open)} size="xl" title={open ? open.number || 'Draft claim' : ''} subtitle={open ? CARD_LABEL[open.card] : ''} onClose={() => setOpenId(null)}>
        {open && (
          <>
            <ClaimDetail claim={{ ...open, userId: user?.id }} />
            {open.status === 'Draft' && (
              <div className="mt-5 flex justify-end gap-2 border-t border-gray-100 pt-4">
                <Button variant="secondary" onClick={() => removeDraft(open.id)}>Delete draft</Button>
                <Button onClick={() => navigate(`../new?draft=${open.id}`, { relative: 'path' })}>Continue editing</Button>
              </div>
            )}
          </>
        )}
      </Modal>
    </ModulePage>
  );
}
