import { useEffect, useState } from 'react';
import { Activity, CheckCircle2, XCircle, Gauge, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { DUMMY_SUMMARY, DUMMY_TANKS } from '../../utils/dummyData';

const STATUS_COLORS = { online: '#10b981', offline: '#ef4444', inactive: '#94a3b8' };
const PIE_COLORS = ['#10b981', '#ef4444', '#94a3b8'];

const StatCard = ({ title, value, change, icon, color, bg, text, cardBg, index }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: index * 0.08 }}
    className={`group border border-slate-200/80 bg-gradient-to-br ${cardBg} p-6 shadow-[0_4px_20px_rgba(15,23,42,0.06)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_28px_rgba(15,23,42,0.12)]`}
  >
    <div className="flex items-start justify-between">
      <div>
        <div className={`flex h-14 w-14 items-center justify-center border border-white/70 shadow-sm ${bg} ${text}`}>
          {icon}
        </div>
        <p className="mt-5 text-sm font-medium uppercase tracking-wide text-slate-500">{title}</p>
        <h2 className="mt-2 text-4xl font-bold tracking-tight text-slate-900">{value}</h2>
      </div>
      <div className="border border-white/70 bg-white/70 px-3 py-1 text-xs font-semibold text-slate-700">
        {change}
      </div>
    </div>
    <div className="mt-8 h-1.5 w-full overflow-hidden bg-white/50">
      <div className={`h-full w-3/4 bg-gradient-to-r ${color} transition-all duration-500 group-hover:w-full`} />
    </div>
  </motion.div>
);

