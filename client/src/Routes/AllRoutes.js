import React from 'react';
import { Navigate } from 'react-router-dom';

import Dashboard from '../Screens/Admin/Dashboard';
import Master from '../Screens/Admin/Master';
import Report from '../Screens/Admin/Report';
import TankList from '../Screens/Admin/TankList';
import TankDetail from '../Screens/Admin/TankDetail';
import DailyReport from '../Screens/Admin/DailyReport';
import WeeklyReport from '../Screens/Admin/WeeklyReport';
import MonthlyReport from '../Screens/Admin/MonthlyReport';
import Profile from '../Screens/Admin/Profile';
import UserManagement from '../Screens/Admin/UserManagement';

import Login from '../Screens/Auth/Login';
import SignUp from '../Screens/Auth/SignUp';

const userRoutes = [
  // Default redirect
  { path: '/admin/', exact: true, component: <Navigate to="/admin/dashboard" /> },

  // Dashboard
  { path: '/admin/dashboard', component: <Dashboard /> },

  // Tank Management
  { path: '/admin/tanks', component: <TankList /> },
  { path: '/admin/tanks/:id', component: <TankDetail /> },

  // Live Monitor (old Report screen)
  { path: '/admin/report', component: <Report /> },

  // Reports
  { path: '/admin/reports/daily', component: <DailyReport /> },
  { path: '/admin/reports/weekly', component: <WeeklyReport /> },
  { path: '/admin/reports/monthly', component: <MonthlyReport /> },

  // Master Data (IoT raw table)
  { path: '/admin/data', component: <Master /> },

  // Users (admin only — access enforced inside the component)
  { path: '/admin/users', component: <UserManagement /> },

  // Profile
  { path: '/admin/profile', component: <Profile /> },
];

const authRoutes = [
  { path: '/', component: <Login /> },
  { path: '/sign-up', component: <SignUp /> },
];

export { userRoutes, authRoutes };
