import { useEffect, useState } from 'react';
import Layout from '../components/Layout/Layout';
import Card from '../components/UI/Card';
import Button from '../components/UI/Button';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';

const Reports = () => {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [dailyOrders, setDailyOrders] = useState([]);
  const [outletRevenue, setOutletRevenue] = useState([]);
  const [orderTypes, setOrderTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState('month');
  const [exporting, setExporting] = useState(false);

  const isAdmin = ['Admin', 'Company Admin'].includes(user?.role);

  useEffect(() => {
    fetchAllReports();
  }, [period]);

  const fetchAllReports = async () => {
    try {
      setLoading(true);
      setError('');
      const [summaryRes, dailyRes, typesRes] = await Promise.all([
        api.get(`/reports/summary?period=${period}`),
        api.get(`/reports/daily-orders?days=${period === 'week' ? 7 : period === 'month' ? 30 : 14}`),
        api.get(`/reports/order-types?period=${period}`),
      ]);
      setSummary(summaryRes.data);
      setDailyOrders(dailyRes.data);
      setOrderTypes(typesRes.data);

      if (isAdmin) {
        const outletRes = await api.get(`/reports/revenue-by-outlet?period=${period}`);
        setOutletRevenue(outletRes.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const response = await api.get(`/reports/export/csv?period=${period}`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `orders-report-${period}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError('Failed to export report');
    } finally {
      setExporting(false);
    }
  };

  // Simple bar chart component using CSS
  const maxRevenue = Math.max(...dailyOrders.map((d) => d.revenue), 1);
  const maxOutletRevenue = Math.max(...outletRevenue.map((d) => d.totalRevenue), 1);

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
        actionButton: (
          <Button onClick={handleExportCSV} disabled={exporting}>
            <span className="material-icons-outlined text-sm mr-1">download</span>
            {exporting ? 'Exporting...' : 'Export CSV'}
          </Button>
        ),
      }}
    >
      <div className="p-8 space-y-6">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Period Filter */}
        <div className="flex gap-2">
          {['week', 'month', 'year'].map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                period === p
                  ? 'bg-primary text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              {p === 'week' ? 'Last 7 Days' : p === 'month' ? 'Last 30 Days' : 'Last Year'}
            </button>
          ))}
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <p className="text-xs text-slate-500 dark:text-slate-400">Total Orders</p>
            <p className="text-2xl font-bold mt-1">{summary?.totalOrders || 0}</p>
          </Card>
          <Card>
            <p className="text-xs text-slate-500 dark:text-slate-400">Total Revenue</p>
            <p className="text-2xl font-bold mt-1 text-primary">₹{(summary?.totalRevenue || 0).toFixed(0)}</p>
          </Card>
          <Card>
            <p className="text-xs text-slate-500 dark:text-slate-400">Avg Order Value</p>
            <p className="text-2xl font-bold mt-1">₹{(summary?.avgOrderValue || 0).toFixed(0)}</p>
          </Card>
          <Card>
            <p className="text-xs text-slate-500 dark:text-slate-400">Order Status</p>
            <div className="mt-1 space-y-1">
              {summary?.statusBreakdown && Object.entries(summary.statusBreakdown).slice(0, 3).map(([status, data]) => (
                <div key={status} className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">{status}</span>
                  <span className="font-medium">{data.orders}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Daily Orders Chart */}
        <Card>
          <h3 className="font-bold mb-4">Orders Per Day</h3>
          <div className="overflow-x-auto">
            <div className="flex items-end gap-1 min-w-[600px] h-48">
              {dailyOrders.map((day) => {
                const height = maxRevenue > 0 ? (day.revenue / maxRevenue) * 100 : 0;
                const dateLabel = new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                return (
                  <div key={day.date} className="flex-1 flex flex-col items-center gap-1 group relative">
                    {/* Tooltip */}
                    <div className="absolute bottom-full mb-2 hidden group-hover:block bg-slate-900 dark:bg-slate-700 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap z-10">
                      <p className="font-medium">{dateLabel}</p>
                      <p>{day.orders} orders · ₹{day.revenue.toFixed(0)}</p>
                    </div>
                    <div
                      className="w-full bg-primary/80 hover:bg-primary rounded-t-sm transition-all cursor-pointer min-h-[2px]"
                      style={{ height: `${Math.max(height, 1)}%` }}
                    />
                    <span className="text-[10px] text-slate-400 rotate-[-45deg] origin-left whitespace-nowrap">
                      {dateLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex justify-between mt-4 text-xs text-slate-400">
            <span>Total: {dailyOrders.reduce((s, d) => s + d.orders, 0)} orders</span>
            <span>Revenue: ₹{dailyOrders.reduce((s, d) => s + d.revenue, 0).toFixed(0)}</span>
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Revenue by Outlet (Admin only) */}
          {isAdmin && (
            <Card>
              <h3 className="font-bold mb-4">Revenue by Outlet</h3>
              {outletRevenue.length === 0 ? (
                <p className="text-sm text-slate-400 py-4">No outlet data</p>
              ) : (
                <div className="space-y-3">
                  {outletRevenue.map((outlet) => {
                    const widthPercent = maxOutletRevenue > 0 ? (outlet.totalRevenue / maxOutletRevenue) * 100 : 0;
                    return (
                      <div key={outlet.outletId}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="font-medium truncate max-w-[150px]">{outlet.name}</span>
                          <span className="text-slate-500">
                            {outlet.totalOrders} orders · ₹{outlet.totalRevenue.toFixed(0)}
                          </span>
                        </div>
                        <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${widthPercent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          )}

          {/* Order Types */}
          <Card>
            <h3 className="font-bold mb-4">Order Breakdown</h3>
            {orderTypes.length === 0 ? (
              <p className="text-sm text-slate-400 py-4">No data</p>
            ) : (
              <div className="space-y-3">
                {orderTypes.map((type, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                    <div>
                      <p className="font-medium text-sm">{type.orderType}</p>
                      <p className="text-xs text-slate-400">{type.deliveryMode}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-sm">{type.totalOrders} orders</p>
                      <p className="text-xs text-slate-400">₹{type.totalRevenue.toFixed(0)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Top Selling Items */}
          <Card className={isAdmin ? 'lg:col-span-2' : ''}>
            <h3 className="font-bold mb-4">Top Selling Items</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <th className="pb-3 font-medium">#</th>
                    <th className="pb-3 font-medium">Item</th>
                    <th className="pb-3 font-medium">Category</th>
                    <th className="pb-3 font-medium text-right">Qty Sold</th>
                    <th className="pb-3 font-medium text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {summary?.topItems?.length ? (
                    summary.topItems.map((item, idx) => (
                      <tr key={item.itemId}>
                        <td className="py-3 text-slate-400">{idx + 1}</td>
                        <td className="py-3 font-medium">{item.name}</td>
                        <td className="py-3 text-slate-500">{item.category}</td>
                        <td className="py-3 text-right">{item.totalQuantity}</td>
                        <td className="py-3 text-right font-medium">₹{item.totalRevenue.toFixed(0)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" className="py-8 text-center text-slate-400">No sales data available</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default Reports;
