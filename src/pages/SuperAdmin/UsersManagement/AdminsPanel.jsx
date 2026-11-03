import { Fragment, useEffect, useState } from 'react';
import { usersApi } from '../../../api/usersApi';
import { ASSIGNABLE_ADMIN_PERMISSIONS } from '../../../components/Sidebar/sidebarConfig.js';
import Button from '../../../components/common/Button.jsx';
import TextInput from '../../../components/common/TextInput.jsx';
import Select from '../../../components/common/Select.jsx';
import Alert from '../../../components/common/Alert.jsx';
import PageHeader from '../../../components/common/PageHeader.jsx';
import { EditUserModal, DeleteUserModal } from './UserActionModals.jsx';
import { CHECKBOX, LABEL, HINT_ERROR } from '../../../components/common/formStyles.js';
import {
  TABLE_WRAPPER, TABLE, TABLE_HEAD, TH, TABLE_ROW, TD, TD_PRIMARY, TABLE_EMPTY, CHIP_ACTIVE, CHIP_INACTIVE, CHIP_LIGHT,
} from '../../../components/common/tableStyles.js';

function PencilIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
      <path d="M13.6 2.9a2 2 0 0 1 2.8 0l.7.7a2 2 0 0 1 0 2.8l-1.4 1.4-3.5-3.5 1.4-1.4ZM11.1 5.4l3.5 3.5-7.9 7.9-3.9.9.9-3.9 7.4-8.4Z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
      <path d="M7.5 2.5h5l.6 1.5H16a.75.75 0 0 1 0 1.5H4A.75.75 0 0 1 4 4h2.9l.6-1.5Z" />
      <path d="M5 7h10l-.8 9.1A1.5 1.5 0 0 1 12.7 17.5H7.3a1.5 1.5 0 0 1-1.5-1.4L5 7Zm3 2v6h1.25V9H8Zm2.75 0v6H12V9h-1.25Z" />
    </svg>
  );
}

const DEFAULT_PASSWORD = 'Test@123';
const EMPTY_FORM = { name: '', employeeCode: '', email: '', mobile: '', branchId: '', password: DEFAULT_PASSWORD, permissions: [] };

function Req({ children }) {
  return (
    <>
      {children} <span className="text-error-500">*</span>
    </>
  );
}

function validate(form) {
  const errors = {};
  if (!form.name.trim()) errors.name = 'Name is required.';
  if (!form.employeeCode.trim()) errors.employeeCode = 'Employee code is required.';
  else if (!/^[A-Za-z0-9._-]+$/.test(form.employeeCode.trim())) errors.employeeCode = 'Use letters, numbers, dot, dash or underscore only.';
  if (!form.email.trim()) errors.email = 'Email is required.';
  else if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) errors.email = 'Enter a valid email address.';
  if (!form.mobile.trim()) errors.mobile = 'Mobile number is required.';
  else if (!/^\d{10}$/.test(form.mobile.trim())) errors.mobile = 'Mobile number must be 10 digits.';
  if (!form.branchId) errors.branchId = 'Select a branch.';
  if (!form.password.trim()) errors.password = 'Password is required.';
  return errors;
}

const FIELD_IDS = { name: 'admin-name', employeeCode: 'admin-employee-code', email: 'admin-email', mobile: 'admin-mobile', branchId: 'admin-branch', password: 'admin-password' };

export function PermissionCheckboxes({ selected, onChange }) {
  function toggle(key) {
    onChange(selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key]);
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {ASSIGNABLE_ADMIN_PERMISSIONS.map((perm) => (
        <label key={perm.key} className="flex cursor-pointer items-center gap-3 text-sm font-medium text-gray-700">
          <input
            type="checkbox"
            checked={selected.includes(perm.key)}
            onChange={() => toggle(perm.key)}
            className={CHECKBOX}
          />
          {perm.label}
        </label>
      ))}
    </div>
  );
}
  
