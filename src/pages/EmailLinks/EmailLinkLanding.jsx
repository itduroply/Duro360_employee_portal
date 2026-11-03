import { useEffect, useState } from 'react';
import Alert from '../../components/common/Alert.jsx';
import Button from '../../components/common/Button.jsx';
import { INPUT, INPUT_ERROR, INPUT_OK, HINT_ERROR, LABEL } from '../../components/common/formStyles.js';

// Pages opened from the links in credit approval emails. The person is NOT
// signed in: the signed, expiring token in the link is the only authority, and
// the Edge Functions behind it (credit-approve-via-email,
// credit-reply-query-via-email) check it. Opening the link only loads the
// request ("preview"); nothing changes until the person confirms here, because
// mail scanners open every link in a mail before the reader does.

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Posts to a public Edge Function. Returns { ok, status, body }; a 4xx body
// still carries the request and a plain message, so it is returned, not thrown.
async function callPublic(fn, payload) {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, body };
  } catch {
    return { ok: false, status: 0, body: { error: 'Could not reach the server. Check your internet and try again.' } };
  }
}

const plain = (v) => (v === undefined || v === null || String(v).trim() === '' ? '—' : String(v).trim());

function money(v) {
  const raw = String(v ?? '').replaceAll(',', '').trim();
  if (raw === '') return '—';
  const n = Number(raw);
  return Number.isFinite(n) ? `Rs ${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : plain(v);
}

function stamp(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const AGING = [
  ['aging0To15', '0-15'], ['aging16To30', '16-30'], ['aging0To30', '0-30'], ['aging31To60', '31-60'],
  ['aging61To90', '61-90'], ['aging91To120', '91-120'], ['agingAbove120', 'Above 120'],
  ['aging121To180', '121-180'], ['agingAbove180', 'Above 180'],
];

// The same sections the email shows, so the page matches what was read in the inbox.
function sections(r) {
  const permanent = r.requestType === 'Permanent';
  const aging = AGING.filter(([k]) => r[k] !== undefined).map(([k, label]) => [`Aging ${label} days`, money(r[k])]);
  const unlocks = r.temporaryUnlocks ?? {};
  return [
    ['Dealer', [
      ['Dealer name', plain(r.dealerName)],
      ['Dealer code', plain(r.dealerCode)],
      ['Branch', `${plain(r.branchName)} (${plain(r.branchCode)})`],
      ['Raised by', plain(r.requesterName)],
    ]],
    ['Business', [
      ['Current year business', money(r.currentYearBusiness)],
      ['Previous year business', money(r.previousYearBusiness)],
      ['Assigned credit limit', money(r.assignedLimit)],
      ['Assigned credit days', plain(r.assignedDays)],
    ]],
    ['Outstanding', [...aging, ['Total outstanding', money(r.totalOutstanding), true]]],
    permanent
      ? ['This request', [
          ['Request type', 'Permanent'],
          ['Proposed credit limit', money(r.tempCreditAmount), true],
          ['Proposed credit days', plain(r.proposedCreditDays), true],
          ['Average actual payment days', plain(r.averagePaymentDays)],
          ['Cheque bounce count', plain(r.chequeBounceCount)],
          ['Last revision date', plain(r.lastRevisionDate)],
          ['Remark', plain(r.remark)],
          ['Temporary unlocks this month', plain(unlocks.thisMonth)],
          ['Temporary unlocks, financial year', plain(unlocks.total)],
        ]]
      : ['This request', [
          ['Request type', 'Temporary'],
          ['Amount to be billed', money(r.amountToBeBilled)],
          ['Proposed increase in credit limit', money(r.tempCreditAmount), true],
          ['Valid up to', plain(r.validUpTo)],
          ['Days needed', plain(r.daysNeeded)],
          ['Expected payment receive date', plain(r.paymentReceiveDate)],
          ['Remark', plain(r.remark)],
        ]],
  ];
}

function Frame({ eyebrow, title, children }) {
  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto w-full max-w-2xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-theme-sm">
        <div className="bg-brand-500 px-6 py-5 text-white">
          <p className="mb-1.5 inline-block rounded-full border border-white/30 bg-white/15 px-3 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em]">
            {eyebrow}
          </p>
          <h1 className="text-lg font-semibold leading-snug">{title}</h1>
        </div>
        <div className="px-6 py-6">{children}</div>
        <p className="border-t border-gray-100 px-6 py-4 text-center text-theme-xs text-gray-400">
          Duroply Dealer Management System
        </p>
      </div>
    </div>
  );
}

function Summary({ requisition }) {
  return (
    <div className="space-y-5">
      {sections(requisition).map(([title, items]) => (
        <section key={title}>
          <h2 className="mb-2 text-theme-xs font-semibold uppercase tracking-wider text-gray-500">{title}</h2>
          <dl className="divide-y divide-gray-100 rounded-xl border border-gray-200">
            {items.map(([label, value, strong]) => (
              <div key={label} className="flex items-start justify-between gap-4 px-4 py-2.5">
                <dt className="text-theme-sm text-gray-500">{label}</dt>
                <dd className={`text-right text-theme-sm ${strong ? 'font-semibold text-gray-900' : 'text-gray-800'}`}>{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}

function Thread({ thread }) {
  if (!thread?.length) return null;
  return (
    <section className="mt-6">
      <h2 className="mb-2 text-theme-xs font-semibold uppercase tracking-wider text-gray-500">Queries and replies</h2>
      <ul className="space-y-2">
        {thread.map((m) => (
          <li key={m.id} className={`rounded-xl border px-4 py-3 ${m.type === 'query' ? 'border-warning-200 bg-warning-50' : 'border-gray-200 bg-gray-50'}`}>
            <p className="text-theme-xs text-gray-500">
              {m.by} · {m.type === 'query' ? 'Query' : 'Reply'} · {stamp(m.createdAt)}
            </p>
            <p className="mt-1 whitespace-pre-wrap text-theme-sm text-gray-800">{m.message}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Loading() {
  return <p className="py-10 text-center text-theme-sm text-gray-500">Loading the request…</p>;
}

// ---------------------------------------------------------------- Approver

const MODES = {
  approve: { label: 'Approve', field: 'remark', name: 'Remark', hint: 'Remark is required to approve.', cta: 'Approve request', variant: 'primary' },
  reject: { label: 'Reject', field: 'reason', name: 'Reason', hint: 'Reason is required to reject.', cta: 'Reject request', variant: 'danger' },
  query: { label: 'Ask a query', field: 'queryMessage', name: 'Your question', hint: 'Write the doubt for the requester.', cta: 'Send query', variant: 'secondary' },
};

function ApprovalLanding({ token, firstAction }) {
  const [state, setState] = useState({ loading: true });
  const [mode, setMode] = useState(MODES[firstAction] ? firstAction : 'approve');
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    callPublic('credit-approve-via-email', { token, action: 'preview' }).then((r) => {
      if (cancelled) return;
      setState({ loading: false, ...r.body, failed: !r.ok && !r.body.requisition });
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function submit(e) {
    e.preventDefault();
    if (!text.trim()) {
      setError(`${MODES[mode].name} is required.`);
      return;
    }
    setError('');
    setBusy(true);
    const r = await callPublic('credit-approve-via-email', { token, action: mode, [MODES[mode].field]: text.trim() });
    setBusy(false);
    if (!r.ok) {
      setError(r.body.error || 'Could not save this. Please try again.');
      if (r.body.requisition) setState((s) => ({ ...s, ...r.body }));
      return;
    }
    setState((s) => ({ ...s, ...r.body }));
    setNotice(r.body.message || 'Done.');
    setText('');
  }

  const { loading, requisition, thread, canAct, failed } = state;
  const title = requisition ? `Credit request for ${plain(requisition.dealerName)}` : 'Credit approval request';

  return (
    <Frame eyebrow="Credit approval" title={title}>
      {loading && <Loading />}
      {!loading && failed && <Alert variant="error">{state.error || 'This link could not be opened.'}</Alert>}
      {!loading && requisition && (
        <>
          {notice && <Alert variant="success" className="mb-5">{notice}</Alert>}
          {!canAct && !notice && state.error && <Alert variant="warning" className="mb-5">{state.error}</Alert>}
          <Summary requisition={requisition} />
          <Thread thread={thread} />

          {canAct && (
            <form onSubmit={submit} noValidate className="mt-7 rounded-2xl border border-gray-200 p-5">
              <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Your decision">
                {Object.entries(MODES).map(([key, m]) => (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={mode === key}
                    onClick={() => {
                      setMode(key);
                      setError('');
                    }}
                    className={`rounded-lg px-4 py-2 text-theme-sm font-medium transition-colors ${
                      mode === key ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              <label htmlFor="landing-text" className={LABEL}>
                {MODES[mode].name} <span className="text-error-500">*</span>
              </label>
              <textarea
                id="landing-text"
                rows={4}
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  setError('');
                }}
                className={`${INPUT} h-auto resize-y py-3 ${error ? INPUT_ERROR : INPUT_OK}`}
                placeholder={MODES[mode].hint}
              />
              {error && <p className={HINT_ERROR}>{error}</p>}
              <Button type="submit" variant={MODES[mode].variant} isLoading={busy} className="mt-4 w-full">
                {MODES[mode].cta}
              </Button>
              <p className="mt-3 text-center text-theme-xs text-gray-400">Nothing is saved until you press the button above.</p>
            </form>
          )}
        </>
      )}
    </Frame>
  );
}

