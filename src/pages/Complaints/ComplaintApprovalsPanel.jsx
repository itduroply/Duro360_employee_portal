import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import Alert from '../../components/common/Alert.jsx';
import Button from '../../components/common/Button.jsx';
import Modal from '../../components/common/Modal.jsx';
import DataTable from '../../components/ModulePage/DataTable.jsx';
import { StatusChip } from '../../components/ModulePage/ModulePage.jsx';
import { complaintsApi, COMPLAINT_STATUS_LABEL } from '../../api/complaintsApi';
import { formatDate, formatDateTime } from '../../utils/format.js';
import { complaintToPrint, downloadComplaint } from './printComplaint.js';
import { Req, TextArea, useList } from '../../modules/creditApproval/components.jsx';

const EditComplaintModal = lazy(() => import('./EditComplaintModal.jsx'));

// The inbox loads again on this timer, so a complaint a colleague just filed
// shows up without a page reload.
const REFRESH_MS = 60000;

export function formatRupees(value) {
  return `₹${Number(value ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function Item({ label, value }) {
  return (
    <div>
      <p className="text-theme-xs text-gray-500">{label}</p>
      <p className="mt-0.5 whitespace-pre-wrap text-theme-sm font-medium text-gray-800">{value || '—'}</p>
    </div>
  );
}

const FIELD_LABEL = {
  amount: 'Amount',
  remarks: 'Remarks',
  physical_visit: 'Physical visit',
  invoice_copy: 'Invoice copy',
  photos: 'Site photographs',
  documents: 'Additional documents',
};

const shown = (v) => (v === null || v === undefined || v === '' ? '—' : String(v));

// One edit from complaint_edit_log as short lines of text: "Amount: 5000 → 6500".
function describeEdit(changes) {
  const out = [];
  Object.entries(changes || {}).forEach(([key, value]) => {
    if (key === 'lines') {
      (value || []).forEach((l) => {
        const parts = [];
        if (l.qty_defective && l.qty_defective.from !== l.qty_defective.to) parts.push(`Qty defective ${shown(l.qty_defective.from)} → ${shown(l.qty_defective.to)}`);
        if (l.primary_nature && l.primary_nature.from !== l.primary_nature.to) parts.push(`Primary nature ${shown(l.primary_nature.from)} → ${shown(l.primary_nature.to)}`);
        if (l.secondary_nature && l.secondary_nature.from !== l.secondary_nature.to) parts.push(`Secondary nature ${shown(l.secondary_nature.from)} → ${shown(l.secondary_nature.to)}`);
        if (parts.length) out.push(`${l.item || 'Product line'}: ${parts.join('; ')}`);
      });
    } else if (key === 'comment') {
      out.push(`Comment: ${shown(value.from)} → ${shown(value.to)}`);
    } else if (key === 'physical_visit') {
      const f = value.from || {};
      const t = value.to || {};
      const text = (x) => (x.visit ? `Yes${x.date ? ` (${formatDate(x.date)})` : ''}` : 'No');
      out.push(`Physical visit: ${text(f)} → ${text(t)}`);
    } else if (key === 'invoice_copy') {
      out.push('Invoice copy replaced');
    } else if (key === 'photos' || key === 'documents') {
      out.push(`${FIELD_LABEL[key]}: ${value.from} → ${value.to} files`);
    } else {
      out.push(`${FIELD_LABEL[key] || key}: ${shown(value.from)} → ${shown(value.to)}`);
    }
  });
  return out;
}

function Section({ title, children }) {
  return (
    <section className="mb-5 last:mb-0">
      <h4 className="mb-2.5 text-theme-xs font-semibold uppercase tracking-[0.08em] text-gray-500">{title}</h4>
      {children}
    </section>
  );
}

// How far a complaint has gone: filed, manager approval, accounts approval,
// then approved or rejected. Built from the complaint's status and the
// decisions on it, so the filer and every approver see the same picture.
const STEP_STYLE = {
  done: { ring: 'border-success-500 bg-success-500 text-white', line: 'bg-success-500', text: 'text-gray-800' },
  rejected: { ring: 'border-error-500 bg-error-500 text-white', line: 'bg-error-500', text: 'text-error-600' },
  current: { ring: 'border-warning-500 bg-warning-50 text-warning-700', line: 'bg-gray-200', text: 'text-warning-700' },
  skipped: { ring: 'border-gray-300 bg-gray-100 text-gray-400', line: 'bg-gray-200', text: 'text-gray-400' },
  pending: { ring: 'border-gray-300 bg-white text-gray-400', line: 'bg-gray-200', text: 'text-gray-400' },
};

export function complaintSteps(complaint, decisions = []) {
  const manager = decisions.find((d) => d.stage === 'MANAGER');
  const accounts = decisions.find((d) => d.stage === 'ACCOUNTS');
  const status = complaint.status;
  const by = (d) => `${d.approver_name || '—'} · ${formatDateTime(d.decided_at)}`;

  const managerStep = manager
    ? { state: manager.decision === 'APPROVED' ? 'done' : 'rejected', note: by(manager), detail: manager.reason }
    : status === 'PENDING_MANAGER'
      ? { state: 'current', note: `With ${complaint.current_approver_name || 'the reporting manager'}${complaint.manager_level ? ` (level ${complaint.manager_level})` : ''}` }
      : ['PENDING_ACCOUNTS', 'APPROVED'].includes(status) || (status === 'REJECTED' && accounts)
        ? { state: 'skipped', note: 'No manager in the reporting line' }
        : { state: 'pending', note: '' };

  const accountsStep = accounts
    ? { state: accounts.decision === 'APPROVED' ? 'done' : 'rejected', note: by(accounts), detail: accounts.reason }
    : status === 'PENDING_ACCOUNTS'
      ? { state: 'current', note: 'With the accounts team' }
      : managerStep.state === 'rejected'
        ? { state: 'skipped', note: 'Not reached' }
        : { state: 'pending', note: '' };

  const finalStep = status === 'APPROVED'
    ? { label: 'Approved', state: 'done', note: complaint.approved_at ? formatDateTime(complaint.approved_at) : '' }
    : status === 'REJECTED'
      ? { label: 'Rejected', state: 'rejected', note: complaint.rejection_reason || '' }
      : status === 'RESOLVED'
        ? { label: 'Resolved', state: 'done', note: '' }
        : { label: 'Approved', state: 'pending', note: '' };

  return [
    { label: 'Filed', state: 'done', note: `${complaint.filed_by_name || '—'} · ${formatDateTime(complaint.created_at)}` },
    { label: 'Manager approval', ...managerStep },
    { label: 'Accounts approval', ...accountsStep },
    finalStep,
  ];
}

export function ComplaintStepper({ complaint, decisions }) {
  const steps = complaintSteps(complaint, decisions);
  return (
    <ol className="mb-6 grid grid-cols-2 gap-y-4 sm:grid-cols-4 sm:gap-y-0">
      {steps.map((step, i) => {
        const style = STEP_STYLE[step.state];
        const mark = step.state === 'done' ? '✓' : step.state === 'rejected' ? '✕' : String(i + 1);
        return (
          <li key={step.label} className="relative pr-3">
            {i < steps.length - 1 && (
              <span className={`absolute left-[calc(50%+16px)] top-4 hidden h-0.5 w-[calc(100%-32px)] sm:block ${style.line}`} aria-hidden="true" />
            )}
            <div className="flex flex-col items-center text-center">
              <span className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-theme-xs font-bold ${style.ring}`}>{mark}</span>
              <p className={`mt-2 text-theme-sm font-semibold ${style.text}`}>{step.label}</p>
              {step.note && <p className="mt-0.5 max-w-[180px] text-theme-xs text-gray-500">{step.note}</p>}
              {step.detail && <p className="mt-0.5 max-w-[180px] truncate text-theme-xs italic text-gray-500" title={step.detail}>{step.detail}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// May this person decide the complaint right now?
export function canDecide(complaint, user, access) {
  if (!complaint || !user) return false;
  const superAdmin = Boolean(user.roles?.includes('SUPERADMIN'));
  if (complaint.status === 'PENDING_MANAGER') return superAdmin || complaint.current_approver_id === user.id;
  if (complaint.status === 'PENDING_ACCOUNTS') return superAdmin || Boolean(access?.isAccounts);
  return false;
}

// Everything on one complaint, read only: the form, the product lines, the
// evidence files and the decisions taken so far.
export function ComplaintDetails({ complaint, onChanged }) {
  const [files, setFiles] = useState([]);
  const [decisions, setDecisions] = useState([]);
  const [rights, setRights] = useState(null);
  const [editLog, setEditLog] = useState([]);
  const [editing, setEditing] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [commentBusy, setCommentBusy] = useState(false);
  const [commentError, setCommentError] = useState('');
  const [editNotice, setEditNotice] = useState('');
  const [downloadError, setDownloadError] = useState('');
  const [downloading, setDownloading] = useState(false);
  async function download() {
    setDownloading(true);
    setDownloadError('');
    try {
      // The zone belongs to the selling branch; it is not saved on the complaint.
      const zone = await complaintsApi.branches().then((b) => b.find((x) => x.name === (complaint.selling_branch || complaint.branch_name))?.zone).catch(() => '');
      await downloadComplaint(complaintToPrint(complaint, COMPLAINT_STATUS_LABEL[complaint.status] || complaint.status, { decisions, zone }));
    } catch {
      setDownloadError('Could not create the PDF. Please try again.');
    } finally {
      setDownloading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    complaintsApi.fileLinks(complaint).then((list) => !cancelled && setFiles(list)).catch(() => {});
    complaintsApi.decisions(complaint.id).then((list) => !cancelled && setDecisions(list)).catch(() => {});
    // Before the edit migration is applied these fail; the edit parts then stay hidden.
    complaintsApi
      .editRights(complaint.id)
      .then((r) => {
        if (cancelled) return;
        setRights(r);
        setCommentText(r?.comment ?? '');
      })
      .catch(() => !cancelled && setRights(null));
    complaintsApi.editLog(complaint.id).then((list) => !cancelled && setEditLog(list)).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [complaint]);

  const lines = Array.isArray(complaint.lines) ? complaint.lines : [];
  const stageLabel = complaint.status === 'PENDING_MANAGER'
    ? `Waiting on ${complaint.current_approver_name || 'the reporting manager'}${complaint.manager_level ? ` (level ${complaint.manager_level}${complaint.requested_level && complaint.requested_level !== complaint.manager_level ? `, band asked for level ${complaint.requested_level}` : ''})` : ''}`
    : complaint.status === 'PENDING_ACCOUNTS'
      ? 'Waiting on the accounts team'
      : null;

  async function saveComment() {
    setCommentBusy(true);
    setCommentError('');
    try {
      const result = await complaintsApi.editComment(complaint.id, commentText);
      setEditNotice(result?.changed ? 'Your comment is updated.' : 'Nothing changed.');
      onChanged?.();
    } catch (err) {
      setCommentError(err.message || 'The comment could not be saved.');
    } finally {
      setCommentBusy(false);
    }
  }

  return (
    <div>
      {editing && (
        <Suspense fallback={null}>
          <EditComplaintModal
            complaint={complaint}
            onClose={() => setEditing(false)}
            onSaved={(result) => {
              setEditing(false);
              setEditNotice(
                !result?.changed
                  ? 'Nothing changed.'
                  : result.rerouted
                    ? `Complaint updated. It now goes to ${result.waitingOn || 'a different approver'} for approval.`
                    : 'Complaint updated. The approver sees the latest details.'
              );
              // A new approver has not heard of this complaint yet: mail them (best effort).
              if (result?.rerouted) complaintsApi.notifyFiled(result.complaintNo).catch(() => {});
              onChanged?.();
            }}
          />
        </Suspense>
      )}
      {editNotice && <Alert variant="success" className="mb-5">{editNotice}</Alert>}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <span className="text-theme-sm font-semibold text-gray-800">{complaint.complaint_no}</span>
        <StatusChip status={COMPLAINT_STATUS_LABEL[complaint.status] || complaint.status} />
        <span className="text-theme-xs text-gray-500">Filed {formatDateTime(complaint.created_at)} by {complaint.filed_by_name || '—'}</span>
        {rights?.canEditComplaint && (
          <Button variant="secondary" size="sm" className="ml-auto" onClick={() => setEditing(true)}>
            Edit complaint
          </Button>
        )}
        <Button
          variant="secondary"
          size="sm"
          className={rights?.canEditComplaint ? '' : 'ml-auto'}
          onClick={download}
          isLoading={downloading}
        >
          Download PDF
        </Button>
      </div>
      {downloadError && <Alert variant="error" className="mb-5">{downloadError}</Alert>}
      {complaint.edited_at && (
        <p className="-mt-3 mb-5 text-theme-xs text-gray-500">
          Edited {formatDateTime(complaint.edited_at)} by {complaint.edited_by_name || '—'} (version {complaint.version}).
        </p>
      )}
      <ComplaintStepper complaint={complaint} decisions={decisions} />
      {stageLabel && <Alert variant="info" className="mb-5">{stageLabel}</Alert>}
      {complaint.status === 'REJECTED' && complaint.rejection_reason && (
        <Alert variant="error" className="mb-5">Rejected: {complaint.rejection_reason}</Alert>
      )}

      {decisions.length > 0 && (
        <Section title="Decisions">
          <div className="space-y-2">
            {decisions.map((d) => (
              <div key={d.id} className={`rounded-xl border p-3 text-theme-sm ${d.decision === 'APPROVED' ? 'border-success-200 bg-success-50' : 'border-error-200 bg-error-50'}`}>
                <p className="font-semibold text-gray-800">
                  {d.decision === 'APPROVED' ? 'Approved' : 'Rejected'} by {d.approver_name || '—'} ({d.stage === 'ACCOUNTS' ? 'accounts team' : `manager level ${d.manager_level ?? '—'}`}) · {formatDateTime(d.decided_at)}
                </p>
                {d.reason && <p className="mt-1 whitespace-pre-wrap text-gray-700">{d.reason}</p>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {rights?.canEditComment && (
        <Section title="My comment">
          <TextArea
            id="complaint-my-comment"
            label="You approved this complaint. You can change your comment until the next approver decides."
            value={commentText}
            onChange={(e) => (setCommentText(e.target.value), setCommentError(''))}
            error={commentError}
            placeholder="Your comment"
          />
          <Button size="sm" variant="secondary" onClick={saveComment} isLoading={commentBusy}>
            Save comment
          </Button>
        </Section>
      )}

      {editLog.length > 0 && (
        <Section title="Edit history">
          <div className="space-y-2">
            {editLog.map((e) => (
              <div key={e.id} className="rounded-xl border border-gray-200 bg-white p-3 text-theme-sm">
                <p className="font-semibold text-gray-800">
                  {e.kind === 'COMMENT' ? 'Comment edited' : 'Complaint edited'} by {e.editor_name || '—'} · {formatDateTime(e.edited_at)}
                </p>
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-gray-700">
                  {describeEdit(e.changes).map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="Dealer and invoice">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Item label="Complaint date" value={formatDate(complaint.complaint_date || complaint.created_at)} />
          <Item label="Dealer" value={`${complaint.dealer_name} (${complaint.dealer_code})`} />
          <Item label="Dealer mobile" value={complaint.dealer_mobile} />
          <Item label="Dealer email" value={complaint.dealer_email} />
          <Item label="Selling branch" value={complaint.selling_branch || complaint.branch_name} />
          <Item label="Origin" value={complaint.origin === 'END_CUSTOMER' ? 'End-Customer' : 'Dealer'} />
          <Item label="Physical visit" value={complaint.physical_visit ? `Yes${complaint.physical_visit_date ? ` · ${formatDate(complaint.physical_visit_date)}` : ''}` : 'No'} />
          <Item label="Invoice" value={`${complaint.invoice_no}${complaint.invoice_date ? ` · ${formatDate(complaint.invoice_date)}` : ''}`} />
          <Item label="Manufacturing factory" value={complaint.manufacturing_factory} />
          {complaint.origin === 'END_CUSTOMER' && <Item label="Customer" value={`${complaint.customer_name || '—'} · ${complaint.customer_mobile || '—'}`} />}
          <Item label="Complaint amount" value={formatRupees(complaint.amount)} />
        </div>
      </Section>

      <Section title="Products">
        <div className="custom-scrollbar overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-left text-theme-sm">
            <thead className="bg-gray-50 text-theme-xs text-gray-500">
              <tr>
                <th className="px-3 py-2 font-medium">Item</th>
                <th className="px-3 py-2 font-medium">Brand</th>
                <th className="px-3 py-2 font-medium">Thick</th>
                <th className="px-3 py-2 font-medium">Size</th>
                <th className="px-3 py-2 text-right font-medium">Qty Supplied</th>
                <th className="px-3 py-2 text-right font-medium">Qty Defective</th>
                <th className="px-3 py-2 font-medium">Primary Nature</th>
                <th className="px-3 py-2 font-medium">Secondary Nature</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i} className="text-gray-800">
                  <td className="px-3 py-2">{l.item_name || '—'}</td>
                  <td className="px-3 py-2">{l.brand || '—'}</td>
                  <td className="whitespace-nowrap px-3 py-2">{l.thickness != null ? `${Number(l.thickness)} mm` : '—'}</td>
                  <td className="whitespace-nowrap px-3 py-2">{l.length_m != null && l.width_m != null ? `${Number(l.length_m)} × ${Number(l.width_m)} m` : '—'}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">{l.quantity ?? '—'} {l.uom || ''}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">{l.qty_defective ?? '—'}</td>
                  <td className="px-3 py-2">{l.primary_nature || '—'}</td>
                  <td className="px-3 py-2">{l.secondary_nature || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Details">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* The filing form no longer asks for this. Show it only on older complaints that have it. */}
          {complaint.installation_context && <Item label="Installation" value={complaint.installation_context} />}
          <Item label="Remarks" value={complaint.remarks} />
        </div>
      </Section>

      <Section title="Files">
        {files.length === 0 ? (
          <p className="text-theme-sm text-gray-500">Loading files…</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {files.map((f) => (
              <li key={f.path}>
                {f.url ? (
                  <a href={f.url} target="_blank" rel="noreferrer" className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-theme-sm font-medium text-brand-600 hover:bg-gray-50">
                    {f.label}
                  </a>
                ) : (
                  <span className="inline-flex items-center rounded-lg border border-gray-200 px-3 py-1.5 text-theme-sm text-gray-400">{f.label} (not available)</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

export function DecisionForm({ complaint, onDone }) {
  const [decision, setDecision] = useState('APPROVED');
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const accounts = complaint.status === 'PENDING_ACCOUNTS';

  async function run() {
    if (!text.trim()) {
      setError(decision === 'REJECTED' ? 'A reason is needed to reject.' : 'A remark is needed to approve.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await complaintsApi.decide({ complaintId: complaint.id, decision, reason: text, version: complaint.version });
      onDone(result);
    } catch (err) {
      setError(err.message || 'This action could not be completed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50/60 p-5">
      <div className="mb-4 flex flex-wrap gap-2">
        {[['APPROVED', 'Approve'], ['REJECTED', 'Reject']].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setDecision(key);
              setError('');
            }}
            className={`rounded-lg px-4 py-2 text-theme-sm font-medium transition-colors ${
              decision === key ? 'bg-brand-500 text-white shadow-theme-xs' : 'bg-white text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <TextArea
        id="complaint-decision-text"
        label={decision === 'REJECTED' ? <Req>Reason</Req> : <Req>Remark</Req>}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setError('');
        }}
        error={error}
        placeholder={decision === 'REJECTED' ? 'The filer will see this reason.' : accounts ? 'Approving closes the approval. The filer is told.' : 'Approving sends the complaint to the accounts team.'}
      />
      <Button variant={decision === 'REJECTED' ? 'danger' : 'primary'} onClick={run} isLoading={busy}>
        {decision === 'REJECTED' ? 'Reject complaint' : accounts ? 'Approve complaint' : 'Approve and send to accounts'}
      </Button>
    </div>
  );
}

// Complaints waiting on the signed-in person, and the decisions they made.
export default function ComplaintApprovalsPanel({ onChanged }) {
  const inbox = useList(complaintsApi.approvalInbox, REFRESH_MS);
  const history = useList(complaintsApi.approvalHistory);
  const [selected, setSelected] = useState(null);
  // A complaint opened from "My decisions", read on its own so the approver can see it and edit their comment.
  const [viewId, setViewId] = useState(null);
  const [viewed, setViewed] = useState(null);
  const [viewError, setViewError] = useState('');
  const loadViewed = (id) =>
    complaintsApi
      .get(id)
      .then((row) => (setViewed(row), setViewError(row ? '' : 'This complaint could not be found.')))
      .catch((err) => setViewError(err.message || 'This complaint could not be loaded.'));
  useEffect(() => {
    setViewed(null);
    setViewError('');
    if (viewId) loadViewed(viewId);
  }, [viewId]); // eslint-disable-line react-hooks/exhaustive-deps
  const [notice, setNotice] = useState('');

  const pending = inbox.data ?? [];
  const open = useMemo(() => pending.find((c) => c.id === selected) ?? null, [pending, selected]);

  const pendingColumns = [
    { key: 'complaint_no', label: 'Complaint', render: (c) => (
      <div>
        <p>{c.complaint_no}</p>
        <p className="text-theme-xs font-normal text-gray-500">{formatDate(c.created_at)}</p>
      </div>
    ) },
    { key: 'dealer_name', label: 'Dealer', render: (c) => (
      <div>
        <p className="max-w-[220px] truncate" title={c.dealer_name}>{c.dealer_name}</p>
        <p className="text-theme-xs font-normal text-gray-500">{c.dealer_code}</p>
      </div>
    ) },
    { key: 'filed_by_name', label: 'Filed by' },
    { key: 'amount', label: 'Amount', align: 'right', render: (c) => formatRupees(c.amount) },
    { key: 'status', label: 'Stage', render: (c) => <StatusChip status={COMPLAINT_STATUS_LABEL[c.status] || c.status} /> },
  ];

  const historyColumns = [
    { key: 'complaint_no', label: 'Complaint', render: (r) => (
      <div>
        <p>{r.complaint_no}</p>
        <p className="text-theme-xs font-normal text-gray-500">{formatDate(r.created_at)}</p>
      </div>
    ) },
    { key: 'dealer_name', label: 'Dealer', render: (r) => (
      <div>
        <p className="max-w-[220px] truncate" title={r.dealer_name}>{r.dealer_name}</p>
        <p className="text-theme-xs font-normal text-gray-500">{r.dealer_code}</p>
      </div>
    ) },
    { key: 'filed_by_name', label: 'Filed by' },
    { key: 'amount', label: 'Amount', align: 'right', render: (r) => formatRupees(r.amount) },
    { key: 'decision', label: 'My decision', render: (r) => <StatusChip status={r.decision === 'APPROVED' ? 'Approved' : 'Rejected'} /> },
    { key: 'stage', label: 'As', render: (r) => (r.stage === 'ACCOUNTS' ? 'Accounts team' : `Manager, level ${r.manager_level ?? '—'}`) },
    { key: 'reason', label: 'Remark or reason', render: (r) => <span className="whitespace-normal">{r.reason || '—'}</span> },
    { key: 'status', label: 'Now', render: (r) => <StatusChip status={COMPLAINT_STATUS_LABEL[r.status] || r.status} /> },
    { key: 'decided_at', label: 'When', render: (r) => formatDateTime(r.decided_at) },
  ];

  return (
    <div className="space-y-6">
      {notice && <Alert variant="success">{notice}</Alert>}
      {(inbox.error || history.error) && <Alert variant="error">{inbox.error || history.error}</Alert>}

      <DataTable
        title="Waiting for my approval"
        rows={pending}
        searchPlaceholder="Search complaint or dealer"
        searchFields={['complaint_no', 'dealer_name', 'dealer_code', 'filed_by_name']}
        columns={pendingColumns}
        onRowClick={(c) => setSelected(c.id)}
        empty={{ icon: 'complaints', title: inbox.loading ? 'Loading…' : 'Nothing is waiting on you', hint: inbox.loading ? '' : 'Complaints sent to you for approval will show here.' }}
      />

      <DataTable
        title="My decisions"
        rows={history.data ?? []}
        tabs={['All', 'Approved', 'Rejected']}
        tabMatch={(row, tab) => row.decision === tab.toUpperCase()}
        searchPlaceholder="Search complaint or dealer"
        searchFields={['complaint_no', 'dealer_name', 'dealer_code', 'filed_by_name']}
        columns={historyColumns}
        onRowClick={(row) => setViewId(row.complaint_id)}
        empty={{ icon: 'complaints', title: history.loading ? 'Loading…' : 'You have not decided any complaint yet' }}
      />

      <Modal open={Boolean(open)} size="xl" title={open ? open.dealer_name : ''} subtitle={open ? `Complaint ${open.complaint_no}` : ''} onClose={() => setSelected(null)}>
        {open && (
          <>
            <ComplaintDetails complaint={open} onChanged={() => inbox.reload(true)} />
            <DecisionForm
              complaint={open}
              onDone={(result) => {
                setNotice(result.emailError ? `${result.message} (Email not sent: ${result.emailError})` : result.message);
                setSelected(null);
                inbox.reload(true);
                history.reload(true);
                onChanged?.();
              }}
            />
          </>
        )}
      </Modal>

      <Modal open={Boolean(viewId)} size="xl" title={viewed ? viewed.dealer_name : 'Complaint'} subtitle={viewed ? `Complaint ${viewed.complaint_no}` : ''} onClose={() => setViewId(null)}>
        {viewError && <Alert variant="error">{viewError}</Alert>}
        {!viewed && !viewError && <p className="text-theme-sm text-gray-500">Loading…</p>}
        {viewed && (
          <ComplaintDetails
            complaint={viewed}
            onChanged={() => {
              loadViewed(viewId);
              history.reload(true);
              inbox.reload(true);
              onChanged?.();
            }}
          />
        )}
      </Modal>
    </div>
  );
}