export default function Dashboard() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState({ totalTanks: 0, online: 0, offline: 0, inactive: 0 });
  const [tanks, setTanks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/dashboard');
      const { summary: s, tanks: t } = res.data.data;
      setSummary(s);
      setTanks(t || []);
      setLastUpdated(new Date());
    } catch {
      setSummary(DUMMY_SUMMARY);
      setTanks(DUMMY_TANKS);
      setLastUpdated(new Date());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 60000);
    return () => clearInterval(interval);
  }, []);

  const totalTotalizer = tanks
    .filter((t) => t.latestData)
    .reduce((sum, t) => sum + (t.latestData?.totalizer || 0), 0);

  const statCards = [
    {
      title: 'Total Totalizer',
      value: `${totalTotalizer.toLocaleString()} L`,
      change: 'All Tanks',
      icon: <Gauge size={24} />,
      color: 'from-blue-600 to-cyan-500',
      bg: 'bg-blue-100/80',
      text: 'text-blue-700',
      cardBg: 'from-blue-50 to-cyan-100',
    },
    {
      title: 'Total Tanks',
      value: summary.totalTanks,
      change: 'All Units',
      icon: <Activity size={24} />,
      color: 'from-violet-600 to-indigo-500',
      bg: 'bg-violet-100/80',
      text: 'text-violet-700',
      cardBg: 'from-violet-50 to-indigo-100',
    },
    {
      title: 'Online Tanks',
      value: summary.online,
      change: `${summary.totalTanks ? Math.round((summary.online / summary.totalTanks) * 100) : 0}% Active`,
      icon: <CheckCircle2 size={24} />,
      color: 'from-emerald-600 to-green-500',
      bg: 'bg-emerald-100/80',
      text: 'text-emerald-700',
      cardBg: 'from-emerald-50 to-green-100',
    },
    {
      title: 'Offline Tanks',
      value: summary.offline,
      change: summary.offline > 0 ? 'Need Check' : 'All Good',
      icon: <XCircle size={24} />,
      color: 'from-red-600 to-rose-500',
      bg: 'bg-red-100/80',
      text: 'text-red-700',
      cardBg: 'from-red-50 to-rose-100',
    },
  ];

  const pieData = [
    { name: 'Online', value: summary.online },
    { name: 'Offline', value: summary.offline },
    { name: 'Inactive', value: summary.inactive },
  ].filter((d) => d.value > 0);

  const totalizerChartData = tanks
    .filter((t) => t.latestData?.totalizer)
    .slice(0, 12)
    .map((t) => ({ name: t.tankName, totalizer: t.latestData.totalizer }));

  const flowRateChartData = tanks
    .filter((t) => t.latestData?.flowRate != null)
    .slice(0, 12)
    .map((t) => ({ name: t.tankName, flowRate: Number(t.latestData.flowRate.toFixed(2)) }));

  if (loading && tanks.length === 0) {
    return (
      <div className="min-h-screen bg-[#f5f7fb] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <svg className="animate-spin h-8 w-8 text-[#2E3A8C]" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
          <p className="text-sm font-medium">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f7fb] py-6 text-gray-800">
      <div className="mx-auto max-w-[1600px]">

        {/* Page Header */}
        <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            {/* <h1 className="text-2xl font-bold text-slate-900">Tank Monitoring Dashboard</h1> */}
            {lastUpdated && (
              <p className="mt-1 text-xs text-slate-400">
                Last updated: {lastUpdated.toLocaleTimeString()}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {error && <span className="text-xs text-red-500">{error}</span>}
            <button
              onClick={fetchDashboard}
              disabled={loading}
              className="flex items-center gap-2 border border-slate-300 bg-white px-4 py-2 text-sm font-medium shadow-sm hover:border-[#2E3A8C] hover:text-[#2E3A8C] transition disabled:opacity-50"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        {/* Stat Cards */}
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {statCards.map((card, i) => (
            <StatCard key={i} {...card} index={i} />
          ))}
        </div>

        {/* Charts Row 1 */}
        <div className="mt-8 grid gap-6 xl:grid-cols-3">

          {/* Totalizer per Tank Bar Chart */}
          <div className="xl:col-span-2 border border-slate-200 bg-white p-6 shadow-[0_4px_20px_rgba(15,23,42,0.05)]">
            <div className="mb-6">
              <h3 className="text-xl font-semibold text-slate-900">Totalizer by Tank</h3>
              <p className="mt-1 text-sm text-slate-500">Current totalizer reading across all tanks</p>
            </div>
            {totalizerChartData.length > 0 ? (
              <div className="h-72 rounded border border-slate-100 bg-[#f8fbff] p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={totalizerChartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(v) => [`${v.toLocaleString()} L`, 'Totalizer']} />
                    <Bar dataKey="totalizer" fill="#2E3A8C" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-72 flex items-center justify-center text-slate-400 text-sm border border-slate-100 bg-[#f8fbff]">
                No live data available
              </div>
            )}
          </div>

          {/* Status Pie Chart */}
          <div className="border border-slate-200 bg-white p-6 shadow-[0_4px_20px_rgba(15,23,42,0.05)]">
            <div className="mb-6">
              <h3 className="text-xl font-semibold text-slate-900">Tank Status</h3>
              <p className="mt-1 text-sm text-slate-500">Online / Offline / Inactive distribution</p>
            </div>
            {pieData.length > 0 ? (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="45%" outerRadius={90} label={({ name, value }) => `${name}: ${value}`}>
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i]} />
                      ))}
                    </Pie>
                    <Legend />
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-72 flex items-center justify-center text-slate-400 text-sm">No tanks registered</div>
            )}
          </div>
        </div>

        {/* Flow Rate Chart */}
        <div className="mt-8 border border-slate-200 bg-white p-6 shadow-[0_4px_20px_rgba(15,23,42,0.05)]">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold text-slate-900">Live Flow Rate</h3>
              <p className="mt-1 text-sm text-slate-500">Current flow rate (L/min) across tanks</p>
            </div>
          </div>
          {flowRateChartData.length > 0 ? (
            <div className="h-64 rounded border border-slate-100 bg-[#f8fbff] p-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={flowRateChartData}>
                  <defs>
                    <linearGradient id="flowGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2E3A8C" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#2E3A8C" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v) => [`${v} L/min`, 'Flow Rate']} />
                  <Area type="monotone" dataKey="flowRate" stroke="#2E3A8C" strokeWidth={2.5} fill="url(#flowGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-slate-400 text-sm border border-slate-100 bg-[#f8fbff]">
              No flow rate data available
            </div>
          )}
        </div>

        {/* Tank List Table */}
        <div className="mt-8 border border-slate-200 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.05)]">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">All Tanks</h3>
              <p className="text-sm text-slate-500">Live status overview</p>
            </div>
            <button
              onClick={() => navigate('/admin/tanks')}
              className="text-sm text-[#2E3A8C] font-medium hover:underline"
            >
              Manage Tanks →
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-6 py-3 text-left font-semibold text-slate-600">Tank Name</th>
                  <th className="px-6 py-3 text-left font-semibold text-slate-600">Device ID</th>
                  <th className="px-6 py-3 text-left font-semibold text-slate-600">Location</th>
                  <th className="px-6 py-3 text-left font-semibold text-slate-600">Status</th>
                  <th className="px-6 py-3 text-right font-semibold text-slate-600">Flow Rate</th>
                  <th className="px-6 py-3 text-right font-semibold text-slate-600">Totalizer</th>
                  <th className="px-6 py-3 text-center font-semibold text-slate-600">Action</th>
                </tr>
              </thead>
              <tbody>
                {tanks.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-400">No tanks found</td>
                  </tr>
                ) : (
                  tanks.map((tank) => (
                    <tr key={tank._id} className="border-b border-slate-50 hover:bg-slate-50 transition">
                      <td className="px-6 py-3 font-semibold text-slate-800">{tank.tankName}</td>
                      <td className="px-6 py-3 text-blue-600 font-mono text-xs">{tank.deviceId}</td>
                      <td className="px-6 py-3 text-slate-500">{tank.location}</td>
                      <td className="px-6 py-3">
                        <span
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full"
                          style={{
                            backgroundColor: `${STATUS_COLORS[tank.status]}18`,
                            color: STATUS_COLORS[tank.status],
                          }}
                        >
                          {tank.status === 'online' ? <Wifi size={10} /> : <WifiOff size={10} />}
                          {tank.status.charAt(0).toUpperCase() + tank.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-right text-slate-700">
                        {tank.latestData ? `${tank.latestData.flowRate ?? '-'} L/min` : '—'}
                      </td>
                      <td className="px-6 py-3 text-right text-slate-700">
                        {tank.latestData ? `${tank.latestData.totalizer?.toLocaleString() ?? '-'} L` : '—'}
                      </td>
                      <td className="px-6 py-3 text-center">
                        <button
                          onClick={() => navigate(`/admin/tanks/${tank._id}`)}
                          className="text-xs px-3 py-1.5 bg-[#2E3A8C] text-white rounded hover:bg-[#4F68A4] transition"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
