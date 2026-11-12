import { useMemo, useState } from 'react';
import Alert from '../../components/common/Alert.jsx';
import Button from '../../components/common/Button.jsx';
import Modal from '../../components/common/Modal.jsx';
import DataTable from '../../components/ModulePage/DataTable.jsx';
import { creditApi } from './api/creditApi.js';
import TextInput from '../../components/common/TextInput.jsx';
import { formatDateTime, requestTypeOf, rupees, toNumber, withCommas } from './lib/format.js';
import { AttachmentPicker, NoteBadge, QueryThread, Req, RequestDetails, StatusPill, TextArea, TypePill, useList } from './components.jsx';

// The inbox loads again when the database pings that a request changed. This
// slow timer is only a safety net in case the live channel drops.
const REFRESH_MS = 300000;

const ACTIONS = {
  approve: { label: 'Approve', field: 'remark', prompt: 'Remark', hint: 'A remark is needed to approve.', variant: 'primary' },
  reject: { label: 'Reject', field: 'reason', prompt: 'Reason', hint: 'A reason is needed to reject.', variant: 'danger' },
  query: { label: 'Send query', field: 'queryMessage', prompt: 'Your question', hint: 'The request stays with you until the requester replies.', variant: 'secondary' },
};

function ReviewActions({ request, onDone }) {
  const [action, setAction] = useState('approve');
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  // At the first level of a Permanent request the approver may change the
  // proposed limit and days before approving.
  const canEdit = requestTypeOf(request.requestType) === 'Permanent' && request.approvalStage === 1;
  const [limit, setLimit] = useState(String(request.tempCreditAmount ?? '').replace(/,/g, ''));
  const [days, setDays] = useState(String(request.proposedCreditDays ?? ''));
  const [figureErrors, setFigureErrors] = useState({});
  // Files that go with a query, an approval or a rejection.
  const [files, setFiles] = useState([]);
  // On a Permanent request, an approval below the last level only passes it up.
  const passesOn = requestTypeOf(request.requestType) === 'Permanent' && request.approvalStage < request.totalLevels;
  const cfg = action === 'approve' && passesOn
    ? {
        ...ACTIONS.approve,
        label: `Approve and send to level ${request.approvalStage + 1}`,
        hint: `A remark is needed. The request then goes to ${request.nextLevelNames || `level ${request.approvalStage + 1}`}.`,
      }
    : ACTIONS[action];

  async function run() {
    if (!text.trim()) {
      setError(`${cfg.prompt} is required.`);
      return;
    }
    const editing = canEdit && action === 'approve';
    if (editing) {
      const problems = {};
      if (!(toNumber(limit) > 0)) problems.limit = 'Enter a proposed credit limit above zero.';
      if (!(Number.isInteger(toNumber(days)) && toNumber(days) > 0)) problems.days = 'Enter a whole number above zero.';
      setFigureErrors(problems);
      if (Object.keys(problems).length) return;
    }
    setBusy(true);
    setError('');
    try {
      const figures = editing ? { proposedCreditLimit: limit, proposedCreditDays: days } : {};
      const result = await creditApi.processRequisition({ requisitionId: request.id, action, [cfg.field]: text, ...figures, attachments: files });
      setText('');
      setFiles([]);
      onDone(result.message, action);
    } catch (err) {
      setError(err.message || 'This action could not be completed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50/60 p-5">
      <div className="mb-4 flex flex-wrap gap-2">
        {Object.entries(ACTIONS).map(([key, a]) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setAction(key);
              setError('');
            }}
            className={`rounded-lg px-4 py-2 text-theme-sm font-medium transition-colors ${
              action === key ? 'bg-brand-500 text-white shadow-theme-xs' : 'bg-white text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50'
            }`}
          >
            {a.label.replace('Send query', 'Query')}
          </button>
        ))}
      </div>
      {canEdit && action === 'approve' && (
        <div className="mb-1 grid grid-cols-1 gap-x-6 sm:grid-cols-2">
          <TextInput
            id="cr-edit-limit"
            label={<Req>Proposed credit limit</Req>}
            icon="₹"
            inputMode="decimal"
            value={withCommas(limit)}
            onChange={(e) => {
              setLimit(e.target.value.replace(/[^\d.]/g, ''));
              setFigureErrors((f) => ({ ...f, limit: '' }));
            }}
            error={figureErrors.limit}
          />
          <TextInput
            id="cr-edit-days"
            label={<Req>Proposed credit days</Req>}
            inputMode="numeric"
            value={days}
            onChange={(e) => {
              setDays(e.target.value.replace(/\D/g, ''));
              setFigureErrors((f) => ({ ...f, days: '' }));
            }}
            error={figureErrors.days}
          />
        </div>
      )}
      <TextArea
        id="cr-action-text"
        label={<Req>{cfg.prompt}</Req>}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setError('');
        }}
        error={error}
        placeholder={cfg.hint}
      />
      <AttachmentPicker requisitionId={request.id} value={files} onChange={setFiles} />
      <Button variant={cfg.variant === 'secondary' ? 'primary' : cfg.variant} onClick={run} isLoading={busy}>
        {cfg.label}
      </Button>
    </div>
  );
}

