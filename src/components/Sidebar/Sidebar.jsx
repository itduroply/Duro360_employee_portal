import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import duroplyLogo from '../../assets/duroply-logo.png';
import duroplyLogoBrown from '../../assets/duroply-logo-brown.png';
import { NAV_ICONS } from './navIcons.jsx';
import { theme } from '../../theme/themes.js';
import { SilkWaves } from '../Decor/Decor.jsx';

// Sidebar colours come from the sidebar-* tokens (see src/theme/themes.js):
// cream in the woodland theme, plain white in the TailAdmin theme. The
// woodland theme (`theme.decor`) also centres the logo with the product line
// under it, drops the "Menu" heading, and draws silk-like waves at the foot.

function ChevronIcon({ open }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={`h-4 w-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} aria-hidden="true">
      <path d="M5 7.5l5 5 5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// A menu item with a submenu, such as Complaints. It opens by itself while
// one of its pages is shown. Collapsed to icons, it links to its first page.
function NavGroup({ item, Icon, basePath, showText, onNavigate }) {
  const { pathname } = useLocation();
  const groupPath = `${basePath}/${item.path}`;
  const isInside = pathname === groupPath || pathname.startsWith(`${groupPath}/`);
  const [open, setOpen] = useState(isInside);
  const waiting = item.children.reduce((n, child) => n + (child.count || 0), 0);

  useEffect(() => {
    if (isInside) setOpen(true);
  }, [isInside]);

  const rowClass = `group relative flex w-full items-center rounded-lg px-3 transition-colors ${
    theme.decor ? 'gap-[18px] px-5 py-3 text-[14.5px]' : 'gap-3 py-2 text-theme-sm font-medium'
  } ${showText ? '' : 'lg:justify-center'} ${
    isInside ? `text-sidebar-active-text ${showText ? '' : `bg-sidebar-active ${theme.ui.sidebarNavActive}`}` : 'text-sidebar-text hover:bg-sidebar-hover hover:text-sidebar-hover-text'
  }`;
  const iconClass = isInside ? 'text-sidebar-active-text' : 'text-sidebar-icon group-hover:text-sidebar-hover-text';

  if (!showText) {
    return (
      <li>
        <NavLink to={`${basePath}/${item.children[0].path}`} onClick={onNavigate} title={item.label} className={rowClass}>
          {Icon && <span className={iconClass}><Icon /></span>}
          {waiting > 0 && <span className="absolute right-2 top-1.5 h-2 w-2 rounded-full bg-brand-500" aria-hidden="true" />}
        </NavLink>
      </li>
    );
  }

  return (
    <li>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className={rowClass}>
        {Icon && <span className={iconClass}><Icon /></span>}
        <span className={`flex-1 truncate text-left ${isInside ? 'font-semibold' : ''}`}>{item.label}</span>
        {!open && waiting > 0 && (
          <span className="rounded-full bg-brand-500 px-2 py-0.5 text-[11px] font-semibold leading-4 text-white">{waiting}</span>
        )}
        <ChevronIcon open={open} />
      </button>
      <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <ul className={`overflow-hidden ${theme.decor ? 'ml-[30px]' : 'ml-[22px]'} border-l border-sidebar-divider`}>
          {item.children.map((child, i) => (
            <li key={child.key} className={i === 0 ? 'pt-1' : ''}>
              <NavLink
                to={`${basePath}/${child.path}`}
                onClick={onNavigate}
                tabIndex={open ? undefined : -1}
                className={({ isActive }) =>
                  `relative -ml-px flex items-center gap-2 border-l-2 py-2 pl-4 pr-3 text-[13.5px] transition-colors ${
                    isActive
                      ? 'border-brand-500 font-semibold text-sidebar-active-text'
                      : 'border-transparent text-sidebar-text hover:border-sidebar-divider hover:text-sidebar-hover-text'
                  }`
                }
              >
                <span className="flex-1 truncate">{child.label}</span>
                {child.count > 0 && (
                  <span className="rounded-full bg-brand-500 px-2 py-0.5 text-[11px] font-semibold leading-4 text-white">{child.count}</span>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
    </li>
  );
}

export default function Sidebar({ consoleLabel, basePath, navItems: allNavItems, isCollapsed, isOpen, onClose }) {
  const showText = !isCollapsed || isOpen;
  // The woodland design lists only pages that are built (no "coming soon").
  const navItems = theme.decor ? allNavItems.filter((item) => item.implemented) : allNavItems;

  return (
    <>
      {/* Dark backdrop behind the sidebar on mobile. */}
      <div
        className={`fixed inset-0 z-40 bg-gray-900/50 lg:hidden ${isOpen ? 'block' : 'hidden'}`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        className={`fixed left-0 top-0 z-50 flex h-screen flex-col overflow-hidden border-r border-sidebar-border bg-sidebar bg-sidebar-texture bg-cover ${theme.decor ? 'px-3' : 'px-5'} transition-all duration-300 lg:sticky lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } ${showText ? 'w-[255px]' : 'w-[255px] lg:w-[90px]'}`}
      >
        <div className={`flex shrink-0 items-center gap-3 ${theme.decor ? 'pb-7 pt-6' : 'pb-7 pt-8'} ${showText ? '' : 'lg:justify-center'}`}>
          {showText && theme.decor ? (
            <div className="flex w-full flex-col items-center text-center">
              <img
                src={theme.sidebarLogoBrown ? duroplyLogoBrown : duroplyLogo}
                alt="DUROPLY"
                className={`h-[37px] w-auto ${theme.sidebarLogoWhite ? 'brightness-0 invert' : ''}`}
              />
            </div>
          ) : showText ? (
            <>
              <img src={duroplyLogo} alt="DUROPLY" className="h-6 w-auto shrink-0" />
              <span className="h-6 w-px bg-sidebar-divider" aria-hidden="true" />
              <span className="text-[11px] font-semibold uppercase leading-tight tracking-[0.12em] text-sidebar-muted">
                {consoleLabel}
              </span>
            </>
          ) : (
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-500 text-base font-bold text-white">
              D
            </span>
          )}
        </div>

        <nav className="no-scrollbar relative z-10 flex-1 overflow-y-auto">
          {!theme.decor && (
            <h3
              className={`mb-4 flex text-xs uppercase leading-5 text-sidebar-muted ${showText ? 'justify-start' : 'lg:justify-center'}`}
            >
              {showText ? 'Menu' : '•••'}
            </h3>
          )}
          <ul className={`mb-6 flex flex-col ${theme.decor ? 'gap-1.5' : 'gap-1'}`}>
            {navItems.map((item) => {
              const Icon = NAV_ICONS[item.key];
              if (item.children?.length) {
                return (
                  <NavGroup key={item.key} item={item} Icon={Icon} basePath={basePath} showText={showText} onNavigate={onClose} />
                );
              }
              return (
                <li key={item.key}>
                  <NavLink
                    to={item.path ? `${basePath}/${item.path}` : basePath}
                    state={item.state}
                    end={item.end}
                    onClick={onClose}
                    title={showText ? undefined : item.label}
                    className={({ isActive }) =>
                      `group relative flex items-center rounded-lg px-3 transition-colors ${
                        theme.decor ? 'gap-[18px] px-5 py-3 text-[14.5px]' : 'gap-3 py-2 text-theme-sm font-medium'
                      } ${
                        showText ? '' : 'lg:justify-center'
                      } ${
                        isActive && item.implemented
                          ? `bg-sidebar-active text-sidebar-active-text ${theme.ui.sidebarNavActive}`
                          : 'text-sidebar-text hover:bg-sidebar-hover hover:text-sidebar-hover-text'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {Icon && (
                          <span
                            className={
                              isActive && item.implemented
                                ? 'text-sidebar-active-text'
                                : 'text-sidebar-icon group-hover:text-sidebar-hover-text'
                            }
                          >
                            <Icon />
                          </span>
                        )}
                        {showText && <span className="flex-1 truncate">{item.label}</span>}
                        {showText && item.badge && (
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-medium uppercase text-success-600 ${
                              isActive ? 'bg-success-100' : 'bg-success-50 group-hover:bg-success-100'
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </>
                    )}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>

        {theme.decor && <SilkWaves className="absolute bottom-0 left-0 h-[340px] w-full [mask-image:linear-gradient(to_bottom,transparent,black_35%)]" />}
      </aside>
    </>
  );
}
