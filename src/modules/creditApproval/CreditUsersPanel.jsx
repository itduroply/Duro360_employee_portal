import { useEffect, useMemo, useRef, useState } from 'react';
import Alert from '../../components/common/Alert.jsx';
import Button from '../../components/common/Button.jsx';
import Modal from '../../components/common/Modal.jsx';
import Select from '../../components/common/Select.jsx';
import TextInput from '../../components/common/TextInput.jsx';
import { HINT_ERROR, INPUT, INPUT_ERROR, INPUT_OK, LABEL } from '../../components/common/formStyles.js';
import {
  TABLE_WRAPPER, TABLE, TABLE_HEAD, TH, TABLE_ROW, TD, TD_PRIMARY, TABLE_EMPTY, CHIP_LIGHT,
} from '../../components/common/tableStyles.js';
import { creditApi } from './api/creditApi.js';
import { CREDIT_ROLES, OPERATORS, ruleSummary, toNumber, withCommas } from './lib/format.js';
import { Req, useList } from './components.jsx';

// secondApproverId: null = one approver. '' = the second box is open, not yet picked.
// kind 'dealer': the rule is for the listed dealers only, at any amount.
const EMPTY_RULE = { kind: 'amount', operator: '<', amount: '', upperAmount: '', approverId: '', secondApproverId: null, dealers: [] };
const EMPTY_DEALER_RULE = { ...EMPTY_RULE, kind: 'dealer' };
const EMPTY_FORM = { employeeCode: '', name: '', email: '', mobile: '', role: '', sellingBranchIds: [], rules: [{ ...EMPTY_RULE }] };

function validate(form, adding) {
  const errors = {};
  if (adding && !form.email.trim()) errors.login = 'Pick the person from the list.';
  if (!form.employeeCode.trim()) errors.employeeCode = 'Employee code is required.';
  if (!form.name.trim() && !errors.login) errors.name = 'Name is required.';
  if (form.mobile.trim() && !/^\d{10}$/.test(form.mobile.trim())) errors.mobile = 'Mobile number must be 10 digits.';
  if (!form.role) errors.role = 'Select a role.';
  if (form.role === 'Requester') {
    if (form.sellingBranchIds.length === 0) errors.sellingBranchIds = 'Select at least one selling branch.';
    const seenDealers = new Map();
    const ruleErrors = form.rules.map((rule, i) => {
      if (rule.kind === 'dealer') {
        if (rule.dealers.length === 0) return 'Pick at least one dealer.';
        const repeated = rule.dealers.find((d) => seenDealers.has(d.code) && seenDealers.get(d.code) !== i);
        rule.dealers.forEach((d) => seenDealers.set(d.code, seenDealers.get(d.code) ?? i));
        if (repeated) return `${repeated.name} is already in another dealer rule.`;
      } else {
        const amount = toNumber(rule.amount);
        if (!Number.isFinite(amount) || amount < 0) return 'Enter an amount.';
        if (rule.operator === 'between') {
          const upper = toNumber(rule.upperAmount);
          if (!Number.isFinite(upper)) return 'Enter the upper amount.';
          if (upper < amount) return 'The upper amount cannot be smaller than the first amount.';
        }
      }
      if (!rule.approverId) return 'Pick an approver.';
      if (rule.secondApproverId === '') return 'Pick the second approver, or remove it.';
      if (rule.secondApproverId && rule.secondApproverId === rule.approverId) return 'The two approvers must be different people.';
      return '';
    });
    if (ruleErrors.some(Boolean)) errors.rules = ruleErrors;
  }
  return errors;
}

