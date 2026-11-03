// Dealers sign in with their Dealer Code (e.g. C30001), not an email.
// Supabase Auth still needs an email per login, so each Dealer's login uses
// a fixed internal address built from the code. The Dealer never sees it.
// Keep DEALER_LOGIN_DOMAIN in sync with the same constant in
// supabase/functions/manage-users/index.ts (see also
// supabase/migrations/20260924120000_add_dealer_code_login.sql).
export const DEALER_LOGIN_DOMAIN = 'dealers.duroply.local';

export function normalizeDealerCode(code) {
  return String(code || '').trim().toUpperCase();
}

export function dealerLoginEmail(code) {
  return `${normalizeDealerCode(code).toLowerCase()}@${DEALER_LOGIN_DOMAIN}`;
}

// Employees sign in with their Employee ID the same way (E1024 ->
// e1024@employees.duroply.local). Keep EMPLOYEE_LOGIN_DOMAIN in sync with
// supabase/functions/manage-users/index.ts (see also
// supabase/migrations/20260928120000_add_employee_login.sql).
export const EMPLOYEE_LOGIN_DOMAIN = 'employees.duroply.local';

export function employeeLoginEmail(id) {
  return `${normalizeDealerCode(id).toLowerCase()}@${EMPLOYEE_LOGIN_DOMAIN}`;
}

// What the Employee login page's field accepts: an email (Admins) or an
// Employee ID. The Dealer login page uses dealerLoginEmail() directly.
export function employeeLoginEmailFor(identifier) {
  const value = String(identifier || '').trim();
  if (value.includes('@')) return value.toLowerCase();
  return employeeLoginEmail(value);
}

export function isDealerLoginEmail(email) {
  return String(email || '').toLowerCase().endsWith(`@${DEALER_LOGIN_DOMAIN}`);
}
