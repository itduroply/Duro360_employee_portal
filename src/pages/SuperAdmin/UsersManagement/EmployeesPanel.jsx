import { Fragment, useEffect, useMemo, useState } from 'react';
import { usersApi } from '../../../api/usersApi';
import { ASSIGNABLE_ADMIN_PERMISSIONS } from '../../../components/Sidebar/sidebarConfig.js';
import Button from '../../../components/common/Button.jsx';
import Alert from '../../../components/common/Alert.jsx';
import { SearchIcon } from '../../../components/common/icons.jsx';
import { INPUT, INPUT_OK, LABEL } from '../../../components/common/formStyles.js';
import { TABLE_EMPTY } from '../../../components/common/tableStyles.js';
import ChangePasswordModal from './ChangePasswordModal.jsx';
import { EditUserModal, DeleteUserModal } from './UserActionModals.jsx';
import { PermissionCheckboxes } from './AdminsPanel.jsx';

// Keep in sync with EMPLOYEE_DEFAULT_PASSWORD in
// supabase/functions/manage-users/index.ts (the server sets it, this only shows it).
const EMPLOYEE_DEFAULT_PASSWORD = 'Duroply@123';
// Rows drawn at first; "Show more" adds another page so a big sheet stays fast.
const PAGE_SIZE = 50;

/* ------------------------------------------------------------------ */
/* Icons: hand-drawn strokes in the portal's style (no icon library).  */
/* ------------------------------------------------------------------ */
function Icon({ children, className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}
const UsersIcon = (p) => (
  <Icon {...p}>
    <circle cx="7.5" cy="7" r="2.75" />
    <path d="M2.5 16.5c.4-2.6 2.4-4 5-4s4.6 1.4 5 4" />
    <path d="M13 4.4a2.75 2.75 0 0 1 0 5.2M14.5 12.7c1.6.5 2.7 1.7 3 3.8" />
  </Icon>
);
const CheckCircleIcon = (p) => (
  <Icon {...p}>
    <circle cx="10" cy="10" r="7" />
    <path d="M7 10.2l2.2 2.2L13.2 8" />
  </Icon>
);
const PauseCircleIcon = (p) => (
  <Icon {...p}>
    <circle cx="10" cy="10" r="7" />
    <path d="M8.2 7.5v5M11.8 7.5v5" />
  </Icon>
);
const MapPinIcon = (p) => (
  <Icon {...p}>
    <path d="M10 17.5s5.5-4.6 5.5-9A5.5 5.5 0 0 0 4.5 8.5c0 4.4 5.5 9 5.5 9Z" />
    <circle cx="10" cy="8.5" r="2" />
  </Icon>
);
const UserCheckIcon = (p) => (
  <Icon {...p}>
    <circle cx="8" cy="7" r="2.9" />
    <path d="M2.5 16.5c.4-2.7 2.5-4.2 5.5-4.2 1.2 0 2.2.2 3 .7" />
    <path d="M12.5 14.5l1.7 1.7 3-3.4" />
  </Icon>
);
const MailIcon = (p) => (
  <Icon {...p}>
    <rect x="2.5" y="4.5" width="15" height="11" rx="2.5" />
    <path d="M3.5 6l6.5 5 6.5-5" />
  </Icon>
);
const SparkIcon = (p) => (
  <Icon {...p}>
    <path d="M10 2.5l1.6 4.4 4.4 1.6-4.4 1.6L10 14.5l-1.6-4.4L4 8.5l4.4-1.6L10 2.5ZM15.5 13.5l.6 1.6 1.6.6-1.6.6-.6 1.6-.6-1.6-1.6-.6 1.6-.6.6-1.6Z" />
  </Icon>
);
const KeyRoundIcon = (p) => (
  <Icon {...p}>
    <circle cx="7" cy="13" r="3.25" />
    <path d="M9.4 10.6L16 4M13.5 6.5l1.75 1.75M15.75 4.25L17.5 6" />
  </Icon>
);
const PencilIcon = (p) => (
  <Icon {...p}>
    <path d="M12.5 4l3.5 3.5L7 16.5l-4 .5.5-4L12.5 4Z" />
  </Icon>
);
const PowerIcon = (p) => (
  <Icon {...p}>
    <path d="M10 3v6.5" />
    <path d="M14.5 5.8a6 6 0 1 1-9 0" />
  </Icon>
);
const TrashIcon = (p) => (
  <Icon {...p}>
    <path d="M3.5 5.5h13M8 5.5V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.5M5.5 5.5l.7 10a1.5 1.5 0 0 0 1.5 1.4h4.6a1.5 1.5 0 0 0 1.5-1.4l.7-10" />
  </Icon>
);
/* ------------------------------------------------------------------ */
/* Small building blocks                                               */
/* ------------------------------------------------------------------ */
const AVATAR_GRADIENTS = [
  'from-brand-400 to-brand-600',
  'from-[#4aa3b3] to-[#2f7d8c]',
  'from-[#e8b43c] to-[#c98f0f]',
  'from-[#6fae6a] to-[#4f8a4a]',
];

function initialsOf(name) {
  const parts = String(name || '?').trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

function Avatar({ name, seed }) {
  const gradient = AVATAR_GRADIENTS[[...String(seed || name)].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % AVATAR_GRADIENTS.length];
  return (
    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${gradient} text-sm font-semibold text-white shadow-theme-xs`}>
      {initialsOf(name)}
    </span>
  );
}

const STAT_TONES = {
  brand: 'bg-brand-50 text-brand-600',
  green: 'bg-success-50 text-success-600',
  red: 'bg-error-50 text-error-600',
  gray: 'bg-gray-100 text-gray-600',
};

function StatCard({ icon, label, value, tone }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-gray-200/80 bg-white p-4 shadow-theme-xs transition-all hover:-translate-y-0.5 hover:shadow-theme-sm">
      <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${STAT_TONES[tone]}`}>{icon}</span>
      <div>
        <p className="text-2xl font-semibold leading-none text-gray-800">{value.toLocaleString('en-IN')}</p>
        <p className="mt-1.5 text-theme-xs font-medium text-gray-500">{label}</p>
      </div>
    </div>
  );
}

const ACTION_TONES = {
  brand: 'hover:border-brand-200 hover:bg-brand-50 hover:text-brand-600',
  neutral: 'hover:border-gray-300 hover:bg-gray-100 hover:text-gray-700',
  danger: 'hover:border-error-200 hover:bg-error-50 hover:text-error-600',
};

function ActionButton({ label, onClick, tone = 'brand', children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`flex h-9 w-9 items-center justify-center rounded-xl border border-transparent text-gray-400 transition-all focus:outline-none focus:ring-3 focus:ring-brand-500/20 ${ACTION_TONES[tone]}`}
    >
      {children}
    </button>
  );
}

