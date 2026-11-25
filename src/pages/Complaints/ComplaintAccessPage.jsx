import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import ModulePage, { KpiStrip } from '../../components/ModulePage/ModulePage.jsx';
import EmptyState from '../../components/ModulePage/EmptyState.jsx';
import Alert from '../../components/common/Alert.jsx';
import Button from '../../components/common/Button.jsx';
import Modal from '../../components/common/Modal.jsx';
import { SearchIcon } from '../../components/common/icons.jsx';
import { usersApi } from '../../api/usersApi';
import { complaintsApi } from '../../api/complaintsApi';
import { formatCount } from '../../utils/format.js';
import { TABLE_WRAPPER, TABLE, TABLE_HEAD, TH, TABLE_ROW, TD, TABLE_EMPTY, CHIP_ACTIVE, CHIP_INACTIVE } from '../../components/common/tableStyles.js';
import ComplaintGate from './ComplaintGate.jsx';

const PERMISSION = 'complaints';

const hasAccess = (person) => (person.permissions ?? []).includes(PERMISSION);

function initials(name) {
  return String(name ?? '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

function matches(person, q) {
  return !q || [person.name, person.email, person.employee_id].some((v) => String(v ?? '').toLowerCase().includes(q));
}

function Avatar({ name }) {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-theme-xs font-semibold text-white">
      {initials(name)}
    </span>
  );
}

function SearchBox({ id, value, onChange, placeholder }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-gray-400">
        <SearchIcon />
      </span>
      <input
        id={id}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-lg border border-gray-200 bg-white pl-11 pr-4 text-theme-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10"
      />
    </div>
  );
}

// The reporting manager decides the first approver, so a missing one is flagged.
function ManagerCell({ code, manager }) {
  if (!code) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-50 px-2.5 py-0.5 text-theme-xs font-medium text-warning-700">
        <span className="h-1.5 w-1.5 rounded-full bg-warning-500" aria-hidden="true" />
        Not set
      </span>
    );
  }
  return (
    <span className="block">
      <span className="block font-medium text-gray-700">{manager ? manager.name : 'Not on the portal'}</span>
      <span className="block text-theme-xs text-gray-400">{code}</span>
    </span>
  );
}

