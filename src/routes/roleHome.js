// Where a signed-in user's role belongs, shared by ProtectedRoute (bouncing
// a wrong-role user off a page it can't see) and AppRoutes ("/" and any
// unmatched path) so the two can't drift into disagreeing about it.
export function roleHome(roles = []) {
  if (roles.includes('SUPERADMIN')) return '/superadmin';
  if (roles.includes('ADMIN')) return '/admin';
  return '/dashboard';
}

