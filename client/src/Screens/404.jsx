import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#f5f7fb] flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center max-w-md"
      >
        <div className="text-9xl font-black text-[#2E3A8C]/10 select-none leading-none mb-4">
          404
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Page Not Found</h1>
        <p className="text-slate-500 text-sm mb-8">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 border border-slate-300 bg-white text-slate-700 px-5 py-2.5 rounded-lg text-sm font-medium hover:border-[#2E3A8C] hover:text-[#2E3A8C] transition"
          >
            <ArrowLeft size={15} /> Go Back
          </button>
          <button
            onClick={() => navigate('/admin/dashboard')}
            className="flex items-center gap-2 bg-[#2E3A8C] text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#4F68A4] transition"
          >
            <Home size={15} /> Dashboard
          </button>
        </div>
      </motion.div>
    </div>
  );
}