function Inbox() {
  const { data, error, loading, reload } = useList(creditApi.getApproverRequisitions, REFRESH_MS, ['credit:approvers']);
  const [selected, setSelected] = useState(null);
  const [notice, setNotice] = useState('');

  const rows = data?.requisitions ?? [];
  const open = useMemo(() => rows.find((r) => r.id === selected) ?? null, [rows, selected]);

  const columns = [
    { key: 'dealerName', label: 'Dealer', render: (r) => (
      <div>
        <p>{r.dealerName}</p>
        <p className="text-theme-xs font-normal text-gray-500">{r.ref} · {r.dealerCode}</p>
      </div>
    ) },
    { key: 'requesterName', label: 'Requester' },
    { key: 'requestType', label: 'Type', render: (r) => <TypePill value={r.requestType} /> },
    { key: 'tempCreditAmount', label: 'Proposed limit', align: 'right', render: (r) => rupees(r.tempCreditAmount) },
    { key: 'status', label: 'Status', render: (r) => (
      <div className="flex flex-wrap items-center gap-1.5">
        <StatusPill status={r.status} />
        {r.totalLevels > 1 && <NoteBadge tone="brand">Level {r.approvalStage} of {r.totalLevels}</NoteBadge>}
        {r.awaitingRequesterReply && <NoteBadge>Waiting for requester</NoteBadge>}
        {r.requesterReplied && <NoteBadge tone="brand">Requester replied</NoteBadge>}
      </div>
    ) },
    { key: 'assignedToName', label: 'Assigned to', render: (r) => (r.canApprove ? <NoteBadge tone="brand">You</NoteBadge> : r.assignedToName) },
    { key: 'sentAt', label: 'Sent', render: (r) => formatDateTime(r.sentAt) },
  ];

  return (
    <div>
      {notice && <Alert variant="success" className="mb-4">{notice}</Alert>}
      {error && <Alert variant="error" className="mb-4">{error}</Alert>}

      <DataTable
        title="Approval inbox"
        rows={rows}
        searchPlaceholder="Search dealer or request"
        searchFields={['dealerName', 'dealerCode', 'ref', 'requesterName']}
        columns={columns}
        onRowClick={(r) => setSelected(r.id)}
        empty={{ icon: 'dealers', title: loading ? 'Loading…' : 'No requests are waiting', hint: loading ? '' : 'New requests will show here.' }}
      />

      <RequestWindow
        request={open}
        onClose={() => setSelected(null)}
        onDone={(message) => {
          // Every action closes the request. A query stays in the inbox, marked
          // as waiting for the requester, until they reply.
          setNotice(message);
          reload(true);
          setSelected(null);
        }}
      />
    </div>
  );
}

