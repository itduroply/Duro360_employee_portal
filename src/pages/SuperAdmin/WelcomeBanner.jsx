import { Link } from 'react-router-dom';
import { theme } from '../../theme/themes.js';
import { ArrowRightIcon, PlusIcon } from './dashboardIcons.jsx';

function greetingFor(hour) {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/**
 * Top of the Super Admin dashboard: today's date, a greeting and the two
 * most-used actions on a soft pink band with a red swoosh on the right.
 */
export default function WelcomeBanner({ name, subtitle = 'Manage logins, schemes and dealers for the whole portal from here.', actions }) {
  const now = new Date();
  const today = now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <section className="relative animate-fade-in-up overflow-hidden rounded-3xl bg-gradient-to-r from-white via-[#fef3f3] to-[#fde4e3] shadow-theme-sm">
      {theme.decor && (
        <svg
          viewBox="0 0 930 205"
          preserveAspectRatio="xMaxYMid slice"
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 hidden h-full w-full md:block"
        >
          <defs>
            <linearGradient id="banner-pale" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#fbd0cf" stopOpacity="0" />
              <stop offset="1" stopColor="#f7b4b1" stopOpacity="0.95" />
            </linearGradient>
            <linearGradient id="banner-pale-soft" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#fde4e3" stopOpacity="0" />
              <stop offset="1" stopColor="#fbd0cf" stopOpacity="0.7" />
            </linearGradient>
            <linearGradient id="banner-red" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#ea5b57" />
              <stop offset="1" stopColor="#c81e1e" />
            </linearGradient>
          </defs>
          {/* A wide soft sweep, then a deeper one on top of it. */}
          <path d="M560 205 C690 196 760 120 735 0 H930 V205 Z" fill="url(#banner-pale-soft)" />
          <path d="M700 205 C815 192 850 96 810 0 H930 V205 Z" fill="url(#banner-pale)" />
          {/* Red corner, top right, and a smaller one at the foot. */}
          <path d="M770 0 H930 V104 C850 98 790 56 770 0 Z" fill="url(#banner-red)" />
          <path d="M930 138 V205 H842 C892 192 918 168 930 138 Z" fill="url(#banner-red)" />
        </svg>
      )}

      <div className="relative flex flex-wrap items-end gap-x-14 gap-y-6 px-6 py-8 sm:px-10">
        <div>
          <p className="text-theme-xs font-medium uppercase tracking-[0.16em] text-gray-600">{today}</p>
          <h2 className="mt-2.5 text-[28px] font-semibold leading-tight text-gray-900 sm:text-[34px]">
            {greetingFor(now.getHours())}, {name}
          </h2>
          <p className="mt-2 max-w-xl text-base text-gray-600">{subtitle}</p>

          {actions === undefined ? (
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/superadmin/schemes"
              state={{ openCreate: true }}
              className="inline-flex items-center gap-2.5 rounded-lg bg-gradient-to-b from-brand-500 to-brand-600 px-6 py-3 text-theme-sm font-semibold text-white shadow-theme-md transition-transform duration-200 hover:-translate-y-0.5"
            >
              <PlusIcon />
              Create Scheme
            </Link>
            <Link
              to="/superadmin/users"
              className="inline-flex items-center gap-2.5 rounded-lg border border-brand-300 bg-white/60 px-6 py-3 text-theme-sm font-semibold text-brand-600 transition-colors hover:bg-white"
            >
              Manage Admins
              <ArrowRightIcon />
            </Link>
          </div>
          ) : (
            actions
          )}
        </div>

        {theme.decor && (
          <div className="mb-2 hidden xl:block">
            <p className="text-lg leading-snug text-gray-700">
              Better Boards.
              <br />
              Brighter Spaces.
            </p>
            <span className="mt-3 block h-0.5 w-9 bg-brand-400" aria-hidden="true" />
          </div>
        )}
      </div>
    </section>
  );
}
