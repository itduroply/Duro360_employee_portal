import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ModulePage, { KpiStrip, StatusChip } from '../../components/ModulePage/ModulePage.jsx';
import EmptyState from '../../components/ModulePage/EmptyState.jsx';
import Alert from '../../components/common/Alert.jsx';
import Button from '../../components/common/Button.jsx';
import Modal from '../../components/common/Modal.jsx';
import Pagination from '../../components/common/Pagination.jsx';
import { SearchIcon } from '../../components/common/icons.jsx';
import { complaintsApi, COMPLAINT_STATUS_LABEL } from '../../api/complaintsApi';
import { useAuth } from '../../context/AuthContext.jsx';
import { formatCount, formatDate } from '../../utils/format.js';
import { TABLE_WRAPPER, TABLE, TABLE_HEAD, TH, TABLE_ROW, TD, TD_PRIMARY, TABLE_EMPTY, CHIP_LIGHT, CHIP_NEUTRAL } from '../../components/common/tableStyles.js';
import { ComplaintDetails, DecisionForm, canDecide } from './ComplaintApprovalsPanel.jsx';
import ComplaintGate, { useComplaintRights } from './ComplaintGate.jsx';

const EditComplaintModal = lazy(() => import('./EditComplaintModal.jsx'));

const PAGE_SIZE = 10;
const ORIGIN_LABEL = { DEALER: 'Dealer', END_CUSTOMER: 'End-Customer' };

// The status filter above the table. Older statuses still on file count as pending.
const FILTERS = [
  { key: 'all', label: 'All', statuses: [] },
  { key: 'pending', label: 'Pending', statuses: ['PENDING_MANAGER', 'PENDING_ACCOUNTS', 'REGISTERED', 'IN_REVIEW'] },
  { key: 'approved', label: 'Approved', statuses: ['APPROVED'] },
  { key: 'resolved', label: 'Resolved', statuses: ['RESOLVED'] },
  { key: 'rejected', label: 'Rejected', statuses: ['REJECTED'] },
];

