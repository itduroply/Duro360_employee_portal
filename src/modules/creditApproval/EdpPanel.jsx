import { useCallback, useMemo, useState } from 'react';
import Alert from '../../components/common/Alert.jsx';
import Button from '../../components/common/Button.jsx';
import Modal from '../../components/common/Modal.jsx';
import DataTable from '../../components/ModulePage/DataTable.jsx';
import { creditApi } from './api/creditApi.js';
import { formatDateTime, rupees } from './lib/format.js';
import { AttachmentLinks, RequestDetails, StatusPill, TextArea, TypePill, useList } from './components.jsx';

const EVENT_LABEL = { sent: 'Sent', query: 'Query', reply: 'Reply', firstApproved: 'Level approval', approved: 'Approved', rejected: 'Rejected', closed: 'Closed' };
const EVENT_TONE = {
  firstApproved: 'border-success-200 bg-success-50',
  approved: 'border-success-200 bg-success-50',
  rejected: 'border-error-200 bg-error-50',
  closed: 'border-gray-300 bg-gray-100',
};

// Who raised, who approved and who closed, in one place.
function People({ request }) {
  const items = [
    ['Req initiated', request.requesterName, request.sentAt],
    ['Approved by', request.approvedByName, request.approvedAt],
    ['Closed by', request.closedByName, request.closedAt],
  ];
  return (
    <div className="mb-5 grid grid-cols-1 gap-3 rounded-2xl border border-gray-200 bg-gray-50/60 p-4 sm:grid-cols-3">
      {items.map(([label, name, at]) => (
        <div key={label}>
          <p className="text-theme-xs text-gray-500">{label}</p>
          <p className="mt-0.5 text-theme-sm font-medium text-gray-800">{name || '—'}</p>
          {name && at && <p className="text-theme-xs text-gray-500">{formatDateTime(at)}</p>}
        </div>
      ))}
    </div>
  );
}

// EDP closes an approved request from the table row. Close opens a small box
// that asks for the remark, which is optional.
function CloseCell({ request, onClosed }) {
  const [open, setOpen] = useState(false);
  const [remark, setRemark] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (request.status !== 'Approved') return <span className="text-gray-400">—</span>;

  function dismiss() {
    if (busy) return;
    setOpen(false);
    setRemark('');
    setError('');
  }

  async function confirm() {
    setBusy(true);
    setError('');
    try {
      const result = await creditApi.closeRequisition(request.id, remark);
      setOpen(false);
      setRemark('');
      onClosed(result.message);
    } catch (err) {
      setError(err.message || 'This request could not be closed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        Close
      </Button>
      <Modal
        open={open}
        title="Close request"
        subtitle={`${request.dealerName} · ${request.ref}`}
        onClose={dismiss}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={dismiss} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={confirm} isLoading={busy}>
              Close request
            </Button>
          </div>
        }
      >
        <TextArea id={`cr-close-remark-${request.id}`} label="Remark (optional)" value={remark} onChange={(e) => { setRemark(e.target.value); setError(''); }} error={error} placeholder="Add a remark if needed." />
      </Modal>
    </>
  );
}

// A small line under the status pill: plain text with a tick or dot, not a
// second pill, so the status column stays calm.
const NOTE_TONE = { neutral: 'text-gray-500', success: 'text-success-700', warning: 'text-warning-700' };
function StatusNote({ children, tone = 'neutral' }) {
  return (
    <span className={`inline-flex items-center gap-1 text-theme-xs font-medium ${NOTE_TONE[tone]}`}>
      {tone === 'success' ? (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      )}
      {children}
    </span>
  );
}

// Opens the full request. The tooltip says what the icon does.
function ExpandButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="View full details"
      aria-label="View full details"
      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 transition-colors hover:bg-brand-500 hover:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/30"
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="15 3 21 3 21 9" />
        <polyline points="9 21 3 21 3 15" />
        <line x1="21" y1="3" x2="14" y2="10" />
        <line x1="3" y1="21" x2="10" y2="14" />
      </svg>
    </button>
  );
}

