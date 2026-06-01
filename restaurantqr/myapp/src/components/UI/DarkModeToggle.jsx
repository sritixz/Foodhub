import useDarkMode from '../../hooks/useDarkMode';

const DarkModeToggle = ({ className = '' }) => {
  const { isDark, toggleDarkMode } = useDarkMode();

  return (
    <button
      onClick={toggleDarkMode}
      className={`p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full shadow-lg hover:scale-110 transition-transform ${className}`}
      aria-label="Toggle dark mode"
    >
      <span className="material-icons-outlined dark:hidden">dark_mode</span>
      <span className="material-icons-outlined hidden dark:block">light_mode</span>
    </button>
  );
};

export default DarkModeToggle;
