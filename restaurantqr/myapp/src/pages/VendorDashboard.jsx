import { useEffect, useState } from 'react';
import Layout from '../components/Layout/Layout';
import Card from '../components/UI/Card';
import Input from '../components/UI/Input';
import Button from '../components/UI/Button';
import Modal from '../components/UI/Modal';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';

const VendorDashboard = () => {
  const { user } = useAuth();
  const [vendors, setVendors] = useState([]);
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [earnings, setEarnings] = useState(null);
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState('month');
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [payoutForm, setPayoutForm] = useState({ periodStart: '', periodEnd: '', notes: '' });
  const [creatingPayout, setCreatingPayout] = useState(false);
  const [formData, setFormData] = useState({
    commissionRate: 0,
    rating: 0,
    deliveryFee: 0,
    deliveryZonesInput: '',
    operatingHours: { open: '09:00', close: '22:00' },
  });

  const isAdmin = ['Admin', 'Company Admin', 'Owner', 'Management'].includes(user?.role);

  useEffect(() => {
    fetchVendors();
  }, []);

  useEffect(() => {
    if (selectedVendorId) {
      fetchEarnings(selectedVendorId);
      fetchPayouts(selectedVendorId);
      hydrateForm(selectedVendorId);
    }
  }, [selectedVendorId, period]);

  const fetchVendors = async () => {
    try {
      setLoading(true);
      const response = await api.get('/vendors');
      const data = response.data || [];
      setVendors(data);
      setSelectedVendorId(data[0]?._id || '');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load vendors');
    } finally {
      setLoading(false);
    }
  };

  const fetchEarnings = async (vendorId) => {
    try {
      const response = await api.get(`/vendors/${vendorId}/earnings?period=${period}`);
      setEarnings(response.data);
    } catch (err) {
      console.error('Failed to load earnings:', err);
    }
  };

  const fetchPayouts = async (vendorId) => {
    try {
      const response = await api.get(`/vendors/${vendorId}/payouts`);
      setPayouts(response.data);
    } catch (err) {
      console.error('Failed to load payouts:', err);
    }
  };

  const hydrateForm = (vendorId) => {
    const vendor = vendors.find((item) => item._id === vendorId);
    if (!vendor) return;
    setFormData({
      commissionRate: vendor.commissionRate || 0,
      rating: vendor.rating || 0,
      deliveryFee: vendor.deliveryFee || 0,
      deliveryZonesInput: vendor.deliveryZones?.join(', ') || '',
      operatingHours: {
        open: vendor.operatingHours?.open || '09:00',
        close: vendor.operatingHours?.close || '22:00',
      },
    });
  };

  const handleFormChange = (field, value) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      setFormData((prev) => ({ ...prev, [parent]: { ...prev[parent], [child]: value } }));
      return;
    }
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveVendor = async () => {
    if (!selectedVendorId) return;
    setSaving(true);
    try {
      const deliveryZones = formData.deliveryZonesInput
        ? formData.deliveryZonesInput.split(',').map((z) => z.trim()).filter(Boolean)
        : [];
      await api.put(`/outlets/${selectedVendorId}`, {
        commissionRate: Number(formData.commissionRate) || 0,
        rating: Number(formData.rating) || 0,
        deliveryFee: Number(formData.deliveryFee) || 0,
        deliveryZones,
        operatingHours: formData.operatingHours,
      });
      await fetchVendors();
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save vendor settings');
    } finally {
      setSaving(false);
    }
  };

  const handleCreatePayout = async () => {
    if (!payoutForm.periodStart || !payoutForm.periodEnd) return;
    setCreatingPayout(true);
    try {
      await api.post(`/vendors/${selectedVendorId}/payouts`, payoutForm);
      setShowPayoutModal(false);
      setPayoutForm({ periodStart: '', periodEnd: '', notes: '' });
      await fetchPayouts(selectedVendorId);
      await fetchEarnings(selectedVendorId);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create payout');
    } finally {
      setCreatingPayout(false);
    }
  };

  const handlePayoutStatusChange = async (payoutId, status) => {
    try {
      await api.patch(`/vendors/payouts/${payoutId}/status`, { status });
      await fetchPayouts(selectedVendorId);
      await fetchEarnings(selectedVendorId);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update payout status');
    }
  };

  const getPayoutStatusColor = (status) => {
    switch (status) {
      case 'Paid': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      case 'Processing': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      case 'Pending': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'Failed': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const selectedVendor = vendors.find((v) => v._id === selectedVendorId);

  if (loading) {
    return (
      <Layout headerProps={{ title: "Vendor Management" }}>
        <div className="flex items-center justify-center p-8 h-full">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="mt-4 text-slate-600 dark:text-slate-400">Loading vendors...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout headerProps={{ title: "Vendor Management" }}>
      <div className="p-8 space-y-6">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError('')} className="text-red-400 hover:text-red-600">
              <span className="material-icons-outlined text-sm">close</span>
            </button>
          </div>
        )}

        {/* Vendor Selector */}
        <Card>
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">Select Vendor</label>
              <select
                className="w-full border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 px-4 py-2"
                value={selectedVendorId}
                onChange={(e) => setSelectedVendorId(e.target.value)}
                disabled={user?.role === 'Vendor'}
              >
                {vendors.map((vendor) => (
                  <option key={vendor._id} value={vendor._id}>{vendor.name}</option>
                ))}
              </select>
            </div>
            {selectedVendor && (
              <div className="text-sm text-slate-500 dark:text-slate-400">
                ID: <span className="font-medium">{selectedVendor.outletId}</span>
                {' · '}Commission: <span className="font-medium text-primary">{selectedVendor.commissionRate || 0}%</span>
              </div>
            )}
          </div>
        </Card>

        {/* Earnings Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <p className="text-xs text-slate-500 dark:text-slate-400">Total Orders</p>
            <p className="text-2xl font-bold mt-1">{earnings?.totalOrders || 0}</p>
          </Card>
          <Card>
            <p className="text-xs text-slate-500 dark:text-slate-400">Gross Revenue</p>
            <p className="text-2xl font-bold mt-1">₹{(earnings?.grossEarnings || 0).toFixed(0)}</p>
            <p className="text-xs text-slate-400 mt-1">{earnings?.deliveredOrders || 0} delivered</p>
          </Card>
          <Card>
            <p className="text-xs text-slate-500 dark:text-slate-400">Commission ({earnings?.commissionRate || 0}%)</p>
            <p className="text-2xl font-bold mt-1 text-red-500">-₹{(earnings?.commissionAmount || 0).toFixed(0)}</p>
          </Card>
          <Card>
            <p className="text-xs text-slate-500 dark:text-slate-400">Net Earnings</p>
            <p className="text-2xl font-bold mt-1 text-green-600">₹{(earnings?.netEarnings || 0).toFixed(0)}</p>
            <p className="text-xs text-slate-400 mt-1">
              Pending: ₹{(earnings?.pendingPayout || 0).toFixed(0)}
            </p>
          </Card>
        </div>

        {/* Period Filter */}
        <div className="flex gap-2">
          {['today', 'week', 'month'].map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                period === p
                  ? 'bg-primary text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              {p === 'today' ? 'Today' : p === 'week' ? 'This Week' : 'This Month'}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Vendor Settings */}
          <Card className="lg:col-span-2">
            <h3 className="font-bold mb-4">Vendor Settings</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Commission Rate (%)"
                value={formData.commissionRate}
                onChange={(e) => handleFormChange('commissionRate', e.target.value)}
                type="number"
                disabled={!isAdmin}
              />
              <Input
                label="Delivery Fee (₹)"
                value={formData.deliveryFee}
                onChange={(e) => handleFormChange('deliveryFee', e.target.value)}
                type="number"
              />
              <Input
                label="Delivery Zones"
                value={formData.deliveryZonesInput}
                onChange={(e) => handleFormChange('deliveryZonesInput', e.target.value)}
                placeholder="Zone A, Zone B"
              />
              <Input
                label="Rating (0-5)"
                value={formData.rating}
                onChange={(e) => handleFormChange('rating', e.target.value)}
                type="number"
                disabled={!isAdmin}
              />
              <Input
                label="Opens At"
                value={formData.operatingHours.open}
                onChange={(e) => handleFormChange('operatingHours.open', e.target.value)}
                type="time"
              />
              <Input
                label="Closes At"
                value={formData.operatingHours.close}
                onChange={(e) => handleFormChange('operatingHours.close', e.target.value)}
                type="time"
              />
            </div>
            <div className="flex justify-end mt-6">
              <Button onClick={handleSaveVendor} disabled={saving || !selectedVendorId}>
                {saving ? 'Saving...' : 'Save Settings'}
              </Button>
            </div>
          </Card>

          {/* Status Breakdown */}
          <Card>
            <h3 className="font-bold mb-4">Order Breakdown</h3>
            <div className="space-y-3">
              {earnings?.statusBreakdown && Object.keys(earnings.statusBreakdown).length > 0 ? (
                Object.entries(earnings.statusBreakdown).map(([status, stats]) => (
                  <div key={status} className="flex items-center justify-between text-sm">
                    <span className="text-slate-600 dark:text-slate-400">{status}</span>
                    <div className="text-right">
                      <span className="font-medium">{stats.totalOrders} orders</span>
                      <span className="text-slate-400 ml-2">₹{stats.totalRevenue.toFixed(0)}</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-400">No orders yet</p>
              )}
            </div>
          </Card>
        </div>

        {/* Payouts Section */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold">Payout History</h3>
            {isAdmin && (
              <Button onClick={() => setShowPayoutModal(true)}>
                <span className="material-icons-outlined text-sm mr-1">add</span>
                Create Payout
              </Button>
            )}
          </div>

          {payouts.length === 0 ? (
            <p className="text-sm text-slate-400 py-4">No payouts recorded yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <th className="pb-3 font-medium">Period</th>
                    <th className="pb-3 font-medium">Orders</th>
                    <th className="pb-3 font-medium">Gross</th>
                    <th className="pb-3 font-medium">Commission</th>
                    <th className="pb-3 font-medium">Net Payout</th>
                    <th className="pb-3 font-medium">Status</th>
                    {isAdmin && <th className="pb-3 font-medium">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {payouts.map((payout) => (
                    <tr key={payout._id}>
                      <td className="py-3">
                        <span className="text-xs">
                          {new Date(payout.periodStart).toLocaleDateString()} – {new Date(payout.periodEnd).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="py-3">{payout.totalOrders}</td>
                      <td className="py-3">₹{payout.grossRevenue.toFixed(0)}</td>
                      <td className="py-3 text-red-500">-₹{payout.commissionAmount.toFixed(0)} ({payout.commissionRate}%)</td>
                      <td className="py-3 font-medium">₹{payout.netPayout.toFixed(0)}</td>
                      <td className="py-3">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPayoutStatusColor(payout.status)}`}>
                          {payout.status}
                        </span>
                      </td>
                      {isAdmin && (
                        <td className="py-3">
                          {payout.status === 'Pending' && (
                            <div className="flex gap-1">
                              <button
                                onClick={() => handlePayoutStatusChange(payout._id, 'Processing')}
                                className="text-xs text-blue-600 hover:underline"
                              >
                                Process
                              </button>
                              <button
                                onClick={() => handlePayoutStatusChange(payout._id, 'Failed')}
                                className="text-xs text-red-500 hover:underline ml-2"
                              >
                                Fail
                              </button>
                            </div>
                          )}
                          {payout.status === 'Processing' && (
                            <button
                              onClick={() => handlePayoutStatusChange(payout._id, 'Paid')}
                              className="text-xs text-green-600 hover:underline"
                            >
                              Mark Paid
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Create Payout Modal */}
        <Modal isOpen={showPayoutModal} onClose={() => setShowPayoutModal(false)} title="Create Payout" size="sm">
          <div className="space-y-4">
            <p className="text-sm text-slate-500">
              Calculate and record a payout for <span className="font-medium">{selectedVendor?.name}</span> based on delivered orders in the selected period.
            </p>
            <Input
              label="Period Start"
              type="date"
              value={payoutForm.periodStart}
              onChange={(e) => setPayoutForm({ ...payoutForm, periodStart: e.target.value })}
            />
            <Input
              label="Period End"
              type="date"
              value={payoutForm.periodEnd}
              onChange={(e) => setPayoutForm({ ...payoutForm, periodEnd: e.target.value })}
            />
            <div>
              <label className="block text-sm font-medium mb-1.5">Notes (optional)</label>
              <textarea
                className="w-full px-4 py-2 border border-slate-200 dark:border-slate-800 dark:bg-slate-800 rounded-lg"
                rows="2"
                placeholder="Payment reference, bank details..."
                value={payoutForm.notes}
                onChange={(e) => setPayoutForm({ ...payoutForm, notes: e.target.value })}
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button
                onClick={() => setShowPayoutModal(false)}
                className="flex-1 !bg-slate-100 !text-slate-700 hover:!bg-slate-200 dark:!bg-slate-800 dark:!text-slate-300"
                disabled={creatingPayout}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreatePayout}
                className="flex-1"
                disabled={creatingPayout || !payoutForm.periodStart || !payoutForm.periodEnd}
              >
                {creatingPayout ? 'Creating...' : 'Create Payout'}
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </Layout>
  );
};

export default VendorDashboard;
