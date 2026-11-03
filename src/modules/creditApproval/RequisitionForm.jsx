import { useEffect, useMemo, useState } from 'react';
import Alert from '../../components/common/Alert.jsx';
import Button from '../../components/common/Button.jsx';
import TextInput from '../../components/common/TextInput.jsx';
import Select from '../../components/common/Select.jsx';
import { INPUT, INPUT_OK, INPUT_ERROR, HINT_ERROR, LABEL } from '../../components/common/formStyles.js';
import { creditApi } from './api/creditApi.js';
import { AGEING_BUCKETS, formatWhen, rupees, toNumber, withCommas } from './lib/format.js';
import { Req, TextArea } from './components.jsx';

const EMPTY = {
  requestType: 'Temporary',
  branchCode: '', branchName: '', dealerCode: '', dealerName: '',
  currentYearBusiness: '', previousYearBusiness: '', assignedLimit: '', assignedDays: '',
  aging0To30: '0', aging31To60: '0', aging61To90: '0', aging91To120: '0', aging121To180: '0', agingAbove180: '0',
  totalOutstanding: '0',
  amountToBeBilled: '', tempCreditAmount: '', validUpTo: '', daysNeeded: '1', paymentReceiveDate: '', remark: '',
  proposedCreditDays: '', averagePaymentDays: '', chequeBounceCount: '', lastRevisionDate: '',
};

// Every field below must be filled before the request can be sent.
const REQUIRED = {
  branchCode: 'Select a branch.',
  dealerCode: 'Select a dealer.',
  currentYearBusiness: 'Enter the current year business.',
  previousYearBusiness: 'Enter the previous year business.',
  assignedLimit: 'Enter the assigned limit.',
  assignedDays: 'Enter the assigned days.',
  tempCreditAmount: 'Enter the proposed credit limit.',
  remark: 'Enter a remark.',
};
// A Temporary request is for one billing and one payment date. A Permanent
// request is judged on the dealer's payment record instead.
const TEMPORARY_ONLY = {
  amountToBeBilled: 'Enter the amount to be billed.',
  validUpTo: 'Pick the valid up to date.',
  daysNeeded: 'Enter the number of days needed.',
  paymentReceiveDate: 'Pick the expected payment date.',
};
const PERMANENT_ONLY = {
  proposedCreditDays: 'Enter the proposed credit days.',
  averagePaymentDays: 'Enter the average actual payment days.',
};
const NUMERIC = ['currentYearBusiness', 'previousYearBusiness', 'assignedLimit', 'assignedDays', 'tempCreditAmount'];
const TEMPORARY_NUMERIC = ['amountToBeBilled', 'daysNeeded'];

const round2 = (n) => Math.round(n * 100) / 100;

function validate(form) {
  const permanent = form.requestType === 'Permanent';
  const required = { ...REQUIRED, ...(permanent ? PERMANENT_ONLY : TEMPORARY_ONLY) };
  const errors = {};
  Object.entries(required).forEach(([key, message]) => {
    if (!String(form[key] ?? '').trim()) errors[key] = message;
  });
  [...NUMERIC, ...(permanent ? ['averagePaymentDays'] : TEMPORARY_NUMERIC)].forEach((key) => {
    if (!errors[key] && !Number.isFinite(toNumber(form[key]))) errors[key] = 'Enter a number.';
  });
  if (!errors.tempCreditAmount && toNumber(form.tempCreditAmount) <= 0) errors.tempCreditAmount = 'Proposed limit must be above zero.';
  // Optional. When it is filled it must be a whole number.
  if (permanent && String(form.chequeBounceCount ?? '').trim() && !Number.isInteger(toNumber(form.chequeBounceCount))) errors.chequeBounceCount = 'Enter a whole number.';
  if (permanent && !errors.proposedCreditDays && !(Number.isInteger(toNumber(form.proposedCreditDays)) && toNumber(form.proposedCreditDays) > 0)) errors.proposedCreditDays = 'Enter a whole number above zero.';
  if (permanent && !errors.averagePaymentDays && toNumber(form.averagePaymentDays) < 0) errors.averagePaymentDays = 'Days cannot be negative.';
  return errors;
}

