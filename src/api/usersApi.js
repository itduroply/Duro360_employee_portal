import { supabase } from '../lib/supabaseClient';

// Thin wrapper around the manage-users Edge Function (see
// supabase/functions/manage-users/index.ts for why this can't just be a
// direct `supabase.from('profiles')` call from here: RLS only lets a
// browser session read/write its own row, so creating other people's
// logins and listing them has to go through server-side code holding the
// service role key instead). supabase.functions.invoke automatically sends
// the caller's current session as the Authorization header, which is what
// that function checks the SUPERADMIN role against.
async function invoke(action, payload = {}) {
  const { data, error } = await supabase.functions.invoke('manage-users', { body: { action, payload } });
  if (error) {
    let message = error.message;
    const status = error.context?.status;
    try {
      const body = await error.context.json();
      if (body?.message || body?.error) message = body.message || body.error;
    } catch {
      // Response body wasn't JSON (or there was no context) -- fall back to
      // the generic error.message above.
    }
    // No HTTP status means the browser never got an answer: the function is
    // not deployed, timed out, or was blocked (CORS / network).
    if (!status) message = `Could not reach the manage-users function (${error.message}). Check that it is deployed, then try again.`;
    else if (status === 546 || status === 504 || status === 502) message = `The request took too long (HTTP ${status}). Try again with fewer dealers.`;
    console.error(`[manage-users:${action}]`, status ?? 'no response', error);
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

export const usersApi = {
  listAdmins: () => invoke('list_users', { role: 'ADMIN', employees: false }),
  listEmployees: () => invoke('list_users', { role: 'ADMIN', employees: true }),
  listDealers: () => invoke('list_users', { role: 'DEALER' }),
  listBranches: () => invoke('list_branches'),
  // The signed-in Admin's dashboard figures, only for the features they hold.
  adminDashboard: () => invoke('admin_dashboard'),
  // Dashboard money figures for all dealers, in rupees.
  dealerMoneySummary: () => invoke('dealer_money_summary'),
  createAdmin: (payload) => invoke('create_admin', payload),
  createDealer: (payload) => invoke('create_dealer', payload),
  bulkCreateDealers: (dealers) => invoke('bulk_create_dealers', { dealers }),
  bulkCreateEmployees: (employees) => invoke('bulk_create_employees', { employees }),
  setPassword: (userId, password) => invoke('set_password', { userId, password }),
  updatePermissions: (userId, permissions) => invoke('update_permissions', { userId, permissions }),
  updateStatus: (userId, status) => invoke('update_status', { userId, status }),
  updateUser: (payload) => invoke('update_user', payload),
  deleteUser: (userId) => invoke('delete_user', { userId }),
  listDealerDirectory: () => invoke('list_dealer_directory'),
};
