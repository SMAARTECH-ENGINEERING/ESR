import React, { useState, useMemo, useCallback, useEffect } from 'react';
import DataTable from 'react-data-table-component';
import Swal from 'sweetalert2';
import { motion } from 'framer-motion';
import { FaEdit, FaTrash, FaFileCsv, FaFileExcel, FaFilePdf, FaPlus } from 'react-icons/fa';
import { FiSearch } from 'react-icons/fi';
import { Wifi, WifiOff, Eye } from 'lucide-react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useNavigate } from 'react-router-dom';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import api from '../../utils/api';

const STATUS_COLORS = {
  online: 'bg-emerald-100 text-emerald-700',
  offline: 'bg-red-100 text-red-700',
  inactive: 'bg-slate-100 text-slate-500',
};

const emptyForm = { tankName: '', deviceId: '', location: '', status: 'inactive' };

function TankList() {
  const navigate = useNavigate();

  const [tanks, setTanks] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingTank, setEditingTank] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [selectedRows, setSelectedRows] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 1 });

  const fetchTanks = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      const params = { page, limit: pagination.limit };
      if (statusFilter) params.status = statusFilter;
      const res = await api.get('/tanks', { params });
      setTanks(res.data.data || []);
      if (res.data.pagination) setPagination((prev) => ({ ...prev, ...res.data.pagination, page }));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to fetch tanks.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, pagination.limit]);

  useEffect(() => { fetchTanks(1); }, [statusFilter]);

  const filteredTanks = useMemo(() => {
    if (!search) return tanks;
    const q = search.toLowerCase();
    return tanks.filter(
      (t) =>
        t.tankName?.toLowerCase().includes(q) ||
        t.deviceId?.toLowerCase().includes(q) ||
        t.location?.toLowerCase().includes(q)
    );
  }, [tanks, search]);

  const validateForm = () => {
    const errs = {};
    if (!form.tankName.trim()) errs.tankName = 'Tank name is required';
    if (!form.deviceId.trim()) errs.deviceId = 'Device ID is required';
    if (!form.location.trim()) errs.location = 'Location is required';
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const openAddModal = () => {
    setEditingTank(null);
    setForm(emptyForm);
    setFormErrors({});
    setShowModal(true);
  };

  const openEditModal = (tank) => {
    setEditingTank(tank);
    setForm({ tankName: tank.tankName, deviceId: tank.deviceId, location: tank.location, status: tank.status });
    setFormErrors({});
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    try {
      setSubmitting(true);
      if (editingTank) {
        await api.put(`/tanks/${editingTank._id}`, form);
        toast.success('Tank updated successfully.');
      } else {
        await api.post('/tanks', form);
        toast.success('Tank created successfully.');
      }
      setShowModal(false);
      fetchTanks(pagination.page);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Operation failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = useCallback(async (row) => {
    const result = await Swal.fire({
      title: 'Delete Tank?',
      text: `"${row.tankName}" will be permanently removed.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete',
      cancelButtonText: 'Cancel',
      buttonsStyling: false,
      customClass: {
        confirmButton: 'bg-red-500 hover:bg-red-600 text-white font-semibold px-5 py-2 rounded-lg mx-2',
        cancelButton: 'bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold px-5 py-2 rounded-lg mx-2',
      },
    });
    if (!result.isConfirmed) return;
    try {
      await api.delete(`/tanks/${row._id}`);
      toast.success('Tank deleted.');
      fetchTanks(pagination.page);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed.');
    }
  }, [fetchTanks, pagination.page]);

  const getExportData = () => (selectedRows.length ? selectedRows : filteredTanks);

  const downloadCSV = () => {
    const rows = getExportData();
    const csv = [
      ['Tank Name', 'Device ID', 'Location', 'Status', 'Last Seen'].join(','),
      ...rows.map((r) => [r.tankName, r.deviceId, r.location, r.status, r.lastSeen ? new Date(r.lastSeen).toLocaleString() : 'Never'].join(',')),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'tanks.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const exportExcel = () => {
    const rows = getExportData().map((r) => ({
      'Tank Name': r.tankName, 'Device ID': r.deviceId, Location: r.location,
      Status: r.status, 'Last Seen': r.lastSeen ? new Date(r.lastSeen).toLocaleString() : 'Never',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Tanks');
    saveAs(new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })], { type: 'application/octet-stream' }), `tanks-${Date.now()}.xlsx`);
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    autoTable(doc, {
      head: [['Tank Name', 'Device ID', 'Location', 'Status', 'Last Seen']],
      body: getExportData().map((r) => [r.tankName, r.deviceId, r.location, r.status, r.lastSeen ? new Date(r.lastSeen).toLocaleString() : 'Never']),
    });
    doc.save(`tanks-${Date.now()}.pdf`);
  };

  const columns = useMemo(() => [
    {
      name: 'Tank Name',
      selector: (r) => r.tankName,
      sortable: true,
      cell: (r) => <span className="font-semibold text-slate-800">{r.tankName}</span>,
    },
    {
      name: 'Device ID',
      selector: (r) => r.deviceId,
      sortable: true,
      cell: (r) => <span className="font-mono text-xs text-blue-600">{r.deviceId}</span>,
    },
    {
      name: 'Location',
      selector: (r) => r.location,
      sortable: true,
      cell: (r) => <span className="text-slate-600">{r.location}</span>,
    },
    {
      name: 'Status',
      selector: (r) => r.status,
      sortable: true,
      cell: (r) => (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full ${STATUS_COLORS[r.status]}`}>
          {r.status === 'online' ? <Wifi size={10} /> : <WifiOff size={10} />}
          {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
        </span>
      ),
    },
    {
      name: 'Last Seen',
      selector: (r) => r.lastSeen,
      sortable: true,
      cell: (r) => (
        <span className="text-xs text-slate-500">
          {r.lastSeen ? new Date(r.lastSeen).toLocaleString() : 'Never'}
        </span>
      ),
    },
    {
      name: 'Actions',
      cell: (r) => (
        <div className="flex gap-2">
          <motion.button whileHover={{ scale: 1.15 }} onClick={() => navigate(`/admin/tanks/${r._id}`)} className="text-[#2E3A8C] hover:opacity-80" title="View Live">
            <Eye size={15} />
          </motion.button>
          <motion.button whileHover={{ scale: 1.15 }} onClick={() => openEditModal(r)} className="text-amber-500 hover:opacity-80" title="Edit">
              <FaEdit size={14} />
            </motion.button>
            <motion.button whileHover={{ scale: 1.15 }} onClick={() => handleDelete(r)} className="text-red-500 hover:opacity-80" title="Delete">
              <FaTrash size={14} />
            </motion.button>
        </div>
      ),
      ignoreRowClick: true,
    },
  ], [handleDelete, navigate]);

  return (
    <div className="min-h-screen bg-[#f5f7fb]">
      <ToastContainer position="top-right" autoClose={3000} />

      {/* Header */}
      <div className="sticky top-0 md:top-24 z-10 backdrop-blur-xl bg-white/80 border-b border-gray-200 shadow-sm">
        <div className="w-full mx-auto px-4 py-3 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Tank Management</h1>
            <p className="text-xs text-slate-500">Total: {pagination.total} tanks</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2E3A8C]"
            >
              <option value="">All Status</option>
              <option value="online">Online</option>
              <option value="offline">Offline</option>
              <option value="inactive">Inactive</option>
            </select>

            {/* Search */}
            <div className="flex items-center bg-white px-3 py-2 rounded-lg shadow border border-slate-200 w-full sm:w-64">
              <FiSearch className="text-gray-400 mr-2" />
              <input
                type="text"
                placeholder="Search tanks..."
                className="outline-none w-full text-sm text-slate-700"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Export */}
            <motion.button whileHover={{ scale: 1.03 }} onClick={downloadCSV} className="flex items-center gap-1.5 bg-blue-50 text-blue-600 px-3 py-2 rounded-lg text-xs border border-blue-200">
              <FaFileCsv size={13} /> CSV
            </motion.button>
            <motion.button whileHover={{ scale: 1.03 }} onClick={exportExcel} className="flex items-center gap-1.5 bg-emerald-50 text-emerald-600 px-3 py-2 rounded-lg text-xs border border-emerald-200">
              <FaFileExcel size={13} /> Excel
            </motion.button>
            <motion.button whileHover={{ scale: 1.03 }} onClick={exportPDF} className="flex items-center gap-1.5 bg-rose-50 text-rose-600 px-3 py-2 rounded-lg text-xs border border-rose-200">
              <FaFilePdf size={13} /> PDF
            </motion.button>

            {/* Add Button (admin only) */}
            <motion.button
              whileHover={{ scale: 1.03 }}
              onClick={openAddModal}
              className="flex items-center gap-1.5 bg-[#2E3A8C] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#4F68A4] transition"
            >
              <FaPlus size={12} /> Add Tank
            </motion.button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="w-full mx-auto  mt-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-white rounded-xl shadow-md overflow-x-auto"
        >
          <DataTable
            columns={columns}
            data={filteredTanks}
            progressPending={loading}
            pagination
            paginationServer
            paginationTotalRows={pagination.total}
            onChangePage={(page) => fetchTanks(page)}
            onChangeRowsPerPage={(limit) => setPagination((p) => ({ ...p, limit }))}
            selectableRows
            onSelectedRowsChange={(s) => setSelectedRows(s.selectedRows)}
            highlightOnHover
            striped
            responsive
            noDataComponent={
              <div className="py-16 text-slate-400 text-sm">No tanks found. Add your first tank to get started.</div>
            }
          />
        </motion.div>
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center ">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">
                {editingTank ? 'Edit Tank' : 'Add New Tank'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              {[
                { label: 'Tank Name', name: 'tankName', placeholder: 'e.g. ESR Tank A1' },
                { label: 'Device ID', name: 'deviceId', placeholder: 'e.g. DEV001' },
                { label: 'Location', name: 'location', placeholder: 'e.g. Bhubaneswar North' },
              ].map(({ label, name, placeholder }) => (
                <div key={name}>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
                  <input
                    type="text"
                    value={form[name]}
                    onChange={(e) => setForm((p) => ({ ...p, [name]: e.target.value }))}
                    placeholder={placeholder}
                    className={`w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E3A8C] transition ${formErrors[name] ? 'border-red-400' : 'border-slate-300'}`}
                  />
                  {formErrors[name] && <p className="text-xs text-red-500 mt-1">{formErrors[name]}</p>}
                </div>
              ))}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E3A8C]"
                >
                  <option value="inactive">Inactive</option>
                  <option value="online">Online</option>
                  <option value="offline">Offline</option>
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 border border-slate-300 text-slate-700 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-[#2E3A8C] text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-[#4F68A4] transition disabled:opacity-60"
                >
                  {submitting ? 'Saving...' : editingTank ? 'Update Tank' : 'Add Tank'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}

export default TankList;
