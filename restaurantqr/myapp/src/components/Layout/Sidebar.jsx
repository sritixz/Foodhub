import { useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import useDarkMode from '../../hooks/useDarkMode';
import { useAuth } from '../../context/AuthContext';

const Sidebar = ({ isOpen, onClose }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { toggleDarkMode } = useDarkMode();
  const { logout, user } = useAuth();
  const navRef = useRef(null);

  // Restore scroll position on mount and route changes
  useEffect(() => {
    const saved = sessionStorage.getItem('sidebar-scroll');
    if (saved && navRef.current) {
      navRef.current.scrollTop = Number(saved);
    }
  }, [location.pathname]);

  const handleNavScroll = () => {
    if (navRef.current) {
      sessionStorage.setItem('sidebar-scroll', navRef.current.scrollTop);
    }
  };

  const menuItems = [
    { icon: 'dashboard', label: 'Dashboard', path: '/' },
    { icon: 'storefront', label: 'Outlet Management', path: '/outlets' },
    { icon: 'group', label: 'User Management', path: '/users' },
    { icon: 'handshake', label: 'Vendor Management', path: '/vendors' },
    { icon: 'menu_book', label: 'Menu & Catalog', path: '/menu/browse' },
    ...(user?.role === 'Admin' ? [{ icon: 'category', label: 'Category Management', path: '/categories' }] : []),
    ...(['Admin', 'Company Admin'].includes(user?.role) ? [{ icon: 'account_balance_wallet', label: 'Budget Config', path: '/budget-config' }] : []),
    ...(['Admin', 'Company Admin', 'Employee'].includes(user?.role) ? [{ icon: 'payments', label: 'Payments', path: '/payments' }] : []),
    ...(['Admin', 'Company Admin'].includes(user?.role) ? [{ icon: 'people_alt', label: 'Leads & Enquiries', path: '/admin/leads' }] : []),
    { icon: 'inventory_2', label: 'Inventory Management', path: '/inventory' },
    { icon: 'shopping_cart', label: 'Order Management', path: '/orders' },
    { icon: 'local_shipping', label: 'Delivery Dashboard', path: '/delivery' },
    { icon: 'location_on', label: 'Location & Delivery', path: '/location-delivery' },
    { icon: 'warehouse', label: 'Warehouse Management', path: '/warehouse' },
    { icon: 'notifications', label: 'Notifications', path: '/notifications' },
    { icon: 'analytics', label: 'Reports & Analytics', path: '/reports' },
  ];

  const isActive = (path) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <aside
      className={`
        w-72 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 
        flex flex-col fixed h-full z-50 transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}
    >
      <div className="p-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
          <span className="material-icons-outlined text-3xl">restaurant</span>
          Mopy
        </h1>
        <button
          onClick={onClose}
          className="md:hidden p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
        >
          <span className="material-icons-outlined">close</span>
        </button>
      </div>
      <nav ref={navRef} onScroll={handleNavScroll} className="flex-1 px-4 py-2 space-y-1 overflow-y-auto custom-scrollbar">
        {menuItems.map((item) => {
          const active = isActive(item.path);
          const isDisabled = item.disabled;

          const linkContent = (
            <>
              <div className="flex items-center gap-3">
                <span className="material-icons-outlined">{item.icon}</span>
                <span className="font-medium">{item.label}</span>
              </div>
              {item.badge && (
                <span className="bg-primary text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {item.badge}
                </span>
              )}
              {isDisabled && (
                <span className="text-xs text-slate-400 dark:text-slate-600 ml-auto">Coming Soon</span>
              )}
            </>
          );

          if (isDisabled) {
            return (
              <div
                key={item.path}
                className={`flex items-center ${item.badge ? 'justify-between' : ''} gap-3 px-4 py-3 rounded-lg transition-all group cursor-not-allowed opacity-50 ${'text-slate-400 dark:text-slate-600'
                  }`}
                title="Feature coming soon"
              >
                {linkContent}
              </div>
            );
          }

          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => {
                if (window.innerWidth < 768) {
                  onClose();
                }
              }}
              className={`flex items-center ${item.badge ? 'justify-between' : ''} gap-3 px-4 py-3 rounded-lg transition-all group ${active
                ? 'bg-orange-50 dark:bg-primary/10 text-primary border border-orange-100 dark:border-primary/20'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
            >
              {linkContent}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
        {user && (
          <div className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400">
            <div className="font-medium text-slate-900 dark:text-white">{user.name}</div>
            <div className="text-xs">{user.role}</div>
          </div>
        )}
        <button
          onClick={toggleDarkMode}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
        >
          <span className="material-icons-outlined text-sm">dark_mode</span>
          <span className="text-sm font-medium">Appearance</span>
        </button>
        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
        >
          <span className="material-icons-outlined text-sm">logout</span>
          <span className="text-sm font-medium">Logout</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
