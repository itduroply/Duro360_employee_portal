import { Fragment } from 'react';
import { ShieldIcon } from './icons.jsx';

const FOOTER_ITEMS = ['Secure Login', 'Protected Data', 'Your Privacy Matters'];

/**
 * Full-width trust footer — the card's own bottom edge, spanning both
 * columns, with light-gray vertical dividers between each item matching the
 * reference design.
 */
export default function LoginFooter() {
  return (
    <div className="w-full border-t border-slate-200 bg-white px-6 py-3">
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-medium text-slate-500">
        {FOOTER_ITEMS.map((label, i) => (
          <Fragment key={label}>
            {i > 0 && <span className="hidden h-3 w-px bg-slate-300 sm:block" aria-hidden="true" />}
            <span className="flex items-center gap-1.5">
              <ShieldIcon /> {label}
            </span>
          </Fragment>
        ))}
      </div>
    </div>
  );
}
