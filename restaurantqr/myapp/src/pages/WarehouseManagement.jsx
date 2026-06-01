import { useEffect, useState } from 'react';
import Layout from '../components/Layout/Layout';
import Card from '../components/UI/Card';
import Input from '../components/UI/Input';
import Button from '../components/UI/Button';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';

const WarehouseManagement = () => {
  const { user } = useAuth();
  const isAdmin = ['Admin', 'Company Admin'].includes(user?.role);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState(null);
  const [saving, setSaving] = useState(false);
  const [inventoryEditor, setInventoryEditor] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    city: '',
    state: '',
    zone: '',
  });

  useEffect(() => {
    fetchWarehouses();
  }, []);

  const fetchWarehouses = async () => {
    try {
      setLoading(true);
      const response = await api.get('/warehouse');
      setWarehouses(response.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load warehouses');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEditingWarehouse(null);
    setFormData({ name: '', address: '', city: '', state: '', zone: '' });
  };

  const handleOpenCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const handleOpenEdit = (warehouse) => {
    setEditingWarehouse(warehouse);
    setFormData({
      name: warehouse.name || '',
      address: warehouse.address || '',
      city: warehouse.city || '',
      state: warehouse.state || '',
      zone: warehouse.zone || '',
    });
    setShowForm(true);
  };

  const handleSaveWarehouse = async () => {
    setSaving(true);
    try {
      if (editingWarehouse) {
        await api.put(`/warehouse/${editingWarehouse._id}`, formData);
      } else {
        await api.post('/warehouse', formData);
      }
      await fetchWarehouses();
      setShowForm(false);
      resetForm();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save warehouse');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteWarehouse = async (warehouse) => {
    if (!window.confirm(`Delete ${warehouse.name}?`)) {
      return;
    }
    try {
      await api.delete(`/warehouse/${warehouse._id}`);
      await fetchWarehouses();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete warehouse');
    }
  };

  const handleInventoryUpdate = async (warehouseId, inventoryItems) => {
    try {
      await api.put(`/warehouse/${warehouseId}/inventory`, { inventoryItems });
      await fetchWarehouses();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update inventory');
    }
  };

  const openInventoryEditor = (warehouse) => {
    setInventoryEditor({
      warehouseId: warehouse._id,
      name: warehouse.name,
      items: warehouse.inventoryItems?.length ? warehouse.inventoryItems : [{ name: '', quantity: 0, unit: 'pcs' }],
    });
  };

  const updateInventoryItem = (index, field, value) => {
    setInventoryEditor((prev) => {
      const updated = [...prev.items];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, items: updated };
    });
  };

  const addInventoryItem = () => {
    setInventoryEditor((prev) => ({
      ...prev,
      items: [...prev.items, { name: '', quantity: 0, unit: 'pcs' }],
    }));
  };

  const removeInventoryItem = (index) => {
    setInventoryEditor((prev) => ({
      ...prev,
      items: prev.items.filter((_, idx) => idx !== index),
    }));
  };

  if (loading) {
    return (
      <Layout headerProps={{ title: "Warehouse Management" }}>
        <div className="flex items-center justify-center p-8 h-full">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="mt-4 text-slate-600 dark:text-slate-400">Loading warehouses...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout headerProps={{ title: "Warehouse Management" }}>
      <div className="w-full">
        {error && (
          <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}
        {isAdmin && (
          <div className="mb-4 flex justify-end">
            <Button onClick={handleOpenCreate}>Add Warehouse</Button>
          </div>
        )}
        <div className="space-y-4">
          {warehouses.length === 0 ? (
            <Card>
              <p className="text-sm text-slate-500 dark:text-slate-400">No warehouses configured yet.</p>
            </Card>
          ) : (
            warehouses.map((warehouse) => (
              <Card key={warehouse._id} title={warehouse.name}>
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                  <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{warehouse.address}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {warehouse.city}, {warehouse.state} • {warehouse.zone}
                    </p>
                  </div>
                  {isAdmin && (
                    <div className="flex items-center gap-2">
                      <Button variant="outline" onClick={() => handleOpenEdit(warehouse)}>Edit</Button>
                      <Button variant="ghost" onClick={() => handleDeleteWarehouse(warehouse)}>Delete</Button>
                    </div>
                  )}
                </div>
                <div className="mt-4">
                  <h4 className="text-sm font-semibold mb-2">Inventory Items</h4>
                  {warehouse.inventoryItems?.length ? (
                    <div className="space-y-2">
                      {warehouse.inventoryItems.map((item, index) => (
                        <div key={index} className="flex items-center justify-between text-sm">
                          <span>{item.name}</span>
                          <span className="text-slate-500 dark:text-slate-400">{item.quantity} {item.unit}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">No inventory items yet.</p>
                  )}
                  {!isAdmin && (
                    <Button
                      variant="outline"
                      className="mt-3"
                      onClick={() => openInventoryEditor(warehouse)}
                    >
                      Update Inventory
                    </Button>
                  )}
                </div>
              </Card>
            ))
          )}
        </div>

        {showForm && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-xl">
              <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <h2 className="text-lg font-bold">{editingWarehouse ? 'Edit Warehouse' : 'Add Warehouse'}</h2>
                <button
                  onClick={() => setShowForm(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <span className="material-icons-outlined">close</span>
                </button>
              </div>
              <div className="p-6 space-y-4">
                <Input
                  label="Name"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
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
                  label="Zone"
                  value={formData.zone}
                  onChange={(e) => setFormData((prev) => ({ ...prev, zone: e.target.value }))}
                />
              </div>
              <div className="p-6 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
                <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button onClick={handleSaveWarehouse} disabled={saving}>
                  {saving ? 'Saving...' : 'Save Warehouse'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {inventoryEditor && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-2xl">
              <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <h2 className="text-lg font-bold">Update Inventory - {inventoryEditor.name}</h2>
                <button
                  onClick={() => setInventoryEditor(null)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <span className="material-icons-outlined">close</span>
                </button>
              </div>
              <div className="p-6 space-y-4">
                {inventoryEditor.items.map((item, index) => (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                    <Input
                      label="Item Name"
                      value={item.name}
                      onChange={(e) => updateInventoryItem(index, 'name', e.target.value)}
                    />
                    <Input
                      label="Quantity"
                      type="number"
                      value={item.quantity}
                      onChange={(e) => updateInventoryItem(index, 'quantity', e.target.value)}
                    />
                    <Input
                      label="Unit"
                      value={item.unit}
                      onChange={(e) => updateInventoryItem(index, 'unit', e.target.value)}
                    />
                    <Button variant="ghost" onClick={() => removeInventoryItem(index)}>
                      Remove
                    </Button>
                  </div>
                ))}
                <Button variant="outline" onClick={addInventoryItem}>
                  Add Item
                </Button>
              </div>
              <div className="p-6 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
                <Button variant="ghost" onClick={() => setInventoryEditor(null)}>Cancel</Button>
                <Button
                  onClick={() => handleInventoryUpdate(inventoryEditor.warehouseId, inventoryEditor.items)}
                >
                  Save Inventory
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default WarehouseManagement;
