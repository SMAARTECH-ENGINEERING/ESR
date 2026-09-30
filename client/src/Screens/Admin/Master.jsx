import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import ReadingsTable from '../../Components/Admin/ReadingsTable';

// All device readings — filter by tank and date, server-side pagination, export
function Master() {
  return (
    <div className="min-h-screen bg-[#f5f7fb]">
      <ToastContainer position="top-right" autoClose={3000} />

      <div className="sticky top-0 md:top-24 z-10 backdrop-blur-xl bg-white/80 border-b border-gray-200 shadow-sm">
        <div className="w-full mx-auto px-4 py-3">
          <h1 className="text-xl font-bold text-slate-900">All Readings</h1>
          <p className="text-xs text-slate-500">Every reading received from your tank devices</p>
        </div>
      </div>

      <div className="w-full mx-auto mt-6">
        <ReadingsTable title="Device Readings" />
      </div>
    </div>
  );
}

export default Master;