function Pill({ icon, children, empty }) {
  if (empty) return <span className="text-gray-300">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-theme-xs font-medium text-gray-700">
      <span className="text-gray-400">{icon}</span>
      {children}
    </span>
  );
}

const FILTERS = [
  ['ALL', 'All'],
  ['ACTIVE', 'Active'],
  ['INACTIVE', 'Inactive'],
];

// Pulls the employee details from the HR database, so the Excel sheet is not needed
// for people who already have a login. It updates name, mobile, reporting manager and
// the HR details (department, designation, grade, region, HR branch, dates). It does not
// create logins and does not change status, email or the selling branch.
function HrSyncCard({ onSynced }) {
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const loadStatus = () =>
    usersApi
      .hrSyncStatus()
      .then(setStatus)
      .catch(() => setStatus(null));
  useEffect(() => {
    loadStatus();
  }, []);

  async function sync() {
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const r = await usersApi.syncHrUsers();
      if (!r?.ok) throw new Error(r?.error || 'The sync failed.');
      setResult(r);
      onSynced?.();
    } catch (err) {
      setError(err.message || 'The sync failed.');
    } finally {
      setBusy(false);
      loadStatus();
    }
  }

  const last = status?.lastRun;
  const missing = status?.withoutLogin ?? [];
  return (
    <div className="mb-6 rounded-3xl border border-gray-200/80 bg-white p-5 shadow-theme-xs sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-gray-800">Sync from HR database</h3>
          
        </div>
        <Button onClick={sync} isLoading={busy}>Sync now</Button>
      </div>
      {error && <Alert variant="error" className="mt-4">{error}</Alert>}
      {result && (
        <Alert variant="success" className="mt-4">
          Read {result.received} people from the HR database. {result.profilesUpdated} logins updated.
          {result.withoutLogin > 0 ? ` ${result.withoutLogin} HR people have no login yet.` : ''}
        </Alert>
      )}
      {last && (
        <p className="mt-3 text-theme-xs text-gray-500">
          Last run: {last.status === 'OK' ? 'worked' : last.status === 'FAILED' ? 'failed' : 'running'}
          {last.finishedAt ? ` at ${new Date(last.finishedAt).toLocaleString('en-IN')}` : ''}
          {last.status === 'OK' ? `, ${last.rows} people read` : ''}
          {last.status === 'FAILED' && last.error ? `. ${last.error}` : ''}
        </p>
      )}
      {missing.length > 0 && (
        <details className="mt-3 text-theme-sm text-gray-600">
          <summary className="cursor-pointer font-medium text-gray-700">{missing.length} in the HR database without a login</summary>
          <ul className="mt-2 list-disc pl-5">
            {missing.map((m) => (
              <li key={m.employeeId}>
                {m.employeeId} · {m.name || '—'}{m.designation ? ` · ${m.designation}` : ''}{m.status ? ` · ${m.status}` : ''}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

/**
 * Employee logins. The details (department, designation, HR branch and so on) come from the
 * HR database through the Sync card above. Each Employee
 * signs in with their Employee ID and starts with every Admin Console feature
 * except creating Dealers and Users; Edit features narrows that down
 * (see supabase/migrations/20260928120000_add_employee_login.sql).
 */
export default function EmployeesPanel() {
  const [employees, setEmployees] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const [passwordUser, setPasswordUser] = useState(null); // Employee whose password modal is open
  const [detailsUser, setDetailsUser] = useState(null); // Employee whose details modal is open
  const [deleteTarget, setDeleteTarget] = useState(null); // Employee waiting for delete confirmation
  const [branches, setBranches] = useState([]);
  const [editingId, setEditingId] = useState(null); // Employee whose features row is open
  const [editPermissions, setEditPermissions] = useState([]);
  const [isSavingPermissions, setIsSavingPermissions] = useState(false);

  const branchName = (id) => branches.find((b) => b.id === id)?.name;

  function startEditing(employee) {
    setEditingId(employee.id);
    setEditPermissions(employee.permissions || []);
  }

  async function saveEditingPermissions() {
    setIsSavingPermissions(true);
    try {
      await usersApi.updatePermissions(editingId, editPermissions);
      setEditingId(null);
      await loadEmployees();
    } catch (err) {
      setError(err.message || 'Could not update features.');
    } finally {
      setIsSavingPermissions(false);
    }
  }

  async function loadEmployees() {
    setIsLoading(true);
    try {
      const { users } = await usersApi.listEmployees();
      setEmployees(users);
    } catch (err) {
      setError(err.message || 'Could not load Employees.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadEmployees();
    usersApi
      .listBranches()
      .then(({ branches: list }) => setBranches(list))
      .catch((err) => setError(err.message || 'Could not load branches.'));
  }, []);

  const stats = useMemo(() => {
    const active = employees.filter((e) => e.status === 'ACTIVE').length;
    return { total: employees.length, active, inactive: employees.length - active, noBranch: employees.filter((e) => !e.hr_branch && !e.selling_branch_id).length };
  }, [employees]);

  const visibleEmployees = useMemo(() => {
    const q = search.trim().toLowerCase();
    return employees.filter((e) => {
      if (statusFilter !== 'ALL' && e.status !== statusFilter) return false;
      if (!q) return true;
      return [e.employee_id, e.name, e.email, e.reporting_manager, branchName(e.selling_branch_id), e.hr_branch, e.hr_sub_branch, e.department, e.designation].some((v) => v?.toLowerCase().includes(q));
    });
    // branchName only reads `branches`, so that is the dependency to watch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employees, search, statusFilter, branches]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [search, statusFilter]);

  function openPasswordModal(employee) {
    setError('');
    setNotice('');
    setPasswordUser(employee);
  }

  function handlePasswordChanged(employee) {
    setPasswordUser(null);
    setNotice(`Password changed for ${employee.name} (${employee.employee_id}).`);
  }

  async function handleDetailsSaved(user, result) {
    setDetailsUser(null);
    setNotice(
      result?.loginChanged
        ? `Details saved for ${user.name}. They now sign in with ${result.loginEmail.split('@')[0].toUpperCase()}.`
        : `Details saved for ${user.name}.`
    );
    await loadEmployees();
  }

  async function handleDeleted(user) {
    setDeleteTarget(null);
    setNotice(`${user.name} (${user.employee_id}) was deleted.`);
    await loadEmployees();
  }

  async function toggleStatus(employee) {
    const nextStatus = employee.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await usersApi.updateStatus(employee.id, nextStatus);
      await loadEmployees();
    } catch (err) {
      setError(err.message || 'Could not update status.');
    }
  }

  const shownEmployees = visibleEmployees.slice(0, visibleCount);

  return (
    <div>
      {/* Stat cards */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard tone="brand" label="Total employees" value={stats.total} icon={<UsersIcon className="h-6 w-6" />} />
        <StatCard tone="green" label="Active" value={stats.active} icon={<CheckCircleIcon className="h-6 w-6" />} />
        <StatCard tone="red" label="Inactive" value={stats.inactive} icon={<PauseCircleIcon className="h-6 w-6" />} />
        <StatCard tone="gray" label="No branch yet" value={stats.noBranch} icon={<MapPinIcon className="h-6 w-6" />} />
      </div>

      <HrSyncCard onSynced={loadEmployees} />

      {error && (
        <Alert variant="error" className="mb-4">
          {error}
        </Alert>
      )}
      {notice && (
        <Alert variant="success" className="mb-4">
          {notice}
        </Alert>
      )}

      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-2xl bg-gray-100 p-1">
          {FILTERS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setStatusFilter(key)}
              className={`rounded-xl px-4 py-1.5 text-theme-sm font-medium transition-all ${
                statusFilter === key ? 'bg-white text-gray-900 shadow-theme-xs' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-72">
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-gray-400">
            <SearchIcon />
          </span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search ID, name, branch, department, designation, manager"
            className={`${INPUT} ${INPUT_OK} rounded-2xl pl-11`}
          />
        </div>
      </div>

      {/* Employees */}
      <div className="overflow-hidden rounded-3xl border border-gray-200/80 bg-white shadow-theme-sm">
        <div className="custom-scrollbar overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/80 text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="whitespace-nowrap px-5 py-3.5">Employee</th>
                <th className="whitespace-nowrap px-4 py-3.5">Email</th>
                <th className="whitespace-nowrap px-4 py-3.5">Branch</th>
                <th className="whitespace-nowrap px-4 py-3.5">Department</th>
                <th className="whitespace-nowrap px-4 py-3.5">Designation</th>
                <th className="whitespace-nowrap px-4 py-3.5">Reporting manager</th>
                <th className="whitespace-nowrap px-4 py-3.5">Status</th>
                <th className="whitespace-nowrap px-4 py-3.5">Features</th>
                <th className="px-4 py-3.5" />
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={9} className={TABLE_EMPTY}>
                    Loading…
                  </td>
                </tr>
              )}
              {!isLoading && visibleEmployees.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-6 py-14 text-center">
                    <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-gray-400">
                      <UsersIcon className="h-7 w-7" />
                    </span>
                    <p className="mt-3 text-sm font-semibold text-gray-700">
                      {employees.length === 0 ? 'No employees yet' : 'No employees match this search'}
                    </p>
                    <p className="mt-1 text-theme-sm text-gray-500">
                      {employees.length === 0 ? 'Click Sync now above to load employees from the HR database.' : 'Try a different word or filter.'}
                    </p>
                  </td>
                </tr>
              )}
              {!isLoading &&
                shownEmployees.map((employee) => {
                  const perms = employee.permissions || [];
                  const allFeatures = perms.length >= ASSIGNABLE_ADMIN_PERMISSIONS.length;
                  return (
                    <Fragment key={employee.id}>
                      <tr className="border-t border-gray-100 transition-colors first:border-t-0 hover:bg-brand-25/60">
                        <td className="whitespace-nowrap px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <Avatar name={employee.name} seed={employee.employee_id} />
                            <div>
                              <p className="text-theme-sm font-semibold text-gray-800">{employee.name}</p>
                              <p className="mt-0.5 text-theme-xs font-medium tracking-wide text-gray-400">{employee.employee_id}</p>
                            </div>
                          </div>
                        </td>
                        {/* An Employee with no email in the sheet shows its internal login address. */}
                        <td className="whitespace-nowrap px-4 py-3.5 text-theme-sm text-gray-600">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="text-gray-300">
                              <MailIcon />
                            </span>
                            {employee.email}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5">
                          {/* The HR branch (from the HR database) first; the selling branch is set separately and is often empty. */}
                          <Pill icon={<MapPinIcon className="h-3.5 w-3.5" />} empty={!(employee.hr_branch || branchName(employee.selling_branch_id))}>
                            {employee.hr_branch || branchName(employee.selling_branch_id)}
                          </Pill>
                          {employee.hr_sub_branch && employee.hr_sub_branch !== employee.hr_branch && (
                            <span className="mt-1 block text-theme-xs text-gray-400">{employee.hr_sub_branch}</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5 text-theme-sm text-gray-600">
                          {employee.department || '—'}
                          {employee.sub_department && employee.sub_department !== employee.department && (
                            <span className="block text-theme-xs text-gray-400">{employee.sub_department}</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5 text-theme-sm text-gray-600">
                          {employee.designation || '—'}
                          {employee.grade && <span className="block text-theme-xs text-gray-400">{employee.grade}</span>}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5">
                          <Pill icon={<UserCheckIcon className="h-3.5 w-3.5" />} empty={!employee.reporting_manager}>
                            {employee.reporting_manager}
                          </Pill>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-theme-xs font-semibold ${
                              employee.status === 'ACTIVE' ? 'bg-success-50 text-success-600' : 'bg-error-50 text-error-600'
                            }`}
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-current" />
                            {employee.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5">
                          {perms.length === 0 ? (
                            <span className="text-theme-xs text-gray-400">None</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => startEditing(employee)}
                              title="Edit features"
                              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-theme-xs font-semibold transition-colors ${
                                allFeatures ? 'bg-brand-50 text-brand-600 hover:bg-brand-100' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }`}
                            >
                              <SparkIcon className="h-3.5 w-3.5" />
                              {allFeatures ? 'All features' : `${perms.length} of ${ASSIGNABLE_ADMIN_PERMISSIONS.length}`}
                            </button>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5">
                          <div className="flex items-center justify-end gap-0.5">
                            <ActionButton label="Edit features" onClick={() => startEditing(employee)}>
                              <SparkIcon className="h-[18px] w-[18px]" />
                            </ActionButton>
                            <ActionButton label="Change password" onClick={() => openPasswordModal(employee)}>
                              <KeyRoundIcon className="h-[18px] w-[18px]" />
                            </ActionButton>
                            <ActionButton label="Edit details" onClick={() => setDetailsUser(employee)}>
                              <PencilIcon className="h-[18px] w-[18px]" />
                            </ActionButton>
                            <ActionButton label={employee.status === 'ACTIVE' ? 'Deactivate' : 'Activate'} tone="neutral" onClick={() => toggleStatus(employee)}>
                              <PowerIcon className="h-[18px] w-[18px]" />
                            </ActionButton>
                            <ActionButton label="Delete" tone="danger" onClick={() => setDeleteTarget(employee)}>
                              <TrashIcon className="h-[18px] w-[18px]" />
                            </ActionButton>
                          </div>
                        </td>
                      </tr>
                      {editingId === employee.id && (
                        <tr className="bg-gray-50">
                          <td colSpan={9} className="whitespace-normal px-5 py-5">
                            <p className={LABEL}>Features for {employee.name}</p>
                            <div className="mt-2 max-w-3xl">
                              <PermissionCheckboxes selected={editPermissions} onChange={setEditPermissions} />
                            </div>
                            <div className="mt-4 flex gap-2">
                              <Button size="sm" onClick={saveEditingPermissions} isLoading={isSavingPermissions}>
                                Save
                              </Button>
                              <Button size="sm" variant="secondary" onClick={() => setEditingId(null)}>
                                Cancel
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
            </tbody>
          </table>
        </div>
        {!isLoading && visibleEmployees.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 bg-gray-50/60 px-5 py-3">
            <p className="text-theme-xs font-medium text-gray-500">
              Showing {shownEmployees.length.toLocaleString('en-IN')} of {visibleEmployees.length.toLocaleString('en-IN')}
            </p>
            {shownEmployees.length < visibleEmployees.length && (
              <Button variant="secondary" size="sm" onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}>
                Show {Math.min(PAGE_SIZE, visibleEmployees.length - shownEmployees.length)} more
              </Button>
            )}
          </div>
        )}
      </div>

      <ChangePasswordModal
        user={passwordUser}
        defaultPassword={EMPLOYEE_DEFAULT_PASSWORD}
        onClose={() => setPasswordUser(null)}
        onChanged={handlePasswordChanged}
      />
      <EditUserModal user={detailsUser} onClose={() => setDetailsUser(null)} onSaved={handleDetailsSaved} />
      <DeleteUserModal user={deleteTarget} onClose={() => setDeleteTarget(null)} onDeleted={handleDeleted} />
    </div>
  );
}
