import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, AlertTriangle, CheckCircle2, Send, RotateCcw } from 'lucide-react';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import api from '../../utils/api';

// Admin view of the IWCRCM (government reporting) integration.
// The API returns only statuses and expiry times — never auth keys.

const STATUS_BADGE = {
  SUCCESS: 'bg-emerald-100 text-emerald-700',
  PENDING: 'bg-amber-100 text-amber-700',
  SENT: 'bg-blue-100 text-blue-700',
  FAILED: 'bg-red-100 text-red-700',
};

const fmt = (d) => (d ? new Date(d).toLocaleString() : '—');

export default function IwcrcmStatus() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const res = await api.get('/iwcrcm/status');
      setData(res.data.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load IWCRCM status.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 60000);
    return () => clearInterval(interval);
  }, []);

  const action = async (url, body, success) => {
    try {
      setBusy(true);
      const res = await api.post(url, body);
      toast.success(res.data.message || success);
      fetchStatus();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed.');
    } finally {
      setBusy(false);
    }
  };

  const devices = data?.devices || [];

  return (
    <div className="min-h-screen bg-[#f5f7fb]">
      <ToastContainer position="top-right" autoClose={3000} />

      <div className="sticky top-0 md:top-24 z-10 backdrop-blur-xl bg-white/80 border-b border-gray-200 shadow-sm">
        <div className="w-full mx-auto px-4 py-3 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900">IWCRCM Integration</h1>
            <p className="text-xs text-slate-500">
              {data
                ? `${data.enabled ? 'Enabled' : 'Disabled'} · every ${data.sendIntervalMinutes} min · next run ${fmt(data.nextScheduledAt)}`
                : 'Industrial Water Consumption and Revenue Monitoring'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <motion.button whileHover={{ scale: 1.03 }} onClick={fetchStatus} disabled={loading}
              className="flex items-center gap-1.5 bg-white text-slate-700 px-3 py-2 rounded-lg text-xs border border-slate-200 disabled:opacity-60">
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
            </motion.button>
            <motion.button whileHover={{ scale: 1.03 }} onClick={() => action('/iwcrcm/retry-failed', {}, 'Re-queued')} disabled={busy}
              className="flex items-center gap-1.5 bg-amber-50 text-amber-700 px-3 py-2 rounded-lg text-xs border border-amber-200 disabled:opacity-60">
              <RotateCcw size={13} /> Retry failed
            </motion.button>
            <motion.button whileHover={{ scale: 1.03 }} onClick={() => action('/iwcrcm/run', null, 'Run complete')} disabled={busy || !data?.enabled}
              className="flex items-center gap-1.5 bg-[#2E3A8C] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#4F68A4] transition disabled:opacity-60">
              <Send size={13} /> Run now
            </motion.button>
          </div>
        </div>
      </div>

      <div className="w-full mx-auto mt-6 space-y-4">
        {data && !data.enabled && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-600">
            IWCRCM integration is disabled. Set <code className="font-mono">IWCRCM_ENABLED=true</code> on the server to start queueing readings.
          </div>
        )}

        {data?.enabled && !data.configReady && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-800">
              <AlertTriangle size={16} /> Configuration incomplete — readings are queued but not sent
            </div>
            <ul className="mt-2 ml-6 list-disc text-xs text-amber-800 space-y-1">
              {data.configIssues.map((issue) => <li key={issue}>{issue}</li>)}
            </ul>
          </div>
        )}

        {data?.enabled && data.configReady && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-2 text-sm text-emerald-800">
            <CheckCircle2 size={16} /> Configuration complete
          </div>
        )}

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-xl shadow-md overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                {['Tank', 'IWCRCM Device ID', 'Status', 'Last Success', 'Last Attempt', 'Auth Expires', 'Pending', 'Failed', 'Next Transmission'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-semibold whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {devices.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-slate-400 text-sm">
                    {loading ? 'Loading…' : 'No tanks have an IWCRCM device ID yet. Add one from Tank Management → Edit.'}
                  </td>
                </tr>
              )}
              {devices.map((d) => (
                <tr key={d.tankId} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-800">{d.tankName}</div>
                    <div className="font-mono text-xs text-slate-400">{d.localDeviceId}</div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-blue-600">
                    {d.iwcrcmDeviceId}
                    {!d.enabled && <span className="ml-2 text-slate-400">(off)</span>}
                  </td>
                  <td className="px-4 py-3">
                    {d.lastStatus
                      ? <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${STATUS_BADGE[d.lastStatus] || ''}`}>{d.lastStatus}</span>
                      : <span className="text-xs text-slate-400">—</span>}
                    {d.lastError && <div className="mt-1 text-xs text-red-500 max-w-xs truncate" title={d.lastError}>{d.lastError}</div>}
                    {d.lastAuthError && <div className="mt-1 text-xs text-red-500 max-w-xs truncate" title={d.lastAuthError}>Auth: {d.lastAuthError}</div>}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{fmt(d.lastSuccessAt)}</td>
                  <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{fmt(d.lastAttemptAt)}</td>
                  <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{fmt(d.authExpiresAt)}</td>
                  <td className="px-4 py-3 text-xs text-slate-700">{d.pending}{d.retrying > 0 && <span className="text-amber-600"> ({d.retrying} retrying)</span>}</td>
                  <td className="px-4 py-3 text-xs text-slate-700">{d.failed}{d.authFailures > 0 && <span className="text-red-500"> / {d.authFailures} auth</span>}</td>
                  <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{fmt(d.nextScheduledAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      </div>
    </div>
  );
}
