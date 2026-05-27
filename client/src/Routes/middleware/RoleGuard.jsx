import React from 'react';
import { Navigate } from 'react-router-dom';
import { decryptData } from '../../Screens/localStorageUtils';

/**
 * Returns the default landing route for a given role.
 * - admin       → /admin/dashboard
 * - control_room → /admin/report  (Live Monitoring)
 */
export const getDefaultRoute = (role) => {
  if (role === 'control_room') return '/admin/report';
  return '/admin/dashboard';
};

/**
 * RoleGuard — wraps a protected route.
 *
 * Props:
 *   roles  {string[] | null}  Allowed roles. Pass null to skip role check (any
 *                              authenticated user can access).
 *   children                  The route element to render.
 *
 * Behaviour:
 *   - If `roles` is null/empty → render children (no role restriction).
 *   - If user's role is in `roles`  → render children.
 *   - Otherwise → redirect to the user's default route.
 */
const RoleGuard = ({ children, roles }) => {
  const userData = decryptData();
  const role = userData?.user?.role;

  // No role restriction — allow all authenticated users through
  if (!roles || roles.length === 0) {
    return <React.Fragment>{children}</React.Fragment>;
  }

  if (roles.includes(role)) {
    return <React.Fragment>{children}</React.Fragment>;
  }

  // User doesn't have permission — send them to their own home screen
  return <Navigate to={getDefaultRoute(role)} replace />;
};

export default RoleGuard;