// Search and tick dealers for one dealer rule. The picked ones show as chips.
function DealerPicker({ dealers, value, onChange }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const chosen = new Set(value.map((d) => d.code));
  const choices = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? dealers.filter((d) => d.name.toLowerCase().includes(q) || d.code.toLowerCase().includes(q)) : dealers;
    return list.slice(0, 50);
  }, [dealers, query]);
  const toggle = (d) => {
    onChange(chosen.has(d.code) ? value.filter((v) => v.code !== d.code) : [...value, { code: d.code, name: d.name }]);
    setQuery('');
  };

  return (
    <div className="relative" ref={boxRef}>
      <div
        className={`relative flex min-h-11 cursor-pointer flex-wrap items-center gap-1.5 rounded-lg border bg-white py-1.5 pl-3 pr-11 shadow-theme-xs ${open ? 'border-brand-300 ring-3 ring-brand-500/10' : 'border-gray-300'}`}
        onClick={() => setOpen(true)}
      >
        {value.map((d) => (
          <span key={d.code} title={d.name} className="inline-flex max-w-[230px] items-center gap-1 rounded-md bg-gray-100 py-0.5 pl-2 pr-1 text-[11px] font-normal leading-5 text-gray-700">
            <span className="truncate">{d.name}</span>
            <button
              type="button"
              aria-label={`Remove ${d.name}`}
              className="shrink-0 rounded px-1 text-gray-400 hover:bg-gray-200 hover:text-gray-700"
              onClick={(e) => {
                e.stopPropagation();
                onChange(value.filter((v) => v.code !== d.code));
              }}
            >
              ×
            </button>
          </span>
        ))}
        <input
          type="text"
          autoComplete="off"
          aria-label="Search dealer"
          value={query}
          placeholder={value.length ? 'Search dealer' : 'Search dealer by name or code'}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
          className="h-7 min-w-[110px] flex-1 border-0 bg-transparent px-1 text-sm text-gray-800 outline-none placeholder:text-gray-400"
        />
        <span className={`pointer-events-none absolute inset-y-0 right-4 flex items-center text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`}>
          <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
            <path d="M5 7.5l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </div>
      {open && (
        <ul className="custom-scrollbar absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white py-1 shadow-theme-lg">
          {choices.length === 0 && <li className="px-4 py-2.5 text-theme-sm text-gray-500">No dealer matches.</li>}
          {choices.map((d) => (
            <li key={d.code}>
              <label onMouseDown={(e) => e.preventDefault()} className="flex cursor-pointer items-center gap-3 px-4 py-2 text-theme-sm text-gray-800 hover:bg-gray-50">
                <input type="checkbox" checked={chosen.has(d.code)} onChange={() => toggle(d)} className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
                <span>{d.name}</span>
                <span className="ml-auto text-theme-xs text-gray-500">{d.code}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RuleRows({ rules, approvers, dealers, errors, onChange }) {
  const update = (i, patch) => onChange(rules.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const complete = (r) => r.approverId && r.secondApproverId !== '' && (r.kind === 'dealer' ? r.dealers.length > 0 : r.amount && (r.operator !== 'between' || r.upperAmount));
  return (
    <div>
      <p className={LABEL}>
        <Req>Approval rules</Req>
      </p>
      {/* <p className="mb-3 text-theme-xs text-gray-500">
        Rules are checked from top to bottom. The first rule that matches the proposed limit wins. Put narrow rules above wide ones, and cover every amount from zero up. Each rule needs one approver. You can add a second. Either one can decide the request. A dealer rule sends the listed dealers to its approver at any amount. Dealer rules always sit above the amount rules.
      </p> */}
      {approvers.length === 0 && (
        <Alert variant="warning" className="mb-3">No active Approver users yet. Create the Approvers first, then the Requester.</Alert>
      )}
      <div className="flex flex-col gap-3">
        {rules.map((rule, i) => (
          <div key={i} className="rounded-xl border border-gray-200 bg-white p-3">
            <div className={`grid grid-cols-1 items-end gap-3 ${rule.kind === 'dealer' ? 'sm:grid-cols-[1.5fr_1fr_auto]' : 'sm:grid-cols-[1.3fr_1fr_1fr_1.3fr_auto]'}`}>
              {rule.kind === 'dealer' && (
                <div>
                  <p className={LABEL}>Dealers <span className="font-normal text-gray-500">· any amount</span></p>
                  <DealerPicker dealers={dealers} value={rule.dealers} onChange={(list) => update(i, { dealers: list })} />
                </div>
              )}
              {rule.kind !== 'dealer' && (
                <>
                  <Select aria-label="Condition" value={rule.operator} onChange={(e) => update(i, { operator: e.target.value })}>
                    {OPERATORS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </Select>
                  <div className="[&>div]:!mb-0">
                    <TextInput aria-label="Amount" placeholder="Amount" inputMode="decimal" icon="₹" value={withCommas(rule.amount)} onChange={(e) => update(i, { amount: e.target.value.replace(/[^\d.]/g, '') })} />
                  </div>
                  {rule.operator === 'between' ? (
                    <div className="[&>div]:!mb-0">
                      <TextInput aria-label="Upper amount" placeholder="To amount" inputMode="decimal" icon="₹" value={withCommas(rule.upperAmount)} onChange={(e) => update(i, { upperAmount: e.target.value.replace(/[^\d.]/g, '') })} />
                    </div>
                  ) : (
                    <span className="hidden sm:block" />
                  )}
                </>
              )}
              <Select aria-label="Approver" value={rule.approverId} onChange={(e) => update(i, { approverId: e.target.value })}>
                <option value="">Pick approver</option>
                {approvers.map((a) => (
                  <option key={a.id} value={a.id} disabled={String(a.id) === String(rule.secondApproverId)}>{a.name}</option>
                ))}
              </Select>
              <button
                type="button"
                onClick={() => onChange(rules.filter((_, idx) => idx !== i))}
                disabled={rules.length === 1}
                className="mb-1 h-10 rounded-lg px-3 text-theme-sm font-medium text-error-600 hover:bg-error-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Remove
              </button>
            </div>
            {rule.secondApproverId === null ? (
              <button
                type="button"
                onClick={() => update(i, { secondApproverId: '' })}
                disabled={!rule.approverId}
                title={rule.approverId ? undefined : 'Pick the first approver first'}
                className="mt-2 text-theme-sm font-medium text-accent-500 hover:text-accent-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                + Add second approver
              </button>
            ) : (
              <div className={`mt-3 grid grid-cols-1 items-end gap-3 ${rule.kind === 'dealer' ? 'sm:grid-cols-[1.5fr_1fr_auto]' : 'sm:grid-cols-[1.3fr_1fr_1fr_1.3fr_auto]'}`}>
                <Select wrapperClassName={rule.kind === 'dealer' ? 'sm:col-start-2' : 'sm:col-start-4'} aria-label="Second approver" value={rule.secondApproverId} onChange={(e) => update(i, { secondApproverId: e.target.value })}>
                  <option value="">Pick second approver</option>
                  {approvers.map((a) => (
                    <option key={a.id} value={a.id} disabled={String(a.id) === String(rule.approverId)}>{a.name}</option>
                  ))}
                </Select>
                <button
                  type="button"
                  onClick={() => update(i, { secondApproverId: null })}
                  aria-label="Remove second approver"
                  className="mb-1 h-10 rounded-lg px-3 text-theme-sm font-medium text-error-600 hover:bg-error-50"
                >
                  Remove
                </button>
              </div>
            )}
            {errors?.[i] && <p className={HINT_ERROR}>{errors[i]}</p>}
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" variant="secondary" size="sm" disabled={!rules.every(complete)} title={rules.every(complete) ? undefined : 'Finish the rules above first'} onClick={() => onChange([...rules, { ...EMPTY_RULE }])}>
          + Add amount rule
        </Button>
        <Button type="button" variant="secondary" size="sm" disabled={!rules.every(complete)} title={rules.every(complete) ? undefined : 'Finish the rules above first'} onClick={() => onChange([{ ...EMPTY_DEALER_RULE }, ...rules])}>
          + Add dealer rule
        </Button>
      </div>
      {!rules.every(complete) && <p className="mt-1.5 text-theme-xs text-gray-500">Finish the rules above before you add another.</p>}
    </div>
  );
}


// Search box over the portal logins that are not in credit approval yet.
// Picking one fills the name, email and employee code, so the email always
// matches the person's login.
function LoginPicker({ logins, loading, selected, onSelect, error }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? logins.filter((l) => l.name.toLowerCase().includes(q) || l.email.toLowerCase().includes(q) || String(l.employeeCode ?? '').toLowerCase().includes(q))
      : logins;
    return list.slice(0, 50);
  }, [logins, query]);

  return (
    <div className="relative mb-4 sm:col-span-2">
      <label htmlFor="cu-login" className={LABEL}>
        <Req>Person (portal login)</Req>
      </label>
      <input
        id="cu-login"
        type="text"
        autoComplete="off"
        value={open ? query : selected ? `${selected.name} · ${selected.email}` : ''}
        placeholder={loading ? 'Loading logins…' : 'Search by name, email or employee code'}
        onFocus={() => {
          setQuery('');
          setOpen(true);
        }}
        onBlur={() => setOpen(false)}
        onChange={(e) => setQuery(e.target.value)}
        className={`${INPUT} ${error ? INPUT_ERROR : INPUT_OK}`}
      />
      {open && (
        <ul className="custom-scrollbar absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white py-1 shadow-theme-lg">
          {matches.length === 0 && (
            <li className="px-4 py-2.5 text-theme-sm text-gray-500">
              No login found. A person must have a portal login first, and not be in credit approval already.
            </li>
          )}
          {matches.map((l) => (
            <li key={l.id}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelect(l);
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between gap-3 px-4 py-2 text-left text-theme-sm hover:bg-gray-50"
              >
                <span>
                  <span className="font-medium text-gray-800">{l.name}</span>
                  <span className="block text-theme-xs text-gray-500">{l.email}</span>
                </span>
                <span className="text-theme-xs text-gray-500">{l.employeeCode || 'no code'}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {error ? <p className={HINT_ERROR}>{error}</p> : <p className="mt-1.5 text-theme-xs text-gray-500">Only people with an active portal login are listed.</p>}
    </div>
  );
}

// Dropdown of selling branches. A Requester can have many. The list has a
// check box for each branch and stays open while you tick. The picked ones also
// show as chips in the box.
function BranchMultiSelect({ branches, value, onChange, error }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  // Close when the click lands outside the box.
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const chosen = new Set(value);
  const picked = value.map((id) => branches.find((b) => String(b.id) === id)).filter(Boolean);
  const choices = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? branches.filter((b) => b.name.toLowerCase().includes(q)) : branches;
  }, [branches, query]);
  const allShown = choices.length > 0 && choices.every((b) => chosen.has(String(b.id)));

  const toggle = (id) => {
    const key = String(id);
    onChange(chosen.has(key) ? value.filter((v) => v !== key) : [...value, key]);
  };
  const remove = (id) => onChange(value.filter((v) => v !== String(id)));

  return (
    <div className="mb-4" ref={boxRef}>
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
        <label htmlFor="cu-branch-search" className={`${LABEL} !mb-0`}><Req>Selling branches</Req></label>
        {value.length > 0 && (
          <button type="button" className="text-theme-xs font-semibold text-gray-500 hover:text-gray-700" onClick={() => onChange([])}>
            Clear all
          </button>
        )}
      </div>

      <div className="relative">
        <div
          className={`flex min-h-[44px] flex-wrap items-center gap-1.5 rounded-xl border bg-white px-2.5 py-1.5 ${error ? 'border-error-300' : open ? 'border-brand-300 ring-3 ring-brand-500/10' : 'border-gray-300'}`}
          onClick={() => setOpen(true)}
        >
          {picked.map((b) => (
            <span key={b.id} className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-theme-sm font-medium text-brand-700">
              {b.name}
              <button
                type="button"
                aria-label={`Remove ${b.name}`}
                className="text-brand-500 hover:text-brand-800"
                onClick={(e) => {
                  e.stopPropagation();
                  remove(b.id);
                }}
              >
                ×
              </button>
            </span>
          ))}
          <input
            id="cu-branch-search"
            type="text"
            autoComplete="off"
            value={query}
            placeholder={picked.length ? 'Search branch' : 'Select selling branches'}
            onFocus={() => setOpen(true)}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Backspace' && !query && value.length) onChange(value.slice(0, -1));
              if (e.key === 'Escape') setOpen(false);
              if (e.key === 'Enter' && open && choices.length) {
                e.preventDefault();
                toggle(choices[0].id);
              }
            }}
            className="h-8 min-w-[140px] flex-1 border-0 bg-transparent px-1 text-sm text-gray-800 outline-none placeholder:text-gray-400"
          />
        </div>

        {open && (
          <div className="absolute z-20 mt-1 w-full rounded-xl border border-gray-200 bg-white shadow-theme-lg">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2">
              <span className="text-theme-xs text-gray-500">{value.length} selected</span>
              {choices.length > 0 && (
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onChange(allShown
                      ? value.filter((v) => !choices.some((b) => String(b.id) === v))
                      : [...new Set([...value, ...choices.map((b) => String(b.id))])]);
                  }}
                  className="text-theme-xs font-semibold text-brand-600 hover:text-brand-700"
                >
                  {allShown ? 'Clear shown' : 'Select all shown'}
                </button>
              )}
            </div>
            <ul className="custom-scrollbar max-h-60 overflow-y-auto py-1">
              {choices.length === 0 && <li className="px-4 py-2.5 text-theme-sm text-gray-500">No branch matches.</li>}
              {choices.map((b) => (
                <li key={b.id}>
                  <label
                    onMouseDown={(e) => e.preventDefault()}
                    className="flex cursor-pointer items-center gap-3 px-4 py-2 text-theme-sm text-gray-800 hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      checked={chosen.has(String(b.id))}
                      onChange={() => toggle(b.id)}
                      className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                    />
                    {b.name}
                  </label>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      {error ? <p className={HINT_ERROR}>{error}</p> : <p className="mt-1.5 text-theme-xs text-gray-500">{value.length} selected. The Requester can raise requests for dealers of every selected branch.</p>}
    </div>
  );
}

function UserForm({ editing, masters, fixedRole, onDone, onCancel }) {
  const [form, setForm] = useState(
    editing
      ? {
          employeeCode: editing.code, name: editing.name, email: editing.email, mobile: editing.mobile || '', role: editing.role,
          sellingBranchIds: editing.sellingBranchIds.map(String),
          rules: editing.rules.length
            ? editing.rules.map((r) => ({ kind: r.dealers?.length ? 'dealer' : 'amount', dealers: r.dealers ?? [], operator: r.operator, amount: String(r.amount), upperAmount: r.upperAmount == null ? '' : String(r.upperAmount), approverId: String(r.approverId), secondApproverId: r.secondApproverId ? String(r.secondApproverId) : null }))
            : [{ ...EMPTY_RULE }],
        }
      : { ...EMPTY_FORM, role: fixedRole }
  );
  const [errors, setErrors] = useState({});
  const [summary, setSummary] = useState('');
  const [saving, setSaving] = useState(false);
  const [logins, setLogins] = useState([]);
  const [loginsLoading, setLoginsLoading] = useState(!editing);
  const [picked, setPicked] = useState(null);

  // Adding: the people who can be chosen.
  useEffect(() => {
    if (editing) return undefined;
    let cancelled = false;
    creditApi
      .listPortalLogins()
      .then((list) => !cancelled && setLogins(list))
      .catch((err) => !cancelled && setSummary(err.message || 'Could not load portal logins.'))
      .finally(() => !cancelled && setLoginsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [editing]);

  function pickLogin(login) {
    const digits = String(login.mobile ?? '').replace(/\D/g, '');
    setPicked(login);
    setForm((f) => ({
      ...f,
      name: login.name,
      email: login.email,
      employeeCode: login.employeeCode ?? '',
      sellingBranchIds: login.sellingBranchId ? [String(login.sellingBranchId)] : [],
      mobile: digits.length >= 10 ? digits.slice(-10) : '',
    }));
    setErrors((e) => ({ ...e, login: undefined, name: undefined, employeeCode: undefined }));
  }

  const set = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  async function submit(e) {
    e.preventDefault();
    const found = validate(form, !editing);
    setErrors(found);
    const count = Object.keys(found).length;
    if (count > 0) {
      setSummary(`${count} field${count > 1 ? 's' : ''} need${count > 1 ? '' : 's'} attention.`);
      return;
    }
    setSaving(true);
    setSummary('');
    try {
      await creditApi.saveCreditUser(form, editing?.id ?? null);
      onDone(`${form.name.trim()} ${editing ? 'updated' : 'added'} as ${form.role}.`);
    } catch (err) {
      setSummary(err.message || 'Could not save this employee.');
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
      {editing && (
        <Alert variant="info" className="mb-4">
          Editing {editing.name}. Email and employee code are locked.
        </Alert>
      )}
      <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
        {!editing && <LoginPicker logins={logins} loading={loginsLoading} selected={picked} onSelect={pickLogin} error={errors.login} />}
        <TextInput
          id="cu-code"
          label={<Req>Employee code</Req>}
          value={form.employeeCode}
          onChange={(e) => set('employeeCode', e.target.value)}
          error={errors.employeeCode}
          disabled={Boolean(editing) || Boolean(picked?.employeeCode)}
        />
        <TextInput id="cu-name" label="Name" value={form.name} disabled readOnly error={errors.name} />
        <TextInput id="cu-email" label="Email address" type="email" value={form.email} disabled readOnly />
        <TextInput id="cu-mobile" label="Mobile number (optional)" type="tel" inputMode="numeric" maxLength={10} value={form.mobile} onChange={(e) => set('mobile', e.target.value.replace(/\D/g, ''))} error={errors.mobile} />
      </div>

      <div className="mb-1 grid grid-cols-1 gap-x-6 sm:grid-cols-2">
        <div className="mb-4">
          <TextInput id="cu-role" label="Credit role" value={form.role} disabled readOnly />
        </div>
        {form.role === 'Requester' && (
          <BranchMultiSelect branches={masters.sellingBranches} value={form.sellingBranchIds} onChange={(ids) => set('sellingBranchIds', ids)} error={errors.sellingBranchIds} />
        )}
      </div>

      {form.role === 'Requester' && (
        <>
          <div className="mt-5">
            <RuleRows rules={form.rules} approvers={masters.approvers} dealers={masters.dealers} errors={errors.rules} onChange={(rules) => set('rules', rules)} />
          </div>
        </>
      )}

      {summary && (
        <Alert variant="error" className="mt-4">
          {summary}
        </Alert>
      )}
      <div className="mt-5 flex gap-3">
        <Button type="submit" isLoading={saving}>
          {editing ? 'Save changes' : `Add ${fixedRole}`}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

const ROLE_COPY = {
  Requester: 'Requesters raise credit limit requests. Set their selling branches and approval rules here.',
  Approver: 'Approvers decide the requests that match a Requester rule.',
  EDP: 'EDP users update the dealer credit limit after approval.',
};

export default function CreditUsersPanel({ role }) {
  const { data, error, loading, reload } = useList(creditApi.listCreditUsers);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [notice, setNotice] = useState('');
  const [revoking, setRevoking] = useState(null);
  const [revokeError, setRevokeError] = useState('');
  const [busy, setBusy] = useState(false);

  const users = (data?.users ?? []).filter((u) => u.role === role);
  const masters = { sellingBranches: data?.sellingBranches ?? [], approvers: data?.approvers ?? [], dealers: data?.dealers ?? [] };
  const approverName = (id) => masters.approvers.find((a) => a.id === Number(id))?.name ?? '—';

  async function revoke() {
    setBusy(true);
    setRevokeError('');
    try {
      await creditApi.revokeCreditUser(revoking.id);
      setNotice(`${revoking.name} was revoked.`);
      setRevoking(null);
      reload(true);
    } catch (err) {
      setRevokeError(err.message || 'Could not revoke this employee.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-theme-sm text-gray-500">{ROLE_COPY[role]} The person needs a portal login first.</p>
        <Button
          variant={formOpen ? 'secondary' : 'primary'}
          onClick={() => {
            setFormOpen((v) => !v);
            setEditing(null);
          }}
        >
          {formOpen ? 'Cancel' : `+ Add ${role}`}
        </Button>
      </div>

      {notice && <Alert variant="success" className="mb-4">{notice}</Alert>}
      {error && <Alert variant="error" className="mb-4">{error}</Alert>}

      {formOpen && (
        <UserForm
          key={editing?.id ?? 'new'}
          editing={editing}
          masters={masters}
          fixedRole={role}
          onCancel={() => {
            setFormOpen(false);
            setEditing(null);
          }}
          onDone={(message) => {
            setNotice(message);
            setFormOpen(false);
            setEditing(null);
            reload(true);
          }}
        />
      )}

      <div className={TABLE_WRAPPER}>
        <div className="custom-scrollbar overflow-x-auto">
          <table className={TABLE}>
            <thead className={TABLE_HEAD}>
              <tr>
                <th className={TH}>Name</th>
                <th className={TH}>Role</th>
                <th className={TH}>Email</th>
                <th className={TH}>Selling branches</th>
                <th className={TH}>Approval rules</th>
                <th className={TH} />
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={6} className={TABLE_EMPTY}>Loading…</td></tr>
              )}
              {!loading && users.length === 0 && (
                <tr><td colSpan={6} className={TABLE_EMPTY}>No {role} added yet.</td></tr>
              )}
              {users.map((u) => (
                <tr key={u.id} className={`${TABLE_ROW} align-top`}>
                  <td className={`${TD} ${TD_PRIMARY}`}>
                    {u.name}
                    <p className="text-theme-xs font-normal text-gray-500">{u.code}</p>
                  </td>
                  <td className={TD}>{u.role}</td>
                  <td className={TD}>{u.email}</td>
                  <td className={TD}>
                    <div className="flex max-w-[220px] flex-wrap gap-1.5 whitespace-normal">
                      {u.sellingBranches.length === 0 ? <span className="text-gray-400">—</span> : u.sellingBranches.map((b) => <span key={b.id} className={CHIP_LIGHT}>{b.name}</span>)}
                    </div>
                  </td>
                  <td className={TD}>
                    {u.rules.length === 0 ? (
                      <span className="text-gray-400">—</span>
                    ) : (
                      <ol className="flex list-decimal flex-col gap-1 whitespace-normal pl-4">
                        {u.rules.map((r, i) => (
                          <li key={i} className="text-theme-xs">
                            {ruleSummary(r)}
                            {r.dealers?.length > 0 && <span className="block text-gray-500">{r.dealers.map((d) => d.name).join(', ')}</span>}
                            → {approverName(r.approverId)}{r.secondApproverId ? ` + ${approverName(r.secondApproverId)}` : ''}
                          </li>
                        ))}
                      </ol>
                    )}
                  </td>
                  <td className={`${TD} text-right`}>
                    <div className="flex justify-end gap-4">
                      <button
                        type="button"
                        className="text-theme-sm font-medium text-accent-500 hover:text-accent-700"
                        onClick={() => {
                          setEditing(u);
                          setFormOpen(true);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="text-theme-sm font-medium text-accent-500 hover:text-accent-700"
                        onClick={() => {
                          setRevoking(u);
                          setRevokeError('');
                        }}
                      >
                        Revoke
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={Boolean(revoking)}
        title="Revoke this employee?"
        subtitle={revoking ? `${revoking.name} will lose access to credit approval.` : ''}
        locked={busy}
        onClose={() => setRevoking(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRevoking(null)} disabled={busy}>Cancel</Button>
            <Button variant="danger" onClick={revoke} isLoading={busy}>Revoke</Button>
          </>
        }
      >
        {revokeError ? <Alert variant="error">{revokeError}</Alert> : <p className="text-theme-sm text-gray-600">Their past requests and decisions stay on record.</p>}
      </Modal>
    </div>
  );
}
