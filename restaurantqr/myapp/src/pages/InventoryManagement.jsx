import { useState, useEffect } from 'react';
import Layout from '../components/Layout/Layout';
import Button from '../components/UI/Button';
import Card from '../components/UI/Card';
import Select from '../components/UI/Select';
import Input from '../components/UI/Input';
import api from '../utils/api';

const InventoryManagement = () => {
  const [inventory, setInventory] = useState([]);
  const [filteredInventory, setFilteredInventory] = useState([]);
  const [selectedOutlet, setSelectedOutlet] = useState('All Outlets');
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('current');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [incomingDispatches, setIncomingDispatches] = useState([]);
  const [activeGRNOrder, setActiveGRNOrder] = useState(null);
  const [grnItems, setGrnItems] = useState([]);
  const [grnNotes, setGrnNotes] = useState('');
  const [grnSaving, setGrnSaving] = useState(false);
  const [grnSuccess, setGrnSuccess] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    name: '',
    quantity: '',
    unit: 'Kg',
    threshold: 10,
    category: 'Other',
  });
  const [addingStock, setAddingStock] = useState(false);
  const [addSuccess, setAddSuccess] = useState('');

  const handleSaveNewStock = async (e) => {
    e.preventDefault();
    if (!addForm.name || !addForm.quantity) return;
    setAddingStock(true);
    setError('');
    setAddSuccess('');
    try {
      await api.post('/inventory', {
        name: addForm.name,
        quantity: Number(addForm.quantity),
        unit: addForm.unit,
        threshold: Number(addForm.threshold) || 10,
        category: addForm.category,
      });
      setAddSuccess(`Successfully added ${addForm.quantity} ${addForm.unit} of ${addForm.name}!`);
      setShowAddModal(false);
      setAddForm({ name: '', quantity: '', unit: 'Kg', threshold: 10, category: 'Other' });
      fetchInventory();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save inventory item');
    } finally {
      setAddingStock(false);
    }
  };

  const handleQuickAdjust = async (item, delta) => {
    try {
      await api.patch(`/inventory/${item._id}/quantity`, {
        quantity: Math.abs(delta),
        operation: delta > 0 ? 'add' : 'subtract',
      });
      fetchInventory();
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchInventory();
    fetchDispatches();
  }, [selectedOutlet]);

  const fetchDispatches = async () => {
    try {
      const endpoint = selectedOutlet !== 'All Outlets' ? `/dispatch/orders?outletId=${selectedOutlet}` : '/dispatch/orders';
      const res = await api.get(endpoint);
      setIncomingDispatches(res.data || []);
    } catch (_) {}
  };

  const handleStartGRN = (order) => {
    setActiveGRNOrder(order);
    const initialItems = (order.items || []).map((it) => ({
      menuItemId: it.menuItem?._id || it.menuItem,
      dishName: it.dishName || it.menuItem?.name || 'Dish',
      dispatchedQty: it.dispatchedQty || 0,
      acceptedQty: it.dispatchedQty || 0,
      damagedQty: 0,
      discrepancyReason: '',
      unitCostPrice: it.unitCostPrice || 0,
    }));
    setGrnItems(initialItems);
    setGrnNotes('');
    setGrnSuccess('');
  };

  const handleUpdateGRNItem = (index, field, value) => {
    const updated = [...grnItems];
    updated[index][field] = field === 'acceptedQty' || field === 'damagedQty' ? Math.max(0, Number(value) || 0) : value;
    setGrnItems(updated);
  };

  const handleSubmitGRN = async () => {
    if (!activeGRNOrder) return;
    setGrnSaving(true);
    setGrnSuccess('');
    setError('');

    try {
      const res = await api.post(`/dispatch/orders/${activeGRNOrder._id}/receive`, {
        receivedItems: grnItems,
        receiverNotes: grnNotes || 'Confirmed on Web Portal',
      });

      setGrnSuccess(res.data?.message || 'Goods receipt confirmed & stock committed!');
      setActiveGRNOrder(null);
      fetchInventory();
      fetchDispatches();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to process goods receipt.');
    } finally {
      setGrnSaving(false);
    }
  };

  useEffect(() => {
    fetchInventory();

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
    let eventSource;
    try {
      eventSource = new EventSource(`${API_URL}/inventory/stream`);
      eventSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (['quantity_updated', 'transfer_completed', 'item_created', 'item_updated', 'item_deleted'].includes(payload.type)) {
            fetchInventory();
          }
        } catch (_) {}
      };
    } catch (_) {}

    return () => {
      if (eventSource) eventSource.close();
    };
  }, []);

  const fetchInventory = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.get('/inventory');
      setInventory(response.data);
      setFilteredInventory(response.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load inventory');
      console.error('Error fetching inventory:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let filtered = inventory;

    if (selectedOutlet !== 'All Outlets') {
      filtered = filtered.filter(item => {
        const branchId = item.branch?._id || item.branch;
        const branchName = item.branch?.name || item.branch;
        return branchId === selectedOutlet || branchName === selectedOutlet;
      });
    }

    if (selectedCategory !== 'All Categories') {
      filtered = filtered.filter(item => item.category === selectedCategory);
    }

    if (searchTerm) {
      filtered = filtered.filter(
        item =>
          item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.sku?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredInventory(filtered);
  }, [selectedOutlet, selectedCategory, searchTerm, inventory]);

  const outlets = ['All Outlets', ...new Set(inventory.map(item => item.branch?.name || item.branch).filter(Boolean))];
  const categories = ['All Categories', ...new Set(inventory.map(item => item.category).filter(Boolean))];

  const isLowStock = (item) => item.quantity < item.threshold;

  if (loading) {
    return (
      <Layout headerProps={{ title: "Loading..." }}>
        <div className="flex items-center justify-center p-8 h-full">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="mt-4 text-slate-600 dark:text-slate-400">Loading inventory...</p>
          </div>
        </div>
  
      {/* Add Stock Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
              <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                <span className="material-icons-outlined text-primary">inventory_2</span>
                Add Raw Material / Stock
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <span className="material-icons-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveNewStock} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                  Item / Ingredient Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Amul Table Butter, Fresh Malai Paneer"
                  value={addForm.name}
                  onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                    Quantity to Add
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="e.g. 4 or 45"
                    value={addForm.quantity}
                    onChange={(e) => setAddForm({ ...addForm, quantity: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                    Unit
                  </label>
                  <select
                    value={addForm.unit}
                    onChange={(e) => setAddForm({ ...addForm, unit: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="Kg">Kg</option>
                    <option value="L">L</option>
                    <option value="g">g</option>
                    <option value="ml">ml</option>
                    <option value="pcs">pcs</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                    Category
                  </label>
                  <select
                    value={addForm.category}
                    onChange={(e) => setAddForm({ ...addForm, category: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="Vegetables">Vegetables</option>
                    <option value="Meat">Meat</option>
                    <option value="Oils">Oils</option>
                    <option value="Grains">Grains</option>
                    <option value="Spices">Spices</option>
                    <option value="Other">Other (Dairy / Packaging)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                    Alert Threshold
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={addForm.threshold}
                    onChange={(e) => setAddForm({ ...addForm, threshold: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                <Button variant="outline" type="button" onClick={() => setShowAddModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={addingStock}>
                  {addingStock ? 'Saving...' : 'Add to Stock'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
    );
  }

  return (
    <Layout
      headerProps={{
        title: "Inventory Management",
        actionButton: (
          <div className="flex gap-3">
            <Button variant="outline">
              <span className="material-icons-outlined mr-2 text-xl">swap_horiz</span>
              Transfer Stock
            </Button>
            <Button onClick={() => setShowAddModal(true)}>
              <span className="material-icons-outlined mr-2 text-xl">add</span>
              Add Stock
            </Button>
          </div>
        )
      }}
    >
      <div className="p-6 md:p-8 space-y-6">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}
        {/* Filters */}
        <div className="flex flex-wrap gap-4 items-center">
          <div className="relative min-w-[180px]">
            <Select
              value={selectedOutlet}
              onChange={(e) => setSelectedOutlet(e.target.value)}
              options={outlets}
              className="w-full"
            />
          </div>
          <div className="relative flex-1 min-w-[250px]">
            <Input
              placeholder="Search items or SKU..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
            <span className="material-icons-outlined absolute left-3 top-2.5 text-slate-400">search</span>
          </div>
          <div className="relative min-w-[180px]">
            <Select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              options={categories}
              className="w-full"
            />
          </div>
        </div>

        {/* Inventory Table */}
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-sm font-medium">
                  <th className="px-6 py-4">Item Name</th>
                  <th className="px-6 py-4">SKU/Code</th>
                  <th className="px-6 py-4">Unit</th>
                  <th className="px-6 py-4">Quantity</th>
                  <th className="px-6 py-4">Threshold</th>
                  <th className="px-6 py-4">Branch</th>
                  <th className="px-6 py-4">Last Updated</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="text-slate-700 dark:text-slate-300">
                {filteredInventory.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                      No inventory items found
                    </td>
                  </tr>
                ) : (
                  filteredInventory.map((item) => (
                    <tr
                      key={item._id}
                      className={`border-t border-slate-200 dark:border-slate-800 ${isLowStock(item) ? 'bg-red-50/50 dark:bg-red-900/10' : ''
                        }`}
                    >
                      <td className="px-6 py-4 font-medium">{item.name}</td>
                      <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{item.sku}</td>
                      <td className="px-6 py-4">{item.unit}</td>
                      <td
                        className={`px-6 py-4 font-semibold ${isLowStock(item) ? 'text-red-600' : 'text-green-600'
                          }`}
                      >
                        {item.quantity}
                      </td>
                      <td className="px-6 py-4">{item.threshold}</td>
                      <td className="px-6 py-4">{item.branch?.name || item.branch || 'N/A'}</td>
                      <td className="px-6 py-4 text-sm">
                        {item.lastUpdated ? new Date(item.lastUpdated).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            title="Quick Deduct 1"
                            onClick={() => handleQuickAdjust(item, -1)}
                            className="w-6 h-6 rounded bg-slate-100 hover:bg-red-100 text-slate-600 hover:text-red-600 text-xs font-bold flex items-center justify-center transition-colors"
                          >
                            -
                          </button>
                          <button
                            type="button"
                            title="Quick Add 1"
                            onClick={() => handleQuickAdjust(item, 1)}
                            className="w-6 h-6 rounded bg-slate-100 hover:bg-emerald-100 text-slate-600 hover:text-emerald-600 text-xs font-bold flex items-center justify-center transition-colors"
                          >
                            +
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Stock Movement & GRN */}
        <Card>
          <div className="border-b border-slate-200 dark:border-slate-800 flex px-6 overflow-x-auto whitespace-nowrap">
            <button
              onClick={() => setActiveTab('current')}
              className={`py-4 px-4 font-semibold border-b-2 transition-colors ${activeTab === 'current'
                  ? 'text-primary border-primary'
                  : 'text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-700 dark:hover:text-slate-200'
                }`}
            >
              Current Stock
            </button>
            <button
              onClick={() => setActiveTab('grn')}
              className={`py-4 px-4 font-semibold border-b-2 transition-colors ${activeTab === 'grn'
                  ? 'text-primary border-primary'
                  : 'text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-700 dark:hover:text-slate-200'
                }`}
            >
              Inward Dispatches (GRN) ({incomingDispatches.filter(d => d.transitStatus !== 'Reconciled').length})
            </button>
            <button
              onClick={() => setActiveTab('movement')}
              className={`py-4 px-4 font-medium border-b-2 transition-colors ${activeTab === 'movement'
                  ? 'text-primary border-primary'
                  : 'text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-700 dark:hover:text-slate-200'
                }`}
            >
              Stock Movement
            </button>
            <button
              onClick={() => setActiveTab('transfers')}
              className={`py-4 px-4 font-medium border-b-2 transition-colors ${activeTab === 'transfers'
                  ? 'text-primary border-primary'
                  : 'text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-700 dark:hover:text-slate-200'
                }`}
            >
              Transfers
            </button>
          </div>

          {activeTab === 'grn' && (
            <div className="p-6 space-y-6">
              {grnSuccess && (
                <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 p-4 rounded-xl flex items-center gap-2">
                  <span className="material-icons-outlined text-emerald-500">check_circle</span>
                  <span>{grnSuccess}</span>
                </div>
              )}

              {/* Active Inspection Form */}
              {activeGRNOrder ? (
                <div className="p-6 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-primary/30 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700">
                    <div>
                      <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                        <span className="material-icons-outlined text-primary">fact_check</span>
                        Inspecting Delivery: {activeGRNOrder.dispatchNumber}
                      </h3>
                      <p className="text-xs text-slate-500">
                        From: {activeGRNOrder.sourceKitchen?.name || 'Central Kitchen'} | Runner: {activeGRNOrder.runnerName || 'Courier'}
                      </p>
                    </div>
                    <button
                      onClick={() => setActiveGRNOrder(null)}
                      className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      Cancel
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 uppercase">
                          <th className="pb-2">Dish Name</th>
                          <th className="pb-2 w-28">Dispatched</th>
                          <th className="pb-2 w-28">Accepted (Good)</th>
                          <th className="pb-2 w-28">Damaged</th>
                          <th className="pb-2 w-44">Discrepancy Reason</th>
                          <th className="pb-2 w-28">Cost Price</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/60 dark:divide-slate-700/60">
                        {grnItems.map((item, idx) => (
                          <tr key={idx}>
                            <td className="py-2.5 font-semibold text-slate-800 dark:text-slate-100">{item.dishName}</td>
                            <td className="py-2.5 font-bold text-blue-600">{item.dispatchedQty} Units</td>
                            <td className="py-2.5 pr-2">
                              <input
                                type="number"
                                min="0"
                                max={item.dispatchedQty}
                                value={item.acceptedQty}
                                onChange={(e) => handleUpdateGRNItem(idx, 'acceptedQty', e.target.value)}
                                className="w-full bg-white dark:bg-slate-800 border border-emerald-500/50 rounded px-2 py-1 text-xs font-bold text-emerald-600 focus:outline-none"
                              />
                            </td>
                            <td className="py-2.5 pr-2">
                              <input
                                type="number"
                                min="0"
                                value={item.damagedQty}
                                onChange={(e) => handleUpdateGRNItem(idx, 'damagedQty', e.target.value)}
                                className="w-full bg-white dark:bg-slate-800 border border-rose-500/50 rounded px-2 py-1 text-xs font-bold text-rose-600 focus:outline-none"
                              />
                            </td>
                            <td className="py-2.5 pr-2">
                              <select
                                value={item.discrepancyReason}
                                onChange={(e) => handleUpdateGRNItem(idx, 'discrepancyReason', e.target.value)}
                                className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-xs"
                              >
                                <option value="">-- No Discrepancy --</option>
                                <option value="Seal Broken">Seal Broken</option>
                                <option value="Transit Leakage">Transit Leakage</option>
                                <option value="Temperature Abuse">Temperature Abuse</option>
                                <option value="Spoilage">Spoilage</option>
                                <option value="Short Count">Short Count</option>
                                <option value="Other">Other</option>
                              </select>
                            </td>
                            <td className="py-2.5 font-semibold">Rs {item.unitCostPrice}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="pt-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <input
                      type="text"
                      placeholder="Receiving notes (e.g. Temperature checked 4°C, seal intact)..."
                      value={grnNotes}
                      onChange={(e) => setGrnNotes(e.target.value)}
                      className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs w-96 focus:outline-none"
                    />

                    <Button
                      variant="primary"
                      onClick={handleSubmitGRN}
                      disabled={grnSaving}
                      className="text-xs font-bold shadow-md"
                    >
                      {grnSaving ? 'Confirming...' : 'Confirm GRN & Commit Stock to Kiosk'}
                    </Button>
                  </div>
                </div>
              ) : (
                /* List of incoming dispatches */
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700 text-xs text-slate-500 uppercase">
                        <th className="pb-3">Manifest #</th>
                        <th className="pb-3">Date</th>
                        <th className="pb-3">Source Central Kitchen</th>
                        <th className="pb-3">Dispatched Items</th>
                        <th className="pb-3">Total Value</th>
                        <th className="pb-3">Status</th>
                        <th className="pb-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                      {incomingDispatches.length === 0 ? (
                        <tr>
                          <td colSpan="7" className="py-6 text-center text-slate-400 italic">
                            No incoming dispatches found for this outlet.
                          </td>
                        </tr>
                      ) : (
                        incomingDispatches.map((ord) => (
                          <tr key={ord._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                            <td className="py-3 font-mono font-bold text-primary">{ord.dispatchNumber}</td>
                            <td className="py-3">{ord.dispatchDate}</td>
                            <td className="py-3 font-semibold">{ord.sourceKitchen?.name || 'Central Kitchen'}</td>
                            <td className="py-3">
                              {ord.totalDispatchedUnits} Units ({(ord.items || []).map(i => i.dishName).slice(0, 2).join(', ')}...)
                            </td>
                            <td className="py-3 font-bold">Rs {ord.totalTransferValue}</td>
                            <td className="py-3">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  ord.transitStatus === 'Reconciled'
                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                                    : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                                }`}
                              >
                                {ord.transitStatus}
                              </span>
                            </td>
                            <td className="py-3 text-right">
                              {ord.transitStatus !== 'Reconciled' ? (
                                <button
                                  type="button"
                                  onClick={() => handleStartGRN(ord)}
                                  className="text-xs px-3 py-1 bg-primary text-white rounded font-bold hover:bg-primary-dark transition-colors"
                                >
                                  Inspect & Receive
                                </button>
                              ) : (
                                <span className="text-emerald-600 font-semibold flex items-center justify-end gap-1">
                                  <span className="material-icons-outlined text-sm">verified</span> Reconciled
                                </span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
          <div className="p-6 space-y-6">
            <div className="flex items-center text-slate-500 dark:text-slate-400 font-medium text-sm">
              <span className="material-icons-outlined text-sm mr-2">history</span>
              Last 7 days activity
            </div>
            <div className="space-y-6">
              {filteredInventory.slice(0, 3).map((item, idx) => (
                <div key={item._id} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-3 h-3 rounded-full mt-1.5 ${idx === 0 ? 'bg-green-500' : idx === 1 ? 'bg-red-500' : 'bg-blue-500'
                        }`}
                    />
                    {idx < 2 && (
                      <div className="w-px flex-1 bg-slate-200 dark:bg-slate-700 my-1" />
                    )}
                  </div>
                  <div className="flex-1 pb-4">
                    <div className="flex justify-between">
                      <div>
                        <p className="font-semibold text-slate-800 dark:text-slate-100">{item.name}</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">{item.branch?.name || item.branch || 'N/A'}</p>
                      </div>
                      <div className="text-right">
                        <p
                          className={`font-bold ${idx === 0 ? 'text-green-600' : idx === 1 ? 'text-red-600' : 'text-blue-600'
                            }`}
                        >
                          {idx === 0 ? '+' : idx === 1 ? '-' : ''}
                          {idx === 2 ? '10' : '20'}
                        </p>
                        <p className="text-[12px] text-slate-400">
                          {item.lastUpdated ? new Date(item.lastUpdated).toLocaleDateString() : 'N/A'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* Add Stock Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
              <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                <span className="material-icons-outlined text-primary">inventory_2</span>
                Add Raw Material / Stock
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <span className="material-icons-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveNewStock} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                  Item / Ingredient Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Amul Table Butter, Fresh Malai Paneer"
                  value={addForm.name}
                  onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                    Quantity to Add
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="e.g. 4 or 45"
                    value={addForm.quantity}
                    onChange={(e) => setAddForm({ ...addForm, quantity: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                    Unit
                  </label>
                  <select
                    value={addForm.unit}
                    onChange={(e) => setAddForm({ ...addForm, unit: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="Kg">Kg</option>
                    <option value="L">L</option>
                    <option value="g">g</option>
                    <option value="ml">ml</option>
                    <option value="pcs">pcs</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                    Category
                  </label>
                  <select
                    value={addForm.category}
                    onChange={(e) => setAddForm({ ...addForm, category: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="Vegetables">Vegetables</option>
                    <option value="Meat">Meat</option>
                    <option value="Oils">Oils</option>
                    <option value="Grains">Grains</option>
                    <option value="Spices">Spices</option>
                    <option value="Other">Other (Dairy / Packaging)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                    Alert Threshold
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={addForm.threshold}
                    onChange={(e) => setAddForm({ ...addForm, threshold: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                <Button variant="outline" type="button" onClick={() => setShowAddModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={addingStock}>
                  {addingStock ? 'Saving...' : 'Add to Stock'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default InventoryManagement;
