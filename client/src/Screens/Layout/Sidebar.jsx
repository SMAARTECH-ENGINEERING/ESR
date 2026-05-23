import React from 'react';
import './Sidebar.css';
import SidebarsContent from './SidebarsContent';
import { AiOutlineClose } from 'react-icons/ai';

// Import your image
import logo from '../../Assets/Logos/logo1.webp'; // change path according to your folder structure

const Sidebar = ({ isOpen, toggleSidebar }) => {
  return (
    <React.Fragment>
      <div
        className={`scroll-container overflow-y-auto left-0 w-64 bg-white shadow fixed inset-y-0 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } py-8 px-6`}
        style={{ zIndex: 50 }}
      >
        {/* Close Button */}
        <div className="flex justify-between items-center px-4 mb-5">
          <div className="flex items-center">
            <img
              src={logo}
              alt="SEPL Logo"
              className="w-10 h-10 object-contain"
            />

            <div className="text-2xl font-bold ml-2 text-[#2E3A8C]">
              SEPL
            </div>
          </div>

          <button
            onClick={toggleSidebar}
            className="text-gray-600 hover:text-[#2E3A8C] transition duration-300"
          >
            <AiOutlineClose size={24} />
          </button>
        </div>

        <SidebarsContent />
      </div>
    </React.Fragment>
  );
};

export default Sidebar;