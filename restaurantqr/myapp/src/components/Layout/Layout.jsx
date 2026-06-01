import Sidebar from './Sidebar';
import Header from './Header';

import { useState } from 'react';

const Layout = ({ children, headerProps = {} }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const closeSidebar = () => {
    setIsSidebarOpen(false);
  };

  return (
    <div className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 min-h-screen flex">
      <Sidebar isOpen={isSidebarOpen} onClose={closeSidebar} />

      {/* Overlay for mobile */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={closeSidebar}
        />
      )}

      <main className="flex-1 flex flex-col min-h-screen transition-all duration-300 md:ml-72 min-w-0">
        {(headerProps.title || headerProps.breadcrumbs) && (
          <Header
            {...headerProps}
            onMenuClick={toggleSidebar}
          />
        )}
        <div className="flex-1 p-4 md:p-8 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;


