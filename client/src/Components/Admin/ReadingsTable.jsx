import { useCallback, useEffect, useMemo, useState } from 'react';
import DataTable from 'react-data-table-component';
import { motion } from 'framer-motion';
import { FaFileCsv, FaFileExcel, FaFilePdf } from 'react-icons/fa';
import { RefreshCw, CalendarDays, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'react-toastify';
import api from '../../utils/api';

// Server-paginated list of raw device readings with tank + date filters.
// Pass `tankId` to lock the table to one tank (Tank Detail page).

const EXPORT_LIMIT = 5000;

const toDateInput = (d) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d; };

const QUICK_RANGES = [
  { key: 'today', label: 'Today',    from: () => toDateInput(new Date()) },
  { key: '7d',    label: '7 Days',   from: () => toDateInput(daysAgo(6)) },
  { key: '30d',   label: '30 Days',  from: () => toDateInput(daysAgo(29)) },
  { key: '4m',    label: '4 Months', from: () => toDateInput(daysAgo(119)) },
  { key: 'all',   label: 'All',      from: () => '' },
];

// Date inputs are local calendar days → full-day ISO bounds
const startOfDayIso = (s) => (s ? new Date(`${s}T00:00:00`).toISOString() : undefined);
const endOfDayIso = (s) => (s ? new Date(`${s}T23:59:59.999`).toISOString() : undefined);

const fmtTime = (t) => new Date(t).toLocaleString([], {
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
});
const fmtNum = (v, digits = 2) => (v == null ? '—' : Number(v).toLocaleString(undefined, { maximumFractionDigits: digits }));

const inputCls = 'text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2E3A8C]';