// Only the fields that belong to the chosen request type are sent.
function payloadOf(form) {
  const drop = form.requestType === 'Permanent' ? Object.keys(TEMPORARY_ONLY) : [...Object.keys(PERMANENT_ONLY), 'lastRevisionDate'];
  return Object.fromEntries(Object.entries(form).filter(([key]) => !drop.includes(key)));
}

// Amount box: shows Indian grouping, keeps plain digits in the form.
function MoneyInput({ id, label, value, onChange, error, disabled }) {
  return (
    <TextInput
      id={id}
      label={label}
      icon="₹"
      inputMode="decimal"
      value={withCommas(value)}
      onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ''))}
      error={error}
      disabled={disabled}
    />
  );
}

// Search box over the branch's dealers. Picking one fills the figures below.
function DealerPicker({ id, customers, loading, disabled, selectedName, onSelect, error, hint }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? customers.filter((c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)) : customers;
  }, [customers, query]);

  return (
    <div className="relative mb-4">
      <label htmlFor={id} className={LABEL}>
        <Req>Dealer name</Req>
      </label>
      <input
        id={id}
        type="text"
        autoComplete="off"
        disabled={disabled}
        value={open ? query : selectedName}
        placeholder={loading ? 'Loading dealers…' : 'Search by name or code'}
        onFocus={() => {
          setQuery('');
          setOpen(true);
        }}
        // After a pick the box keeps focus, so onFocus does not fire again. Click
        // and typing reopen the list instead.
        onClick={() => {
          if (open) return;
          setQuery('');
          setOpen(true);
        }}
        onBlur={() => setOpen(false)}
        onChange={(e) => {
          if (!open) {
            setQuery('');
            setOpen(true);
            return;
          }
          setQuery(e.target.value);
        }}
        className={`${INPUT} ${error ? INPUT_ERROR : INPUT_OK} disabled:bg-gray-50`}
      />
      {open && !disabled && (
        <ul className="custom-scrollbar absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white py-1 shadow-theme-lg">
          {matches.length === 0 && <li className="px-4 py-2.5 text-theme-sm text-gray-500">No dealers found.</li>}
          {matches.map((c) => (
            <li key={c.code}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelect(c);
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between gap-3 px-4 py-2 text-left text-theme-sm hover:bg-gray-50"
              >
                <span className="font-medium text-gray-800">{c.name}</span>
                <span className="text-theme-xs text-gray-500">{c.code}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {error ? <p className={HINT_ERROR}>{error}</p> : hint && <p className="mt-1.5 text-theme-xs text-gray-500">{hint}</p>}
    </div>
  );
}

const perMonth = (value) => (value === null || value === undefined ? '—' : value);

// Approved Temporary unlocks of this dealer: this month, and by quarter of the
// selected financial year (counted on the valid up to date).
function UnlockSummary({ insight, loading, error, fyStart, onFyChange, hasDealer }) {
  const unlocks = insight?.temporaryUnlocks;
  if (!hasDealer) return <p className="text-theme-sm text-gray-500">Pick a dealer to see its Temporary unlock requests.</p>;
  if (error) return <Alert variant="warning">{error}</Alert>;
  if (!unlocks) return <p className="text-theme-sm text-gray-500">{loading ? 'Loading…' : '—'}</p>;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-theme-xs text-gray-500">Unlocked this month</p>
          <p className="mt-0.5 text-2xl font-semibold text-gray-800">{unlocks.thisMonth}</p>
        </div>
        <div className="w-44">
          <Select id="cr-unlockFy" aria-label="Financial year" value={String(fyStart ?? unlocks.financialYear.start)} onChange={(e) => onFyChange(Number(e.target.value))}>
            {unlocks.options.map((o) => (
              <option key={o.start} value={o.start}>{o.label}</option>
            ))}
          </Select>
        </div>
      </div>
      <div className="custom-scrollbar overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-left text-theme-sm">
          <thead className="bg-gray-50 text-theme-xs text-gray-500">
            <tr>
              <th className="px-3 py-2 font-medium">Quarter</th>
              <th className="px-3 py-2 text-right font-medium">Requests</th>
              <th className="px-3 py-2 text-right font-medium">Months counted</th>
              <th className="px-3 py-2 text-right font-medium">Average per month</th>
            </tr>
          </thead>
          <tbody className={loading ? 'opacity-50' : ''}>
            {unlocks.quarters.map((q) => (
              <tr key={q.label} className="border-t border-gray-100 text-gray-800">
                <td className="whitespace-nowrap px-3 py-2.5">{q.label} <span className="text-theme-xs text-gray-500">({q.range})</span></td>
                <td className="px-3 py-2.5 text-right">{q.count}</td>
                <td className="px-3 py-2.5 text-right">{q.months}</td>
                <td className="px-3 py-2.5 text-right">{perMonth(q.averagePerMonth)}</td>
              </tr>
            ))}
            <tr className="border-t border-gray-200 bg-gray-50 font-semibold text-gray-800">
              <td className="px-3 py-2.5">{unlocks.financialYear.label}</td>
              <td className="px-3 py-2.5 text-right">{unlocks.total}</td>
              <td className="px-3 py-2.5 text-right">{unlocks.months}</td>
              <td className="px-3 py-2.5 text-right">{perMonth(unlocks.averagePerMonth)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-theme-xs text-gray-500">
        Counts approved Temporary requests. "This month" uses the approval date. The quarters use the valid up to date. You cannot change these figures.
      </p>
    </div>
  );
}

function Group({ title, children }) {
  return (
    <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
      <h3 className="mb-4 text-base font-semibold text-gray-800">{title}</h3>
      {children}
    </section>
  );
}

export default function RequisitionForm({ sellingBranches, onSubmitted, onCancel }) {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [summary, setSummary] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [customersError, setCustomersError] = useState('');
  const [performanceError, setPerformanceError] = useState('');
  // Permanent requests only: figures from the server, and the financial year
  // chosen for the unlock table (null = the current one).
  const [insight, setInsight] = useState(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const [insightError, setInsightError] = useState('');
  const [fyStart, setFyStart] = useState(null);

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function changeType(type) {
    set('requestType', type);
    // Each type has its own required fields, so old messages no longer apply.
    setErrors({});
    setSummary('');
  }

  // Load the Permanent figures when a dealer is chosen on a Permanent request,
  // and again when the financial year changes.
  useEffect(() => {
    if (form.requestType !== 'Permanent' || !form.dealerCode) {
      setInsight(null);
      setInsightError('');
      return undefined;
    }
    let cancelled = false;
    setInsightLoading(true);
    setInsightError('');
    creditApi
      .getPermanentInsight(form.dealerCode, fyStart ?? undefined)
      .then((result) => {
        if (cancelled) return;
        setInsight(result);
        setForm((f) => ({ ...f, lastRevisionDate: result.lastRevision.date }));
      })
      .catch((err) => !cancelled && setInsightError(err.message || 'Could not load the Permanent request figures.'))
      .finally(() => !cancelled && setInsightLoading(false));
    return () => {
      cancelled = true;
    };
  }, [form.requestType, form.dealerCode, fyStart]);

  // Start on the first assigned branch.
  useEffect(() => {
    if (sellingBranches.length === 0) return;
    const first = sellingBranches[0];
    setForm((f) => (f.branchCode ? f : { ...f, branchCode: first.code, branchName: first.name }));
  }, [sellingBranches]);

  // Dealers of the chosen branch.
  useEffect(() => {
    if (!form.branchCode) {
      setCustomers([]);
      return undefined;
    }
    let cancelled = false;
    setCustomersLoading(true);
    setCustomersError('');
    creditApi
      .getBranchCustomers(form.branchCode)
      .then(({ customers: list }) => !cancelled && setCustomers(list))
      .catch((err) => {
        if (cancelled) return;
        setCustomers([]);
        setCustomersError(err.message || 'Could not load dealers for this branch.');
      })
      .finally(() => !cancelled && setCustomersLoading(false));
    return () => {
      cancelled = true;
    };
  }, [form.branchCode]);

  function changeBranch(id) {
    const branch = sellingBranches.find((b) => String(b.id) === id);
    if (branch) {
      setForm((f) => ({ ...f, ...EMPTY, requestType: f.requestType, branchCode: branch.code, branchName: branch.name }));
      setFyStart(null);
    }
  }

  // The ageing buckets and total come from the server and are read only.
  function pickDealer(customer) {
    const ageing = AGEING_BUCKETS.map((_, i) => round2(customer.ageing?.[i] ?? 0));
    const total = round2(ageing.reduce((sum, n) => sum + n, 0));
    setForm((f) => ({
      ...f,
      dealerCode: customer.code,
      dealerName: customer.name,
      assignedLimit: customer.creditLimit == null ? '' : String(customer.creditLimit),
      assignedDays: customer.creditDays == null ? '' : String(customer.creditDays),
      ...Object.fromEntries(AGEING_BUCKETS.map((b, i) => [b.key, String(ageing[i])])),
      totalOutstanding: String(total),
      // Another dealer has its own payment record. The same dealer keeps what was typed.
      ...(f.dealerCode === customer.code ? {} : { averagePaymentDays: '', chequeBounceCount: '', lastRevisionDate: '' }),
    }));
    setFyStart(null);
    setErrors((e) => ({ ...e, dealerCode: undefined, assignedLimit: undefined, assignedDays: undefined }));

    // Business figures are worked out from sales data. They can still be edited.
    setPerformanceError('');
    creditApi
      .getCustomerPerformance(customer.code)
      .then((p) =>
        setForm((f) => ({
          ...f,
          currentYearBusiness: String(Math.round(p.currentYearBusiness ?? 0)),
          previousYearBusiness: String(Math.round(p.previousYearBusiness ?? 0)),
        }))
      )
      .catch((err) => setPerformanceError(err.message || 'Could not calculate the business figures.'));
  }

  async function submit(e) {
    e.preventDefault();
    const found = validate(form);
    setErrors(found);
    const keys = Object.keys(found);
    if (keys.length > 0) {
      setSummary(`${keys.length} field${keys.length > 1 ? 's' : ''} need${keys.length > 1 ? '' : 's'} attention.`);
      const target = document.getElementById(`cr-${keys[0]}`);
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target?.focus();
      return;
    }
    setSummary('');
    setSubmitting(true);
    try {
      const result = await creditApi.submitRequisition(payloadOf(form));
      onSubmitted(result);
    } catch (err) {
      setSummary(err.message || 'The request could not be sent.');
      setSubmitting(false);
    }
  }

  const noBranch = sellingBranches.length === 0;
  const hasDealer = Boolean(form.dealerCode);
  const isPermanent = form.requestType === 'Permanent';

  return (
    <form onSubmit={submit} noValidate>
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-800">Dealer credit limit approval form</h3>
        <p className="mt-1 text-theme-sm text-gray-500">Give the dealer details and the financial position for the credit limit request.</p>
      </div>

      {noBranch && (
        <Alert variant="warning" className="mb-6">
          No Selling Branch is assigned to your account. Ask the administrator before you send a request.
        </Alert>
      )}

      <Group title="Request type">
        <div className="flex flex-wrap gap-6">
          {['Temporary', 'Permanent'].map((type) => (
            <label key={type} className="flex cursor-pointer items-center gap-2.5 text-sm font-medium text-gray-700">
              <input
                type="radio"
                name="requestType"
                checked={form.requestType === type}
                onChange={() => changeType(type)}
                className="h-4 w-4 cursor-pointer accent-brand-500"
              />
              {type}
            </label>
          ))}
        </div>
      </Group>

      <Group title="Branch and dealer">
        <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
          {sellingBranches.length > 1 ? (
            <div className="mb-4">
              <Select
                id="cr-branchCode"
                label={<Req>Branch name</Req>}
                value={String(sellingBranches.find((b) => b.code === form.branchCode)?.id ?? '')}
                onChange={(e) => changeBranch(e.target.value)}
              >
                {sellingBranches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            </div>
          ) : (
            <TextInput id="cr-branchName" label="Branch name" value={form.branchName} disabled readOnly />
          )}
          <TextInput id="cr-branchCodeShown" label="Branch code" value={form.branchCode} disabled readOnly />
          <DealerPicker
            id="cr-dealerCode"
            customers={customers}
            loading={customersLoading}
            disabled={!form.branchCode}
            selectedName={form.dealerName}
            onSelect={pickDealer}
            error={errors.dealerCode || customersError}
            hint={form.branchCode && !customersLoading && customers.length === 0 && !customersError ? 'No dealers found for this branch.' : ''}
          />
          <TextInput id="cr-dealerCodeShown" label="Dealer code" value={form.dealerCode} disabled readOnly />
        </div>
      </Group>

      <Group title="Quantum of business">
        {performanceError && <Alert variant="warning" className="mb-4">{performanceError}</Alert>}
        <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
          <MoneyInput id="cr-currentYearBusiness" label={<Req>Current year performance</Req>} value={form.currentYearBusiness} onChange={(v) => set('currentYearBusiness', v)} error={errors.currentYearBusiness} />
          <MoneyInput id="cr-previousYearBusiness" label={<Req>Previous year performance</Req>} value={form.previousYearBusiness} onChange={(v) => set('previousYearBusiness', v)} error={errors.previousYearBusiness} />
        </div>
      </Group>

      

      <Group title="Overdue and outstanding summary">
        <div className="custom-scrollbar overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-left text-theme-sm">
            <thead className="bg-gray-50 text-theme-xs text-gray-500">
              <tr>
                {AGEING_BUCKETS.map((b) => (
                  <th key={b.key} className="px-3 py-2 font-medium">{b.label} days</th>
                ))}
                <th className="px-3 py-2 font-semibold text-gray-700">Total outstanding</th>
              </tr>
            </thead>
            <tbody>
              <tr className="text-gray-800">
                {AGEING_BUCKETS.map((b) => (
                  <td key={b.key} className="whitespace-nowrap px-3 py-2.5">{hasDealer ? rupees(form[b.key]) : '—'}</td>
                ))}
                <td className="whitespace-nowrap px-3 py-2.5 font-semibold">{hasDealer ? rupees(form.totalOutstanding) : '—'}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-theme-xs text-gray-500">These figures come from the dealer's open documents. You cannot change them.</p>
      </Group>
      <Group title="Existing credit status">
        <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
          <MoneyInput id="cr-assignedLimit" label={<Req>Assigned limit</Req>} value={form.assignedLimit} onChange={(v) => set('assignedLimit', v)} error={errors.assignedLimit} />
          <TextInput id="cr-assignedDays" label={<Req>Assigned days</Req>} inputMode="numeric" value={form.assignedDays} onChange={(e) => set('assignedDays', e.target.value.replace(/\D/g, ''))} error={errors.assignedDays} />
        </div>
      </Group>

      {isPermanent ? (
        <>
          <Group title="Credit limit request">
            {insightError && <Alert variant="warning" className="mb-4">{insightError}</Alert>}
            <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
              <MoneyInput id="cr-tempCreditAmount" label={<Req>Proposed credit limit</Req>} value={form.tempCreditAmount} onChange={(v) => set('tempCreditAmount', v)} error={errors.tempCreditAmount} />
              <TextInput id="cr-proposedCreditDays" label={<Req>Proposed credit days</Req>} inputMode="numeric" value={form.proposedCreditDays} onChange={(e) => set('proposedCreditDays', e.target.value.replace(/\D/g, ''))} error={errors.proposedCreditDays} />
              <TextInput
                id="cr-averagePaymentDays"
                label={<Req>Average actual payment days</Req>}
                inputMode="decimal"
                value={form.averagePaymentDays}
                onChange={(e) => set('averagePaymentDays', e.target.value.replace(/[^\d.]/g, ''))}
                error={errors.averagePaymentDays}
              />
              <TextInput id="cr-chequeBounceCount" label="Cheque bounce count (optional)" inputMode="numeric" value={form.chequeBounceCount} onChange={(e) => set('chequeBounceCount', e.target.value.replace(/\D/g, ''))} error={errors.chequeBounceCount} />
              <TextInput
                id="cr-lastRevisionDate"
                label="Last revision date"
                value={form.lastRevisionDate ? formatWhen(form.lastRevisionDate) : hasDealer && insightLoading ? 'Loading…' : '—'}
                disabled
                readOnly
                hint={insight ? (insight.lastRevision.isFirst ? 'First Permanent request for this dealer, so today\'s date is used.' : 'Date and time this dealer\'s limit was last made permanent.') : undefined}
              />
            </div>
            <TextArea id="cr-remark" label={<Req>Remark</Req>} value={form.remark} onChange={(e) => set('remark', e.target.value)} error={errors.remark} placeholder="Why should this limit become permanent?" />
            <p className="text-theme-xs text-gray-500">
              You do not choose the approvers. A Permanent request goes through the approval levels set by the administrator, in order. It is approved only after the last level approves.
            </p>
          </Group>

          <Group title="Temporary unlock requests per month">
            <UnlockSummary insight={insight} loading={insightLoading} error={insightError} fyStart={fyStart} onFyChange={setFyStart} hasDealer={hasDealer} />
          </Group>
        </>
      ) : (
        <Group title="Credit limit request">
          <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
            <MoneyInput id="cr-amountToBeBilled" label={<Req>Amount to be billed</Req>} value={form.amountToBeBilled} onChange={(v) => set('amountToBeBilled', v)} error={errors.amountToBeBilled} />
            <MoneyInput id="cr-tempCreditAmount" label={<Req>Proposed credit limit</Req>} value={form.tempCreditAmount} onChange={(v) => set('tempCreditAmount', v)} error={errors.tempCreditAmount} />
            <TextInput id="cr-validUpTo" type="date" label={<Req>Valid up to</Req>} value={form.validUpTo} onChange={(e) => set('validUpTo', e.target.value)} error={errors.validUpTo} />
            <TextInput id="cr-daysNeeded" label={<Req>Number of days needed</Req>} inputMode="numeric" value={form.daysNeeded} onChange={(e) => set('daysNeeded', e.target.value.replace(/\D/g, ''))} error={errors.daysNeeded} />
            <TextInput id="cr-paymentReceiveDate" type="date" label={<Req>Expected payment date</Req>} value={form.paymentReceiveDate} onChange={(e) => set('paymentReceiveDate', e.target.value)} error={errors.paymentReceiveDate} />
          </div>
          <TextArea id="cr-remark" label={<Req>Remark</Req>} value={form.remark} onChange={(e) => set('remark', e.target.value)} error={errors.remark} placeholder="Why does this dealer need the limit?" />
          <p className="text-theme-xs text-gray-500">You do not choose the approver. The system picks one or two approvers from the routing rules set by the administrator. Either one can decide the request.</p>
        </Group>
      )}

      {summary && (
        <Alert variant="error" className="mb-4">
          {summary}
        </Alert>
      )}

      <div className="flex gap-3">
        <Button type="submit" isLoading={submitting} disabled={noBranch}>
          Send request
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
