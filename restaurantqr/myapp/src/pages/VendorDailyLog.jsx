import { useEffect, useState, useRef } from 'react';
import Layout from '../components/Layout/Layout';
import Card from '../components/UI/Card';
import Input from '../components/UI/Input';
import Button from '../components/UI/Button';
import api from '../utils/api';
import { parseImportFile } from '../utils/fileParser';
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
  const [warning, setWarning] = useState('');
  const fileInputRef = useRef(null);
  const [outlets, setOutlets] = useState([]);
  const [selectedOutlet, setSelectedOutlet] = useState(user?.outlet || '');
  const [debugData, setDebugData] = useState(null);

  useEffect(() => {
    // If admin, fetch outlets to select from. Else just use their outlet.
    if (['Admin', 'Company Admin', 'Owner', 'Management'].includes(user?.role)) {
      api.get('/outlets').then(res => {
        setOutlets(res.data);
        if (res.data.length > 0 && !selectedOutlet) {
          setSelectedOutlet(res.data[0]._id);
        }
      });
    } else if (user?.outlet) {
      setSelectedOutlet(user.outlet);
      api.get(`/outlets/${user.outlet}`).then(res => {
        setOutlets([res.data]);
      }).catch(err => console.error(err));
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
    setWarning('');
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

      const getMealCategoryOfItem = (menuItemId, catalogCategory) => {
        if (dailyMenuRes.data && dailyMenuRes.data.meals) {
          const meals = dailyMenuRes.data.meals;
          const assigned = [];
          const matchId = (ref) => {
            const refId = ref && ref._id ? ref._id.toString() : (ref ? ref.toString() : '');
            return refId === menuItemId?.toString();
          };
          if (meals.breakfast?.some(matchId)) assigned.push('Breakfast');
          if (meals.lunch?.some(matchId)) assigned.push('Lunch');
          if (meals.fullMeal?.some(matchId)) assigned.push('Full Meal');
          if (meals.snack?.some(matchId)) assigned.push('Snack');
          if (assigned.length > 0) return assigned.join(', ');
        }

        // Fallback mapping: convert any catalog category to daily menu slot
        const cat = (catalogCategory || '').toLowerCase();
        if (cat.includes('breakfast')) return 'Breakfast';
        if (cat.includes('lunch')) return 'Lunch';
        if (cat.includes('full') || cat.includes('meal') || cat.includes('course') || cat.includes('main')) return 'Lunch';
        if (cat.includes('snack') || cat.includes('dessert') || cat.includes('sweet') || cat.includes('beverage') || cat.includes('tea') || cat.includes('appetiz') || cat.includes('light')) return 'Snack';
        return 'Snack';
      };

      // 3. Initialize items state
      const initialItems = outletMenu.map(menuItem => {
        const saleData = digitalSales.find(d => d._id === menuItem._id) || { digitalSoldQty: 0, posSoldQty: 0, digitalRevenue: 0 };
        return {
          menuItem: menuItem._id,
          name: menuItem.name,
          category: getMealCategoryOfItem(menuItem._id, menuItem.category?.name),
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
              return {
                ...initItem,
                costPrice: saved.costPrice !== undefined ? saved.costPrice : initItem.costPrice,
                sellingPrice: saved.sellingPrice !== undefined ? saved.sellingPrice : initItem.sellingPrice,
                sentQty: saved.sentQty,
                counterSoldQty: Math.max(0, (saved.counterSoldQty || 0) - (initItem.posSoldQty || 0))
              };
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
        const cp = Number(item.costPrice) || 0;
        const sp = Number(item.sellingPrice) || 0;
        const totalCounter = pos + manual;
        const totalSold = item.digitalSoldQty + totalCounter;
        const wastage = sent - totalSold;
        const revenue = totalSold * sp;
        const costing = sent * cp;
        const gp = revenue - costing;
        
        return {
          menuItem: item.menuItem,
          costPrice: cp,
          sellingPrice: sp,
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
    // Columns: Category, Item Name, CP, Sent, Sold, Wastage, SP, Revenue, Costing, NP
    const csvRows = [];
    
    const selectedOutletObj = outlets.find(o => o._id === selectedOutlet);
    const outletName = selectedOutletObj ? selectedOutletObj.name : 'Outlet';

    // Header Row 1 (date/day info like in Excel image, e.g. "Date, [date string], [day of week]")
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const d = new Date(date);
    const dayOfWeek = days[isNaN(d.getDay()) ? 0 : d.getDay()];
    csvRows.push(`Date,${date},${dayOfWeek},,,,,,,`);
    
    // Header Row 2 (outlet name)
    csvRows.push(`Outlet,${outletName},,,,,,,,`);
    
    // Header Row 3: column labels
    csvRows.push("Category,Item Name,CP,Sent,Sold,Wastage,SP,Revenue,Costing,NP");
    
    // Data Rows
    items.forEach(item => {
      const sent = Number(item.sentQty) || 0;
      const pos = Number(item.posSoldQty) || 0;
      const manual = Number(item.counterSoldQty) || 0;
      const totalSold = (Number(item.digitalSoldQty) || 0) + pos + manual;
      const wastage = sent - totalSold;
      const cp = Number(item.costPrice) || 0;
      const sp = Number(item.sellingPrice) || 0;
      const revenue = totalSold * sp;
      const costing = sent * cp;
      const np = revenue - costing;
      
      const escapedName = item.name.includes(',') ? `"${item.name}"` : item.name;
      const escapedCategory = item.category.includes(',') ? `"${item.category}"` : item.category;
      
      csvRows.push(`${escapedCategory},${escapedName},${cp},${sent},${totalSold},${wastage},${sp},${revenue},${costing},${np}`);
    });
    
    // Add empty rows for spacing like in the Excel
    csvRows.push(",,,,,,,,,");
    csvRows.push(",,,,,,,,,");
    
    // Add summary fields at the bottom
    const totalExpenses = (Number(expenses.salary) || 0) + (Number(expenses.transport) || 0) + (Number(expenses.corp) || 0) + (Number(expenses.other) || 0);
    
    csvRows.push(`Cash,,,,,Cash,${collections.actualCash || 0},,,`);
    csvRows.push(`Gpay,,,,,Gpay,${collections.actualGpay || 0},,,`);
    csvRows.push(`Salary,,,,,Salary,${expenses.salary || 0},,,`);
    csvRows.push(`Transp,,,,,Transp,${expenses.transport || 0},,,`);
    csvRows.push(`Corp,,,,,Corp,${expenses.corp || 0},,,`);
    csvRows.push(`Other,,,,,Other,${expenses.other || 0},,,`);
    csvRows.push(`Total Expenses,,,,,Indirect Exp,${totalExpenses},,,`);
    
    const csvContent = "\uFEFF" + csvRows.join("\n"); // \uFEFF for Excel UTF-8 compatibility
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    
    const cleanOutletName = outletName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    const filename = `daily_account_${date}_${cleanOutletName}.csv`;
    link.setAttribute('download', filename);
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    console.log("[VendorDailyLog] File selected for upload:", file.name, "size:", file.size);
    setError('');
    setSuccess('');
    setWarning('');

    try {
      console.log("[VendorDailyLog] Calling parseImportFile with items count:", items.length);
      const result = await parseImportFile(file, items);
      console.log("[VendorDailyLog] parseImportFile raw result:", result);
      setDebugData(result);
      
      if (result.items) {
        setItems(result.items);
      }
      
      if (result.collections) {
        setCollections(prev => ({
          actualCash: result.collections.actualCash !== undefined ? result.collections.actualCash : prev.actualCash,
          actualGpay: result.collections.actualGpay !== undefined ? result.collections.actualGpay : prev.actualGpay,
        }));
      }
      
      if (result.expenses) {
        setExpenses(prev => ({
          salary: result.expenses.salary !== undefined ? result.expenses.salary : prev.salary,
          transport: result.expenses.transport !== undefined ? result.expenses.transport : prev.transport,
          corp: result.expenses.corp !== undefined ? result.expenses.corp : prev.corp,
          other: result.expenses.other !== undefined ? result.expenses.other : prev.other,
        }));
      }

      setSuccess(`Successfully imported data from file (${result.matchCount} items matched).`);
      if (result.unmatched && result.unmatched.length > 0) {
        setWarning(`Warning: The following items from the file did not match any catalog items: ${result.unmatched.join(', ')}`);
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      setError('Error parsing file: ' + err.message);
    }
  };

  const handleResetValues = () => {
    // 1. Reset manual added qty for each item in state
    setItems(prevItems => prevItems.map(item => ({
      ...item,
      counterSoldQty: 0
    })));

    // 2. Reset collections state
    setCollections({ actualCash: '', actualGpay: '' });

    // 3. Reset expenses state
    setExpenses({ salary: '', transport: '', corp: '', other: '' });

    // 4. Reset debugData (to hide debugger card)
    setDebugData(null);

    // Optional: show a confirmation banner
    setSuccess('Cleared all manually entered sales, collections, and expense values.');
    setTimeout(() => setSuccess(''), 3000);
  };

  return (
    <Layout>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vendor End-of-Day Log</h1>
          <p className="text-gray-600">Review your daily sales, report wastages, and log collections.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="danger" onClick={handleResetValues}>
            Reset Values
          </Button>
          <Button variant="secondary" onClick={handleDownloadTemplate}>
            Download CSV
          </Button>
          <input 
            type="file" 
            accept=".csv,.xlsx,.xls" 
            ref={fileInputRef}
            onChange={handleFileUpload} 
            className="hidden" 
          />
          <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
            Import CSV/Excel
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
          {['Admin', 'Company Admin', 'Owner', 'Management'].includes(user?.role) && (
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
          {!['Admin', 'Company Admin', 'Owner', 'Management'].includes(user?.role) && outlets.length > 0 && (
            <div className="w-64">
              <label className="block text-sm font-medium text-gray-700 mb-1">Outlet</label>
              <div className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 font-medium">
                {outlets[0]?.name}
              </div>
            </div>
          )}
          <Button onClick={fetchData} loading={loading}>Refresh Data</Button>
        </div>
      </Card>

      {error && <div className="p-4 mb-4 text-red-700 bg-red-100 rounded-lg">{error}</div>}
      {success && <div className="p-4 mb-4 text-green-700 bg-green-100 rounded-lg">{success}</div>}
      {warning && <div className="p-4 mb-4 text-amber-800 bg-amber-50 border border-amber-200 rounded-lg">{warning}</div>}

      {!loading && items.length > 0 && (
        <form onSubmit={handleSubmit}>
          <Card className="mb-6 overflow-x-auto">
            <h2 className="text-lg font-semibold mb-4">Inventory & Sales</h2>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="p-3 font-medium text-gray-600">Item Name</th>
                  <th className="p-3 font-medium text-gray-600 text-center">CP (₹)</th>
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
                      <td className="p-3 text-center">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.costPrice}
                          onChange={(e) => handleItemChange(index, 'costPrice', e.target.value)}
                          className="w-20 px-2 py-1 border border-gray-300 rounded text-center"
                          placeholder="0"
                        />
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

      {debugData && (
        <Card className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Import Debugger (JSON)</h3>
          <pre className="text-xs overflow-auto max-h-60 bg-gray-900 text-green-400 p-3 rounded">
            {JSON.stringify({
              matchCount: debugData.matchCount,
              unmatchedCount: debugData.unmatched?.length,
              unmatchedList: debugData.unmatched,
              collections: debugData.collections,
              expenses: debugData.expenses,
              firstThreeRawRows: debugData.rawParsedRows?.slice(0, 3)
            }, null, 2)}
          </pre>
        </Card>
      )}
    </Layout>
  );
};

export default VendorDailyLog;
