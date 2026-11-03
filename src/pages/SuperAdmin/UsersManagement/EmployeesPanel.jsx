import { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { usersApi } from '../../../api/usersApi';
import Button from '../../../components/common/Button.jsx';
import Alert from '../../../components/common/Alert.jsx';
import { KeyIcon, SearchIcon } from '../../../components/common/icons.jsx';
import { INPUT, INPUT_OK } from '../../../components/common/formStyles.js';
import {
  TABLE_WRAPPER, TABLE, TABLE_HEAD, TH, TABLE_ROW, TD, TD_PRIMARY, TABLE_EMPTY, CHIP_ACTIVE, CHIP_INACTIVE,
} from '../../../components/common/tableStyles.js';
import ChangePasswordModal from './ChangePasswordModal.jsx';
import { EditUserModal, DeleteUserModal } from './UserActionModals.jsx';

// Keep in sync with EMPLOYEE_DEFAULT_PASSWORD in
// supabase/functions/manage-users/index.ts (the server sets it, this only shows it).
const EMPLOYEE_DEFAULT_PASSWORD = 'Duroply@123';
// Rows sent per Edge Function call, so a large sheet never hits its time limit.
const UPLOAD_CHUNK_SIZE = 25;

// Header spellings accepted for each column, compared after lowercasing and
// removing spaces/punctuation ("Employee ID", "employee_id", "Emp. Code" ...).
const COLUMN_ALIASES = {
  employeeId: ['employeeid', 'empid', 'employeecode', 'empcode', 'employeeno', 'empno', 'employeenumber'],
  name: ['fullname', 'employeename', 'empname', 'name'],
  email: ['email', 'emailid', 'emailaddress', 'officialemail', 'officialemailid', 'workemail', 'mail', 'mailid'],
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

  // Everything else in the sheet is ignored. Duplicate IDs keep the first row.
  const byId = new Map();
  for (const row of grid.slice(headerIndex + 1)) {
    const employeeId = String(row[col.employeeId] ?? '').trim().toUpperCase();
    if (!employeeId || byId.has(employeeId)) continue;
    byId.set(employeeId, {
      employeeId,
      name: String(row[col.name] ?? '').trim(),
      email: col.email === -1 ? '' : String(row[col.email] ?? '').trim().toLowerCase(),
    });
  }
  return [...byId.values()];
}

/**
 * Employee logins, created from an uploaded HR Excel sheet. Only Full Name,
 * Email and Employee ID are saved. Each Employee signs in with their Employee
 * ID and gets every Admin Console feature except creating Dealers and Users
 * (see supabase/migrations/20260928120000_add_employee_login.sql).
 */
export default function EmployeesPanel() {
  const [employees, setEmployees] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');

  const fileInputRef = useRef(null);
  const [parsedRows, setParsedRows] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(null); // { done, total } while uploading
  const [uploadResults, setUploadResults] = useState(null);

  const [passwordUser, setPasswordUser] = useState(null); // Employee whose password modal is open
  const [detailsUser, setDetailsUser] = useState(null); // Employee whose details modal is open
  const [deleteTarget, setDeleteTarget] = useState(null); // Employee waiting for delete confirmation

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
  }, []);

  const visibleEmployees = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((e) => [e.employee_id, e.name, e.email].some((v) => v?.toLowerCase().includes(q)));
  }, [employees, search]);

  function resetFile() {
    setParsedRows([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    setError('');
    setNotice('');
    setUploadResults(null);
    setParsedRows([]);
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const workbook = XLSX.read(evt.target.result, { type: 'array' });
        const rows = parseEmployeeSheet(workbook.Sheets[workbook.SheetNames[0]]);
        if (rows.length === 0) setError('No rows with an Employee ID were found in this sheet.');
        setParsedRows(rows);
      } catch (err) {
        setError(err.message || 'Could not read this file. Make sure it is a valid .xlsx/.xls/.csv file.');
        resetFile();
      }
    };
    reader.readAsArrayBuffer(file);
  }

  async function handleUpload() {
    setError('');
    setUploadResults(null);
    const results = [];
    setUploadProgress({ done: 0, total: parsedRows.length });
    try {
      for (let i = 0; i < parsedRows.length; i += UPLOAD_CHUNK_SIZE) {
        const { results: chunkResults } = await usersApi.bulkCreateEmployees(parsedRows.slice(i, i + UPLOAD_CHUNK_SIZE));
        results.push(...chunkResults);
        setUploadProgress({ done: results.length, total: parsedRows.length });
      }
      resetFile();
    } catch (err) {
      setError(`${err.message || 'Upload stopped.'} ${results.length} of ${parsedRows.length} rows were processed.`);
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

  return (
    <div>
      <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
        <h3 className="text-base font-semibold text-gray-800">Upload Employee Excel</h3>
        

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileChange}
            disabled={Boolean(uploadProgress)}
            className="text-sm text-gray-700 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-brand-600 hover:file:bg-brand-100"
          />
          {parsedRows.length > 0 && (
            <Button onClick={handleUpload} isLoading={Boolean(uploadProgress)}>
              Create {parsedRows.length.toLocaleString('en-IN')} logins
            </Button>
          )}
        </div>

        {uploadProgress && (
          <p className="mt-3 text-theme-sm text-gray-500">
            Processing {uploadProgress.done} of {uploadProgress.total}…
          </p>
        )}

        {parsedRows.length > 0 && !uploadProgress && (
          <p className="mt-3 text-theme-sm text-gray-500">
            {parsedRows.length.toLocaleString('en-IN')} employees found. First row: {parsedRows[0].employeeId} —{' '}
            {parsedRows[0].name || '(no name)'} — {parsedRows[0].email || '(no email)'}
          </p>
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

      <div className="mb-4 flex justify-end">
        <div className="relative w-full sm:w-64">
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-gray-500">
            <SearchIcon />
          </span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search ID, name or email"
            className={`${INPUT} ${INPUT_OK} pl-11`}
          />
        </div>
      </div>

      <div className={TABLE_WRAPPER}>
        <div className="custom-scrollbar overflow-x-auto">
          <table className={TABLE}>
            <thead className={TABLE_HEAD}>
              <tr>
                <th className={TH}>Employee ID</th>
                <th className={TH}>Full Name</th>
                <th className={TH}>Email</th>
                <th className={TH}>Status</th>
                <th className={TH} />
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={5} className={TABLE_EMPTY}>
                    Loading…
                  </td>
                </tr>
              )}
              {!isLoading && visibleEmployees.length === 0 && (
                <tr>
                  <td colSpan={5} className={TABLE_EMPTY}>
                    {employees.length === 0 ? 'No Employees yet. Upload an Excel sheet above.' : 'No Employees match this search.'}
                  </td>
                </tr>
              )}
              {!isLoading &&
                visibleEmployees.map((employee) => (
                  <tr key={employee.id} className={TABLE_ROW}>
                    <td className={`${TD} whitespace-nowrap`}>{employee.employee_id}</td>
                    <td className={`${TD} ${TD_PRIMARY}`}>{employee.name}</td>
                    {/* An Employee with no email in the sheet shows its internal login address. */}
                    <td className={TD}>{employee.email}</td>
                    <td className={TD}>
                      <span className={employee.status === 'ACTIVE' ? CHIP_ACTIVE : CHIP_INACTIVE}>{employee.status}</span>
                    </td>
                    <td className={`${TD} text-right`}>
                      <div className="flex items-center justify-end gap-3">
                        <div className="group relative">
                          <button
                            type="button"
                            onClick={() => openPasswordModal(employee)}
                            aria-label="Change password"
                            className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition-colors hover:border-brand-200 hover:bg-brand-50 hover:text-brand-500 focus:outline-none focus:ring-3 focus:ring-brand-500/20"
                          >
                            <KeyIcon />
                          </button>
                          <span
                            role="tooltip"
                            className="pointer-events-none absolute right-full top-1/2 z-10 mr-2 -translate-y-1/2 whitespace-nowrap rounded-md bg-gray-900 px-2.5 py-1 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100"
                          >
                            Change password
                            <span className="absolute left-full top-1/2 -translate-y-1/2 border-4 border-transparent border-l-gray-900" />
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setDetailsUser(employee)}
                          className="text-theme-sm font-medium text-brand-500 hover:text-brand-600"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleStatus(employee)}
                          className="text-theme-sm font-medium text-gray-500 hover:text-gray-700"
                        >
                          {employee.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(employee)}
                          className="text-theme-sm font-medium text-error-500 hover:text-error-600"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
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
