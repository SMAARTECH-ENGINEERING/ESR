import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  AreaChart, Area,
} from 'recharts';
import { Calendar, Droplets, Activity, TrendingUp, RefreshCw } from 'lucide-react';
import { FaFilePdf, FaFileExcel } from 'react-icons/fa';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import api from '../../utils/api';
import { DUMMY_TANKS, DUMMY_MONTHLY_REPORT } from '../../utils/dummyData';

const StatBox = ({ label, value, unit, icon, color }) => (
  <div className="border border-slate-200 bg-white p-5 shadow-[0_4px_20px_rgba(15,23,42,0.06)]">
    <div className="flex items-center justify-between mb-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      <span style={{ color }}>{icon}</span>
    </div>
    <p className="text-3xl font-bold text-slate-900">
      {value != null ? value : '—'}
      {value != null && <span className="ml-1 text-sm font-normal text-slate-400">{unit}</span>}
    </p>
  </div>
);

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function MonthlyReport() {
  const now = new Date();
  const [tanks, setTanks] = useState([]);
  const [selectedTank, setSelectedTank] = useState('');
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [tanksLoading, setTanksLoading] = useState(true);

  useEffect(() => {
    api.get('/tanks', { params: { limit: 100 } })
      .then((r) => {
        const list = r.data.data || [];
        setTanks(list);
        if (list.length > 0) setSelectedTank(list[0]._id);
      })
      .catch(() => { setTanks(DUMMY_TANKS); setSelectedTank(DUMMY_TANKS[0]._id); })
      .finally(() => setTanksLoading(false));
  }, []);

  const fetchReport = useCallback(async () => {
    if (!selectedTank) return;
    try {
      setLoading(true);
      setError(null);
      const res = await api.get(`/reports/monthly/${selectedTank}`, { params: { year, month } });
      setReport(res.data.data);
    } catch {
      setReport(DUMMY_MONTHLY_REPORT);
    } finally {
      setLoading(false);
    }
  }, [selectedTank, year, month]);

  useEffect(() => {
    if (selectedTank) fetchReport();
  }, [fetchReport]);

  const dailyBreakdown = report?.dailyBreakdown || [];
  const totalReadings = dailyBreakdown.reduce((s, d) => s + (d.totalReadings || 0), 0);
  const maxDayTotal = dailyBreakdown.reduce((m, d) => Math.max(m, d.dailyTotal || 0), 0);
  const avgDailyTotal = dailyBreakdown.length
    ? Math.round(dailyBreakdown.reduce((s, d) => s + (d.dailyTotal || 0), 0) / dailyBreakdown.length)
    : null;

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  const exportExcel = () => {
    if (!report) return;
    const ws = XLSX.utils.json_to_sheet(
      dailyBreakdown.map((d) => ({
        Date: d.date,
        'Daily Total (L)': d.dailyTotal,
        'Avg Flow Rate (L/min)': d.avgFlowRate,
        'Max Flow Rate (L/min)': d.maxFlowRate,
        'Total Readings': d.totalReadings,
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Monthly Report');
    saveAs(
      new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })], { type: 'application/octet-stream' }),
      `monthly-report-${year}-${String(month).padStart(2, '0')}.xlsx`
    );
  };

  const exportPDF = () => {
    if (!report) return;
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text(`Monthly Report — ${MONTHS[month - 1]} ${year}`, 14, 15);
    doc.setFontSize(11);
    doc.text(`Monthly Total: ${report.monthlyTotal?.toLocaleString()} L`, 14, 25);
    autoTable(doc, {
      startY: 32,
      head: [['Date', 'Daily Total (L)', 'Avg Flow Rate', 'Max Flow Rate', 'Readings']],
      body: dailyBreakdown.map((d) => [
        d.date, d.dailyTotal?.toLocaleString(), d.avgFlowRate?.toFixed(2), d.maxFlowRate?.toFixed(2), d.totalReadings,
      ]),
    });
    doc.save(`monthly-report-${year}-${String(month).padStart(2, '0')}.pdf`);
  };

  return (
    <div className="min-h-screen bg-[#f5f7fb] p-6">
      <div className="mx-auto w-full">

        {/* Header */}
        <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Monthly Report</h1>
            <p className="text-sm text-slate-500 mt-1">Monthly aggregated flow and totalizer data per tank</p>
          </div>
          <div className="flex gap-2">
            <motion.button whileHover={{ scale: 1.03 }} onClick={exportExcel} disabled={!report} className="flex items-center gap-1.5 bg-emerald-50 text-emerald-600 px-3 py-2 rounded-lg text-xs border border-emerald-200 disabled:opacity-40">
              <FaFileExcel size={13} /> Excel
            </motion.button>
            <motion.button whileHover={{ scale: 1.03 }} onClick={exportPDF} disabled={!report} className="flex items-center gap-1.5 bg-rose-50 text-rose-600 px-3 py-2 rounded-lg text-xs border border-rose-200 disabled:opacity-40">
              <FaFilePdf size={13} /> PDF
            </motion.button>
          </div>
        </div>

        {/* Filters */}
        <div className="border border-slate-200 bg-white p-5 shadow-[0_4px_20px_rgba(15,23,42,0.04)] mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tank</label>
              <select
                value={selectedTank}
                onChange={(e) => setSelectedTank(e.target.value)}
                disabled={tanksLoading}
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2E3A8C]"
              >
                {tanksLoading
                  ? <option>Loading...</option>
                  : tanks.map((t) => <option key={t._id} value={t._id}>{t.tankName} — {t.location}</option>)
                }
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Year</label>
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2E3A8C]"
              >
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Month</label>
              <select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2E3A8C]"
              >
                {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={fetchReport}
                disabled={loading || !selectedTank}
                className="flex items-center gap-2 bg-[#2E3A8C] text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#4F68A4] transition disabled:opacity-50 w-full justify-center"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                {loading ? 'Loading...' : 'Fetch Report'}
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 border border-red-200 bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">{error}</div>
        )}

        {report && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="flex items-center gap-2 mb-4">
              <Calendar size={16} className="text-slate-400" />
              <span className="text-sm text-slate-500 font-medium">
                {MONTHS[month - 1]} {year} — {tanks.find((t) => t._id === selectedTank)?.tankName}
              </span>
            </div>

            {/* Summary Cards */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
              <StatBox label="Monthly Total" value={report.monthlyTotal?.toLocaleString()} unit="L" icon={<Droplets size={20} />} color="#2E3A8C" />
              <StatBox label="Avg Daily Total" value={avgDailyTotal?.toLocaleString()} unit="L" icon={<Activity size={20} />} color="#10b981" />
              <StatBox label="Peak Day" value={maxDayTotal?.toLocaleString()} unit="L" icon={<TrendingUp size={20} />} color="#f59e0b" />
              <StatBox label="Total Readings" value={totalReadings} unit="" icon={<RefreshCw size={20} />} color="#6366f1" />
            </div>

            {/* Daily Total Area Chart */}
            <div className="border border-slate-200 bg-white p-6 shadow-[0_4px_20px_rgba(15,23,42,0.05)] mb-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-5">Daily Totalizer Trend</h3>
              {dailyBreakdown.length > 0 ? (
                <div className="h-72 rounded border border-slate-100 bg-[#f8fbff] p-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dailyBreakdown.map((d) => ({ day: d.date?.split('-')[2], total: d.dailyTotal || 0 }))}>
                      <defs>
                        <linearGradient id="monthlyGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#2E3A8C" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#2E3A8C" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="day" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip formatter={(v) => [`${v.toLocaleString()} L`, 'Daily Total']} />
                      <Area type="monotone" dataKey="total" stroke="#2E3A8C" strokeWidth={2.5} fill="url(#monthlyGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-72 flex items-center justify-center text-slate-400 text-sm border border-slate-100 bg-[#f8fbff]">
                  No data available for this month
                </div>
              )}
            </div>

            {/* Avg Flow Rate Bar Chart */}
            <div className="border border-slate-200 bg-white p-6 shadow-[0_4px_20px_rgba(15,23,42,0.05)] mb-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-5">Daily Avg Flow Rate</h3>
              {dailyBreakdown.length > 0 ? (
                <div className="h-64 rounded border border-slate-100 bg-[#f8fbff] p-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dailyBreakdown.map((d) => ({ day: d.date?.split('-')[2], avgFlow: Number((d.avgFlowRate || 0).toFixed(2)) }))}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="day" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip formatter={(v) => [`${v} L/min`, 'Avg Flow Rate']} />
                      <Bar dataKey="avgFlow" fill="#10b981" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-slate-400 text-sm border border-slate-100 bg-[#f8fbff]">
                  No data available
                </div>
              )}
            </div>

            {/* Breakdown Table */}
            <div className="border border-slate-200 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.05)]">
              <div className="px-6 py-4 border-b border-slate-100">
                <h3 className="text-lg font-semibold text-slate-900">Daily Breakdown</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      {['Date', 'Daily Total (L)', 'Avg Flow (L/min)', 'Max Flow (L/min)', 'Readings'].map((h) => (
                        <th key={h} className="px-5 py-3 text-left font-semibold text-slate-600">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dailyBreakdown.length === 0 ? (
                      <tr><td colSpan={5} className="px-5 py-10 text-center text-slate-400">No data for this month</td></tr>
                    ) : (
                      dailyBreakdown.map((d, i) => (
                        <tr key={i} className="border-b border-slate-50 hover:bg-slate-50 transition">
                          <td className="px-5 py-3 font-medium text-slate-700">{d.date}</td>
                          <td className="px-5 py-3 text-blue-600 font-semibold">{d.dailyTotal?.toLocaleString() ?? '—'}</td>
                          <td className="px-5 py-3 text-emerald-600">{d.avgFlowRate?.toFixed(2) ?? '—'}</td>
                          <td className="px-5 py-3 text-amber-600">{d.maxFlowRate?.toFixed(2) ?? '—'}</td>
                          <td className="px-5 py-3 text-slate-500">{d.totalReadings ?? '—'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {!loading && !report && !error && (
          <div className="text-center py-20 text-slate-400 text-sm">
            Select a tank, year, and month, then click Fetch Report.
          </div>
        )}

      </div>
    </div>
  );
}
