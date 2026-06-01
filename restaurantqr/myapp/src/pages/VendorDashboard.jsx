import { useEffect, useState } from 'react';
import Layout from '../components/Layout/Layout';
import Card from '../components/UI/Card';
import Input from '../components/UI/Input';
import Button from '../components/UI/Button';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';

const VendorDashboard = () => {
  const { user } = useAuth();
  const [vendors, setVendors] = useState([]);
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [earnings, setEarnings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    commissionRate: 0,
    rating: 0,
    deliveryFee: 0,
    deliveryZonesInput: '',
    operatingHours: {
      open: '09:00',
      close: '22:00',
    },
  });

  useEffect(() => {
    fetchVendors();
  }, []);

  useEffect(() => {
    if (selectedVendorId) {
      fetchEarnings(selectedVendorId);
      hydrateForm(selectedVendorId);
    }
  }, [selectedVendorId]);

  const fetchVendors = async () => {
    try {
      setLoading(true);
      const response = await api.get('/vendors');
      const data = response.data || [];
      setVendors(data);
      const defaultVendor = data[0];
      setSelectedVendorId(defaultVendor?._id || '');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load vendors');
    } finally {
      setLoading(false);
    }
  };

  const fetchEarnings = async (vendorId) => {
    try {
      const response = await api.get(`/vendors/${vendorId}/earnings`);
      setEarnings(response.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load earnings');
    }
  };

  const hydrateForm = (vendorId) => {
    const vendor = vendors.find((item) => item._id === vendorId);
    if (!vendor) {
      return;
    }

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
      setFormData((prev) => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: value,
        },
      }));
      return;
    }

    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveVendor = async () => {
    if (!selectedVendorId) {
      return;
    }

    setSaving(true);
    try {
      const deliveryZones = formData.deliveryZonesInput
        ? formData.deliveryZonesInput.split(',').map((zone) => zone.trim()).filter(Boolean)
        : [];

      await api.put(`/outlets/${selectedVendorId}`, {
        commissionRate: Number(formData.commissionRate) || 0,
        rating: Number(formData.rating) || 0,
        deliveryFee: Number(formData.deliveryFee) || 0,
        deliveryZones: deliveryZones,
        operatingHours: {
          open: formData.operatingHours.open || '09:00',
          close: formData.operatingHours.close || '22:00',
        },
      });
      await fetchVendors();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save vendor settings');
    } finally {
      setSaving(false);
    }
  };

  const selectedVendor = vendors.find((vendor) => vendor._id === selectedVendorId);

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
    <Layout
      headerProps={{
        title: "Vendor Management",
        subtitle: user?.role === 'Vendor' ? 'Your outlet settings and earnings' : 'Manage vendor profiles',
      }}
    >
      <div className="space-y-6">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <Card>
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">
                Select Vendor
              </label>
              <select
                className="w-full border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 px-4 py-2"
                value={selectedVendorId}
                onChange={(e) => setSelectedVendorId(e.target.value)}
                disabled={user?.role === 'Vendor'}
              >
                {vendors.map((vendor) => (
                  <option key={vendor._id} value={vendor._id}>
                    {vendor.name}
                  </option>
                ))}
              </select>
            </div>
            {selectedVendor && (
              <div className="text-sm text-slate-500 dark:text-slate-400">
                Outlet ID: <span className="font-medium text-slate-700 dark:text-slate-200">{selectedVendor.outletId}</span>
              </div>
            )}
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2" title="Vendor Profile">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input
                label="Commission Rate (%)"
                value={formData.commissionRate}
                onChange={(e) => handleFormChange('commissionRate', e.target.value)}
                type="number"
              />
              <Input
                label="Rating (0-5)"
                value={formData.rating}
                onChange={(e) => handleFormChange('rating', e.target.value)}
                type="number"
              />
              <Input
                label="Delivery Fee"
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
                label="Operating Hours (Open)"
                value={formData.operatingHours.open}
                onChange={(e) => handleFormChange('operatingHours.open', e.target.value)}
                type="time"
              />
              <Input
                label="Operating Hours (Close)"
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

          <Card title="Earnings Summary">
            <div className="space-y-4">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Total Orders</p>
                <p className="text-2xl font-bold">{earnings?.totalOrders || 0}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Total Revenue</p>
                <p className="text-2xl font-bold">₹{(earnings?.totalRevenue || 0).toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Status Breakdown</p>
                <div className="space-y-2 mt-2">
                  {earnings?.statusBreakdown && Object.keys(earnings.statusBreakdown).length > 0 ? (
                    Object.entries(earnings.statusBreakdown).map(([status, stats]) => (
                      <div key={status} className="flex items-center justify-between text-sm">
                        <span>{status}</span>
                        <span className="font-medium">{stats.totalOrders}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-400">No earnings data yet</p>
                  )}
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default VendorDashboard;
