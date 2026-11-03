import { useCallback, useEffect, useState } from 'react';
import ModulePage, { KpiStrip, StatusChip } from '../../components/ModulePage/ModulePage.jsx';
import EmptyState from '../../components/ModulePage/EmptyState.jsx';
import Alert from '../../components/common/Alert.jsx';
import Pagination from '../../components/common/Pagination.jsx';
import { complaintsApi } from '../../api/complaintsApi';
import { formatCount, formatDate } from '../../utils/format.js';
import { TABLE_WRAPPER, TABLE, TABLE_HEAD, TH, TABLE_ROW, TD, TD_PRIMARY, TABLE_EMPTY, CHIP_LIGHT, CHIP_NEUTRAL,
} from '../../components/common/tableStyles.js';
import FileComplaintModal from './FileComplaintModal.jsx';

const PAGE_SIZE = 10;

const STATUS_LABEL = { REGISTERED: 'Registered', IN_REVIEW: 'In Review', RESOLVED: 'Resolved', REJECTED: 'Rejected' };
const ORIGIN_LABEL = { DEALER: 'Dealer', END_CUSTOMER: 'End-Customer' };

function formatRupees(value) {
  return `₹${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

// Product lines as one short cell: first item, then "+2 more".
function linesSummary(lines) {
  if (!Array.isArray(lines) || lines.length === 0) return '—';
  const first = lines[0].item_name || lines[0].brand || 'Item';
  return lines.length > 1 ? `${first} +${lines.length - 1} more` : first;
}

export default function ComplaintsPage() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState(null);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async (pageNumber) => {
    setIsLoading(true);
    try {
      const [list, statusCounts] = await Promise.all([
        complaintsApi.list({ page: pageNumber, pageSize: PAGE_SIZE }),
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
  }, []);

  useEffect(() => {
    load(page);
  }, [load, page]);

  function handleFiled(complaintNo) {
    setShowForm(false);
    setNotice(`Complaint ${complaintNo} registered.`);
    // The newest complaint is on page 1.
    if (page === 1) load(1);
    else setPage(1);
  }

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, total);
  const count = (key) => (counts ? formatCount(counts[key]) : undefined);

  return (
    <ModulePage
      title="Complaints"
      description="File complaints and follow their history."
      live
      actions={[{ label: 'File Complaint', variant: 'primary', onClick: () => (setNotice(''), setShowForm(true)) }]}
    >
      {error && <Alert variant="error">{error}</Alert>}
      {notice && <Alert variant="success">{notice}</Alert>}

      <KpiStrip
        items={[
          { label: 'Registered', value: count('REGISTERED'), icon: 'complaints', tone: 'brand' },
          { label: 'In Review', value: count('IN_REVIEW'), icon: 'outstanding', tone: 'warning' },
          { label: 'Resolved', value: count('RESOLVED'), icon: 'auditLogs', tone: 'success' },
          { label: 'Rejected', value: count('REJECTED'), icon: 'queries', tone: 'error' },
        ]}
      />

      <div className={TABLE_WRAPPER}>
        <div className="flex items-center justify-between gap-3 px-5 py-4 sm:px-6">
          <div>
            <h3 className="text-base font-semibold text-gray-800">Complaint History</h3>
            {/* <p className="text-theme-xs text-gray-500">Newest first, {PAGE_SIZE} per page.</p> */}
          </div>
          {total > 0 && <span className={CHIP_LIGHT}>{formatCount(total)} total</span>}
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
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={9} className={TABLE_EMPTY}>
                    Loading complaints…
                  </td>
                </tr>
              )}
              {!isLoading && rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-0">
                    <EmptyState
                      icon="complaints"
                      title="No complaints yet"
                      hint="Use File Complaint to register the first one."
                    />
                  </td>
                </tr>
              )}
              {!isLoading &&
                rows.map((c) => (
                  <tr key={c.id} className={TABLE_ROW}>
                    <td className={`${TD} ${TD_PRIMARY} whitespace-nowrap`}>{c.complaint_no}</td>
                    <td className={`${TD} whitespace-nowrap`}>{formatDate(c.created_at)}</td>
                    <td className={TD}>
                      <span className={c.origin === 'DEALER' ? CHIP_NEUTRAL : CHIP_LIGHT}>{ORIGIN_LABEL[c.origin]}</span>
                    </td>
                    <td className={TD}>
                      <span className="block max-w-[220px] truncate" title={c.dealer_name}>{c.dealer_name}</span>
                      <span className="block text-theme-xs text-gray-400">
                        {c.dealer_code}
                        {c.origin === 'END_CUSTOMER' && c.customer_name ? ` · ${c.customer_name}` : ''}
                      </span>
                    </td>
                    <td className={`${TD} whitespace-nowrap`}>{c.invoice_no}</td>
                    <td className={TD}>
                      <span className="block max-w-[200px] truncate" title={linesSummary(c.lines)}>{linesSummary(c.lines)}</span>
                    </td>
                    <td className={`${TD} whitespace-nowrap text-right font-medium text-gray-800`}>{formatRupees(c.amount)}</td>
                    <td className={`${TD} whitespace-nowrap`}>{c.filed_by_name || '—'}</td>
                    <td className={TD}>
                      <StatusChip status={STATUS_LABEL[c.status] || c.status} />
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

      <FileComplaintModal open={showForm} onClose={() => setShowForm(false)} onFiled={handleFiled} />
    </ModulePage>
  );
}