// One request: everything the Requester entered, who approved it, and the
// timeline from sent to close.
function Detail({ request }) {
  const loader = useCallback(() => creditApi.getEdpRequisitionThread(request.id), [request.id]);
  const { data, error, loading } = useList(loader);

  if (error) return <Alert variant="error">{error}</Alert>;
  if (loading || !data) return <p className="text-theme-sm text-gray-500">Loading…</p>;
  const summary = { ...data.requisition, ref: request.ref };

  return (
    <div>
      <People request={summary} />
      <RequestDetails request={summary} />

      <h4 className="mb-2.5 mt-6 text-theme-xs font-semibold uppercase tracking-[0.08em] text-gray-500">Timeline</h4>
      <ol className="flex flex-col gap-2.5">
        {data.events.map((e) => (
          <li key={e.id} className={`rounded-xl border px-4 py-3 text-theme-sm ${EVENT_TONE[e.kind] || 'border-gray-200 bg-white'}`}>
            <p className="font-medium text-gray-800">
              {EVENT_LABEL[e.kind] || e.kind} · {e.by}
              {e.to ? ` to ${e.to}` : ''}
            </p>
            <p className="text-theme-xs text-gray-500">{formatDateTime(e.at)}</p>
            {e.text && <p className="mt-1 whitespace-pre-wrap text-gray-700">{e.text}</p>}
            <AttachmentLinks files={e.attachments} />
          </li>
        ))}
      </ol>
    </div>
  );
}

// EDP sees every request. It cannot change one, except to close it after approval.
export default function EdpPanel() {
  const { data, error, loading, reload } = useList(creditApi.getEdpRequisitions, 0, ['credit:edp']);
  const [selected, setSelected] = useState(null);
  const [notice, setNotice] = useState('');

  const rows = data?.requisitions ?? [];
  const open = useMemo(() => rows.find((r) => r.id === selected) ?? null, [rows, selected]);

  // Key columns, then Action: remark (optional), Close and the expand icon.
  const columns = [
    { key: 'dealerName', label: 'Dealer', render: (r) => (
      <div>
        <div className="flex items-center gap-2">
          <p>{r.dealerName}</p>
          <ExpandButton onClick={() => { setNotice(''); setSelected(r.id); }} />
        </div>
        <p className="text-theme-xs font-normal text-gray-500">{r.ref} · {r.dealerCode}</p>
      </div>
    ) },
    { key: 'branchName', label: 'Branch' },
    { key: 'requestType', label: 'Type', render: (r) => <TypePill value={r.requestType} /> },
    { key: 'requesterName', label: 'Requester' },
    { key: 'tempCreditAmount', label: 'Proposed limit', align: 'right', render: (r) => rupees(r.tempCreditAmount) },
    { key: 'status', label: 'Status', render: (r) => (
      <div className="flex flex-col items-start gap-1">
        <StatusPill status={r.status} />
        {r.totalLevels > 1 && r.status === 'Pending' && <StatusNote>Level {r.approvalStage} pending from {r.assignedToName}</StatusNote>}
        {r.status === 'Approved' && <StatusNote tone="success">Ready to close</StatusNote>}
        {r.awaitingReply && <StatusNote tone="warning">Awaiting reply</StatusNote>}
      </div>
    ) },
    { key: 'action', label: 'Action', render: (r) => (
      <CloseCell
        request={r}
        onClosed={(message) => {
          setNotice(message);
          reload(true);
        }}
      />
    ) },
  ];

  return (
    <div>
      {notice && <Alert variant="success" className="mb-4">{notice}</Alert>}
      {error && <Alert variant="error" className="mb-4">{error}</Alert>}
      <DataTable
        title="All requests"
        rows={rows}
        tabs={['All', 'Pending', 'Approved', 'Rejected', 'Closed']}
        searchPlaceholder="Search dealer, request or requester"
        searchFields={['dealerName', 'dealerCode', 'ref', 'requesterName']}
        columns={columns}
        compact
        empty={{ icon: 'dealers', title: loading ? 'Loading…' : 'No requests yet' }}
      />

      <Modal open={Boolean(open)} size="lg" title={open ? open.dealerName : ''} subtitle={open ? `Request ${open.ref}` : ''} onClose={() => setSelected(null)}>
        {open && (
          <Detail request={open} />
        )}
      </Modal>
    </div>
  );
}
