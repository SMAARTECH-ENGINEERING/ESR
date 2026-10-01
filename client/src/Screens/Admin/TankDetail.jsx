import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ResponsiveContainer, ComposedChart, Area, Line,
  XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from 'recharts';
import { Wifi, WifiOff, MapPin, Cpu, ArrowLeft, RefreshCw, Droplets, Activity, Gauge } from 'lucide-react';
import io from 'socket.io-client';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import api from '../../utils/api';
import { FLOW_UNIT, VOLUME_UNIT, toM3h, toM3, fmtFlow, fmtVolume } from '../../utils/units';
import ReadingsTable from '../../Components/Admin/ReadingsTable';

const RANGES = [
  { key: 'day',     label: '1 Day' },
  { key: 'week',    label: '1 Week' },
  { key: 'month',   label: '1 Month' },
  { key: '4months', label: '4 Months' },
  { key: 'custom',  label: 'Custom' },
];

const RANGE_TITLE = {
  day: 'Last 24 hours', week: 'Last 7 days', month: 'Last 30 days', '4months': 'Last 4 months',
};

const todayInput = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// Axis label detail depends on bucket size
const formatBucket = (t, bucketMinutes) => {
  const d = new Date(t);
  if (bucketMinutes <= 5) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (bucketMinutes <= 30) return d.toLocaleString([], { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  if (bucketMinutes <= 120) return d.toLocaleString([], { day: '2-digit', month: 'short', hour: '2-digit' });
  return d.toLocaleDateString([], { day: '2-digit', month: 'short' });
};

const STATUS_BG = {
  online: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  offline: 'bg-red-50 text-red-700 border-red-200',
  inactive: 'bg-slate-50 text-slate-500 border-slate-200',
};

function MetricCard({ label, value, unit, sub, icon, gradient, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07 }}
      className={`border border-slate-200/80 bg-gradient-to-br ${gradient} p-6 shadow-[0_4px_20px_rgba(15,23,42,0.06)] group transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_28px_rgba(15,23,42,0.1)]`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-white/70 shadow-sm">
          {icon}
        </div>
        {sub && (
          <span className="text-xs font-semibold text-slate-500 bg-white/70 px-2 py-1 rounded-full border border-white/80">
            {sub}
          </span>
        )}
      </div>
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1">{label}</p>
      <p className="text-4xl font-black text-slate-900 tracking-tight">
        {value ?? '—'}
        {value != null && <span className="ml-1.5 text-lg font-medium text-slate-400">{unit}</span>}
      </p>
    </motion.div>
  );
}

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-4 py-3 text-xs space-y-0.5">
      <p className="text-slate-500 font-semibold mb-1.5">{new Date(p.t).toLocaleString()}</p>
      <p className="font-bold text-[#2E3A8C]">Avg Flow: {p.flowAvg ?? '—'} {FLOW_UNIT}</p>
      <p className="text-slate-500">Max Flow: {p.flowMax ?? '—'} {FLOW_UNIT}</p>
      <p className="font-bold text-emerald-600">Totalizer: {p.totalizer?.toLocaleString() ?? '—'} {VOLUME_UNIT}</p>
      {p.level != null && <p className="text-amber-600">Water Level: {p.level}%</p>}
      <p className="text-slate-400">{p.count} reading{p.count === 1 ? '' : 's'}</p>
    </div>
  );
};

