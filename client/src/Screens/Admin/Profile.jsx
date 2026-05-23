import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { User, Mail, Shield, Calendar, KeyRound, Save, Eye, EyeOff } from 'lucide-react';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Chip } from '@mui/material';
import api from '../../utils/api';
import { decryptData } from '../localStorageUtils';

const ROLE_COLOR = { admin: 'primary', control_room: 'default' };
const ROLE_LABEL = { admin: 'Administrator', control_room: 'Control Room' };

export default function Profile() {
  const local = decryptData();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [showPass, setShowPass] = useState({ current: false, new: false, confirm: false });
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdErrors, setPwdErrors] = useState({});

  useEffect(() => {
    api.get('/auth/profile')
      .then((r) => setProfile(r.data.data))
      .catch(() => {
        if (local?.user) setProfile(local.user);
      })
      .finally(() => setLoading(false));
  }, []);

  const toggleShow = (field) => setShowPass((p) => ({ ...p, [field]: !p[field] }));

  const validatePwd = () => {
    const errs = {};
    if (!passwordForm.currentPassword) errs.currentPassword = 'Required';
    if (passwordForm.newPassword.length < 8) errs.newPassword = 'Minimum 8 characters';
    if (passwordForm.newPassword !== passwordForm.confirmPassword) errs.confirmPassword = 'Passwords do not match';
    setPwdErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (!validatePwd()) return;
    try {
      setPwdLoading(true);
      await api.put('/auth/password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      toast.success('Password changed successfully.');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change password.');
    } finally {
      setPwdLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f7fb] flex items-center justify-center">
        <svg className="animate-spin h-8 w-8 text-[#2E3A8C]" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
      </div>
    );
  }

  const user = profile || local?.user || {};

  return (
    <div className="min-h-screen bg-[#f5f7fb] p-6">
      <ToastContainer position="top-right" autoClose={3000} />
      <div className="mx-auto w-full ">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">My Profile</h1>
          <p className="text-sm text-slate-500 mt-1">View your account details and manage your password</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">

          {/* Profile Card */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="lg:col-span-1 border border-slate-200 bg-white p-6 shadow-[0_4px_20px_rgba(15,23,42,0.05)] flex flex-col items-center text-center"
          >
            <div className="w-24 h-24 rounded-full bg-[#2E3A8C] flex items-center justify-center mb-4">
              <User size={40} className="text-white" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">{user.name || '—'}</h2>
            <p className="text-sm text-slate-500 mb-3">{user.email || '—'}</p>
            <Chip
              label={ROLE_LABEL[user.role] || user.role || 'User'}
              color={ROLE_COLOR[user.role] || 'default'}
              size="small"
              sx={{ fontWeight: 600 }}
            />

            <div className="mt-6 w-full space-y-3 text-left">
              <div className="flex items-center gap-3 text-sm text-slate-600 border-t border-slate-100 pt-4">
                <Mail size={16} className="text-slate-400 flex-shrink-0" />
                <span className="truncate">{user.email || '—'}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-600">
                <Shield size={16} className="text-slate-400 flex-shrink-0" />
                <span>{ROLE_LABEL[user.role] || user.role || '—'}</span>
              </div>
              {user.createdAt && (
                <div className="flex items-center gap-3 text-sm text-slate-600">
                  <Calendar size={16} className="text-slate-400 flex-shrink-0" />
                  <span>Joined {new Date(user.createdAt).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          </motion.div>

          {/* Right Column */}
          <div className="lg:col-span-2 space-y-6">

            {/* Account Info */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="border border-slate-200 bg-white p-6 shadow-[0_4px_20px_rgba(15,23,42,0.05)]"
            >
              <h3 className="text-lg font-semibold text-slate-900 mb-5">Account Information</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  { label: 'Full Name', value: user.name, icon: <User size={15} /> },
                  { label: 'Email Address', value: user.email, icon: <Mail size={15} /> },
                  { label: 'Role', value: ROLE_LABEL[user.role] || user.role, icon: <Shield size={15} /> },
                  { label: 'Account ID', value: user._id || user.id, icon: <KeyRound size={15} /> },
                ].map(({ label, value, icon }) => (
                  <div key={label} className="border border-slate-100 bg-slate-50 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold uppercase tracking-wide mb-1">
                      {icon} {label}
                    </div>
                    <p className="text-sm font-medium text-slate-800 truncate">{value || '—'}</p>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Change Password */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="border border-slate-200 bg-white p-6 shadow-[0_4px_20px_rgba(15,23,42,0.05)]"
            >
              <h3 className="text-lg font-semibold text-slate-900 mb-5">Change Password</h3>
              <form onSubmit={handlePasswordChange} className="space-y-4">
                {[
                  { label: 'Current Password', field: 'currentPassword', showKey: 'current' },
                  { label: 'New Password', field: 'newPassword', showKey: 'new' },
                  { label: 'Confirm New Password', field: 'confirmPassword', showKey: 'confirm' },
                ].map(({ label, field, showKey }) => (
                  <div key={field}>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
                    <div className="relative">
                      <input
                        type={showPass[showKey] ? 'text' : 'password'}
                        value={passwordForm[field]}
                        onChange={(e) => setPasswordForm((p) => ({ ...p, [field]: e.target.value }))}
                        placeholder="••••••••"
                        className={`w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E3A8C] pr-10 transition ${pwdErrors[field] ? 'border-red-400' : 'border-slate-300'}`}
                      />
                      <button
                        type="button"
                        onClick={() => toggleShow(showKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showPass[showKey] ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {pwdErrors[field] && <p className="text-xs text-red-500 mt-1">{pwdErrors[field]}</p>}
                  </div>
                ))}

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={pwdLoading}
                    className="flex items-center gap-2 bg-[#2E3A8C] text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#4F68A4] transition disabled:opacity-60"
                  >
                    <Save size={14} />
                    {pwdLoading ? 'Saving...' : 'Update Password'}
                  </button>
                </div>
              </form>
            </motion.div>

          </div>
        </div>
      </div>
    </div>
  );
}
