import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  LineChart, Line,
} from 'recharts';
import { Calendar, Droplets, Activity, TrendingUp, RefreshCw } from 'lucide-react';
import { FaFilePdf, FaFileExcel } from 'react-icons/fa';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import api from '../../utils/api';
import { FLOW_UNIT, VOLUME_UNIT, toM3h, toM3, fmtFlow, fmtVolume } from '../../utils/units';

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

function getMondayOfWeek(dateStr) {
  const d = dateStr ? new Date(dateStr) : new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split('T')[0];
}

export default function WeeklyReport() {
  const [tanks, setTanks] = useState([]);
  const [selectedTank, setSelectedTank] = useState('');
  const [startDate, setStartDate] = useState(getMondayOfWeek());
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [tanksLoading, setTanksLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard')
      .then((r) => {
        const list = r.data.data?.tanks || [];
        setTanks(list);
        if (list.length > 0) setSelectedTank(list[0]._id);
      })
      .catch(() => setTanks([]))
      .finally(() => setTanksLoading(false));
  }, []);

  const fetchReport = useCallback(async () => {
    if (!selectedTank) return;
    try {
      setLoading(true);
      setError(null);
      const res = await api.get(`/reports/weekly/${selectedTank}`, { params: { startDate } });
      setReport(res.data.data);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load report.');
    } finally {
      setLoading(false);
    }
  }, [selectedTank, startDate]);

  useEffect(() => {
    if (selectedTank) fetchReport();
  }, [fetchReport]);

  const dailyBreakdown = report?.dailyBreakdown || [];

  const totalReadings = dailyBreakdown.reduce((s, d) => s + (d.totalReadings || 0), 0);
  const maxDayTotal = dailyBreakdown.reduce((m, d) => Math.max(m, d.dailyTotal || 0), 0);
  const avgDailyFlow = dailyBreakdown.length
    ? fmtFlow(dailyBreakdown.reduce((s, d) => s + (d.avgFlowRate || 0), 0) / dailyBreakdown.length)
    : null;

  const exportExcel = () => {
    if (!report) return;
    const ws = XLSX.utils.json_to_sheet(
      dailyBreakdown.map((d) => ({
        Date: d.date,
        'Daily Total (m3)': toM3(d.dailyTotal),
        'Avg Flow Rate (m3/h)': toM3h(d.avgFlowRate),
        'Max Flow Rate (m3/h)': toM3h(d.maxFlowRate),
        'Total Readings': d.totalReadings,
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Weekly Report');
    saveAs(new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })], { type: 'application/octet-stream' }), `weekly-report-${startDate}.xlsx`);
  };

  const exportPDF = () => {
    if (!report) return;
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text(`Weekly Report — ${report.weekStart} to ${report.weekEnd}`, 14, 15);
    doc.setFontSize(11);
    doc.text(`Weekly Total: ${fmtVolume(report.weeklyTotal)} m3`, 14, 25);
    autoTable(doc, {
      startY: 32,
      head: [['Date', 'Daily Total (m3)', 'Avg Flow Rate (m3/h)', 'Max Flow Rate (m3/h)', 'Readings']],
      body: dailyBreakdown.map((d) => [
        d.date, fmtVolume(d.dailyTotal), fmtFlow(d.avgFlowRate), fmtFlow(d.maxFlowRate), d.totalReadings,
      ]),
    });
    doc.save(`weekly-report-${startDate}.pdf`);
  };

  return (
    <div className="min-h-screen bg-[#f5f7fb] p-6">
      <div className="mx-auto w-full">

        {/* Header */}
        <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Weekly Report</h1>
            <p className="text-sm text-slate-500 mt-1">7-day breakdown of flow rate and totalizer by tank</p>
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              <label className="block text-sm font-medium text-slate-700 mb-1">Week Start (Monday)</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(getMondayOfWeek(e.target.value))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2E3A8C]"
              />
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
                {report.weekStart} → {report.weekEnd} — {tanks.find((t) => t._id === selectedTank)?.tankName}
              </span>
            </div>

            {/* Summary Cards */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
              <StatBox label="Weekly Total" value={fmtVolume(report.weeklyTotal)} unit={VOLUME_UNIT} icon={<Droplets size={20} />} color="#2E3A8C" />
              <StatBox label="Avg Daily Flow" value={avgDailyFlow} unit={FLOW_UNIT} icon={<Activity size={20} />} color="#10b981" />
              <StatBox label="Peak Day Total" value={fmtVolume(maxDayTotal)} unit={VOLUME_UNIT} icon={<TrendingUp size={20} />} color="#f59e0b" />
              <StatBox label="Total Readings" value={totalReadings} unit="" icon={<RefreshCw size={20} />} color="#6366f1" />
            </div>

            {/* Daily Total Bar Chart */}
            <div className="border border-slate-200 bg-white p-6 shadow-[0_4px_20px_rgba(15,23,42,0.05)] mb-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-5">Daily Totalizer Breakdown</h3>
              {dailyBreakdown.length > 0 ? (
                <div className="h-72 rounded border border-slate-100 bg-[#f8fbff] p-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dailyBreakdown.map((d) => ({ day: d.date?.slice(5), total: toM3(d.dailyTotal || 0) }))}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="day" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                      <Tooltip formatter={(v) => [`${v.toLocaleString()} ${VOLUME_UNIT}`, 'Totalizer']} />
                      <Bar dataKey="total" fill="#2E3A8C" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-72 flex items-center justify-center text-slate-400 text-sm border border-slate-100 bg-[#f8fbff]">
                  No data for this week
                </div>
              )}
            </div>

            {/* Avg Flow Rate Line Chart */}
            <div className="border border-slate-200 bg-white p-6 shadow-[0_4px_20px_rgba(15,23,42,0.05)] mb-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-5">Avg Flow Rate Trend</h3>
              {dailyBreakdown.length > 0 ? (
                <div className="h-64 rounded border border-slate-100 bg-[#f8fbff] p-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dailyBreakdown.map((d) => ({ day: d.date?.slice(5), avgFlow: toM3h(d.avgFlowRate || 0) }))}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="day" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                      <Tooltip formatter={(v) => [`${v} ${FLOW_UNIT}`, 'Avg Flow Rate']} />
                      <Line type="monotone" dataKey="avgFlow" stroke="#10b981" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-slate-400 text-sm border border-slate-100 bg-[#f8fbff]">
                  No data for this week
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
                      {['Date', `Daily Total (${VOLUME_UNIT})`, `Avg Flow (${FLOW_UNIT})`, `Max Flow (${FLOW_UNIT})`, 'Readings'].map((h) => (
                        <th key={h} className="px-5 py-3 text-left font-semibold text-slate-600">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dailyBreakdown.length === 0 ? (
                      <tr><td colSpan={5} className="px-5 py-10 text-center text-slate-400">No data</td></tr>
                    ) : (
                      dailyBreakdown.map((d, i) => (
                        <tr key={i} className="border-b border-slate-50 hover:bg-slate-50 transition">
                          <td className="px-5 py-3 font-medium text-slate-700">{d.date}</td>
                          <td className="px-5 py-3 text-blue-600 font-semibold">{fmtVolume(d.dailyTotal) ?? '—'}</td>
                          <td className="px-5 py-3 text-emerald-600">{fmtFlow(d.avgFlowRate) ?? '—'}</td>
                          <td className="px-5 py-3 text-amber-600">{fmtFlow(d.maxFlowRate) ?? '—'}</td>
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
            Select a tank and week, then click Fetch Report.
          </div>
        )}

      </div>
    </div>
  );
}