export default function TankDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [tank, setTank] = useState(null);
  const [latestData, setLatestData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [liveConnected, setLiveConnected] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Chart range
  const [range, setRange] = useState('day');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState(todayInput());
  const [appliedCustom, setAppliedCustom] = useState(null);
  const [chart, setChart] = useState({ points: [], bucketMinutes: 5 });
  const [chartLoading, setChartLoading] = useState(false);
  const [chartError, setChartError] = useState(null);
  const lastChartFetch = useRef(0);

  const fetchDetail = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const dashRes = await api.get(`/dashboard/${id}`);
      const { tank: t, latestData: ld } = dashRes.data.data;
      setTank(t);
      setLatestData(ld);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load tank data.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]);

  const fetchChart = useCallback(async ({ silent = false } = {}) => {
    if (range === 'custom' && !appliedCustom) return;
    try {
      if (!silent) setChartLoading(true);
      setChartError(null);
      const params = range === 'custom'
        ? {
          from: new Date(`${appliedCustom.from}T00:00:00`).toISOString(),
          to: new Date(`${appliedCustom.to}T23:59:59.999`).toISOString(),
        }
        : { range };
      params.tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const res = await api.get(`/iot/chart/${id}`, { params });
      const { points, bucketMinutes } = res.data.data;
      setChart({
        bucketMinutes,
        points: points.map((p) => ({
          ...p,
          flowAvg: toM3h(p.flowAvg),
          flowMax: toM3h(p.flowMax),
          totalizer: toM3(p.totalizer),
          label: formatBucket(p.t, bucketMinutes),
        })),
      });
      lastChartFetch.current = Date.now();
    } catch (err) {
      setChartError(err?.response?.data?.errors?.join(', ') || err?.response?.data?.message || 'Failed to load chart.');
    } finally {
      if (!silent) setChartLoading(false);
    }
  }, [id, range, appliedCustom]);

  useEffect(() => { fetchChart(); }, [fetchChart]);

  // Keep the live chart fresh without reloading on every single reading
  const fetchChartRef = useRef(fetchChart);
  fetchChartRef.current = fetchChart;
  const rangeRef = useRef(range);
  rangeRef.current = range;

  const applyCustomRange = () => {
    if (!customFrom || !customTo) return setChartError('Select both From and To dates.');
    if (customFrom > customTo) return setChartError('"From" date must be before "To" date.');
    const days = (new Date(customTo) - new Date(customFrom)) / 86400000 + 1;
    if (days > 120) return setChartError('Custom range can be at most 120 days.');
    setAppliedCustom({ from: customFrom, to: customTo });
    return undefined;
  };

  // Socket.IO — real-time updates
  useEffect(() => {
    if (!id) return;
    const socket = io(process.env.REACT_APP_API_URL || '', { transports: ['websocket'] });

    socket.on('connect', () => {
      setLiveConnected(true);
      socket.emit('subscribe:tank', id);
    });
    socket.on('disconnect', () => setLiveConnected(false));

    socket.on('tank:data', (data) => {
      if (data.tankId !== id) return;
      setLatestData({
        flowRate: data.flowRate,
        totalizer: data.totalizer,
        waterLevelPercent: data.waterLevelPercent,
        timestamp: data.timestamp,
      });
      setLastUpdated(new Date());
      // 1-day view: refresh the chart at most once a minute
      if (rangeRef.current === 'day' && Date.now() - lastChartFetch.current > 60000) {
        fetchChartRef.current({ silent: true });
      }
      setTank((prev) => prev ? { ...prev, status: data.status, lastSeen: data.lastSeen } : prev);
    });

    socket.on('tank:status', (data) => {
      if (data.tankId !== id) return;
      setTank((prev) => prev ? { ...prev, status: data.status } : prev);
    });

    return () => {
      socket.emit('unsubscribe:tank', id);
      socket.disconnect();
    };
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f7fb] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <svg className="animate-spin h-8 w-8 text-[#2E3A8C]" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
          <p className="text-sm font-medium">Loading tank data...</p>
        </div>
      </div>
    );
  }

  if (error || !tank) {
    return (
      <div className="min-h-screen bg-[#f5f7fb] flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 font-medium mb-4">{error || 'Tank not found.'}</p>
          <button onClick={() => navigate(-1)} className="text-sm text-[#2E3A8C] hover:underline flex items-center gap-1 mx-auto">
            <ArrowLeft size={14} /> Go Back
          </button>
        </div>
      </div>
    );
  }

  const status = tank.status || 'inactive';

  return (
    <div className="min-h-screen bg-[#f5f7fb] p-6">
      <ToastContainer position="top-right" autoClose={3000} />
      <div className="mx-auto w-full">

        {/* Header */}
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            {/* <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-1 text-sm text-slate-500 hover:text-[#2E3A8C] mb-2 transition"
            >
              <ArrowLeft size={14} /> Back
            </button> */}
            <h1 className="text-2xl font-bold text-slate-900">{tank.tankName}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-3 text-sm text-slate-500">
              <span className="flex items-center gap-1"><MapPin size={13} /> {tank.location}</span>
              <span className="flex items-center gap-1"><Cpu size={13} /> {tank.deviceId}</span>
            </div>
            {lastUpdated && (
              <p className="text-xs text-slate-400 mt-1">Last updated: {lastUpdated.toLocaleTimeString()}</p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Live pulse */}
            <span className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border ${liveConnected ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
              <span className={`w-2 h-2 rounded-full ${liveConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
              {liveConnected ? 'Live' : 'Disconnected'}
            </span>

            {/* Status */}
            <span className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border ${STATUS_BG[status]}`}>
              {status === 'online' ? <Wifi size={11} /> : <WifiOff size={11} />}
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </span>

            <button
              onClick={() => { fetchDetail(); fetchChart(); }}
              className="flex items-center gap-1.5 border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600 rounded-lg hover:border-[#2E3A8C] hover:text-[#2E3A8C] transition"
            >
              <RefreshCw size={13} /> Refresh
            </button>
          </div>
        </div>

        {/* 3 Metric Cards */}
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          <MetricCard
            label="Flow Rate"
            value={fmtFlow(latestData?.flowRate)}
            unit={FLOW_UNIT}
            sub="Live"
            icon={<Droplets size={22} className="text-[#2E3A8C]" />}
            gradient="from-blue-50 to-cyan-100"
            index={0}
          />
          <MetricCard
            label="Totalizer"
            value={fmtVolume(latestData?.totalizer)}
            unit={VOLUME_UNIT}
            sub="Cumulative"
            icon={<Activity size={22} className="text-emerald-600" />}
            gradient="from-emerald-50 to-green-100"
            index={1}
          />
          <MetricCard
            label="Water Level"
            value={latestData?.waterLevelPercent != null ? Number(latestData.waterLevelPercent).toFixed(1) : null}
            unit="%"
            sub="Transmitter"
            icon={<Gauge size={22} className="text-amber-600" />}
            gradient="from-amber-50 to-orange-100"
            index={2}
          />
        </div>

        {/* Flow / Totalizer chart with selectable range */}
        <div className="mt-8 border border-slate-200 bg-white p-6 shadow-[0_4px_20px_rgba(15,23,42,0.05)]">
          <div className="mb-5 flex flex-col xl:flex-row xl:items-start justify-between gap-4">
            <div>
              <h3 className="text-xl font-semibold text-slate-900">Flow & Totalizer</h3>
              <p className="text-sm text-slate-500 mt-1">
                {range === 'custom'
                  ? (appliedCustom ? `${new Date(appliedCustom.from).toLocaleDateString()} – ${new Date(appliedCustom.to).toLocaleDateString()}` : 'Pick a date range')
                  : RANGE_TITLE[range]}
                {' · '}
                {chart.bucketMinutes < 60 ? `${chart.bucketMinutes}-minute` : `${chart.bucketMinutes / 60}-hour`} averages
              </p>
            </div>

            <div className="flex flex-col items-start xl:items-end gap-2">
              <div className="inline-flex flex-wrap rounded-lg border border-slate-300 overflow-hidden">
                {RANGES.map((r) => (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => { setChartError(null); setRange(r.key); }}
                    className={`px-4 py-1.5 text-sm font-semibold transition border-r border-slate-300 last:border-r-0 ${
                      range === r.key ? 'bg-[#2E3A8C] text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>

              {range === 'custom' && (
                <div className="flex flex-wrap items-end gap-2">
                  <div>
                    <label className="block text-xs text-slate-500 mb-0.5">From</label>
                    <input type="date" value={customFrom} max={customTo || todayInput()} onChange={(e) => setCustomFrom(e.target.value)}
                      className="text-sm border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#2E3A8C]" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-0.5">To</label>
                    <input type="date" value={customTo} min={customFrom} max={todayInput()} onChange={(e) => setCustomTo(e.target.value)}
                      className="text-sm border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#2E3A8C]" />
                  </div>
                  <button type="button" onClick={applyCustomRange}
                    className="bg-[#2E3A8C] text-white px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-[#4F68A4] transition">
                    Apply
                  </button>
                </div>
              )}
            </div>
          </div>

          {chartError && <p className="mb-3 text-sm text-red-500">{chartError}</p>}

          {chartLoading ? (
            <div className="h-80 flex items-center justify-center text-slate-400 border border-slate-100 bg-[#f8fbff] rounded">
              <RefreshCw size={22} className="animate-spin" />
            </div>
          ) : chart.points.length > 0 ? (
            <div className="h-80 rounded border border-slate-100 bg-[#f8fbff] p-4">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chart.points}>
                  <defs>
                    <linearGradient id="flowAreaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2E3A8C" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#2E3A8C" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: '#64748b', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                    minTickGap={24}
                  />
                  <YAxis
                    yAxisId="left"
                    tick={{ fill: '#64748b', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    label={{ value: FLOW_UNIT, angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 10, dx: -4 }}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fill: '#64748b', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    label={{ value: VOLUME_UNIT, angle: 90, position: 'insideRight', fill: '#94a3b8', fontSize: 10, dx: 4 }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
                    formatter={(v) => <span className="text-slate-600 font-medium">{v}</span>}
                  />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="flowAvg"
                    name="Flow Rate (avg)"
                    stroke="#2E3A8C"
                    strokeWidth={2.5}
                    fill="url(#flowAreaGrad)"
                    dot={false}
                    activeDot={{ r: 5, fill: '#2E3A8C' }}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="totalizer"
                    name="Totalizer"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 5, fill: '#10b981' }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-80 flex flex-col items-center justify-center text-slate-400 border border-slate-100 bg-[#f8fbff] rounded">
              <Activity size={32} className="mb-3 opacity-30" />
              <p className="text-sm">No readings in this period</p>
              <p className="text-xs mt-1">Try a longer range, or check that the device is sending data</p>
            </div>
          )}
        </div>

        {/* All readings for this tank — paginated, date filter, export */}
        <div className="mt-6">
          <ReadingsTable tankId={id} title={`${tank.tankName} — Readings`} />
        </div>

      </div>
    </div>
  );
}
