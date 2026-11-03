// TailAdmin card: white, rounded-2xl, gray-200 border, no heavy shadow.
// Pass `title` (and optional `description` / `actions`) to get the standard
// card header; leave it out for a plain padded box.
export default function Card({ title, description, actions, children, className = '', bodyClassName = 'p-5 sm:p-6' }) {
  return (
    <div className={`rounded-2xl border border-gray-200 bg-white ${className}`}>
      {(title || actions) && (
        <div className="flex flex-col gap-3 px-5 pt-5 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:pt-6">
          <div>
            {title && <h3 className="text-lg font-semibold text-gray-800">{title}</h3>}
            {description && <p className="mt-1 text-theme-sm text-gray-500">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </div>
  );
}