// `embedded` hides this panel's own page title when it is shown as a tab
// inside UsersPage.jsx, which has its own title.
export default function AdminsPanel({ embedded = false }) {
  const [admins, setAdmins] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [branches, setBranches] = useState([]);
  const [createdNotice, setCreatedNotice] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editPermissions, setEditPermissions] = useState([]);
  const [isSavingPermissions, setIsSavingPermissions] = useState(false);
  const [detailsUser, setDetailsUser] = useState(null); // login whose details modal is open
  const [deleteTarget, setDeleteTarget] = useState(null); // login waiting for delete confirmation

  async function loadAdmins() {
    setIsLoading(true);
    setListError('');
    try {
      const { users } = await usersApi.listAdmins();
      setAdmins(users);
    } catch (err) {
      setListError(err.message || 'Could not load Employees.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadAdmins();
    usersApi
      .listBranches()
      .then(({ branches: list }) => setBranches(list))
      .catch((err) => setListError(err.message || 'Could not load branches.'));
  }, []);

  const branchName = (id) => branches.find((b) => b.id === id)?.name || '—';

  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
    setFieldErrors((errs) => ({ ...errs, [key]: undefined }));
  }

  async function handleCreate(e) {
    e.preventDefault();
    const errors = validate(form);
    setFieldErrors(errors);
    const keys = Object.keys(errors);
    if (keys.length > 0) {
      setCreateError(`${keys.length} field${keys.length > 1 ? 's' : ''} need${keys.length > 1 ? '' : 's'} attention.`);
      document.getElementById(FIELD_IDS[keys[0]])?.focus();
      return;
    }
    setCreateError('');
    setCreatedNotice('');
    setIsCreating(true);
    try {
      await usersApi.createAdmin(form);
      setCreatedNotice(`Employee created:${form.email} / ${form.password}`);
      setForm(EMPTY_FORM);
      setShowCreateForm(false);
      await loadAdmins();
    } catch (err) {
      setCreateError(err.message || 'Could not create this Employee.');
    } finally {
      setIsCreating(false);
    }
  }

  function startEditing(admin) {
    setEditingId(admin.id);
    setEditPermissions(admin.permissions || []);
  }

  async function saveEditingPermissions() {
    setIsSavingPermissions(true);
    try {
      await usersApi.updatePermissions(editingId, editPermissions);
      setEditingId(null);
      await loadAdmins();
    } catch (err) {
      setListError(err.message || 'Could not update permissions.');
    } finally {
      setIsSavingPermissions(false);
    }
  }

  async function handleDetailsSaved(user, result) {
    setDetailsUser(null);
    setCreatedNotice(
      result?.loginChanged
        ? `Details saved for ${user.name}. Their sign-in address changed to ${result.loginEmail}.`
        : `Details saved for ${user.name}.`
    );
    await loadAdmins();
  }

  async function handleDeleted(user) {
    setDeleteTarget(null);
    setCreatedNotice(`${user.name} was deleted.`);
    await loadAdmins();
  }

  async function toggleStatus(admin) {
    const nextStatus = admin.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await usersApi.updateStatus(admin.id, nextStatus);
      await loadAdmins();
    } catch (err) {
      setListError(err.message || 'Could not update status.');
    }
  }

  return (
    <div>
      {!embedded && (
        <PageHeader
          title="Employees"
      
        />
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-theme-sm text-gray-500">
          Every Employee below only sees the Admin Console features checked next to its name.
        </p>
        <Button variant={showCreateForm ? 'secondary' : 'primary'} onClick={() => setShowCreateForm((v) => !v)}>{showCreateForm ? 'Cancel' : '+ Create Employee'}</Button>
      </div>

      {createdNotice && (
        <Alert variant="success" className="mb-4">
          {createdNotice}
        </Alert>
      )}

      {showCreateForm && (
        <form onSubmit={handleCreate} noValidate className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
          <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
            <TextInput
              id="admin-name"
              label={<Req>Name</Req>}
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
              error={fieldErrors.name}
            />
            <TextInput
              id="admin-employee-code"
              label={<Req>Employee Code</Req>}
              value={form.employeeCode}
              onChange={(e) => setField('employeeCode', e.target.value.toUpperCase())}
              error={fieldErrors.employeeCode}
            />
            <TextInput
              id="admin-email"
              label={<Req>Email Address</Req>}
              type="email"
              value={form.email}
              onChange={(e) => setField('email', e.target.value)}
              error={fieldErrors.email}
            />
            <TextInput
              id="admin-mobile"
              label={<Req>Mobile Number</Req>}
              type="tel"
              inputMode="numeric"
              maxLength={10}
              value={form.mobile}
              onChange={(e) => setField('mobile', e.target.value.replace(/\D/g, ''))}
              error={fieldErrors.mobile}
            />
            <div className="mb-4">
              <Select
                id="admin-branch"
                label={<Req>Branch</Req>}
                value={form.branchId}
                onChange={(e) => setField('branchId', e.target.value)}
              >
                <option value="">Select branch</option>
                {branches.map((br) => (
                  <option key={br.id} value={br.id}>
                    {br.name}
                  </option>
                ))}
              </Select>
              {fieldErrors.branchId && <p className={HINT_ERROR}>{fieldErrors.branchId}</p>}
            </div>
            <TextInput
              id="admin-password"
              label={<Req>Password</Req>}
              value={form.password}
              onChange={(e) => setField('password', e.target.value)}
              error={fieldErrors.password}
            />
          </div>

          <p className={`${LABEL} mt-2`}>Features to give this Employee</p>
          <PermissionCheckboxes
            selected={form.permissions}
            onChange={(permissions) => setForm((f) => ({ ...f, permissions }))}
          />

          {createError && (
            <Alert variant="error" className="mt-4">
              {createError}
            </Alert>
          )}

          <Button type="submit" isLoading={isCreating} className="mt-4">
            Create Employee
          </Button>
        </form>
      )}

      {listError && (
        <Alert variant="error" className="mb-4">
          {listError}
        </Alert>
      )}

      <div className={TABLE_WRAPPER}>
        <div className="custom-scrollbar overflow-x-auto">
        <table className={TABLE}>
          <thead className={TABLE_HEAD}>
            <tr>
              <th className={TH}>Name</th>
              <th className={TH}>Email</th>
              <th className={TH}>Mobile</th>
              <th className={TH}>Branch</th>
              <th className={TH}>Status</th>
              <th className={TH}>Features</th>
              <th className={TH} />
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
            {!isLoading && admins.length === 0 && (
              <tr>
                <td colSpan={7} className={TABLE_EMPTY}>
                  No Employees yet.
                </td>
              </tr>
            )}
            {!isLoading &&
              admins.map((admin) => (
                <Fragment key={admin.id}>
                <tr className={`${TABLE_ROW} align-top`}>
                  <td className={`${TD} ${TD_PRIMARY}`}>{admin.name}</td>
                  <td className={TD}>{admin.email}</td>
                  <td className={TD}>{admin.mobile_number || '—'}</td>
                  <td className={TD}>{branchName(admin.selling_branch_id)}</td>
                  <td className={TD}>
                    <span
                      className={admin.status === 'ACTIVE' ? CHIP_ACTIVE : CHIP_INACTIVE}
                    >
                      {admin.status}
                    </span>
                  </td>
                  <td className={TD}>
                    {(admin.permissions || []).length === 0 ? (
                      <span className="text-gray-400">None</span>
                    ) : (
                      <div className="flex min-w-[160px] max-w-[200px] flex-wrap gap-1.5 whitespace-normal">
                        {(admin.permissions || []).map((key) => {
                          const perm = ASSIGNABLE_ADMIN_PERMISSIONS.find((p) => p.key === key);
                          return (
                            <span key={key} className={CHIP_LIGHT}>
                              {perm?.label || key}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </td>
                  <td className={`${TD} text-right`}>
                    {editingId !== admin.id && (
                      <div className="flex justify-end gap-4 whitespace-nowrap border-l border-gray-200 pl-4">
                        <button
                          type="button"
                          onClick={() => startEditing(admin)}
                          className="flex items-center gap-1.5 text-theme-sm font-medium text-accent-500 hover:text-accent-700"
                        >
                          <PencilIcon />
                          Edit features
                        </button>
                        <button
                          type="button"
                          onClick={() => setDetailsUser(admin)}
                          className="flex items-center gap-1.5 text-theme-sm font-medium text-accent-500 hover:text-accent-700"
                        >
                          Edit details
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleStatus(admin)}
                          className="flex items-center gap-1.5 text-theme-sm font-medium text-accent-500 hover:text-accent-700"
                        >
                          {admin.status === 'ACTIVE' && <TrashIcon />}
                          {admin.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(admin)}
                          className="flex items-center gap-1.5 text-theme-sm font-medium text-error-500 hover:text-error-600"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
                {editingId === admin.id && (
                  <tr className="bg-gray-50">
                    <td colSpan={7} className="px-5 py-5 whitespace-normal">
                      <p className={LABEL}>Features for {admin.name}</p>
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
              ))}
          </tbody>
        </table>
        </div>
      </div>

      <EditUserModal user={detailsUser} onClose={() => setDetailsUser(null)} onSaved={handleDetailsSaved} />
      <DeleteUserModal user={deleteTarget} onClose={() => setDeleteTarget(null)} onDeleted={handleDeleted} />
    </div>
  );
}
