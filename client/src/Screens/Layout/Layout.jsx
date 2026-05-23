import React, { useEffect, useState } from 'react';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import Footer from './Footer';

const Layout = ({ children }) => {
  const [isSidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 768);
  const [isSmallScreen, setIsSmallScreen] = useState(window.innerWidth < 768);

  const toggleSidebar = () => {
    setSidebarOpen(!isSidebarOpen);
  };

  useEffect(() => {
    const handleResize = () => {
      const isBelow768 = window.innerWidth < 768;
      setIsSmallScreen(isBelow768);
      setSidebarOpen(!isBelow768); // Initially open only if above 768px
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="flex bg-[#f2f6fc] min-h-screen">
      <Sidebar isOpen={isSidebarOpen} toggleSidebar={toggleSidebar} />
      <div
        className={`flex-1 transform transition-transform duration-300 ${
          isSidebarOpen && !isSmallScreen ? 'ml-[17rem] mr-[15px]' : 'mx-[15px]'
        }`}
      >
        <Navbar toggleSidebar={toggleSidebar} />
        <main className="py-4 mt-4">{children}</main>
        <Footer />
      </div>
    </div>
  );
};

export default Layout;