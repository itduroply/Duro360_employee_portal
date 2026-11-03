import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { employeeLoginEmailFor } from '../utils/dealerLogin';

const AuthContext = createContext(null);

// Builds the shape the rest of the app expects (ProtectedRoute checks
// user.roles, Login.jsx checks user.roles.includes('ADMIN')) out of a
// Supabase auth user plus its matching public.profiles row.
async function loadUser(authUser) {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('name, role, status, dealer_code, vendor_id, permissions, email, mobile_number, employee_id')
    .eq('id', authUser.id)
    .single();

  if (error || !profile) {
    throw new Error('No profile found for this account. Contact the administrator.');
  }
  if (profile.status !== 'ACTIVE') {
    await supabase.auth.signOut();
    throw new Error('Your account is inactive. Please contact the administrator.');
  }

  return {
    id: authUser.id,
    email: authUser.email,
    name: profile.name,
    roles: [profile.role],
    // Link to this Dealer's row in dealer_directory (null for non-Dealers).
    dealerCode: profile.dealer_code,
    vendorId: profile.vendor_id,
    // Only meaningful for ADMIN (which Admin Console features a SUPERADMIN
    // has granted it -- see components/Sidebar/sidebarConfig.js and layouts/AdminLayout.jsx).
    permissions: profile.permissions || [],
    // Shown in the profile card of the user menu.
    profileEmail: profile.email,
    mobile: profile.mobile_number,
    employeeId: profile.employee_id,
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true); // true while we check for an existing session

  // On first load, resume whatever session Supabase already has in local
  // storage (it manages its own persistence/refresh -- unlike the old
  // backend flow, there is no separate httpOnly-cookie dance to redo here).
  useEffect(() => {
    async function tryResume() {
      const { data } = await supabase.auth.getSession();
      const authUser = data.session?.user;
      if (!authUser) {
        setIsLoading(false);
        return;
      }
      try {
        setUser(await loadUser(authUser));
      } catch (err) {
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    }
    tryResume();

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        setUser(null);
      }
    });
    return () => subscription.subscription.unsubscribe();
  }, []);

  // Signs in one Supabase Auth email and loads the profile.
  const signIn = useCallback(async (email, password, wrongCredentialsMessage) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data?.user) {
      console.error('[auth] signInWithPassword failed:', {
        email,
        name: error?.name,
        status: error?.status,
        code: error?.code,
        message: error?.message,
      });
      // A network failure (status 0 / retryable fetch error) is not a wrong
      // password -- say so instead of blaming the credentials.
      if (error && (error.name === 'AuthRetryableFetchError' || error.status === 0)) {
        throw new Error(`Cannot reach the server (${error.message}). Check your internet, VPN or firewall.`);
      }
      throw new Error(wrongCredentialsMessage);
    }
    return loadUser(data.user);
  }, []);

  // Employee login page (/login): an email (Admins) or an Employee ID.
  // Dealer accounts are refused here; Dealers use the dealer-frontend app.
  const loginEmployee = useCallback(async (identifier, password) => {
    let loginEmail = employeeLoginEmailFor(identifier);
    // A work email may belong to an Employee whose login is their Employee ID
    // (see supabase/migrations/20261029120000_login_email_for.sql). Ask which
    // login it maps to; if that lookup is unavailable, use the email as typed.
    if (String(identifier).includes('@')) {
      const { data: mapped } = await supabase.rpc('login_email_for', { identifier: String(identifier).trim() });
      if (mapped) loginEmail = mapped;
    }
    const loggedInUser = await signIn(
      loginEmail,
      password,
      'Invalid Employee ID / email or password.'
    );
    if (loggedInUser.roles.includes('DEALER')) {
      await supabase.auth.signOut();
      throw new Error('Invalid Employee ID / email or password.');
    }
    setUser(loggedInUser);
    return loggedInUser;
  }, [signIn]);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, loginEmployee, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
