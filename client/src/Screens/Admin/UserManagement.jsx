import React, { useState, useMemo, useCallback, useEffect } from 'react';
import DataTable from 'react-data-table-component';
import Swal from 'sweetalert2';
import { motion } from 'framer-motion';
import { FaEdit, FaTrash, FaPlus, FaFileCsv, FaFileExcel } from 'react-icons/fa';
import { FiSearch } from 'react-icons/fi';
import { User, Mail, KeyRound } from 'lucide-react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Chip } from '@mui/material';
import api from '../../utils/api';

const ROLE_CHIP = { admin: 'primary', control_room: 'default' };
const ROLE_LABEL = { admin: 'Admin', control_room: 'Control Room' };

const emptyForm = { name: '', email: '', password: '', role: 'control_room' };

function UserManagement() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [selectedRows, setSelectedRows] = useState([]);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/auth/users');
      setUsers(res.data.data || []);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const filteredUsers = useMemo(() => {
    if (!search) return users;
    const q = search.toLowerCase();
    return users.filter(
      (u) => u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || u.role?.toLowerCase().includes(q)
    );
  }, [users, search]);

  const validateForm = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Name is required';
    if (!form.email.trim() || !/\S+@\S+\.\S+/.test(form.email)) errs.email = 'Valid email required';
    if (!editingUser && form.password.length < 8) errs.password = 'Minimum 8 characters';
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const openAddModal = () => {
    setEditingUser(null);
    setForm(emptyForm);
    setFormErrors({});
    setShowModal(true);
  };

  const openEditModal = (user) => {
    setEditingUser(user);
    setForm({ name: user.name, email: user.email, password: '', role: user.role });
    setFormErrors({});
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    try {
      setSubmitting(true);
      if (editingUser) {
        const payload = { name: form.name, role: form.role };
        if (form.password) payload.password = form.password;
        await api.put(`/auth/users/${editingUser._id}`, payload);
        toast.success('User updated successfully.');
      } else {
        await api.post('/auth/register', form);
        toast.success('User created successfully.');
      }
      setShowModal(false);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Operation failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = useCallback(async (row) => {
    const result = await Swal.fire({
      title: 'Delete User?',
      text: `"${row.name}" (${row.email}) will be removed.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete',
      buttonsStyling: false,
      customClass: {
        confirmButton: 'bg-red-500 hover:bg-red-600 text-white font-semibold px-5 py-2 rounded-lg mx-2',
        cancelButton: 'bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold px-5 py-2 rounded-lg mx-2',
      },
    });
    if (!result.isConfirmed) return;
    try {
      await api.delete(`/auth/users/${row._id}`);
      toast.success('User deleted.');
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed.');
    }
  }, [fetchUsers]);

  const getExportData = () => (selectedRows.length ? selectedRows : filteredUsers);

  const downloadCSV = () => {
    const rows = getExportData();
    const csv = [
      ['Name', 'Email', 'Role', 'Joined'].join(','),
      ...rows.map((r) => [r.name, r.email, r.role, new Date(r.createdAt).toLocaleDateString()].join(',')),
    ].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'users.csv'; a.click();
  };

  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(
      getExportData().map((r) => ({ Name: r.name, Email: r.email, Role: r.role, Joined: new Date(r.createdAt).toLocaleDateString() }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Users');
    saveAs(new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })], { type: 'application/octet-stream' }), `users-${Date.now()}.xlsx`);
  };

  const columns = useMemo(() => [
    {
      name: 'Name',
      selector: (r) => r.name,
      sortable: true,
      cell: (r) => (
        <div className="flex items-center gap-2 py-1">
          <div className="w-8 h-8 rounded-full bg-[#2E3A8C] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {r.name?.charAt(0).toUpperCase()}
          </div>
          <span className="font-semibold text-slate-800">{r.name}</span>
        </div>
      ),
    },
    {
      name: 'Email',
      selector: (r) => r.email,
      sortable: true,
      cell: (r) => (
        <span className="flex items-center gap-1 text-slate-600 text-sm">
          <Mail size={12} className="text-slate-400" /> {r.email}
        </span>
      ),
    },
    {
      name: 'Role',
      selector: (r) => r.role,
      sortable: true,
      cell: (r) => (
        <Chip
          label={ROLE_LABEL[r.role] || r.role}
          color={ROLE_CHIP[r.role] || 'default'}
          size="small"
          sx={{ fontWeight: 600, fontSize: 11 }}
        />
      ),
    },
    {
      name: 'Joined',
      selector: (r) => r.createdAt,
      sortable: true,
      cell: (r) => <span className="text-xs text-slate-500">{new Date(r.createdAt).toLocaleDateString()}</span>,
    },
    {
      name: 'Actions',
      cell: (r) => (
        <div className="flex gap-2">
          <motion.button whileHover={{ scale: 1.15 }} onClick={() => openEditModal(r)} className="text-amber-500" title="Edit">
            <FaEdit size={14} />
          </motion.button>
          <motion.button whileHover={{ scale: 1.15 }} onClick={() => handleDelete(r)} className="text-red-500" title="Delete">
            <FaTrash size={14} />
          </motion.button>
        </div>
      ),
      ignoreRowClick: true,
    },
  ], [handleDelete]);

  return (
    <div className="min-h-screen bg-[#f5f7fb]">
      <ToastContainer position="top-right" autoClose={3000} />

      {/* Header */}
      <div className="sticky top-0 md:top-24 z-10 backdrop-blur-xl bg-white/80 border-b border-gray-200 shadow-sm">
        <div className="w-full mx-auto px-4 py-3 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900">User Management</h1>
            <p className="text-xs text-slate-500">{users.length} registered users</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center bg-white px-3 py-2 rounded-lg shadow border border-slate-200 w-full sm:w-64">
              <FiSearch className="text-gray-400 mr-2" />
              <input
                type="text"
                placeholder="Search users..."
                className="outline-none w-full text-sm text-slate-700"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <motion.button whileHover={{ scale: 1.03 }} onClick={downloadCSV} className="flex items-center gap-1.5 bg-blue-50 text-blue-600 px-3 py-2 rounded-lg text-xs border border-blue-200">
              <FaFileCsv size={13} /> CSV
            </motion.button>
            <motion.button whileHover={{ scale: 1.03 }} onClick={exportExcel} className="flex items-center gap-1.5 bg-emerald-50 text-emerald-600 px-3 py-2 rounded-lg text-xs border border-emerald-200">
              <FaFileExcel size={13} /> Excel
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.03 }}
              onClick={openAddModal}
              className="flex items-center gap-1.5 bg-[#2E3A8C] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#4F68A4] transition"
            >
              <FaPlus size={12} /> Add User
            </motion.button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="w-full mx-auto mt-6">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-xl shadow-md overflow-x-auto">
          <DataTable
            columns={columns}
            data={filteredUsers}
            progressPending={loading}
            pagination
            selectableRows
            onSelectedRowsChange={(s) => setSelectedRows(s.selectedRows)}
            highlightOnHover
            striped
            responsive
            noDataComponent={<div className="py-16 text-slate-400 text-sm">No users found.</div>}
          />
        </motion.div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">
                {editingUser ? 'Edit User' : 'Add New User'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              {[
                { label: 'Full Name', name: 'name', type: 'text', placeholder: 'John Doe', icon: <User size={14} /> },
                { label: 'Email', name: 'email', type: 'email', placeholder: 'john@example.com', icon: <Mail size={14} />, disabled: !!editingUser },
                { label: editingUser ? 'New Password (leave blank to keep)' : 'Password', name: 'password', type: 'password', placeholder: '••••••••', icon: <KeyRound size={14} /> },
              ].map(({ label, name, type, placeholder, icon, disabled }) => (
                <div key={name}>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{icon}</span>
                    <input
                      type={type}
                      value={form[name]}
                      onChange={(e) => setForm((p) => ({ ...p, [name]: e.target.value }))}
                      placeholder={placeholder}
                      disabled={disabled}
                      className={`w-full pl-9 pr-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E3A8C] transition ${formErrors[name] ? 'border-red-400' : 'border-slate-300'} ${disabled ? 'bg-slate-50 text-slate-400' : ''}`}
                    />
                  </div>
                  {formErrors[name] && <p className="text-xs text-red-500 mt-1">{formErrors[name]}</p>}
                </div>
              ))}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E3A8C]"
                >
                  <option value="control_room">Control Room</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 border border-slate-300 text-slate-700 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-50">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="flex-1 bg-[#2E3A8C] text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-[#4F68A4] disabled:opacity-60">
                  {submitting ? 'Saving...' : editingUser ? 'Update User' : 'Create User'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}

export default UserManagement;