export default function ReadingsTable({ tankId: fixedTankId, title = 'Readings' }) {
  const [tanks, setTanks] = useState([]);
  const [tankId, setTankId] = useState(fixedTankId || '');
  const [from, setFrom] = useState(toDateInput(new Date()));
  const [to, setTo] = useState('');
  const [quick, setQuick] = useState('today');

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [resetPage, setResetPage] = useState(false);

  // Tank list for the filter (dashboard endpoint works for both roles)
  useEffect(() => {
    if (fixedTankId) return;
    api.get('/dashboard')
      .then((res) => setTanks(res.data.data.tanks || []))
      .catch(() => {});
  }, [fixedTankId]);

  const params = useMemo(() => ({
    ...(tankId && { tankId }),
    ...(from && { from: startOfDayIso(from) }),
    ...(to && { to: endOfDayIso(to) }),
  }), [tankId, from, to]);

  const fetchPage = useCallback(async (p = page, limit = perPage) => {
    try {
      setLoading(true);
      const res = await api.get('/iot/readings', { params: { ...params, page: p, limit } });
      setRows(res.data.data || []);
      setTotal(res.data.pagination?.total || 0);
    } catch (err) {
      toast.error(err.response?.data?.errors?.join(', ') || err.response?.data?.message || 'Failed to load readings.');
    } finally {
      setLoading(false);
    }
  }, [params, page, perPage]);

  // Filters changed → back to page 1
  useEffect(() => {
    setPage(1);
    setResetPage((v) => !v);
    fetchPage(1, perPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const applyQuick = (key) => {
    const q = QUICK_RANGES.find((r) => r.key === key);
    setQuick(key);
    setFrom(q.from());
    setTo('');
  };

  const onFromChange = (v) => {
    setQuick('');
    setFrom(v);
    if (to && v && v > to) setTo(v);
  };
  const onToChange = (v) => {
    setQuick('');
    setTo(v);
    if (from && v && v < from) setFrom(v);
  };

  // ── Export: all readings matching the filter (capped) ─────────────────────
  const fetchAllForExport = async () => {
    const res = await api.get('/iot/readings', { params: { ...params, page: 1, limit: EXPORT_LIMIT } });
    const data = res.data.data || [];
    if ((res.data.pagination?.total || 0) > EXPORT_LIMIT) {
      toast.info(`Exporting the newest ${EXPORT_LIMIT.toLocaleString()} readings. Narrow the date range to export older ones.`);
    }
    return data;
  };

  const HEADERS = ['Date & Time', 'Tank', 'Device ID', 'Flow Rate (L/min)', 'Totalizer (L)', 'Water Level (%)'];
  const toRow = (r) => [fmtTime(r.timestamp), r.tankName, r.deviceId, r.flowRate, r.totalizer, r.waterLevelPercent ?? ''];
  const fileBase = () => `readings-${from || 'all'}${to ? `_to_${to}` : ''}`;

  const doExport = async (kind) => {
    try {
      setExporting(true);
      const data = (await fetchAllForExport()).map(toRow);
      if (!data.length) { toast.info('No readings to export.'); return; }

      if (kind === 'csv') {
        const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
        const csv = [HEADERS, ...data].map((r) => r.map(esc).join(',')).join('\n');
        saveAs(new Blob([csv], { type: 'text/csv' }), `${fileBase()}.csv`);
      } else if (kind === 'excel') {
        const ws = XLSX.utils.aoa_to_sheet([HEADERS, ...data]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Readings');
        saveAs(new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })], { type: 'application/octet-stream' }), `${fileBase()}.xlsx`);
      } else {
        const doc = new jsPDF({ orientation: 'landscape' });
        doc.setFontSize(12);
        doc.text(`${title} — ${from || 'all'}${to ? ` to ${to}` : ''}`, 14, 12);
        autoTable(doc, { head: [HEADERS], body: data, startY: 18, styles: { fontSize: 8 } });
        doc.save(`${fileBase()}.pdf`);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Export failed.');
    } finally {
      setExporting(false);
    }
  };

  const columns = useMemo(() => [
    {
      name: 'Date & Time',
      selector: (r) => r.timestamp,
      grow: 1.4,
      cell: (r) => <span className="text-xs text-slate-600 whitespace-nowrap">{fmtTime(r.timestamp)}</span>,
    },
    ...(fixedTankId ? [] : [{
      name: 'Tank',
      selector: (r) => r.tankName,
      cell: (r) => (
        <div>
          <div className="font-semibold text-slate-800">{r.tankName}</div>
          <div className="font-mono text-xs text-blue-600">{r.deviceId}</div>
        </div>
      ),
    }]),
    {
      name: 'Flow Rate (L/min)',
      right: true,
      selector: (r) => r.flowRate,
      cell: (r) => <span className="font-semibold text-[#2E3A8C]">{fmtNum(r.flowRate)}</span>,
    },
    {
      name: 'Totalizer (L)',
      right: true,
      selector: (r) => r.totalizer,
      cell: (r) => <span className="font-semibold text-emerald-600">{fmtNum(r.totalizer)}</span>,
    },
    {
      name: 'Water Level (%)',
      right: true,
      selector: (r) => r.waterLevelPercent,
      cell: (r) => <span className="text-amber-600">{fmtNum(r.waterLevelPercent, 1)}</span>,
    },
  ], [fixedTankId]);

  return (
    <div className="bg-white rounded-xl shadow-md border border-slate-200">
      {/* Filters */}
      <div className="px-4 py-3 border-b border-slate-100 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900">{title}</h3>
            <p className="text-xs text-slate-500">{total.toLocaleString()} reading{total === 1 ? '' : 's'} found</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <motion.button whileHover={{ scale: 1.03 }} onClick={() => fetchPage()} disabled={loading}
              className="flex items-center gap-1.5 bg-white text-slate-700 px-3 py-2 rounded-lg text-xs border border-slate-200 disabled:opacity-60">
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
            </motion.button>
            <motion.button whileHover={{ scale: 1.03 }} onClick={() => doExport('csv')} disabled={exporting}
              className="flex items-center gap-1.5 bg-blue-50 text-blue-600 px-3 py-2 rounded-lg text-xs border border-blue-200 disabled:opacity-60">
              <FaFileCsv size={13} /> CSV
            </motion.button>
            <motion.button whileHover={{ scale: 1.03 }} onClick={() => doExport('excel')} disabled={exporting}
              className="flex items-center gap-1.5 bg-emerald-50 text-emerald-600 px-3 py-2 rounded-lg text-xs border border-emerald-200 disabled:opacity-60">
              <FaFileExcel size={13} /> Excel
            </motion.button>
            <motion.button whileHover={{ scale: 1.03 }} onClick={() => doExport('pdf')} disabled={exporting}
              className="flex items-center gap-1.5 bg-rose-50 text-rose-600 px-3 py-2 rounded-lg text-xs border border-rose-200 disabled:opacity-60">
              <FaFilePdf size={13} /> PDF
            </motion.button>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          {!fixedTankId && (
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Tank</label>
              <select value={tankId} onChange={(e) => setTankId(e.target.value)} className={`${inputCls} min-w-[12rem]`}>
                <option value="">All tanks</option>
                {tanks.map((t) => <option key={t._id} value={t._id}>{t.tankName} ({t.deviceId})</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">From</label>
            <input type="date" value={from} max={toDateInput(new Date())} onChange={(e) => onFromChange(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">To</label>
            <input type="date" value={to} max={toDateInput(new Date())} onChange={(e) => onToChange(e.target.value)} className={inputCls} />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <CalendarDays size={15} className="text-slate-400 mr-0.5" />
            {QUICK_RANGES.map((q) => (
              <button
                key={q.key}
                type="button"
                onClick={() => applyQuick(q.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                  quick === q.key
                    ? 'bg-[#2E3A8C] text-white border-[#2E3A8C]'
                    : 'bg-white text-slate-600 border-slate-300 hover:border-[#2E3A8C] hover:text-[#2E3A8C]'
                }`}
              >
                {q.label}
              </button>
            ))}
            {(from || to) && (
              <button type="button" onClick={() => applyQuick('all')} title="Clear dates"
                className="ml-1 text-slate-400 hover:text-red-500">
                <X size={15} />
              </button>
            )}
          </div>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        progressPending={loading}
        pagination
        paginationServer
        paginationTotalRows={total}
        paginationPerPage={perPage}
        paginationRowsPerPageOptions={[10, 25, 50, 100]}
        paginationResetDefaultPage={resetPage}
        onChangePage={(p) => { setPage(p); fetchPage(p, perPage); }}
        onChangeRowsPerPage={(limit, p) => { setPerPage(limit); setPage(p); fetchPage(p, limit); }}
        highlightOnHover
        striped
        responsive
        noDataComponent={
          <div className="py-16 text-slate-400 text-sm text-center">
            No readings for the selected {fixedTankId ? '' : 'tank and '}dates.
          </div>
        }
      />
    </div>
  );
}
