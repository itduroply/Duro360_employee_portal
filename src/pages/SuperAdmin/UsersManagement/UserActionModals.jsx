import { useEffect, useState } from 'react';
import { usersApi } from '../../../api/usersApi';
import Modal from '../../../components/common/Modal.jsx';
import Button from '../../../components/common/Button.jsx';
import TextInput from '../../../components/common/TextInput.jsx';
import Select from '../../../components/common/Select.jsx';
import Alert from '../../../components/common/Alert.jsx';

function Req({ children }) {
  return (
    <>
      {children} <span className="text-error-500">*</span>
    </>
  );
}

// Edit the details of one Employee or Admin login. `user` is a profiles row
// ({ id, name, email, mobile_number, employee_id, selling_branch_id }); null
// keeps it closed. The password is not touched here.
export function EditUserModal({ user, onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', employeeId: '', email: '', mobile: '', branchId: '' });
  const [branches, setBranches] = useState([]);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!user) return undefined;
    let cancelled = false;
    setForm({
      name: user.name || '',
      employeeId: user.employee_id || '',
      email: user.email || '',
      mobile: user.mobile_number || '',
      branchId: user.selling_branch_id ? String(user.selling_branch_id) : '',
    });
    setErrors({});
    setSubmitError('');
    usersApi
      .listBranches()
      .then(({ branches: list }) => !cancelled && setBranches(list))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user]);

  const set = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  // An Employee ID login signs in with its ID, so the ID must stay filled.
  const idRequired = Boolean(user?.employee_id);

  function validate() {
    const e = {};
    if (!form.name.trim()) e.name = 'Name is required.';
    if (idRequired && !form.employeeId.trim()) e.employeeId = 'Employee code is required.';
    else if (form.employeeId.trim() && !/^[A-Za-z0-9._-]+$/.test(form.employeeId.trim())) e.employeeId = 'Use letters, numbers, dot, dash or underscore only.';
    if (!form.email.trim()) e.email = 'Email is required.';
    else if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) e.email = 'Enter a valid email address.';
    if (form.mobile.trim() && !/^\d{10}$/.test(form.mobile.trim())) e.mobile = 'Mobile number must be 10 digits.';
    return e;
  }

  async function handleSubmit(ev) {
    ev.preventDefault();
    const found = validate();
    setErrors(found);
    const count = Object.keys(found).length;
    if (count > 0) {
      setSubmitError(`${count} field${count > 1 ? 's' : ''} need${count > 1 ? '' : 's'} attention.`);
      return;
    }
    setSubmitError('');
    setIsSaving(true);
    try {
      const result = await usersApi.updateUser({
        userId: user.id,
        name: form.name.trim(),
        employeeId: form.employeeId.trim(),
        email: form.email.trim(),
        mobile: form.mobile.trim(),
        branchId: form.branchId,
      });
      onSaved(user, result);
    } catch (err) {
      setSubmitError(err.message || 'Could not save these changes.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Modal
      open={Boolean(user)}
      size="lg"
      title="Edit details"
      subtitle={user ? `${user.name}${user.employee_id ? ` · ${user.employee_id}` : ''}` : ''}
      onClose={onClose}
      locked={isSaving}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="submit" form="edit-user-form" isLoading={isSaving}>
            Save changes
          </Button>
        </>
      }
    >
      <form id="edit-user-form" onSubmit={handleSubmit} noValidate>
        <div className="grid grid-cols-1 gap-x-5 sm:grid-cols-2">
          <TextInput id="edit-user-name" label={<Req>Name</Req>} value={form.name} onChange={(e) => set('name', e.target.value)} error={errors.name} />
          <TextInput
            id="edit-user-code"
            label={idRequired ? <Req>Employee Code</Req> : 'Employee Code'}
            value={form.employeeId}
            onChange={(e) => set('employeeId', e.target.value.toUpperCase())}
            error={errors.employeeId}
            hint={idRequired ? 'This person signs in with their Employee Code. Changing it changes the sign-in ID.' : undefined}
          />
          <TextInput
            id="edit-user-email"
            label={<Req>Email Address</Req>}
            type="email"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            error={errors.email}
          />
          <TextInput
            id="edit-user-mobile"
            label="Mobile Number"
            type="tel"
            inputMode="numeric"
            maxLength={10}
            value={form.mobile}
            onChange={(e) => set('mobile', e.target.value.replace(/\D/g, ''))}
            error={errors.mobile}
          />
          <Select id="edit-user-branch" label="Branch" value={form.branchId} onChange={(e) => set('branchId', e.target.value)} wrapperClassName="mb-4">
            <option value="">No branch</option>
            {branches.map((br) => (
              <option key={br.id} value={br.id}>
                {br.name}
              </option>
            ))}
          </Select>
        </div>
        {submitError && (
          <Alert variant="error" className="mt-2">
            {submitError}
          </Alert>
        )}
      </form>
    </Modal>
  );
}

// Asks before deleting one login for good. `user` null keeps it closed.
export function DeleteUserModal({ user, onClose, onDeleted }) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setError('');
  }, [user]);

  async function handleDelete() {
    setIsDeleting(true);
    setError('');
    try {
      await usersApi.deleteUser(user.id);
      onDeleted(user);
    } catch (err) {
      setError(err.message || 'Could not delete this login.');
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <Modal
      open={Boolean(user)}
      title="Delete this login?"
      subtitle={user ? `${user.name}${user.employee_id ? ` · ${user.employee_id}` : ''}` : ''}
      onClose={onClose}
      locked={isDeleting}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={isDeleting}>
            Cancel
          </Button>
          <Button type="button" variant="danger" onClick={handleDelete} isLoading={isDeleting}>
            Delete login
          </Button>
        </>
      }
    >
      <p className="text-theme-sm text-gray-600">
        This removes the login for good. {user?.name} will not be able to sign in, and this cannot be undone.
      </p>
      <p className="mt-3 text-theme-sm text-gray-600">
        If you only want to stop them signing in for now, use <span className="font-medium text-gray-800">Deactivate</span> instead.
      </p>
      {error && (
        <Alert variant="error" className="mt-4">
          {error}
        </Alert>
      )}
    </Modal>
  );
}
