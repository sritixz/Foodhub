import { useEffect, useState, useRef } from 'react';
import Layout from '../components/Layout/Layout';
import Card from '../components/UI/Card';
import Input from '../components/UI/Input';
import Button from '../components/UI/Button';
import api from '../utils/api';
import Papa from 'papaparse';
import { useAuth } from '../context/AuthContext';

const VendorDailyLog = () => {
  const { user } = useAuth();
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [items, setItems] = useState([]);
  const [collections, setCollections] = useState({ actualCash: '', actualGpay: '' });
  const [expenses, setExpenses] = useState({ salary: '', transport: '', corp: '', other: '' });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const fileInputRef = useRef(null);
  const [outlets, setOutlets] = useState([]);
  const [selectedOutlet, setSelectedOutlet] = useState(user?.outlet || '');

  useEffect(() => {
    // If admin, fetch outlets to select from. Else just use their outlet.
    if (['Admin', 'Company Admin'].includes(user?.role)) {
      api.get('/outlets').then(res => {
        setOutlets(res.data);
        if (res.data.length > 0 && !selectedOutlet) {
          setSelectedOutlet(res.data[0]._id);
        }
      });
    } else if (user?.outlet) {
      setSelectedOutlet(user.outlet);
    }
  }, [user]);

  useEffect(() => {
    if (date && selectedOutlet) {
      fetchData();
    }
  }, [date, selectedOutlet]);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      // 1. Fetch daily menu for this outlet
      const dailyMenuRes = await api.get(`/daily-menu?date=${date}&outletId=${selectedOutlet}`);
      let outletMenu = [];
      
      if (dailyMenuRes.data && dailyMenuRes.data.meals) {
         const meals = dailyMenuRes.data.meals;
         const allItems = [...(meals.breakfast || []), ...(meals.lunch || []), ...(meals.fullMeal || []), ...(meals.snack || [])];
         const uniqueMap = new Map();
         allItems.forEach(i => {
           if(i) uniqueMap.set(i._id, i);
         });
         outletMenu = Array.from(uniqueMap.values());
      } else {
         // Fallback to full catalog if daily menu isn't configured yet
         const menuRes = await api.get('/menu-items');
         outletMenu = menuRes.data.filter(
           item => item.vendor?._id === selectedOutlet || item.outlets?.some(o => o._id === selectedOutlet) || item.applyToAll
         );
      }

      // 2. Fetch digital sales for today
      const salesRes = await api.get(`/ledger/calculate-sales?date=${date}&outletId=${selectedOutlet}`);
      const digitalSales = salesRes.data;

      // 3. Initialize items state
      const initialItems = outletMenu.map(menuItem => {
        const saleData = digitalSales.find(d => d._id === menuItem._id) || { digitalSoldQty: 0, posSoldQty: 0, digitalRevenue: 0 };
        return {
          menuItem: menuItem._id,
          name: menuItem.name,
          category: menuItem.category?.name || 'General',
          costPrice: menuItem.costPrice || 0,
          sellingPrice: menuItem.basePrice || 0,
          sentQty: '',
          digitalSoldQty: saleData.digitalSoldQty,
          posSoldQty: saleData.posSoldQty,
          counterSoldQty: '', // This will be the manual override/add-on
        };
      });

      // 4. Try fetching existing ledger for this date
      try {
        const ledgerRes = await api.get(`/ledger/outlet?date=${date}&outletId=${selectedOutlet}`);
        if (ledgerRes.data) {
          const savedItems = ledgerRes.data.items;
          const mergedItems = initialItems.map(initItem => {
            const saved = savedItems.find(s => s.menuItem?._id === initItem.menuItem);
            if (saved) {
              return { ...initItem, sentQty: saved.sentQty, counterSoldQty: saved.counterSoldQty };
            }
            return initItem;
          });
          setItems(mergedItems);
          setCollections({
            actualCash: ledgerRes.data.collections.actualCash || '',
            actualGpay: ledgerRes.data.collections.actualGpay || ''
          });
          setExpenses({
            salary: ledgerRes.data.expenses.salary || '',
            transport: ledgerRes.data.expenses.transport || '',
            corp: ledgerRes.data.expenses.corp || '',
            other: ledgerRes.data.expenses.other || ''
          });
          if(ledgerRes.data.status === 'Approved'){
             setError('This ledger has been approved and cannot be edited.');
          }
        }
      } catch (err) {
        // Ledger doesn't exist yet, just use initialized items
        setItems(initialItems);
        setCollections({ actualCash: '', actualGpay: '' });
        setExpenses({ salary: '', transport: '', corp: '', other: '' });
      }

    } catch (err) {
      console.error(err);
      setError('Failed to load data. ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleItemChange = (index, field, value) => {
    const updated = [...items];
    updated[index][field] = value;
    setItems(updated);
  };

  const handleExpenseChange = (e) => {
    setExpenses({ ...expenses, [e.target.name]: e.target.value });
  };

  const handleCollectionChange = (e) => {
    setCollections({ ...collections, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const payloadItems = items.map(item => {
        const sent = Number(item.sentQty) || 0;
        const pos = Number(item.posSoldQty) || 0;
        const manual = Number(item.counterSoldQty) || 0;
        const totalCounter = pos + manual;
        const totalSold = item.digitalSoldQty + totalCounter;
        const wastage = sent - totalSold;
        const revenue = totalSold * item.sellingPrice;
        const costing = sent * item.costPrice; // Or totalSold * cp depending on business logic, sticking to plan Sent * CP
        const gp = revenue - costing;
        
        return {
          menuItem: item.menuItem,
          costPrice: item.costPrice,
          sellingPrice: item.sellingPrice,
          sentQty: sent,
          digitalSoldQty: item.digitalSoldQty,
          counterSoldQty: totalCounter,
          totalSoldQty: totalSold,
          wastageQty: wastage,
          revenue,
          costing,
          grossProfit: gp
        };
      });

      let totalRevenue = 0, totalCosting = 0, grossProfit = 0;
      payloadItems.forEach(i => {
        totalRevenue += i.revenue;
        totalCosting += i.costing;
        grossProfit += i.grossProfit;
      });

      const totalExpenses = (Number(expenses.salary) || 0) + (Number(expenses.transport) || 0) + (Number(expenses.corp) || 0) + (Number(expenses.other) || 0);
      const netProfit = grossProfit - totalExpenses;

      const payload = {
        date,
        outlet: selectedOutlet,
        items: payloadItems,
        collections: {
          actualCash: Number(collections.actualCash) || 0,
          actualGpay: Number(collections.actualGpay) || 0,
        },
        expenses: {
          salary: Number(expenses.salary) || 0,
          transport: Number(expenses.transport) || 0,
          corp: Number(expenses.corp) || 0,
          other: Number(expenses.other) || 0,
        },
        financials: {
          totalRevenue,
          totalCosting,
          grossProfit,
          indirectExpenses: totalExpenses,
          netProfit
        }
      };

      await api.post('/ledger/submit', payload);
      setSuccess('End-of-Day Ledger successfully submitted!');
    } catch (err) {
      console.error(err);
      setError('Failed to submit ledger. ' + (err.response?.data?.message || err.message));
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadTemplate = () => {
    const csvContent = "Item Name,Manual Added Qty\n";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `EOD_Template.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsedData = results.data;
        const updatedItems = [...items];
        let matchCount = 0;

        parsedData.forEach(row => {
          const itemName = row['Item Name']?.trim();
          const manualQty = row['Manual Added Qty']?.trim();

          if (itemName && manualQty !== undefined) {
            const index = updatedItems.findIndex(i => i.name.toLowerCase() === itemName.toLowerCase());
            if (index !== -1) {
              updatedItems[index].counterSoldQty = manualQty;
              matchCount++;
            }
          }
        });

        setItems(updatedItems);
        setSuccess(`Successfully imported ${matchCount} items from CSV.`);
        if (fileInputRef.current) fileInputRef.current.value = '';
      },
      error: (error) => {
        setError('Error parsing CSV file: ' + error.message);
      }
    });
  };

  return (
    <Layout>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vendor End-of-Day Log</h1>
          <p className="text-gray-600">Review your daily sales, report wastages, and log collections.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={handleDownloadTemplate}>
            Download Template
          </Button>
          <input 
            type="file" 
            accept=".csv" 
            ref={fileInputRef}
            onChange={handleFileUpload} 
            className="hidden" 
          />
          <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
            Import CSV
          </Button>
        </div>
      </div>

      <Card className="mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          <Input
            type="date"
            label="Date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            max={new Date().toISOString().split('T')[0]}
            required
          />
          {['Admin', 'Company Admin'].includes(user?.role) && (
            <div className="w-64">
              <label className="block text-sm font-medium text-gray-700 mb-1">Select Outlet</label>
              <select
                value={selectedOutlet}
                onChange={(e) => setSelectedOutlet(e.target.value)}
                className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-colors"
              >
                {outlets.map(o => (
                  <option key={o._id} value={o._id}>{o.name}</option>
                ))}
              </select>
            </div>
          )}
          <Button onClick={fetchData} loading={loading}>Refresh Data</Button>
        </div>
      </Card>

      {error && <div className="p-4 mb-4 text-red-700 bg-red-100 rounded-lg">{error}</div>}
      {success && <div className="p-4 mb-4 text-green-700 bg-green-100 rounded-lg">{success}</div>}

      {!loading && items.length > 0 && (
        <form onSubmit={handleSubmit}>
          <Card className="mb-6 overflow-x-auto">
            <h2 className="text-lg font-semibold mb-4">Inventory & Sales</h2>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="p-3 font-medium text-gray-600">Item Name</th>
                  <th className="p-3 font-medium text-gray-600 text-center">SP (₹)</th>
                  <th className="p-3 font-medium text-gray-600 text-center">Sent Qty</th>
                  <th className="p-3 font-medium text-gray-600 text-center">Digital Sold</th>
                  <th className="p-3 font-medium text-gray-600 text-center">POS Sold</th>
                  <th className="p-3 font-medium text-gray-600 text-center">Manual Added</th>
                  <th className="p-3 font-medium text-gray-600 text-center">Wastage</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => {
                  const sent = Number(item.sentQty) || 0;
                  const pos = Number(item.posSoldQty) || 0;
                  const manual = Number(item.counterSoldQty) || 0;
                  const totalSold = item.digitalSoldQty + pos + manual;
                  const wastage = sent - totalSold;

                  return (
                    <tr key={item.menuItem} className="border-b hover:bg-gray-50">
                      <td className="p-3">
                        <div className="font-medium text-gray-900">{item.name}</div>
                        <div className="text-xs text-gray-500">{item.category}</div>
                      </td>
                      <td className="p-3 text-center text-gray-600">{item.sellingPrice}</td>
                      <td className="p-3 text-center">
                        <input
                          type="number"
                          value={item.sentQty}
                          readOnly
                          className="w-20 px-2 py-1 bg-gray-100 border border-gray-300 rounded text-center text-gray-600 cursor-not-allowed"
                          title="Sent quantity is logged by the Central Kitchen"
                        />
                      </td>
                      <td className="p-3 text-center font-medium text-primary bg-orange-50">{item.digitalSoldQty}</td>
                      <td className="p-3 text-center font-medium text-blue-600 bg-blue-50">{item.posSoldQty}</td>
                      <td className="p-3 text-center">
                        <input
                          type="number"
                          min="0"
                          value={item.counterSoldQty}
                          onChange={(e) => handleItemChange(index, 'counterSoldQty', e.target.value)}
                          className="w-20 px-2 py-1 border border-gray-300 rounded text-center"
                          placeholder="0"
                        />
                      </td>
                      <td className={`p-3 text-center font-medium ${wastage < 0 ? 'text-red-500' : 'text-gray-700'}`}>
                        {wastage}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <Card>
              <h2 className="text-lg font-semibold mb-4">Actual Collections</h2>
              <div className="space-y-4">
                <Input
                  type="number"
                  name="actualCash"
                  label="Cash in Register (₹)"
                  value={collections.actualCash}
                  onChange={handleCollectionChange}
                  placeholder="0"
                />
                <Input
                  type="number"
                  name="actualGpay"
                  label="GPay / Online Received (₹)"
                  value={collections.actualGpay}
                  onChange={handleCollectionChange}
                  placeholder="0"
                />
              </div>
            </Card>

            <Card>
              <h2 className="text-lg font-semibold mb-4">Daily Expenses</h2>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  type="number"
                  name="salary"
                  label="Wages / Salary (₹)"
                  value={expenses.salary}
                  onChange={handleExpenseChange}
                  placeholder="0"
                />
                <Input
                  type="number"
                  name="transport"
                  label="Transport (₹)"
                  value={expenses.transport}
                  onChange={handleExpenseChange}
                  placeholder="0"
                />
                <Input
                  type="number"
                  name="corp"
                  label="Corporate/Admin (₹)"
                  value={expenses.corp}
                  onChange={handleExpenseChange}
                  placeholder="0"
                />
                <Input
                  type="number"
                  name="other"
                  label="Other Expenses (₹)"
                  value={expenses.other}
                  onChange={handleExpenseChange}
                  placeholder="0"
                />
              </div>
            </Card>
          </div>

          <div className="flex justify-end">
            <Button type="submit" loading={saving} size="lg">
              Submit EOD Ledger
            </Button>
          </div>
        </form>
      )}
    </Layout>
  );
};

export default VendorDailyLog;