// --------------------------------------------------------------- Requester

function ReplyLanding({ token }) {
  const [state, setState] = useState({ loading: true });
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    callPublic('credit-reply-query-via-email', { token, action: 'preview' }).then((r) => {
      if (cancelled) return;
      setState({ loading: false, ...r.body, failed: !r.ok && !r.body.requisition });
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function submit(e) {
    e.preventDefault();
    if (!text.trim()) {
      setError('Reply is required.');
      return;
    }
    setError('');
    setBusy(true);
    const r = await callPublic('credit-reply-query-via-email', { token, action: 'reply', message: text.trim() });
    setBusy(false);
    if (!r.ok) {
      setError(r.body.error || 'Could not send the reply. Please try again.');
      return;
    }
    setState((s) => ({ ...s, ...r.body }));
    setNotice(r.body.message || 'Reply sent.');
    setText('');
  }

  const { loading, requisition, thread, canReply, failed } = state;
  const title = requisition ? `Query on your request for ${plain(requisition.dealerName)}` : 'Reply to a query';

  return (
    <Frame eyebrow="Query from approver" title={title}>
      {loading && <Loading />}
      {!loading && failed && <Alert variant="error">{state.error || 'This link could not be opened.'}</Alert>}
      {!loading && requisition && (
        <>
          {notice && <Alert variant="success" className="mb-5">{notice}</Alert>}
          <Thread thread={thread} />
          {canReply && (
            <form onSubmit={submit} noValidate className="mt-7 rounded-2xl border border-gray-200 p-5">
              <label htmlFor="landing-reply" className={LABEL}>
                Your reply <span className="text-error-500">*</span>
              </label>
              <textarea
                id="landing-reply"
                rows={4}
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  setError('');
                }}
                className={`${INPUT} h-auto resize-y py-3 ${error ? INPUT_ERROR : INPUT_OK}`}
                placeholder="Write your answer for the approver"
              />
              {error && <p className={HINT_ERROR}>{error}</p>}
              <Button type="submit" isLoading={busy} className="mt-4 w-full">
                Send reply
              </Button>
            </form>
          )}
          <div className="mt-7">
            <h2 className="mb-2 text-theme-xs font-semibold uppercase tracking-wider text-gray-500">The request</h2>
            <Summary requisition={requisition} />
          </div>
        </>
      )}
    </Frame>
  );
}

// `link` is { kind: 'approval' | 'reply', token, action? }, read from the
// address by RootEntry in routes/AppRoutes.jsx.
export default function EmailLinkLanding({ link }) {
  return link.kind === 'approval' ? (
    <ApprovalLanding token={link.token} firstAction={link.action} />
  ) : (
    <ReplyLanding token={link.token} />
  );
}
