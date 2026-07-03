import { useState, useEffect } from 'react';
import Layout from '../components/Layout/Layout';
import Card from '../components/UI/Card';
import api from '../utils/api';

const InvestorPayouts = () => {
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchPayoutHistory();
  }, []);

  const fetchPayoutHistory = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get('/investors/payouts');
      setPayouts(res.data || []);
    } catch (err) {
      console.error('Error fetching payout history:', err);
      setError(err.response?.data?.message || 'Failed to load payout history');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Paid':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'Processing':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'Pending':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
      case 'Failed':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      default:
        return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-400';
    }
  };

  return (
    <Layout headerProps={{ title: "My Payout Ledger" }}>
      <div className="space-y-6 p-1 md:p-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Payout Transactions</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            View detailed audits of your historical profit-share distributions and guaranteed returns.
          </p>
        </div>

        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        <Card className="p-0 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <p className="mt-4 text-slate-500 dark:text-slate-400">Loading payout records...</p>
            </div>
          ) : payouts.length === 0 ? (
            <div className="p-12 text-center text-slate-500 dark:text-slate-400">
              <span className="material-icons-outlined text-4xl mb-2">payments</span>
              <p className="font-medium">No payouts recorded yet</p>
              <p className="text-xs text-slate-400 mt-1">Payouts are scheduled and generated monthly by the administration.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 font-semibold">
                    <th className="px-6 py-4">Settlement Period</th>
                    <th className="px-6 py-4 text-right">Outlet Net Profit</th>
                    <th className="px-6 py-4 text-right">Profit Share (A)</th>
                    <th className="px-6 py-4 text-right">Assured return (B)</th>
                    <th className="px-6 py-4 text-right font-bold text-slate-800 dark:text-white">Net Payout</th>
                    <th className="px-6 py-4 text-center">Status</th>
                    <th className="px-6 py-4">Paid At</th>
                    <th className="px-6 py-4">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                  {payouts.map((p) => {
                    const startStr = new Date(p.periodStart).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
                    const endStr = new Date(p.periodEnd).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
                    const paidDate = p.paidAt ? new Date(p.paidAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
                    
                    return (
                      <tr key={p._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                          <div className="flex flex-col">
                            <span>{startStr} – {endStr}</span>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500">Outlet ID: {p.outlet?.outletId}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right text-slate-600 dark:text-slate-400">
                          ₹{p.totalOutletProfit.toLocaleString('en-IN')}
                        </td>
                        <td className="px-6 py-4 text-right text-slate-600 dark:text-slate-400">
                          ₹{p.profitShareAmount.toLocaleString('en-IN')}
                        </td>
                        <td className="px-6 py-4 text-right text-slate-600 dark:text-slate-400">
                          ₹{p.assuredReturnAmount.toLocaleString('en-IN')}
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-primary">
                          ₹{p.netPayout.toLocaleString('en-IN')}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(p.status)}`}>
                            {p.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                          {paidDate}
                        </td>
                        <td className="px-6 py-4 text-slate-550 dark:text-slate-450 italic max-w-xs truncate" title={p.notes}>
                          {p.notes || '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </Layout>
  );
};

export default InvestorPayouts;
