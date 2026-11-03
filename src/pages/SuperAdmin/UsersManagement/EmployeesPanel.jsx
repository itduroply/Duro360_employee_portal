import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
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
// Rows sent per Edge Function call, so a large sheet never hits its time limit.
const UPLOAD_CHUNK_SIZE = 25;
// Rows drawn at first; "Show more" adds another page so a big sheet stays fast.
const PAGE_SIZE = 50;

// Header spellings accepted for each column, compared after lowercasing and
// removing spaces/punctuation ("Employee ID", "employee_id", "Emp. Code" ...).
const COLUMN_ALIASES = {
  employeeId: ['employeeid', 'empid', 'employeecode', 'empcode', 'employeeno', 'empno', 'employeenumber'],
  name: ['fullname', 'employeename', 'empname', 'name'],
  email: ['email', 'emailid', 'emailaddress', 'officialemail', 'officialemailid', 'workemail', 'mail', 'mailid'],
  branch: ['branch', 'branchname', 'sellingbranch', 'location', 'worklocation'],
  reportingManager: ['reportingmanager', 'reportingmanagername', 'reportingto', 'reportsto', 'reportingmgr', 'manager', 'managername', 'l1manager'],
};

const headerKey = (value) => String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

// HR sheets often have a title row or two above the real header, so look
// for the first row (within the top 10) that has an Employee ID column.
function parseEmployeeSheet(sheet) {
  const grid = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
  const headerIndex = grid.slice(0, 10).findIndex((row) => row.some((cell) => COLUMN_ALIASES.employeeId.includes(headerKey(cell))));
  if (headerIndex === -1) {
    throw new Error('No "Employee ID" column found. The sheet needs Full Name, Email and Employee ID columns.');
  }

  const header = grid[headerIndex].map(headerKey);
  const col = Object.fromEntries(
    Object.entries(COLUMN_ALIASES).map(([field, aliases]) => [field, header.findIndex((h) => aliases.includes(h))])
  );
  if (col.name === -1) throw new Error('No "Full Name" column found.');
  const cell = (row, field) => (col[field] === -1 ? '' : String(row[col[field]] ?? '').trim());

  // Everything else in the sheet is ignored. Duplicate IDs keep the first row.
  const byId = new Map();
  for (const row of grid.slice(headerIndex + 1)) {
    const employeeId = String(row[col.employeeId] ?? '').trim().toUpperCase();
    if (!employeeId || byId.has(employeeId)) continue;
    byId.set(employeeId, {
      employeeId,
      name: cell(row, 'name'),
      email: cell(row, 'email').toLowerCase(),
      branch: cell(row, 'branch'),
      reportingManager: cell(row, 'reportingManager'),
    });
  }
  return [...byId.values()];
}

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
const UploadCloudIcon = (p) => (
  <Icon {...p}>
    <path d="M6.5 14.5h-1a3.5 3.5 0 0 1-.4-6.97A5 5 0 0 1 14.6 6.9 3.8 3.8 0 0 1 14.5 14.5h-1" />
    <path d="M10 17V9.5M7.5 12L10 9.5 12.5 12" />
  </Icon>
);
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
const FileIcon = (p) => (
  <Icon {...p}>
    <path d="M5 2.5h6l4 4v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-13a1 1 0 0 1 1-1Z" />
    <path d="M11 2.5v4h4M7 11h6M7 14h4" />
  </Icon>
);
const XIcon = (p) => (
  <Icon {...p}>
    <path d="M5 5l10 10M15 5L5 15" />
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

const SHEET_COLUMNS = ['Employee ID', 'Full Name', 'Email', 'Branch', 'Reporting Manager'];

/**
 * Employee logins, created from an uploaded HR Excel sheet. The sheet gives
 * Employee ID, Full Name, Email, Branch and Reporting Manager. Each Employee
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

  const fileInputRef = useRef(null);
  const [fileName, setFileName] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [parsedRows, setParsedRows] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(null); // { done, total } while uploading
  const [uploadResults, setUploadResults] = useState(null);

  const [passwordUser, setPasswordUser] = useState(null); // Employee whose password modal is open
  const [detailsUser, setDetailsUser] = useState(null); // Employee whose details modal is open
  const [deleteTarget, setDeleteTarget] = useState(null); // Employee waiting for delete confirmation
  const [branches, setBranches] = useState([]);
  const [editingId, setEditingId] = useState(null); // Employee whose features row is open
  const [editPermissions, setEditPermissions] = useState([]);
  const [isSavingPermissions, setIsSavingPermissions] = useState(false);

  const branchName = (id) => branches.find((b) => b.id === id)?.name;

  // Match the sheet's Branch names to branch ids (ignoring case and spaces).
  // Names that match nothing are listed below the file picker.
  const { rowsToUpload, unmatchedBranches } = useMemo(() => {
    const idByName = new Map(branches.map((b) => [headerKey(b.name), b.id]));
    const unmatched = new Set();
    const rows = parsedRows.map((row) => {
      if (!row.branch) return row;
      const branchId = idByName.get(headerKey(row.branch));
      if (branchId === undefined) unmatched.add(row.branch);
      return { ...row, branchId: branchId ?? '' };
    });
    return { rowsToUpload: rows, unmatchedBranches: [...unmatched] };
  }, [parsedRows, branches]);

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
    return { total: employees.length, active, inactive: employees.length - active, noBranch: employees.filter((e) => !e.selling_branch_id).length };
  }, [employees]);

  const visibleEmployees = useMemo(() => {
    const q = search.trim().toLowerCase();
    return employees.filter((e) => {
      if (statusFilter !== 'ALL' && e.status !== statusFilter) return false;
      if (!q) return true;
      return [e.employee_id, e.name, e.email, e.reporting_manager, branchName(e.selling_branch_id)].some((v) => v?.toLowerCase().includes(q));
    });
    // branchName only reads `branches`, so that is the dependency to watch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employees, search, statusFilter, branches]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [search, statusFilter]);

  function resetFile() {
    setParsedRows([]);
    setFileName('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function readFile(file) {
    setError('');
    setNotice('');
    setUploadResults(null);
    setParsedRows([]);
    setFileName('');
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const workbook = XLSX.read(evt.target.result, { type: 'array' });
        const rows = parseEmployeeSheet(workbook.Sheets[workbook.SheetNames[0]]);
        if (rows.length === 0) setError('No rows with an Employee ID were found in this sheet.');
        setParsedRows(rows);
        setFileName(file.name);
      } catch (err) {
        setError(err.message || 'Could not read this file. Make sure it is a valid .xlsx/.xls/.csv file.');
        resetFile();
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function handleDrop(e) {
    e.preventDefault();
    setIsDragging(false);
    if (uploadProgress) return;
    readFile(e.dataTransfer.files?.[0]);
  }

  async function handleUpload() {
    setError('');
    setUploadResults(null);
    const results = [];
    setUploadProgress({ done: 0, total: rowsToUpload.length });
    try {
      for (let i = 0; i < rowsToUpload.length; i += UPLOAD_CHUNK_SIZE) {
        const { results: chunkResults } = await usersApi.bulkCreateEmployees(rowsToUpload.slice(i, i + UPLOAD_CHUNK_SIZE));
        results.push(...chunkResults);
        setUploadProgress({ done: results.length, total: rowsToUpload.length });
      }
      resetFile();
    } catch (err) {
      setError(`${err.message || 'Upload stopped.'} ${results.length} of ${rowsToUpload.length} rows were processed.`);
    } finally {
      setUploadResults(results);
      setUploadProgress(null);
      await loadEmployees();
    }
  }

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

  const created = uploadResults?.filter((r) => r.ok).length ?? 0;
  const skipped = uploadResults?.filter((r) => r.skipped).length ?? 0;
  const failed = uploadResults?.filter((r) => !r.ok && !r.skipped) ?? [];
  const progressPct = uploadProgress ? Math.round((uploadProgress.done / Math.max(uploadProgress.total, 1)) * 100) : 0;
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

      {/* Upload zone */}
      <div className="mb-6 overflow-hidden rounded-3xl border border-gray-200/80 bg-gradient-to-br from-brand-25 via-white to-white p-5 shadow-theme-xs sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-500 text-white">
            <SparkIcon className="h-4 w-4" />
          </span>
          <h3 className="text-base font-semibold text-gray-800">Upload employee sheet</h3>
          <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-theme-xs font-medium text-gray-600">.xlsx · .xls · .csv</span>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`mt-4 rounded-2xl border-2 border-dashed p-6 text-center transition-all sm:p-8 ${
            isDragging ? 'scale-[1.01] border-brand-400 bg-brand-50' : 'border-gray-300 bg-white/70 hover:border-brand-300 hover:bg-brand-25'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => readFile(e.target.files?.[0])}
            disabled={Boolean(uploadProgress)}
            className="hidden"
          />

          {parsedRows.length === 0 ? (
            <>
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-500">
                <UploadCloudIcon className="h-7 w-7" />
              </span>
              <p className="mt-3 text-sm font-semibold text-gray-800">Drop your Excel here</p>
              <p className="mt-1 text-theme-sm text-gray-500">
                or{' '}
                <button type="button" onClick={() => fileInputRef.current?.click()} className="font-semibold text-brand-500 hover:text-brand-600">
                  browse files
                </button>
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {SHEET_COLUMNS.map((c) => (
                  <span key={c} className="rounded-full border border-gray-200 bg-white px-3 py-1 text-theme-xs font-medium text-gray-600">
                    {c}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-4 text-left">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-success-50 text-success-600">
                  <FileIcon className="h-6 w-6" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-gray-800">{fileName}</p>
                  <p className="text-theme-sm text-gray-500">
                    {parsedRows.length.toLocaleString('en-IN')} employees found · first: {parsedRows[0].employeeId} — {parsedRows[0].name || '(no name)'}
                    {parsedRows[0].branch ? ` — ${parsedRows[0].branch}` : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={resetFile} disabled={Boolean(uploadProgress)}>
                  <XIcon className="h-4 w-4" />
                  Remove
                </Button>
                <Button onClick={handleUpload} isLoading={Boolean(uploadProgress)}>
                  <UploadCloudIcon className="h-4 w-4" />
                  Create {parsedRows.length.toLocaleString('en-IN')} logins
                </Button>
              </div>
            </div>
          )}

          {uploadProgress && (
            <div className="mt-4 text-left">
              <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                <div className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-600 transition-all" style={{ width: `${progressPct}%` }} />
              </div>
              <p className="mt-2 text-theme-xs font-medium text-gray-500">
                Processing {uploadProgress.done} of {uploadProgress.total}…
              </p>
            </div>
          )}
        </div>

        {unmatchedBranches.length > 0 && !uploadProgress && (
          <Alert variant="error" className="mt-4">
            These branch names in the sheet do not match any branch, so those employees will get no branch: {unmatchedBranches.slice(0, 10).join(', ')}
            {unmatchedBranches.length > 10 ? `, and ${unmatchedBranches.length - 10} more` : ''}.
          </Alert>
        )}

        {uploadResults && (
          <Alert variant={failed.length ? 'error' : 'success'} className="mt-4">
            <p>
              {created} created, {skipped} already existed, {failed.length} failed.
            </p>
            {failed.length > 0 && (
              <ul className="mt-2 list-disc pl-5">
                {failed.slice(0, 20).map((r, i) => (
                  <li key={`${r.employeeId}-${i}`}>
                    {r.employeeId || '(no ID)'}: {r.message}
                  </li>
                ))}
                {failed.length > 20 && <li>…and {failed.length - 20} more.</li>}
              </ul>
            )}
          </Alert>
        )}
      </div>

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
            placeholder="Search ID, name, branch, manager"
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
                <th className="whitespace-nowrap px-4 py-3.5">Reporting manager</th>
                <th className="whitespace-nowrap px-4 py-3.5">Status</th>
                <th className="whitespace-nowrap px-4 py-3.5">Features</th>
                <th className="px-4 py-3.5" />
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={7} className={TABLE_EMPTY}>
                    Loading…
                  </td>
                </tr>
              )}
              {!isLoading && visibleEmployees.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-14 text-center">
                    <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-gray-400">
                      <UsersIcon className="h-7 w-7" />
                    </span>
                    <p className="mt-3 text-sm font-semibold text-gray-700">
                      {employees.length === 0 ? 'No employees yet' : 'No employees match this search'}
                    </p>
                    <p className="mt-1 text-theme-sm text-gray-500">
                      {employees.length === 0 ? 'Upload an Excel sheet above to create their logins.' : 'Try a different word or filter.'}
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
                          <Pill icon={<MapPinIcon className="h-3.5 w-3.5" />} empty={!branchName(employee.selling_branch_id)}>
                            {branchName(employee.selling_branch_id)}
                          </Pill>
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
                          <td colSpan={7} className="whitespace-normal px-5 py-5">
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
