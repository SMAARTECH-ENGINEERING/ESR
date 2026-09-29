import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { BiSolidDashboard } from 'react-icons/bi';
import { FaUsers, FaChevronDown, FaChevronRight } from 'react-icons/fa';
import { MdCardMembership } from 'react-icons/md';
import { motion, AnimatePresence } from 'framer-motion';
import { Droplets, BarChart2, Calendar, CalendarDays, CalendarRange, User, Radio, Send } from 'lucide-react';
import { decryptData } from '../localStorageUtils';

const cls = {
  active:
    'flex items-center px-4 py-3 mt-1 text-sm font-semibold tracking-wide text-white bg-[#2E3A8C] rounded-lg transition ease-in-out duration-200 cursor-pointer',
  inactive:
    'flex items-center px-4 py-3 mt-1 text-sm font-semibold tracking-wide text-[#49608c] bg-transparent rounded-lg hover:text-white hover:bg-[#4F68A4] transition ease-in-out duration-200 cursor-pointer',
  subActive:
    'flex items-center px-4 py-2.5 mt-0.5 ml-2 text-sm font-medium text-white bg-[#3D4FA0] rounded-lg transition cursor-pointer',
  subInactive:
    'flex items-center px-4 py-2.5 mt-0.5 ml-2 text-sm font-medium text-[#6B85B8] bg-transparent rounded-lg hover:text-white hover:bg-[#4F68A4] transition cursor-pointer',
};

function MenuItem({ item, isActive, isOpen, onToggle, onClick }) {
  const hasChildren = item.children && item.children.length > 0;

  return (
    <div>
      <div
        className={isActive && !hasChildren ? cls.active : cls.inactive}
        onClick={hasChildren ? onToggle : onClick}
      >
        <span className="flex-shrink-0">{item.icon}</span>
        <span className="ml-3 flex-1">{item.label}</span>
        {hasChildren && (
          <span className="ml-auto text-xs opacity-70">
            {isOpen ? <FaChevronDown size={11} /> : <FaChevronRight size={11} />}
          </span>
        )}
      </div>

      {hasChildren && (
        <AnimatePresence initial={false}>
          {isOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              {item.children.map((child) => (
                <SubMenuItem key={child.path} child={child} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}

function SubMenuItem({ child }) {
  const location = useLocation();
  const navigate = useNavigate();
  const isActive = location.pathname === child.path;

  return (
    <div
      className={isActive ? cls.subActive : cls.subInactive}
      onClick={() => navigate(child.path)}
    >
      <span className="flex-shrink-0 opacity-80">{child.icon}</span>
      <span className="ml-3">{child.label}</span>
    </div>
  );
}

// ─── Menu definitions ────────────────────────────────────────────────────────
// `roles` controls which users see each item.
// null / omitted → shown to all authenticated users.
const ALL_MENU_ITEMS = [

  // ── Admin: main dashboard ────────────────────────────────────────────
  {
    label: 'Dashboard',
    path: '/admin/dashboard',
    icon: <BiSolidDashboard size={20} />,
    roles: ['admin'],
  },

  // ── Admin: tank management group (All Tanks + Live Monitor) ──────────
  {
    label: 'Tank Management',
    icon: <Droplets size={20} />,
    roles: ['admin'],
    children: [
      { label: 'All Tanks',    path: '/admin/tanks',  icon: <Droplets size={15} /> },
      { label: 'Live Monitor', path: '/admin/report', icon: <BarChart2 size={15} /> },
    ],
  },

  // ── Control Room: Live Monitoring as a top-level item ────────────────
  {
    label: 'Live Monitoring',
    path: '/admin/report',
    icon: <Radio size={20} />,
    roles: ['control_room'],
  },

  // ── Both roles: Reports group ─────────────────────────────────────────
  {
    label: 'Reports',
    icon: <MdCardMembership size={20} />,
    roles: ['admin', 'control_room'],
    children: [
      { label: 'Daily Report',   path: '/admin/reports/daily',   icon: <Calendar size={15} /> },
      { label: 'Weekly Report',  path: '/admin/reports/weekly',  icon: <CalendarDays size={15} /> },
      { label: 'Monthly Report', path: '/admin/reports/monthly', icon: <CalendarRange size={15} /> },
    ],
  },

  // ── Admin only: user management ────────────────────────────────────────
  {
    label: 'Users',
    path: '/admin/users',
    icon: <FaUsers size={20} />,
    roles: ['admin'],
  },

  // ── Admin only: IWCRCM government reporting status ────────────────────
  {
    label: 'IWCRCM',
    path: '/admin/iwcrcm',
    icon: <Send size={20} />,
    roles: ['admin'],
  },

  // ── Both roles: profile ────────────────────────────────────────────────
  {
    label: 'My Profile',
    path: '/admin/profile',
    icon: <User size={20} />,
    roles: ['admin', 'control_room'],
  },
];

// ─── Component ───────────────────────────────────────────────────────────────
const SidebarsContent = () => {
  const navigate  = useNavigate();
  const location  = useLocation();

  // Read user role from encrypted localStorage
  const userData  = decryptData();
  const role      = userData?.user?.role;

  // Filter menu items for this role
  const menuItems = ALL_MENU_ITEMS.filter(
    (item) => !item.roles || item.roles.includes(role)
  );

  // Auto-open parent if a child is currently active
  const getInitialOpen = () => {
    const open = {};
    menuItems.forEach((item) => {
      if (item.children) {
        const isChildActive = item.children.some((c) => location.pathname.startsWith(c.path));
        if (isChildActive) open[item.label] = true;
      }
    });
    return open;
  };

  const [openMenus, setOpenMenus] = useState(getInitialOpen);

  useEffect(() => {
    setOpenMenus(getInitialOpen());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const toggleMenu = (label) => {
    setOpenMenus((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  const isParentActive = (item) =>
    item.path
      ? location.pathname === item.path
      : item.children?.some((c) => location.pathname.startsWith(c.path));

  return (
    <div className="mt-2">
      {/* Role badge */}
      {/* {role === 'control_room' && (
        <div className="mb-4 mx-2 px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-xs font-semibold text-blue-700 flex items-center gap-2">
          <Radio size={13} className="text-blue-500 animate-pulse" />
          Control Room Operator
        </div>
      )} */}

      {menuItems.map((item) => (
        <MenuItem
          key={item.label}
          item={item}
          isActive={isParentActive(item)}
          isOpen={!!openMenus[item.label]}
          onToggle={() => toggleMenu(item.label)}
          onClick={() => item.path && navigate(item.path)}
        />
      ))}
    </div>
  );
};

export default SidebarsContent;
