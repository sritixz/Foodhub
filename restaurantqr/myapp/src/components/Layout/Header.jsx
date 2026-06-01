import { useNavigate } from 'react-router-dom';
import NotificationBell from '../NotificationBell';

const Header = ({ title, searchPlaceholder = '', searchValue = '', onSearchChange = null, actionButton = null, breadcrumbs = null, onMenuClick = null }) => {
  const navigate = useNavigate();

  return (
    <header className="h-20 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 md:px-8 sticky top-0 z-10">
      <div className="flex items-center gap-4">
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            className="md:hidden p-2 -ml-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
          >
            <span className="material-icons-outlined">menu</span>
          </button>
        )}

        {breadcrumbs && (
          <nav className="hidden sm:flex items-center text-sm text-slate-500 dark:text-slate-400">
            {breadcrumbs.map((crumb, index) => (
              <div key={index} className="flex items-center">
                {index > 0 && (
                  <span className="material-icons-outlined text-xs mx-2">chevron_right</span>
                )}
                {crumb.path ? (
                  <button onClick={() => navigate(crumb.path)} className="hover:text-primary">
                    {crumb.label}
                  </button>
                ) : (
                  <span className={index === breadcrumbs.length - 1 ? 'text-slate-900 dark:text-slate-200 font-medium' : ''}>
                    {crumb.label}
                  </span>
                )}
              </div>
            ))}
          </nav>
        )}
        {(!breadcrumbs || window.innerWidth < 640) && <h2 className="text-lg md:text-xl font-bold dark:text-white truncate">{title}</h2>}
      </div>
      <div className="flex items-center gap-2 md:gap-4">
        {searchPlaceholder && (
          <div className="relative hidden lg:block">
            <span className="material-icons-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
            <input
              className="pl-10 pr-4 py-2 bg-slate-100 dark:bg-slate-800 border-none rounded-full text-sm focus:ring-2 focus:ring-primary/20 w-64 transition-all"
              placeholder={searchPlaceholder}
              type="text"
              value={searchValue}
              onChange={onSearchChange}
            />
          </div>
        )}
        <NotificationBell />
        {actionButton}
      </div>
    </header>
  );
};

export default Header;
