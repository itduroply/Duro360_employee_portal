// TailAdmin light badge: small rounded pill, pale fill, strong text.
const COLORS = {
  success: 'bg-success-50 text-success-600',
  error: 'bg-error-50 text-error-600',
  warning: 'bg-warning-50 text-warning-600',
  info: 'bg-blue-light-50 text-blue-light-500',
  primary: 'bg-brand-50 text-brand-500',
  light: 'bg-gray-100 text-gray-700',
};

export default function Badge({ color = 'light', children, className = '' }) {
  return (
    <span
      className={`inline-flex items-center justify-center gap-1 rounded-full px-2.5 py-0.5 text-theme-xs font-medium ${COLORS[color]} ${className}`}
    >
      {children}
    </span>
  );
}
