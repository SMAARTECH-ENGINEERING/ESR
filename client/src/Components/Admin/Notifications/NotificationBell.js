import React, { useState } from "react";
import { IoMdNotifications } from "react-icons/io";
import NotificationPanel from "./NotificationPanel";
import { notificationsData } from "./notificationData";

const NotificationBell = () => {
  const [open, setOpen] = useState(false);

  const unreadCount = notificationsData.length;

  return (
    <div className="relative">
      {/* Bell */}
      <div
        className="relative cursor-pointer hover:text-[#2E3A8C] transition"
        onClick={() => setOpen(true)}
      >
        <IoMdNotifications size={24} />

        {unreadCount > 0 && (
          <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-pulse">
            {unreadCount}
          </span>
        )}
      </div>

      {/* Drawer */}
      <NotificationPanel
        open={open}
        setOpen={setOpen}
        notifications={notificationsData}
      />
    </div>
  );
};

export default NotificationBell;