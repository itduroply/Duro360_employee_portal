import { useCallback, useEffect, useState } from 'react';
import Alert from '../../components/common/Alert.jsx';
import Button from '../../components/common/Button.jsx';
import { INPUT, INPUT_OK, INPUT_ERROR, HINT_ERROR, LABEL } from '../../components/common/formStyles.js';
import { supabase } from '../../lib/supabaseClient.js';
import { creditApi } from './api/creditApi.js';
import { AGEING_BUCKETS, formatDate, formatDateTime, formatWhen, requestTypeOf, rupees } from './lib/format.js';

// Red asterisk for a required field label.
export function Req({ children }) {
  return (
    <>
      {children} <span className="text-error-500">*</span>
    </>
  );
}

const PILL = 'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-theme-xs font-medium';
const STATUS_TONE = {
  Pending: 'bg-warning-50 text-warning-700',
  Approved: 'bg-success-50 text-success-700',
  Rejected: 'bg-error-50 text-error-700',
  Referred: 'bg-gray-100 text-gray-600',
  Forwarded: 'bg-brand-50 text-brand-600',
  Closed: 'bg-gray-800 text-white',
};

export function StatusPill({ status }) {
  return (
    <span className={`${PILL} ${STATUS_TONE[status] || 'bg-gray-100 text-gray-600'}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" aria-hidden="true" />
      {status}
    </span>
  );
}

export function TypePill({ value }) {
  const type = requestTypeOf(value);
  return (
    <span className={`${PILL} ${type === 'Permanent' ? 'bg-gray-800 text-white' : 'border border-gray-300 text-gray-700'}`}>{type}</span>
  );
}

export function NoteBadge({ children, tone = 'warning' }) {
  const tones = { warning: 'bg-warning-50 text-warning-700', brand: 'bg-brand-50 text-brand-600' };
  return <span className={`${PILL} ${tones[tone]}`}>{children}</span>;
}

// A multi-line box that matches the portal's inputs.
export function TextArea({ id, label, value, onChange, error, placeholder, rows = 3 }) {
  return (
    <div className="mb-4">
      {label && (
        <label htmlFor={id} className={LABEL}>
          {label}
        </label>
      )}
      <textarea
        id={id}
        rows={rows}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`${INPUT} ${error ? INPUT_ERROR : INPUT_OK} !h-auto resize-y`}
      />
      {error && <p className={HINT_ERROR}>{error}</p>}
    </div>
  );
}

const FILE_ACCEPT = '.pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx';
const MAX_FILES = 5;
const MAX_MB = 10;

const fileSize = (bytes) => (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

// Files chosen for the next query or reply. Each file is stored as soon as it
// is chosen. `value` is the list of stored files that will be sent with the message.
export function AttachmentPicker({ requisitionId, value, onChange }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function pick(event) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length === 0) return;
    if (value.length + files.length > MAX_FILES) {
      setError(`Attach at most ${MAX_FILES} files.`);
      return;
    }
    const tooBig = files.find((f) => f.size > MAX_MB * 1048576);
    if (tooBig) {
      setError(`${tooBig.name} is larger than ${MAX_MB} MB.`);
      return;
    }
    setBusy(true);
    setError('');
    const stored = [];
    try {
      for (const file of files) stored.push(await creditApi.uploadAttachment(requisitionId, file));
    } catch (err) {
      setError(err.message || 'The file could not be uploaded.');
    } finally {
      setBusy(false);
      if (stored.length) onChange([...value, ...stored]);
    }
  }

  return (
    <div className="mb-4">
      <span className={LABEL}>Attach files (optional)</span>
      <ul className="mb-2 flex flex-col gap-1.5">
        {value.map((f) => (
          <li key={f.path} className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2 text-theme-sm text-gray-800">
            <span className="min-w-0 truncate">{f.name} <span className="text-theme-xs text-gray-500">· {fileSize(f.size)}</span></span>
            <button type="button" className="shrink-0 text-theme-xs font-medium text-error-600 hover:underline" onClick={() => onChange(value.filter((x) => x.path !== f.path))}>
              Remove
            </button>
          </li>
        ))}
      </ul>
      <label className={`inline-flex cursor-pointer items-center rounded-lg px-4 py-2 text-theme-sm font-medium ring-1 ring-inset ring-gray-300 ${busy ? 'bg-gray-100 text-gray-400' : 'bg-white text-gray-700 hover:bg-gray-50'}`}>
        {busy ? 'Uploading…' : 'Choose files'}
        <input type="file" multiple accept={FILE_ACCEPT} className="hidden" disabled={busy} onChange={pick} />
      </label>
      <p className="mt-1.5 text-theme-xs text-gray-500">PDF, image, Word or Excel. Up to {MAX_FILES} files, {MAX_MB} MB each.</p>
      {error && <p className={HINT_ERROR}>{error}</p>}
    </div>
  );
}

// The files on one message, as download links.
export function AttachmentLinks({ files }) {
  if (!files?.length) return null;
  return (
    <ul className="mt-1.5 flex flex-col gap-1">
      {files.map((f) => (
        <li key={f.url || f.name} className="text-theme-xs">
          {f.url ? (
            <a href={f.url} target="_blank" rel="noreferrer" className="font-medium text-brand-600 hover:underline">
              {f.name}
            </a>
          ) : (
            <span className="text-gray-500">{f.name} (link not available)</span>
          )}
          <span className="text-gray-500"> · {fileSize(f.size)}</span>
        </li>
      ))}
    </ul>
  );
}

function Item({ label, value }) {
  return (
    <div>
      <p className="text-theme-xs text-gray-500">{label}</p>
      <p className="mt-0.5 text-theme-sm font-medium text-gray-800">{value || '—'}</p>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="mb-5 last:mb-0">
      <h4 className="mb-2.5 text-theme-xs font-semibold uppercase tracking-[0.08em] text-gray-500">{title}</h4>
      {children}
    </section>
  );
}

// Everything the Requester entered, read only.
export function RequestDetails({ request }) {
  const total = AGEING_BUCKETS.reduce((sum, b) => sum + (Number(request[b.key]) || 0), 0);
  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <span className="text-theme-sm font-semibold text-gray-800">{request.ref}</span>
        <TypePill value={request.requestType} />
        <StatusPill status={request.status} />
        <span className="text-theme-xs text-gray-500">Sent {formatDateTime(request.sentAt)}</span>
        {request.totalLevels > 1 && <NoteBadge tone="brand">Level {request.approvalStage} of {request.totalLevels}</NoteBadge>}
      </div>

      {(request.earlierApprovals ?? []).map((a) => (
        <div key={a.level} className="mb-5 rounded-xl border border-success-200 bg-success-50 p-4 text-theme-sm">
          <p className="font-semibold text-gray-800">
            Level {a.level} approved by {a.byName} · {formatDateTime(a.at)}
          </p>
          {a.remark && <p className="mt-1 whitespace-pre-wrap text-gray-700">{a.remark}</p>}
        </div>
      ))}

      <Section title="Branch and dealer">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Item label="Branch" value={request.branchName} />
          <Item label="Branch code" value={request.branchCode} />
          <Item label="Dealer" value={request.dealerName} />
          <Item label="Dealer code" value={request.dealerCode} />
        </div>
      </Section>

      <Section title="Business and existing credit">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Item label="Current year" value={rupees(request.currentYearBusiness)} />
          <Item label="Previous year" value={rupees(request.previousYearBusiness)} />
          <Item label="Assigned limit" value={rupees(request.assignedLimit)} />
          <Item label="Assigned days" value={request.assignedDays} />
        </div>
      </Section>

      <Section title="Overdue and outstanding">
        <div className="custom-scrollbar overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-left text-theme-sm">
            <thead className="bg-gray-50 text-theme-xs text-gray-500">
              <tr>
                {AGEING_BUCKETS.map((b) => (
                  <th key={b.key} className="px-3 py-2 font-medium">{b.label} days</th>
                ))}
                <th className="px-3 py-2 font-semibold text-gray-700">Total</th>
              </tr>
            </thead>
            <tbody>
              <tr className="text-gray-800">
                {AGEING_BUCKETS.map((b) => (
                  <td key={b.key} className="whitespace-nowrap px-3 py-2">{rupees(request[b.key])}</td>
                ))}
                <td className="whitespace-nowrap px-3 py-2 font-semibold">{rupees(total)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      {requestTypeOf(request.requestType) === 'Permanent' ? <PermanentSections request={request} /> : (
        <Section title="Request">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Item label="Amount to be billed" value={rupees(request.amountToBeBilled)} />
            <Item label="Proposed credit limit" value={rupees(request.tempCreditAmount)} />
            <Item label="Valid up to" value={formatDate(request.validUpTo)} />
            <Item label="Days needed" value={request.daysNeeded} />
            <Item label="Expected payment date" value={formatDate(request.paymentReceiveDate)} />
            <Item label="Requester" value={request.requesterName} />
          </div>
          {request.remark && (
            <div className="mt-4">
              <Item label="Remark" value={request.remark} />
            </div>
          )}
        </Section>
      )}
    </div>
  );
}

const perMonth = (value) => (value === null || value === undefined ? '—' : value);

// The request section of a Permanent request: the payment record and the
// Temporary unlock counts, as they were when the request was sent.
function PermanentSections({ request }) {
  const unlocks = request.temporaryUnlocks;
  return (
    <>
      <Section title="Request">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Item label="Proposed credit limit" value={rupees(request.tempCreditAmount)} />
          <Item label="Proposed credit days" value={request.proposedCreditDays} />
          <Item label="Average actual payment days" value={request.averagePaymentDays} />
          <Item label="Cheque bounce count" value={request.chequeBounceCount} />
          <Item label="Last revision date" value={formatWhen(request.lastRevisionDate)} />
          <Item label="Requester" value={request.requesterName} />
        </div>
        {request.limitEditedByName && (
          <Alert variant="info" className="mt-4">
            {request.limitEditedByName} changed these figures at the first level. The Requester asked for {rupees(request.requestedCreditAmount)}
            {request.requestedCreditDays ? ` and ${request.requestedCreditDays} days` : ''}.
          </Alert>
        )}
        {request.remark && (
          <div className="mt-4">
            <Item label="Remark" value={request.remark} />
          </div>
        )}
      </Section>

      {unlocks && (
        <Section title={`Temporary unlock requests per month · ${unlocks.financialYear?.label ?? ''}`}>
          <p className="mb-2 text-theme-sm text-gray-700">
            Unlocked this month: <span className="font-semibold text-gray-800">{unlocks.thisMonth}</span>
          </p>
          <div className="custom-scrollbar overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-left text-theme-sm">
              <thead className="bg-gray-50 text-theme-xs text-gray-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Quarter</th>
                  <th className="px-3 py-2 text-right font-medium">Requests</th>
                  <th className="px-3 py-2 text-right font-medium">Average per month</th>
                </tr>
              </thead>
              <tbody>
                {unlocks.quarters.map((q) => (
                  <tr key={q.label} className="border-t border-gray-100 text-gray-800">
                    <td className="whitespace-nowrap px-3 py-2">{q.label} <span className="text-theme-xs text-gray-500">({q.range})</span></td>
                    <td className="px-3 py-2 text-right">{q.count}</td>
                    <td className="px-3 py-2 text-right">{perMonth(q.averagePerMonth)}</td>
                  </tr>
                ))}
                <tr className="border-t border-gray-200 bg-gray-50 font-semibold text-gray-800">
                  <td className="px-3 py-2">{unlocks.financialYear?.label}</td>
                  <td className="px-3 py-2 text-right">{unlocks.total}</td>
                  <td className="px-3 py-2 text-right">{perMonth(unlocks.averagePerMonth)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Section>
      )}
    </>
  );
}

// Questions and replies on one request. A Requester can reply only while the
// last message is a query that nobody has answered.
export function QueryThread({ requisitionId, canReply = false, reloadKey = 0, onChanged }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [reply, setReply] = useState('');
  const [replyError, setReplyError] = useState('');
  const [replyFiles, setReplyFiles] = useState([]);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await creditApi.getQueryThread(requisitionId));
      setError('');
    } catch (err) {
      setError(err.message || 'Could not load the conversation.');
    }
  }, [requisitionId]);

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  async function send() {
    if (!reply.trim()) {
      setReplyError('Enter a reply before sending.');
      return;
    }
    setSending(true);
    setReplyError('');
    try {
      await creditApi.replyQuery(requisitionId, reply, replyFiles);
      setReply('');
      setReplyFiles([]);
      await load();
      onChanged?.();
    } catch (err) {
      setReplyError(err.message || 'Could not send the reply.');
    } finally {
      setSending(false);
    }
  }

  if (error) return <Alert variant="error">{error}</Alert>;
  if (!data) return <p className="text-theme-sm text-gray-500">Loading…</p>;

  return (
    <div>
      {data.thread.length === 0 && !data.decision && !data.earlierApprovals?.length &&<p className="text-theme-sm text-gray-500">No questions on this request.</p>}
      {data.earlierApprovals?.map((a) => (
        <div key={a.level} className="mb-4 rounded-xl border border-success-200 bg-success-50 p-4 text-theme-sm">
          <p className="font-semibold text-gray-800">
            Level {a.level} approved by {a.byName} · {formatDateTime(a.at)}
          </p>
          {a.text && <p className="mt-1 whitespace-pre-wrap text-gray-700">{a.text}</p>}
          <AttachmentLinks files={a.attachments} />
        </div>
      ))}
      {data.decision && (
        <div className={`mb-4 rounded-xl border p-4 text-theme-sm ${data.decision.kind === 'Approved' ? 'border-success-200 bg-success-50' : 'border-error-200 bg-error-50'}`}>
          <p className="font-semibold text-gray-800">
            {data.decision.kind} by {data.decision.byName} · {formatDateTime(data.decision.at)}
          </p>
          {data.decision.text && <p className="mt-1 whitespace-pre-wrap text-gray-700">{data.decision.text}</p>}
          <AttachmentLinks files={data.decision.attachments} />
        </div>
      )}
      <ul className="mb-4 flex flex-col gap-2.5">
        {data.thread.map((m) => (
          <li
            key={m.id}
            className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-theme-sm ${
              m.type === 'query' ? 'self-start bg-gray-100 text-gray-800' : 'self-end bg-brand-50 text-gray-800'
            }`}
          >
            <p className="mb-0.5 text-theme-xs font-medium text-gray-500">
              {m.byName} · {m.type === 'query' ? 'Query' : 'Reply'} · {formatDateTime(m.at)}
            </p>
            <p className="whitespace-pre-wrap">{m.message}</p>
            <AttachmentLinks files={m.attachments} />
          </li>
        ))}
      </ul>

      {canReply && data.awaitingReply && (
        <div>
          <TextArea
            id="cr-reply"
            label={<Req>Your reply</Req>}
            value={reply}
            onChange={(e) => {
              setReply(e.target.value);
              setReplyError('');
            }}
            error={replyError}
            placeholder="Answer the approver's question"
          />
          <AttachmentPicker requisitionId={requisitionId} value={replyFiles} onChange={setReplyFiles} />
          <Button onClick={send} isLoading={sending}>
            Send reply
          </Button>
        </div>
      )}
    </div>
  );
}

