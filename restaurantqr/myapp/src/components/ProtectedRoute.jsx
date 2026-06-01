import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Card from './UI/Card';
import Button from './UI/Button';

const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="mt-4 text-slate-600 dark:text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user?.role)) {
    return (
      <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center px-4">
        <Card>
          <div className="text-center">
            <span className="material-icons-outlined text-6xl text-red-500 mb-4">block</span>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Access Denied</h2>
            <p className="text-slate-600 dark:text-slate-400">
              You don't have permission to access this page.
            </p>
            <Button onClick={() => window.history.back()} className="mt-6">
              Go Back
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return children;
};

export default ProtectedRoute;
