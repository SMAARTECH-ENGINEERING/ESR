import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ResponsiveContainer, ComposedChart, Area, Line,
  XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from 'recharts';
import { Wifi, WifiOff, MapPin, Cpu, ArrowLeft, RefreshCw, Droplets, Activity, Gauge } from 'lucide-react';
import io from 'socket.io-client';
import api from '../../utils/api';

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

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-4 py-3 text-xs">
      <p className="text-slate-500 font-semibold mb-2">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }} className="font-bold">
          {p.name}: {p.value} {p.name === 'Flow Rate' ? 'L/min' : 'L'}
        </p>
      ))}
    </div>
  );
};

export default function TankDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [tank, setTank] = useState(null);
  const [latestData, setLatestData] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [liveConnected, setLiveConnected] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  const formatHistory = (records) =>
    (records || [])
      .map((r) => ({
        time: new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        flowRate: Number((r.flowRate || 0).toFixed(2)),
        totalizer: r.totalizer || 0,
        waterLevelPercent: r.waterLevelPercent ?? null,
        timestamp: new Date(r.timestamp).getTime(),
      }))
      .sort((a, b) => a.timestamp - b.timestamp);

  const fetchDetail = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch tank info + 24h history in parallel
      const [dashRes, histRes] = await Promise.all([
        api.get(`/dashboard/${id}`),
        api.get(`/iot/history/${id}`, { params: { hours: 24, limit: 288 } }),
      ]);

      const { tank: t, latestData: ld } = dashRes.data.data;
      setTank(t);
      setLatestData(ld);
      setHistory(formatHistory(histRes.data.data || []));
      setLastUpdated(new Date());
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load tank data.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]);

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
      setHistory((prev) => {
        const point = {
          time: new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          flowRate: Number((data.flowRate || 0).toFixed(2)),
          totalizer: data.totalizer || 0,
          waterLevelPercent: data.waterLevelPercent ?? null,
          timestamp: new Date(data.timestamp).getTime(),
        };
        const updated = [...prev, point];
        // keep last 24h worth of data (max 288 points)
        return updated.length > 288 ? updated.slice(-288) : updated;
      });
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
              onClick={fetchDetail}
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
            value={latestData?.flowRate != null ? latestData.flowRate.toFixed(2) : null}
            unit="L/min"
            sub="Live"
            icon={<Droplets size={22} className="text-[#2E3A8C]" />}
            gradient="from-blue-50 to-cyan-100"
            index={0}
          />
          <MetricCard
            label="Totalizer"
            value={latestData?.totalizer != null ? latestData.totalizer.toLocaleString() : null}
            unit="L"
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

        {/* Combined 24h Chart */}
        <div className="mt-8 border border-slate-200 bg-white p-6 shadow-[0_4px_20px_rgba(15,23,42,0.05)]">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold text-slate-900">Today's Overview</h3>
              <p className="text-sm text-slate-500 mt-1">Flow Rate (L/min) & Totalizer (L) — last 24 hours</p>
            </div>
            <span className="text-xs text-slate-400">{history.length} readings</span>
          </div>

          {history.length > 0 ? (
            <div className="h-80 rounded border border-slate-100 bg-[#f8fbff] p-4">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={history}>
                  <defs>
                    <linearGradient id="flowAreaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2E3A8C" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#2E3A8C" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis
                    dataKey="time"
                    tick={{ fill: '#64748b', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    yAxisId="left"
                    tick={{ fill: '#64748b', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    label={{ value: 'L/min', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 10, dx: -4 }}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fill: '#64748b', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    label={{ value: 'L', angle: 90, position: 'insideRight', fill: '#94a3b8', fontSize: 10, dx: 4 }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
                    formatter={(v) => <span className="text-slate-600 font-medium">{v}</span>}
                  />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="flowRate"
                    name="Flow Rate"
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
              <p className="text-sm">No data recorded in the last 24 hours</p>
              <p className="text-xs mt-1">Data appears here once the IoT device sends readings</p>
            </div>
          )}
        </div>

        {/* Recent readings table */}
        {history.length > 0 && (
          <div className="mt-6 border border-slate-200 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.05)]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-base font-semibold text-slate-900">Recent Readings</h3>
              <span className="text-xs text-slate-400">Showing last 20 of {history.length}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="px-6 py-3 text-left font-semibold text-slate-600">Time</th>
                    <th className="px-6 py-3 text-right font-semibold text-slate-600">Flow Rate (L/min)</th>
                    <th className="px-6 py-3 text-right font-semibold text-slate-600">Totalizer (L)</th>
                  </tr>
                </thead>
                <tbody>
                  {[...history].reverse().slice(0, 20).map((r, i) => (
                    <tr key={i} className="border-b border-slate-50 hover:bg-slate-50 transition">
                      <td className="px-6 py-2.5 text-slate-600">{r.time}</td>
                      <td className="px-6 py-2.5 text-right font-semibold text-[#2E3A8C]">{r.flowRate}</td>
                      <td className="px-6 py-2.5 text-right font-semibold text-emerald-600">{r.totalizer?.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
