import { LABEL, INPUT, INPUT_OK, INPUT_ERROR } from '../../components/common/formStyles.js';
import Select from '../../components/common/Select.jsx';
import { CITIES } from '../../utils/expensePolicy.js';

export const BOX = 'rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xs sm:p-6';

export function Field({ label, error, hint, children, className = '' }) {
  return (
    <div className={className}>
      {label && <span className={LABEL}>{label}</span>}
      {children}
      {hint && !error && <p className="mt-1.5 text-theme-xs text-gray-500">{hint}</p>}
      {error && <p className="mt-1.5 text-theme-xs text-error-500">{error}</p>}
    </div>
  );
}

export function Input({ invalid, className = '', ...props }) {
  return <input className={`${INPUT} ${invalid ? INPUT_ERROR : INPUT_OK} ${className}`} {...props} />;
}

export function TextArea({ className = '', ...props }) {
  return <textarea className={`w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10 ${className}`} rows={3} {...props} />;
}

export function CitySelect({ value, onChange, ...props }) {
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)} {...props}>
      <option value="">Select city</option>
      {CITIES.map((c) => (
        <option key={c.name} value={c.name}>{c.name} (cat. {c.cat})</option>
      ))}
    </Select>
  );
}

export const ISSUE_TONE = {
  block: 'border-error-200 bg-error-50 text-error-700',
  exception: 'border-warning-200 bg-warning-50 text-warning-700',
  variance: 'border-warning-200 bg-warning-50 text-warning-700',
  flag: 'border-blue-light-200 bg-blue-light-50 text-blue-light-700',
};
export const ISSUE_LABEL = { block: 'Blocked', exception: 'Exception', variance: 'Variance', flag: 'Flag' };
export const RESULT_TONE = {
  'Within policy': 'bg-success-50 text-success-700',
  Variance: 'bg-warning-50 text-warning-700',
  Exception: 'bg-warning-50 text-warning-700',
  Blocked: 'bg-error-50 text-error-700',
};

export function ResultPill({ result }) {
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-theme-xs font-medium ${RESULT_TONE[result] || 'bg-gray-100 text-gray-600'}`}>{result}</span>;
}

export function IssueList({ issues }) {
  if (!issues.length) return null;
  return (
    <ul className="flex flex-col gap-2">
      {issues.map((issue, i) => (
        <li key={i} className={`rounded-lg border px-3 py-2 text-theme-sm ${ISSUE_TONE[issue.level]}`}>
          <span className="font-semibold">{ISSUE_LABEL[issue.level]}</span> · {issue.msg} <span className="opacity-60">({issue.rule})</span>
        </li>
      ))}
    </ul>
  );
}

// The route as a short step list, with the current step marked.
export function RouteSteps({ route, stage = 0, done = false }) {
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-theme-xs">
      {route.map((step, i) => {
        const state = done || i < stage ? 'done' : i === stage ? 'now' : 'next';
        return (
          <li key={step} className="flex items-center gap-2">
            <span className={`rounded-full px-2.5 py-1 font-medium ${state === 'done' ? 'bg-success-50 text-success-700' : state === 'now' ? 'bg-brand-50 text-brand-600' : 'bg-gray-100 text-gray-500'}`}>
              {i + 1}. {step}
            </span>
            {i < route.length - 1 && <span className="text-gray-300" aria-hidden="true">›</span>}
          </li>
        );
      })}
    </ol>
  );
}

export const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
