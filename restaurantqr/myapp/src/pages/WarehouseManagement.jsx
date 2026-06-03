import { useEffect, useState } from 'react';
import Layout from '../components/Layout/Layout';
import Card from '../components/UI/Card';
import Input from '../components/UI/Input';
import Button from '../components/UI/Button';
import Modal from '../components/UI/Modal';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';

const UNITS = ['pcs', 'kg', 'g', 'litre', 'ml', 'box', 'crate', 'dozen'];
const ZONES = ['North Zone', 'South Zone', 'East Zone', 'West Zone', 'Central'];

const emptyWarehouseForm = {
  name: '',
  address: '',
  city: '',
  state: '',
  zone: '',
  contactName: '',
  contactPhone: '',
  linkedOutlets: [],
};

const emptyItem = { name: '', sku: '', quantity: 0, unit: 'pcs', threshold: 10 };

const WarehouseManagement = () => {
  const { user } = useAuth();
  const isAdmin = ['Admin', 'Company Admin'].includes(user?.role);

  const [warehouses, setWarehouses] = useState([]);
  const [outlets, setOutlets] = useState([]);
  const [lowStockAlerts, setLowStockAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Modals
  const [warehouseModal, setWarehouseModal] = useState({ open: false, data: null });
  const [inventoryModal, setInventoryModal] = useState({ open: false, warehouse: null });
  const [deleteModal, setDeleteModal] = useState({ open: false, warehouse: null });
  const [adjustModal, setAdjustModal] = useState({ open: false, warehouseId: null, item: null });

  const [formData, setFormData] = useState(emptyWarehouseForm);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [adjustForm, setAdjustForm] = useState({ operation: 'add', quantity: 1 });
  const [activeWarehouse, setActiveWarehouse] = useState(null);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [whRes, outletRes] = await Promise.all([
        api.get('/warehouse'),
        api.get('/outlets'),
      ]);
      setWarehouses(whRes.data || []);
      setOutlets(outletRes.data || []);
      if (isAdmin) {
        try {
          const alertsRes = await api.get('/warehouse/alerts/low-stock');
          setLowStockAlerts(alertsRes.data || []);
        } catch (_) {}
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load warehouses');
    } finally {
      setLoading(false);
    }
  };

  // Warehouse CRUD
  const openCreateWarehouse = () => {
    setFormData(emptyWarehouseForm);
    setWarehouseModal({ open: true, data: null });
  };

  const openEditWarehouse = (warehouse) => {
    setFormData({
      name: warehouse.name || '',
      address: warehouse.address || '',
      city: warehouse.city || '',
      state: warehouse.state || '',
      zone: warehouse.zone || '',
      contactName: warehouse.contactName || '',
      contactPhone: warehouse.contactPhone || '',
      linkedOutlets: warehouse.linkedOutlets?.map((o) => o._id || o) || [],
    });
    setWarehouseModal({ open: true, data: warehouse });
  };

  const handleSaveWarehouse = async () => {
    if (!formData.name || !formData.address || !formData.city || !formData.state || !formData.zone) {
      setError('Please fill all required fields');
      return;
    }
    setSaving(true);
    try {
      if (warehouseModal.data) {
        const updated = await api.put(`/warehouse/${warehouseModal.data._id}`, formData);
        setWarehouses((prev) => prev.map((w) => w._id === warehouseModal.data._id ? updated.data : w));
      } else {
        const created = await api.post('/warehouse', formData);
        setWarehouses((prev) => [created.data, ...prev]);
      }
      setWarehouseModal({ open: false, data: null });
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save warehouse');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteWarehouse = async () => {
    const warehouse = deleteModal.warehouse;
    try {
      await api.delete(`/warehouse/${warehouse._id}`);
      setWarehouses((prev) => prev.filter((w) => w._id !== warehouse._id));
      setDeleteModal({ open: false, warehouse: null });
      if (activeWarehouse?._id === warehouse._id) setActiveWarehouse(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete warehouse');
    }
  };

  // Inventory management
  const openInventoryModal = (warehouse) => {
    const items = warehouse.inventoryItems?.length
      ? warehouse.inventoryItems.map((i) => ({ ...i }))
      : [{ ...emptyItem }];
    setInventoryItems(items);
    setInventoryModal({ open: true, warehouse });
  };

  const handleInventoryItemChange = (index, field, value) => {
    setInventoryItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleSaveInventory = async () => {
    const validItems = inventoryItems.filter((i) => i.name.trim());
    setSaving(true);
    try {
      const res = await api.put(`/warehouse/${inventoryModal.warehouse._id}/inventory`, {
        inventoryItems: validItems,
      });
      setWarehouses((prev) => prev.map((w) => w._id === inventoryModal.warehouse._id ? res.data : w));
      if (activeWarehouse?._id === inventoryModal.warehouse._id) setActiveWarehouse(res.data);
      setInventoryModal({ open: false, warehouse: null });
      // Refresh low stock alerts
      if (isAdmin) {
        const alertsRes = await api.get('/warehouse/alerts/low-stock');
        setLowStockAlerts(alertsRes.data || []);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save inventory');
    } finally {
      setSaving(false);
    }
  };

  // Stock adjustment
  const openAdjustModal = (warehouseId, item) => {
    setAdjustForm({ operation: 'add', quantity: 1 });
    setAdjustModal({ open: true, warehouseId, item });
  };

  const handleAdjustStock = async () => {
    setSaving(true);
    try {
      const res = await api.patch(
        `/warehouse/${adjustModal.warehouseId}/inventory/${adjustModal.item._id}/adjust`,
        adjustForm
      );
      setWarehouses((prev) => prev.map((w) => w._id === adjustModal.warehouseId ? res.data : w));
      if (activeWarehouse?._id === adjustModal.warehouseId) setActiveWarehouse(res.data);
      setAdjustModal({ open: false, warehouseId: null, item: null });
      if (isAdmin) {
        const alertsRes = await api.get('/warehouse/alerts/low-stock');
        setLowStockAlerts(alertsRes.data || []);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to adjust stock');
    } finally {
      setSaving(false);
    }
  };

  const getStockStatus = (item) => {
    if (item.quantity === 0) return { label: 'Out of Stock', color: 'text-red-600 dark:text-red-400' };
    if (item.quantity <= item.threshold) return { label: 'Low Stock', color: 'text-yellow-600 dark:text-yellow-400' };
    return { label: 'In Stock', color: 'text-green-600 dark:text-green-400' };
  };

  const displayWarehouse = activeWarehouse
    ? warehouses.find((w) => w._id === activeWarehouse._id) || activeWarehouse
    : null;

  if (loading) {
    return (
      <Layout headerProps={{ title: 'Warehouse Management' }}>
        <div className="flex items-center justify-center p-8 h-full">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            <p className="mt-4 text-slate-600 dark:text-slate-400">Loading warehouses...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout
      headerProps={{
        title: 'Warehouse Management',
        actionButton: isAdmin ? (
          <Button onClick={openCreateWarehouse}>
            <span className="material-icons-outlined text-sm mr-1">add</span>
            Add Warehouse
          </Button>
        ) : null,
      }}
    >
      <div className="p-8 space-y-6">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError('')}>
              <span className="material-icons-outlined text-sm">close</span>
            </button>
          </div>
        )}

        {/* Low Stock Alerts */}
        {isAdmin && lowStockAlerts.length > 0 && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="material-icons-outlined text-yellow-600 dark:text-yellow-400">warning</span>
              <h3 className="font-semibold text-yellow-800 dark:text-yellow-300">
                Low Stock Alerts ({lowStockAlerts.length})
              </h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {lowStockAlerts.map((alert) => (
                <div key={`${alert.warehouseId}-${alert.itemId}`} className="text-sm bg-white dark:bg-slate-900 rounded-lg px-3 py-2 flex items-center justify-between">
                  <div>
                    <span className="font-medium">{alert.itemName}</span>
                    <span className="text-slate-400 ml-1 text-xs">— {alert.warehouseName}</span>
                  </div>
                  <span className={`font-bold ${alert.quantity === 0 ? 'text-red-500' : 'text-yellow-600'}`}>
                    {alert.quantity} {alert.unit}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Warehouse List + Detail layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Warehouse List */}
          <div className="space-y-3">
            {warehouses.length === 0 ? (
              <Card>
                <div className="text-center py-8">
                  <span className="material-icons-outlined text-5xl text-slate-300 dark:text-slate-700 mb-3">warehouse</span>
                  <p className="text-slate-500 dark:text-slate-400">No warehouses yet</p>
                  {isAdmin && (
                    <Button onClick={openCreateWarehouse} className="mt-4">
                      Add First Warehouse
                    </Button>
                  )}
                </div>
              </Card>
            ) : (
              warehouses.map((warehouse) => {
                const totalItems = warehouse.inventoryItems?.length || 0;
                const lowItems = warehouse.inventoryItems?.filter((i) => i.quantity <= i.threshold).length || 0;
                const isActive = activeWarehouse?._id === warehouse._id;

                return (
                  <div
                    key={warehouse._id}
                    onClick={() => setActiveWarehouse(warehouse)}
                    className={`cursor-pointer rounded-xl border p-4 transition-all ${
                      isActive
                        ? 'border-primary bg-primary/5'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-primary/50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-slate-900 dark:text-white">{warehouse.name}</h3>
                        <p className="text-xs text-slate-400 mt-0.5">{warehouse.city}, {warehouse.zone}</p>
                      </div>
                      <span className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${
                        warehouse.isActive ? 'bg-green-400' : 'bg-slate-400'
                      }`} />
                    </div>
                    <div className="flex gap-3 mt-3 text-xs">
                      <span className="text-slate-500">{totalItems} items</span>
                      {lowItems > 0 && (
                        <span className="text-yellow-600 dark:text-yellow-400 font-medium">
                          {lowItems} low stock
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Right: Warehouse Detail */}
          <div className="lg:col-span-2">
            {!displayWarehouse ? (
              <Card>
                <div className="text-center py-16">
                  <span className="material-icons-outlined text-5xl text-slate-300 dark:text-slate-700 mb-3">inventory_2</span>
                  <p className="text-slate-400">Select a warehouse to view details</p>
                </div>
              </Card>
            ) : (
              <div className="space-y-4">
                {/* Header card */}
                <Card>
                  <div className="flex items-start justify-between flex-wrap gap-4">
                    <div>
                      <h2 className="text-lg font-bold">{displayWarehouse.name}</h2>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        {displayWarehouse.address}, {displayWarehouse.city}, {displayWarehouse.state}
                      </p>
                      <p className="text-sm text-slate-400 mt-1">{displayWarehouse.zone}</p>
                      {displayWarehouse.contactName && (
                        <p className="text-sm text-slate-400 mt-1">
                          Contact: {displayWarehouse.contactName}
                          {displayWarehouse.contactPhone && ` · ${displayWarehouse.contactPhone}`}
                        </p>
                      )}
                      {displayWarehouse.linkedOutlets?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {displayWarehouse.linkedOutlets.map((outlet) => (
                            <span key={outlet._id || outlet} className="px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full">
                              {outlet.name || 'Outlet'}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    {isAdmin && (
                      <div className="flex gap-2">
                        <Button
                          onClick={() => openEditWarehouse(displayWarehouse)}
                          className="!bg-slate-100 !text-slate-700 hover:!bg-slate-200 dark:!bg-slate-800 dark:!text-slate-300"
                        >
                          <span className="material-icons-outlined text-sm mr-1">edit</span>
                          Edit
                        </Button>
                        <Button
                          onClick={() => setDeleteModal({ open: true, warehouse: displayWarehouse })}
                          className="!bg-red-50 !text-red-600 hover:!bg-red-100 dark:!bg-red-900/20"
                        >
                          <span className="material-icons-outlined text-sm">delete</span>
                        </Button>
                      </div>
                    )}
                  </div>
                </Card>

                {/* Inventory */}
                <Card>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold">Inventory Items ({displayWarehouse.inventoryItems?.length || 0})</h3>
                    <Button onClick={() => openInventoryModal(displayWarehouse)}>
                      <span className="material-icons-outlined text-sm mr-1">edit</span>
                      Manage Items
                    </Button>
                  </div>

                  {!displayWarehouse.inventoryItems?.length ? (
                    <p className="text-sm text-slate-400 py-4">No inventory items. Click Manage Items to add stock.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                            <th className="pb-3 font-medium">Item</th>
                            <th className="pb-3 font-medium">SKU</th>
                            <th className="pb-3 font-medium text-right">Qty</th>
                            <th className="pb-3 font-medium text-right">Threshold</th>
                            <th className="pb-3 font-medium">Status</th>
                            <th className="pb-3 font-medium">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {displayWarehouse.inventoryItems.map((item) => {
                            const status = getStockStatus(item);
                            return (
                              <tr key={item._id}>
                                <td className="py-3 font-medium">{item.name}</td>
                                <td className="py-3 text-slate-400">{item.sku || '—'}</td>
                                <td className="py-3 text-right font-medium">{item.quantity} {item.unit}</td>
                                <td className="py-3 text-right text-slate-400">{item.threshold} {item.unit}</td>
                                <td className="py-3">
                                  <span className={`text-xs font-medium ${status.color}`}>{status.label}</span>
                                </td>
                                <td className="py-3">
                                  <button
                                    onClick={() => openAdjustModal(displayWarehouse._id, item)}
                                    className="text-xs text-primary hover:underline"
                                  >
                                    Adjust
                                  </button>
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
            )}
          </div>
        </div>
      </div>

      {/* Create/Edit Warehouse Modal */}
      <Modal
        isOpen={warehouseModal.open}
        onClose={() => setWarehouseModal({ open: false, data: null })}
        title={warehouseModal.data ? 'Edit Warehouse' : 'Add Warehouse'}
        size="md"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Warehouse Name *"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Central Warehouse"
            />
            <div>
              <label className="block text-sm font-medium mb-1.5">Zone *</label>
              <select
                className="w-full border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 px-4 py-2"
                value={formData.zone}
                onChange={(e) => setFormData({ ...formData, zone: e.target.value })}
              >
                <option value="">Select zone</option>
                {ZONES.map((z) => <option key={z} value={z}>{z}</option>)}
              </select>
            </div>
            <Input
              label="City *"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
            />
            <Input
              label="State *"
              value={formData.state}
              onChange={(e) => setFormData({ ...formData, state: e.target.value })}
            />
            <Input
              label="Contact Name"
              value={formData.contactName}
              onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
            />
            <Input
              label="Contact Phone"
              value={formData.contactPhone}
              onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
            />
          </div>
          <Input
            label="Address *"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            placeholder="Street address"
          />
          <div>
            <label className="block text-sm font-medium mb-1.5">Linked Outlets</label>
            <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
              {outlets.map((outlet) => (
                <label key={outlet._id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.linkedOutlets.includes(outlet._id)}
                    onChange={(e) => {
                      const updated = e.target.checked
                        ? [...formData.linkedOutlets, outlet._id]
                        : formData.linkedOutlets.filter((id) => id !== outlet._id);
                      setFormData({ ...formData, linkedOutlets: updated });
                    }}
                    className="rounded"
                  />
                  {outlet.name}
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button
              onClick={() => setWarehouseModal({ open: false, data: null })}
              className="flex-1 !bg-slate-100 !text-slate-700 hover:!bg-slate-200 dark:!bg-slate-800 dark:!text-slate-300"
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveWarehouse} className="flex-1" disabled={saving}>
              {saving ? 'Saving...' : warehouseModal.data ? 'Save Changes' : 'Create Warehouse'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Inventory Management Modal */}
      <Modal
        isOpen={inventoryModal.open}
        onClose={() => setInventoryModal({ open: false, warehouse: null })}
        title={`Manage Inventory — ${inventoryModal.warehouse?.name}`}
        size="lg"
      >
        <div className="space-y-3">
          <div className="grid grid-cols-12 gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 px-1">
            <span className="col-span-3">Name *</span>
            <span className="col-span-2">SKU</span>
            <span className="col-span-2">Qty</span>
            <span className="col-span-2">Unit</span>
            <span className="col-span-2">Threshold</span>
            <span className="col-span-1"></span>
          </div>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {inventoryItems.map((item, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                <input
                  className="col-span-3 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm dark:bg-slate-800"
                  placeholder="Item name"
                  value={item.name}
                  onChange={(e) => handleInventoryItemChange(idx, 'name', e.target.value)}
                />
                <input
                  className="col-span-2 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm dark:bg-slate-800"
                  placeholder="SKU"
                  value={item.sku || ''}
                  onChange={(e) => handleInventoryItemChange(idx, 'sku', e.target.value)}
                />
                <input
                  type="number"
                  className="col-span-2 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm dark:bg-slate-800"
                  placeholder="0"
                  value={item.quantity}
                  min={0}
                  onChange={(e) => handleInventoryItemChange(idx, 'quantity', Number(e.target.value))}
                />
                <select
                  className="col-span-2 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-2 text-sm dark:bg-slate-800"
                  value={item.unit}
                  onChange={(e) => handleInventoryItemChange(idx, 'unit', e.target.value)}
                >
                  {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
                <input
                  type="number"
                  className="col-span-2 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm dark:bg-slate-800"
                  placeholder="10"
                  value={item.threshold}
                  min={0}
                  onChange={(e) => handleInventoryItemChange(idx, 'threshold', Number(e.target.value))}
                />
                <button
                  onClick={() => setInventoryItems((prev) => prev.filter((_, i) => i !== idx))}
                  className="col-span-1 text-red-400 hover:text-red-600 flex justify-center"
                >
                  <span className="material-icons-outlined text-sm">delete</span>
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={() => setInventoryItems((prev) => [...prev, { ...emptyItem }])}
            className="text-sm text-primary hover:underline flex items-center gap-1"
          >
            <span className="material-icons-outlined text-sm">add</span>
            Add Item
          </button>
          <div className="flex gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
            <Button
              onClick={() => setInventoryModal({ open: false, warehouse: null })}
              className="flex-1 !bg-slate-100 !text-slate-700 hover:!bg-slate-200 dark:!bg-slate-800 dark:!text-slate-300"
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveInventory} className="flex-1" disabled={saving}>
              {saving ? 'Saving...' : 'Save Inventory'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Adjust Stock Modal */}
      <Modal
        isOpen={adjustModal.open}
        onClose={() => setAdjustModal({ open: false, warehouseId: null, item: null })}
        title={`Adjust Stock — ${adjustModal.item?.name}`}
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            Current stock: <span className="font-bold">{adjustModal.item?.quantity} {adjustModal.item?.unit}</span>
          </p>
          <div>
            <label className="block text-sm font-medium mb-2">Operation</label>
            <div className="flex gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="op"
                  value="add"
                  checked={adjustForm.operation === 'add'}
                  onChange={() => setAdjustForm({ ...adjustForm, operation: 'add' })}
                />
                <span className="text-sm text-green-600">Add Stock</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="op"
                  value="subtract"
                  checked={adjustForm.operation === 'subtract'}
                  onChange={() => setAdjustForm({ ...adjustForm, operation: 'subtract' })}
                />
                <span className="text-sm text-red-600">Remove Stock</span>
              </label>
            </div>
          </div>
          <Input
            label="Quantity"
            type="number"
            value={adjustForm.quantity}
            onChange={(e) => setAdjustForm({ ...adjustForm, quantity: Number(e.target.value) })}
            min={1}
          />
          <div className="flex gap-3">
            <Button
              onClick={() => setAdjustModal({ open: false, warehouseId: null, item: null })}
              className="flex-1 !bg-slate-100 !text-slate-700 hover:!bg-slate-200 dark:!bg-slate-800 dark:!text-slate-300"
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleAdjustStock} className="flex-1" disabled={saving}>
              {saving ? 'Adjusting...' : `${adjustForm.operation === 'add' ? 'Add' : 'Remove'} ${adjustForm.quantity} ${adjustModal.item?.unit}`}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <Modal
        isOpen={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, warehouse: null })}
        title="Delete Warehouse"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-slate-600 dark:text-slate-400">
            Are you sure you want to delete <span className="font-bold">{deleteModal.warehouse?.name}</span>? This cannot be undone.
          </p>
          <div className="flex gap-3">
            <Button
              onClick={() => setDeleteModal({ open: false, warehouse: null })}
              className="flex-1 !bg-slate-100 !text-slate-700 hover:!bg-slate-200 dark:!bg-slate-800 dark:!text-slate-300"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeleteWarehouse}
              className="flex-1 !bg-red-600 hover:!bg-red-700 !text-white"
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </Layout>
  );
};

export default WarehouseManagement;
