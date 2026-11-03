import { useCallback, useMemo, useState } from 'react';
import Alert from '../../components/common/Alert.jsx';
import Button from '../../components/common/Button.jsx';
import Modal from '../../components/common/Modal.jsx';
import DataTable from '../../components/ModulePage/DataTable.jsx';
import { creditApi } from './api/creditApi.js';
import { formatDate, formatDateTime, rupees } from './lib/format.js';
import { AttachmentLinks, NoteBadge, Req, RequestDetails, StatusPill, TextArea, TypePill, useList } from './components.jsx';

const EVENT_LABEL = { sent: 'Sent', query: 'Query', reply: 'Reply', firstApproved: 'Level approval', approved: 'Approved', rejected: 'Rejected', closed: 'Closed' };
const EVENT_TONE = {
  firstApproved: 'border-success-200 bg-success-50',
  approved: 'border-success-200 bg-success-50',
  rejected: 'border-error-200 bg-error-50',
  closed: 'border-gray-300 bg-gray-100',
};

// The list does not carry the rejection message, so it is read from the
// request's thread. Only the rows on the current page load it.
function RejectReason({ requestId }) {
  const loader = useCallback(() => creditApi.getEdpRequisitionThread(requestId), [requestId]);
  const { data, loading } = useList(loader);
  if (loading) return <span className="text-gray-400">Loading…</span>;
  const reason = data?.events?.filter((e) => e.kind === 'rejected').pop()?.text;
  return <span className="block max-w-xs whitespace-pre-wrap break-words text-gray-700">{reason || '—'}</span>;
}

// Who raised, who approved and who closed, in one place.
function People({ request }) {
  const items = [
    ['Requested by', request.requesterName, request.sentAt],
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

// EDP closes the request as the last step. A remark is needed.
function CloseBox({ requestId, onClosed }) {
  const [remark, setRemark] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function close() {
    if (!remark.trim()) {
      setError('Remark is required to close a request.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await creditApi.closeRequisition(requestId, remark);
      onClosed(result.message);
    } catch (err) {
      setError(err.message || 'This request could not be closed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50/60 p-5">
      <p className="mb-3 text-theme-sm text-gray-700">This request is approved. Close it when your work on it is done.</p>
      <TextArea id="cr-close-remark" label={<Req>Remark</Req>} value={remark} onChange={(e) => { setRemark(e.target.value); setError(''); }} error={error} placeholder="A remark is needed to close a request." />
      <Button onClick={close} isLoading={busy}>
        Close request
      </Button>
    </div>
  );
}

// One request: everything the Requester entered, who approved it, and the
// timeline from sent to close.
function Detail({ request, onClosed }) {
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

      {summary.canClose && <CloseBox requestId={request.id} onClosed={onClosed} />}
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

  const baseColumns = [
    { key: 'dealerName', label: 'Dealer', render: (r) => (
      <div>
        <p>{r.dealerName}</p>
        <p className="text-theme-xs font-normal text-gray-500">{r.ref} · {r.dealerCode}</p>
      </div>
    ) },
    { key: 'branchName', label: 'Branch' },
    { key: 'requestType', label: 'Type', render: (r) => <TypePill value={r.requestType} /> },
    { key: 'tempCreditAmount', label: 'Proposed limit', align: 'right', render: (r) => rupees(r.tempCreditAmount) },
    { key: 'status', label: 'Status', render: (r) => (
      <div className="flex flex-wrap items-center gap-1.5">
        <StatusPill status={r.status} />
        {r.totalLevels > 1 && r.status === 'Pending' && <NoteBadge tone="brand">Level {r.approvalStage} pending from {r.assignedToName}</NoteBadge>}
        {r.status === 'Approved' && <NoteBadge tone="brand">Ready to close</NoteBadge>}
        {r.awaitingReply && <NoteBadge>Awaiting reply</NoteBadge>}
      </div>
    ) },
    { key: 'requesterName', label: 'Requester' },
    { key: 'assignedToName', label: 'Approver' },
  ];
  const decisionColumn = { key: 'decisionByName', label: 'Decision', render: (r) => (r.decisionByName ? `${r.decisionByName} · ${formatDateTime(r.decisionAt)}` : '—') };
  const closedColumn = { key: 'closedByName', label: 'Closed', render: (r) => (r.closedByName ? `${r.closedByName} · ${formatDateTime(r.closedAt)}` : '—') };
  const messagesColumn = { key: 'messageCount', label: 'Messages', align: 'right' };

  // Pending has no decision or close yet. Approved and Rejected show the date only.
  const columnsFor = (tab) => {
    if (tab === 'Pending') return [...baseColumns, messagesColumn];
    if (tab === 'Approved') {
      return [...baseColumns, { key: 'decisionAt', label: 'Approved on', render: (r) => formatDate(r.decisionAt) }, messagesColumn];
    }
    if (tab === 'Rejected') {
      return [
        ...baseColumns,
        { key: 'rejectReason', label: 'Rejected reason', render: (r) => <RejectReason requestId={r.id} /> },
        { key: 'decisionAt', label: 'Rejected on', render: (r) => formatDate(r.decisionAt) },
        messagesColumn,
      ];
    }
    if (tab === 'Closed') {
      // Closed requests: the decision date (Approved or Rejected) and who closed it, no time stamps.
      const decisionDate = {
        key: 'decisionAt',
        label: 'Approved date',
        render: (r) => (r.status === 'Rejected' ? `Rejected · ${formatDate(r.decisionAt)}` : formatDate(r.decisionAt)),
      };
      const closedBy = { key: 'closedByName', label: 'Closed by', render: (r) => r.closedByName || '—' };
      return [...baseColumns, decisionDate, closedBy, messagesColumn];
    }
    return [...baseColumns, decisionColumn, closedColumn, messagesColumn];
  };

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
        columns={columnsFor}
        onRowClick={(r) => {
          setNotice('');
          setSelected(r.id);
        }}
        empty={{ icon: 'dealers', title: loading ? 'Loading…' : 'No requests yet' }}
      />

      <Modal open={Boolean(open)} size="lg" title={open ? open.dealerName : ''} subtitle={open ? `Request ${open.ref}` : ''} onClose={() => setSelected(null)}>
        {open && (
          <Detail
            request={open}
            onClosed={(message) => {
              setNotice(message);
              setSelected(null);
              reload(true);
            }}
          />
        )}
      </Modal>
    </div>
  );
}
