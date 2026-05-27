import React from 'react';
import { Navigate } from 'react-router-dom';
import { decryptData } from '../Screens/localStorageUtils';

import Dashboard    from '../Screens/Admin/Dashboard';
import Master       from '../Screens/Admin/Master';
import Report       from '../Screens/Admin/Report';
import TankList     from '../Screens/Admin/TankList';
import TankDetail   from '../Screens/Admin/TankDetail';
import DailyReport  from '../Screens/Admin/DailyReport';
import WeeklyReport from '../Screens/Admin/WeeklyReport';
import MonthlyReport from '../Screens/Admin/MonthlyReport';
import Profile      from '../Screens/Admin/Profile';
import UserManagement from '../Screens/Admin/UserManagement';

import Login  from '../Screens/Auth/Login';
import SignUp from '../Screens/Auth/SignUp';

/**
 * Smart default redirect — sends each role to its own home screen
 * without an intermediate redirect.
 */
const DefaultRedirect = () => {
  const userData = decryptData();
  const role = userData?.user?.role;
  const to = role === 'control_room' ? '/admin/report' : '/admin/dashboard';
  return <Navigate to={to} replace />;
};

/**
 * userRoutes
 * Each entry has an optional `roles` array.
 *   null  → any authenticated user
 *   ['admin']                → admin only
 *   ['admin','control_room'] → both roles
 */
const userRoutes = [
  // ── Default redirect (role-aware) ──────────────────────────────────
  { path: '/admin/',  exact: true, component: <DefaultRedirect />, roles: null },

  // ── Admin-only screens ─────────────────────────────────────────────
  { path: '/admin/dashboard', component: <Dashboard />,       roles: ['admin'] },
  { path: '/admin/tanks',     component: <TankList />,        roles: ['admin'] },

  // ── Tank detail: both roles (control_room needs it for live monitor) ─
  { path: '/admin/tanks/:id', component: <TankDetail />,      roles: ['admin', 'control_room'] },

  // ── Live Monitoring: both roles (control_room's primary screen) ────
  { path: '/admin/report',    component: <Report />,          roles: ['admin', 'control_room'] },

  // ── Reports: both roles ────────────────────────────────────────────
  { path: '/admin/reports/daily',   component: <DailyReport />,   roles: ['admin', 'control_room'] },
  { path: '/admin/reports/weekly',  component: <WeeklyReport />,  roles: ['admin', 'control_room'] },
  { path: '/admin/reports/monthly', component: <MonthlyReport />, roles: ['admin', 'control_room'] },

  // ── Admin-only (data table + user management) ──────────────────────
  { path: '/admin/data',  component: <Master />,         roles: ['admin'] },
  { path: '/admin/users', component: <UserManagement />, roles: ['admin'] },

  // ── Profile: both roles ────────────────────────────────────────────
  { path: '/admin/profile', component: <Profile />, roles: ['admin', 'control_room'] },
];

const authRoutes = [
  { path: '/',        component: <Login /> },
  { path: '/sign-up', component: <SignUp /> },
];

export { userRoutes, authRoutes };