// One request, opened from the inbox or from a Pending row in the history:
// the form, the question thread, and the actions when this approver may act.
function RequestWindow({ request, onClose, onDone }) {
  return (
    <Modal open={Boolean(request)} size="lg" title={request ? request.dealerName : ''} subtitle={request ? `Request ${request.ref}` : ''} onClose={onClose}>
      {request && (
        <>
          <RequestDetails request={request} />
          <h4 className="mb-2.5 mt-6 text-theme-xs font-semibold uppercase tracking-[0.08em] text-gray-500">Questions</h4>
          <QueryThread requisitionId={request.id} />
          {request.canApprove ? (
            <ReviewActions request={request} onDone={onDone} />
          ) : (
            <Alert variant="info" className="mt-6">
              This request is assigned to {request.assignedToName}. You can read it, but only that approver can act on it.
            </Alert>
          )}
        </>
      )}
    </Modal>
  );
}

function History() {
  const { data, error, loading } = useList(creditApi.getApproverActionHistory);
  // Requests still waiting on this approver are listed here as Pending, so the
  // history shows the whole picture, not only what has been decided.
  const inbox = useList(creditApi.getApproverRequisitions, REFRESH_MS, ['credit:approvers']);
  const [selected, setSelected] = useState(null);
  const [notice, setNotice] = useState('');
  const rows = useMemo(() => {
    const pending = (inbox.data?.requisitions ?? [])
      .filter((r) => r.canApprove)
      .map((r) => ({
        ...r,
        id: `Pending-${r.id}`,
        requisitionId: r.id,
        action: 'Pending',
        actionAt: r.sentAt,
        reason: r.awaitingRequesterReply ? 'Waiting for the requester to reply' : r.requesterReplied ? 'Requester replied, waiting for your action' : 'Waiting for your action',
      }));
    return [...pending, ...(data?.actions ?? [])];
  }, [data, inbox.data]);
  // The request behind the Pending row that was clicked, with its own id back.
  const open = useMemo(() => {
    const request = (inbox.data?.requisitions ?? []).find((r) => r.id === selected);
    return request ? { ...request, status: 'Pending' } : null;
  }, [inbox.data, selected]);
  const columns = [
    { key: 'dealerName', label: 'Dealer', render: (r) => (
      <div>
        <p>{r.dealerName}</p>
        <p className="text-theme-xs font-normal text-gray-500">{r.dealerCode}</p>
      </div>
    ) },
    { key: 'requesterName', label: 'Requester' },
    { key: 'requestType', label: 'Type', render: (r) => <TypePill value={r.requestType} /> },
    { key: 'tempCreditAmount', label: 'Proposed limit', align: 'right', render: (r) => rupees(r.tempCreditAmount) },
    { key: 'action', label: 'Action', render: (r) => <StatusPill status={r.action} /> },
    { key: 'reason', label: 'Remark or reason', render: (r) => <span className="whitespace-normal">{r.reason || '—'}</span> },
    { key: 'actionAt', label: 'When', render: (r) => formatDateTime(r.actionAt) },
  ];
  return (
    <div>
      {notice && <Alert variant="success" className="mb-4">{notice}</Alert>}
      {(error || inbox.error) && <Alert variant="error" className="mb-4">{error || inbox.error}</Alert>}
      <DataTable
        title="My action history"
        rows={rows}
        tabs={['All', 'Pending', 'Approved', 'Rejected']}
        tabField="action"
        searchPlaceholder="Search dealer"
        searchFields={['dealerName', 'dealerCode', 'requesterName']}
        columns={columns}
        onRowClick={(r) => r.action === 'Pending' && setSelected(r.requisitionId)}
        empty={{ icon: 'dealers', title: loading ? 'Loading…' : 'You have not acted on any request yet' }}
      />
      <RequestWindow
        request={open}
        onClose={() => setSelected(null)}
        onDone={(message) => {
          setNotice(message);
          inbox.reload(true);
          setSelected(null);
        }}
      />
    </div>
  );
}

export default function ApproverPanel({ tab }) {
  return tab === 'History' ? <History /> : <Inbox />;
}
