import { AdminIcon, StoreIcon, PackageIcon, BanIcon } from './icons.jsx';

// Demo accounts seeded by backend/src/seeders/20260101000010-demo-data.js and
// 20260101000011-simulator-demo-data.js — all share the same seeded password.
// This whole component only ever renders in a Vite dev build (see the
// import.meta.env.DEV check in Login.jsx — a build-time constant that's
// statically false in `vite build`, so this is dead-code-eliminated from
// anything actually deployed, the same "off in production" principle
// already used for the Simulator's ENABLE_SIMULATOR flag). This is new —
// the previous Login page had no demo-account affordance at all.
const DEV_DEMO_ACCOUNTS = [
  { label: 'Admin', email: 'admin.demo@duroply.com', Icon: AdminIcon, tint: 'bg-brand-100 text-brand-700' },
  { label: 'ABC Plywoods (Dealer)', email: 'dealer1@demo.com', Icon: StoreIcon, tint: 'bg-green-100 text-green-700' },
  { label: 'Sharma Enterprises', email: 'dealer2@demo.com', Icon: StoreIcon, tint: 'bg-red-100 text-red-700' },
  { label: 'XYZ Agencies', email: 'dealer3@demo.com', Icon: StoreIcon, tint: 'bg-teal-100 text-teal-700' },
  { label: 'ABC Supplies (Vendor)', email: 'vendor1@demo.com', Icon: PackageIcon, tint: 'bg-brand-100 text-brand-700' },
  { label: 'XYZ Services', email: 'vendor2@demo.com', Icon: PackageIcon, tint: 'bg-teal-100 text-teal-700' },
  { label: 'Inactive Dealer (error demo)', email: 'dealer.inactive.demo@duroply.com', Icon: BanIcon, tint: 'bg-slate-200 text-slate-600' },
];
export const DEV_DEMO_PASSWORD = 'Demo@12345';

/**
 * "Quick Login (Preview Only)" pill row — fills the email/password fields
 * with a seeded demo account so a developer/tester doesn't have to type
 * credentials by hand. Never rendered in production (see Login.jsx).
 */
export default function QuickLoginPills({ onSelect }) {
  return (
    <div className="mt-7">
      <div className="flex items-center gap-3 text-xs text-slate-400">
        <span className="h-px flex-1 bg-slate-200" />
        OR
        <span className="h-px flex-1 bg-slate-200" />
      </div>
      <p className="mb-3 mt-4 text-center text-xs font-semibold uppercase tracking-wide text-slate-400">
        Quick Login (Preview Only)
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {DEV_DEMO_ACCOUNTS.map((acc) => (
          <button
            key={acc.email}
            type="button"
            onClick={() => onSelect(acc.email)}
            className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-3 text-xs font-medium text-slate-600 transition-colors hover:border-brand-300 hover:text-brand-700"
          >
            <span className={`flex h-5 w-5 items-center justify-center rounded-full ${acc.tint}`}>
              <acc.Icon />
            </span>
            {acc.label}
          </button>
        ))}
      </div>
    </div>
  );
}
