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

  useEffect(() => {
    fetchInventory();
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
            <Button>
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
                        <button className="text-slate-400 hover:text-primary transition-colors">
                          <span className="material-icons-outlined">more_vert</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Stock Movement */}
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
    </Layout>
  );
};

export default InventoryManagement;