// Loads a list and reloads on demand. `refreshMs` polls while the page is open.
// topics are Realtime channels (see 20261102130000_credit_realtime_ping.sql).
// When the database says a request changed, the list loads again, quietly.
export function useList(loader, refreshMs = 0, topics = []) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const reload = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      try {
        setData(await loader());
        setError('');
      } catch (err) {
        setError(err.message || 'Could not load the list.');
      } finally {
        setLoading(false);
      }
    },
    [loader]
  );

  useEffect(() => {
    reload();
    if (!refreshMs) return undefined;
    // A hidden tab is not read, so it does not poll. It loads once when the
    // person comes back to it.
    const timer = setInterval(() => { if (document.visibilityState === 'visible') reload(true); }, refreshMs);
    const onVisible = () => { if (document.visibilityState === 'visible') reload(true); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [reload, refreshMs]);

  const topicKey = topics.join('|');
  useEffect(() => {
    if (!topicKey) return undefined;
    // One change can ping more than one channel, so wait a moment and load once.
    let wait;
    const onPing = () => {
      clearTimeout(wait);
      wait = setTimeout(() => reload(true), 400);
    };
    const channels = topicKey.split('|').map((topic) =>
      supabase.channel(topic).on('broadcast', { event: 'changed' }, onPing).subscribe()
    );
    return () => {
      clearTimeout(wait);
      channels.forEach((channel) => supabase.removeChannel(channel));
    };
  }, [reload, topicKey]);

  return { data, error, loading, reload };
}
