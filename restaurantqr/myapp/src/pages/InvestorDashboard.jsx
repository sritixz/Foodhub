import { useState, useEffect } from 'react';
import Layout from '../components/Layout/Layout';
import Card from '../components/UI/Card';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';

const InvestorDashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [trendData, setTrendData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchInvestorStats();
    fetchOutletTrend();
  }, []);

  const fetchInvestorStats = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get('/investors/stats');
      setStats(res.data);
    } catch (err) {
      console.error('Error fetching investor stats:', err);
      setError(err.response?.data?.message || 'Failed to load stats');
    } finally {
      setLoading(false);
    }
  };

  const fetchOutletTrend = async () => {
    try {
      const res = await api.get('/reports/daily-orders?days=7');
      setTrendData(res.data || []);
    } catch (err) {
      console.error('Error fetching outlet trend data:', err);
    }
  };

  // Find max revenue in trend to scale bars
  const maxRevenue = trendData.length > 0 ? Math.max(...trendData.map(d => d.revenue)) : 10000;

  if (loading) {
    return (
      <Layout headerProps={{ title: "Investor Portal" }}>
        <div className="flex justify-center items-center h-[calc(100vh-12rem)]">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="mt-4 text-slate-600 dark:text-slate-400">Loading your investment profile...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (error || !stats) {
    return (
      <Layout headerProps={{ title: "Investor Portal" }}>
        <div className="p-6">
          <Card className="bg-red-50 dark:bg-red-900/10 border-red-200">
            <div className="text-center py-6 text-red-600 dark:text-red-400">
              <span className="material-icons-outlined text-4xl mb-2">error_outline</span>
              <p className="font-medium">{error || 'An error occurred loading stats.'}</p>
              <button 
                onClick={fetchInvestorStats} 
                className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
              >
                Retry Load
              </button>
            </div>
          </Card>
        </div>
      </Layout>
    );
  }

  const { investor, outlet, stats: payoutStats } = stats;

  return (
    <Layout headerProps={{ title: `Investor Portal — ${outlet?.name || 'My Outlet'}` }}>
      <div className="space-y-6 p-1 md:p-4">
        {/* Welcome Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Welcome back, {investor.name}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Real-time capital performance and profit distributions for <span className="font-semibold text-primary">{outlet?.name} ({outlet?.outletId})</span>.
            </p>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Capital Invested */}
          <Card className="p-0 overflow-hidden bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg border-0">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-white/20 rounded-lg text-white">
                  <span className="material-icons-outlined">account_balance</span>
                </div>
                <span className="text-xs font-semibold uppercase tracking-wider bg-white/25 px-2.5 py-1 rounded-full">Capital</span>
              </div>
              <p className="text-sm text-blue-100 font-medium">Invested Capital</p>
              <h3 className="text-3xl font-extrabold mt-1">₹{investor.investmentAmount.toLocaleString('en-IN')}</h3>
            </div>
          </Card>

          {/* Assured Return Rate */}
          <Card className="p-0 overflow-hidden bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg border-0">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-white/20 rounded-lg text-white">
                  <span className="material-icons-outlined">trending_up</span>
                </div>
                <span className="text-xs font-semibold uppercase tracking-wider bg-white/25 px-2.5 py-1 rounded-full">Assured Return</span>
              </div>
              <p className="text-sm text-indigo-100 font-medium">Minimum Guarantee Rate</p>
              <h3 className="text-3xl font-extrabold mt-1">{investor.assuredReturnRate}% <span className="text-lg font-normal">p.a.</span></h3>
            </div>
          </Card>

          {/* Current Month Accrued */}
          <Card className="p-0 overflow-hidden bg-gradient-to-br from-orange-500 to-amber-600 text-white shadow-lg border-0">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-white/20 rounded-lg text-white">
                  <span className="material-icons-outlined">pending_actions</span>
                </div>
                <span className="text-xs font-semibold uppercase tracking-wider bg-white/25 px-2.5 py-1 rounded-full">Accruing</span>
              </div>
              <p className="text-sm text-orange-100 font-medium">Accrued This Month (Est.)</p>
              <h3 className="text-3xl font-extrabold mt-1">₹{payoutStats.currentMonthAccrual.toLocaleString('en-IN')}</h3>
            </div>
          </Card>

          {/* Total Paid Out */}
          <Card className="p-0 overflow-hidden bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg border-0">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-white/20 rounded-lg text-white">
                  <span className="material-icons-outlined">payments</span>
                </div>
                <span className="text-xs font-semibold uppercase tracking-wider bg-white/25 px-2.5 py-1 rounded-full">Settled</span>
              </div>
              <p className="text-sm text-emerald-100 font-medium">Total Payouts Received</p>
              <h3 className="text-3xl font-extrabold mt-1">₹{payoutStats.totalPaidOut.toLocaleString('en-IN')}</h3>
            </div>
          </Card>
        </div>

        {/* Dashboard Body split */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Daily Sales Trend Chart */}
          <div className="lg:col-span-2">
            <Card title="Outlet Performance (Recent Sales Trend)">
              <div className="p-4">
                {trendData.length === 0 ? (
                  <div className="h-64 flex items-center justify-center text-slate-400">
                    No recent transaction data available for this outlet.
                  </div>
                ) : (
                  <div className="relative h-72 flex items-end gap-3 md:gap-6 pt-10 px-4">
                    {/* Y-axis Guides */}
                    <div className="absolute inset-x-0 top-10 flex flex-col justify-between h-[calc(100%-2.5rem)] pointer-events-none">
                      {[1, 0.75, 0.5, 0.25, 0].map((val, idx) => (
                        <div key={idx} className="border-b w-full relative border-slate-100 dark:border-slate-800">
                          <span className="absolute -left-10 -top-2 text-[9px] text-slate-400 font-medium">
                            ₹{Math.round(maxRevenue * val).toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Bars */}
                    <div className="flex-1 flex items-end justify-between px-2 h-full">
                      {trendData.map((day, idx) => {
                        const heightPct = maxRevenue > 0 ? (day.revenue / maxRevenue) * 100 : 0;
                        return (
                          <div key={idx} className="group relative flex flex-col items-center gap-1 w-10 md:w-16 h-full justify-end">
                            {/* Hover Tooltip */}
                            <div className="absolute bottom-full mb-2 bg-slate-900 text-white text-xs px-2 py-1 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 whitespace-nowrap">
                              <div>Revenue: ₹{day.revenue.toLocaleString()}</div>
                              <div>Orders: {day.orders}</div>
                            </div>
                            {/* Bar container */}
                            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-t-lg h-[80%] relative overflow-hidden">
                              <div
                                className="absolute bottom-0 w-full bg-gradient-to-t from-primary to-orange-400 transition-all duration-500 rounded-t-sm"
                                style={{ height: `${heightPct}%` }}
                              />
                            </div>
                            {/* Label */}
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-1 uppercase">
                              {day.date.split('-')[2]}/{day.date.split('-')[1]}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div className="mt-4 text-center">
                  <span className="text-xs font-semibold text-slate-400 tracking-wider">DAILY REVENUE (LAST 7 DAYS)</span>
                </div>
              </div>
            </Card>
          </div>

          {/* Investment Details / Terms Sheet */}
          <div>
            <Card title="Investment Terms & Details">
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase">Linked Outlet</span>
                  <span className="text-sm font-bold text-slate-800 dark:text-white">{outlet?.name || 'N/A'}</span>
                </div>

                <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase">Profit Share %</span>
                  <span className="text-sm font-bold text-primary">{investor.profitSharePercentage}% Share</span>
                </div>

                <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase">Assured Return %</span>
                  <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{investor.assuredReturnRate}% p.a.</span>
                </div>

                <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase">Unsettled Accruals</span>
                  <span className="text-sm font-bold text-amber-600">₹{payoutStats.pendingPayout.toLocaleString('en-IN')}</span>
                </div>

                {/* Explanation text */}
                <div className="p-4 bg-orange-50 dark:bg-orange-950/20 rounded-xl border border-orange-100 dark:border-orange-900/30 text-xs text-orange-800 dark:text-orange-300">
                  <h4 className="font-bold flex items-center gap-1.5 mb-1 text-orange-900 dark:text-orange-400">
                    <span className="material-icons-outlined text-sm">info</span>
                    Payout Guarantee Agreement
                  </h4>
                  <p className="leading-relaxed">
                    Payouts are calculated monthly. You are guaranteed to receive either **{investor.profitSharePercentage}% of the outlet's cumulative net profit** or **pro-rated minimum return ({investor.assuredReturnRate}% p.a.)**, whichever is greater.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default InvestorDashboard;