// A dropdown that looks like the other selects but lets you tick several
// selling branches. An empty pick means "All selling branches". `onCommit`
// gets the new list of branch ids when the dropdown closes with a change.
// The list opens in a portal, so a scrolling table cannot clip it.
function BranchMultiSelect({ id, label, branches, value, onCommit, disabled = false, compact = false, ariaLabel }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [q, setQ] = useState('');
  const [box, setBox] = useState(null);
  const buttonRef = useRef(null);
  const panelRef = useRef(null);

  const nameOf = useMemo(() => new Map(branches.map((b) => [b.id, b.name])), [branches]);
  const chosen = useMemo(() => new Set(draft), [draft]);
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return needle ? branches.filter((b) => String(b.name).toLowerCase().includes(needle)) : branches;
  }, [branches, q]);

  const close = useCallback(() => {
    setOpen(false);
    setQ('');
    const same = draft.length === value.length && draft.every((x) => value.includes(x));
    if (!same) onCommit(draft);
  }, [draft, value, onCommit]);

  function openPanel() {
    if (disabled) return;
    const r = buttonRef.current.getBoundingClientRect();
    const below = window.innerHeight - r.bottom;
    const height = 330;
    const goDown = below >= height || below >= r.top;
    setBox({
      left: Math.min(r.left, Math.max(8, window.innerWidth - 296)),
      width: Math.max(r.width, 288),
      top: goDown ? r.bottom + 6 : undefined,
      bottom: goDown ? undefined : window.innerHeight - r.top + 6,
    });
    setDraft(value);
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (panelRef.current?.contains(e.target) || buttonRef.current?.contains(e.target)) return;
      close();
    };
    const onKey = (e) => e.key === 'Escape' && close();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', close);
    };
  }, [open, close]);

  function toggle(branchId) {
    const next = new Set(chosen);
    if (next.has(branchId)) next.delete(branchId);
    else next.add(branchId);
    setDraft(branches.filter((b) => next.has(b.id)).map((b) => b.id));
  }

  const names = value.map((x) => nameOf.get(x)).filter(Boolean);
  const summary = value.length === 0 ? 'All selling branches' : names.length <= 2 ? names.join(', ') : `${names.slice(0, 2).join(', ')} +${names.length - 2} more`;

  return (
    <div>
      {label && (
        <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <button
        ref={buttonRef}
        id={id}
        type="button"
        onClick={() => (open ? close() : openPanel())}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={value.length ? names.join(', ') : undefined}
        className={`relative w-full cursor-pointer truncate rounded-lg border bg-white text-left text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10 disabled:cursor-not-allowed disabled:opacity-60 ${
          compact ? 'h-9 min-w-[220px] border-gray-200 px-3 pr-9 text-theme-sm text-gray-700' : 'h-11 border-gray-300 px-4 pr-11 text-sm'
        }`}
      >
        {summary}
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-500">
          <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
            <path d="M5 7.5l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>
      {open &&
        box &&
        createPortal(
          <div
            ref={panelRef}
            style={{ position: 'fixed', left: box.left, top: box.top, bottom: box.bottom, width: box.width, zIndex: 100000 }}
            className="rounded-xl border border-gray-200 bg-white p-2 shadow-theme-lg"
          >
            <label className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-theme-sm font-semibold text-gray-800 hover:bg-gray-50">
              <input type="checkbox" checked={draft.length === 0} onChange={() => setDraft([])} className="h-4 w-4 accent-brand-500" />
              All selling branches
            </label>
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search branches"
              aria-label="Search branches"
              className="my-1.5 h-9 w-full rounded-lg border border-gray-200 px-3 text-theme-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10"
            />
            <ul role="listbox" aria-multiselectable="true" className="custom-scrollbar max-h-60 overflow-y-auto">
              {shown.length === 0 && <li className="px-2 py-2 text-theme-sm text-gray-500">No branch matches.</li>}
              {shown.map((b) => (
                <li key={b.id}>
                  <label className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-theme-sm text-gray-700 hover:bg-gray-50">
                    <input type="checkbox" checked={chosen.has(b.id)} onChange={() => toggle(b.id)} className="h-4 w-4 accent-brand-500" />
                    <span className="truncate">{b.name}</span>
                  </label>
                </li>
              ))}
            </ul>
            <div className="mt-1.5 flex items-center justify-between border-t border-gray-100 px-2 pt-2 text-theme-xs text-gray-500">
              <span>{draft.length === 0 ? 'Every branch' : `${draft.length} selected`}</span>
              <button type="button" onClick={close} className="rounded-md bg-brand-500 px-3 py-1 text-theme-xs font-semibold text-white hover:bg-brand-600">
                Done
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

function ComplaintAccess() {
  const [people, setPeople] = useState([]);
  const [branches, setBranches] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [addQuery, setAddQuery] = useState('');
  const [pickId, setPickId] = useState('');
  const [addBranches, setAddBranches] = useState([]);
  const [isAdding, setIsAdding] = useState(false);

  // person id -> branch ids. A person with no entry files for every branch.
  const [assignments, setAssignments] = useState(new Map());
  const [listQuery, setListQuery] = useState('');
  const [savingId, setSavingId] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [isRemoving, setIsRemoving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [employees, admins, branchList, assigned] = await Promise.all([
        usersApi.listEmployees(),
        usersApi.listAdmins(),
        usersApi.listBranches(),
        complaintsApi.branchAssignments(),
      ]);
      setPeople([...(employees.users ?? []), ...(admins.users ?? [])]);
      setBranches(branchList.branches ?? []);
      setAssignments(assigned);
      setError('');
    } catch (err) {
      setError(err.message || 'Could not load the people list.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const byCode = useMemo(() => new Map(people.filter((p) => p.employee_id).map((p) => [String(p.employee_id).toUpperCase(), p])), [people]);
  const branchName = useMemo(() => new Map(branches.map((b) => [b.id, b.name])), [branches]);
  const managerOf = (person) => (person.reporting_manager ? byCode.get(String(person.reporting_manager).toUpperCase()) : null);

  const withAccess = useMemo(
    () => people.filter(hasAccess).sort((a, b) => String(a.name).localeCompare(String(b.name))),
    [people]
  );
  const shown = useMemo(() => withAccess.filter((p) => matches(p, listQuery.trim().toLowerCase())), [withAccess, listQuery]);
  const candidates = useMemo(() => {
    const q = addQuery.trim().toLowerCase();
    if (!q) return [];
    return people.filter((p) => !hasAccess(p) && p.status === 'ACTIVE' && matches(p, q)).slice(0, 8);
  }, [people, addQuery]);
  const picked = people.find((p) => p.id === pickId) ?? null;

  const idsOf = (person) => assignments.get(person.id) ?? [];
  const tied = withAccess.filter((p) => idsOf(p).length > 0).length;
  const noManager = withAccess.filter((p) => !p.reporting_manager).length;

  const whereText = (ids) =>
    ids.length === 0 ? 'every selling branch' : ids.map((id) => branchName.get(id)).filter(Boolean).join(', ');

  function pick(person) {
    setPickId(person.id);
    // Start from what they have, or from the branch on their login.
    const have = assignments.get(person.id);
    setAddBranches(have ?? (person.selling_branch_id ? [person.selling_branch_id] : []));
    setAddQuery('');
  }

  async function giveAccess() {
    if (!picked) return;
    setIsAdding(true);
    setError('');
    setNotice('');
    try {
      // Branches first. If this fails, the person has not been given access.
      await complaintsApi.setBranches(picked.id, addBranches);
      await usersApi.updatePermissions(picked.id, [...(picked.permissions ?? []), PERMISSION]);
      setNotice(`${picked.name} can now file complaints for ${whereText(addBranches)}.`);
      setPickId('');
      await load();
    } catch (err) {
      setError(err.message || 'Could not give access.');
    } finally {
      setIsAdding(false);
    }
  }

  async function changeBranches(person, ids) {
    setSavingId(person.id);
    setError('');
    setNotice('');
    try {
      await complaintsApi.setBranches(person.id, ids);
      setNotice(`${person.name} now files complaints for ${whereText(ids)}.`);
      await load();
    } catch (err) {
      setError(`${person.name}: ${err.message || 'the branches could not be saved.'}`);
    } finally {
      setSavingId(null);
    }
  }

  async function removeAccess() {
    if (!removing) return;
    setIsRemoving(true);
    setError('');
    setNotice('');
    try {
      await usersApi.updatePermissions(removing.id, (removing.permissions ?? []).filter((k) => k !== PERMISSION));
      setNotice(`${removing.name} can no longer file complaints.`);
      setRemoving(null);
      await load();
    } catch (err) {
      setError(err.message || 'Could not remove access.');
    } finally {
      setIsRemoving(false);
    }
  }

  return (
    <ModulePage title="Assign Users" description="Choose who can file complaints, and for which selling branches." live>
      {error && <Alert variant="error">{error}</Alert>}
      {notice && <Alert variant="success">{notice}</Alert>}

      <KpiStrip
        items={[
          { label: 'Can file complaints', value: isLoading ? undefined : formatCount(withAccess.length), icon: 'users', tone: 'brand' },
          { label: 'Tied to selected branches', value: isLoading ? undefined : formatCount(tied), icon: 'dealers', tone: 'success' },
          { label: 'All branches', value: isLoading ? undefined : formatCount(withAccess.length - tied), icon: 'complaints', tone: 'gray' },
          { label: 'No reporting manager', value: isLoading ? undefined : formatCount(noManager), icon: 'queries', tone: 'warning' },
        ]}
      />

      <section className="rounded-2xl border border-gray-200 bg-white shadow-theme-sm">
        <header className="border-b border-gray-100 px-5 py-4 sm:px-6">
          <h3 className="text-base font-semibold text-gray-800">Give access</h3>
          <p className="mt-0.5 text-theme-sm text-gray-500">
            Find a person, choose the selling branches they file for, and save. Approvers do not need access. They see My Approvals on their own.
          </p>
        </header>
        <div className="grid grid-cols-1 gap-5 px-5 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="relative">
            <label htmlFor="access-search" className="mb-1.5 block text-sm font-medium text-gray-700">
              Person
            </label>
            {picked ? (
              <div className="flex items-center gap-3 rounded-lg border border-brand-200 bg-brand-25 px-3 py-2">
                <Avatar name={picked.name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-theme-sm font-semibold text-gray-800">{picked.name}</p>
                  <p className="truncate text-theme-xs text-gray-500">{picked.employee_id || picked.email}</p>
                </div>
                <button type="button" onClick={() => setPickId('')} className="text-theme-sm font-medium text-brand-600 hover:underline">
                  Change
                </button>
              </div>
            ) : (
              <SearchBox id="access-search" value={addQuery} onChange={setAddQuery} placeholder="Name, email or employee code" />
            )}
            {!picked && addQuery.trim() && (
              <ul className="absolute left-0 right-0 top-full z-20 mt-1.5 max-h-80 overflow-y-auto rounded-xl border border-gray-200 bg-white py-1 shadow-theme-lg">
                {candidates.length === 0 ? (
                  <li className="px-4 py-3 text-theme-sm text-gray-500">No active person without access matches.</li>
                ) : (
                  candidates.map((p) => (
                    <li key={p.id}>
                      <button type="button" onClick={() => pick(p)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50">
                        <Avatar name={p.name} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-theme-sm font-medium text-gray-800">{p.name}</span>
                          <span className="block truncate text-theme-xs text-gray-500">
                            {p.employee_id || p.email}
                            {p.selling_branch_id ? ` · ${branchName.get(p.selling_branch_id) ?? ''}` : ''}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            )}
            {picked && (
              <p className="mt-2 text-theme-xs text-gray-500">
                Reporting manager:{' '}
                {picked.reporting_manager ? (
                  <span className="font-medium text-gray-700">
                    {managerOf(picked)?.name ?? 'Not on the portal'} ({picked.reporting_manager})
                  </span>
                ) : (
                  <span className="font-medium text-warning-700">not set. Their complaints will have no manager to approve them.</span>
                )}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <BranchMultiSelect id="access-branch" label="Files complaints for" branches={branches} value={addBranches} onCommit={setAddBranches} disabled={!picked} />
            <Button onClick={giveAccess} isLoading={isAdding} disabled={!picked}>
              Give access
            </Button>
          </div>
        </div>
      </section>

      <div className={TABLE_WRAPPER}>
        <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <h3 className="text-base font-semibold text-gray-800">People who can file complaints</h3>
            <p className="mt-0.5 text-theme-xs text-gray-500">Super Admins can always file, for every branch, and are not listed.</p>
          </div>
          <div className="w-full sm:w-72">
            <SearchBox id="access-filter" value={listQuery} onChange={setListQuery} placeholder="Search this list" />
          </div>
        </div>
        <div className="custom-scrollbar overflow-x-auto">
          <table className={TABLE}>
            <thead className={TABLE_HEAD}>
              <tr>
                <th className={TH}>Person</th>
                <th className={TH}>Files complaints for</th>
                <th className={TH}>Reporting manager</th>
                <th className={TH}>Login</th>
                <th className={`${TH} text-right`}></th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={5} className={TABLE_EMPTY}>Loading people…</td>
                </tr>
              )}
              {!isLoading && shown.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-0">
                    <EmptyState
                      icon="users"
                      title={withAccess.length === 0 ? 'Nobody has access yet' : 'Nobody matches'}
                      hint={withAccess.length === 0 ? 'Use Give access above to add the first person.' : 'Try another name or code.'}
                    />
                  </td>
                </tr>
              )}
              {!isLoading &&
                shown.map((p) => (
                  <tr key={p.id} className={TABLE_ROW}>
                    <td className={TD}>
                      <div className="flex items-center gap-3">
                        <Avatar name={p.name} />
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-gray-800">{p.name}</p>
                          <p className="truncate text-theme-xs text-gray-400">{p.employee_id || p.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className={TD}>
                      <div className="flex items-center gap-2">
                        <BranchMultiSelect
                          ariaLabel={`Selling branches for ${p.name}`}
                          branches={branches}
                          value={idsOf(p)}
                          onCommit={(ids) => changeBranches(p, ids)}
                          disabled={savingId === p.id}
                          compact
                        />
                        {savingId === p.id && <span className="text-theme-xs text-gray-400">Saving…</span>}
                      </div>
                    </td>
                    <td className={TD}>
                      <ManagerCell code={p.reporting_manager} manager={managerOf(p)} />
                    </td>
                    <td className={TD}>
                      <span className={p.status === 'ACTIVE' ? CHIP_ACTIVE : CHIP_INACTIVE}>{p.status === 'ACTIVE' ? 'Active' : 'Inactive'}</span>
                    </td>
                    <td className={`${TD} text-right`}>
                      <button type="button" onClick={() => setRemoving(p)} className="text-theme-sm font-medium text-error-500 hover:underline">
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={Boolean(removing)}
        title="Remove access"
        subtitle={removing ? removing.name : ''}
        onClose={() => setRemoving(null)}
        locked={isRemoving}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRemoving(null)} disabled={isRemoving}>
              Cancel
            </Button>
            <Button variant="danger" onClick={removeAccess} isLoading={isRemoving}>
              Remove access
            </Button>
          </>
        }
      >
        <p className="text-theme-sm text-gray-600">
          {removing?.name} will no longer be able to file complaints or see Complaint History. Complaints they filed stay on record.
        </p>
      </Modal>
    </ModulePage>
  );
}

export default function ComplaintAccessPage() {
  return (
    <ComplaintGate need="superadmin">
      <ComplaintAccess />
    </ComplaintGate>
  );
}
