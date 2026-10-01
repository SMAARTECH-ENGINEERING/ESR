import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import { Calendar, Droplets, Activity, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';
import { FaFilePdf, FaFileExcel } from 'react-icons/fa';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import api from '../../utils/api';
import { FLOW_UNIT, VOLUME_UNIT, toM3h, toM3, fmtFlow, fmtVolume } from '../../utils/units';

const StatBox = ({ label, value, unit, icon, color }) => (
  <div className={`border bg-white p-5 shadow-[0_4px_20px_rgba(15,23,42,0.06)] border-slate-200`}>
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

export default function DailyReport() {
  const today = new Date().toISOString().split('T')[0];
  const [tanks, setTanks] = useState([]);
  const [selectedTank, setSelectedTank] = useState('');
  const [date, setDate] = useState(today);
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
      const res = await api.get(`/reports/daily/${selectedTank}`, { params: { date } });
      setReport(res.data.data);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load report.');
    } finally {
      setLoading(false);
    }
  }, [selectedTank, date]);

  useEffect(() => {
    if (selectedTank) fetchReport();
  }, [fetchReport]);

  const chartData = report?.report
    ? [
        { name: 'Avg Flow', value: toM3h(report.report.avgFlowRate || 0) },
        { name: 'Max Flow', value: toM3h(report.report.maxFlowRate || 0) },
        { name: 'Min Flow', value: toM3h(report.report.minFlowRate || 0) },
      ]
    : [];

  const exportExcel = () => {
    if (!report) return;
    const ws = XLSX.utils.json_to_sheet([{
      'Tank ID': report.tankId,
      Date: report.date,
      'Daily Total (m3)': toM3(report.report?.dailyTotal),
      'Avg Flow Rate (m3/h)': toM3h(report.report?.avgFlowRate),
      'Max Flow Rate (m3/h)': toM3h(report.report?.maxFlowRate),
      'Min Flow Rate (m3/h)': toM3h(report.report?.minFlowRate),
      'Total Readings': report.report?.totalReadings,
    }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Daily Report');
    saveAs(new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })], { type: 'application/octet-stream' }), `daily-report-${date}.xlsx`);
  };

  const exportPDF = () => {
    if (!report) return;
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text(`Daily Report — ${report.date}`, 14, 15);
    autoTable(doc, {
      startY: 25,
      head: [['Metric', 'Value']],
      body: [
        ['Daily Total (m3)', fmtVolume(report.report?.dailyTotal)],
        ['Avg Flow Rate (m3/h)', fmtFlow(report.report?.avgFlowRate)],
        ['Max Flow Rate (m3/h)', fmtFlow(report.report?.maxFlowRate)],
        ['Min Flow Rate (m3/h)', fmtFlow(report.report?.minFlowRate)],
        ['Total Readings', report.report?.totalReadings],
        ['First Reading At', report.report?.firstReadingAt ? new Date(report.report.firstReadingAt).toLocaleString() : 'N/A'],
        ['Last Reading At', report.report?.lastReadingAt ? new Date(report.report.lastReadingAt).toLocaleString() : 'N/A'],
      ],
    });
    doc.save(`daily-report-${date}.pdf`);
  };

  return (
    <div className="min-h-screen bg-[#f5f7fb] p-6">
      <div className="mx-auto w-full">

        {/* Header */}
        <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Daily Report</h1>
            <p className="text-sm text-slate-500 mt-1">Per-tank daily flow and totalizer statistics</p>
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
                  ? <option>Loading tanks...</option>
                  : tanks.map((t) => <option key={t._id} value={t._id}>{t.tankName} — {t.location}</option>)
                }
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
              <input
                type="date"
                value={date}
                max={today}
                onChange={(e) => setDate(e.target.value)}
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

        {/* Error */}
        {error && (
          <div className="mb-4 border border-red-200 bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">{error}</div>
        )}

        {/* Stat Cards */}
        {report?.report && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="flex items-center gap-2 mb-4">
              <Calendar size={16} className="text-slate-400" />
              <span className="text-sm text-slate-500 font-medium">
                {report.date} — {tanks.find((t) => t._id === selectedTank)?.tankName}
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
              <StatBox label="Daily Total" value={fmtVolume(report.report.dailyTotal)} unit={VOLUME_UNIT} icon={<Droplets size={20} />} color="#2E3A8C" />
              <StatBox label="Avg Flow Rate" value={fmtFlow(report.report.avgFlowRate)} unit={FLOW_UNIT} icon={<Activity size={20} />} color="#10b981" />
              <StatBox label="Max Flow Rate" value={fmtFlow(report.report.maxFlowRate)} unit={FLOW_UNIT} icon={<TrendingUp size={20} />} color="#f59e0b" />
              <StatBox label="Min Flow Rate" value={fmtFlow(report.report.minFlowRate)} unit={FLOW_UNIT} icon={<TrendingDown size={20} />} color="#6366f1" />
            </div>

            {/* Flow Rate Summary Chart */}
            <div className="border border-slate-200 bg-white p-6 shadow-[0_4px_20px_rgba(15,23,42,0.05)] mb-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-5">Flow Rate Summary</h3>
              <div className="h-64 rounded border border-slate-100 bg-[#f8fbff] p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(v) => [`${v} ${FLOW_UNIT}`]} />
                    <Bar dataKey="value" fill="#2E3A8C" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Details Table */}
            <div className="border border-slate-200 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.05)]">
              <div className="px-6 py-4 border-b border-slate-100">
                <h3 className="text-lg font-semibold text-slate-900">Report Details</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <tbody>
                    {[
                      ['Daily Total', `${fmtVolume(report.report.dailyTotal)} ${VOLUME_UNIT}`],
                      ['Average Flow Rate', `${fmtFlow(report.report.avgFlowRate)} ${FLOW_UNIT}`],
                      ['Maximum Flow Rate', `${fmtFlow(report.report.maxFlowRate)} ${FLOW_UNIT}`],
                      ['Minimum Flow Rate', `${fmtFlow(report.report.minFlowRate)} ${FLOW_UNIT}`],
                      ['Total Readings', report.report.totalReadings],
                      ['First Reading At', report.report.firstReadingAt ? new Date(report.report.firstReadingAt).toLocaleString() : 'N/A'],
                      ['Last Reading At', report.report.lastReadingAt ? new Date(report.report.lastReadingAt).toLocaleString() : 'N/A'],
                    ].map(([label, value]) => (
                      <tr key={label} className="border-b border-slate-50 hover:bg-slate-50">
                        <td className="px-6 py-3 font-medium text-slate-600 w-1/2">{label}</td>
                        <td className="px-6 py-3 text-slate-900 font-semibold">{value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {!loading && !report && !error && (
          <div className="text-center py-20 text-slate-400 text-sm">
            Select a tank and date, then click Fetch Report.
          </div>
        )}
      </div>
    </div>
  );
}
