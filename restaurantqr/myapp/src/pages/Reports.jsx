import { useEffect, useState } from 'react';
import Layout from '../components/Layout/Layout';
import Card from '../components/UI/Card';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';

const Reports = () => {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchSummary();
  }, []);

  const fetchSummary = async () => {
    try {
      setLoading(true);
      const response = await api.get('/reports/summary');
      setSummary(response.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Layout headerProps={{ title: "Reports & Analytics" }}>
        <div className="flex items-center justify-center p-8 h-full">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="mt-4 text-slate-600 dark:text-slate-400">Loading reports...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout
      headerProps={{
        title: "Reports & Analytics",
        subtitle: `Role: ${user?.role || 'User'}`,
      }}
    >
      <div>
        {error && (
          <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <Card>
            <p className="text-xs text-slate-500 dark:text-slate-400">Total Orders</p>
            <p className="text-2xl font-bold">{summary?.totalOrders || 0}</p>
          </Card>
          <Card>
            <p className="text-xs text-slate-500 dark:text-slate-400">Total Revenue</p>
            <p className="text-2xl font-bold">₹{(summary?.totalRevenue || 0).toFixed(2)}</p>
          </Card>
          <Card>
            <p className="text-xs text-slate-500 dark:text-slate-400">Order Status</p>
            <div className="mt-2 space-y-1">
              {summary?.statusBreakdown ? (
                Object.entries(summary.statusBreakdown).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between text-sm">
                    <span>{status}</span>
                    <span className="font-medium">{count}</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-400">No data</p>
              )}
            </div>
          </Card>
        </div>

        <Card title="Top Selling Items">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Item</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Category</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Quantity</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {summary?.topItems?.length ? (
                  summary.topItems.map((item) => (
                    <tr key={item.itemId}>
                      <td className="px-6 py-4 text-sm font-medium">{item.name}</td>
                      <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">{item.category}</td>
                      <td className="px-6 py-4 text-sm">{item.totalQuantity}</td>
                      <td className="px-6 py-4 text-sm">₹{item.totalRevenue.toFixed(2)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" className="px-6 py-8 text-center text-slate-400">
                      No sales data available.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </Layout>
  );
};

export default Reports;
