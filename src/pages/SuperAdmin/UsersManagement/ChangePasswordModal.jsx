import { useEffect, useState } from 'react';
import { usersApi } from '../../../api/usersApi';
import Button from '../../../components/common/Button.jsx';
import Alert from '../../../components/common/Alert.jsx';
import PasswordInput from '../../../components/common/PasswordInput.jsx';
import { CloseIcon, KeyIcon } from '../../../components/common/icons.jsx';

const MIN_LENGTH = 6;

// Super Admin sets a new password for one login (manage-users `set_password`).
// `user` is a profiles row ({ id, name, employee_id }); null keeps it closed.
export default function ChangePasswordModal({ user, defaultPassword, onClose, onChanged }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setPassword('');
    setConfirm('');
    setError('');
  }, [user]);

  useEffect(() => {
    if (!user) return undefined;
    const onKey = (e) => e.key === 'Escape' && !isSaving && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [user, isSaving, onClose]);

  if (!user) return null;

  const tooShort = password.length > 0 && password.length < MIN_LENGTH;
  const mismatch = confirm.length > 0 && confirm !== password;
  const canSave = password.length >= MIN_LENGTH && confirm === password;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSave) return;
    setIsSaving(true);
    setError('');
    try {
      await usersApi.setPassword(user.id, password);
      onChanged(user);
    } catch (err) {
      setError(err.message || 'Could not change the password.');
    } finally {
      setIsSaving(false);
    }
  }

  function useDefault() {
    setPassword(defaultPassword);
    setConfirm(defaultPassword);
  }

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-gray-900/50 p-4 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && !isSaving && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="change-password-title"
        className="w-full max-w-md animate-fade-in-up overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5"
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-6 py-5">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-500">
              <KeyIcon className="h-5 w-5" />
            </span>
            <div>
              <h3 id="change-password-title" className="text-base font-semibold text-gray-800">
                Change Password
              </h3>
              <p className="text-theme-sm text-gray-500">
                {user.name}
                {user.employee_id && <span className="text-gray-400"> · {user.employee_id}</span>}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            aria-label="Close"
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <CloseIcon />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5">
          <PasswordInput
            id="new-password"
            label="New Password"
            autoComplete="new-password"
            placeholder={`At least ${MIN_LENGTH} characters`}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={tooShort ? `Use at least ${MIN_LENGTH} characters.` : ''}
            autoFocus
          />
          <PasswordInput
            id="confirm-password"
            label="Confirm Password"
            autoComplete="new-password"
            placeholder="Type the password again"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            error={mismatch ? 'Passwords do not match.' : ''}
          />

          {defaultPassword && (
            <button
              type="button"
              onClick={useDefault}
              className="-mt-1 mb-2 text-theme-sm font-medium text-brand-500 hover:text-brand-600"
            >
              Reset to default ({defaultPassword})
            </button>
          )}

          {error && (
            <Alert variant="error" className="mt-2">
              {error}
            </Alert>
          )}

          <div className="mt-5 flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSaving} disabled={!canSave}>
              Update Password
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
