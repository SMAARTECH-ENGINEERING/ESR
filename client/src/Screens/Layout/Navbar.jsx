import React, { useEffect, useState } from 'react';
import { AiOutlineMenuUnfold } from 'react-icons/ai';
import { MdMarkEmailUnread } from 'react-icons/md';
import { FiSearch } from 'react-icons/fi';

import AdminProfileDropDown from '../../Components/Admin/AdminProfileDropDown';
import NotificationBell from '../../Components/Admin/Notifications/NotificationBell';

const Navbar = ({ toggleSidebar }) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [messages] = useState(2);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="w-full h-16 bg-white flex items-center text-[#49608c] shadow-md border border-gray-100 z-50 sticky top-4 px-4 ">

      {/* Sidebar Toggle */}
      <AiOutlineMenuUnfold
        className="cursor-pointer mr-4 hover:text-[#2E3A8C] transition"
        onClick={toggleSidebar}
        size={25}
      />

      {/* Search Bar */}
      <div className="hidden md:flex items-center bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 w-[320px] focus-within:border-blue-400 transition">
        <FiSearch className="text-gray-400 mr-2" size={18} />

        <input
          type="text"
          placeholder="Search tanks, reports..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-transparent outline-none text-sm w-full text-gray-700 placeholder:text-gray-400"
        />
      </div>

      {/* Time */}
      <div className="hidden lg:flex items-center ml-4 text-sm font-medium">
        <span className="bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-lg">
          ⏰ {currentTime.toLocaleTimeString()}
        </span>
      </div>

      {/* Right Side */}
      <div className="ml-auto flex items-center gap-5">

        {/* Notifications */}
        <NotificationBell />

        {/* Messages */}
        <div className="relative cursor-pointer hover:text-[#2E3A8C] transition">
          <MdMarkEmailUnread size={24} />

          {messages > 0 && (
            <span className="absolute -top-2 -right-2 bg-green-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-pulse">
              {messages}
            </span>
          )}
        </div>

        {/* Profile */}
        <AdminProfileDropDown />
      </div>
    </div>
  );
};

export default Navbar;