import TextInput from '../../../components/common/TextInput.jsx';
import PasswordInput from '../../../components/common/PasswordInput.jsx';
import Button from '../../../components/common/Button.jsx';
import { MailIcon, LockIcon, ArrowRightIcon } from './icons.jsx';

// Square inputs and an uppercase red button, matching the login page's
// full-screen video style. `!` overrides the rounded TailAdmin defaults.
const FIELD = '!rounded-none focus:!border-duro-500 focus:!ring-duro-500/10';

export default function LoginForm({
  email, setEmail, password, setPassword, rememberMe,
  setRememberMe, errorMessage, isSubmitting, onSubmit,
  idLabel, idPlaceholder,
}) {
  return (
    <form onSubmit={onSubmit} noValidate>
      <TextInput
        id="email"
        label={idLabel}
        type="text"
        variant="boxed"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        placeholder={idPlaceholder}
        icon={<MailIcon />}
        className={FIELD}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />

      <PasswordInput
        id="password"
        label="Password"
        variant="boxed"
        autoComplete="current-password"
        placeholder="Enter your password"
        icon={<LockIcon />}
        className={FIELD}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />

      {/* "Remember me" is a local UI preference only — it does not change
          session length or send anything extra to the backend, so it can't
          misrepresent what the app actually does with your session. */}
      <div className="mb-5 mt-1 flex items-center justify-between text-sm">
        <label htmlFor="rememberMe" className="flex items-center gap-2 text-gray-700">
          <input
            id="rememberMe"
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="h-4 w-4 cursor-pointer rounded border-gray-300 accent-duro-500"
          />
          Remember me
        </label>
        <a href="/forgot-password" className="font-medium text-duro-500 transition-colors hover:text-duro-700">
          Forgot Password?
        </a>
      </div>

      {errorMessage && (
        <div className="mb-4 rounded-xl border border-error-500 bg-error-50 p-4 text-sm text-gray-700" role="alert">
          {errorMessage}
        </div>
      )}

      <Button
        type="submit"
        isLoading={isSubmitting}
        className="h-12 w-full !rounded-none !bg-duro-500 text-xs uppercase tracking-[0.15em] hover:!bg-duro-700 focus:!ring-duro-500/20"
      >
        Sign In
        <ArrowRightIcon />
      </Button>
    </form>
  );
}
