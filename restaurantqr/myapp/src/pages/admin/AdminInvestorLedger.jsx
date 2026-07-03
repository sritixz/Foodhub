import { useState, useEffect } from 'react';
import Layout from '../../components/Layout/Layout';
import Card from '../../components/UI/Card';
import Input from '../../components/UI/Input';
import Button from '../../components/UI/Button';
import api from '../../utils/api';

const AdminInvestorLedger = () => {
  const [activeTab, setActiveTab] = useState('investors'); // 'investors' | 'payouts'
  const [investors, setInvestors] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Payout Generation Modal State
  const [showCalcModal, setShowCalcModal] = useState(false);
  const [selectedInvestor, setSelectedInvestor] = useState(null);
  const [calcParams, setCalcParams] = useState({
    periodStart: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    periodEnd: new Date().toISOString().split('T')[0],
    notes: '',
  });
  const [calcResult, setCalcResult] = useState(null);
  const [calculating, setCalculating] = useState(false);
  const [recording, setRecording] = useState(false);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      if (activeTab === 'investors') {
        const res = await api.get('/users?role=Investor');
        setInvestors(res.data || []);
      } else {
        const res = await api.get('/investors/payouts');
        setPayouts(res.data || []);
      }
    } catch (err) {
      console.error('Error fetching admin investor ledger data:', err);
      setError('Failed to load ledger data. ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCalcModal = (investor) => {
    setSelectedInvestor(investor);
    setCalcResult(null);
    setShowCalcModal(true);
  };

  const handleCloseCalcModal = () => {
    setShowCalcModal(false);
    setSelectedInvestor(null);
    setCalcResult(null);
  };

  const runCalculation = async () => {
    if (!selectedInvestor) return;
    setCalculating(true);
    setError('');
    try {
      const res = await api.post('/investors/calculate-payout', {
        investorId: selectedInvestor._id,
        periodStart: calcParams.periodStart,
        periodEnd: calcParams.periodEnd,
      });
      setCalcResult(res.data);
    } catch (err) {
      console.error(err);
      setError('Calculation failed. ' + (err.response?.data?.message || err.message));
    } finally {
      setCalculating(false);
    }
  };

  const recordPayout = async () => {
    if (!selectedInvestor || !calcResult) return;
    setRecording(true);
    setError('');
    try {
      await api.post('/investors/payouts', {
        investorId: selectedInvestor._id,
        periodStart: calcParams.periodStart,
        periodEnd: calcParams.periodEnd,
        notes: calcParams.notes,
      });
      setSuccess(`Payout recorded successfully for ${selectedInvestor.name}!`);
      handleCloseCalcModal();
      fetchData();
    } catch (err) {
      console.error(err);
      setError('Failed to save payout. ' + (err.response?.data?.message || err.message));
    } finally {
      setRecording(false);
    }
  };

  const handleStatusChange = async (payoutId, newStatus) => {
    setError('');
    setSuccess('');
    try {
      await api.patch(`/investors/payouts/${payoutId}/status`, { status: newStatus });
      setSuccess('Payout status updated successfully!');
      fetchData();
    } catch (err) {
      console.error(err);
      setError('Failed to update status. ' + (err.response?.data?.message || err.message));
    }
  };

  const getStatusBadge = (status) => {
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
        return 'bg-slate-100 text-slate-800 dark:bg-slate-800';
    }
  };

  return (
    <Layout headerProps={{ title: "Investor Management Ledger" }}>
      <div className="space-y-6 p-1 md:p-4">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Investor Ledger</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Track equity investments, calculate monthly returns vs profits, and process payout settlements.
            </p>
          </div>

          {/* Navigation Tabs */}
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit">
            <button
              onClick={() => setActiveTab('investors')}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition ${
                activeTab === 'investors'
                  ? 'bg-white dark:bg-slate-700 shadow-sm text-primary'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Active Investors
            </button>
            <button
              onClick={() => setActiveTab('payouts')}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition ${
                activeTab === 'payouts'
                  ? 'bg-white dark:bg-slate-700 shadow-sm text-primary'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Payout History
            </button>
          </div>
        </div>

        {/* Global Notifications */}
        {error && <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-xl text-red-600 dark:text-red-400 text-sm">{error}</div>}
        {success && <div className="p-4 bg-green-50 dark:bg-green-955/20 border border-green-200 dark:border-green-900 rounded-xl text-green-600 dark:text-green-400 text-sm">{success}</div>}

        {/* Loading / Data Table */}
        <Card className="p-0 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <p className="mt-4 text-slate-500 dark:text-slate-400">Loading records...</p>
            </div>
          ) : activeTab === 'investors' ? (
            /* Investors Tab Table */
            investors.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                <span className="material-icons-outlined text-4xl mb-2">person_off</span>
                <p>No registered investors found in the user database.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 font-semibold">
                      <th className="px-6 py-4">Investor Name</th>
                      <th className="px-6 py-4">Linked Outlet</th>
                      <th className="px-6 py-4 text-right">Investment Amount</th>
                      <th className="px-6 py-4 text-center">Return Rate (p.a.)</th>
                      <th className="px-6 py-4 text-center">Profit Share %</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {investors.map((i) => (
                      <tr key={i._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">
                          <div className="flex flex-col">
                            <span>{i.name}</span>
                            <span className="text-xs text-slate-400 font-normal">{i.email}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-slate-700 dark:text-slate-300 font-semibold">
                          {i.outlet?.name || <span className="text-red-500">Not Linked</span>}
                        </td>
                        <td className="px-6 py-4 text-right font-semibold">
                          ₹{(i.investmentAmount || 0).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-center text-slate-600 dark:text-slate-400">
                          {i.assuredReturnRate || 18}%
                        </td>
                        <td className="px-6 py-4 text-center text-slate-600 dark:text-slate-400">
                          {i.profitSharePercentage || 50}%
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Button 
                            disabled={!i.outlet}
                            onClick={() => handleOpenCalcModal(i)}
                          >
                            Calculate Payout
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            /* Payouts Tab Table */
            payouts.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                <span className="material-icons-outlined text-4xl mb-2">history</span>
                <p>No historical payout records found.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 font-semibold">
                      <th className="px-6 py-4">Investor</th>
                      <th className="px-6 py-4">Period</th>
                      <th className="px-6 py-4 text-right">Profit Share (A)</th>
                      <th className="px-6 py-4 text-right">Assured Min (B)</th>
                      <th className="px-6 py-4 text-right font-bold text-slate-800 dark:text-white">Net Payout</th>
                      <th className="px-6 py-4 text-center">Status</th>
                      <th className="px-6 py-4 text-right">Settlement Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {payouts.map((p) => {
                      const startStr = new Date(p.periodStart).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
                      const endStr = new Date(p.periodEnd).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
                      
                      return (
                        <tr key={p._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                          <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">
                            <div className="flex flex-col">
                              <span>{p.investor?.name}</span>
                              <span className="text-xs text-slate-400 font-normal">Outlet: {p.outlet?.name}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-slate-600 dark:text-slate-400 font-medium">
                            {startStr} – {endStr}
                          </td>
                          <td className="px-6 py-4 text-right text-slate-600 dark:text-slate-400">
                            ₹{p.profitShareAmount.toLocaleString()}
                          </td>
                          <td className="px-6 py-4 text-right text-slate-600 dark:text-slate-400">
                            ₹{p.assuredReturnAmount.toLocaleString()}
                          </td>
                          <td className="px-6 py-4 text-right font-bold text-primary">
                            ₹{p.netPayout.toLocaleString()}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(p.status)}`}>
                              {p.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-1.5">
                              {p.status === 'Pending' && (
                                <button
                                  onClick={() => handleStatusChange(p._id, 'Processing')}
                                  className="px-2 py-1 border rounded text-xs text-blue-600 hover:bg-blue-50 transition"
                                >
                                  Process
                                </button>
                              )}
                              {['Pending', 'Processing'].includes(p.status) && (
                                <>
                                  <button
                                    onClick={() => handleStatusChange(p._id, 'Paid')}
                                    className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs transition"
                                  >
                                    Mark Paid
                                  </button>
                                  <button
                                    onClick={() => handleStatusChange(p._id, 'Failed')}
                                    className="px-2 py-1 border rounded text-xs text-red-600 hover:bg-red-50 transition"
                                  >
                                    Fail
                                  </button>
                                </>
                              )}
                              {p.status === 'Paid' && (
                                <span className="text-xs text-slate-400 font-medium">Paid ({p.paidAt ? new Date(p.paidAt).toLocaleDateString() : ''})</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          )}
        </Card>

        {/* Payout Calculation & Generation Modal */}
        {showCalcModal && selectedInvestor && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-xl overflow-hidden">
              <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold">Calculate Payout</h2>
                  <p className="text-xs text-slate-500">Generate return settlement for {selectedInvestor.name}</p>
                </div>
                <button
                  onClick={handleCloseCalcModal}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <span className="material-icons-outlined">close</span>
                </button>
              </div>

              <div className="p-6 space-y-4">
                {/* Date Inputs */}
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Period Start"
                    type="date"
                    value={calcParams.periodStart}
                    onChange={(e) => setCalcParams({ ...calcParams, periodStart: e.target.value })}
                  />
                  <Input
                    label="Period End"
                    type="date"
                    value={calcParams.periodEnd}
                    onChange={(e) => setCalcParams({ ...calcParams, periodEnd: e.target.value })}
                  />
                </div>

                <Button 
                  className="w-full" 
                  onClick={runCalculation} 
                  loading={calculating}
                >
                  Run Audit Calculation
                </Button>

                {/* Calculation audit results display */}
                {calcResult && (
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-150 dark:border-slate-800 space-y-3">
                    <h3 className="font-bold text-slate-800 dark:text-white border-b pb-1">Settlement Audit Results</h3>
                    
                    <div className="grid grid-cols-2 gap-y-2 text-xs">
                      <span className="text-slate-500">Days in Period:</span>
                      <span className="font-bold text-right">{calcResult.daysInPeriod} days</span>

                      <span className="text-slate-500">Outlet Net Profit:</span>
                      <span className="font-bold text-right">₹{calcResult.totalOutletProfit.toLocaleString()}</span>

                      <span className="text-slate-500">Profit Share ({calcResult.profitSharePercentage}%):</span>
                      <span className="font-bold text-right text-orange-600">₹{calcResult.profitShareAmount.toLocaleString()}</span>

                      <span className="text-slate-500">Assured Guarantee Rate:</span>
                      <span className="font-bold text-right">{calcResult.assuredReturnRate}% p.a.</span>

                      <span className="text-slate-500">Assured Return Amount (Pro-rated):</span>
                      <span className="font-bold text-right text-indigo-600">₹{calcResult.assuredAmount.toLocaleString()}</span>

                      <span className="text-sm font-bold text-slate-800 dark:text-white border-t pt-2 mt-1">Recommended Payout:</span>
                      <span className="text-sm font-extrabold text-right text-primary border-t pt-2 mt-1">
                        ₹{calcResult.netPayout.toLocaleString()}
                      </span>
                    </div>

                    <div className="pt-2 text-[10px] text-slate-400 dark:text-slate-500 text-center">
                      * Calculates Math.max(Profit Share, Assured Return Guarantee)
                    </div>

                    <Input
                      label="Admin Notes"
                      placeholder="e.g. July 2026 Profit Settlement"
                      value={calcParams.notes}
                      onChange={(e) => setCalcParams({ ...calcParams, notes: e.target.value })}
                    />
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3 bg-slate-50 dark:bg-slate-900">
                <Button variant="ghost" onClick={handleCloseCalcModal}>
                  Cancel
                </Button>
                <Button 
                  disabled={!calcResult || recording} 
                  onClick={recordPayout}
                >
                  {recording ? 'Saving...' : 'Record & Save Payout'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default AdminInvestorLedger;
