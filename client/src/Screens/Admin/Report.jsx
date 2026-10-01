import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Wifi, WifiOff, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import SkeletonCard from '../../Components/Admin/SkeletonCard';
import api from '../../utils/api';
import { FLOW_UNIT, VOLUME_UNIT, fmtFlow, fmtVolume } from '../../utils/units';

const STATUS_STYLES = {
  online: { dot: 'bg-emerald-500', text: 'text-emerald-600', badge: 'bg-emerald-50 border-emerald-200' },
  offline: { dot: 'bg-red-500', text: 'text-red-600', badge: 'bg-red-50 border-red-200' },
  inactive: { dot: 'bg-slate-400', text: 'text-slate-500', badge: 'bg-slate-50 border-slate-200' },
};

function TankCard({ tank, onClick }) {
  const status = tank.status || 'inactive';
  const style = STATUS_STYLES[status] || STATUS_STYLES.inactive;

  return (
    <motion.div
      whileHover={{ scale: 1.03, y: -4 }}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden cursor-pointer hover:shadow-md hover:border-[#2E3A8C]/30 transition-all duration-200"
    >
      {/* Color header bar based on status */}
      <div className={`h-1.5 w-full ${status === 'online' ? 'bg-emerald-500' : status === 'offline' ? 'bg-red-400' : 'bg-slate-300'}`} />

      <div className="p-4">
        {/* Status badge */}
        <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-semibold mb-3 ${style.badge} ${style.text}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${style.dot} ${status === 'online' ? 'animate-pulse' : ''}`} />
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </div>

        {/* Tank name */}
        <h3 className="text-sm font-bold text-slate-800 truncate mb-1">{tank.tankName}</h3>

        {/* Location */}
        <p className="text-xs text-slate-500 flex items-center gap-1 mb-3">
          <MapPin size={11} className="flex-shrink-0" />
          <span className="truncate">{tank.location}</span>
        </p>

        {/* Live data row */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="bg-blue-50 rounded-lg p-2 text-center">
            <p className="text-[10px] text-blue-500 font-medium uppercase tracking-wide">Flow Rate</p>
            <p className="text-sm font-bold text-blue-700">
              {tank.latestData?.flowRate != null ? `${fmtFlow(tank.latestData.flowRate)} ${FLOW_UNIT}` : '—'}
            </p>
          </div>
          <div className="bg-emerald-50 rounded-lg p-2 text-center">
            <p className="text-[10px] text-emerald-500 font-medium uppercase tracking-wide">Totalizer</p>
            <p className="text-sm font-bold text-emerald-700">
              {tank.latestData?.totalizer != null ? `${fmtVolume(tank.latestData.totalizer)} ${VOLUME_UNIT}` : '—'}
            </p>
          </div>
          <div className="bg-amber-50 rounded-lg p-2 text-center">
            <p className="text-[10px] text-amber-600 font-medium uppercase tracking-wide">Level</p>
            <p className="text-sm font-bold text-amber-700">
              {tank.latestData?.waterLevelPercent != null ? `${tank.latestData.waterLevelPercent}%` : '—'}
            </p>
          </div>
        </div>

        {/* Device ID + View button */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-slate-400 font-mono truncate">{tank.deviceId}</span>
          <button
            onClick={(e) => { e.stopPropagation(); onClick(); }}
            className="text-[11px] px-3 py-1 bg-[#2E3A8C] text-white rounded-lg hover:bg-[#4F68A4] transition font-semibold flex items-center gap-1"
          >
            {status === 'online' ? <Wifi size={10} /> : <WifiOff size={10} />}
            View
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function Report() {
  const navigate = useNavigate();
  const [tanks, setTanks] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    const fetchTanks = async () => {
      try {
        setLoading(true);
        const res = await api.get('/dashboard');
        setTanks(res.data.data?.tanks || []);
      } catch {
        setTanks([]);
      } finally {
        setLoading(false);
      }
    };
    fetchTanks();
    const interval = setInterval(fetchTanks, 30000);
    return () => clearInterval(interval);
  }, []);

  const filtered = useMemo(() => {
    return tanks.filter((t) => {
      const matchSearch =
        !search ||
        t.tankName?.toLowerCase().includes(search.toLowerCase()) ||
        t.location?.toLowerCase().includes(search.toLowerCase()) ||
        t.deviceId?.toLowerCase().includes(search.toLowerCase());
      const matchStatus = !statusFilter || t.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [tanks, search, statusFilter]);

  const counts = useMemo(() => ({
    total: tanks.length,
    online: tanks.filter((t) => t.status === 'online').length,
    offline: tanks.filter((t) => t.status === 'offline').length,
    inactive: tanks.filter((t) => t.status === 'inactive').length,
  }), [tanks]);

  return (
    <div className="min-h-screen bg-[#f5f7fb] p-6">

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Live Monitor</h1>
        <p className="text-sm text-slate-500 mt-1">Click any tank card to view real-time flow rate and daily graph</p>
      </div>

      {/* Summary pills */}
      <div className="flex flex-wrap gap-2 mb-5">
        {[
          { label: 'All', value: '', count: counts.total, color: 'bg-slate-100 text-slate-700 border-slate-200' },
          { label: 'Online', value: 'online', count: counts.online, color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
          { label: 'Offline', value: 'offline', count: counts.offline, color: 'bg-red-50 text-red-700 border-red-200' },
          { label: 'Inactive', value: 'inactive', count: counts.inactive, color: 'bg-slate-50 text-slate-500 border-slate-200' },
        ].map((pill) => (
          <button
            key={pill.label}
            onClick={() => setStatusFilter(pill.value)}
            className={`px-3 py-1.5 rounded-full border text-xs font-semibold transition ${pill.color} ${statusFilter === pill.value ? 'ring-2 ring-[#2E3A8C] ring-offset-1' : ''}`}
          >
            {pill.label} ({pill.count})
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="flex items-center bg-white border border-slate-200 rounded-lg px-3 py-2.5 w-full max-w-sm mb-6 shadow-sm">
        <Search size={15} className="text-slate-400 mr-2 flex-shrink-0" />
        <input
          type="text"
          placeholder="Search tank, location, device..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="outline-none w-full text-sm text-slate-700 bg-transparent placeholder:text-slate-400"
        />
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {loading
          ? Array.from({ length: 10 }).map((_, i) => <SkeletonCard key={i} />)
          : filtered.map((tank) => (
              <TankCard
                key={tank._id}
                tank={tank}
                onClick={() => navigate(`/admin/tanks/${tank._id}`)}
              />
            ))}
      </div>

      {!loading && filtered.length === 0 && (
        <div className="text-center py-20 text-slate-400 text-sm">
          No tanks match your search.
        </div>
      )}
    </div>
  );
}

export default Report;
