import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Alert from '../../components/common/Alert.jsx';
import Button from '../../components/common/Button.jsx';
import Modal from '../../components/common/Modal.jsx';
import DataTable from '../../components/ModulePage/DataTable.jsx';
import { StatusChip } from '../../components/ModulePage/ModulePage.jsx';
import { complaintsApi, COMPLAINT_STATUS_LABEL, FACTORY_ABOVE } from '../../api/complaintsApi';
import { formatDate, formatDateTime } from '../../utils/format.js';
import { complaintToPrint, downloadComplaint } from './printComplaint.js';
import { Req, TextArea, useList } from '../../modules/creditApproval/components.jsx';
import { INPUT, LABEL } from '../../components/common/formStyles.js';
import { useComplaintRights } from './ComplaintGate.jsx';

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
  branch_remarks: 'Branch remarks',
  factory_response: 'Factory response',
  physical_visit: 'Physical visit',
  invoice_copy: 'Invoice copy',
  photos: 'Site photographs',
  documents: 'Additional documents',
};

const FACTORY_RESPONSE = { SATISFIED: 'Satisfied', DISSATISFIED: 'Dissatisfied' };

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
    } else if (key === 'factory_response') {
      out.push(`Factory response: ${shown(FACTORY_RESPONSE[value.from])} → ${shown(FACTORY_RESPONSE[value.to])}`);
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

// How far a complaint has gone: filed, Coordinator, reporting manager, level
// approval, factory team (complaint value above the factory limit only), accounts
// (CN copy) and closed. Built from the complaint's status and the decisions on
// it, so the filer and every approver see the same picture.
const STEP_STYLE = {
  done: { ring: 'border-success-500 bg-success-500 text-white', line: 'bg-success-500', text: 'text-gray-800' },
  rejected: { ring: 'border-error-500 bg-error-500 text-white', line: 'bg-error-500', text: 'text-error-600' },
  current: { ring: 'border-warning-500 bg-warning-50 text-warning-700', line: 'bg-gray-200', text: 'text-warning-700' },
  skipped: { ring: 'border-gray-300 bg-gray-100 text-gray-400', line: 'bg-gray-200', text: 'text-gray-400' },
  pending: { ring: 'border-gray-300 bg-white text-gray-400', line: 'bg-gray-200', text: 'text-gray-400' },
};

// Where each waiting status sits in the route. Older statuses (REGISTERED and
// the like) are not in the list and count as not started.
const STATUS_POSITION = { PENDING_COORDINATOR: 0, PENDING_MANAGER: 1, PENDING_LEVEL: 2, PENDING_FACTORY: 3, PENDING_ACCOUNTS: 4, CLOSED: 5, APPROVED: 5 };

export function complaintSteps(complaint, decisions = [], route = null) {
  const status = complaint.status;
  const position = STATUS_POSITION[status];
  const by = (d) => `${d.approver_name || '—'} · ${formatDateTime(d.decided_at)}`;

  // One approval step: its decision if there is one, "current" while it holds
  // the complaint, "skipped" once the route has moved past it, else not started.
  // `upcomingNote` names who the step will go to, before it gets there.
  const approvalStep = (stage, index, waitingNote, skippedNote, upcomingNote = '') => {
    const d = decisions.find((x) => x.stage === stage);
    if (d) return { state: d.decision === 'APPROVED' ? 'done' : 'rejected', note: by(d), detail: d.reason };
    if (position === index) return { state: 'current', note: waitingNote };
    if (status === 'REJECTED') return { state: 'skipped', note: 'Not reached' };
    if (position !== undefined && position > index) return { state: 'skipped', note: skippedNote };
    return { state: 'pending', note: upcomingNote };
  };
  // The name goes in the step's title, in brackets. For a step not reached yet it comes
  // from the route; once the step holds the complaint or is decided, from the complaint.
  const dateOnly = (step, d) => (d ? { ...step, note: formatDateTime(d.decided_at) } : step);
  const withName = (base, name) => (name ? `${base} (${name})` : base);

  const decisionOf = (stage) => decisions.find((x) => x.stage === stage);
  const dManager = decisionOf('MANAGER');
  const dLevel = decisionOf('LEVEL');
  const managerName = dManager?.approver_name || (position === 1 ? complaint.current_approver_name : '') || route?.manager?.name || '';
  const levelName = dLevel?.approver_name || (position === 2 ? complaint.current_approver_name : '') || route?.level?.name || '';
  const levelNo = dLevel?.manager_level || (position === 2 ? complaint.manager_level : null) || route?.level?.level || null;

  const coordinatorStep = approvalStep('COORDINATOR', 0, 'Coordinator', 'Not needed');
  const managerStep = dateOnly(approvalStep('MANAGER', 1, 'Waiting for approval', 'No manager found', route && !route.manager ? 'No manager found' : ''), dManager);
  const levelStep = dateOnly(approvalStep('LEVEL', 2, 'Waiting for approval', 'Not needed', route && !route.level ? 'Not needed' : ''), dLevel);
  const factoryStep = approvalStep('FACTORY', 3, 'Factory team', `Not needed (up to ₹${FACTORY_ABOVE.toLocaleString('en-IN')})`);
  const accountsStep = approvalStep('ACCOUNTS', 4, 'Accounts team', 'Not needed');

  const finalStep = status === 'CLOSED'
    ? { label: 'Closed', state: 'done', note: [complaint.closed_at ? formatDateTime(complaint.closed_at) : '', complaint.cn_number ? `CN ${complaint.cn_number}` : ''].filter(Boolean).join(' · ') }
    : status === 'APPROVED'
      ? { label: 'Approved', state: 'done', note: complaint.approved_at ? formatDateTime(complaint.approved_at) : '' }
      : status === 'REJECTED'
        ? { label: 'Rejected', state: 'rejected', note: complaint.rejection_reason || '' }
        : status === 'RESOLVED'
          ? { label: 'Resolved', state: 'done', note: '' }
          : { label: 'Closed', state: 'pending', note: '' };

  return [
    { label: 'Filed', state: 'done', note: `${complaint.filed_by_name || '—'} · ${formatDateTime(complaint.created_at)}` },
    { label: 'Coordinator review', ...coordinatorStep },
    { label: withName('Reporting manager', managerName), ...managerStep },
    { label: withName(levelNo ? `Level ${levelNo} approval` : 'Level approval', levelName), ...levelStep },
    { label: 'Factory team', ...factoryStep },
    { label: 'Accounts (CN)', ...accountsStep },
    finalStep,
  ];
}

export function ComplaintStepper({ complaint, decisions, route }) {
  const steps = complaintSteps(complaint, decisions, route);
  return (
    <ol className="mb-6 grid grid-cols-2 gap-y-4 sm:grid-cols-7 sm:gap-y-0">
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
              {step.note && <p className="mt-0.5 max-w-[140px] text-theme-xs text-gray-500">{step.note}</p>}
              {step.detail && <p className="mt-0.5 max-w-[140px] truncate text-theme-xs italic text-gray-500" title={step.detail}>{step.detail}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// How a decision-maker is named: "Complaint Coordinator", "accounts team", "factory team",
// "reporting manager, level 1" or "level approver, level 3".
const stageName = (stage, level) =>
  stage === 'COORDINATOR'
    ? 'Complaint Coordinator'
    : stage === 'ACCOUNTS'
      ? 'accounts team'
      : stage === 'FACTORY'
        ? 'factory team'
        : stage === 'LEVEL'
          ? `level approver, level ${level ?? '—'}`
          : `reporting manager${level ? `, level ${level}` : ''}`;

// May this person decide the complaint right now?
export function canDecide(complaint, user, access) {
  if (!complaint || !user) return false;
  const superAdmin = Boolean(user.roles?.includes('SUPERADMIN'));
  if (complaint.status === 'PENDING_COORDINATOR') return superAdmin || Boolean(access?.isCoordinator);
  if (complaint.status === 'PENDING_MANAGER' || complaint.status === 'PENDING_LEVEL') return superAdmin || complaint.current_approver_id === user.id;
  if (complaint.status === 'PENDING_FACTORY') return superAdmin || Boolean(access?.isFactory);
  if (complaint.status === 'PENDING_ACCOUNTS') return superAdmin || Boolean(access?.isAccounts);
  return false;
}

// Everything on one complaint, read only: the form, the product lines, the
// evidence files and the decisions taken so far.
// The status tag shown in a modal's title row.
export function StageTag({ text }) {
  if (!text) return null;
  // Green once approved, red once rejected, amber while it waits on someone.
  const tone = text.startsWith('Approved') || text.startsWith('Closed')
    ? 'border-success-200 bg-success-50 text-success-700'
    : text.startsWith('Rejected')
      ? 'border-error-200 bg-error-50 text-error-700'
      : 'border-warning-200 bg-warning-50 text-warning-700';
  return (
    <span className={`inline-block max-w-[300px] truncate rounded-full border px-3.5 py-1.5 text-theme-sm font-semibold shadow-theme-xs ${tone}`} title={text}>
      Status: {text}
    </span>
  );
}

export function ComplaintDetails({ complaint, onChanged, onStage }) {
  const [files, setFiles] = useState([]);
  const [decisions, setDecisions] = useState([]);
  const [rights, setRights] = useState(null);
  const [editLog, setEditLog] = useState([]);
  // Who the manager and level steps will go to. Empty until the route function is in the database.
  const [route, setRoute] = useState(null);
  const navigate = useNavigate();
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
    complaintsApi.routePreview(complaint.id).then((r) => !cancelled && setRoute(r)).catch(() => !cancelled && setRoute(null));
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
  const stageLabel = complaint.status === 'PENDING_COORDINATOR'
    ? 'Waiting on the Complaint Coordinator'
    : complaint.status === 'PENDING_MANAGER'
    ? `Waiting on ${complaint.current_approver_name || 'the reporting manager'}${complaint.manager_level ? ` (level ${complaint.manager_level}${complaint.requested_level && complaint.requested_level !== complaint.manager_level ? `, band asked for level ${complaint.requested_level}` : ''})` : ''}`
    : complaint.status === 'PENDING_LEVEL'
      ? `Waiting on ${complaint.current_approver_name || 'the level approver'}${complaint.manager_level ? ` (level ${complaint.manager_level}${complaint.requested_level && complaint.requested_level !== complaint.manager_level ? `, band asked for level ${complaint.requested_level}` : ''})` : ''} to approve a complaint value of ${formatRupees(complaint.amount)}`
      : complaint.status === 'PENDING_FACTORY'
        ? `Waiting on the factory team (complaint value ${formatRupees(complaint.amount)})`
        : complaint.status === 'PENDING_ACCOUNTS'
          ? 'Waiting on the accounts team. The CN copy is needed to close it.'
          : null;

  // Where the complaint stands now: who holds it, or who took the last decision.
  const lastDecision = decisions.length > 0 ? decisions[decisions.length - 1] : null;
  const currentStage = complaint.status === 'PENDING_COORDINATOR'
    ? 'Pending with the Complaint Coordinator'
    : complaint.status === 'PENDING_MANAGER'
    ? `Pending with ${complaint.current_approver_name || 'the reporting manager'}`
    : complaint.status === 'PENDING_LEVEL'
      ? `Pending with ${complaint.current_approver_name || 'the level approver'}`
      : complaint.status === 'PENDING_FACTORY'
        ? 'Pending with the factory team'
        : complaint.status === 'PENDING_ACCOUNTS'
          ? 'Pending with the accounts team'
          : complaint.status === 'CLOSED'
            ? `Closed${lastDecision ? ` by ${lastDecision.approver_name || '—'}` : ''}`
            : lastDecision
        ? `${lastDecision.decision === 'APPROVED' ? 'Approved' : 'Rejected'} by ${lastDecision.approver_name || '—'} (${stageName(lastDecision.stage, lastDecision.manager_level)})`
        : '';

  // Lets the modal show the status in its title row.
  useEffect(() => {
    onStage?.(currentStage);
    return () => onStage?.('');
  }, [currentStage, onStage]);

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
      {editNotice && <Alert variant="success" className="mb-5">{editNotice}</Alert>}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <span className="text-theme-sm font-semibold text-gray-800">{complaint.complaint_no}</span>
        <StatusChip status={COMPLAINT_STATUS_LABEL[complaint.status] || complaint.status} />
        <span className="text-theme-xs text-gray-500">Filed {formatDateTime(complaint.created_at)} by {complaint.filed_by_name || '—'}</span>
        {rights?.canEditComplaint && (
          <Button variant="secondary" size="sm" className="ml-auto" onClick={() => navigate(`../edit/${complaint.id}`, { relative: 'path' })}>
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
        {currentStage && !onStage && (
          <span className="rounded-full bg-gray-100 px-3 py-1 text-theme-xs font-medium text-gray-700" title={currentStage}>
            Status: {currentStage}
          </span>
        )}
      </div>
      {downloadError && <Alert variant="error" className="mb-5">{downloadError}</Alert>}
      {complaint.edited_at && (
        <p className="-mt-3 mb-5 text-theme-xs text-gray-500">
          Edited {formatDateTime(complaint.edited_at)} by {complaint.edited_by_name || '—'} (version {complaint.version}).
        </p>
      )}
      <ComplaintStepper complaint={complaint} decisions={decisions} route={route} />
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
                  {d.decision === 'APPROVED' ? 'Approved' : 'Rejected'} by {d.approver_name || '—'} ({stageName(d.stage, d.manager_level)}) · {formatDateTime(d.decided_at)}
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
          {complaint.cn_number && <Item label="CN number" value={complaint.cn_number} />}
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
          <Item label="Dealer / Customer Remarks" value={complaint.remarks} />
          <Item label="Branch Remarks" value={complaint.branch_remarks} />
          <Item label="Target Close Date" value={complaint.target_close_date ? formatDate(complaint.target_close_date) : ''} />
          <Item label="Actual Close Date" value={complaint.actual_close_date ? formatDate(complaint.actual_close_date) : ''} />
          <Item label="Factory Response" value={FACTORY_RESPONSE[complaint.factory_response]} />
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

const CN_MAX_BYTES = 10 * 1024 * 1024;
const digitsOnly = (value) => String(value ?? '').replace(/[^\d.]/g, '');
const withCommas = (value) => {
  const raw = digitsOnly(value);
  if (raw === '') return '';
  const [whole, frac] = raw.split('.');
  return Number(whole).toLocaleString('en-IN') + (frac !== undefined ? `.${frac}` : '');
};

// The approval level a complaint value needs, from the active bands.
function levelFor(bands, value) {
  const hits = bands.filter((b) => value >= b.min && (b.max === null || value <= b.max));
  return hits.length ? hits.sort((a, b) => b.min - a.min)[0].level : null;
}

export function DecisionForm({ complaint, onDone }) {
  const [decision, setDecision] = useState('APPROVED');
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const status = complaint.status;
  const accounts = status === 'PENDING_ACCOUNTS';
  const coordinator = status === 'PENDING_COORDINATOR';
  const manager = status === 'PENDING_MANAGER';
  const factory = status === 'PENDING_FACTORY';
  // The complaint value is the compensation. Whoever approves may change it.
  const [value, setValue] = useState(() => digitsOnly(complaint.amount));
  const [cnNumber, setCnNumber] = useState('');
  const [cnFile, setCnFile] = useState(null);
  const [bands, setBands] = useState([]);

  useEffect(() => {
    if (manager) complaintsApi.bands().then(setBands).catch(() => setBands([]));
  }, [manager]);

  const valueNumber = Number(value);
  const changed = valueNumber > 0 && valueNumber !== Number(complaint.amount);
  const needLevel = manager && valueNumber > 0 ? levelFor(bands, valueNumber) : null;
  // Where the complaint goes next, from the value now in the box.
  const route = !(valueNumber > 0)
    ? ''
    : manager
      ? needLevel === null
        ? bands.length ? 'No approval band covers this value. Ask a Super Admin to set the bands.' : ''
        : `Next: level ${needLevel} approval, then ${valueNumber > FACTORY_ABOVE ? 'the factory team, then ' : ''}the accounts team.`
      : status === 'PENDING_LEVEL'
        ? `Next: ${valueNumber > FACTORY_ABOVE ? 'the factory team, then ' : ''}the accounts team.`
        : '';

  async function run() {
    const approving = decision === 'APPROVED';
    if (!text.trim()) {
      setError(approving ? 'A remark is needed to approve.' : 'A reason is needed to reject.');
      return;
    }
    if (approving && !coordinator && !(valueNumber > 0)) {
      setError('Enter the complaint value.');
      return;
    }
    if (approving && accounts && !cnFile) {
      setError('Attach the CN copy to approve and close this complaint.');
      return;
    }
    if (approving && accounts && cnFile.size > CN_MAX_BYTES) {
      setError('The CN copy is too large. Keep it under 10 MB.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const cnPath = approving && accounts ? await complaintsApi.uploadCn(complaint.id, cnFile) : undefined;
      const result = await complaintsApi.decide({
        complaintId: complaint.id,
        decision,
        reason: text,
        version: complaint.version,
        amount: approving && !coordinator ? valueNumber : undefined,
        cnPath,
        cnNumber: approving && accounts ? cnNumber : undefined,
      });
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
      {decision === 'APPROVED' && !coordinator && (
        <div className="mb-4 max-w-sm">
          <label className={LABEL} htmlFor="complaint-value"><Req>Complaint value (₹)</Req></label>
          <input
            id="complaint-value"
            className={INPUT}
            inputMode="decimal"
            value={withCommas(value)}
            onChange={(e) => (setValue(digitsOnly(e.target.value)), setError(''))}
          />
          <p className="mt-1 text-theme-xs text-gray-500">
            {changed ? `Changed from ${formatRupees(complaint.amount)}. The change is saved in the edit history.` : 'Change the value if it is not right.'}
            {route && <span className="mt-0.5 block font-medium text-gray-700">{route}</span>}
          </p>
        </div>
      )}
      {decision === 'APPROVED' && accounts && (
        <div className="mb-4 grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={LABEL} htmlFor="complaint-cn-copy"><Req>CN copy</Req></label>
            <input
              id="complaint-cn-copy"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
              className={INPUT}
              onChange={(e) => (setCnFile(e.target.files?.[0] ?? null), setError(''))}
            />
            <p className="mt-1 text-theme-xs text-gray-500">PDF or image, up to 10 MB.</p>
          </div>
          <div>
            <label className={LABEL} htmlFor="complaint-cn-number">CN number</label>
            <input id="complaint-cn-number" className={INPUT} value={cnNumber} maxLength={100} onChange={(e) => setCnNumber(e.target.value)} placeholder="Optional" />
          </div>
        </div>
      )}
      <TextArea
        id="complaint-decision-text"
        label={decision === 'REJECTED' ? <Req>Reason</Req> : <Req>{factory ? 'Factory remark' : 'Remark'}</Req>}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setError('');
        }}
        error={error}
        placeholder={
          decision === 'REJECTED'
            ? 'The filer will see this reason. The complaint goes no further.'
            : accounts
              ? 'Approving closes the complaint. The filer is told.'
              : coordinator
                ? 'Completing the review locks the filing and sends the complaint to the reporting manager.'
                : manager
                  ? 'Your remarks on the complaint.'
                  : factory
                    ? 'Approving sends the complaint to the accounts team.'
                    : 'Approving sends the complaint on to the next step.'
        }
      />
      <Button variant={decision === 'REJECTED' ? 'danger' : 'primary'} onClick={run} isLoading={busy}>
        {decision === 'REJECTED'
          ? 'Reject complaint'
          : accounts
            ? 'Approve and close complaint'
            : coordinator
              ? 'Complete review and send on'
              : factory
                ? 'Approve and send to accounts'
                : 'Approve and send on'}
      </Button>
    </div>
  );
}

// Closed complaints, newest first. Only the accounts team and the Coordinators
// (and a Super Admin) get the table; the database decides what each person may read.
const loadClosed = () => complaintsApi.closed({ pageSize: 200 }).then((r) => r.rows);
const loadWithManager = () => complaintsApi.withManager();

const STAGE_LABEL = { COORDINATOR: 'Complaint Coordinator', ACCOUNTS: 'Accounts team', FACTORY: 'Factory team' };

// Complaints waiting on the signed-in person, and the decisions they made.
export default function ComplaintApprovalsPanel({ onChanged }) {
  const { access, rights } = useComplaintRights();
  const canSeeClosed = rights.isSuperAdmin || Boolean(access?.isAccounts || access?.isCoordinator);
  const inbox = useList(complaintsApi.approvalInbox, REFRESH_MS);
  const history = useList(complaintsApi.approvalHistory);
  const closed = useList(loadClosed);
  const isCoordinator = Boolean(access?.isCoordinator);
  const withManager = useList(loadWithManager, isCoordinator ? REFRESH_MS : 0);
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
  const [openStage, setOpenStage] = useState('');
  const [viewStage, setViewStage] = useState('');

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
    { key: 'stage', label: 'As', render: (r) => STAGE_LABEL[r.stage] || (r.stage === 'LEVEL' ? `Level approver, level ${r.manager_level ?? '—'}` : `Reporting manager${r.manager_level ? `, level ${r.manager_level}` : ''}`) },
    { key: 'reason', label: 'Remark or reason', render: (r) => <span className="whitespace-normal">{r.reason || '—'}</span> },
    { key: 'status', label: 'Now', render: (r) => <StatusChip status={COMPLAINT_STATUS_LABEL[r.status] || r.status} /> },
    { key: 'decided_at', label: 'When', render: (r) => formatDateTime(r.decided_at) },
  ];

  const closedColumns = [
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
    { key: 'cn_number', label: 'CN number', render: (r) => r.cn_number || '—' },
    { key: 'closed_at', label: 'Closed on', render: (r) => (r.closed_at ? formatDate(r.closed_at) : '—') },
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

      {isCoordinator && (
        <DataTable
          title="With the reporting manager (you can still edit)"
          rows={withManager.data ?? []}
          searchPlaceholder="Search complaint or dealer"
          searchFields={['complaint_no', 'dealer_name', 'dealer_code', 'filed_by_name']}
          columns={[
            ...pendingColumns.filter((c) => c.key !== 'status'),
            { key: 'current_approver_name', label: 'With', render: (c) => c.current_approver_name || '—' },
          ]}
          onRowClick={(row) => setViewId(row.id)}
          empty={{ icon: 'complaints', title: withManager.loading ? 'Loading…' : 'No complaint is with the reporting manager', hint: withManager.loading ? '' : 'You can edit a complaint here until the reporting manager approves it.' }}
        />
      )}

      {canSeeClosed && (
        <DataTable
          title="Closed complaints"
          rows={closed.data ?? []}
          searchPlaceholder="Search complaint, dealer or CN number"
          searchFields={['complaint_no', 'dealer_name', 'dealer_code', 'filed_by_name', 'cn_number']}
          columns={closedColumns}
          onRowClick={(row) => setViewId(row.id)}
          empty={{ icon: 'complaints', title: closed.loading ? 'Loading…' : 'No complaint is closed yet', hint: closed.loading ? '' : 'Complaints closed after CN processing show here.' }}
        />
      )}

      <Modal open={Boolean(open)} size="xl" title={open ? open.dealer_name : ''} subtitle={open ? `Complaint ${open.complaint_no}` : ''} onClose={() => setSelected(null)} headerExtra={<StageTag text={openStage} />}>
        {open && (
          <>
            <ComplaintDetails complaint={open} onChanged={() => inbox.reload(true)} onStage={setOpenStage} />
            <DecisionForm
              complaint={open}
              onDone={(result) => {
                setNotice(result.emailError ? `${result.message} (Email not sent: ${result.emailError})` : result.message);
                setSelected(null);
                inbox.reload(true);
                history.reload(true);
                closed.reload(true);
                onChanged?.();
              }}
            />
          </>
        )}
      </Modal>

      <Modal open={Boolean(viewId)} size="xl" title={viewed ? viewed.dealer_name : 'Complaint'} subtitle={viewed ? `Complaint ${viewed.complaint_no}` : ''} onClose={() => setViewId(null)} headerExtra={<StageTag text={viewStage} />}>
        {viewError && <Alert variant="error">{viewError}</Alert>}
        {!viewed && !viewError && <p className="text-theme-sm text-gray-500">Loading…</p>}
        {viewed && (
          <ComplaintDetails
            complaint={viewed}
            onStage={setViewStage}
            onChanged={() => {
              loadViewed(viewId);
              history.reload(true);
              inbox.reload(true);
              withManager.reload(true);
              onChanged?.();
            }}
          />
        )}
      </Modal>
    </div>
  );
}
