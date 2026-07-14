import { useEffect, useState } from 'react';
import Layout from '../components/Layout/Layout';
import Card from '../components/UI/Card';
import Input from '../components/UI/Input';
import Select from '../components/UI/Select';
import Button from '../components/UI/Button';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';

const LocationDelivery = () => {
  const { user, updateUser } = useAuth();
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingLocation, setEditingLocation] = useState(null);
  const [saving, setSaving] = useState(false);
  const [prefs, setPrefs] = useState({
    defaultDeliveryLocation: '',
    deliveryNotes: '',
  });
  const [formData, setFormData] = useState({
    name: '',
    type: 'Office',
    address: '',
    city: '',
    state: '',
    zoneName: '',
    deliveryFee: 0,
    floorDetailsInput: '',
    receptionPointsInput: '',
  });

  const isAdmin = ['Admin', 'Company Admin', 'Owner', 'Management'].includes(user?.role);

  useEffect(() => {
    fetchLocations();
    setPrefs({
      defaultDeliveryLocation: user?.defaultDeliveryLocation || '',
      deliveryNotes: user?.deliveryNotes || '',
    });
  }, []);

  const fetchLocations = async () => {
    try {
      setLoading(true);
      const response = await api.get('/locations');
      setLocations(response.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load locations');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEditingLocation(null);
    setFormData({
      name: '',
      type: 'Office',
      address: '',
      city: '',
      state: '',
      zoneName: '',
      deliveryFee: 0,
      floorDetailsInput: '',
      receptionPointsInput: '',
    });
  };

  const handleOpenCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const handleOpenEdit = (location) => {
    setEditingLocation(location);
    setFormData({
      name: location.name || '',
      type: location.type || 'Office',
      address: location.address || '',
      city: location.city || '',
      state: location.state || '',
      zoneName: location.zoneName || '',
      deliveryFee: location.deliveryFee || 0,
      floorDetailsInput: location.floorDetails?.map(item => item.floor).join(', ') || '',
      receptionPointsInput: location.receptionPoints?.map(item => item.name).join(', ') || '',
    });
    setShowForm(true);
  };

  const handleSaveLocation = async () => {
    setSaving(true);
    try {
      const payload = {
        name: formData.name,
        type: formData.type,
        address: formData.address,
        city: formData.city,
        state: formData.state,
        zoneName: formData.zoneName || null,
        deliveryFee: Number(formData.deliveryFee) || 0,
        floorDetails: formData.floorDetailsInput
          ? formData.floorDetailsInput.split(',').map((floor) => ({ floor: floor.trim() }))
          : [],
        receptionPoints: formData.receptionPointsInput
          ? formData.receptionPointsInput.split(',').map((point) => ({ name: point.trim() }))
          : [],
      };

      if (editingLocation) {
        await api.put(`/locations/${editingLocation._id}`, payload);
      } else {
        await api.post('/locations', payload);
      }
      await fetchLocations();
      setShowForm(false);
      resetForm();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save location');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLocation = async (location) => {
    if (!window.confirm(`Delete ${location.name}?`)) {
      return;
    }
    try {
      await api.delete(`/locations/${location._id}`);
      await fetchLocations();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete location');
    }
  };

  const handleSavePrefs = async () => {
    try {
      const response = await api.put('/users/profile/me', {
        defaultDeliveryLocation: prefs.defaultDeliveryLocation,
        deliveryNotes: prefs.deliveryNotes,
      });
      updateUser(response.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update preferences');
    }
  };

  if (loading) {
    return (
      <Layout headerProps={{ title: "Loading..." }}>
        <div className="flex items-center justify-center p-8 h-full">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="mt-4 text-slate-600 dark:text-slate-400">Loading locations...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout headerProps={{ title: "Location & Delivery" }}>
      {error && (
        <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2" title="Locations">
          {isAdmin && (
            <div className="flex justify-end mb-4">
              <Button onClick={handleOpenCreate}>Add Location</Button>
            </div>
          )}
          <div className="space-y-3">
            {locations.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">No locations configured yet.</p>
            ) : (
              locations.map((location) => (
                <div
                  key={location._id}
                  className="p-4 border border-slate-200 dark:border-slate-800 rounded-lg flex flex-col md:flex-row md:items-center md:justify-between gap-3"
                >
                  <div>
                    <p className="font-medium">{location.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {location.type} • {location.city}, {location.state}
                    </p>
                    {location.zoneName && (
                      <p className="text-xs text-slate-500 dark:text-slate-400">Zone: {location.zoneName}</p>
                    )}
                  </div>
                  {isAdmin && (
                    <div className="flex items-center gap-2">
                      <Button variant="outline" onClick={() => handleOpenEdit(location)}>Edit</Button>
                      <Button variant="ghost" onClick={() => handleDeleteLocation(location)}>Delete</Button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </Card>

        <Card title="Delivery Preferences">
          <div className="space-y-4">
            <Select
              label="Default Delivery Location"
              value={prefs.defaultDeliveryLocation}
              onChange={(e) => setPrefs((prev) => ({ ...prev, defaultDeliveryLocation: e.target.value }))}
              options={[
                { label: 'Select location', value: '' },
                ...locations.map((location) => ({ label: location.name, value: location.name })),
              ]}
            />
            <div>
              <label className="block text-sm font-medium mb-1.5">Delivery Notes</label>
              <textarea
                className="w-full px-4 py-2 border-slate-200 dark:border-slate-800 dark:bg-slate-800 rounded-lg focus:ring-primary focus:border-primary"
                rows="4"
                value={prefs.deliveryNotes}
                onChange={(e) => setPrefs((prev) => ({ ...prev, deliveryNotes: e.target.value }))}
              />
            </div>
            <Button onClick={handleSavePrefs}>Save Preferences</Button>
          </div>
        </Card>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-shrink-0">
              <h2 className="text-lg font-bold">{editingLocation ? 'Edit Location' : 'Add Location'}</h2>
              <button
                onClick={() => setShowForm(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <span className="material-icons-outlined">close</span>
              </button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <Input
                label="Location Name"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              />
              <Select
                label="Type"
                value={formData.type}
                onChange={(e) => setFormData((prev) => ({ ...prev, type: e.target.value }))}
                options={['Office', 'Delivery Zone']}
              />
              <Input
                label="Address"
                value={formData.address}
                onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="City"
                  value={formData.city}
                  onChange={(e) => setFormData((prev) => ({ ...prev, city: e.target.value }))}
                />
                <Input
                  label="State"
                  value={formData.state}
                  onChange={(e) => setFormData((prev) => ({ ...prev, state: e.target.value }))}
                />
              </div>
              <Input
                label="Zone Name"
                value={formData.zoneName}
                onChange={(e) => setFormData((prev) => ({ ...prev, zoneName: e.target.value }))}
              />
              <Input
                label="Delivery Fee"
                type="number"
                value={formData.deliveryFee}
                onChange={(e) => setFormData((prev) => ({ ...prev, deliveryFee: e.target.value }))}
              />
              <Input
                label="Floor Details (comma separated)"
                value={formData.floorDetailsInput}
                onChange={(e) => setFormData((prev) => ({ ...prev, floorDetailsInput: e.target.value }))}
              />
              <Input
                label="Reception Points (comma separated)"
                value={formData.receptionPointsInput}
                onChange={(e) => setFormData((prev) => ({ ...prev, receptionPointsInput: e.target.value }))}
              />
            </div>
            <div className="p-6 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3 flex-shrink-0">
              <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button onClick={handleSaveLocation} disabled={saving}>
                {saving ? 'Saving...' : 'Save Location'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default LocationDelivery;