function formatRupees(value) {
  return `₹${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

// Product lines as one short cell: first item, then "+2 more".
function linesSummary(lines) {
  if (!Array.isArray(lines) || lines.length === 0) return '—';
  const first = lines[0].item_name || lines[0].brand || 'Item';
  return lines.length > 1 ? `${first} +${lines.length - 1} more` : first;
}

// Where a complaint stands, shown under its status pill.
function stageNote(c) {
  if (c.status === 'PENDING_MANAGER') return `With ${c.current_approver_name || 'the reporting manager'}`;
  if (c.status === 'PENDING_ACCOUNTS') return 'With the accounts team';
  if (c.status === 'REJECTED' && c.rejection_reason) return c.rejection_reason;
  return '';
}

// Shown once after a complaint is filed: its number and where it went.
function FiledBanner({ filed, onAnother, onClose }) {
  return (
    <div className="flex animate-fade-in-up flex-col gap-4 overflow-hidden rounded-2xl border border-success-200 bg-gradient-to-r from-success-50 to-white p-5 sm:flex-row sm:items-center sm:p-6">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-success-500 text-white shadow-theme-sm">
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-base font-semibold text-gray-800">Complaint {filed.complaintNo} registered</p>
        <p className="mt-0.5 text-theme-sm text-gray-600">{filed.message}</p>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button variant="secondary" size="sm" onClick={onClose}>Close</Button>
        <Button size="sm" onClick={onAnother}>File another</Button>
      </div>
    </div>
  );
}

// The filer may edit until the first approver decides. A complaint waiting on
// the manager has no decision yet; one sent straight to accounts has no manager
// level. The database checks this again when the edit is saved.
function filerCanEdit(c, user) {
  if (!user || c.filed_by !== user.id) return false;
  return c.status === 'PENDING_MANAGER' || (c.status === 'PENDING_ACCOUNTS' && c.manager_level == null);
}

function ComplaintHistory() {
  const { user } = useAuth();
  const { access, rights, refresh } = useComplaintRights();
  const navigate = useNavigate();
  const location = useLocation();

  const [filed, setFiled] = useState(location.state?.filed ?? null);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState(null);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState('all');
  const [searchText, setSearchText] = useState('');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [decisionNotice, setDecisionNotice] = useState('');
  const [editRow, setEditRow] = useState(null);
  const open = rows.find((c) => c.id === selectedId) ?? null;

  // The "just filed" note is read once, so a page refresh does not show it again.
  useEffect(() => {
    if (location.state?.filed) navigate(location.pathname, { replace: true, state: null });
  }, [location.state, location.pathname, navigate]);

  // Search waits for a short pause in typing.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchText.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchText]);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const statuses = FILTERS.find((f) => f.key === filter)?.statuses ?? [];
      const [list, statusCounts] = await Promise.all([
        complaintsApi.list({ page, pageSize: PAGE_SIZE, statuses, search }),
        complaintsApi.counts(),
      ]);
      setRows(list.rows);
      setTotal(list.total);
      setCounts(statusCounts);
      setError('');
    } catch (err) {
      setError(err.message || 'Could not load complaints.');
    } finally {
      setIsLoading(false);
    }
  }, [page, filter, search]);

  useEffect(() => {
    load();
  }, [load]);

  const countOf = (key) => {
    if (!counts) return undefined;
    const statuses = FILTERS.find((f) => f.key === key).statuses;
    return (statuses.length ? statuses : Object.keys(counts)).reduce((n, s) => n + (counts[s] || 0), 0);
  };
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, total);
  const isFiltered = filter !== 'all' || search !== '';

  return (
    <ModulePage
      title="Complaint History"
      live
      actions={rights.canFile ? [{ label: '+ Register Complaint', variant: 'primary', onClick: () => navigate('../new', { relative: 'path' }) }] : []}
    >
      {filed && (
        <FiledBanner filed={filed} onClose={() => setFiled(null)} onAnother={() => navigate('../new', { relative: 'path' })} />
      )}
      {error && <Alert variant="error">{error}</Alert>}
      {decisionNotice && <Alert variant="success">{decisionNotice}</Alert>}

      <KpiStrip
        items={[
          { label: 'Pending approval', value: countOf('pending') !== undefined ? formatCount(countOf('pending')) : undefined, icon: 'outstanding', tone: 'warning' },
          { label: 'Approved', value: countOf('approved') !== undefined ? formatCount(countOf('approved')) : undefined, icon: 'complaints', tone: 'brand' },
          { label: 'Resolved', value: countOf('resolved') !== undefined ? formatCount(countOf('resolved')) : undefined, icon: 'auditLogs', tone: 'success' },
          { label: 'Rejected', value: countOf('rejected') !== undefined ? formatCount(countOf('rejected')) : undefined, icon: 'queries', tone: 'error' },
        ]}
      />

      <div className={TABLE_WRAPPER}>
        <div className="flex flex-col gap-4 px-5 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter by status">
            {FILTERS.map((f) => {
              const active = filter === f.key;
              const n = countOf(f.key);
              return (
                <button
                  key={f.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => (setFilter(f.key), setPage(1))}
                  className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-theme-sm font-medium transition-colors ${
                    active ? 'bg-brand-500 text-white shadow-theme-xs' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-800'
                  }`}
                >
                  {f.label}
                  {n !== undefined && (
                    <span className={`rounded-full px-1.5 text-[11px] font-semibold leading-[18px] ${active ? 'bg-white/25 text-white' : 'bg-white text-gray-600'}`}>
                      {formatCount(n)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="relative w-full lg:w-80">
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-gray-400">
              <SearchIcon />
            </span>
            <input
              type="search"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Complaint no., dealer or invoice"
              aria-label="Search complaints"
              className="h-10 w-full rounded-full border border-gray-200 bg-gray-50 pl-11 pr-4 text-theme-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-300 focus:bg-white focus:outline-none focus:ring-3 focus:ring-brand-500/10"
            />
          </div>
        </div>

        <div className="custom-scrollbar overflow-x-auto">
          <table className={TABLE}>
            <thead className={TABLE_HEAD}>
              <tr>
                <th className={TH}>Complaint No.</th>
                <th className={TH}>Filed On</th>
                <th className={TH}>Origin</th>
                <th className={TH}>Dealer</th>
                <th className={TH}>Invoice</th>
                <th className={TH}>Products</th>
                <th className={`${TH} text-right`}>Amount</th>
                <th className={TH}>Filed By</th>
                <th className={TH}>Status</th>
                <th className={`${TH} text-right`}>Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={10} className={TABLE_EMPTY}>Loading complaints…</td>
                </tr>
              )}
              {!isLoading && rows.length === 0 && (
                <tr>
                  <td colSpan={10} className="p-0">
                    {isFiltered ? (
                      <EmptyState icon="complaints" title="No complaint matches" hint="Try another status or search." />
                    ) : (
                      <EmptyState icon="complaints" title="No complaints yet" hint="Use Register Complaint to register the first one." />
                    )}
                  </td>
                </tr>
              )}
              {!isLoading &&
                rows.map((c) => (
                  <tr key={c.id} className={`${TABLE_ROW} cursor-pointer`} onClick={() => setSelectedId(c.id)}>
                    <td className={`${TD} ${TD_PRIMARY} whitespace-nowrap`}>
                      <span className="text-brand-600">{c.complaint_no}</span>
                    </td>
                    <td className={`${TD} whitespace-nowrap`}>{formatDate(c.created_at)}</td>
                    <td className={TD}>
                      <span className={c.origin === 'DEALER' ? CHIP_NEUTRAL : CHIP_LIGHT}>{ORIGIN_LABEL[c.origin]}</span>
                    </td>
                    <td className={TD}>
                      <span className="block max-w-[220px] truncate font-medium text-gray-700" title={c.dealer_name}>{c.dealer_name}</span>
                      <span className="block text-theme-xs text-gray-400">
                        {c.dealer_code}
                        {c.origin === 'END_CUSTOMER' && c.customer_name ? ` · ${c.customer_name}` : ''}
                      </span>
                    </td>
                    <td className={`${TD} whitespace-nowrap`}>{c.invoice_no}</td>
                    <td className={TD}>
                      <span className="block max-w-[200px] truncate" title={linesSummary(c.lines)}>{linesSummary(c.lines)}</span>
                    </td>
                    <td className={`${TD} whitespace-nowrap text-right font-semibold text-gray-800`}>{formatRupees(c.amount)}</td>
                    <td className={`${TD} whitespace-nowrap`}>{c.filed_by_name || '—'}</td>
                    <td className={TD}>
                      <StatusChip status={COMPLAINT_STATUS_LABEL[c.status] || c.status} />
                      {stageNote(c) && (
                        <span className="mt-1 block max-w-[240px] truncate text-theme-xs text-gray-500" title={stageNote(c)}>{stageNote(c)}</span>
                      )}
                    </td>
                    <td className={`${TD} whitespace-nowrap text-right`}>
                      {filerCanEdit(c, user) && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditRow(c);
                          }}
                        >
                          Edit
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {!isLoading && total > 0 && (
          <div className="flex flex-col items-center justify-between gap-3 border-t border-gray-100 px-5 py-4 sm:flex-row sm:px-6">
            <p className="text-theme-sm text-gray-500">
              Showing <span className="font-medium text-gray-800">{rangeStart}</span>–
              <span className="font-medium text-gray-800">{rangeEnd}</span> of{' '}
              <span className="font-medium text-gray-800">{formatCount(total)}</span> complaints
            </p>
            <Pagination page={page} pageCount={pageCount} onChange={setPage} />
          </div>
        )}
      </div>

      {editRow && (
        <Suspense fallback={null}>
          <EditComplaintModal
            complaint={editRow}
            onClose={() => setEditRow(null)}
            onSaved={(result) => {
              setEditRow(null);
              setDecisionNotice(
                !result?.changed
                  ? 'Nothing changed.'
                  : result.rerouted
                    ? `Complaint ${result.complaintNo} updated. It now goes to ${result.waitingOn || 'a different approver'} for approval.`
                    : `Complaint ${result.complaintNo} updated.`
              );
              // A new approver has not heard of this complaint yet: mail them (best effort).
              if (result?.rerouted) complaintsApi.notifyFiled(result.complaintNo).catch(() => {});
              load();
              refresh();
            }}
          />
        </Suspense>
      )}

      <Modal open={Boolean(open)} size="xl" title={open ? open.dealer_name : ''} subtitle={open ? `Complaint ${open.complaint_no}` : ''} onClose={() => setSelectedId(null)}>
        {open && (
          <>
            <ComplaintDetails complaint={open} onChanged={() => (load(), refresh())} />
            {canDecide(open, user, access) && (
              <DecisionForm
                complaint={open}
                onDone={(result) => {
                  setDecisionNotice(result.emailError ? `${result.message} (Email not sent: ${result.emailError})` : result.message);
                  setSelectedId(null);
                  load();
                  refresh();
                }}
              />
            )}
          </>
        )}
      </Modal>
    </ModulePage>
  );
}

export default function ComplaintHistoryPage() {
  return (
    <ComplaintGate need="file">
      <ComplaintHistory />
    </ComplaintGate>
  );
}
