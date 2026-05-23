import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaExclamationTriangle,
  FaCheckCircle,
  FaInfoCircle,
} from "react-icons/fa";
import { IoClose } from "react-icons/io5";

const getIcon = (type) => {
  switch (type) {
    case "critical":
      return <FaExclamationTriangle className="text-red-500" />;
    case "warning":
      return <FaExclamationTriangle className="text-yellow-500" />;
    case "success":
      return <FaCheckCircle className="text-green-500" />;
    default:
      return <FaInfoCircle className="text-blue-500" />;
  }
};

const bgColor = (type) => {
  switch (type) {
    case "critical":
      return "border-red-200 bg-red-50";
    case "warning":
      return "border-yellow-200 bg-yellow-50";
    case "success":
      return "border-green-200 bg-green-50";
    default:
      return "border-blue-200 bg-blue-50";
  }
};

const NotificationPanel = ({ open, setOpen, notifications }) => {
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Overlay */}
          <motion.div
            className="fixed z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          />

          {/* Right Sidebar */}
          <motion.div
            initial={{ x: 400 }}
            animate={{ x: 0 }}
            exit={{ x: 400 }}
            transition={{ type: "spring", stiffness: 260, damping: 25 }}
            className="fixed top-0 right-0 h-full w-96 bg-white shadow-2xl z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold text-gray-700">
                Notifications
              </h2>

              <IoClose
                size={22}
                className="cursor-pointer hover:text-red-500"
                onClick={() => setOpen(false)}
              />
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={`p-4 border-b flex gap-3 ${bgColor(n.type)}`}
                >
                  <div className="mt-1">{getIcon(n.type)}</div>

                  <div>
                    <p className="font-medium text-sm">{n.title}</p>
                    <p className="text-xs text-gray-600">{n.message}</p>
                    <span className="text-[10px] text-gray-400">{n.time}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="p-3 border-t text-center text-xs text-blue-600 cursor-pointer hover:underline">
              View all notifications
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default NotificationPanel;
